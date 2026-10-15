# NLUI-019: Expand the versioned semantic catalog and paired query experiments

- Status: Open
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
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

- [ ] Every metric has formula, grain, units, exclusions, valid time fields and allowed dimensions.
- [ ] Broader paraphrase/ambiguous cases expose meaningful differences without weakening capability boundaries.
- [ ] Promotion requires complete denotation/UI coverage, no regression and measured reliability benefit.
- [ ] Guarded SQL and the controlled renderer remain controls until evidence justifies a change.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
