# NLUI-012: Normalize cleared optional numeric form values

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/nlui/formValues.ts; src/nlui/interactionCapabilities.ts; src/client/formSubmission.ts; src/client/components/DynamicForm.tsx
- Evidence: Normalization/capability tests; real client/HTTP/stream round trip; source/compiled processes; browser form submission

## Problem

Ant Design InputNumber emits null when cleared, but optional number capability validation accepts omission and rejects null.

## Evidence and reproduction

The reviewed client submits the raw form values; a cleared optional budget therefore produces an invalid interaction.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Canonicalize empty optional values to omission using the server-owned field contract, without relaxing required-field/type validation.

## Acceptance criteria

- [x] Clearing optional budget submits without an invalid-interaction error.
- [x] Required, wrong-type and tampered fields remain rejected.
- [x] Client and capability regressions cover the full round trip.

## Resolution

Added shared field-contract normalization for the form controller and the independently stored server capability. A null optional number becomes omission; exact numeric values, including zero, remain unchanged. Undefined issued fields follow JSON omission, while unknown keys remain rejectable. Required null/missing values, wrong types, ranges, extra/prototype-shaped keys and nonnumeric nulls are not accepted by this change. Client descriptor tampering cannot relax the server's required fields. Failed validation does not consume a valid capability.

Regression tests exercise normalization, controller payloads, the actual HTTP chat route/NDJSON consumer and source/compiled fixture processes. In the browser, clearing each real Ant Design InputNumber submitted successfully without the budget in the runner's received payload. A required empty field still prevented dispatch. All 439 tests/1410 expectations, lint/type checks and source/compiled 38-request HTTP runs pass. See [verification](reviews/2026-10-15-control-ux.md) and [desktop evidence](evidence/2026-10-15/control-ux-desktop.jpg).
