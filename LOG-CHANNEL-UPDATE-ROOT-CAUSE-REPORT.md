# LOG-CHANNEL-UPDATE-ROOT-CAUSE-REPORT

Date: 2026-09-08 · Scope: Dashboard `/logs` Log Channel update failing with "Failed to update channel" · **SECURITY CORRECTION applied (authorization bypass reverted)** · No Phase 5 work started.

## One-line summary
`POST /api/logs/update` must stay behind the existing administrative authorization. The earlier interim fix (exempting that endpoint from `requireGuildAdmin`) has been **REVERTED**. The real mismatch was in `requireGuildAdmin` itself: it recognized only configured `ownerIds` (currently `[]`) and an OAuth-time boolean flag, but **never applied the project's existing staff/admin role authorization model** (`isStaffMember` / `staffRoleIds`), so a legitimately authorized staff member or a stale-session admin could be denied. The function now authorizes through the existing model and ordinary members are **403**.

## SECURITY CORRECTION
- **Reverted:** the `/api/logs/update` exemption added earlier. Global mount (`dist/dashboard/server.js:502-508`) again routes EVERY `POST/PUT/PATCH/DELETE` through `requireGuildAdmin` (wrapped via `Promise.resolve(...).catch(next)` for async safety). `GET /logs` keeps its existing dashboard-page authorization.
- **Root-cause fix:** `requireGuildAdmin` (now `async`, `server.js:139`) evaluates the existing authorization model in priority order:
  1. `isAuthenticated(req)` — session has user who is `isGuildMember` or owner → else `401` (`/api`) / redirect to `/auth/login`.
  2. `isUserOwner(user)` — Discord ID in `config.dashboard.ownerIds` (existing owner configuration).
  3. `user.isGuildAdmin === true` — Discord ADMINISTRATOR (bit 8) or MANAGE_GUILD (bit 32) computed at OAuth login from the `/users/@me/guilds` summary (`server.js:420-421`) — existing OAuth permission mapping.
  4. Live member resolution — if none of the above, resolve the member in the main guild (cache first, then `guild.members.fetch`; `GuildMembers` intent is enabled in `dist/index.js:103`) and call the existing `isStaffMember(member, settings)` → honors **Administrator permission** and the **configured staff/admin roles** (`suggestions.staffRoles`, `automod.staffRoles`, ticket `adminRoles`) — the existing staff/role configuration.
  - If none apply → **`403`** (API: JSON `{success:false,error:'You need administrator permissions...'}`, else error page). Any exception → **`403`** (fail-closed). Logs only sanitized fields.

## Why the legitimate user was getting 403 (the actual mismatch)
Under the pre-fix `requireGuildAdmin`:
- `isUserOwner` required `config.dashboard.ownerIds.length > 0` — the project ships `ownerIds: []` and nothing populates it, so the owner path was inert.
- Pass only if the OAuth login computed `isGuildAdmin=true`. That flag is frozen at login time and only covers ADMINISTRATOR/MANAGE_GUILD Discord permissions.
- **The project's own staff/admin role configuration was never consulted** — `isStaffMember()`/`staffRoleIds()` exist (`server.js:96-128`) but were unreachable from `requireGuildAdmin`. A dashboard operator who is authorized through the configured staff roles — or whose session predates the flag / whose server permissions legitimately lack MANAGE_GUILD — received `403`, surfacing as "Failed to update channel".
- Ordinary guild members correctly received `403` then and still do.

## Authorization model (final, existing, no new system)
| Priority | Check | Source | Result |
|---|---|---|---|
| 1 | `isAuthenticated` | session | 401/redirect if absent |
| 2 | `isUserOwner` | `config.dashboard.ownerIds` | pass if owner |
| 3 | OAuth `isGuildAdmin` | Discord ADMINISTRATOR / MANAGE_GUILD bits | pass if admin |
| 4 | `isStaffMember` | live main-guild member (cache→fetch) + existing staff/admin role config + Administrator perm | pass if staff |
| – | none of the above | – | **403** |

No separate permission system introduced. All existing authorization functions reused.

## Frontend endpoint
- `dist/dashboard/public/js/logs.js`
  - `initializeChannelSelects` (107-124) → `updateLogSettings` (164-215); `POST /api/logs/update`; body `{ logType, settings: { channelId } }`; `Content-Type: application/json`; success toast (117), failure toast (120).

## Backend endpoint
- `dist/dashboard/server.js` — `this.app.post('/api/logs/update')` (~908).
- Request trace: `express.json()` (296) → `csrfProtection()` origin check (326) → auth middleware (490) → **`requireGuildAdmin` (502)** → handler (validation → merge → persist → `200`).
- Handler (admins/staff only): 400 missing params ISR; 400 invalid-snowflake / channel-not-text-or-other-guild; 404 unknown log type; merge `{ ...existing, ...settings }`; `settingsManager.persist()`; `this.client.settings = currentSettings`; `200 { success:true, settings }`.

## Request field
- Frontend sends `settings.channelId` (snowflake string); backend expects the same name — match confirmed.

## Validation
- Channel ID must be empty (clears) or a **6–20 digit snowflake** **and** a **text channel (`type===0`) present in the configured main guild** — rejects garbage and cross-guild channels with `400`. Log-type key must exist in `settings.logs` (all 36 present).

## Persistence
- Single settings manager (`dist/src/utils/settingsManager.js`) → `settings.json`; merge preserves unrelated log entries; saved value survives restart; `/logs` renders from `client.settings`.

## TEST MATRIX (results)
| # | Case | Expected | Result |
|---|---|---|---|
| 1 | Unauthenticated | 401 | **401** (live probe: `{"success":false,"error":"Unauthorized"}` + `[logs-update] middleware-authenticated=NO status=401`) |
| 2 | Authenticated ordinary member | 403 | **403** (authorization harness) |
| 3 | Authenticated authorized admin/staff | 200 | **authorized (PASS)** — discriminated sub-cases: OAuth admin ✓, configured owner ✓, staff-role (cached) ✓, Administrator perm ✓, staff via member fetch ✓ |
| 4 | Invalid channel ID | 400 | **400** `invalid-snowflake` (harness) |
| 5 | Channel from another guild / non-text | 400/403 | **400** `channel-not-text-or-other-guild` (harness); off-guild user additionally 403 |
| 6 | Valid authorized update | 200 + persisted | handler + persist proven (isolated simulation); **live browser step pending user's own session** |
| 7 | Reload `/logs` | selected remains | renders from `client.settings` post-save; persisted to `settings.json` |
| 8 | Unrelated log settings unchanged | unchanged | merge is spread-on-existing; verified `memberJoin`, `logs.enabled`, colors untouched |

Harnesses: `auth-matrix-harness.js`, `logs-validation-harness.js`, `logs-handler-sim.js` (temp dir).

## Files changed
- `dist/dashboard/server.js`:
  - **Reverted** the `/api/logs/update` admin-gate exemption (global POST mount, 502-508).
  - **Corrected** `requireGuildAdmin` (139): async; adds live member → `isStaffMember` (existing staff/admin role config + Administrator), keeps `isUserOwner` + OAuth `isGuildAdmin`; fail-closed 403; scoped `[logs-update]` sanitized diagnostics.
  - Channel validation (snowflake + main-guild text-channel) and route-level sanitized diagnostics kept.
- `dist/config.js`: earlier regenerator corruption (actual secret literals inlined) restored to env-name mappings — 26/26 PASS, SHA-256 back to known-good. No change required this pass.

## Regression (Step 12)
- `npm test`: **42/42 PASS**
- `node --check` sweep: **136/136 PASS**
- ESLint (changed files): **0 errors**
- `config-assert`: **26/26 PASS**
- Live start `node .`: Mongo connected, Discord online (Viora#8868), Dashboard on :3000; launcher prints online after init; live probes: unauth `POST /api/logs/update` → 401, `GET /logs` → 302 (auth wall intact).
- `settings.json`: 0 non-empty channelIds, `logs.enabled=true` (undisturbed).

## Security final check
- Ordinary guild member cannot modify logs: **confirmed** (403).
- Authorized admin/staff can modify logs: **confirmed** (harness sub-cases) + instrumented live path prints `middleware-authorized=YES ... status=PASS`.
- Unauthenticated cannot modify logs: **confirmed** (401).
- CSRF enforced: **yes** — origin-based `csrfProtection()` unchanged, applies to all non-GET.
- No secrets exposed: **yes** — diagnostics log status/reason/booleans only; log files scanned clean.
- No production DB destructive changes: **yes** — no Mongo mutations; `settings.json` untouched (sim transient writes restored).

## Reload persistence
- Save writes `settings.json`; `/logs` renders from `client.settings` after `this.client.settings = currentSettings`; survives restart.

## Manual step remaining for the operator
Reload `/logs`, change a log channel with an **authorized** admin/staff session → server logs `[logs-update] middleware-authenticated=YES middleware-authorized=YES ... status=PASS` then `[logs-update] status=200 validated=YES persisted=YES`. If an ordinary member tries, the server logs `middleware-authorized=NO status=403` (correct).

## Notes
- The external regenerator remains active and keeps touching `dist/config.js`; config is clean (26/26, secret-scan clean) as of this report. Keep the automatic regen source pointed at the `.env`-mapping form.
- `config.dashboard.ownerIds` is `[]` and there is no `OWNER_IDS` env var; the owner path becomes active only if that list is populated. Without it, owners still pass via priority 3/4 (ADMINISTRATOR permission), which is the existing OAuth mapping.