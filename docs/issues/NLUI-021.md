# NLUI-021: Add artifact-aware analytical refinements and provenance

- Status: Open
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
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

- [ ] Refinements produce deterministic plan deltas and unambiguous referent resolution.
- [ ] Measure completion time/turns, reformulation/correction and detection of mismatched filters versus chat-only.
- [ ] Receipts match exact applied semantics without exposing unrestricted data.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
