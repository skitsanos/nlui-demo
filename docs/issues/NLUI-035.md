# NLUI-035: Align unavailable-format fallback instructions and presentation eligibility before replication

- Status: Closed
- Priority: P2
- Kind: Research verification gap
- Created: 2026-10-16
- Updated: 2026-10-16
- Scope: Confirmatory presentation-selection protocol; no production defect or new provider budget implied
- Evidence: [provider-free v2 qualification](reviews/2026-10-16-fallback-contract.md), [frozen report](reviews/assets/2026-10-16-fallback-v2-report.json), [NLUI-034 live pilot](reviews/2026-10-16-selection-pilot.md) with all 32 original results

## Problem

The live pilot's baseline selected `message` for explicitly requested recorded-history and visual-policy explanations when the baseline catalog lacked the requested infographic kinds. The frozen oracle expected a table/source fallback. However, the shared instruction says to ask clarification with `message` when the requested format is incompatible. This creates ambiguity between **format unavailable but existing data renderable** and **scope/data incompatible**. It can disadvantage the baseline and confound two of the three apparent candidate-only passes. Choice-only outputs do not establish why the model selected a kind; do not infer a causal explanation or silently relabel the original results.

The third baseline miss (`missing-order`: message instead of informational result) also exposes a narrow, unvalidated UX label preference. It is not unsafe infographic behavior or a factual error. Those original three failures remain frozen and replay-tested.

## Proposed work

Before any replication, define a typed fallback contract distinguishing unavailable visual kinds from missing scope/evidence; decide when existing exact table/source views are acceptable, and review the message/result boundary on missing records. Align catalog/instructions and eligibility together, version/fingerprint the new protocol, test positive/negative cases and prevent golden eligibility from leaking into model inputs. Retain the original pilot unchanged; report any post-hoc sensitivity analysis separately. A new held-out/repeated live study requires a separately approved attempt cap; the current 32/32 and earlier 40/40 caps are exhausted.

## Acceptance criteria

- [x] Record reviewed fallback and missing-result contracts with explicit compatible/incompatible examples.
- [x] Align and version instructions/catalog/eligibility before observing replication results; add regressions for the conflict.
- [x] Preserve all original three misses and exclude the original pilot from confirmatory claims.
- [x] If a new live cap is approved, run the preregistered replication with durable accounting and keep provider/model/participant boundaries explicit; otherwise leave live verification pending. **No new cap was approved; live verification is explicitly pending and no provider calls were made.**

## Resolution

Closed for provider-free alignment on 2026-10-16. `presentation-fallback-v2` derives instructions, catalog descriptions and eligibility from one strict typed contract: unavailable visual kinds use faithful existing chart/table/full-source fallbacks; insufficient scope/evidence uses a message; verified record absence uses an informational result. Candidate eligibility also retains faithful existing fallbacks. The missing-result distinction is an explicit UX convention, not a human-preference claim.

The [review](reviews/2026-10-16-fallback-contract.md) records the complete decision table, frozen fingerprints, **25 new regressions / 993 expectations**, all **35 eligible reference choices across 16 development fixtures**, and limitations. Final complete checks pass **912 tests / 4,682 expectations**, lint/typecheck, source/compiled/container qualification and original live-output replay. All original three misses, 32 results, v1 protocol and exhausted 40/40 and 32/32 ledgers remain unchanged. Golden fixture facts/choices never enter model inputs.

**Live verification remains pending, not passed.** No provider requests, new budget, default renderer change, publication or deployment were performed. The original pilot is neither relabelled nor confirmatory evidence; NLUI-034 retains its inconclusive no-promotion decision. Any future held-out/repeated live study requires a separate preregistered plan and explicit new cap, not a reset or extension of either preserved ledger.

## Publication follow-up, 2026-10-16

The provider-free phase above is now published with separate authorization in **1.7.0**, `8446350366f2d8752f47d632a305a2b6e0c6c572`. All three jobs in [run 38869687421](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421) pass with **912 tests / 4,682 expectations** on both matrix platforms, static/offline/source/compiled/reference gates and Linux production-container qualification. [Publication evidence](reviews/2026-10-16-publication.md) records the exact jobs and unchanged protected files. No hosted failures required remediation and no provider calls were made. **Live v2 verification remains pending and unauthorized**, not a CI pass; frozen v1 results and no-promotion decisions remain unchanged. This registry/evidence-only follow-up bumps to 1.7.1 before its push and must pass its own full workflow.
