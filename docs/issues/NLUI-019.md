# NLUI-019: Expand the versioned semantic catalog and paired query experiments

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/data/semantic; src/evals/queryExperiment.ts; scripts/eval-query-ab.ts
- Evidence: Research roadmap migration

## Problem

The bounded semantic v2 arm is successful but has not shown a reliability gain over the unchanged guarded-SQL control corpus.

## Evidence and reproduction

NLUI-028 and NLUI-029 preserve the historical pilot/v2 results. Earlier Direction 2 unchecked implementation boxes are superseded by that completed work, not reopened.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Expand entities/relationships, typed dimensions/enums/synonyms/sensitivity/display metadata and canonical measures, including merchandise revenue and refunds. Generate tool guidance, compilation, rendering and docs from the catalog. Compare fixed-only, guarded SQL, semantic and hybrid arms by denotation, business definitions/grain/joins/filters/units, repairs, tokens, latency/cost and presentation stability.

## Acceptance criteria

- [x] Every metric has formula, grain, units, exclusions, valid time fields and allowed dimensions.
- [x] Paired paraphrases distinguish merchandise/order grain and refund/request time without weakening capabilities.
- [x] Promotion still requires complete denotation/UI coverage, no regression and measured reliability benefit; no candidate was promoted.
- [x] Guarded SQL and the controlled renderer remain controls.

## Resolution

Catalog v3 adds line-grain merchandise revenue and completed refunds, generated metadata/guidance/docs, typed dimensions and approved relationships. Independent hand-calculated SQLite fixtures verify grain, joins, units, exclusions and time fields. The four-arm, four-prompt pilot qualified guarded SQL/semantic/hybrid at 4/4 each; fixed-only had no exact generic-query qualification. No reliability gain was established, so the control remains. Timing/token results, four format failures, partial usage accounting, unpriced monetary cost and the exhausted 40-request budget are recorded in [bounded research](reviews/2026-10-15-remaining-research.md#nlui-019-catalog-v3-and-paired-query-pilot). This is not a statistically powered or broad ambiguous-intent study.

Regression coverage: `src/data/semantic/expansion.test.ts`, existing semantic/predicate suites and `src/research/research.test.ts`. Fresh [integration qualification](reviews/2026-10-15-owned-workflows.md#fresh-executable-gates): 803 tests, source/compiled HTTP, exact references and production container pass. Local only; no current hosted qualification is claimed.
