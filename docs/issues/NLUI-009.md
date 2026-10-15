# NLUI-009: Bound request duration and shutdown grace periods

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/routes/api/chat/index.ts; src/server/lifecycle.ts
- Evidence: Real HTTP timeouts; provider/tool/worker aborts; source/compiled SIGINT/SIGTERM/WebSocket process tests; Linux

## Problem

Chat disables socket idle timeout and graceful shutdown has no deadline; stalled streams can leave a process alive indefinitely.

## Evidence and reproduction

An isolated server remained alive after SIGTERM until its unfinished response was externally closed.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Add finite request deadlines and a shutdown grace period, propagate aborts to provider/tool execution, then force-close remaining connections after grace.

## Acceptance criteria

- [x] A stalled stream is cancelled within a bounded request budget.
- [x] SIGTERM/SIGINT complete within a documented grace period.
- [x] Healthy streams finish during grace without duplicate terminal events.

## Resolution

Added validated YAML limits and decimal environment overrides: chatRequestTimeoutMs defaults to 120000 (1..600000) and shutdownGracePeriodMs to 5000 (1..60000). Zero never disables protection. Chat's application budget covers cancellable, byte-limited body reading, provider setup/iteration and tools. Stalled bodies return 408; a streaming timeout sends one safe error and closes without committing a response ID. Cancellation reaches SQL workers. Timers/listeners are disposed, failed UI submissions are released, and late background results cannot overwrite a successful retry. A finite transport idle bound remains in place as well.

Shutdown stops new connections, closes tracked WebSockets with 1012, drains healthy HTTP work, and force-stops after grace; repeated signals share one shutdown. Tests exercise real source/compiled processes under both SIGINT and SIGTERM, healthy drains, socket closure, invalid boot limits and stalled chat deadlines. All local checks (329 tests), source/compiled 38-request smoke runs and 85 targeted Linux tests pass. The packaged Docker server returned 408 after approximately 205 ms for an unfinished body with a 200 ms budget. See [verification and limitations](reviews/2026-10-15-action-lifecycle.md). Cancellation does not preempt synchronous JavaScript or roll back committed work; other endpoints retain their existing bounds.
