# Changelog

All notable changes to `kellian-mcp` are documented here. Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [1.0.2] - 2026-10-31

### Added

- Watches: `kellian_create_watch`, `kellian_list_watches` and `kellian_delete_watch` (Plus) report when smart money moves on a question, an option, a listed trader or a category. Alerts reach the site, a linked Telegram or Discord, and your webhooks (`alert.fired`).
- Smart money first: the bulk context takes `view=compact`, and the smart money read is its own tool.
- The agent skill covers forecasts and your record, and the Polymarket question catalog (`GET /api/agent/v1/coverage/questions`).
- `mcpName` is `app.kellian/kellian`, the name of the package's MCP Registry listing.

### Changed

- The installer pins `kellian-mcp@1.0.2` in every client config it writes.
- The agent skill that ships with the package says watches are live and puts smart money first.

## [1.0.1] - 2026-10-14

### Added

- First release as `kellian-mcp`: installs the remote Kellian MCP server into Claude Desktop, Claude Code, Cursor and Codex without putting the key in argv or a client config, registers an agent with its own wallet (`register --owner`), and runs the local bridge that signs that agent's orders and places an order stated in PM terms (`kellian_place_order`).
- The API stability contract this package ships under, stated below. `1.0.1` is its semver spelling. The date above is the public launch of the contract this package carries; the package itself was first published under this name on 2026-10-14.

### Changed

- Renamed from `@probleeprotocol/mcp` (last version 1.0.10, the same code). `@probleeprotocol/mcp` is deprecated on npm; move your dependency here.
- Defaults to the kellian.app hosts: https://api.kellian.app and https://mcp.kellian.app. The kellian.si and problee.com API hosts keep answering.
- Carries the relaunched Play Money ledger on Base, `0xEE43b54517430804FC1D3dE00C19C32B46923C10`.
- The command is `kellian-mcp`, and the server entry it writes into a client config is named `kellian`. An existing `problee` entry is left as it is.
- Reads `KELLIAN_API_KEY`, `KELLIAN_MCP_ENDPOINT`, `KELLIAN_API_URL`, `KELLIAN_MCP_DISCOVERY_URL`, `KELLIAN_CREDENTIALS_FILE` and `KELLIAN_NO_BROWSER` first, and each `PROBLEE_*` name as a fallback.
- Keeps the agent credential in the `kellian` config folder and reads the one `problee-mcp` wrote while there is no new one.
- The bridge names its tools after the server it talks to: `kellian_*` on mcp.kellian.app; the server also still answers every `problee_*` name.

## API stability

Until the public launch on 2026-10-14, Kellian's API may change without notice — it is not yet public. From 2026-10-14 the Agent API v1 is a contract: changes within v1 are additive only; anything that removes or reshapes a field, operation, scope or error is first marked deprecated and announced here, in the signed changelog feed, and on the `Deprecation` and `Sunset` response headers, at least 90 days before it takes effect; breaking changes ship only as a new major version that runs alongside the previous one for at least 12 months. Subscribe: https://api.kellian.app/api/agent/v1/changelog.atom, https://kellian.app/status, https://x.com/getproblee.

`1.0.1` is the semver spelling of that sentence: from the launch a minor release is additive and a breaking change costs a major. Entries dated before the launch describe a package that was not yet public; they are kept internally and are not release history anyone integrated against.
