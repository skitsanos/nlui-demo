# NLUI-008: Sanitize unexpected action errors at the public boundary

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/routes/api/actions.ts; src/data/actionErrors.ts; src/services/publicActionError.ts; src/nlui/actionErrors.test.ts
- Evidence: Typed/unknown exception regressions; durable SQLite retry; source/compiled HTTP; Linux execution

## Problem

Unexpected action exceptions are returned verbatim as public 409 diagnostics, unlike the generic chat error boundary.

## Evidence and reproduction

An injected internal exception containing a filesystem path appeared unchanged in the review's public response.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Preserve safe typed domain rejections but return a generic public error/status for unexpected failures; retain private operator diagnostics.

## Acceptance criteria

- [x] Filesystem paths, provider data and unexpected exception messages never reach action responses.
- [x] Known domain failures remain useful to users.
- [x] Regression tests exercise injected failures and idempotent confirmation behavior.

## Resolution

Added application-owned ActionDomainError codes and fixed public messages. Capability rejections remain safe 400 responses, recognized business rejections return 409, and unknown failures return a generic 500 rather than exception text. Operator diagnostics retain an incident ID, error category and stack locations, omitting exception text and redacting configured credential/model values. Diagnostic-sink failure cannot bypass the public boundary.

Regressions cover arbitrary Error/non-Error payloads, forged names, modified typed-error messages, all supported domain codes, retry reservations and an actual SQLite mutation committed before an injected failure: retry/replay leaves exactly one activity-log mutation. Source/compiled HTTP tests exercise both generic 500 and typed 409 cases. The 329-test local suite and 85 targeted Linux tests pass. See [verification](reviews/2026-10-15-action-lifecycle.md). Client confirmation retry UX is still NLUI-011.
