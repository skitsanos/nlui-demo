# Effective SQL predicate grading — 2026-10-15

Scope: NLUI-006. Existing prior milestone changes and dependency upgrades are preserved. No commit, push, version bump or branch operation was requested or performed.

## Resolution

- Shared `queryPredicateProof` examines Boolean implication, not the presence of an equality/exclusion fragment. For a supported atom to hold whenever WHERE is true, AND needs one proving conjunct and OR needs both branches. Each excluded value is proven independently, so split inequalities work without combining evidence from disjoint alternatives. Direct equality/inequality operands can be swapped.
- Only direct supported atoms count. Negation, CASE, nested comparisons, function-wrapped predicates, nonliteral IN lists and subqueries cannot manufacture proof. Time-field filter checks use the same implication rule with direct comparisons or literal lists/ranges. A valid time-field filter is not proof of a particular requested date window.
- `queryScope` resolves visible aliases against published table columns. Qualified identifiers must belong to that alias; unqualified identifiers must have exactly one schema owner. Unknown/ambiguous references and physically repeated tables that an assertion cannot distinguish are unproven.
- `inspectDatasetQuery` exposes the validated canonical output SELECT. All semantic inspection is scoped to that SELECT, and expression walks do not enter nested SELECTs. An unused CTE cannot supply join, time, grain, units or exclusion evidence for the returned rows. CTE-backed lineage is intentionally unsupported for proof; runtime CTE execution and the existing guarded SQL acceptance boundary are unchanged.
- Missing, malformed and policy-rejected SQL fails equality grading without aborting the evaluation run. Predicate proof and denotation remain independent: neither is silently substituted for the other.
- Promotion adds a complete passing deterministic-evidence gate for every candidate run. Experiment aggregation no longer marks a run complete when an additional required assertion is ungraded. Missing legacy evidence also fails closed. Existing arm-neutral semantic-query fixtures still reject SQL-only assertions; this is not a new SQL requirement for semantic-query plans.

## Regression evidence

- Positive cases: reordered AND operands, swapped equality/inequality operands, supported backtick/qualified double-quoted identifiers, unique unqualified columns in joins, nested alternatives that all preserve the required constraint, existing relationship joins and monthly grouping aliases.
- Negative cases: `OR 1 = 1` in either position, partially constrained OR branches, NOT, CASE, comparisons of predicates to zero, function wrappers, wrong literal values, unrelated subqueries/CTEs, unsupported CTE lineage, unknown aliases, wrong-table or ambiguous columns, and repeated-table identity ambiguity. Existing raw ambiguous-double-quote and unsupported NOT-function policy rejections remain intact.
- Actual read-only workers query a disposable copy of the existing synthetic seed. Gold-customer scope returns 20, while the OR/NOT/CASE variants fail both predicate and exact-denotation assertions. The equivalent swapped revenue inequalities match the reference result; ineffective revenue exclusions fail both checks.
- A nonempty `COUNT(DISTINCT region)` restricted to West returns one with both a gold filter and a broadened gold-or-all filter. The broad version passes denotation but fails predicate grading. Those evaluated results flow through statistics into a promotion-consumer regression: all other gates pass, but incomplete deterministic evidence retains the control. This is a unit/integration fixture, not an executed live semantic-query A/B experiment.
- Missing/non-string/malformed SQL and unsupported lineage produce failed assertions, not thrown evaluation runs. Separate regressions cover incomplete and missing/legacy promotion evidence.

## Verification

| Gate | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3; 240 installs across 266 packages checked, no changes |
| `bun run check` | Biome checks 194 files; TypeScript passes; 504 tests / 1534 expectations across 63 files, zero failures |
| Added regressions | 65 tests beyond the previous 439-test milestone; three new test modules plus promotion/experiment cases |
| `bun run eval:offline` | 35 specifications; 17 assertions / 25 rules; 55 assertions remain ungraded; zero catalog issues |
| `bun run test:http` | All 38 isolated source HTTP requests pass |
| `bun run compile` and compiled smoke | Production binary builds (3491 modules); all 38 isolated HTTP requests pass |
| Modularity | New production proof/scope modules are 71 and 55 lines; affected modules stay below 400 lines |
| Hygiene | All 30 permanent IDs/status rows and 94 relative registry/review links validate; configured-value scan finds zero key/model matches across 150 changed/untracked files; `.env`, TODO.md and compiled output remain ignored; `git diff --check` passes |

## Retained development diagnostics

- Before the fix, a direct read-only reproducer passed `tier = 'gold' OR 1 = 1`. A follow-up also reproduced unary NOT, nested comparison and CASE false positives. `NOT(...)` function syntax was already policy-rejected and remains so.
- The first promotion unit run failed because its old positive fixture omitted the newly required deterministic statistics. The fixture now supplies those statistics, and explicit missing/legacy fixtures assert rejection.
- Initial Biome checks caught import ordering; TypeScript caught an overbroad `unknown[]` denotation fixture type. Imports and fixture cell types were corrected. Final full checks above passed afterward.

## Disposition and limits

NLUI-006 is closed against its three acceptance criteria. Registry: 30 permanent issues, 18 Closed and 12 Open. Next bounded milestone: coherent snapshot fixtures (NLUI-010), then remaining evaluation work (NLUI-016) and CI qualification (NLUI-015).

This is a conservative, sound positive-proof subset, not complete SQL equivalence or contradiction/constant simplification. Valid but unsupported formulations (including singleton-IN equality, De Morgan rewrites, transformed time filters and CTE lineage) can be rejected as unproven. Proof that a filter is required does not prove nonempty results, intended period, correct aggregation, units or all output lineage; denotation remains necessary.

General projection/unit and grain-expression semantics remain NLUI-016. A read-only reproducer confirmed that its existing unit assertion accepts `SUM(total_cents) + 1 / 100.0` even though the amount is not converted; this finding was deduplicated into that existing issue, not claimed fixed here. Historical scores from the fragment-based grader must not be treated as newly qualified evidence; rerun/regrade before future promotion. No stored live evaluation history was rewritten.

No paid model/provider calls, browser/UI changes, new Linux/Docker/Windows qualification or production acceptance are claimed. Source/compiled smoke and regression harnesses use owned temporary fixtures and clean them afterward. Existing development servers, retained databases/uploads and ignored provider configuration were not cleanup targets.
