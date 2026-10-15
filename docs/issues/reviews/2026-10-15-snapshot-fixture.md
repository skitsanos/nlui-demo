# Snapshot-aligned fixture v2 — 2026-10-15

Scope: NLUI-010. Existing pending milestone edits and dependency upgrades are preserved. No commit, push, project-version bump, branch operation, retained-data reset or live provider call was requested or performed.

## Reproduction and resolution

A fresh pre-fix seed reproduced future observed timestamps, including fields omitted from the original review's short list:

| Field | Future values before | Future values after |
| --- | --- | --- |
| customers.joined_at | 0 | 0 |
| orders.created_at | 0 | 0 |
| orders.updated_at | 2 | 0 |
| payments.paid_at | 0 | 0 |
| shipments.shipped_at | 2 | 0 |
| shipments.delivered_at | 8 | 0 |
| returns.requested_at | 3 | 0 |
| support_cases.created_at | 1 | 0 |
| support_cases.updated_at | 1 | 0 |
| shipments.expected_delivery_at (forecast, not observed) | 21 | 15 |

The snapshot remains exactly `2026-06-30T12:00:00.000Z`, inclusive, not the end of the calendar day. Fixture v2 uniformly shifts an affected order's complete lifecycle backward by the amount its latest observed timestamp exceeds the snapshot. Order creation/update, payment, dispatch/delivery, return, support creation/update and any expected-delivery forecast all retain their relative offsets. Forecasts do not determine that shift and are not independently clamped. No records, statuses or monetary amounts are removed/rewritten, and no new random choices are consumed.

`validateDatasetSnapshot` checks every row of every observed field, including customer registration, nullable payment/dispatch/delivery timestamps and support updates. Invalid/missing required values and future timestamps are rejected. Validation and policy loading complete before the seeding path opens/recreates a database. The old guard inspected only the last generated order's creation date; it is removed.

## Fixture identity and denotations

- Dataset ID: `nlui-retail-operations-v2`; dataset metadata and SQLite `user_version`: 2. Seed and exact reference timestamp are unchanged. This is a dataset fixture revision, not a project package-version bump.
- The [fixture manifest](../../../data/fixture-manifest.json) pins dataset identity, seed, snapshot, both golden-file SHA-256 values and logical baseline fingerprint `271d123d9e803ffe18941ecd189bf6303b816f9d42ad4faba6bb0f093f1c7502`. Logical hashes include table contents/metadata, not SQLite physical page bytes. Two fresh seeds and source/compiled seed CLIs match it.
- The general scenario's expected dataset ID is updated. Registered customers remain 200; tiers remain standard 140 / silver 40 / gold 20; the latest gold registration remains 14 Dec 2025, 12:00 UTC. Half-year eligible revenue by tier remains EUR 386395.72 / 108087.20 / 47689.52, in that order. Changed recent timestamps remain within June, preserving these period aggregates.
- The nine existing experiment specifications retain their `semantic-query-v1` identity and unchanged expected denotations. Experiment specifications, semantic catalog version 2, presentation policy version 1 and dataset version 2 are distinct version domains. Tests execute guarded SQL and parameterized compiled semantic queries, use production rendering and deterministic grading, and recheck all nine specifications in both arms without a model. This is not a new live paraphrase/planning or A/B performance result.
- Historical live artifacts and review records were not rewritten. They are not newly qualified v2 evidence; rerun before making a current model or promotion claim.

## Test isolation

The initial whole-suite run failed 17 tool/presentation tests because they used the retained default v1 database. Refusing that incompatible fixture was correct; resetting the user's database to make tests pass was not performed.

`ToolDataSource` is an internal server-owned context carrying an explicitly selected path/repository. It is not in provider schemas or user/model JSON. Specialized tools resolve that repository, and SQL/semantic workers use the same explicit path. Production calls without that context keep their existing defaults. The two test files now own separate temporary seeded repositories and close them before deleting only their owned directories. A regression verifies the injected v2 scope, rejection of model-supplied path arguments, absence of paths from model output and unchanged cancellation behavior.

## Verification

| Gate | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3; 240 installs across 266 packages checked, no dependency changes |
| `bun run check` | Biome checks 199 files; TypeScript passes; 528 tests / 1691 expectations across 66 files, zero failures |
| New regressions | 24 tests beyond the previous 504-test milestone, in three new test modules |
| Generated timestamps | Every observed field checked; one-millisecond overrun rejected in each; exact instant accepted; required invalid/null/missing values rejected |
| Lifecycle consistency | Uniform one-millisecond shift across all lifecycle and forecast fields, preserved status/value/null semantics, idempotence, and order/payment/dispatch/delivery/return/support chronology checks |
| Forecasts | Processing order ORD-1176 keeps future expected delivery and null dispatch/delivery/payment events; 15 persisted forecasts exceed the snapshot |
| Persisted fixture | All nine observed timestamp columns scanned from SQLite schema; no future or invalid observed timestamps; deliveries/returns exactly at the cutoff remain included |
| Manifest / baseline | Metadata, SQLite version, repeated logical fingerprint, golden-file hashes and expected catalog ID match v2; isolated action preparation is detected as a baseline mutation and explicit fixture reset restores the pinned hash |
| Source / compiled seed CLI | The real `scripts/seed.ts` and its compiled binary create v2 in owned paths; a second invocation reuses it without reset and preserves the pinned fingerprint |
| Guarded SQL / semantic arm | All three case definitions and nine paraphrase fixtures match in both provider-free arms, including production block selection and deterministic denotation/UI/first-attempt assertions; query/plan hashing is repeatable |
| Retained-data safety | A legacy fixture with a local edit is refused by ensure/evaluation inspection with unchanged physical file hash, user_version and retained edit; the actual default database is still v1 on read-only inspection |
| `bun run eval:offline` | 35 specifications against fixture v2; 17 assertions / 25 rules; 55 assertions still ungraded; zero catalog issues |
| HTTP checks | All 38 source and 38 compiled requests pass; production build bundles 3491 modules |
| Modularity | New production snapshot module is 78 lines; affected modules stay below 400 lines |
| Hygiene | All 30 issue IDs/status rows, open priority totals and 99 relative registry/review links validate; zero configured key/model matches across 168 changed/untracked files; `.env`, TODO.md, retained SQLite and compiled output remain ignored; `git diff --check` passes |

## Retained diagnostics and limits

The initial seed-process test passed at runtime but TypeScript correctly rejected an imprecise subprocess stream type. Explicit piped stream typing, ignored stdin and bounded child waits fixed the harness. The initial full run was 510 passed / 17 failed due to retained-database coupling; after fixture isolation, the complete gate above passed. These diagnostics are retained rather than represented as an uninterrupted clean run.

This fixes observed-event cutoff consistency, not every conceivable business realism constraint, complete general SQL/units semantics, all 35 live end-to-end scenarios, or production/tenancy safety. Remaining numerical/scoring, trajectory/route adapters, trace accounting and expression lineage stay in NLUI-016. No UI change/browser acceptance or new Docker/Linux/Windows evidence is claimed for this milestone. No configured key/model values are written to evidence.

## Disposition and local upgrade

NLUI-010 is closed against its three acceptance criteria. Registry: 30 permanent issues, 19 Closed and 11 Open. Next bounded direction: NLUI-016, followed by CI qualification in NLUI-015.

The actual retained `data/demo.sqlite` is still fixture v1. It was not migrated or reset, so the new application will correctly refuse data-backed operations against it. Back up local mutations you wish to keep before explicitly running `bun run reset:data` to rebuild the default v2 baseline. Alternatively, seed an explicitly chosen new path and use that same path in repository/query callers. See [data documentation](../../../data/README.md) and [getting started](../../../public/docs/getting-started.md). No writable database-path choice is exposed to the model.

Temporary source/compiled databases, binaries, repositories and smoke fixtures are cleaned by their owned harnesses. Existing development servers, retained data/uploads and ignored provider configuration are not cleanup targets.
