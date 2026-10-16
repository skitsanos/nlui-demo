# NLUI-035: aligned fallback contract, provider-free qualification

Date: 2026-10-16. Scope: correct the presentation-selection research protocol, not production routing or a new live study. The user explicitly prohibited new provider calls. **Zero provider requests**, no new budget, no configuration replacement, no default renderer change and no publication were performed.

## Contract decisions

An unavailable renderer and an incompatible question are different states. `presentation-fallback-v2` makes the distinction explicit in one typed rule catalog that generates instructions, catalog descriptions and executable eligibility. Strict fixture-context validation rejects unknown states rather than guessing. These are **trusted authored evaluation facts**, not a natural-language intent classifier or model-generated authority.

| Verified task and requested format | Existing catalog | Catalog plus infographics |
| --- | --- | --- |
| Exactly two regions, explicit observed EUR revenue period, at least one nonzero total, explicit visual comparison | Bar chart | Matching comparison infographic **or** bar chart |
| One found order, recorded UTC events, explicit visual history | Exact event table | Matching timeline **or** event table |
| General return policy, complete conditions, explicit visual process | Complete source excerpts | Matching process **or** complete source excerpts |
| Same data without a visual request | Existing chart/table/sources | Same existing renderer; no decorative infographic |
| Explicit compatible monthly line chart | Line chart | Line chart |
| Completed exact lookup says `found=false` | Informational result | Informational result; never invented history |
| Successful empty list query | Empty table | Empty table |
| Two verified zero revenue totals, including an explicit visual request | Exact zero-valued table | Exact zero-valued table |
| Missing metric/population/period or unverified record lookup | Message clarifying what is unknown | Same message boundary |
| Unsupported forecast/cause/order eligibility; five regions explicitly forced into a binary visual | Message explaining the evidence/scope limitation | Same message boundary; no silent narrowing |

For the three positive visual cases, lack of an infographic **must not** become a clarification. Candidate eligibility deliberately retains the faithful existing fallback; a preferred infographic is not a mandatory or inherently superior representation. Passing eligibility does not prove that visual selection or human comprehension improved.

The missing-record boundary is now an explicit **application UX convention**: a completed lookup returning absence uses `result` with informational status, not `message`; an unverified lookup remains a message/evidence limitation. This is not a claim that users prefer the result component. False action success, fabricated milestones, empty query results and exact zero totals remain distinct. A participant study would be needed to establish UX benefit.

## Versioning and independent evidence

- New modules: `fallbackContract.ts`, `fallbackFixtures.ts`, `fallbackProtocol.ts` and `fallbackEvaluation.ts` under `src/evals/presentation/`. They do not replace or edit v1. The new entrypoint is `bun run eval:presentation:fallback`; it has **no provider transport, credential loading, budget constructor or billable opt-in**.
- Global rules generate both arm catalogs and instructions. The model-facing material shares v1's raw verified data and safe availability projection, with identical non-catalog inputs in both arms. Hand-labelled context, expected choices, task IDs, rationales, eligibility lists and captions are withheld. Changing private expected labels/rationales cannot change the prompt. Explicit global renderer rules are intentional application instructions, not per-case oracle leakage.
- The frozen independent content grader is reused unchanged for exact values, dates/formats, units, source/scope/snapshot, row order, full policy conditions, issued descriptors and annotations. A valid enum or eligible kind alone cannot pass corrupted content. No fallback choice is silently repaired or rendered from unverified output.
- The [deterministic report](assets/2026-10-16-fallback-v2-report.json) freezes all sixteen **reused development fixtures**, thirty-two arm decisions and **35 eligible reference choices**, including all three candidate existing fallbacks. All 35 pass. Its protocol fingerprint is `5783face42faeae02e1196afdd83b68a654d3a58d30ed47c8e5c5ef4d1121561`; case/evidence fingerprint is `7e2529db04f89f5f391ac20c003db02a4404e55ef91a24d4892ad81cdb44b8ac`. Prompt fingerprints bind every case/arm's actual offline material. The complete report is replay-pinned by a regression; it contains no timing noise or provider values.
- This is a **post-pilot protocol correction**, not a confirmatory preregistration, held-out evaluation, post-hoc rescoring of live choices, or evidence that a model follows the revised instructions. No new live outputs exist. Before future live work, a separately approved cap, new held-out/repeated case plan, transport/budget binding and explicit participant/model/provider boundaries must be preregistered. Neither exhausted ledger may be reset or reused as a fresh budget.

## Original pilot preservation

The v1 instruction/catalog/schema, hand-labelled cases, eligibility, all 32 outputs and both original ledgers remain unchanged. Its fingerprint remains `ba05cc7bdf5052e27fb339da2f3cf2432d56a5ea013c2771fb8629edf28e6751`. Provider-free replay still produces **13/16 existing versus 16/16 candidate**, with exactly `order-history:baseline`, `return-policy:baseline` and `missing-order:baseline` failing. No miss was waived, retried, relabelled or scored under the new protocol. The original **no-promotion** decision remains in force.

A before/after SHA-256 comparison confirms **123 existing files unchanged**, including all v1 presentation modules, frozen pilot assets, private pilot records/inventory, ignored `.env`, the old forty-attempt ledger and the lockfile. The original journal inventory independently verifies all **99 original files** with zero mismatches. Both ledgers are read-only verified at **40/40** and **32/32**; four retained database/WAL/SHM files remain byte-identical across qualification. A configured-value scan reports **zero matches** in all changed/untracked project files. Configuration contents were not printed or replaced.

## Verification

- **25 new regressions / 993 expectations**: an independent literal eligibility matrix for all sixteen tasks and all nine choices in both arms; unavailable-format fallbacks; nonvisual, zero, unknown-lookup and unsupported-evidence controls; strict invalid states/output; shared rule/catalog/instruction generation; private-oracle non-leakage; exact-content corruption rejection; frozen v1 fingerprint/misses; complete deterministic report replay.
- The new CLI runs successfully in a separate `--no-env-file` process with blank provider configuration and `fetch` replaced by a throwing network guard. It creates only disposable v2 fixture data, cleans up its owned directory and reports zero provider requests/no budget. This does not exercise a provider or establish live model behavior.
- Targeted new-contract plus original-output replay: **27 tests / 1,134 expectations**, all passing. Final `bun --no-env-file run check`: **912 tests / 4,682 expectations across 106 files**, Biome and TypeScript, all passing on Bun **1.4.3**, macOS arm64.
- `bun --no-env-file run verify:all` exits **0**: full source checks, 35 offline scenarios / 77 assertions / 100 rules, **60 source + 60 compiled Hurl requests** with separate-session probes, all 35 exact references per mode, plus Linux production-container HTTP/data/permissions/health/shutdown as UID 1000 and all 35 reference cases. The final two frozen-report assertions were added after that source test phase and also passed in the final complete `check` run above; no production source changed between these gates.
- Initial implementation typechecks caught a union-key indexing error and a readonly-array matcher mismatch. Both were corrected before qualification. No provider attempt was used for debugging; no check was waived.
- No UI behavior changed, so no new browser/participant evidence is claimed. Prior renderer/browser evidence remains separately dated. No dependency upgrade, commit, push, version bump, hosted CI or deployment occurred during this milestone.

## Decision

**NLUI-035 Closed for provider-free protocol alignment. Live verification remains pending and unauthorized.** The contract, instructions/catalog/eligibility, regression matrix, frozen fingerprints and preservation obligations are complete. Controlled rendering remains the default; infographics remain opt-in. A future confirmatory study is a separate authorized milestone, not an unrecorded claim that this correction improved a model or user outcome.
