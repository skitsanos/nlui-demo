# NLUI-017: Document the sanitized public activity protocol

- Status: Open
- Priority: P3
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: public/docs/architecture.md; src/services/publicChatStream.ts
- Evidence: 2026-10-14 repository review

## Problem

Architecture docs describe raw tool.started/tool.completed events although the public stream filters them out in favor of activity.updated.

## Evidence and reproduction

Documentation/source comparison in the review found this mismatch.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Describe public application-authored activity events separately from internal evaluation traces and provider events.

## Acceptance criteria

- [ ] Documented public events match runtime types/filtering.
- [ ] Examples do not disclose raw tool arguments, SQL, provider IDs or hidden reasoning.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
