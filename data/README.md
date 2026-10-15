# NLUI retail operations dataset

This directory contains the reproducible, synthetic dataset used by the NLUI demo. It has no personal or production data.

Run `bun run seed` to create `data/demo.sqlite` if it does not already contain the expected dataset. Run `bun run reset:data` to discard demo mutations and rebuild it from the fixed seed. The application also creates the database lazily when a data-backed tool is used.

The database contains 200 customers, 100 products, 1,500 orders covering January 2025 through June 2026, their line items, payments, shipments, returns, support cases, and pending confirmed actions. Currency values are integer euro cents. Timestamps are ISO 8601 UTC strings.

The current fixture is `nlui-retail-operations-v2` (dataset version 2). Its inclusive observed-event cutoff is exactly `2026-06-30T12:00:00.000Z`, not the end of that calendar day. Customer registrations, order creation/updates, payments, shipment dispatch/delivery, return requests and support-case creation/updates never exceed that instant in a fresh seed. A generated order whose latest observed event would exceed it has its complete timeline shifted backward by the excess, including its forecast; event durations, nulls and statuses are preserved. Expected delivery is a forecast and may remain later than the snapshot (15 seeded shipments do).

[`fixture-manifest.json`](fixture-manifest.json) binds the dataset ID, version, fixed random seed, exact snapshot, logical baseline fingerprint and golden-file hashes. The experiment specification's `semantic-query-v1` name and the semantic catalog version are independently versioned; the provider-free regression suite rechecks both query arms against this v2 dataset. The existing customer counts, latest gold registration and half-year revenue golden denotations remain unchanged.

Older or incompatible databases are refused, never automatically migrated or replaced. Before opting into a reset, back up any local mutations you want to keep. `bun run reset:data` deliberately rebuilds the default database and discards those mutations. To preserve it and try v2 separately, create an explicitly chosen new file with `bun run seed -- --database /absolute/path/to/new-v2.sqlite`; repository/query callers must then select that same path. Historical evaluation artifacts remain historical; rerun them against v2 before claiming current qualification.

Stable records intended for demonstrations include:

- `ORD-1042`: recently delivered and eligible for a return at the dataset reference date.
- `ORD-1176`: still processing, so its address can be changed or it can be cancelled after confirmation.
- `ORD-1320` and `ORD-2088`: high-value delayed orders; `ORD-2088` has an urgent support case.

The Markdown files in `knowledge/` are loaded into the database during seeding for deterministic lexical retrieval. `scenarios.jsonl` contains 35 golden specifications, including schema-aware customer and cross-table questions. Each line declares expected tools, NLUI blocks, forbidden mutations, execution mode and assertion rules. All 77 labels are classified: 70 executable labels across 100 rules and seven explicit unsupported language/visible-product labels. The manifest pins the updated scenario bytes; the dataset's logical fingerprint and golden denotations are unchanged.

`experiments/semantic-query-v1.jsonl` separately contains versioned paraphrases for the paired guarded-SQL versus semantic-plan pilot. Its deterministic denotations are alias-neutral and shared by both arms. Evaluation adapters own fresh, isolated databases for each run, including mutation repeats, and leave retained demo data untouched. `bun run eval:fixtures` executes explicit reference answers through the real tools/adapters without a provider; the expected 28 passed/seven incomplete profile is not a live-model performance claim. Null/refund/multi-payment/shipment/sparse/anomalous regression fixtures deliberately vary isolated copies rather than changing the pinned baseline.

The generic analytics tool exposes only a curated subset of these tables and columns. It accepts one parsed and canonicalized `SELECT`, never control-plane tables or arbitrary database access. Money is stored in cents and should be divided by 100.0 and aliased with an `_eur` suffix for display.

Generated SQLite database, WAL, and shared-memory files are ignored by Git and excluded from Docker build contexts. A container image includes only the deterministic source fixtures; mount `/app/data` on writable persistent storage when running it.
