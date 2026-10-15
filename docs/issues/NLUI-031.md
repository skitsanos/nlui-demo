# NLUI-031: Qualify the seven remaining language and visible-product assertions

- Status: Closed
- Priority: P2
- Kind: Verification gap
- Created: 2026-10-15
- Updated: 2026-10-15
- Scope: data/scenarios.jsonl; src/evals; product/form presentation; bounded policy-caption composition
- Evidence: [Presentation qualification](reviews/2026-10-15-presentation-qualification.md), provider-free regressions and desktop/mobile browser verification

## Problem

Seven of the 77 catalog assertion labels require evidence that is not supplied by retrieved records, tool selection or field presence alone. They are explicitly unsupported and make seven reference results incomplete. Treating those cases as passed would overstate semantic or visible-UI coverage.

## Evidence and reproduction

Baseline before this milestone: `bun run eval:offline` reported 70 executable labels, 100 configured rules, seven unsupported labels and zero unconfigured labels. The 35 real-tool/adapted reference cases produced 28 passed/seven incomplete. These were oracle executions, not live model results. The dated [NLUI-016 evidence](reviews/2026-10-15-deterministic-evaluation.md) is preserved.

The remaining assertions are:

| Scenario | Unproven assertion |
| --- | --- |
| products-laptop-travel | Battery hours and weight are shown to the user |
| products-compare-laptops | RAM and storage are shown to the user |
| products-design-monitor | Resolution is shown to the user |
| products-office-bundle | The form adequately asks about desk/device needs as well as budget |
| policy-address-change | The annotation does not offer an unsafe in-transit mutation |
| action-cancel-delivered-refusal | The delivered-order refusal is explained correctly |
| disambiguation-order | The form adequately asks for the intended outcome as well as order number |

Partial deterministic checks could not override an unsupported rule on the same label. That fail-closed behavior remains regression-tested for future unsupported labels. No uncalibrated external grader can satisfy the promotion gate. This is narrower than semantic-catalog expansion in NLUI-019, authorization in NLUI-023 or general UX polish in NLUI-024.

## Proposed correction

Prefer application-owned structured presentation and deterministic rendered evidence for product attributes and form requirements. For genuinely linguistic correctness, define human-reviewed positive/negative/paraphrase labels before proposing an explicitly opt-in grader. Measure false acceptance, false rejection and repeat agreement on held-out cases; document the reviewed threshold before qualification. Preserve unsupported/incomplete outcomes until the corresponding evidence is proven.

## Acceptance criteria

- [x] All seven named assertions have explicit executable criteria testing production-rendered facts/questions or exact application-owned policy language, not merely retrieved data or keywords.
- [x] Positive, negative, misleading and paraphrased regression cases cover the bounded criteria; rendered checks and fresh browser evidence cover attributes/form prompts.
- [x] No language grader was introduced. The two linguistic requirements are guaranteed by a finite application-authored caption contract; arbitrary paraphrases are unproven, not semantically graded. Human-calibrated held-out results would still be required before adding a general language grader.
- [x] Corpus classification, strict qualification/promotion version boundaries, manifest hashes and active documentation are updated; historical evidence and the reference/model distinction are preserved.

## Resolution

Closed on 2026-10-15. Product choice cards render SKU-bound typed specifications with application-owned labels/units. Home-office forms ask budget, desk/accessibility and device/connection questions; ambiguous order forms collect an order number and a required controlled intended outcome. Independent frozen criteria prevent a production label change from grading itself.

Trusted tool decisions constrain the final JSON-schema caption to registered wording for delivered-order cancellation and post-dispatch address changes. Runtime validation also enforces that contract, including provider-refusal bypass rejection before publication. Normal analytical annotations remain conversational. Tool intent selection remains model planning, and no arbitrary-language or live-model capability claim is made.

Fresh `bun --no-env-file run verify:all` passed: Biome 244 files, TypeScript, 717 tests/2181 expectations across 80 files, offline classification, 38 source and 38 compiled HTTP requests, exact 35/35 reference profiles in source/isolated compiled/container modes, and non-root production container health/permissions/shutdown. Browser checks covered all seven examples, 390px responsive product/form layout and real typed form submissions through the capability/chat boundary. See the linked review for fingerprints, diagnostics and limits. Existing ignored provider settings and retained data were not changed.

Release 1.5.0 was committed/pushed as `cc4c00d016dbc698d925e011699adb7311fcfc52`. All three jobs and commit check-runs in [hosted Qualification run 38727922140](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140) passed: Linux/macOS source-and-compiled checks each include 717 tests and both HTTP/reference modes, followed by the Linux production-container checks. No CI failures required a fix or waiver. This registry/evidence follow-up bumps to 1.5.1 before its own push; its hosted workflow is checked separately before handoff. No paid model call or deployment was performed.
