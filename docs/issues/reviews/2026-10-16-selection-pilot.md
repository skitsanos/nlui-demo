# NLUI-034: paired, selection-only live pilot

Date: 2026-10-16. The user explicitly authorized **at most 32 fresh provider attempts** and reuse of ignored provider configuration. This is separate from the exhausted 2026-10-15 forty-attempt ledger. No new key, configuration replacement, retained-data reset, publication or deployment was authorized.

## Preregistered protocol

The [frozen plan](assets/2026-10-16-selection-pilot-plan.json) was recorded before the first live request. It pins pilot ID `nlui-034-selection-2026-10-16-v1`, `presentation-v1` case/data fingerprints, common input hashes, protocol/dependency fingerprints, arm order and transport limits. Sixteen frozen tasks receive one request per arm, **eight AB / eight BA pairs**, serially. The baseline exposes six existing renderer kinds; the candidate adds three bounded infographic kinds. Catalog order is fixed, not randomized. Both arms receive identical verified data/scope/availability and user question. Expected choices, reasons and annotations are withheld; negative-case oracle scope strings are not sent because they contain grading rationales.

The model returns only a strict JSON `{representation}` enum. It does **not** generate SQL, tool calls, data, captions, actions or UI trees. A valid choice is independently graded for frozen task fit, then mapped only to an already verified server-owned descriptor and authored annotation. Unsafe/incompatible choices are recorded, not repaired, silently replaced or rendered speculatively. This is an isolated **presentation-selection** study with privileged, verified input data—not end-to-end chat/discovery reliability or caption quality.

Transport uses the installed OpenAI SDK with `store: false`, nonstreaming structured JSON output, `max_output_tokens: 1200`, a **45-second** timeout, **zero automatic retries** and SDK diagnostic logging disabled. Reasoning/temperature settings are left at provider defaults. The structured-output implementation follows the [official Responses guide](https://developers.openai.com/api/docs/guides/structured-outputs) and installed SDK types; it still independently validates output, terminal status and task fit rather than treating schema adherence as semantic correctness.

## Preservation and safety

The fixed ignored directory `eval-results/nlui-034-selection-2026-10-16-v1/` holds a SQLite budget, immutable manifest, and separate immutable request/response/result JSON files per slot. The manifest binds approval to case/data, dependency, protocol and configured-model fingerprints. A process lock prevents concurrent execution. Every request reserves quota durably **before** sending; failures and interrupted/ambiguous attempts consume their reservation and are never resent. Received responses are persisted before grading, enabling provider-free recovery after interrupted accounting. Report snapshots are content-addressed and never overwrite previous results.

Configured credential/model values are redacted before writing, including provider model metadata and error echoes; the model is identified by an alias and hash. HTTP authorization headers are never journaled. Provider outputs, incomplete states, usage, errors and frozen grading failures are retained, not cherry-picked. A terminal incomplete response is not successful output. Missing or inconsistent input/output/cached/reasoning accounting stays unknown; no missing usage is inferred free. Monetary totals remain **unpriced** unless matching versioned prices are explicitly supplied. A failure of transport/authentication stops the run without automatically spending remaining slots.

Mock-provider regressions qualify: 32-attempt persistence, complete no-spend reruns, one real-SDK send on 429, exclusive locking, immutable/redacted journals, protocol/model binding, failed-slot non-replay, interrupted-response recovery, unknown reserved attempts, invalid output, wrong choices, incomplete usage and both CLI opt-ins. Mock results are marked `injected_test`, not live evidence.

## Results

The [complete sanitized report](assets/2026-10-16-selection-pilot-report.json) retains every outcome. **32/32 attempts completed**, all with valid catalog enums, complete token usage and a single stable returned-model fingerprint matching the configured-model fingerprint. There were **zero transport/schema/refusal/incomplete failures**, **zero retries/repairs**, and **zero inappropriate infographic selections**. The live CLI exited **1 deliberately** because the baseline failed three frozen contracts; this is a retained research outcome, not an infrastructure failure to fix with replacement requests.

| Outcome | Existing catalog | Catalog plus infographics |
| --- | ---: | ---: |
| Completed requests / known usage | 16 / 16 | 16 / 16 |
| Frozen task-fit/content contracts passed | **13/16** | **16/16** |
| Selection errors against frozen labels | 3 | 0 |
| Infographic choices | 0 | 3, all eligible |
| Invalid output / content failures | 0 / 0 | 0 / 0 |
| Repairs / executed fallbacks | 0 / 0 | 0 / 0 |
| Input tokens | 7,820 | 10,140 |
| Output tokens, including reasoning | 1,256 | 765 |
| Reasoning tokens, subset of output | 968 | 474 |
| Total tokens | 9,076 | 10,905 |
| Mean provider-request latency | 2,046.06ms | 1,471.93ms |
| Median provider-request latency | 1,584.07ms | 1,356.58ms |

All **16 pairs** completed: **13 both pass, zero baseline-only, three candidate-only, zero neither**. The candidate selected the intended binary comparison, recorded timeline and general-policy process, retaining existing renderers/messages for every negative. It did not decorate zero totals, turn missing records into a timeline, follow the injected label, claim causes/forecasts, or decide order eligibility. Selected eligible descriptors independently passed exact-content validation; the model did not generate those values.

Every paired choice, including all three misses:

| Frozen task | Existing catalog choice | Candidate choice | Pass: existing / candidate |
| --- | --- | --- | --- |
| customer-count | stats | stats | yes / yes |
| latest-customers | table | table | yes / yes |
| monthly-revenue | chart | chart | yes / yes |
| regional-comparison | chart | infographic:comparison | yes / yes |
| order-history | **message** | infographic:timeline | **no** / yes |
| return-policy | **message** | infographic:process | **no** / yes |
| ambiguous | message | message | yes / yes |
| missing-order | **message** | result | **no** / yes |
| empty-customers | table | table | yes / yes |
| zero-revenue | table | table | yes / yes |
| future-forecast | message | message | yes / yes |
| causality | message | message | yes / yes |
| order-eligibility | message | message | yes / yes |
| incompatible-scope | message | message | yes / yes |
| adversarial-label | table | table | yes / yes |
| explicit-line | chart | chart | yes / yes |

### Interpretation and newly observed verification gap

**No promotion.** These are actual model choices against preregistered finite labels, not the previous authored references. However, two candidate-only passes coincide with a potential instruction/oracle conflict: the prompt tells the model to clarify an incompatible requested format, while the baseline lacks the requested diagram kinds and the oracle expects an existing table/source fallback. The live output contains choices only, so it cannot establish the model's reason or prove that this ambiguity caused its choices. It does prevent interpreting the score delta as a clean causal improvement. The missing-order message/result distinction is also a narrow UX label preference, not a hallucination or unsafe action.

[NLUI-035](../NLUI-035.md) tracks a reviewed, aligned fallback/missing-result contract and a preregistered confirmatory protocol. **None of the three misses was relabelled, waived, retried or removed**. A provider-free regression replays all 32 original output strings and pins exactly these three failures, protocol/data fingerprints and accounting. Any future sensitivity analysis must be separately labelled post hoc, and any new live replication needs a new approved cap.

The candidate's total tokens are **10,905 versus 9,076**, despite fewer output/reasoning tokens, because its catalog is larger. Total observed usage is **17,960 input + 2,021 output = 19,981 tokens**, with **zero reported cached-input tokens**, **1,442 reasoning tokens included within output**, **32/32 known usage records**, and **zero unknown usage reservations**. Monetary cost remains explicitly **unpriced**, not free. The serialized visible selections total **905 UTF-8 bytes**; full original-response serialization measured **150,344 bytes** before redaction/pretty printing. These are not HTTP compression/transfer or prompt-token estimates.

Latencies cover one nonstreaming provider call, not time to first text, browser layout, SQL/tool discovery or human task completion. Request order was alternated, but only one observation exists per task/arm; catalog length/order, provider defaults and service conditions are not fully controlled. Neither the latency difference nor the 16/16 score establishes statistically reliable superiority. Both arms used the same newly configured model: **there is no matched comparison to the prior model**, and no model-superiority claim follows from the user's change.

## Durable evidence and verification

- The fixed ignored pilot directory preserves **99 original journal/budget/report files (386,782 bytes)** plus an immutable SHA-256 inventory. It contains all **32 requests, 32 responses, 32 results**, manifest, budget and content-addressed report. The [inventory](assets/2026-10-16-selection-pilot-inventory.json) identifies every original file by bytes/hash; it excludes itself. All are retained, including the failed frozen contracts. No raw request/response files were promoted into the repository.
- A tracked [visible-output replay fixture](assets/2026-10-16-selection-pilot-replay.json) and sanitized full report preserve public audit/regression evidence without configured values, HTTP auth headers or reasoning content. The ignored provider responses retain the sanitized response envelopes. No secret/model value is printed, logged or committed; aliases and hashes identify the configuration.
- The previous **40/40** ledger is independent of the new **32/32** ledger; both are now exhausted. No extra requests are authorized. Normal reruns cannot spend again, change a bound manifest or replace a failed slot; regressions test these properties using mock providers.
- `bun update && bun install --force` retained the direct versions and updated only transitive Cytoscape **3.34.3 → 3.34.4**, Undici **8.12.1 → 8.12.2**, and Undici Types **8.12.1 → 8.12.2**. Dependency fingerprint is frozen in the plan/manifest. `bun audit --json` reports no advisories.
- Initial local test-only failures (nullable fixture usage typing and a lazy SDK promise matcher) were fixed before any live call. The mocked SDK now resolves behind a native promise, and the one-send-only 429 regression passes. No paid attempt was used to debug those failures.
- Final `bun run verify:all` exits **0**: **887 tests / 3,689 expectations across 105 files**, Biome and TypeScript, 35 offline scenarios / 77 assertions / 100 rules, **60 source + 60 compiled Hurl requests plus eight separate-session probes per mode**, all 35 exact references per mode, and Linux production-container HTTP/data/permissions/health/shutdown as UID 1000 plus 35 exact references. The live phase adds **15 provider-free regressions / 604 expectations**, including actual output replay. Existing browser/renderer evidence remains the separately dated 2026-10-15 qualification; this selection-only work changes no frontend behavior and does not claim a new participant/browser performance study.
- Final inventory, configured-secret scan and retained-file checks confirm every original result remains intact, ignored configuration/data and the old 40-attempt ledger remain unchanged, and no configured values appear in changed source/evidence or local pilot journals. No commit/push, version bump, hosted CI, deployment or new provider attempt was performed during reconciliation. NLUI-034 is closed with its inconclusive no-promotion decision; NLUI-035 is Open for the newly observed verification gap.
