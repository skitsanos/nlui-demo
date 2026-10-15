# NLUI-010: Align observed fixture timestamps with the snapshot

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/data/generator; src/data/seed.ts; src/data/constants.ts; data/fixture-manifest.json; data/scenarios.jsonl; src/evals/snapshotFixture.test.ts; src/data/seedProcess.test.ts; src/nlui/toolTypes.ts; src/nlui/toolRuntime.ts; src/nlui/toolHandlers; tests/helpers/toolFixture.ts
- Evidence: 2026-10-14 repository review; [2026-10-15 resolution and verification](reviews/2026-10-15-snapshot-fixture.md)

## Problem

Observed events exist after the June 2026 reference instant, although model guidance treats that instant as the dataset snapshot.

## Evidence and reproduction

Fresh generation in the review included eight future delivered timestamps, two shipped timestamps, three return requests and one support-case creation. Expected-delivery forecasts may legitimately be future-dated.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Constrain observed timestamps, preserve forecast semantics, version the fixture and refresh affected golden denotations/fingerprints.

## Acceptance criteria

- [x] No observed event is later than the exact snapshot instant.
- [x] Forecasts can remain future-dated and date boundaries are explicit.
- [x] Versioned fixtures, hashes, semantic comparisons and deterministic results agree.

## Resolution

Fixture v2 (`nlui-retail-operations-v2`, dataset/SQLite version 2) moves an affected order's complete timeline backward by the excess of its latest observed event over the inclusive `2026-06-30T12:00:00.000Z` snapshot. Payment, shipment, return, support and forecast offsets move together; statuses, absent events, RNG consumption, counts and stable demo orders are retained. Forecasts do not trigger movement and 15 expected-delivery dates remain later than the snapshot.

A full generated-dataset validation replaces the final-order-only guard. Every observed field on every row is checked before opening/recreating the database. Regression tests scan all nine persisted observed timestamp columns and reject one-millisecond overruns in every generated observed field. The manifest pins the new logical baseline and both golden-file hashes; the catalog's dataset ID is updated. Existing registered-customer counts, latest gold registration and half-year eligible-revenue denotations are unchanged and rechecked in both query arms for all nine experiment fixtures.

The fixture version change exposed two existing tool/presentation test files using retained local storage. Server-only tool context now permits an explicitly owned repository/database dependency; those tests use separate seeded temporary databases. Model tool schemas cannot select a database path, cancellation is preserved, and fixture repositories are closed before cleanup. Runtime defaults are unchanged.

Verification: `bun run check` passes (528 tests, 1691 expectations across 66 files; Biome/TypeScript clean), including 24 added regressions and actual source/compiled seed CLI execution. All 38 source and 38 compiled HTTP checks pass. Offline validation reports the v2 fixture with zero catalog issues; no billable call was made. Retained v1 databases are refused, not migrated/reset; the local default remains v1. Upgrade instructions and limits are in the linked report and data documentation.
