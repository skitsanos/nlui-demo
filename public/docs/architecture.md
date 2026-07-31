# Architecture

## System shape

```text
React + Ant Design X
        |
        | POST /api/chat (JSON)
        v
Bun request validation
        |
        | OpenAI Responses API stream and strict tool calls
        v
Application-owned NLUI tools
        |
        +--> fixed SQLite repository queries
        +--> parsed/canonicalized SELECT in an isolated worker
        +--> local policy retrieval
        +--> pending action preparation
        |
        | validated NDJSON events
        v
Controlled React block registry
```

The architecture combines Bun's two routing modes:

- `Bun.serve({routes})` maps `/` to an imported HTML entry. Bun bundles React, TSX, CSS, and package assets and provides HMR in development.
- `Bun.FileSystemRouter` handles API and documentation modules from `src/routes/` through the fallback request pipeline.

Static HTML-bundle assets are served by Bun's native route layer. API responses pass through the application's CORS, timing, and access-log pipeline.

## Conversation transport

The browser sends one of two inputs to `POST /api/chat`:

```ts
type ChatInput =
    | {type: 'user_text'; text: string}
    | {type: 'ui_result'; interactionId: string; values: Record<string, unknown>};
```

The request also carries an application `conversationId`. The server validates the complete request before opening a stream. A valid response uses `application/x-ndjson` and emits discrete events:

- `message.started`
- `tool.started`
- `tool.completed`
- `text.delta`
- `ui.block`
- `message.completed`
- `error`

Tool activity remains incrementally visible over NDJSON, but the provider's terminal Structured Output is buffered until its complete JSON envelope validates. The envelope chooses either a prose answer or trusted block identifiers with an optional caption; raw JSON fragments never enter XMarkdown. Tool blocks remain server-owned candidates until every selected identifier resolves, the selected aggregate passes Zod validation, and interactive capabilities can be issued as one batch. Only then does the server emit the final `text.delta` and `ui.block` events. A later `ui_result` is resolved through that registry before its canonical values enter model context.

The service uses Responses API `text.format` with a strict JSON Schema, chains turns with `previous_response_id`, bounds execution to six tool rounds, twelve calls, twelve candidate blocks, and 1,200 output tokens per provider response, and cancels the provider stream when the HTTP client disconnects. A bounded server-side conversation registry binds every continuation to the last response ID and prevents concurrent turns from splicing unrelated provider chains.

## Controlled NLUI rendering

The model does not describe component trees. It selects from eight strict tools; application code creates a discriminated block union:

| Block | Renderer responsibility |
| --- | --- |
| `stats` | Headline values and trends |
| `chart` | Bounded bar or line series |
| `table` | Application-defined columns and scalar rows |
| `choices` | Structured single or multiple selection |
| `form` | Application-defined fields and validation limits |
| `confirmation` | Review of a prepared opaque action |
| `sources` | Policy evidence from the local corpus |
| `result` | Completed action or error outcome |

React switches exhaustively on `block.type` and maps each variant to known Ant Design components. Descriptors contain data, labels, and opaque identifiers—not functions, URLs, SQL, JSX, or endpoint names. The model can reference a validated descriptor by ID but cannot generate or alter its props. Generated SQL remains server-side and is never used as a rendering description.

## Tool and data boundary

OpenAI receives strict function definitions for:

- `get_dashboard`
- `query_dataset`
- `list_orders`
- `search_products`
- `get_order`
- `search_policies`
- `request_details`
- `prepare_action`

Every call is parsed again with a Zod schema before it reaches a handler. Most handlers invoke a fixed `DemoRepository` interface backed by `bun:sqlite`.

`query_dataset` is the deliberately constrained text-to-SQL exception. The model sees a curated analytics schema, relationships, units, and snapshot semantics. The server then:

1. parses exactly one SQLite `SELECT` and rejects all other statement types;
2. validates published tables, approved functions, non-recursive CTEs, explicit foreign-key joins, and visible columns;
3. canonicalizes the accepted AST and reparses it, so the original model string is never executed;
4. sends only the canonical query to a separate read-only/query-only Bun worker;
5. terminates work after 1.5 seconds and bounds the result to 100 rows, 12 columns, scalar cells, and a 96 KiB payload;
6. gives result columns server-owned keys, removes technical projection helpers from model-facing and presentation data, and builds a trusted stats, chart, table, or empty-result block; simple non-numeric scalars remain prose-only, while table rows are withheld from the model-facing result and complete validated rows remain available only to explicit internal evaluation traces.

Internal tables, wildcard selection, schema qualifiers, table-valued or unapproved functions, recursive/compound queries, implicit or cartesian joins, and contact/address columns are outside this capability. This gate is designed for the synthetic demo dataset; it does not replace production authentication, tenant filters, database roles, row-level security, or audited analytics views.

Policy search is deterministic local lexical retrieval over four Markdown documents loaded during seeding. This version does not require embeddings, a vector database, or hosted file search.

## Action boundary

Mutations use two phases:

1. `prepare_action` validates the domain request and stores a pending action. Data is unchanged. The model sees only a summary; the browser receives an opaque, expiring `actionId` inside a confirmation block.
2. After the user explicitly confirms, the browser posts the action, interaction, and conversation identifiers to `POST /api/actions`. The server reserves the issued confirmation capability, resolves the action against the pending-action table, and applies the fixed repository mutation.

Unknown, altered, expired, cross-conversation, superseded, or already consumed interactions fail without mutation. A completed result is cached on the capability so retrying the confirmation request is idempotent, and the repository reconstructs the same result from a durably completed action rather than executing it again. The subsequent confirmed `ui_result` receives the canonical server result and is accepted only after completion. Failed or cancelled model continuations release their interaction claim for retry. The current actions are limited to returns, processing-order cancellation, and pre-shipment address changes in the synthetic database.

This capability check is the real trust boundary. A button label or layout is cosmetic; an action identifier is authoritative only when the server recognizes its current pending state. Interaction and conversation registries are bounded but process-local in this research demo. Pending actions are also de-duplicated globally by order and action type, so another demo conversation can supersede an earlier proposal. Restart safety, horizontal replicas, principal-scoped ownership, and multi-user authorization need a durable shared implementation before production use.

## Deterministic fixture

The generator uses a fixed seed, dataset version, and reference timestamp. The expected baseline is:

- 200 customers
- 100 products
- 1,500 orders from January 2025 through June 2026
- related line items, payments, shipments, returns, and support cases
- four policy documents

Money is stored as integer euro cents and timestamps as ISO 8601 UTC strings. `bun run reset:data` recreates the baseline after action demonstrations.

`data/scenarios.jsonl` contains 35 golden specifications spanning analytics, orders, products, retrieval, disambiguation, and guarded actions. They define expected tools, UI classes, forbidden mutations, data assertions, and—where needed—single-turn, multi-turn, or application-route execution mode. The latest-customer scenario requires a table-only response, making prose duplication a deterministic regression.

## Evaluation boundary

`bun run eval:offline` parses the JSONL with the reusable strict schema and checks execution-mode/tool expectations against the current compatibility map. It does not contact a model or replace direct handler tests; the compatibility map must evolve with the tool catalog.

The double-opt-in `eval:live` runner currently handles selected single-turn scenarios. It first verifies a logical fingerprint of the active database against a freshly generated baseline, then fails read-only runs if the final fingerprint changed. Safe-action runs require an additional flag and exactly one repeat until isolated mutation runners exist. It captures browser-protocol events plus an internal trace containing validated tool arguments/results, canonical query hashes, tool and provider-round timing, model and prompt versions, final text, UI blocks, response IDs, and token usage—including completed rounds before a later failure. Internal trace data is returned only to the explicit evaluation process; SQL, tool results, and provider metadata are not added to the browser NDJSON protocol or normal HTTP logs.

The scorer deterministically checks required tools, forbidden tools, renderer-class coverage, failures, structured tool-output assertions, and configured assistant-text faithfulness rules. Natural-language assertions without a migrated deterministic rule are reported as `not_evaluated`, making the run `incomplete` and the command nonzero unless the operator explicitly allows incomplete research runs. The v1 adapter intentionally refuses the two route confirmations and one context-dependent multi-turn scenario until those workflows have isolated runners.

## Deployment and persistence

The Docker image copies source, runtime dependencies, configuration, scripts, documentation, scenario definitions, and policy seed files. It deliberately excludes generated SQLite, WAL, and shared-memory files. `/app/data` and `/app/uploads` are owned by the unprivileged `bun` user.

Without a volume, the database is container-local and ephemeral. A Docker named volume at `/app/data` preserves confirmed demo actions. The application is a single SQLite writer; it is not designed for horizontally scaled replicas sharing one database file.

The OpenAI API key remains in the server process. Valid chat requests can be billable, and the current provider call uses stored responses for conversation chaining. Automated unit and malformed-request smoke tests avoid the provider entirely.

## Compiled mode

`bun build --compile` embeds the server, frontend assets, and dataset-query worker as separate executable entrypoints. The file-system route modules, `config/`, `public/`, and `data/knowledge/` are still resolved from disk by the current architecture. A deployable compiled package therefore includes those directories or changes the route/data loading strategy.
