# NLUI-031: Qualify the seven remaining language and visible-product assertions

- Status: Open
- Priority: P2
- Kind: Verification gap
- Created: 2026-10-15
- Updated: 2026-10-15
- Scope: data/scenarios.jsonl; src/evals; product presentation and semantic language grading
- Evidence: NLUI-016 isolated provider-free corpus and explicit unsupported assertion records

## Problem

Seven of the 77 catalog assertion labels require evidence that is not supplied by retrieved records, tool selection or field presence alone. They are explicitly unsupported and make seven reference results incomplete. Treating those cases as passed would overstate semantic or visible-UI coverage.

## Evidence and reproduction

`bun run eval:offline` reports 70 executable labels, 100 configured rules, seven unsupported labels and zero unconfigured labels. `bun run eval:fixtures` executes all 35 cases with real tools and isolated adapters: 28 pass and seven are incomplete. These are oracle/reference executions, not live model results. See [NLUI-016 evidence](reviews/2026-10-15-deterministic-evaluation.md).

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

Partial deterministic checks remain attached where useful, but cannot override an unsupported rule on the same label. No uncalibrated external grader can satisfy the promotion gate. This is narrower than semantic-catalog expansion in NLUI-019, authorization in NLUI-023 or general UX polish in NLUI-024; it is not a duplicate of those milestones.

## Proposed correction

Prefer application-owned structured presentation and deterministic rendered evidence for product attributes and form requirements. For genuinely linguistic correctness, define human-reviewed positive/negative/paraphrase labels before proposing an explicitly opt-in grader. Measure false acceptance, false rejection and repeat agreement on held-out cases; document the reviewed threshold before qualification. Preserve unsupported/incomplete outcomes until the corresponding evidence is proven.

## Acceptance criteria

- [ ] All seven named assertions have reviewed, executable criteria that test the actual visible or linguistic claim, not merely retrieved data or keywords.
- [ ] Positive, negative, misleading and paraphrased regression cases establish each criterion; rendered checks cover attributes/form prompts where relevant.
- [ ] Any language grader is calibrated against human labels with recorded held-out results and approval criteria; it is never silently classified as deterministic.
- [ ] Corpus classifications, promotion rules, manifest hashes and documentation are updated without rewriting historical evidence or treating reference runs as model qualification.

## Resolution

Pending. The seven labels remain explicitly unsupported, their results incomplete and ineligible for promotion. No live model or calibrated semantic-grader evidence was produced by NLUI-016.
