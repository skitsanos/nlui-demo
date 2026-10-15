# NLUI-022: Persist replayable provider-neutral conversation events

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/services; src/client/chat.ts; src/data/schema.ts
- Evidence: Research roadmap migration

## Problem

Conversation/UI/tool state is not durable across refresh, reconnect or interrupted streams, and provider chaining is part of the current controller.

## Evidence and reproduction

Migrated research Direction 5 and conversation-history product work; current single-process in-memory state is a demo limitation.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Add application conversation IDs and a versioned SQLite append-only event log with sequences, request/turn/tool/plan/block IDs, idempotency and replay cursors. Rebuild client state by replay, resume/reconcile interruption and isolate provider/controller integration. Compare owned history with provider-managed chaining; add AG-UI run/step/text/tool/activity/state/interrupt adapter without binding domain contracts to protocol versions.

## Acceptance criteria

- [x] Refresh/reconnect replay is ordered, idempotent and does not repeat mutations.
- [x] Interrupted tool calls and UI submissions reconcile explicitly.
- [x] Provider/transport adapters are separate from domain/NLUI contracts; bounded AG-UI replay is explicitly not complete protocol conformance.

## Resolution

Added separate versioned private SQLite state, hashed anonymous-session ownership, append-only sequences, stable request/input idempotency, head/concurrency limits, paginated replay, durable capabilities/results and client restoration. Abandoned runs become interrupted, uncertain confirmations reconcile through durable idempotent actions, and refresh cannot repeat work. The HTTP provider path uses bounded owned history/store=false and application continuation IDs; managed chaining remains an isolated evaluation control. AG-UI projects safe run/text/custom events without coupling domain schemas or claiming SSE/full conformance.

Real store restart, paginated replay, foreign-owner denial, request conflicts, stalled-body/turn cleanup, actual provider-adapter request-shape and transport regression tests are executable. Browser reload preserved submitted choices and completed confirmation with mutation count still one. See [owned workflow resolution, evidence and limits](reviews/2026-10-15-owned-workflows.md#durable-ownership-and-replay-nlui-022). All 803 regressions and source/compiled/container gates pass. Anonymous single-process isolation is not production identity, tenancy or distributed recovery.
