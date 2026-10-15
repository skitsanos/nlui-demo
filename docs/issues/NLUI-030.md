# NLUI-030: Establish observable activity and selective provenance receipts

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/services/chatActivity.ts; src/services/publicChatStream.ts; src/client/chatActivity.ts; src/client/components/ActivityPresentation.tsx
- Evidence: Migrated historical completion and current deterministic checks

## Problem

The assistant needed useful progress/provenance without presenting private hidden reasoning or raw internal traces.

## Evidence and reproduction

Migrated completed 2026-07-31 Think/ThoughtChain milestone. Original verification covered scalar, chart, table, expanded receipt and cancellation; current activity/stream/reducer/accessibility tests pass.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Use Think for application-authored live activity, ThoughtChain for selective completed artifact/multi-tool/action/failure/abort receipts, stable owned IDs and safe labels; hide prompts/SQL/tool arguments/provider IDs/unrestricted data.

## Acceptance criteria

- [x] Simple prose and single metrics stay uncluttered.
- [x] Failures/cancellation settle observable activity without diagnostic leaks.
- [x] Receipt disclosure is keyboard-operable with explicit assistive status text.

## Resolution

Historical completion and visual evidence are preserved; current deterministic tests pass. Public-protocol documentation drift is separately tracked as NLUI-017.
