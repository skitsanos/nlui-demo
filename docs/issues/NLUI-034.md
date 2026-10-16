# NLUI-034: Evaluate presentation selection and visual-explanation benefit

- Status: Closed
- Priority: P2
- Kind: Research milestone
- Created: 2026-10-15
- Updated: 2026-10-16
- Scope: Matched presentation benchmark and completed 32-attempt selection-only pilot; not end-to-end or participant qualification
- Evidence: [Deterministic/rendered review](reviews/2026-10-15-presentation-selection.md), [live pilot and all results](reviews/2026-10-16-selection-pilot.md), replay regressions and source/compiled/container checks

## Problem

Valid structured output and a rendered picture do not establish that the assistant selected a useful or faithful representation. The prior A2UI and typed-refinement pilots do not establish human comprehension or productivity gains. Do not promote a candidate from those machine-only results.

## Proposed experiment

Keep controlled prose/scalar/table/chart as the baseline; compare bounded infographic candidates on identical verified content. Include single facts, row lists, temporal trends, binary comparisons, recorded timelines and conditional policy explanations, plus ambiguous, missing, adversarial, empty and incompatible inputs. Record inappropriate decoration, omitted conditions, misleading time/size/causality, exact denotation, readable fallback, mobile/keyboard usability, latency and serialized/bundle bytes. Preserve annotations without duplicate rows.

NLUI-033 establishes deterministic prerequisites, not model-selection or participant results. The user separately authorized a fresh **32-attempt selection-only pilot on 2026-10-16**; it is now complete and exhausted, independent of the earlier exhausted forty-attempt cap. Any further provider evaluation needs a new explicit cap. Human task time, correctness and reformulations require an explicitly scoped participant study and matched measurement boundaries.

## Acceptance criteria

- [x] Freeze versioned matched cases and representation eligibility, including negative cases where an infographic is wrong.
- [x] Verify exact values, dates, units, filters, ordering and policy conditions independently of renderer validity.
- [x] Report controlled baseline versus candidate selection errors, repairs, fallbacks and measured performance with attributable accounting. All 32 actual choices, three frozen baseline misses, complete usage and timing boundaries are preserved; protocol ambiguity prevents promotion.
- [x] Separate deterministic/rendered evidence, live model behavior and human comprehension; preserve failures and inconclusive results.
- [x] Record a justified promotion/no-promotion decision and synchronize the registry.

## Resolution

### Approved live phase, 2026-10-16

The user explicitly authorized a **new, separate 32-attempt paired selection-only pilot**, reusing ignored provider configuration. The earlier 40-attempt ledger remains exhausted and unchanged. Sixteen frozen tasks receive one request per arm, alternating AB/BA order; the candidate adds only three infographic kinds. Both arms receive identical verified data, without oracle labels/rationales/annotations. Strict JSON returns one renderer enum, not regenerated SQL, data, captions or UI trees. No automatic retries or replacement calls; reserve durably before sending, preserve sanitized request/response/result files, reconcile interrupted responses without sending again, and retain unknown usage as unknown. The configured model was verified against the user's requested value without printing it; persisted evidence uses an alias and fingerprint. All 32 requests completed; the protocol/dependency/input plan was frozen before execution.

### Deterministic/rendered phase

Completed the **deterministic/rendered evaluation phase** first, with an interim **no-promotion** decision; the separately authorized live phase below now completes the bounded milestone. `presentation-v1` freezes sixteen hand-labelled tasks and three eligible infographic alternatives, raw SQLite/full-policy oracles, task-fit grading distinct from schema validity, 39 wrong-infographic negative controls and 24 semantic-error canaries. Both authored reference arms preserve exact content on 16/16 tasks; the grader rejects every negative control and detects every canary. Reference outcomes are not model accuracy, a new production classifier or evidence that all alternative layouts outside the frozen contracts are wrong.

The independent comparison exposed and fixed timeline fingerprints computed before Zod field normalization; the issued validated descriptor is now reproducibly hashed after JSON round trip. Oracle copies, key-order neutrality, exact amounts/order/dates/conditions, cross-task issued-block selection, inert adversarial text and readable alternatives have regressions. The new separate browser lab preserves the earlier presentation fixture.

Browser evidence covers all sixteen authored task presentations, both existing and experimental renderers for the three matched positives, keyboard panning, 390px tables/readable mode, automatic complete alternatives at 320px, and five local-only normal-load requests with zero warnings/errors. Dense policies add panning; the binary figure largely repackages two numbers. No measured user benefit offsets the **269,497 gzip-byte** incremental SDK build probe. Byte and timing boundaries, initial fingerprint failure, transient resize/popup diagnostic and inconclusive observations are retained in the review, not discarded.

No provider requests were made during that initial phase. Its reference successes did not close live selection; the actual results below do. Participant correctness/task time/reformulations, SQL/tool discovery, model-generated caption quality and end-to-end latency remain **not run**, not passed or assumed zero. Controlled renderers remain defaults; infographics stay opt-in.

### Completed live pilot and no-promotion decision

All **32/32** authorized attempts completed, with **32/32 known usage records**, valid catalog enums and a stable returned-model fingerprint matching configuration. The candidate passes **16/16** frozen task-fit/content contracts; the existing catalog passes **13/16**. Candidate choices include three eligible infographics, with zero inappropriate diagrams, schema errors, request failures, retries, repairs or executed fallbacks. The baseline selected `message` rather than table/source/result on recorded history, general return policy and missing order. All three original misses remain frozen and are regression-replayed, not waived or rerun. The live command's expected exit 1 reflects those grading failures, not a broken local gate.

**No promotion:** the first two apparent wins coincide with ambiguity between the instruction to clarify an incompatible format and the baseline oracle's table/source fallback expectation. Choice-only output cannot prove why the model selected a kind, and the missing-order message/result label is also a narrow UX contract. [NLUI-035](NLUI-035.md) tracks alignment before confirmatory replication, without changing or discarding this pilot. One observation per pair cannot establish general reliability, model superiority or participant benefit; both arms used the same newly configured model, with no matched comparison to the previous one.

Usage: **17,960 input + 2,021 output = 19,981 total tokens**, including 1,442 reasoning tokens within output and zero reported cached-input tokens. Monetary cost is explicitly **unpriced**, not free. Request mean/median: existing **2,046.06/1,584.07ms**, candidate **1,471.93/1,356.58ms**; these are descriptive provider timings, not robust speed or user-productivity claims. All 99 original journal/budget/report files (386,782 bytes), plus their SHA-256 inventory, remain ignored and retained. A sanitized full report, original visible-output replay fixture and inventory are retained in the tracked evidence directory.

The old **40/40** and new **32/32** ledgers are independent, exhausted and preserved. No additional calls, default renderer changes or publication are authorized by this conclusion.

## Verification

- `bun run eval:presentation`: sixteen passing contracts per authored arm, 39/39 ineligible choices rejected, 24/24 semantic canaries detected, unchanged twelve-table disposable fixture fingerprint.
- The deterministic phase added **25 regressions / 341 expectations**, initially qualifying 872 tests. The live phase adds **15 provider-free regressions / 604 expectations**, including actual-output replay and one-send-only SDK transport. Final `bun run verify:all` exits 0 with **887 tests / 3,689 expectations across 105 files**, Biome and TypeScript, 35 scenarios / 77 assertions / 100 offline rules, source and compiled **60-request Hurl** profiles plus eight separate-session probes per mode, and all 35 exact reference cases per mode.
- Dedicated **source and production-compiled** matched-fixture HTTP/JS-asset regressions pass without provider configuration. Production-container qualification passes non-root HTTP/data/permissions/health/shutdown and 35 exact references.
- [Machine report](reviews/assets/2026-10-15-presentation-v1-report.json), [browser observations](reviews/assets/2026-10-15-presentation-browser.json), and [screenshots/limitations](reviews/2026-10-15-presentation-selection.md) retained. Temporary servers, browser overrides and tabs cleaned up.
- [Live report](reviews/assets/2026-10-16-selection-pilot-report.json), [all original visible outputs](reviews/assets/2026-10-16-selection-pilot-replay.json), [frozen plan](reviews/assets/2026-10-16-selection-pilot-plan.json) and [raw-journal inventory](reviews/assets/2026-10-16-selection-pilot-inventory.json) retained. Live outputs are never requested again by regression tests. The credential file, retained database and old budget remain unchanged; all inventory hashes are verified after execution.
- Local working changes only. No commit, push, version bump, hosted-CI claim, deployment, retained-data reset or credential change.

## Publication follow-up, 2026-10-16

After separate user authorization, release **1.7.0**, `8446350366f2d8752f47d632a305a2b6e0c6c572`, publishes this milestone and its frozen evidence to `main`. All three jobs in [run 38869687421](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421) pass: Linux/macOS **912 tests / 4,682 expectations**, lint/typecheck, offline/source/compiled HTTP and exact references; the production-container gate also passes. See [the publication review](reviews/2026-10-16-publication.md) for exact jobs and preservation checks. No new provider calls were made; all 32 original outcomes, three misses and both exhausted ledgers remain unchanged. NLUI-035's aligned v2 contract is provider-free and does not regrade this pilot. No promotion or live replication is implied. The evidence-only follow-up bumps to 1.7.1 and must pass its own workflow.
