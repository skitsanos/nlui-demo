# NLUI retail operations dataset

This directory contains the reproducible, synthetic dataset used by the NLUI demo. It has no personal or production data.

Run `bun run seed` to create `data/demo.sqlite` if it does not already contain the expected dataset. Run `bun run reset:data` to discard demo mutations and rebuild it from the fixed seed. The application also creates the database lazily when a data-backed tool is used.

The database contains 200 customers, 100 products, 1,500 orders covering January 2025 through June 2026, their line items, payments, shipments, returns, support cases, and pending confirmed actions. Currency values are integer euro cents. Timestamps are ISO 8601 UTC strings.

Stable records intended for demonstrations include:

- `ORD-1042`: recently delivered and eligible for a return at the dataset reference date.
- `ORD-1176`: still processing, so its address can be changed or it can be cancelled after confirmation.
- `ORD-1320` and `ORD-2088`: high-value delayed orders; `ORD-2088` has an urgent support case.

The Markdown files in `knowledge/` are loaded into the database during seeding for deterministic lexical retrieval. `scenarios.jsonl` contains independent golden scenario specifications, including schema-aware customer and cross-table questions. Each line declares expected tool selections, NLUI blocks, forbidden mutations, and optional setup or data assertions. They are fixtures for evaluation work, not a billable live-model test suite. Reset the database before scenarios that exercise actions.

The generic analytics tool exposes only a curated subset of these tables and columns. It accepts one parsed and canonicalized `SELECT`, never control-plane tables or arbitrary database access. Money is stored in cents and should be divided by 100.0 and aliased with an `_eur` suffix for display.

Generated SQLite database, WAL, and shared-memory files are ignored by Git and excluded from Docker build contexts. A container image includes only the deterministic source fixtures; mount `/app/data` on writable persistent storage when running it.
