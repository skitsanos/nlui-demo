# Action errors and bounded lifecycle — 2026-10-15

Scope: NLUI-008 and NLUI-009. Existing dependency upgrades and earlier milestone edits are preserved. No commit, push, version bump or branch operation is requested or performed.

## Changes

- Domain rejections now have application-authored codes and fixed safe messages. Capability failures return 400; supported business rejections return 409. Unexpected exceptions, including non-Error payloads and invalid completion results, return a generic 500 without provider/SQL/filesystem diagnostic text. Reservations are still released for retry and completed results remain idempotent.
- Operator action diagnostics contain an incident ID, error category and bounded stack locations, not exception text. Configured key/model values are redacted even if a custom stack embeds one. A broken diagnostic sink cannot break the public error response.
- YAML server limits default to a 120000 ms chat application deadline and a 5000 ms shutdown grace. CHAT_REQUEST_TIMEOUT_MS and SHUTDOWN_GRACE_PERIOD_MS override them; malformed, zero, negative, fractional and oversized values fail before binding. Allowed ranges are 1..600000 and 1..60000 milliseconds respectively.
- Chat owns cancellable, byte-limited UTF-8 body reading, preserving the existing maximum request-body setting. An unfinished body returns 408. During NDJSON streaming, expiry emits one safe error and closes the stream without completion or response-chain advancement. UI-result claims and in-flight state are released once; late work cannot overwrite/release a successful retry. Timers and parent-signal listeners are disposed on completion/cancellation/error.
- Provider creation, iterator reads and tool waits are abortable even when an injected dependency ignores cancellation. Signals reach both query arms and terminate running read-only SQL workers. Synchronous work is checked against elapsed wall time before public output; this is not JavaScript CPU preemption.
- Chat retains a finite transport idle timeout (rounded to seconds, capped at 255) rather than setting zero. The absolute application budget and native idle bound serve different purposes.
- Shutdown stops new connections, sends tracked WebSockets code 1012, and drains healthy HTTP responses. A hard grace timer force-stops remaining connections and exits even if stop never settles. Repeated signals share the same drain/deadline. Expected signal/forced shutdown exits 0; shutdown failures exit 1.
- README, public setup docs and configuration comments document limits and orchestrator coordination. New fixture/helper TypeScript is linted. No test endpoint or injected provider is added to production discovery.

## Verification

| Check | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3; existing 240 installs across 266 packages accepted with no dependency changes |
| `bun run check` | Biome checks 166 files; TypeScript passes; 329 tests, 1096 expectations, zero failures across 49 files |
| Added regression coverage | 79 new tests beyond the previous 250-test milestone |
| `bun run eval:offline` | 35 specifications; 17 assertions/25 rules graded; 55 still ungraded; zero catalog issues |
| `task test` | 38 HTTP requests pass against the isolated source server |
| `task test:compiled` | Production compilation and the same 38 HTTP requests pass |
| Process fixture matrix | Both source and compiled: safe 500/409 action HTTP responses, invalid-limit startup rejection, stalled-connection SIGINT and SIGTERM bounds, healthy HTTP draining plus WebSocket 1012, and stalled-chat timeout; 12 cases total |
| Docker | Production image builds, runs healthy as UID 1000 on Linux/arm64; 85 targeted regressions/222 expectations pass, including the source/compiled process matrix and actual SQL-worker cancellation |
| Packaged-server body timeout | With a 200 ms application budget, the actual Docker server returns safe HTTP 408 for an unfinished streamed JSON body in approximately 205 ms, before any provider invocation |
| Config overrides | Docker /api/config reports the supplied 200 ms chat deadline and 500 ms shutdown grace; no credential/model values are exposed |
| Packaging | Ignored credentials, registry and test files are excluded from the image; test sources are copied only into the disposable running container for Linux qualification |
| Hygiene | `git diff --check` passes; all 30 issue IDs, index rows, statuses, closure criteria and index links validate; 99 changed/untracked files contain zero configured key/model values; `.env` and TODO.md remain ignored |

Action regressions include all 12 domain codes, modified exception messages, forged error names, unknown Error/object/string failures, diagnostic-sink failures and capability errors. A disposable SQLite test confirms that an injected failure after commit, a retry and a capability replay leave exactly one mutation in activity_log.

Deadline regressions include stalled body/provider setup/iterator/tool/runner, caller and reader cancellation, byte limits with multibyte UTF-8, healthy timer/listener cleanup, deadline expiry during synchronous work, retryable UI results, and late completion after a newer turn succeeds. SQL tests stop an actual recursive worker on cancellation and execute a healthy subsequent query; pre-cancelled queries do not create databases.

## Retained development diagnostics

- Early lint/type diagnostics covered import order, an unused catch parameter and a WebSocket open callback returning send's numeric value instead of void. They were corrected before the clean checks.
- An initial worker regression compared an identity matcher before the asynchronous abort had assigned its reason. It now asserts the exact explicit caller-owned AbortError, and the worker termination/next-query behavior passes.
- The existing provider-cancellation test expected a later private provider exception message. Abortable waiting intentionally gives the caller's cancellation priority; the test now asserts the exact explicit caller reason and still verifies sanitized aborted activity.
- Adding a healthy transport test exposed shared conversation state in two later fixtures. Each fixture now owns its registry; the full suite passes without weakening the assertions.

## Limits and disposition

NLUI-008 and NLUI-009 are closed. The authoritative registry contains 30 issues: 13 Closed and 17 Open. Client confirmation retry UX remains NLUI-011; these changes establish the safe backend retry behavior, not that UI.

No paid model call or live provider request was made. Provider/tool behavior uses injected fixtures; process, HTTP and SQL-worker behavior is executed. Existing ignored credentials are reused without replacement or disclosure. Windows, production deployment, authenticated tenancy and new browser visual acceptance are not claimed. The 35-specification offline validator is not complete live end-to-end coverage.

The chat budget applies to chat application work, not every inherited endpoint. Native transport inactivity and shutdown grace additionally bound stalled connections; a slow client making progress is not a fixed total TCP-transfer guarantee. Cancellation does not preempt synchronous JavaScript, guarantee cleanup by every arbitrary third-party iterator, or roll back committed mutations. Orchestrator termination grace must exceed the configured application grace. SIGKILL/power loss cannot be drained.

Owned processes and fixture directories were cleaned by their test harnesses. The disposable Docker container stopped successfully and was removed; the exact verification image tag was removed afterward. Existing development servers, uploads and databases were not cleanup targets. Next bounded work: NLUI-011 confirmation retry and ambiguous-result reconciliation.
