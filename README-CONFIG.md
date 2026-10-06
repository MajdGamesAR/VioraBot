# Configuration Guide for Wick Moderation Bot

## Overview

Configuration is split into two layers:

- **`.env`** — secrets, credentials, tokens, database connection strings, OAuth secrets, and environment-specific runtime configuration.
- **`settings.json`** — bot feature settings (protection, automod, warnings, tickets, suggestions, channels, roles, limits, toggles, language).

Sensitive values are **never** hardcoded. They are loaded from the environment at startup.

## Where Environment Variables Are Loaded

`dist/config.js` loads the `.env` file located in the project root using Node.js's built-in `process.loadEnvFile()` (available since Node.js v21.7). No additional dependency is required.

The `.env` file is optional — environment variables may also be set directly in the process environment. Existing process variables take precedence over the `.env` file.

## Required Environment Variables

At startup, `dist/config.js` validates the presence of these variables. If any are missing, the bot stops with a clear message naming the missing variable(s) — never their values:

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Discord bot token |
| `CLIENT_ID` | Discord application/client ID |
| `MONGO_URI` | MongoDB connection string |
| `SESSION_SECRET` | Dashboard session secret |
| `CALLBACK_URL` | Dashboard OAuth2 callback URL (must match the Discord Developer Portal entry) |

## Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_PORT` | Dashboard HTTP port | `3000` |
| `MAIN_GUILD_ID` | Main Discord server ID (used as the dashboard default guild) | empty |
| `DASHBOARD_CLIENT_ID` | Dashboard OAuth client ID (falls back to `CLIENT_ID`) | `CLIENT_ID` |
| `DASHBOARD_CLIENT_SECRET` | Dashboard OAuth client secret (dashboard login disabled when empty) | empty |
| `DEFAULT_PREFIX` | Text command prefix | `!` |
| `DEFAULT_LANGUAGE` | Default locale | `en` |
| `NODE_ENV` | Runtime mode (`development` / `production`) | unset |

Create your own `.env` by copying `.env.example`:

```
cp .env.example .env
```

`.env` is ignored by git; `.env.example` (names and placeholders only) is committed.

## Settings vs .env

Keep the separation clean:

**`.env`:**
- secrets, credentials, tokens
- database connection strings
- OAuth secrets
- environment-specific runtime configuration

**`settings.json`:**
- bot feature settings
- moderation / automod / protection settings
- command settings
- language
- channels, roles, limits
- feature toggles

Do **not** move feature settings into `.env`, and do **not** place credentials into `settings.json`.

## Settings Priority

The configuration system follows this priority order:

1. Environment-based credentials from `dist/config.js`
2. Feature settings from `settings.json`

Core credential values (token, clientId, mongoUri, defaultPrefix, mainGuildId, dashboard) are protected from being overridden by `settings.json`.

## Setup Process

When the bot starts:

1. `dist/config.js` validates required environment variables.
2. It loads the `.env` file (if present) and reads credential values.
3. It loads `settings.json` (creates one with defaults if missing).
4. It merges the two, with credential values from the environment taking precedence.

## Making Changes

- To change credentials or runtime configuration: edit `.env` and restart.
- To change feature behavior: edit `settings.json` (or use the dashboard) and restart.

## Dashboard-Managed Settings

All changes made from the dashboard (protection, automod, warnings, logging channels, staff roles, anti-raid) are written back through the shared `settings.json` manager — the same canonical store the bot reads at startup. There is only one source of truth: `settings.json` in the project root (`dist/settings.json` is an identical runtime copy kept in sync).

Notable dashboard runtime requirements:

- `settings.json → logs.moderation` + `logs.actions` channel IDs drive logging controls.
- `settings.json → staff.roles` defines who appears under **Dashboard → Staff** and who counts as staff for ticket/suggestion decisions.
- Without `DASHBOARD_CLIENT_SECRET`, dashboard login is disabled; without `MAIN_GUILD_ID`, the dashboard has no default guild to bind its pages to (see the Optional Environment Variables table above).

---

For additional help, please join our [Discord server](https://discord.gg/z82w57MzUC) or open an issue on our [GitHub repository](https://github.com/wickstudio/moderation-bot/issues).