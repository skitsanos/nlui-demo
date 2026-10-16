# NLUI Runtime Demo

This application demonstrates a controlled natural-language user interface built with Bun, React, Ant Design, and Ant Design X.

The user can ask a question in prose and receive concise text plus application-rendered UI: statistics, charts, tables, product choices, guided forms, policy sources, confirmations, and action results. The model selects strict server capabilities and returns a schema-constrained prose-or-block-reference envelope; it does not generate React, routes, block props, or executable behavior. Open-ended analytics may include one SQL `SELECT` inside a guarded tool call, never as UI or directly executable text.

## Main surfaces

- [`/`](/) — React and Ant Design X conversation interface
- [`/docs/getting-started`](/docs/getting-started) — local setup, data reset, validation, and Docker
- [`/docs/architecture`](/docs/architecture) — transport, tool, rendering, and action boundaries
- [`/docs/activity-protocol`](/docs/activity-protocol) — sanitized public NDJSON activity events and internal-trace boundary
- [`/docs/research`](/docs/research) — current opt-ins, provider-free evaluations, frozen pilot results and budget limits
- [`/docs/skills`](/docs/skills) — optional reviewed instruction-only workflows and their loading/security boundaries

## Primary API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chat` | Accepts a typed user message or UI result and streams NDJSON events |
| `POST /api/actions` | Confirms one opaque, server-prepared demo action |
| `GET /api/conversations` | Replays owner-scoped versioned conversation events and control state |
| `POST /api/analysis` | Creates an owned immutable analysis or typed parent-bound refinement |
| `GET /api/analysis` | Reads a receipt; SQL requires explicit owner-scoped debug access |
| `GET /api/catalog` | Generated versioned semantic definitions and display metadata |
| `POST /api/datasets/preview` | Validates the approved CSV template into a quarantined, non-executable preview |
| `GET /api/health` | Process and Bun runtime health |
| `GET /api/version` | Application and Bun versions |
| `GET /api/config` | Allowlisted, non-secret server configuration |

The inherited Bun scaffold also retains example upload, validation, and dynamic-route endpoints. They are not part of the NLUI protocol.

## Server-owned tool catalog

| Tool | Data operation | Typical UI blocks |
| --- | --- | --- |
| `get_dashboard` | Revenue, orders, regions, categories, and time series | statistics, chart |
| `query_dataset` | Parsed, allowlisted, canonicalized custom aggregate over the synthetic schema | prose-only scalar, statistics, chart, table |
| `list_orders` | Bounded order search and filters | table |
| `search_products` | Catalog constraints and preference ranking | choices |
| `get_order` | One normalized order and its line items | statistics, table |
| `search_policies` | Deterministic local policy retrieval | sources |
| `request_details` | Ask only for missing application-defined values | form |
| `prepare_action` | Validate a mutation without executing it | confirmation |
| `semantic_query` | Evaluation-only alternative to guarded SQL; never a default replacement | statistics, chart, table |
| `get_infographic` | Opt-in source-backed binary comparison, recorded timeline or general-policy process | infographic with exact readable alternative |

Confirmation is deliberately outside the model tool loop: the browser posts the opaque `actionId` to `/api/actions` only after explicit user approval.

The separate `load_skill` helper is published only with `NLUI_SKILLS=1`. It supplies bounded reviewed workflow instructions, not domain data, UI blocks or permission to act. It leaves the domain table above unchanged; see [Skills](/docs/skills).

## Dataset

The synthetic fixture is generated from a fixed seed and reference date. It contains 200 customers, 100 products, 1,500 orders, operational child records, and four policy documents. `data/scenarios.jsonl` defines 35 golden analytics, product, retrieval, disambiguation, and safe-action scenarios, including schema-aware customer, date-format, table-deduplication, and cross-table questions.

Generated SQLite, WAL, and shared-memory files are local runtime artifacts and are not committed or copied into the container image.

## Safety boundary

- The model requests tools with strict JSON schemas.
- The terminal Responses API turn uses strict Structured Outputs and may reference only block IDs produced during the current run.
- The server parses tool arguments and creates every NLUI descriptor itself.
- Candidate block arrays and the final selected aggregate are validated before anything is streamed to the browser.
- Data already carried by a table block is absent from the model-facing tool result, preventing a second prose rendering of those rows.
- Most repository methods contain fixed SQL. The generic analytics exception accepts one model-proposed `SELECT`, then validates and canonicalizes its AST before an isolated read-only worker can execute it.
- Generic SQL cannot access internal/action tables, contact/address columns, wildcard fields, unapproved functions, arbitrary joins, or multiple/recursive/compound statements; execution and output are tightly bounded.
- Mutations are prepare-then-confirm and use opaque, expiring capabilities.
- The OpenAI key stays on the Bun server.

This single-process local demo has durable application-owned conversation state and anonymous session isolation, not production authentication or multi-tenancy. `NLUI_STATE_DB_PATH` defaults to a separate private `data/conversations.sqlite`; it never migrates/resets the business dataset. The browser restores its current conversation across refresh. Expired sessions cannot reclaim previous conversations. Protect local state storage: it contains private messages/artifacts and is not encrypted.

**Explore dataset** performs typed analytics/refinement without provider calls. **Inspect a dataset** validates only a fixed aggregate CSV template and never activates uploads. The default controlled renderer is unchanged; `?renderer=a2ui` opts into the pinned X Card/A2UI experiment and safely falls back for unsupported surfaces.

Valid chat turns may incur OpenAI usage. Automated qualification is provider-free. The independent 2026-10-15 **40/40** and 2026-10-16 **32/32** approved research budgets are both exhausted and retained. Do not reset either ledger. No further provider work is authorized; any new live study needs a separately approved cap and preregistered plan. The small studies did not justify replacing guarded SQL or the controlled renderer. See [research](/docs/research) for opt-ins, exact frozen outcomes and the provider-free fallback correction.
