# RUNTIME PORT COLLISION + ANTISPAM NULL-GUILD — ROOT CAUSE REPORT

**Date:** 2026-09-08  
**Scope:** Two live runtime failures observed after the last deployment, plus regression re-verification of the Ticket Panel fix.

---

## Summary

| Issue | Symptom | Root Cause | Fix |
|---|---|---|---|
| 1 — Dashboard `EADDRINUSE :::3000` | Bot crashes right after login when port 3000 is already taken | `Dashboard.start()` wrapped `app.listen()` in a `try/catch`, but `EADDRINUSE` is emitted asynchronously as an **`error` event** on the server, which `try/catch` can never catch → unhandled error → launcher fatal path. No `Dashboard.stop()/.close()` existed, and `ModBot.destroy()` never released the HTTP socket | Pre-flight dual-protocol port probe + clear startup diagnostics (`Dashboard port` / `Port available` / `Existing owner PID`); throw a real `EADDRINUSE` error so the launcher fails clearly; `error` listener for the async race; new `Dashboard.stop()` wired into `ModBot.destroy()`/SIGINT |
| 2 — AntiSpam `TypeError: Cannot read properties of null (reading 'guild')` in `sendProtectionLog` | Crash inside anti-spam protection when the action is `kick` | discord.js v14 `Message#member` is a **getter** that re-resolves via the guild **members cache**. `takeAction()` performs `member.kick()`, which removes the member from the cache, so the later `message.member` in `sendProtectionLog` resolves to `null` → `member.guild` throws | Capture the `member`/`guild` references **before** the kick and pass them into `sendProtectionLog` (the captured `GuildMember` keeps its `.guild`); add null-safe guards with safe diagnostics; enforcement (`takeAction`) always runs first and is unaffected by logging availability |

A secondary latent bug was found and fixed while fixing #2: the locale `actions` map (`en.json`/`ar.json`) had **no `kick` key**, so after repairing the null crash the embed would have thrown `Invalid value supplied` (→ `Error sending protection log`) for the live `action.type: "kick"` configuration. `actions.kick` was added in `en.json` (`Member Kicked`) and `ar.json` (`تم طرد العضو`).

---

## Issue 1 — Dashboard EADDRINUSE

### Reproduction / first observation
The bot had already been running since the previous task (inline session, `node .`, pid 54456). Launching a second `node .` while pid 54456 held `:3000` produced:

```
ERROR DURING BOT INITIALIZATION
Message: listen EADDRINUSE: address already in use :::3000
Stack: ... at Dashboard.start (...server.js:2817) at ModBot.init ... 
```

No port/owner diagnostics were printed before the crash (only a raw stack), and no attempt to release or identify the holder.

### Root cause (traced)
1. `Dashboard.start()` (`dist/dashboard/server.js`) called `this.app.listen(port, cb)` inside `try/catch `. `EADDRINUSE` does **not** throw synchronously for `listen()` — Node emits an `error` event asynchronously. With no `error` listener attached, the event was unhandled → `uncaughtException`.
2. Grep confirmed **no** `Dashboard.stop()`, `server.close()`, or `this.server` handle existed anywhere (`grep .listen(` → 1 match in the whole `dist`). The HTTP listener was never released or managed.
3. `ModBot.destroy()` (`dist/index.js`) stopped only the settings watcher and never closed the dashboard socket; the SIGINT handler relied on `process.exit()`.

### The fix (minimal, in-repo)
- `Dashboard.start()` is now `async`:
  - Runs a **pre-flight probe** on **both** `127.0.0.1` and `::` before binding, so the check is robust to IPv4/IPv6 binding differences.
  - Prints deterministic startup diagnostics before anything else:
    - `[dashboard] Dashboard port: 3000`
    - `[dashboard] Port available: YES | NO`
    - `[dashboard] Existing owner PID: <pid>` (Windows: resolved via `netstat -ano -p tcp`; only a PID, never any credential).
  - If occupied, throws `Error("listen EADDRINUSE ...")` with `error.code = 'EADDRINUSE'` → propagates through `init()` → launcher `handleStartupError` → clear banner + shutdown (`index.js` already treats `EADDRINUSE` as fatal). **Nothing is killed; no duplicate instance is created.**
  - For the async race (port grabbed between probe and bind), an `error` listener on the server reports the same diagnostics and exits(1).
- Added `Dashboard.stop()`: closes the server handle when listening (with a timeout fallback) and nulls the handle.
- `dist/index.js`: stores `this.dashboard`, awaits `this.dashboard.start()`, and `destroy()` now calls `this.dashboard.stop()` before `super.destroy()` (SIGINT → clean socket release).

### Verification (Issue 1)
| Check | Result |
|---|---|
| Port-lifecycle harness — **busy** mode against a real live owner (pid 54456): `start()` rejects with code `EADDRINUSE`; diagnostics `Dashboard port: 3000`, `Port available: NO`, `Existing owner PID: 54456` | **4/4 PASS** |
| Port-lifecycle harness — **free** mode with real Express app: binds, logs `Port available: YES` + `Dashboard running at http://localhost:3000`, `stop()` clears the handle, port is re-bindable after `stop()` | **7/7 PASS** |
| Clean live boot (`node .`, fixed code): `Connected to MongoDB` → `Logged in as Viora#8868` → `Dashboard port: 3000` / `Port available: YES` / `Dashboard running at http://localhost:3000` → online in ~4.8s; empty stderr | **PASS** |
| Live duplicate boot while the fixed bot held `:3000`: prints `Dashboard port: 3000`, `Port available: NO`, `Existing owner PID: <first bot>`, then `ERROR DURING BOT INITIALIZATION — listen EADDRINUSE :::3000` ×4, never goes online, ends with `Maximum restart attempts (3) reached. Shutting down.` | **PASS (fail-clearly, no silent duplicate)** |
| Final deployment state: multiple clean boots of the fixed code confirmed (Mongo, login, `Port available: YES`, online); the last booted instance was terminated by an external `^C`/environment SIGINT (session artifact — the hosting environment reaps long-lived service processes it did not itself spawn). The operator should start `node .` normally; the new diagnostics will print `Port available: YES` and no EADDRINUSE. | **Verified on boot** |

---

## Issue 2 — AntiSpam null-guild crash

### Reproduction context
Live config: `protection.enabled=true`, `protection.logChannelId=1340343766774583338` (a real channel), `protection.antispam.enabled=true`, `action.type="kick"` with `messageLimit=4`, `duplicateLimit=5`, `timeWindow=7000ms`. The crash surfaced when a spam trigger ran the `kick` action.

### Root cause (traced)
`dist/src/protection/antispamProtection.js`:

```js
await takeAction(message.member, message.channel, userData.messages);      // kick → member removed from cache
await sendProtectionLog(client, message.member, message.channel, ...);     // message.member re-resolves → null
```
In discord.js v14, `Message.member` is a getter: `this.guild.members.resolve(this.author) ?? null`. After `member.kick()` resolves, the member is gone from the members cache, so the getter returns `null`, and `sendProtectionLog`'s `member.guild.channels.cache.get(...)` throws `TypeError: Cannot read properties of null (reading 'guild')`.

### The fix (root-cause, not suppression)
- In `handleMessage`, snapshot the references **before** the action and reuse them:
  ```js
  const triggerGuild = message.guild;
  const triggerMember = message.member;
  await takeAction(triggerMember, message.channel, userData.messages);
  await sendProtectionLog(client, triggerGuild, triggerMember, message.channel, ...);
  ```
  A captured `GuildMember` instance retains `.guild` for the lifetime of the object, independent of the members cache.
- `sendProtectionLog(client, guild, member, channel, ...)` now guards explicitly with safe diagnostics instead of throwing or silently returning:
  - `!guild` → `[anti-spam] protection log unavailable guild=NULL channel=<id|NULL>`
  - `!member` → `[anti-spam] protection log unavailable guild=<id> member=NULL channel=<id|NULL>`
  - no `logChannelId` → `... member=YES logChannel=NO`
  - channel not `GuildText` → `... logChannel=YES targetChannel=INVALID`
  Diagnostics contain only guild/channel IDs and boolean availability — never tokens or credentials.
- Enforcement ordering is unchanged: **`takeAction` runs first and always**, and the log is fail-safe.
- Secondary fix: added `kick` to `protection.antispam.actions` in `dist/src/locales/en.json` and `ar.json` (the embed otherwise would have thrown on the `/kick` label lookup → `Error sending protection log` even with the null-guard fixed).

### Verification (Issue 2)
Dedicated harness (`antispam-harness.js`) against the real `dist` modules, real canonical `settings.json`, and the real locales, simulating the discord.js v14 cache-clear semantics (`message.member` returns `null` immediately after the kick):

| Check | Result |
|---|---|
| Kick action applied exactly once | **PASS** |
| Protection log delivered exactly once (previously crashed here) | **PASS** |
| `message.member` re-resolves to `null` after kick, yet the log is still delivered via the captured reference | **PASS** |
| Embed contains the kicked member mention and action label `Member Kicked` (locale key present) | **PASS** |
| Scenario: log channel missing entirely → kick still applied, no send attempted, no crash | **PASS** |
| Scenario: empty `logChannelId` → kick still applied, log skipped safely with diagnostic | **PASS** |
| **Total** | **8/8 PASS** |

---

## Ticket Panel regression (unchanged)

- Re-ran `ticket-panel-harness.js` → **18/18 PASS** (rows/buttons/customIds, localized labels `en`/`ar`, 1-section and 6-section behaviors, bare-click `notConfigured` fallback reply, full creation flow).
- The harness's two "no sections" cases were pinned to `sections: []` explicitly: the **live root `settings.json` now contains one configured ticket section** (populated by the operator during this period — observed, not written by this task). `dist/settings.json` was **re-synced** from root (canonical), which restored `moderation.test.js` "dist copy matches root canonical" back to green. Root config was not modified by this task.
- Ticket code (`ticketManager.js`, locales) was **not touched** during this task.

---

## Files changed (this task)

- `dist/dashboard/server.js` — `Dashboard.start()` port pre-flight + diagnostics + error handling; added `isPortAvailable`, `canBindPort`, `getPortOwnerPid`, `Dashboard.stop()`.
- `dist/index.js` — holds `this.dashboard`; `await this.dashboard.start()`; `destroy()` stops the dashboard.
- `dist/src/protection/antispamProtection.js` — captured references before `takeAction`; hardened `sendProtectionLog` with safe guards.
- `dist/src/locales/en.json` — added `protection.antispam.actions.kick`.
- `dist/src/locales/ar.json` — added `protection.antispam.actions.kick`.

## Verification summary

| Gate | Result |
|---|---|
| `npm test` (42 tests) | 42/42 PASS |
| Port-lifecycle harness (busy + free) | 4/4 + 7/7 PASS |
| AntiSpam harness | 8/8 PASS |
| Ticket panel harness (regression, pinned empty-sections) | 18/18 PASS |
| Config assertion harness | 26/26 PASS |
| Secret scan (no hardcoded secrets / no corrupt getEnv) | PASS |
| Syntax sweep (`dist/**/*.js`) | 135/135 PASS |
| ESLint (changed files) | 0 issues |
| `dist/config.js` SHA-256 == known-good `32408330CA5A506B24DEAF3188089E5EBB544645E910703041764B313B155FD0` | PASS |
| Live deployment | fixed code boots clean repeatedly (Mongo, Viora#8868, Dashboard `:3000`, `Port available: YES`, online, empty stderr); duplicate boot fails clearly with diagnostics; long-running persistence is handled by the operator (environment SIGINTs externally-spawned services) |

---

**Secrets exposed: NO** — no tokens, Mongo URI, passwords, secrets, cookies, or auth headers appear in logs, harnesses, or this report.  
**Production DB modified: NO** — MongoDB writes were not touched; `settings.json` syncs and locale/config edits were config-state only.