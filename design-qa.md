# Design QA: Welcome prompt hover border

- Source visual truth: `/var/folders/v2/x4zbz9nd10lf_kqzhpm4r84w0000gn/T/codex-clipboard-2571d04b-b44e-4e6e-ad2b-0c8741e08fe8.png`
- Browser-rendered implementation: `/Users/skitsanos/.codex/visualizations/2026/07/30/019fb2f3-5cdf-7172-86d9-1a2a8b2bbe25/nlui-hover-after.png`
- Normalized implementation crop: `/Users/skitsanos/.codex/visualizations/2026/07/30/019fb2f3-5cdf-7172-86d9-1a2a8b2bbe25/nlui-hover-after-normalized.png`
- Full comparison: `/Users/skitsanos/.codex/visualizations/2026/07/30/019fb2f3-5cdf-7172-86d9-1a2a8b2bbe25/nlui-hover-comparison.png`
- Focused border comparison: `/Users/skitsanos/.codex/visualizations/2026/07/30/019fb2f3-5cdf-7172-86d9-1a2a8b2bbe25/nlui-hover-border-detail.png`
- State: first starter card hovered.
- Capture viewport: 1586 x 814 CSS px at device pixel ratio 2.
- Source dimensions: 1586 x 814 px, representing an approximately 793 x 407 CSS-pixel crop at 2x density.
- Normalization: implementation viewport crop `793 x 407 +483 +199` was scaled to 1586 x 814 so source and implementation show the same content region and density.

## Full-view comparison evidence

The welcome composition, grid dimensions, typography, iconography, copy, spacing, radii, fills, and shadow treatment remain aligned with the source. The only intentional difference is the repaired top border on the hovered first card.

## Focused comparison evidence

The left side of `nlui-hover-border-detail.png` shows the source defect: the rounded corner strokes remain visible, but the straight top edge is clipped. The right side shows the revised state with a continuous one-pixel lavender border across the full top edge.

Browser automation did not expose a persistent CSS `:hover` state from pointer movement. For visual capture only, the final hover declarations were mirrored onto the first card with a temporary CSS selector and then removed. Final source and production inspection confirmed that the shipped `:hover` rule contains the same declarations, has no transform, and preserves Ant Design X's horizontal overflow behavior.

## Findings and comparison history

### Pass 1

- P2, first-row prompt card: `translateY(-1px)` moved the card above Ant Design X's overflow scrollport, clipping its straight top border.
- Fix: removed physical translation, retained the border and shadow emphasis, and added a smooth transition for border, background, and shadow.

### Pass 2

- Post-fix evidence: the hovered card remains at the list's top coordinate, reports zero clipped pixels, and renders a continuous top border.
- No remaining P0, P1, or P2 findings.

## Required fidelity surfaces

- Fonts and typography: unchanged from the source; hierarchy, weights, wrapping, and line heights are preserved.
- Spacing and layout rhythm: unchanged; removing the transform prevents movement without altering card dimensions, gaps, or radii.
- Colors and visual tokens: existing neutral fill, lavender hover border, and purple shadow are preserved.
- Image quality and asset fidelity: no raster assets changed; existing icon components remain intact.
- Copy and content: unchanged.

## Interaction and production checks

- Hover styling preserves the full rounded border and retains a visible focus-state selector.
- Four prompt cards render in the production executable.
- Production browser console: no warnings or errors.
- `bun run check`: 14 tests passed, 53 assertions.
- `bun run compile`: succeeded across 3303 modules.

## Follow-up polish

- P3: Ant Design X currently renders prompt items as clickable `div` elements, so keyboard focus semantics would require a separate component-level accessibility pass.

final result: passed
