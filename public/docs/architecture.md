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

The server validates the complete request before opening a stream. A valid response uses `application/x-ndjson` and emits discrete events:

- `message.started`
- `tool.started`
- `tool.completed`
- `text.delta`
- `ui.block`
- `message.completed`
- `error`

NDJSON keeps text incrementally renderable without exposing a partially parsed JSON UI tree. Markdown streams through XMarkdown. A UI block is emitted only after a tool has returned and the complete block array has passed server-side Zod validation.

The service chains turns with `previous_response_id`, bounds execution to six tool rounds and twelve calls, and cancels the provider stream when the HTTP client disconnects.

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

React switches exhaustively on `block.type` and maps each variant to known Ant Design components. Descriptors contain data, labels, and opaque identifiers—not functions, URLs, SQL, JSX, or endpoint names. Generated SQL remains server-side and is never used as a rendering description.

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
6. gives result columns server-owned keys before building a trusted stats, chart, table, or empty-result block.

Internal tables, wildcard selection, schema qualifiers, table-valued or unapproved functions, recursive/compound queries, implicit or cartesian joins, and contact/address columns are outside this capability. This gate is designed for the synthetic demo dataset; it does not replace production authentication, tenant filters, database roles, row-level security, or audited analytics views.

Policy search is deterministic local lexical retrieval over four Markdown documents loaded during seeding. This version does not require embeddings, a vector database, or hosted file search.

## Action boundary

Mutations use two phases:

1. `prepare_action` validates the domain request and stores a pending action. Data is unchanged. The model sees only a summary; the browser receives an opaque, expiring `actionId` inside a confirmation block.
2. After the user explicitly confirms, the browser posts that identifier to `POST /api/actions`. The server resolves it against the pending-action table and applies the fixed repository mutation.

Unknown, expired, superseded, or already consumed actions fail without mutation. The current actions are limited to returns, processing-order cancellation, and pre-shipment address changes in the synthetic database.

This capability check is the real trust boundary. A button label or layout is cosmetic; an action identifier is authoritative only when the server recognizes its current pending state.

## Deterministic fixture

The generator uses a fixed seed, dataset version, and reference timestamp. The expected baseline is:

- 200 customers
- 100 products
- 1,500 orders from January 2025 through June 2026
- related line items, payments, shipments, returns, and support cases
- four policy documents

Money is stored as integer euro cents and timestamps as ISO 8601 UTC strings. `bun run reset:data` recreates the baseline after action demonstrations.

`data/scenarios.jsonl` contains 33 golden specifications spanning analytics, orders, products, retrieval, disambiguation, and guarded actions. They define expected tools, UI classes, forbidden mutations, and data assertions. The default automated suite verifies fixture integrity, SQL-policy bypasses, worker timeouts, and representative tools, but it does not run a live model evaluation.

## Deployment and persistence

The Docker image copies source, runtime dependencies, configuration, scripts, documentation, scenario definitions, and policy seed files. It deliberately excludes generated SQLite, WAL, and shared-memory files. `/app/data` and `/app/uploads` are owned by the unprivileged `bun` user.

Without a volume, the database is container-local and ephemeral. A Docker named volume at `/app/data` preserves confirmed demo actions. The application is a single SQLite writer; it is not designed for horizontally scaled replicas sharing one database file.

The OpenAI API key remains in the server process. Valid chat requests can be billable, and the current provider call uses stored responses for conversation chaining. Automated unit and malformed-request smoke tests avoid the provider entirely.

## Compiled mode

`bun build --compile` embeds the server, frontend assets, and dataset-query worker as separate executable entrypoints. The file-system route modules, `config/`, `public/`, and `data/knowledge/` are still resolved from disk by the current architecture. A deployable compiled package therefore includes those directories or changes the route/data loading strategy.
