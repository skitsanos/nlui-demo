# NLUI-006: Grade effective SQL predicates rather than matching fragments

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/data/queryPolicy.ts; src/data/queryScope.ts; src/data/queryPredicateProof.ts; src/evals/sqlSemantics.ts; src/evals/deterministicAssertions.ts; src/evals/queryExperiment.ts; src/evals/queryExperimentPromotion.ts
- Evidence: 2026-10-14 repository review; [2026-10-15 resolution and verification](reviews/2026-10-15-sql-predicate-grading.md)

## Problem

Semantic grading passes exclusions or equality filters even when OR 1 = 1 makes them ineffective, producing false promotion evidence.

## Evidence and reproduction

The review reproduced passes for status NOT IN ('cancelled', 'returned') OR 1 = 1 and tier = 'gold' OR 1 = 1.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Use conservative Boolean implication analysis for required predicates and denotation regressions. Resolve scope and avoid treating negation, nested branches or unrelated SELECTs as proof.

## Acceptance criteria

- [x] Ineffective OR/NOT/CASE predicates fail deterministic grading.
- [x] Legitimate operand order, quoting and required AND predicates pass.
- [x] Promotion decisions fail closed for unprovable evidence.

## Resolution

Shared conservative Boolean implication replaces fragment walks for WHERE equality, exclusions and time-field filters. AND needs a proving conjunct; OR needs proof on every branch. Only direct supported atoms establish facts; negated, CASE-wrapped, function-wrapped and subquery predicates do not. Exclusions are proven independently for every required value, including swapped inequalities and split conjunctions.

Evidence is bound to the output SELECT and its visible, schema-resolved table aliases. Unknown/ambiguous columns, unrelated SELECTs, unsupported CTE lineage and indistinguishable repeated-table instances cannot establish proof. Valid CTE execution remains supported by the unchanged runtime policy. Invalid SQL becomes a failed deterministic assertion rather than aborting evaluation.

Promotion now requires complete passing deterministic evidence in every candidate run, not just denotation/UI/first-attempt metrics and a better pass rate. Ungraded required assertions and legacy comparisons missing that evidence fail closed. Semantic-query fixtures remain arm-neutral; SQL-only assertions are not newly imposed on that arm.

Verification: 65 added regressions; `bun run check` passes (504 tests, 1534 expectations, 63 files; Biome and TypeScript clean). Existing seeded SQLite data demonstrates wrong denotations for OR/NOT/CASE decoys and coincidentally correct aggregates with unproven scope. All 38 source and 38 compiled HTTP checks pass; offline catalog validation has zero issues. No billable calls, UI changes or retained-data mutations. See the linked report for conservative-proof limits and remaining NLUI-016 work.
