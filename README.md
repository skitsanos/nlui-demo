# NLUI Runtime Demo

A full-stack Bun application that demonstrates a controlled natural-language user interface. The user chats through React and Ant Design X; an OpenAI model selects application-owned tools; the Bun server turns verified tool results into a small catalog of interactive UI blocks.

The model never emits React, JSX, executable HTML, API routes, validation rules, or mutation callbacks. It requests capabilities from a server-owned tool catalog, then returns a strict structured envelope that chooses either a prose answer or references to trusted blocks with a concise conversational annotation. The production-default open-ended analytics path lets it propose one SQL `SELECT` inside a dedicated tool call; the server parses, restricts, canonicalizes, and isolates that query before any data is read. A separate, explicit research arm lets the model select versioned semantic metrics and dimensions while the server owns SQL compilation.

## What the demo covers

- Bun serves the API and bundles the React 19 frontend from an HTML import.
- Ant Design X provides the conversation shell, prompts, bubbles, and sender.
- Ant Design renders server-defined statistics, charts, tables, choices, forms, sources, confirmations, and action results.
- OpenAI's Responses API uses strict Structured Outputs for final composition while tool activity streams as newline-delimited JSON (NDJSON).
- `bun:sqlite` stores a deterministic, synthetic retail-operations dataset.
- Read-only questions use fixed domain tools or a guarded text-to-SQL path; policy answers use local lexical retrieval.
- An opt-in `semantic_query` experiment compares model-authored SQL with a small server-compiled semantic catalog without changing the production tool path.
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
  -> strict prose-or-block-reference response envelope
  -> validated NDJSON text/tool/UI events
  -> Ant Design X bubble + controlled block renderer
```

The block catalog is deliberately finite: `stats`, `chart`, `table`, `choices`, `form`, `confirmation`, `sources`, and `result`. Unknown or invalid blocks never reach the client.

## Trust and safety boundary

- Tool arguments are constrained by strict schemas and parsed again on the server.
- Specialized data tools call fixed repository methods. `query_dataset` accepts one model-proposed `SELECT`, parses it as SQLite, allowlists tables/functions/relationship joins, canonicalizes the AST, and executes only the canonical SQL.
- Production chat remains on the guarded `query_dataset` control. The experimental `semantic_query` arm accepts only catalog-owned metric, dimension, filter, time-range, ordering, and limit fields; a versioned server catalog validates the plan, compiles SQL, and sends bound values through the same isolated query worker.
- `query_dataset` removes technical helper columns from both model-facing and presentation data while retaining the complete validated result only in explicit internal evaluation traces. Simple date, text, and boolean scalars stay in prose; cards are reserved for numeric KPIs or multi-value results.
- Row data represented by a trusted table is withheld from the model-facing tool result. The model receives only a bounded summary and safe block references, so it cannot narrate the same table rows before the server renders them.
- Generic queries run in a separate read-only/query-only worker with a 1.5-second timeout and strict row, column, cell, and payload limits. Internal/action tables, wildcard columns, schema qualifiers, recursive or compound queries, and sensitive operational columns are rejected.
- Forms and choices come from application code, including their allowed fields and limits.
- Every emitted form, choice, and confirmation is registered as a conversation-scoped, expiring, single-use server capability. Invented IDs, altered options, extra fields, cross-conversation submissions, and replays are rejected before they reach the model.
- `prepare_action` validates a requested return, cancellation, or shipping-address change but does not mutate data.
- The confirmation UI carries only an opaque, expiring `actionId`. `POST /api/actions` also requires its issued interaction and conversation IDs, caches the completed result for idempotent retries, and allows a confirmed chat result only after the action completed server-side. The database confirmation itself also returns the same completed result on a retry.
- The API key remains server-side and must never be referenced from `src/client/`.
- The dataset contains no real customer or production data.

This is a demonstration, not a production authorization layer or a general SQL sandbox. Interaction state is process-local, and pending actions are currently de-duplicated globally by order and action type rather than by an authenticated principal. The generic query capability is acceptable here because it is restricted to a small synthetic fixture; production data still needs authentication, tenancy controls, row-level authorization, audited semantic views, and database-native limits. Valid chat requests call the configured OpenAI model and may incur API charges. The current Responses API integration uses stored responses for turn chaining; send only demo-safe content.

## Deterministic data

The fixed seed produces 200 customers, 100 products, and 1,500 orders from January 2025 through June 2026, plus items, payments, shipments, returns, support cases, and four local policy documents. The reference timestamp is `2026-06-30T12:00:00.000Z`.

Generated database files are ignored. Reset all demo mutations with:

```bash
bun run reset:data
```

See [`data/README.md`](data/README.md) for stable fixture records and [`data/scenarios.jsonl`](data/scenarios.jsonl) for the 35 golden scenario specifications.

## Evaluation laboratory

Validate the scenario contract and tool-to-renderer compatibility without a network request:

```bash
bun run eval:offline
```

Live evaluation is deliberately double opt-in and requires explicit scenario selection:

```bash
NLUI_EVAL_LIVE=1 bun run eval:live -- \
  --id analytics-customer-count \
  --confirm-billable
```

Use `--category`, `--limit` (maximum 10), `--repeat` (maximum 3), and `--timeout-ms` for bounded experiments. `--json` emits the complete synthetic-data trace; redirect it into the ignored `eval-results/` directory when retaining runs. The runner fingerprints and requires the deterministic database baseline, and a read-only run fails if that fingerprint changes unexpectedly. Safe-action scenarios additionally require `--allow-safe-actions`, are restricted to one repeat until isolated runners exist, and leave the demo database dirty, so reset it afterward.

The Semantic Query Plan pilot uses the versioned paraphrase fixture at [`data/experiments/semantic-query-v1.jsonl`](data/experiments/semantic-query-v1.jsonl). Its paired runner exposes exactly one generic analytics capability per arm—`query_dataset` for the control and `semantic_query` for the treatment—and requires the same double opt-in before any provider request:

```bash
NLUI_EVAL_LIVE=1 bun run eval:query-ab -- \
  --all \
  --confirm-billable \
  --output eval-results/semantic-query-v1.json
```

Select all nine prompts with `--all`, one intent with `--case`, or individual prompts with repeated `--id` flags. The runner projects and caps the complete paired run count before starting. It compares tool selection, deterministic answer denotation, UI modality, latency, token use, provider rounds, and rejected attempts. Denotation tuples use selected column order rather than model-chosen SQL aliases, so both arms are graded against the same values. `--output` writes the full comparison and raw synthetic traces only inside the ignored `eval-results/` directory. This is an experiment harness, not evidence that either arm performs better; comparative conclusions require retained, repeatable live reports.

The current live adapter executes independent single-turn scenarios. The catalog explicitly marks two application-route confirmations and one contextual multi-turn case, which need dedicated adapters rather than being misreported as model-tool evaluations. Structural tool/block/safety checks are deterministic. Seventeen assertions are machine-graded with twenty-five rules spanning validated tool output, SQL intent, denotation, repair position, exact UI modality, and assistant-answer faithfulness; the remaining natural-language assertions stay visibly `not_evaluated` until migrated. Incomplete runs exit nonzero unless `--allow-incomplete` is explicitly selected.

## Validation

```bash
bun run check       # Biome, TypeScript, and Bun tests
bun run compile     # production single-file executable
bun run eval:offline # non-network scenario and scorer validation
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
  data/                    deterministic SQLite data, query policy, semantic catalog, and isolated query worker
  evals/                   scenario contract, traces, deterministic scoring, and bounded runner
  nlui/                    trusted schemas, tool catalog, block builders
  services/                Responses API streaming/tool loop and internal evaluation traces
  routes/api/chat/         validated NDJSON chat endpoint
  routes/api/actions.ts    explicit opaque-action confirmation
data/
  experiments/             versioned paired semantic-query paraphrase fixtures
  knowledge/               local policy corpus
  scenarios.jsonl          golden NLUI scenarios
scripts/                   seed and reset commands
public/docs/               documentation served at /docs/*
```

More detail is available at `/docs/readme`, `/docs/getting-started`, and `/docs/architecture` while the server is running.
