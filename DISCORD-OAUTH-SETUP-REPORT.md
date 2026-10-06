# DISCORD-OAUTH-SETUP-REPORT

Date: 2026-09-08 · Scope: enable existing Discord OAuth login flow · Phase 4 done — no Phase 5 work started.

## Objective & result in one line
The Discord OAuth flow is **already fully implemented and secure** in `dist/dashboard/server.js`. It was blocked solely by (a) `dist/config.js` being re-corrupted by the external regenerator (5th occurrence) and (b) `DASHBOARD_CLIENT_SECRET` being **absent from `.env`**. `oauth.clientId` now self-heals at runtime (falls back to `CLIENT_ID`); `oauth.clientSecret` cannot be enabled without the real app secret being added to `.env` by the user. **OAuth authenticated flow = BLOCKED BY CONFIGURATION (missing secret), not a code failure.**

## Step 1 — OAuth config status (safe)
- oauth.clientId: `config` value MISSING → **PRESENT at runtime after fallback** (patched from `CLIENT_ID`, length 19). `.env DASHBOARD_CLIENT_ID`: **MISSING** (length 0).
- oauth.clientSecret: `config` value MISSING → **MISSING at runtime** (length 0). `.env DASHBOARD_CLIENT_SECRET`: **MISSING** (length 0).
- No values printed.

## Step 2 — Config mapping (verified / fixed)
`dist/config.js` now contains **exactly**:
- `oauth.clientId: getEnv('DASHBOARD_CLIENT_ID') || getEnv('CLIENT_ID')` ✓
- `oauth.clientSecret: getEnv('DASHBOARD_CLIENT_SECRET')` ✓
- (`dashboard.secret: getEnv('SESSION_SECRET')`, `dashboard.callbackUrl: getEnv('CALLBACK_URL')` all intact.)
- `REQUIRED_ENV` unchanged. No hardcoded credentials.

Prior to my edit this file had been re-corrupted (5th occurrence): `oauth.clientId` set to `getEnv('http://localhost:3000/auth/callback')`, `oauth.clientSecret` set to `getEnv(<literal session-secret>)`, plus token/clientId/mongoUri/mainGuildId/defaultPrefix literals again. All 7 mappings restored.

## Step 3 — .env
- `DASHBOARD_CLIENT_SECRET = MISSING` (length 0). **Not invented, not modified.**
- `DASHBOARD_CLIENT_ID = MISSING` (length 0) — configuration supports the existing app `CLIENT_ID` via the `|| getEnv('CLIENT_ID')` fallback; `CLIENT_ID` present (length 19).
- No secret values modified in `.env`.

## Step 4 — Discord Developer Portal callback
- `CALLBACK_URL`: PRESENT (length 35), parses to path `/auth/callback`.
- The application expects the Discord redirect URI registered in the Developer Portal to equal `CALLBACK_URL` (e.g. `http://localhost:3000/auth/callback` for local). The callback path the app serves is `/auth/callback`. `CALLBACK_URL` was NOT changed.
- User action: ensure the same `CALLBACK_URL` (and its host) is registered under the Discord application's OAuth2 → Redirects. Also register the application's Client ID / reset Client Secret and put them in `.env` as `DASHBOARD_CLIENT_ID` / `DASHBOARD_CLIENT_SECRET`.

## Step 5 — OAuth flow audit (all security intact, no code changes)
`dist/dashboard/server.js`:
- `/auth/login` (342-368): generate `crypto.randomBytes(16)` state → store in `req.session.authState` → build authorize URL (client_id, redirect_uri, response_type=code, scope identify+guilds, state) → redirect to Discord.
- `/auth/callback` (370-447): rejects if no code/state or `state !== session.authState` (400); nulls `authState` after use; exchanges code via Discord token endpoint (axios, form-encoded); fetches `/users/@me` and `/users/@me/guilds`; **guild authorization** — 403 unless user's guilds include `mainGuildId`; then builds session.user (owner/admin role via permissions `ADMINISTRATOR`=8 / `MANAGE_GUILD`=32).
- `/auth/logout` (449): destroys session.
- `/api/auth/me` (454): auth-gated.
- Auth middleware (461+): 401 for `/api/*`, redirect to `/auth/login` otherwise.
Preserved (none weakened): state validation, CSRF via session state, session security, guild authorization, secure `httpOnly`/`sameSite` cookies, rate-limiting middleware unchanged.

## Step 6 — Authorization
After OAuth, access is gated on membership in `MAIN_GUILD_ID` (present). Arbitrary Discord users are rejected (403) unless they are members of the configured server; role derived from owner list / guild permissions. Logic unchanged.

## Step 7 — Safe error handling
- Missing secret → `/auth/login` renders the existing "Discord OAuth is not configured" page (200, no crash, no uncaught exception). Verified.
- Discord rejection path is wrapped in try/catch → sanitized "Failed to authenticate with Discord." message; no secret/code/token/refresh logged. Unchanged.
- Added a safe `OAuth diagnostic` log (presence + lengths only; never values).

## Step 8 — Test without real credential output
- `npm test`: 42/42 PASS.
- Syntax sweep: 137 project JS files, 0 failures.
- ESLint (changed files): 0 errors.
- `config-assert.js`: **26/26 PASS**.
- `node .`: MongoDB **connected** (readyState before=0 after=1), Discord **logged in** (Viora), Dashboard **running** on 3000.
- Probe: `GET /` → **302 → /auth/login**; `GET /auth/login` → **200** (login page renders, no session error).
- Runtime diagnostics (safe):
  - `Dashboard session diagnostic: env SESSION_SECRET PRESENT length=32 config.dashboard.secret PRESENT length=32 sameSource=YES`
  - `OAuth diagnostic: DASHBOARD_CLIENT_ID MISSING length=0 DASHBOARD_CLIENT_SECRET MISSING length=0 clientId-after-fallback PRESENT length=19 clientSecret-after-fallback MISSING length=0`
- **OAuth authenticated flow = BLOCKED BY CONFIGURATION** (`DASHBOARD_CLIENT_SECRET` missing), not a code failure.

## Step 9 — If credentials available locally
`DASHBOARD_CLIENT_SECRET` is **MISSING**, so no authenticated OAuth handshake was attempted (browser automation unavailable anyway). Full authorize→callback→session flow is reported **MANUAL TEST REQUIRED** after the user adds the secret.

## Step 10 — Config integrity
Post-start + post-test `dist/config.js` re-read: contains `getEnv('DASHBOARD_CLIENT_ID')`, `getEnv('DASHBOARD_CLIENT_SECRET')`, `getEnv('SESSION_SECRET')`, `getEnv('CALLBACK_URL')` — **no literal credentials**. config-assert 26/26. SHA-256 stable. Secret scan: NO HARDCODED SECRETS / NO CORRUPT getEnv.

## Files changed
- `dist/config.js` — corrected all 7 re-corrupted env-name mappings (incl. oauth.clientId/clientSecret).
- `dist/index.js` — added safe `OAuth diagnostic` log; runtime fallback for `oauth.clientId` (from `CLIENT_ID`) already handles clientId; clientSecret falls back to `DASHBOARD_CLIENT_SECRET` env (still absent → blocked).

## Report fields
- OAuth client ID: **PRESENT** (runtime, via CLIENT_ID fallback; `.env DASHBOARD_CLIENT_ID` MISSING)
- OAuth client secret: **MISSING** (length 0)
- Callback configuration: **VALID** (CALLBACK_URL present, path `/auth/callback`)
- MAIN_GUILD_ID: **PRESENT**
- OAuth code flow: **BLOCKED BY CONFIGURATION / MANUAL TEST REQUIRED** (secret missing)
- Session: **PASS** (SESSION_SECRET 32 chars, sessions working)
- Guild authorization: **VALID logic present** (gated on MAIN_GUILD_ID membership); end-to-end **NOT TESTED** (no secret)
- Tests: **42/42 PASS**
- Syntax: **137/137 PASS**
- Lint: **clean**
- Config integrity: **PASS** (26/26, no literals)
- Secrets exposed: **NO**
- Production DB modified: **NO**

## User action required (no code needed)
Add to the local `.env` (do not paste secrets here):
```
DASHBOARD_CLIENT_ID=<your discord app client id>
DASHBOARD_CLIENT_SECRET=<your discord app client secret>
```
Register `CALLBACK_URL` (e.g. `http://localhost:3000/auth/callback`) under Discord Developer Portal → Your Application → OAuth2 → Redirects. Then restart `node .` and complete the login in-browser.

## Root-cause note on repeated corruption
`dist/config.js` was overwritten **again** during this task (LastWrite 06:50:14, a minute before `node .`). The external process that regenerates this file is still active and remains unresolved in-repo (nothing in the repository writes it — verified earlier). The runtime env-fallback in `dist/index.js` keeps Mongo/Discord/dashboard/session working despite it, but a regenerated file can still map OAuth away until the environment-side generator is disabled.