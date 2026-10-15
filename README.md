# NLUI Runtime Demo

Development work is tracked in the [Issues Registry](docs/issues/README.md), with permanent `NLUI-NNN` files and recorded acceptance/verification evidence.

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

## Request budgets and shutdown

`config/server.yaml` defines finite lifecycle limits. Environment overrides take precedence and are validated before binding:

| Setting | Default | Environment override | Allowed milliseconds |
| --- | --- | --- | --- |
| `server.chatRequestTimeoutMs` | 120,000 | `CHAT_REQUEST_TIMEOUT_MS` | 1–600,000 |
| `server.shutdownGracePeriodMs` | 5,000 | `SHUTDOWN_GRACE_PERIOD_MS` | 1–60,000 |

Zero does not disable either limit. Chat's total budget includes body parsing, provider setup/streaming, and tools; SQL workers receive cancellation too. A body-read deadline returns HTTP 408. After NDJSON headers have started, a timeout emits one safe error event and closes the stream, without a completion event or response-chain advance. Failed UI submissions remain retryable. The transport also has a finite idle timeout, rounded to seconds and capped at 255 seconds.

SIGINT/SIGTERM stop new connections, close tracked WebSockets with code 1012, and let healthy HTTP streams drain. At the grace deadline, remaining connections are force-closed and the process exits. Configure the orchestrator's termination grace **longer** than the application grace (for example, Docker's 10-second stop window with the default 5-second application grace). Cancellation cannot preempt synchronous JavaScript or roll back work already committed; action confirmation remains idempotent across retries.

Unexpected action failures return a generic HTTP 500. Only application-defined capability/domain rejection messages are public (400/409); operator diagnostics omit exception text and redact configured values from stack locations.

## Confirmation recovery

An action response has an explicit outcome, not just an HTTP status: a successful result block, a known domain rejection (`rejected`), an invalid/expired capability (`unavailable`), or an uncertain result (`unknown`, including unexpected failures or an action still executing). Only validated success blocks are accepted as action completion.

The browser bounds each action request, including response-body reading, to 20 seconds. Network failures, timeouts, malformed responses and unexpected server failures keep the original confirmation details and show **Check result / retry**. This repeats the already-approved POST with the same conversation, interaction and action IDs: the server replays its recorded result or completes the original action if it has not run. It is not a read-only status check, does not create a new action and is never retried automatically. Cancel is unavailable while a request is pending or uncertain.

A known rejection is displayed separately. If an uncertain request later encounters an expired/unavailable capability, the UI keeps the uncertainty and asks the user to inspect the order before preparing another action; it never infers that nothing changed. Recovery is bounded by the process-local capability lifetime. Reload/restart recovery and durable chat-event replay remain separate work.

Action completion and chat continuation are independent. If continuation fails or is cancelled, the successful action result stays visible and **Continue chat** retries only the typed UI result, never the mutation. An aborted or incomplete stream is not counted as a completed interaction, and late events cannot advance a reset/cancelled conversation's response chain.

## Form and statistic controls

Forms distinguish idle, submitting, submitted and failed responses. Only an in-flight request shows a spinner. Successful forms show Submitted and remain locked; a failed response preserves the entered values and restores editing/retry. A synchronous submission guard prevents duplicate requests before React has rerendered. Controller state remains attached to the issued interaction, rather than resetting on routine parent rerenders.

Clearing an optional numeric field omits it from the typed UI result. Both the client descriptor and the server's independently stored capability apply the same normalization; only the server's issued rules determine what is accepted. Required values, wrong types, invalid ranges and extra fields remain rejected. Undefined issued fields follow normal JSON omission, while unknown keys remain present for rejection. No other null value is silently treated as an empty number.

Statistic blocks render their optional title and description above the established metric grid. Named regions use unique heading/description references; untitled groups have a fallback accessible name. Metric values, labels, date/currency formatting and trend cards are unchanged. The grid adapts to narrow available widths without forcing horizontal page scrolling.

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

Fixture v2 (`nlui-retail-operations-v2`) bounds all observed seed events to that exact inclusive instant; expected-delivery forecasts may be later. [`data/fixture-manifest.json`](data/fixture-manifest.json) records its version, logical fingerprint and golden-file hashes. Existing v1 databases are refused without modification: back up wanted local changes before explicitly resetting, or seed a separate file as described in [`data/README.md`](data/README.md).

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

Use `--category`, `--limit` (maximum 10), `--repeat` (maximum 3), and `--timeout-ms` for bounded, serial experiments. Every run receives its own freshly seeded, fingerprint-verified database and capability registry; cleanup never targets retained demo data. Safe-action scenarios additionally require `--allow-safe-actions`; their repeats start from independent baselines. Multi-turn scenarios execute their declared prerequisites in the same conversation. The two confirmation scenarios invoke the actual action handler and verify idempotent replay without calling a model.

`--json` emits a redacted synthetic-data trace; redirect it into the ignored `eval-results/` directory when retaining runs. Reports retain fixture/catalog/evaluator versions, golden hashes, provider attempts, tool and policy receipts, query/plan hashes when available, latency, usage coverage and repeated-run stability. Missing usage is not assumed free. Estimated cost requires explicitly supplied versioned pricing and complete, matching-model usage; the CLI has no hardcoded rates.

The Semantic Query Plan pilot uses the versioned paraphrase fixture at [`data/experiments/semantic-query-v1.jsonl`](data/experiments/semantic-query-v1.jsonl). Its paired runner exposes exactly one generic analytics capability per arm—`query_dataset` for the control and `semantic_query` for the treatment—and requires the same double opt-in before any provider request:

```bash
NLUI_EVAL_LIVE=1 bun run eval:query-ab -- \
  --all \
  --confirm-billable \
  --output eval-results/semantic-query-v1.json
```

Select all nine prompts with `--all`, one intent with `--case`, or individual prompts with repeated `--id` flags. The runner projects and caps the complete paired run count before starting. It compares tool selection, deterministic answer denotation, UI modality, latency, token use, provider rounds, and rejected attempts. Denotation tuples use selected column order rather than model-chosen SQL aliases, so both arms are graded against the same values. `--output` writes the full comparison and raw synthetic traces only inside the ignored `eval-results/` directory. This is an experiment harness, not evidence that either arm performs better; comparative conclusions require retained, repeatable live reports.

All 77 catalog assertion labels have executable grading across 100 deterministic rules, with zero unsupported or unconfigured labels. Checks cover tool output, SQL predicates and expression-wide units/grain, denotation, numerical claims, forbidden columns/tools, fixture mutations and visible presentation. Product facts are SKU-bound to actual tool records and checked through the production renderer; forms must render the frozen application-owned questions. Two safety explanations use a finite application-authored caption catalog enforced by the JSON response schema and resolver. This proves those bounded contracts, not arbitrary language understanding. Unregistered paraphrases remain unproven; there is no external language grader. Reports pin evaluator `deterministic-v3-presentation` and a presentation-criteria fingerprint. Incomplete, failed, stale-version or externally unverified grading cannot promote an experiment arm. Incomplete live runs exit nonzero unless `--allow-incomplete` is explicitly selected; that flag does not enable promotion.

Run the provider-free reference adapter against all 35 specifications:

```bash
bun run eval:fixtures
```

It executes real tools, renderers, structured composition, isolated routes and the declared trajectory using explicit oracle arguments/annotations. The expected profile is **35 passed, zero incomplete**, with no failures or errors. Qualification checks the exact case IDs and current report versions. This is bounded reference/plumbing evidence, not a live-model quality score. [NLUI-031](docs/issues/NLUI-031.md) records the seven newly qualified contracts and their limitations.

## Validation

```bash
bun run check       # Biome, TypeScript, and Bun tests
bun run compile     # production single-file executable
bun run eval:offline # non-network scenario and scorer validation
bun run eval:fixtures # real isolated tools/routes with reference answers; no provider
bun run verify      # static/tests/offline/reference/source HTTP; Hurl required
bun run test:compiled # owned production binaries: HTTP + source-free SQL worker
bun run test:docker # pulled production image: HTTP/data/permissions/health/shutdown
bun run verify:all  # all three qualification modes; Hurl and Docker required
```

HTTP smoke tests start their own server on an ephemeral port. Hurl must be installed; no existing dev server is needed. Fixtures, uploads, and server working directories are isolated and removed on success or failure. Existing uploads and databases are never cleanup targets.

```bash
bun run test:http   # Source server (or: task test)
task test:compiled  # Production binary, same isolated HTTP assertions
```

The [qualification workflow](.github/workflows/qualification.yml) runs source and compiled gates on Linux/macOS, then the production container gate on Linux. It uses current Bun, frozen application dependencies, SHA-pinned actions and read-only repository permissions, with no provider secrets or live evaluations. Hurl is mandatory rather than silently skipped: CI installs the official `@orangeopensource/hurl@8.0.4` wrapper into its temporary tools directory, explicitly trusting that package's binary-install script. No tool package is added to application dependencies.

Qualification subprocesses disable dotenv loading, withhold inherited provider settings and force live evaluation off; the ignored development `.env` is not modified. Compiled output goes into owned temporary directories, not over an existing `dist/demo`. Container qualification uses a unique image/container with no external network, published ports, retained mounts or provider credentials, and removes only those exact resources. See [verification details](docs/verification.md). Local qualification is not evidence of a hosted GitHub run or branch-protection settings.

The first hosted [Qualification run](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962) passes all three jobs for release 1.4.0, including 628 tests on both matrix platforms. [NLUI-015](docs/issues/NLUI-015.md) records that dated evidence; check the current commit's run for fresh qualification. Branch-protection settings and deployment were not changed.

Release 1.5.0's [Qualification run 38727922140](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140) also passes all three jobs, with 717 tests on each matrix platform and all 35 bounded reference cases passing in source, compiled and container modes. [NLUI-031's evidence](docs/issues/reviews/2026-10-15-presentation-qualification.md#publication-follow-up) preserves the exact commit/jobs and limitations; the registry follow-up bumps to 1.5.1 and is checked by its own workflow.

The unit, tool, and malformed-request smoke tests do not call OpenAI. A valid `POST /api/chat` is intentionally not part of the default suite because it is billable and model-dependent.

For manual confirmation recovery checks without a provider or retained database, run `bun run tests/fixtures/confirmation-server.ts` and open the printed loopback port. This disposable fixture renders the real confirmation component, simulates an unreadable response after a synthetic SQLite commit and a failed chat continuation, and exposes mutation/request counters. SIGINT/SIGTERM remove its owned temporary database. The fixture is excluded from production routing and Docker packaging.

For form/statistic checks, run `bun run tests/fixtures/controls-server.ts` and open its printed loopback port. It renders the real NLUI components with product/order records from an isolated copy of the existing synthetic dataset and application-owned product preference forms. The real chat route uses a provider-free runner. Finish pending response releases a held submission so loading, failure, editing and retry can be inspected deterministically. SIGINT/SIGTERM clean up the fixture's owned database; no test route is included in production.

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
