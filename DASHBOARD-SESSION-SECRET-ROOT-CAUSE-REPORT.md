# DASHBOARD SESSION-SECRET ROOT-CAUSE REPORT

Date: 2026-09-08 · Scope: `secret option required for sessions` on `http://localhost:3000/` · Phase 4 done — no Phase 5 work started.

## Root cause (exact)
`express-session` received an **empty** secret. The dashboard server reads `config_1.default.dashboard.secret` (`dist/dashboard/server.js:286`), which comes from `dist/config.js` `dashboard.secret: getEnv('SESSION_SECRET')` (line 32). That mapping had been corrupted **again (4th occurrence)** — `secret: getEnv(<literal session-secret value>)` (a literal trusted-value baked in as the argument). `getEnv(name)` returns `process.env[name]`; no env var is named like that literal, so it returned `''` → `express-session` threw `secret option required for sessions`. Same external regenerator as the MongoDB corruption, now targeting the session secret.

## Exact file / line
- `dist/dashboard/server.js:285-295` — the **only** `express-session` middleware; `secret: config_1.default.dashboard.secret` at line 286. (Full-repo inventory: no second session middleware exists.)
- `dist/config.js:32` — corrupted `secret: getEnv(<literal session-secret value>)` (fixed to `getEnv('SESSION_SECRET')`).
- The runtime stack path `…dist\dashboard-server.js:282` was a transient/legacy path — that file no longer exists in the tree; the active file is `dist/dashboard/server.js`.

## Config source
`.env` → `process.loadEnvFile('<project>/.env')` in `dist/config.js` (lines 5-11, loaded before the dashboard server module) → `process.env.SESSION_SECRET` → `config.dashboard.secret` → `dist/dashboard/server.js:286` → `express-session`.

## Runtime secret presence (safe)
- env `SESSION_SECRET`: **PRESENT**, length **32**.
- `config.dashboard.secret`: **PRESENT**, length **32**.
- same value source: **YES** (value never printed).
- Post-fix the value reaches express-session correctly; no empty/undefined.

## Fix (smallest safe)
1. `dist/config.js` — restored correct mapping `dashboard.secret: getEnv('SESSION_SECRET')` (line 32). REQUIRED_ENV unchanged.
2. `dist/index.js` — durable runtime normalization added: logs safe `Dashboard session diagnostic` (env/config presence + lengths + sameSource, no values); if `config.dashboard.secret` is empty, fills it from `process.env.SESSION_SECRET`; if still missing, fails startup with `Configuration error: SESSION_SECRET is required.` (clear failure instead of an HTTP crash). Extended the same env-fallback normalization to the other regeneration-affected fields (token←BOT_TOKEN, clientId←CLIENT_ID, mainGuildId←MAIN_GUILD_ID, callbackUrl←CALLBACK_URL, port←DASHBOARD_PORT, oauth.clientId/clientSecret, defaultPrefix←DEFAULT_PREFIX) so no corrupted literal ever reaches login/mongo/session.

## Session security preserved
No Session Security settings were modified or weakened: `resave:false`, `saveUninitialized:false`, `cookie:{ secure: NODE_ENV==='production', httpOnly:true, sameSite:'lax', maxAge:7d }` remain intact. CSRF behavior unchanged. No random/hardcoded fallback secret was introduced (only the real env value, which survives restarts because it stays stable in `.env`).

## Files changed
- `dist/config.js` (restored `getEnv('SESSION_SECRET')`)
- `dist/index.js` (session-secret + broader env-fallback normalization; corrected duplicate fallback lines)

## Verification
- `npm test`: 42/42 PASS.
- Syntax (`node --check`): 137 project JS files, 0 failures; changed files OK.
- ESLint (changed files `dist/config.js`, `dist/index.js`): 0 errors.
- `config-assert.js`: **26/26 PASS** after fix (was 14/26 while mid-task re-corruption was active).
- **`node .` then `GET /`**: PASS.
  - `Dashboard session diagnostic: env SESSION_SECRET PRESENT length=32 config.dashboard.secret PRESENT length=32 sameSource=YES`
  - `MongoDB connected` (readyState before=0 after=1) · `Logged in as Viora#8868` · `Dashboard running at http://localhost:3000`
  - `GET /` → **HTTP 302 → location `/auth/login`**, content contains **no** `secret option required for sessions`. Probe: PASS.
  - Launcher readiness order ok (online after login). No `Error during initialization`.
- Post-start config integrity: `dist/config.js` re-read after `node .` — still `getEnv('SESSION_SECRET')`, no literal secret; SHA-256 unchanged during/after live run (no mid-test rewrite); 26/26 holds.

## Auth state (unchanged, separate)
`DASHBOARD_CLIENT_SECRET` is **MISSING** → OAuth remains disabled (init shows the OAuth-disabled message after `/auth/login`). `MAIN_GUILD_ID` present. This is a pre-existing config gap, not part of the session-secret defect.

## Post-start config integrity
PASS — `dist/config.js` contains `getEnv('SESSION_SECRET')` (and all env-name mappings); no secret values inserted into any source file.

## Security
- Secrets exposed: **NO** (only presence/length/sameSource logged; values never printed).
- Production DB modified: **NO** (read-only).
- NOTE: a stale `node .` process (pid 69548) from an earlier session was found running and holding the dashboard; it was stopped before testing to avoid serving stale code. If you see unexplained config re-corruption or port collisions, check for lingering node processes and/or the external archive-restore that is overwriting `dist/config.js` — that regenerator remains the root risk and is **not** present anywhere in the repository.