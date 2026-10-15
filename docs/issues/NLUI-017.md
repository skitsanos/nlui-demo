# NLUI-017: Document the sanitized public activity protocol

- Status: Closed
- Priority: P3
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: public/docs/architecture.md; public/docs/activity-protocol.md; src/services/publicChatStream.ts
- Evidence: 2026-10-14 repository review; 2026-10-15 maintenance qualification

## Problem

Architecture docs describe raw tool.started/tool.completed events although the public stream filters them out in favor of activity.updated.

## Evidence and reproduction

Documentation/source comparison in the review found this mismatch.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Describe public application-authored activity events separately from internal evaluation traces and provider events.

## Acceptance criteria

- [x] Documented public events match runtime types/filtering.
- [x] Examples do not disclose raw tool arguments, SQL, provider IDs or hidden reasoning.

## Resolution

The architecture and dedicated public activity protocol describe the six actual NDJSON events, application-authored activity, framing/upserts, cancellation/EOF, receipts and action boundaries. Safe examples omit internal tool data and provider identifiers. At the initial maintenance boundary the provider-continuation exception was documented explicitly; NLUI-022 subsequently replaced it with an application turn cursor, and the documentation/regression assertion now verifies that provider IDs do not cross the owned HTTP route.

Public envelope/activity properties are explicitly projected to omit unexpected diagnostics. Tests compare the documentation's event table to the runtime catalog, round-trip its examples and reject private/unknown event data. [Maintenance qualification](reviews/2026-10-15-maintenance-qualification.md) records the initial 727-test/source/compiled/container pass. [Owned-workflow publication](reviews/2026-10-15-owned-workflows.md#hosted-publication-and-ci-reconciliation) records later 812-test hosted qualification and the application-owned replay contract; no hidden-reasoning disclosure or complete AG-UI conformance is claimed.
