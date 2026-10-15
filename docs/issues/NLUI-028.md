# NLUI-028: Complete the semantic-query A/B pilot and retain the control

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/data/semantic; src/evals/queryExperiment.ts; data/experiments/semantic-query-v1.jsonl
- Evidence: Migrated historical completion and current deterministic checks

## Problem

A typed plan might improve correctness and consistency over guarded model SQL, but promotion needed paired denotation and semantic evidence.

## Evidence and reproduction

Historical 2026-07-31: nine paraphrases × two repeats × two arms, 36 bounded calls. Control: 18/18 denotation, 16/18 first attempt, 14/18 renderer, 12/18 complete. Semantic v1: 16/18 denotation, 17/18 first attempt, 6/18 renderer, 5/18 complete. Six control revenue queries passed 30/30 semantic checks.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Build a versioned typed pilot catalog, strict plan schema, parameterized compiler and plan hashes; compare against unchanged SQL with scalar/row/series denotation and join/time/grain/unit/exclusion grading.

## Acceptance criteria

- [x] Retain the SQL control when the arm regresses.
- [x] Convert lifetime-range and presentation failures to regressions.
- [x] Preserve the baseline, hypotheses, versions and paired-report provenance.

## Resolution

Historical decision: keep guarded SQL. Semantic v1 used about 19.1% fewer tokens and was 2.8% faster but failed lifetime scope and presentation. Original ignored artifacts: eval-results/semantic-query-v1-repeat2-summary.md and matching JSON. Results are archived evidence, not freshly rerun or a pricing claim.
