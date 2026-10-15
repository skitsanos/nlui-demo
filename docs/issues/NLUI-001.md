# NLUI-001: Require positive, in-scope foreign-key JOIN predicates

- Status: Closed
- Priority: P1
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/data/queryPolicy.ts; src/data/queryJoins.ts
- Evidence: Regression tests and isolated execution

## Problem

An AST fragment search accepted a second customer alias whose ON clause referenced only the first alias, and accepted inverted comparisons. A valid 1,500-order relationship became a 300,000-row or 298,500-row result.

## Evidence and reproduction

The 2026-10-14 isolated review reproduced both row-amplification queries. `src/data/queryJoins.test.ts` now covers old/future/implicit/duplicate aliases, negation, OR, CASE, function wrappers and legal relationships; `src/data/queryDataset.test.ts` checks execution against a disposable database.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Validate sources incrementally. Require a direct positive foreign-key equality involving the newly introduced alias and an earlier source; only AND conjuncts can establish the relationship. Reject disjunctions, subqueries and out-of-scope qualified references in ON.

## Acceptance criteria

- [x] Reject both reproduced row-amplification queries before worker execution.
- [x] Preserve reversed/parenthesized relationships, legal multi-joins, LEFT JOIN and bound parameters.
- [x] Validate input and canonicalized SQL and prove legal repeated-table joins return 1,500 orders.

## Resolution

Implemented a focused JOIN validator and regression tests. The full 210-test suite and production compilation pass; semantic compiler tests retain their parameterized-query behavior. See the [milestone verification](reviews/2026-10-14-safety-milestone.md). Exact field resolution remains separately scoped in NLUI-023.
