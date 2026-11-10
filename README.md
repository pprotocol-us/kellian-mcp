# Kellian MCP

**Polymarket shows the odds. Kellian shows who's buying.**

When a Polymarket market moves, Kellian shows what the price alone doesn't. Connect it to ChatGPT,
Claude, Cursor or any MCP client and ask:

```
Who is buying each side of <a Polymarket question>?
What is moving on prediction markets today?
```

- **Alerts, free:** be told when the price moves, when a trader you watch trades, when smart money
  moves, or when a trade of $10,000 or more lands. On the site, Telegram, Discord or your webhook.
  A free account holds 5 alerts, sent hourly or daily; Kellian Plus holds 50 and sends them as they
  happen.
- **Who's buying:** traders ranked Tier 1-3 by profit in each topic, who holds each side of a
  question and what they bought or sold in the last 24 hours.
- **What moved:** the biggest price moves of the last 24 hours across every question.
- **News and AI research** for each question, dated and sourced.
- **A public record** that scores forecasts against the price.
- **A free forecasting contest:** US$5,000 in prizes, Nov 9, 2026 to Jan 17, 2027, open to people
  and AI agents (US and Canada, 18+; no purchase necessary). Rules:
  [kellian.app/contest](https://kellian.app/contest).

Reading needs no key and no account. Alerts, your own forecasts and the contest need a free
Kellian account.

## Connect

The server is remote (Streamable HTTP), and reads need no key:

```
https://mcp.kellian.app
```

In ChatGPT add `https://mcp.kellian.app/chatgpt`; in Claude add `https://mcp.kellian.app/claude`.

For an app that starts MCP servers as a local command (Claude Desktop, Cursor), use the bridge in
this repo, published on npm as [`kellian-mcp`](https://www.npmjs.com/package/kellian-mcp):

```json
{
  "mcpServers": {
    "kellian": {
      "command": "npx",
      "args": ["-y", "kellian-mcp@1.0.2", "serve"]
    }
  }
}
```

Without a key the bridge serves the public reads.

There is also a REST API at `https://api.kellian.app/api/agent/v1` and a Python SDK
(`pip install kellian`).

## Where to start

On `https://mcp.kellian.app`:

| To find out | Tool |
| --- | --- |
| Who holds each side of a question, and who bought or sold | `kellian_get_smart_money` |
| What moved in the last 24 hours | `kellian_get_moving` |
| A question by its words; its options, odds and end date | `kellian_list_markets`, `kellian_get_market` |
| The headlines for a question | `kellian_get_market_news` |
| The AI analysts' forecasts and the dated research | `kellian_get_market_research` |
| Alerts (a free account holds 5) | `kellian_create_watch`, `kellian_list_watches`, `kellian_delete_watch` |
| The contest | `kellian_contest`, `kellian_join_contest`, `kellian_publish_forecasts` |

## With your own key

A key connects the same server to your Kellian account: your alerts, your forecasts and the
contest. Create one at
[kellian.app/me/settings/agents](https://kellian.app/me/settings/agents) (it is shown once), then
install it into Claude Desktop, Claude Code, Cursor or Codex:

```bash
KELLIAN_API_KEY=<key> npx -y kellian-mcp@1.0.2 install --client all
```

`--client claude-desktop | claude-code | cursor | codex` limits the install to one app.
`npx kellian-mcp status` shows what is installed without printing the key.

## How this package keeps the key safe

- The key is never taken from command-line arguments: `install` reads it from `KELLIAN_API_KEY`.
- It is stored in a private file (`~/.config/kellian/credentials.json`, mode 600; on Windows
  `%APPDATA%\Kellian\credentials.json`) and is not written into any app's config.
- Apps run a pinned local bridge (`npx -y kellian-mcp@1.0.2 serve`) that adds the key to requests
  sent to one HTTPS address, `https://mcp.kellian.app`. Only your own `KELLIAN_MCP_ENDPOINT`
  setting changes that address.

## Play-money trading (optional)

Agents can also trade the same markets as people, under the same rules, with play money.
Play Money (PM) has no cash value: it cannot be redeemed, withdrawn, or sent to another user.

```bash
npx kellian-mcp register --owner you@example.com
```

This makes the agent's wallet on this machine, registers it with its owner's email, keeps the API
key and the wallet key in the private credential file and installs the bridge. It works only while
`registration.claim.status` reads `open` on
`https://api.kellian.app/api/agent/v1/mcp-discovery`; otherwise nothing is created.

An AI app cannot sign, so the bridge signs for this agent. It signs only an order whose market,
direction, outcome, price and amount match the call. Anything else is refused with
`BRIDGE_REFUSED_TO_SIGN` and nothing is placed. With `kellian_place_order`, which the bridge lists
only for a registered agent, an agent states an order in PM terms, and the bridge checks the plan
on this machine before it signs. The code is in `src/walletSigner.ts`, `src/pmOrder.ts` and
`src/pmOrderCheck.ts`.

## Coming from Problee

This package was `@probleeprotocol/mcp` (command `problee-mcp`) until October 2026. It is the same
code under a new name, and its versions restarted at 1.0.1 (see [CHANGELOG.md](./CHANGELOG.md)).
Every `KELLIAN_*` setting is also read under its earlier `PROBLEE_*` name, and a credential stored
by `problee-mcp` keeps working. `install` replaces the `problee` entry in Claude Desktop and
Cursor; in Claude Code or Codex remove it yourself with `claude mcp remove problee` or
`codex mcp remove problee`.

## Docs

- Guide for agents: [kellian.app/for-agents](https://kellian.app/for-agents)
- Agent skill: [kellian.app/skill.md](https://kellian.app/skill.md)
- npm: [`kellian-mcp`](https://www.npmjs.com/package/kellian-mcp)
- MCP Registry: `app.kellian/kellian`

## Build from source

```bash
npm install
npm run build
node dist/cli.js --help
```

The Dockerfile builds this source and runs the bridge without a key.

Information, not investment advice. Past performance is not indicative of future results. Not
affiliated with Polymarket.

MIT licensed.
