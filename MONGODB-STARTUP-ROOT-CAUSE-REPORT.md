# MONGODB STARTUP ROOT-CAUSE REPORT

Date: 2026-09-08 (final revision) · Scope: `node .` startup failure (MongoDB INVALID_URI) · Phase 4 completed — no Phase 5 work started.

## 1. Actual startup path
`npm start` / `node .` → `package.json` `main: index.js` → root launcher `index.js` (banner, memory checks, `maxRestartAttempts: 3`) → `require('./dist/index.js')` → `dist/index.js` loads `dist/config.js` first (`process.loadEnvFile(<project>/.env)` lines 5-11) → `new ModBot()` → `bot.init()` starts (async).

## 2. Actual runtime config path
`dist/index.js` `ModBot.init()` reads `config_1.default.mongoUri` → `dist/config.js` `mongoUri: getEnv('MONGO_URI')` → `getEnv` returns trimmed `process.env['MONGO_URI']`. This is the only Mongoose connection in the project. No connection options passed (driver defaults; `serverSelectionTimeoutMS` 30000).

## 3. .env loading path
`dist/config.js` line 7: `process.loadEnvFile(path.join(__dirname, '..', '.env'))` → absolute path `<project>/dist/../.env` = `<project>/.env`, correct regardless of CWD. Load: PASS. Presence (safe check): BOT_TOKEN PRESENT, CLIENT_ID PRESENT, MONGO_URI PRESENT, SESSION_SECRET PRESENT, CALLBACK_URL PRESENT, MAIN_GUILD_ID PRESENT, DASHBOARD_CLIENT_SECRET MISSING. MONGO_URI: format VALID, length 93, contains credentials YES. No values printed.

## 4. Config mapping before fix
`dist/config.js` had been overwritten again (3rd occurrence). Corrupted lines passed real values into `getEnv()`: line 24 token literal, line 25 clientId literal, line 26 `getEnv('mongodb+srv://…')` URI literal, line 28 mainGuildId literal, line 32 SESSION_SECRET literal, line 33 callback literal; additionally defaultPrefix default changed `'!'`→`'-'` and `ownerIds` injected `[888789432939974677]`.

## 5. Exact root cause
`getEnv(name)` returns `process.env[name]`. No environment variable is named `mongodb+srv://…` (or like a token), so corrupted calls returned `''` → `config.mongoUri = ''` → `mongoose.connect('')`. Confirmed by proof-of-execution: `mongoose.connect('')` throws `MongoParseError` (classified INVALID_URI) before any network I/O.

## 6. Why MongoParseError / INVALID_URI occurred
The generic catch in `dist/index.js` replaced the real throw with `new Error('MongoDB connection failed.')`, hiding the true cause. The observed runtime diagnostic: `MongoDB diagnostic type: INVALID_URI`, `name=MongoParseError code=n/a`, stack at `ModBot.init (dist/index.js:196:23)`.

## 7. Why Atlas/network were not the cause
Safe probes: DNS resolution PASS (SRV → targets → A records), TCP :27017 PASS (read-only, host never printed). DB read-only connect via `.env` works. Network/credentials/reachability all healthy; failure occurs purely at URI parsing because the value was `''`.

## 8. What process regenerated/corrupted config.js
No in-project mechanism writes `dist/config.js`: no postinstall/prestart/prepare scripts; `start`/`build`/`backup` scripts only copy or syntax-check; scans found **no** `writeFile`/`copyFile` targeting `config.js`, no chokidar-based rewriter, and no source template. Backup script (`scripts/backup.js`) is copy-only (dist → backups). Evidence points to an **external process** restoring a snapshot: (a) corruption reappeared 3 times after each fix; (b) each version differs (prefix `-`, injected `ownerIds`) matching "resolved app state" baking; (c) `dist/index.js` instrumentation (added in a prior session) survived — only `config.js` is rewritten. **Action required on your side: locate and disable the external generator/archive-restore that overwrites `dist/config.js`.** In-repo, there is nothing to fix.

## 9. Files changed
- `dist/config.js` — restored exact env-name mapping on all 7 corrupted lines; defaultPrefix back to `'!'`; `ownerIds` back to `[]`; REQUIRED_ENV unchanged.
- `dist/index.js` —
  (a) Pre-connect SAFE diagnostic + classification before `mongoose.connect()` (EMPTY / INVALID_PREFIX / VALID_FORMAT, length, prefix, credentials, fallback source; never prints the URI);
  (b) Runtime resilience/fallback: if `config.mongoUri` is empty or has a bad prefix, read `process.env.MONGO_URI`; same fallback for token (`BOT_TOKEN`) and clientId (`CLIENT_ID`) by patching the resolved config object so all consumers (connect, deployCommands, login, dashboard) see effective values;
  (c) `init()` now RETHROWS on failure instead of `process.exit(1)`, so the launcher can await it and the restart logic works;
  (d) exposes `module.exports.startup` (the init promise).
- `index.js` (root launcher) — awaits `app.startup` before printing "Bot initialization successful" / "Bot is now online and ready to serve!"; replaced empty catch block (lint).

## 10. Launcher readiness fix
Previously the launcher printed "✓ online and ready" immediately after the synchronous `require()`, before Mongo/Discord were ready (and init's `process.exit(1)` bypassed restart logic). Now the launcher does `await app.startup`; "online" prints only after Mongo connected + Discord logged in + init completed. Failure propagates to `handleStartupError` → existing restart logic (3 attempts) preserved. Verified: `online` now appears AFTER `Logged in as`.

## 11. Verification
- `npm test`: 42/42 PASS.
- Syntax (`node --check`): 137 project JS files, 0 failures.
- ESLint on changed files (`index.js`, `dist/index.js`, `dist/config.js`): 0 errors.
- `config-assert.js`: 26/26 PASS.
- **`node .`**: PASS. Log sequence:
  - `MongoDB diagnostic: uri class=VALID_FORMAT length=93 empty=NO validPrefix=YES credentials=YES fallback=NO`
  - `Connected to MongoDB`
  - `MongoDB diagnostic: readyState before=0 after=1`
  - `Logged in as Viora#8868`
  - `Bot initialization successful … 5.06s` then `Bot is now online…` (order ok — no premature message)
- Post-start config integrity: `dist/config.js` re-read after `node .` — still `getEnv('MONGO_URI')`, `getEnv('BOT_TOKEN')`, etc.; no literal URI/token; REQUIRED_ENV intact; `ownerIds: []`; prefix `'!'`.

## 12. Security
- Secrets printed in logs: NO (all values masked; only type/length/prefix/credentials-boolean reported).
- Production MongoDB data modified: NO (read-only operations only).
- Credentials exposed in logs/report: NO.
- Residual config gap (unchanged): `DASHBOARD_CLIENT_SECRET` MISSING → OAuth/authenticated dashboard login remains unavailable.

---

## FINAL OUTPUT

**MONGODB STARTUP ROOT-CAUSE REPORT**

- Root cause: `dist/config.js` corrupted (3rd time, externally injected) — `getEnv` called with real secret/URI literal values instead of env-var names → `getEnv()` returned `''` (no env var has that name) → `config.mongoUri = ''` → `mongoose.connect('')` threw `MongoParseError` → generic catch masked it as "MongoDB connection failed." at `dist/index.js:196`.
- Fix: restored the exact env-name mapping in `dist/config.js`; added safe pre-connect URI classification + `process.env` fallback in `dist/index.js` (startup now works even if config.js is rewritten again); `init()` rethrows so the launcher can await readiness (no premature "online"); launcher awaits `app.startup`.
- Regenerator/source of corruption: NONE in the project tree (no scripts write config.js; verified by scans). External snapshot/archive restore that injects resolved values into `dist/config.js` — locate and disable it on the environment side.
- Runtime URI classification: VALID_FORMAT (length 93, valid prefix, credentials YES, source config).
- Mongo readyState: before=0 → after=1.
- Discord: logged in as Viora (PASS).
- node .: PASS (no INVALID_URI, no init error, online printed after login).
- Tests: 42/42 PASS.
- Syntax: 137/137 files PASS.
- Lint: clean (changed files).
- Post-start config integrity: PASS (`getEnv('MONGO_URI')` and all sensitive mappings intact after exit).
- Secrets exposed: NO.
- Production DB modified: NO.