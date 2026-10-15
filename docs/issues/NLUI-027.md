# NLUI-027: Establish structured annotations and internally scrollable table UX

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/services/structuredResponse.ts; src/client; src/nlui/schemas.ts
- Evidence: Migrated historical completion and current deterministic checks

## Problem

Raw timestamps, duplicate prose/table values, dry block-only replies and narrow wrapping tables reduced the usefulness of analytical responses.

## Evidence and reproduction

Migrated completed structured-response/table milestone and date-format progress. Current structured-response, formatting, chart and renderer tests pass; original roadmap records desktop/mobile sales and delayed-order visual checks.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Require concise schema-constrained annotations, keep trusted values in blocks, format dates/UTC instants, render annotation before full-width internally scrollable tables and anchor replies at their start.

## Acceptance criteria

- [x] Tables/known records are not repeated as prose lists.
- [x] Dates are readable without losing exact timestamps.
- [x] Annotations remain conversational and tables scroll within cards.

## Resolution

Preserved historical completion; deterministic renderer/structured-output checks pass now. No new visual acceptance or billable model run is claimed this turn.
