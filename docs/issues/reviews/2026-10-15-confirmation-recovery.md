# Confirmation recovery — 2026-10-15

Scope: NLUI-011. Earlier milestone edits and the user's dependency upgrades are preserved. No commit, push, version bump or branch operation is requested or performed.

## Resolution

- The confirmation card no longer becomes an irreversible error result on action-request failure. A modular controller retains conversation/interaction/action IDs, proposal details and retryable uncertainty. The manual Check result / retry control sends the same already-approved POST, not a new proposal or a read-only status lookup. The server replays the recorded completion or finishes that original action once.
- Client transport validates success blocks and structured failure outcomes. Network exceptions, invalid JSON, unexpected payloads/status combinations, server failures and timeouts remain uncertain; arbitrary diagnostic text is never shown. A 20-second timer covers both headers and response parsing and is disposed with the parent abort listener.
- Application-authored outcomes distinguish `rejected` (known domain failure), `unavailable` (invalid/expired capability) and `unknown` (unexpected failure or an executing reservation). HTTP status alone is not rollback evidence. A retry that loses access to its capability remains uncertain and asks for order verification rather than claiming no change.
- Confirmation and chat continuation are separate states. A false/throwing/cancelled continuation cannot overwrite a successful action. Continue chat resends only the typed UI result. Confirm/retry/cancel and continuation are single-flight; cancellation is unavailable after submission starts or while the outcome is unknown. Unmount/reset aborts pending transport and ignores late results, including after a newer retry succeeds.
- The chat consumer now requires an actual completion event: abort, a quiet incomplete stream, or even an empty-message error cannot mark an interaction consumed. Cancelled/stale useChat requests cannot advance the response-chain ref. Malformed/aborted streams release/cancel their reader.
- NluiRenderer now imports the extracted confirmation component. Newly extracted production modules stay below 300 lines. No provider/model-generated error, executable content or new production endpoint is added. The documented browser fixture and its synthetic database are outside production routing and excluded from Docker.

## Verification

| Check | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3; 240 installs across 266 packages checked without dependency changes |
| `bun run check` | Biome checks 177 files; TypeScript passes; 379 tests/1238 expectations across 54 files, zero failures |
| Added tests | 50 beyond the previous 329-test milestone: HTTP response boundary, controller races/retries, presentation, chat-stream completion and real SQLite/HTTP reconciliation |
| `bun run eval:offline` | 35 specifications; 17 assertions/25 rules graded; 55 remain ungraded; zero catalog issues |
| `task test` | All 38 HTTP requests pass against the isolated source server |
| `task test:compiled` | Production compilation (3486 modules) succeeds; all 38 HTTP requests pass against the binary |
| Source/compiled process checks | The existing 12-case process matrix passes with the new explicit 500/409 action outcome contract |
| Real HTTP / SQLite | Disconnect before dispatch, response loss after commit and exception after commit all recover using identical IDs; activity_log contains exactly one mutation for each action; completed capability replay also works after its UI result is consumed |
| Browser | Actual React/Ant Design confirmation component in StrictMode: unreadable post-commit response -> usable retry -> recovered success -> failed chat continuation -> chat-only retry; counters remain two action requests/two chat attempts/one mutation |
| Browser edge cases | Known domain rejection, unavailable capability after an uncertain attempt, and decline before dispatch all render correctly; cancellation sends no action request; no console warnings/errors observed |
| Hygiene | All 30 permanent IDs, statuses/index rows, closed acceptance criteria and issue/report links validate; configured-value scan finds zero key/model matches across 118 changed/untracked files; `.env`/TODO.md remain ignored and `git diff --check` passes |

[Rendered confirmation states](../evidence/2026-10-15/confirmation-recovery.jpg) are from the disposable fixture, not a live provider conversation. The expired-after-uncertain browser case uses an injected unavailable response; real capability scoping remains covered by registry/route tests. The real browser and SQLite mutation evidence uses the existing seeded synthetic data, not retained application state.

## Development diagnostics retained

Initial type checks caught an overly narrow literal fallback, Bun fetch's extra `preconnect` property in test stubs, widened test literals, a missing chat-event messageId, and a fixture fetch return type that allowed undefined. Those were fixed with correctly typed adapters/fixtures. Biome caught one import/export separator. All final gates above passed afterward; no earlier failed check is represented as passing.

## Limits and disposition

NLUI-011 is closed with all three acceptance criteria verified. Registry: 30 issues, 14 Closed and 16 Open. Next bounded UI work is NLUI-012 (cleared optional numeric fields), then NLUI-013/014.

No paid model call or live provider request was made. No new Linux/Docker, Windows, production deployment, tenancy or full-application browser acceptance is claimed in this milestone. The frozen install preserves existing dependency choices; no upgrade was needed for these changes.

Capability state remains process-local and expiring. A lost capability cannot be revived by retry, and a page reload does not restore local controller state. The UI explicitly asks for order verification when reconciliation is unavailable. Durable history and ambiguous chat-event replay remain NLUI-022; this work never retries a committed mutation through chat. Existing server/SQLite idempotency is preserved, not replaced with a new distributed transaction guarantee.

The manual fixture's loopback server and exact owned temporary database were removed after browser verification; the temporary browser tab was closed. Existing development servers, retained databases and uploads were not cleanup targets. Browser screenshot evidence is retained in the registry.
