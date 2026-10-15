# NLUI-011: Preserve confirmation retries and reconcile ambiguous outcomes

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/client/components/Confirmation.tsx; src/client/confirmationController.ts; src/client/confirmationRequest.ts; src/client/chat.ts; src/client/useChat.ts; src/routes/api/actions.ts
- Evidence: Controller/transport/presentation regressions; real HTTP and SQLite replay tests; source/compiled process tests; rendered browser fixture

## Problem

Confirmation replaces actionable UI with an error result after action-request failure. Only failed chat continuation has a retry path.

## Evidence and reproduction

Source inspection during review found irreversible error replacement in Confirmation and a retry button only for chat continuation.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Distinguish definite domain rejection from uncertain network outcome. Retain retryable action/interaction IDs and reconcile using server idempotency.

## Acceptance criteria

- [x] A transient action-request failure leaves a usable retry control.
- [x] Retry does not execute the mutation twice.
- [x] Uncertain outcomes are explained separately from rejected actions.

## Resolution

Extracted the confirmation into a modular view/controller/transport boundary. Network failures, timeouts, unreadable/malformed responses and unknown server failures retain the original capability IDs and proposal details with an explicit Check result / retry control. Each action request has a 20-second client budget. Retries replay the same approved POST; they do not prepare a new action. Pending requests and chat continuations are single-flight. Cancel cannot race a pending or uncertain action.

The public action protocol now distinguishes known domain rejection, unavailable capability and unknown outcome, including a busy reservation. Success blocks are validated at both boundaries. If an uncertain request later encounters a rejection/unavailable capability, the UI keeps the ambiguity and directs order verification rather than claiming nothing changed. A completed action remains visible when chat continuation fails or throws; Continue chat resends only the UI result. Aborted/incomplete chat streams cannot be counted as completed interactions, and late events cannot advance a cancelled/reset response chain.

Added 50 regressions. All 379 tests/1238 expectations pass, with lint/type checks, offline catalog validation and 38 HTTP checks in each source/compiled runtime. Real HTTP/SQLite tests simulate a lost response after commit, an exception after commit and a disconnect before dispatch; every recovered case records exactly one durable mutation. The real browser fixture confirms recovery, chat-only retry, rejection, unavailable-after-unknown and cancellation presentation with no console warnings/errors. It reports two confirmation requests, two chat attempts and one mutation for recovery. See [verification and limitations](reviews/2026-10-15-confirmation-recovery.md) and [browser evidence](evidence/2026-10-15/confirmation-recovery.jpg).

Recovery remains bounded by the process-local capability lifetime. Expired/restarted capabilities do not bypass scope checks; the UI asks for manual order verification. Durable reload/history and ambiguous chat-event replay are separate NLUI-022 work. No paid provider call, commit or push was performed.
