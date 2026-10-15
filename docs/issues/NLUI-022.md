# NLUI-022: Persist replayable provider-neutral conversation events

- Status: Open
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
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

- [ ] Refresh/reconnect replay is ordered, idempotent and does not repeat mutations.
- [ ] Interrupted tool calls and UI submissions reconcile explicitly.
- [ ] Provider and transport adapters can change without rewriting domain/NLUI contracts.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
