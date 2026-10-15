# NLUI-025: Establish server-verified interaction capabilities

- Status: Closed
- Priority: P1
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/nlui/interactionCapabilities.ts; src/nlui/interactionCapabilityValidation.ts; src/data/actions.ts
- Evidence: Migrated historical completion and current deterministic checks

## Problem

Choices/forms/confirmations must be server-issued capabilities before their behavior can be evaluated safely.

## Evidence and reproduction

Migrated completed Phase 0. Current capability and action tests cover invented IDs, extra/missing fields, altered values, replay, expiry, cross-conversation use and idempotency.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Keep a scoped registry for exact kind/fields/values, expiry, single-use state and optional action scope; canonicalize ui_result before model input and bind confirmations to conversations.

## Acceptance criteria

- [x] Unknown/tampered/replayed/expired/cross-conversation submissions are rejected.
- [x] Confirmations are scoped and idempotent.
- [x] Real principal authorization remains explicitly separate production work.

## Resolution

Recorded complete in the original roadmap; current deterministic capability/action tests pass in the 210-test suite. Historical live evidence is not rerun this milestone. See the [archived roadmap](reviews/2026-10-14-roadmap-migration.md).
