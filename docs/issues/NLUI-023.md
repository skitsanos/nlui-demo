# NLUI-023: Evaluate adversarial data, exact query scope and principal authorization

- Status: Open
- Priority: P2
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
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

- [ ] Adversarial data cannot grant action authority or leak tenant canaries/restricted fields.
- [ ] Fuzz comments/quoting/shadowing/nesting/CTEs/joins/offsets/Unicode with fail-closed scope resolution.
- [ ] Action ownership, query budgets and redacted observability are executable regressions.
- [ ] No claim of production authorization is made before authenticated principal tests pass.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
