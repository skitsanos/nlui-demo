# NLUI-013: Display statistic block titles and descriptions

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/client/components/StatisticsBlock.tsx; src/client/components/NluiRenderer.tsx; src/client/styles.css
- Evidence: Product/order render tests; unique ARIA references; desktop/mobile screenshots and DOM geometry

## Problem

The stats renderer ignores title and description, hiding product identity or order context in follow-up summaries.

## Evidence and reproduction

A React static-render probe in the review confirmed both descriptor fields were absent from rendered output.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Render semantic headings and concise descriptions while preserving the established metric layout and accessible grouping.

## Acceptance criteria

- [x] Product and order summary titles/descriptions appear in rendered output.
- [x] Metric labels/values are unchanged.
- [x] Desktop/mobile rendering and accessible heading structure are verified.

## Resolution

Added an application-owned StatisticsBlock renderer with an h3 title and optional descriptive paragraph above the existing metric cards. Each group has unique useId-based heading/description associations, with Summary statistics as the untitled fallback. Metadata stays escaped text. Metric labels, values, formatters, suffixes, trend cards and temporal-card behavior are preserved. Responsive minimum widths are bounded by the available width, and metadata wraps.

Regressions verify actual NLUI rendering, all labels/values/date/currency formats, unique associations for repeated titles/IDs, untitled groups and escaped metadata. Browser verification used product/order records from the existing seed in a disposable database: both headings and descriptions were visible, with an h1/h2/h3 hierarchy in the fixture and valid unique associations. Default desktop displayed four metric columns; at 375px the groups used two 162.5px columns within 335px, with document width equal to viewport width (no horizontal overflow). All 439 tests and other local gates pass. See [verification](reviews/2026-10-15-control-ux.md), [desktop](evidence/2026-10-15/control-ux-desktop.jpg) and [mobile](evidence/2026-10-15/control-ux-mobile.jpg).

This verifies the affected components and their grouping, not whole-application accessibility conformance (NLUI-024).
