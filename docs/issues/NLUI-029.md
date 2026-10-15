# NLUI-029: Harden semantic-query v2 scope and owned presentation

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/data/semantic; src/nlui/semanticPresentation.ts; src/evals/queryExperimentPromotion.ts
- Evidence: Migrated historical completion and current deterministic checks

## Problem

The pilot incorrectly attached periods to lifetime counts and allowed inconsistent model-selected renderers.

## Evidence and reproduction

Historical 2026-07-31 unchanged nine-prompt corpus × two repeats × two arms: both control and v2 achieved 18/18 exact denotations, expected UI, first attempt and complete passes.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Separate lifetime registered totals from period-required registrations/active customers, canonicalize only provable no-ops and choose metric/line/bar/table rendering from trusted shapes.

## Acceptance criteria

- [x] Lifetime counts reject periods/month grouping; period metrics require observation windows.
- [x] Equivalent semantic plans share hashes; distinct meaning retains different hashes.
- [x] Promotion requires reliability improvement, not merely equal perfect results.

## Resolution

Historical v2 fixed all v1 scope/presentation failures, averaged 7.0% lower latency and 0.9% fewer tokens, and preserved the dataset fingerprint. A separate registrations smoke returned four for December 2025. Reliability promotion failed because both arms were perfect; retain SQL control. Current semantic/promotion regressions pass, but no new live comparison was run.
