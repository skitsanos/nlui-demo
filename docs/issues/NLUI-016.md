# NLUI-016: Complete deterministic evaluation coverage and trace accounting

- Status: Closed
- Priority: P2
- Kind: Verification gap
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/evals; scripts/eval-live.ts; data/scenarios.jsonl
- Evidence: 2026-10-14 repository review

## Problem

35 catalog specifications are not 35 executed end-to-end cases: 55 assertions remain ungraded, and multi-turn/route setup is incomplete.

## Evidence and reproduction

At the 2026-10-14 review, the offline validator reported 32 single-turn, one multi-turn and two route scenarios; 17 deterministic assertions, 25 rules and 55 ungraded assertions. That historical evidence did not establish complete end-to-end coverage.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

NLUI-006 established effective supported WHERE predicates, rejection of unrelated SELECT evidence and complete passing candidate deterministic evidence for promotion. It did not complete this issue's corpus/adapters, trace accounting or general expression semantics. Its historical offline counts were 17 assertions / 25 rules and 55 ungraded assertions.

A remaining units-grading gap was confirmed during that fix: a `projects_unit` assertion for `orders.total_cents` with divisor 100 still accepts `SELECT SUM(total_cents) + 1 / 100.0 AS revenue_eur FROM orders`. The divisor is in an unrelated branch rather than scaling the source amount. General derived-expression/unit and grain lineage belongs here; add adversarial denotation regressions before treating those checks as proof. See [the predicate milestone's limitations](reviews/2026-10-15-sql-predicate-grading.md).

## Proposed correction

Add isolated mutation/route and multi-turn adapters, broader paraphrases/ambiguity cases and null/refund/multi-payment/shipment/sparse/anomalous fixtures. Implement numerical-claim, units, forbidden-column/tool/mutation grading and promote failures to scenarios. Complete query/plan hashes, policy/repair outcomes, cancellation/timeout/empty/stream outcomes, and a versioned pricing source before estimated cost. Establish serial latency first, then bounded concurrency.

## Acceptance criteria

- [x] All assertions report executable grading or explicit unsupported status; no incomplete result can promote an arm.
- [x] Mutations and trajectories run against reset/isolated fixture state.
- [x] Supported numerical/safety/semantic/rendering assertions use deterministic evidence; language/visible-product claims without proof are explicitly unsupported. No uncalibrated model grader qualifies as deterministic evidence.
- [x] Reports preserve versions, hashes, latency, token/cost assumptions and repeated-run stability with safe redaction.

## Resolution

Closed with [fresh qualification and retained diagnostics](reviews/2026-10-15-deterministic-evaluation.md). All 77 labels are classified: 70 executable labels, 100 configured rules, seven explicit unsupported labels and zero unconfigured. Provider-free reference executions use real tools/renderers and owned route/trajectory adapters: 28 pass, seven remain incomplete, zero fail/error. These are plumbing checks, not 35 passing live-model evaluations. Remaining semantic qualification is explicitly tracked in [NLUI-031](NLUI-031.md); broader paraphrase/catalog expansion remains NLUI-019.

Whole-expression units/exact grain, numerical claims, collection/UI/safety/state checks and adversarial null/refund/multi-payment/shipment/sparse/anomalous fixtures have regressions. Per-run fixture fingerprinting, capability isolation, mutation-once route retries and same-conversation prerequisites leave retained data untouched. Failure checkpoints, provider/tool attempt outcomes, query/plan hashes, partial usage, versioned pricing validation, redaction and repeated-run stability are recorded. Promotion rejects incomplete, failed, stale or externally unverified evidence.

`bun run check` passes 597 tests / 1870 expectations across 73 files; Biome checks 223 files and TypeScript passes. Both HTTP suites pass all 38 requests. The compiled reference CLI executes all 35 cases without source/dependency fallback, discovering and fixing [NLUI-032](NLUI-032.md). No billable calls, retained-data reset, commit or push was performed.
