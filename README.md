# NLUI Runtime Demo

A full-stack Bun application that demonstrates a controlled natural-language user interface. The user chats through React and Ant Design X; an OpenAI model selects application-owned tools; the Bun server turns verified tool results into a small catalog of interactive UI blocks.

The model never emits React, JSX, executable HTML, API routes, validation rules, or mutation callbacks. It returns natural-language Markdown and requests capabilities from a server-owned tool catalog. For open-ended analytics it may propose one SQL `SELECT` inside a dedicated tool call; the server parses, restricts, canonicalizes, and isolates that query before any data is read.

## What the demo covers

- Bun serves the API and bundles the React 19 frontend from an HTML import.
- Ant Design X provides the conversation shell, prompts, bubbles, and sender.
- Ant Design renders server-defined statistics, charts, tables, choices, forms, sources, confirmations, and action results.
- OpenAI's Responses API streams Markdown and tool activity as newline-delimited JSON (NDJSON).
- `bun:sqlite` stores a deterministic, synthetic retail-operations dataset.
- Read-only questions use fixed domain tools or a guarded text-to-SQL path; policy answers use local lexical retrieval.
- Mutations require a prepared opaque action and a separate explicit confirmation request.

## Quick start

Requirements: [Bun](https://bun.sh/) 1.3 or newer and an OpenAI API key.

```bash
bun install --frozen-lockfile
```

Create an ignored `.env` file:

```dotenv
OPENAI_API_KEY=your-api-key
CHAT_MODEL=your-responses-api-model
```

Seed the reproducible dataset and start the development server:

```bash
bun run seed
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The server also creates the database lazily when a data tool is first used, so the explicit seed step is optional.

Useful demo prompts:

- `Show the sales trend for the last six months.`
- `How many customers do we have now? Break them down by tier.`
- `Show delayed orders over EUR 500, highest value first.`
- `Help me choose a laptop for design work.`
- `What is the return window?`
- `I want to return order 1042 because it did not meet my needs.`

## Runtime flow

```text
Browser
  -> POST /api/chat with user_text or ui_result
  -> request schema validation
  -> OpenAI Responses API stream
  -> strict application tool call
  -> deterministic SQLite query or prepared action
  -> server-created, Zod-validated NLUI blocks
  -> NDJSON text/tool/UI events
  -> Ant Design X bubble + controlled block renderer
```

The block catalog is deliberately finite: `stats`, `chart`, `table`, `choices`, `form`, `confirmation`, `sources`, and `result`. Unknown or invalid blocks never reach the client.

## Trust and safety boundary

- Tool arguments are constrained by strict schemas and parsed again on the server.
- Specialized data tools call fixed repository methods. `query_dataset` accepts one model-proposed `SELECT`, parses it as SQLite, allowlists tables/functions/relationship joins, canonicalizes the AST, and executes only the canonical SQL.
- Generic queries run in a separate read-only/query-only worker with a 1.5-second timeout and strict row, column, cell, and payload limits. Internal/action tables, wildcard columns, schema qualifiers, recursive or compound queries, and sensitive operational columns are rejected.
- Forms and choices come from application code, including their allowed fields and limits.
- `prepare_action` validates a requested return, cancellation, or shipping-address change but does not mutate data.
- The confirmation UI carries only an opaque, expiring `actionId`. `POST /api/actions` resolves it against the server's pending-action registry.
- The API key remains server-side and must never be referenced from `src/client/`.
- The dataset contains no real customer or production data.

This is a demonstration, not a production authorization layer or a general SQL sandbox. The generic query capability is acceptable here because it is restricted to a small synthetic fixture; production data still needs authentication, tenancy controls, row-level authorization, audited semantic views, and database-native limits. Valid chat requests call the configured OpenAI model and may incur API charges. The current Responses API integration uses stored responses for turn chaining; send only demo-safe content.

## Deterministic data

The fixed seed produces 200 customers, 100 products, and 1,500 orders from January 2025 through June 2026, plus items, payments, shipments, returns, support cases, and four local policy documents. The reference timestamp is `2026-06-30T12:00:00.000Z`.

Generated database files are ignored. Reset all demo mutations with:

```bash
bun run reset:data
```

See [`data/README.md`](data/README.md) for stable fixture records and [`data/scenarios.jsonl`](data/scenarios.jsonl) for the 33 golden scenario specifications.

## Validation

```bash
bun run check       # Biome, TypeScript, and Bun tests
bun run compile     # production single-file executable
```

For HTTP smoke tests, start the server in one terminal and run the Hurl-backed task in another:

```bash
PORT=3000 task test
```

The unit, tool, and malformed-request smoke tests do not call OpenAI. A valid `POST /api/chat` is intentionally not part of the default suite because it is billable and model-dependent.

## Docker

```bash
docker build -t nlui-demo .
docker run --rm -p 3000:3000 \
  --env-file .env \
  --mount source=nlui-demo-data,target=/app/data \
  nlui-demo
```

The image contains the deterministic seed inputs but not a generated SQLite database. `/app/data` and `/app/uploads` are writable by the unprivileged `bun` user. A named volume preserves demo actions across container restarts; omit it for an ephemeral database.

## Project map

```text
src/
  index.ts                 Bun server, HTML route, API fallback
  client/                  React + Ant Design X interface
  data/                    deterministic SQLite data, query policy, and isolated query worker
  nlui/                    trusted schemas, tool catalog, block builders
  services/openaiChat.ts   Responses API streaming/tool loop
  routes/api/chat/         validated NDJSON chat endpoint
  routes/api/actions.ts    explicit opaque-action confirmation
data/
  knowledge/               local policy corpus
  scenarios.jsonl          golden NLUI scenarios
scripts/                   seed and reset commands
public/docs/               documentation served at /docs/*
```

More detail is available at `/docs/readme`, `/docs/getting-started`, and `/docs/architecture` while the server is running.
