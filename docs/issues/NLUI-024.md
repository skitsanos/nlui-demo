# NLUI-024: Polish control lifecycle, accessibility and dataset onboarding UX

- Status: Open
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/client; src/routes/api/upload.ts; approved dataset-onboarding experiment
- Evidence: Research roadmap migration

## Problem

Supporting product UX still needs visibly submitted/superseded/expired/completed controls, richer chart/table interaction and approved upload-to-dataset onboarding.

## Evidence and reproduction

Migrated supporting product work. Confirmation retry, optional numbers, statistic context and form-spinner defects have distinct issues NLUI-011 through NLUI-014; durable history is NLUI-022.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Add lifecycle states and reconciliation, prompt-card keyboard semantics, accessible chart table alternatives/tooltips, table sorting/export, responsive empty/error states, and connect uploads only through an explicitly approved dataset-onboarding experiment.

## Acceptance criteria

- [ ] Control lifecycle and error recovery are readable and keyboard-operable.
- [ ] Charts have accessible data alternatives and tables stay internally scrollable at narrow widths.
- [ ] Onboarding validates data and permissions; upload success alone never makes data trusted or model-executable.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
