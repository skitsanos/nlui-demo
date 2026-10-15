# NLUI-023: Evaluate adversarial data, exact query scope and principal authorization

- Status: Closed
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/data/queryPolicy.ts; src/nlui; src/services; evaluation fixtures
- Evidence: Research roadmap migration

## Problem

The demo has no production principal/tenant boundary, and free-text data, exact AST fields and action supersession require stronger adversarial evaluation.

## Evidence and reproduction

Migrated research Direction 6. Pending actions currently deduplicate globally by order/action; NLUI-001 fixes JOIN structure but does not implement every AST column's published-field scope.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Seed prompt injection in descriptions/policies/support subjects/return reasons, track prose/tools/SQL/actions, label provenance and keep free text untrusted. Separate model summaries from UI payloads, evaluate read/action controllers and require fresh user action intent. Scope capabilities/supersession to durable principals; resolve every AST column to exact in-scope published fields, consider sanitized analytical views, classify sensitivity, add tenant canaries, per-turn/concurrency budgets and SQL fuzzing. Default traces to hashes/codes/durations/shapes/truncation/fallback, not keys/prompts/rows/free text.

## Acceptance criteria

- [x] Adversarial data cannot grant controller action authority or expose unpublished canaries; foreign anonymous-session artifacts/actions are denied. Shared business rows are not claimed tenant-isolated.
- [x] Bounded fuzz corpus covers comments/quoting/shadowing/nesting/CTEs/joins/offsets/Unicode with fail-closed resolution.
- [x] Scoped action ownership, finite budgets and redacted public observability have executable regressions.
- [x] No production authorization claim is made; authenticated principals remain outside the approved local-demo scope.

## Resolution

Exact AST column/alias/CTE scope resolution now enforces only published in-scope fields before/after canonicalization. Fresh explicit user action type/target, durable owner/conversation capability checks and scoped supersession prevent retrieved instructions or another session from granting mutation authority. Restricted-column canaries, seeded malicious free text, bounded SQL fuzzing, mutation-once retries, budgets and separate cookie-jar history/debug/preview probes are regression-tested.

See [adversarial qualification](reviews/2026-10-15-owned-workflows.md#adversarial-scope-and-capabilities-nlui-023), `src/data/queryFields.test.ts`, `src/nlui/adversarialScope.test.ts`, ownership/HTTP suites and public-stream projection tests. All 803 regressions plus source/compiled/container gates pass. This proves specified deterministic boundaries over the synthetic demo, not LLM prompt-injection immunity, authenticated tenancy, tenant-filtered business rows or a production security certification. The user explicitly approved anonymous local ownership instead of production identity integration.
