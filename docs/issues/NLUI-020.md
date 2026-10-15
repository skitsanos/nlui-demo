# NLUI-020: Run a controlled A2UI and Ant Design X Card experiment

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/nlui/types.ts; src/client/components/NluiRenderer.tsx; experimental renderer adapter
- Evidence: Research roadmap migration

## Problem

Standards-based declarative UI may improve flexibility but could degrade consistency, accessibility and action integrity.

## Evidence and reproduction

At migration, research Direction 3 had no adapter or verified dependency. The implementation and bounded results below supersede that historical state.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Keep current blocks as control, add X Card behind a flag and pin one A2UI version behind a domain-independent adapter. Validate a small owned text/metric/chart/table/choice/form/notice/button catalog, bindings/properties/actions and progressive surface/data/completion events. Preserve opaque actions and graceful fallback.

## Acceptance criteria

- [x] Unknown/unsafe surfaces, URLs/endpoints/query fragments/validation or mutation names cannot execute behavior.
- [x] Valid-command/actual-render acceptance, repairs, buffered first-useful/completion, token/latency and bounded portability recorded; cost remains explicitly unpriced.
- [x] Owned layout/data, keyboard alternatives/choices and action-integrity boundaries compared with controlled blocks; no general accessibility advantage claimed.

## Resolution

Pinned X Card 2.9.0 and A2UI v0.9 behind `?renderer=a2ui`, with a domain-independent strict owned-catalog adapter, exact issued bindings/actions, bounded graph/progressive updates and controlled fallback. Model envelopes remain buffered. Initial provider-schema failures are retained; the corrected pilot produced 4/4 valid surfaces with zero repair requests. One matched block-selection control was smaller/faster, but n=1 cannot establish a general advantage. The default renderer is unchanged.

Browser verification caught and fixed the SDK's root-data binding incompatibility. The actual X Card/production renderer now has an isolated DOM regression, plus graph/action/schema tests and browser keyboard/chart/choice/fallback evidence. See [experiment results and limits](reviews/2026-10-15-remaining-research.md#nlui-020-controlled-a2uix-card-experiment), `src/nlui/a2ui/adapter.test.ts`, `src/client/xcardSafety.test.ts` and [fresh full gates](reviews/2026-10-15-owned-workflows.md#fresh-executable-gates). No universal standards conformance, production action expansion or renderer promotion is claimed.
