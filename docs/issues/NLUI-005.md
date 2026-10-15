# NLUI-005: Require provider terminal completion before publishing a turn

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/services/openaiChatRunner.ts; src/services/openaiChat.ts
- Evidence: Injected provider streams; route state/retry regressions; macOS/Linux execution

## Problem

A provider stream ending after response.created and valid JSON but without response.completed can execute tools, issue capabilities and publish a successful response ID.

## Evidence and reproduction

The review's mock truncated stream succeeded and advanced the response chain without a provider completion event.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Track an explicit successful terminal event. Reject incomplete/failed/cancelled streams and recheck cancellation before tool execution, capability issuance and final publication.

## Acceptance criteria

- [x] Truncated streams never execute tools or advance response IDs.
- [x] Failed/cancelled terminal events and late aborts settle activity safely.
- [x] Completed tool and structured-output rounds retain current behavior.

## Resolution

Each provider round now requires an explicit `response.completed` event with a stable nonempty ID and no contradictory status. Created-only/JSON-only/tool-only streams, ID changes, non-successful completions, post-terminal events and disconnect exceptions cannot be treated as successful output. Cancellation is rechecked at stream, tool-execution and publication boundaries, including after an awaited tool. Provider cancellation settles safe activity as aborted.

The route also checks cancellation before committing the response chain, preserving the previous ID and releasing failed UI submissions for retry. New regressions cover completion/refusal success, earlier valid tool rounds followed by truncated composition, failed/incomplete/error/cancelled events, pre-abort and late-abort boundaries, scoped response IDs and UI-result recovery. All 250 local tests pass; all 40 new regressions also pass on Linux. No provider API requests were made. See [verification](reviews/2026-10-14-file-provider-boundaries.md). Finite deadlines and interruption/rollback of already-running work remain separately scoped in NLUI-009 and the durable-transport work.
