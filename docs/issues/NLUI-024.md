# NLUI-024: Polish control lifecycle, accessibility and dataset onboarding UX

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/client; src/routes/api/upload.ts; approved dataset-onboarding experiment
- Evidence: Research roadmap migration

## Problem

Supporting product UX still needs visibly submitted/superseded/expired/completed controls, richer chart/table interaction and approved upload-to-dataset onboarding.

## Evidence and reproduction

Migrated supporting product work. Confirmation retry, optional numbers, statistic context and form-spinner defects have distinct issues NLUI-011 through NLUI-014; durable history is NLUI-022.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

NLUI-031's 2026-10-15 browser check also observed Ant Design 6.6.6's existing `List` deprecation warning in the policy-source renderer, recommending `Listy` before the next major version. The current source list renders successfully; this is a non-blocking compatibility/UX follow-up here, not a failure of the seven bounded presentation contracts. The fixture-server restart also produced an expected old-tab HMR disconnect message, not an application exception.

## Proposed correction

Add lifecycle states and reconciliation, prompt-card keyboard semantics, accessible chart table alternatives/tooltips, table sorting/export, responsive empty/error states, and connect uploads only through an explicitly approved dataset-onboarding experiment.

## Acceptance criteria

- [x] Control lifecycle and error recovery are readable and keyboard-operable.
- [x] Charts have semantic data alternatives; tables scroll internally with keyboard panning at narrow widths.
- [x] Approved template inspection validates data/owner access and always quarantines; upload success never grants query/model authority.

## Resolution

Added durable lifecycle/expiry rendering, native keyboard starters, chart-table alternatives, bounded table sorting/CSV export and actual inner-viewport keyboard scrolling. Analytical sorting stays parent-bound and traceable. Deprecated Ant Design List usage was replaced by semantic markup. CSV onboarding accepts only the approved aggregate template with bounded parsing, validation and owner-scoped quarantine; no activation endpoint or provider/query-schema registration exists.

Regressions cover lifecycle/interaction contracts, CSV formula safety and negative numeric preservation, sort deltas, real browser bundling, strict CSV/template/byte/row/key/type rules and foreign preview denial. Browser checks cover keyboard choices/confirmation, refresh mutation count one, desktop/mobile tables (390/390 page width), 25-row CSV download, visible two-row quarantine and readable exact refinement scope. See [UX and quarantine](reviews/2026-10-15-owned-workflows.md#lifecycle-accessible-data-and-quarantine-nlui-024) and its saved screenshots. All 803 tests and source/compiled/container gates pass. This closes the approved local inspection experiment, not arbitrary dataset activation, authenticated permissions or comprehensive accessibility certification.
