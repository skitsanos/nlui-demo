# NLUI Runtime Demo

This application demonstrates a controlled natural-language user interface built with Bun, React, Ant Design, and Ant Design X.

The user can ask a question in prose and receive concise text plus application-rendered UI: statistics, charts, tables, product choices, guided forms, policy sources, confirmations, and action results. The model selects strict server capabilities and returns a schema-constrained prose-or-block-reference envelope; it does not generate React, routes, block props, or executable behavior. Open-ended analytics may include one SQL `SELECT` inside a guarded tool call, never as UI or directly executable text.

## Main surfaces

- [`/`](/) — React and Ant Design X conversation interface
- [`/docs/getting-started`](/docs/getting-started) — local setup, data reset, validation, and Docker
- [`/docs/architecture`](/docs/architecture) — transport, tool, rendering, and action boundaries

## Primary API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/chat` | Accepts a typed user message or UI result and streams NDJSON events |
| `POST /api/actions` | Confirms one opaque, server-prepared demo action |
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

Confirmation is deliberately outside the model tool loop: the browser posts the opaque `actionId` to `/api/actions` only after explicit user approval.

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

This is a single-process demo without authentication, multi-tenancy, or durable conversation storage. Valid chat turns may incur OpenAI usage. The supplied automated validation uses local data and deliberately malformed HTTP requests, so it is non-billable.
