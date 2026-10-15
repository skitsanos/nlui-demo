# NLUI-021: Add artifact-aware analytical refinements and provenance

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/data/semantic; src/nlui; src/client
- Evidence: Research roadmap migration

## Problem

Follow-up analysis currently relies on paraphrasing rather than refining a versioned analytical object directly.

## Evidence and reproduction

Migrated research Direction 4; the current activity receipt is not a persisted plan/result identity or full analytical provenance contract.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Assign immutable planId/resultId, retain dataset/metric/dimension/filter/time/sort context per conversation and accept typed plan deltas. Add controlled filter/date/group/top-N/metric/drill-down controls. Keep full results server-side with bounded model summaries. Show dataset/snapshot, metric definition, filters/grouping, grain/time, row count/truncation/quality warnings and query/plan hashes; SQL only in explicit debug view.

## Acceptance criteria

- [x] Refinements produce deterministic deltas bound to exact owned parent result IDs.
- [x] Bounded machine/protocol completion, turns, correction and mismatch detection compared with the live chat control; measurement boundaries and lack of human reformulation evidence explicitly recorded.
- [x] Receipts match exact applied semantics without exposing unrestricted data.

## Resolution

Implemented immutable artifacts and typed metric/group/filter/date/top-N/order refinements through explicit provider-free Explore/refine controls. Context is retained, ambiguous/foreign/stale parents fail closed, actual data revisions differ from declared seed identity, and analytical sorting creates a new receipt. Full bounded results/SQL stay private; explicit owner-scoped debug is separate from readable public scope/provenance.

The four-case × five-repeat machine benchmark passed 20/20 exact receipt checks and detected 20/20 mismatched-filter canaries, with one typed submission, zero model turns and zero correction requests per refinement. The live guarded-SQL control passed 4/4 with eight provider requests and zero rejected-tool repairs. Backend-only typed timing excludes human selection/network; **no causal human time/reformulation improvement or participant study is claimed**. See [measurements and limits](reviews/2026-10-15-remaining-research.md#nlui-021-analytical-artifacts-exact-scope-and-machine-benchmark).

`src/analysis/artifacts.test.ts`, source/compiled owner/debug/refinement/replay probes and browser West-only scope verification cover the behavior. [Full qualification](reviews/2026-10-15-owned-workflows.md) passes 803 tests and source/compiled/container gates. This closes the implemented artifact contract and bounded protocol study, not a future human usability experiment.

### Hosted contention follow-up

Reopened after release 1.6.1 [run 38748715543](https://github.com/skitsanos/nlui-demo/actions/runs/38748715543/job/116469110313) exposed `SQLITE_BUSY` while reading a refinement's data revision on macOS; Linux passed. Query workers published results before closing their connection, while the revision reader had no busy wait. Worker responses now return only after connection cleanup, and read-only revision hashing uses the same finite 250 ms lock wait as query execution. Regression tests cover close-before-publish success/rejection/error outcomes and real separate-worker transient/persistent lock contention. Reclosure requires corrected hosted qualification; no blind retry or disabled assertion substitutes for the fix.

Installed Bun documentation confirms that default `close(false)` defers release while uncached `prepare()` statements remain alive. Worker execution and dataset seeding therefore use `close(true)` to finalize every statement immediately. Native regressions retain a worker statement and assert it cannot execute after the response, and switch a freshly seeded database out of WAL mode without GC or a lock wait. This completes the cleanup guarantee rather than relying only on the revision reader's finite timeout.

Reclosed after release 1.6.3 at `3b1150ca3fd6edbf1970d598eb4bc50b2ead476e`: [run 38750393451](https://github.com/skitsanos/nlui-demo/actions/runs/38750393451) passed all three hosted jobs. Linux/macOS each pass 812 tests / 2,624 expectations, source/compiled HTTP and exact 35-case references; the Linux production-container gate also passes. The affected ten-test group passed twenty local repetitions (200 passes / 920 expectations), and a separate Linux probe passes the same native cleanup/lock cases. [Publication evidence](reviews/2026-10-15-owned-workflows.md#hosted-publication-and-ci-reconciliation) retains both initial failures and the corrected runs; no check was waived.
