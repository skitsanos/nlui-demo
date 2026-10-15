# NLUI-020: Run a controlled A2UI and Ant Design X Card experiment

- Status: Open
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/nlui/types.ts; src/client/components/NluiRenderer.tsx; experimental renderer adapter
- Evidence: Research roadmap migration

## Problem

Standards-based declarative UI may improve flexibility but could degrade consistency, accessibility and action integrity.

## Evidence and reproduction

Migrated research Direction 3; no adapter or new dependency is implemented or claimed as verified.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Keep current blocks as control, add X Card behind a flag and pin one A2UI version behind a domain-independent adapter. Validate a small owned text/metric/chart/table/choice/form/notice/button catalog, bindings/properties/actions and progressive surface/data/completion events. Preserve opaque actions and graceful fallback.

## Acceptance criteria

- [ ] Unknown/unsafe surfaces, URLs/endpoints/query fragments/validation or mutation names cannot execute behavior.
- [ ] Measure valid-render/repair rates, first useful UI/completion, token/latency cost and portability.
- [ ] Compare layout stability, keyboard/a11y behavior and action-integrity violations against current blocks.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
