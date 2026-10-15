# NLUI-026: Establish executable offline and opt-in live evaluation v1

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/evals; scripts/eval-offline.ts; scripts/eval-live.ts
- Evidence: Migrated historical completion and current deterministic checks

## Problem

Research needed reusable strict scenarios, trace/score/report contracts and explicitly bounded billable evaluation.

## Evidence and reproduction

Migrated completed Evaluation Harness v1; current offline/scenario/scorer/executor tests and the 35-scenario validator pass.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Reuse strict JSONL schema, offline command, opt-in scenario/category/repeat selection, expected/forbidden tools, emitted blocks, output/argument/usage/duration evidence and JSON/Markdown summaries.

## Acceptance criteria

- [x] Default validation is non-billable and deterministic.
- [x] Live selection is explicit and bounded.
- [x] Incomplete semantic evidence is not reported as full end-to-end coverage.

## Resolution

Historical v1 completion is preserved; current commands validate successfully. Remaining corpus/scoring/trace work is NLUI-016, not claimed completed by this issue.
