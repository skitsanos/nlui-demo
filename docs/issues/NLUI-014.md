# NLUI-014: Separate form submission progress from completed state

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/client/components/DynamicForm.tsx; src/client/formSubmission.ts; src/client/components/NluiRenderer.tsx
- Evidence: Submission state/race/presentation tests; failed HTTP response and edited retry; rendered browser checks

## Problem

DynamicForm uses one Boolean for locking and loading, leaving a successfully submitted button spinning indefinitely.

## Evidence and reproduction

The review traced the submitted flag into both loading and disabled behavior.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Model submitting, submitted and error states explicitly; lock accepted controls without a perpetual spinner.

## Acceptance criteria

- [x] Successful submission stops loading and remains visibly submitted.
- [x] Failure restores appropriate retry/edit behavior.
- [x] In-flight submission prevents duplicate requests.

## Resolution

Extracted DynamicForm and its controller. Idle, submitting, submitted and error states are explicit. Only submitting shows a spinner; accepted forms show Submitted with locked controls. False/throwing continuations show a safe interruption notice and preserve editable Ant Design form values. A synchronous controller guard and locked onFinish wrapper prevent same-tick/in-flight duplicates. State is stable for the issued interaction, and abandoned completions cannot overwrite a later retry.

Tests cover success, callback false/throw, duplicate requests, retained and edited values, stale completion and static state presentation. The actual chat-route round trip demonstrates a failed response releasing its claim for a corrected retry. Browser verification held requests in flight, observed disabled/loading controls, released a success without a spinner, then failed and edited/retried another form. Final DOM: zero loading buttons, both submitted buttons disabled; attempts were one for success and two for the failed-then-successful form. All 439 tests and other local gates pass. See [verification](reviews/2026-10-15-control-ux.md), [pending state](evidence/2026-10-15/control-form-pending.jpg) and [editable failure](evidence/2026-10-15/control-form-retry.jpg).

This does not add durable recovery after reload or reconcile a chat completion lost after server acceptance; that remains NLUI-022.
