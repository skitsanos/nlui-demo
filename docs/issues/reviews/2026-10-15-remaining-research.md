# Remaining research milestones — 2026-10-15

Closes the bounded local-demo research scope of NLUI-019, NLUI-020 and NLUI-021. The user approved at most forty provider requests using existing ignored configuration, plus isolated anonymous-session ownership rather than production identity integration. No configured key/model values, retained records or raw private traces are reproduced here. No default arm is promoted.

## Baseline and accounting

- Fixture: `nlui-retail-operations-v2`, unchanged seed fingerprint `271d123d9e803ffe18941ecd189bf6303b816f9d42ad4faba6bb0f093f1c7502`.
- General golden SHA-256: `423cd88cceac573c9bd26dfda8b4d159f1cc61d9b6ecf9e371248d9c1c3da816`.
- Query-experiment golden SHA-256: `00af499b65bff5681f7566e87c1720c6124e8802e68df5c0c1b64ac67e0f2542`.
- Every provider attempt reserves the same persistent budget before execution; SDK automatic retries are disabled. Tests and browser fixtures do not contact a provider.
- Final budget: **40/40 attempts**, **36 complete usage records**, **4 unknown-usage format failures**. Known totals: 111,582 input tokens, including 37,629 cached input; 5,283 output; 116,865 total. Cached input is a subset, not additional tokens.
- Monetary cost is **unpriced**: no attributable versioned pricing was supplied. Unknown usage is not zero/free, and known totals are not complete billing reconciliation. No further provider calls are authorized by this record.

Private ignored evidence: `eval-results/remaining-2026-10-15-budget.sqlite`, `remaining-queries-2026-10-15.json`, original `remaining-surfaces-2026-10-15.json`, corrected `remaining-surfaces-2026-10-15-1792069329827.json`, matched control `remaining-surfaces-2026-10-15-1792069506001.json`, and `refinements-2026-10-15.json`. Failed evidence remains intact; timestamped output names prevent replacement on a later run. These are local evidence, not committed unrestricted trace attachments.

## NLUI-019: catalog v3 and paired query pilot

Eight metrics and five dimensions now publish formula, grain, unit, exclusions, valid time field, compatible dimensions/enums, synonyms, sensitivity and display metadata from the server-owned catalog. Guidance, compilation and `/api/catalog` JSON/Markdown use that source. New measures are line-grain gross merchandise revenue (before order-level discount/tax/shipping, excluding cancelled/returned orders) and completed refunds (return-request time, not an unavailable refund-payment timestamp). Approved many-to-one relationships prevent accidental total multiplication. Independent tiny SQLite fixtures assert hand-calculated €50/€200 merchandise and €300 completed refunds with wrong-status/date counterexamples.

Four fully specified prompts cover two concepts with two paraphrases each. Definitions deliberately disambiguate item versus order grain and request versus order time. Fixed-only, guarded SQL, semantic and hybrid arms run in alternating paired order against independent unchanged fixture data, with the same structured block ownership and fresh-action prohibition. This is not a large ambiguous-intent or repeated reliability study.

| Arm | Exact denotation + required UI | Requests | Mean completion ms | Mean first useful ms | Total known tokens |
| --- | --- | --- | --- | --- | --- |
| Fixed-only | 0/4 qualified | 7 | 5,153.98 | 5,153.89 | 17,129 |
| Guarded SQL control | 4/4 | 8 | 4,967.37 | 4,956.54 | 26,579 |
| Semantic v3 | 4/4 | 8 | 4,222.73 | 4,214.64 | 29,330 |
| Hybrid | 4/4 | 8 | 4,030.93 | 4,023.71 | 39,254 |

All twelve generic-query successes rendered a chart; no rejected-tool repairs or prepared actions occurred. Semantic plans are compared with canonical expected plan hashes and denotations; guarded SQL runs against the same expected tuples. The fixed arm has no generic query/denotation evidence for these exact measures: **0/4 is capability/qualification coverage, not a refusal-quality score or proof every fixed-tool number is wrong**. No golden scenario was weakened or modified. The timing differences are one small serial pilot, not statistically powered speed/reliability gains; cache/order/provider variability remain confounders. The semantic/hybrid arms do not beat the control's denotation coverage. Guarded SQL remains the default.

## NLUI-020: controlled A2UI/X Card experiment

Pinned `@ant-design/x-card` **2.9.0**, explicit **A2UI v0.9**, local catalog `local://nlui/owned-catalog-v1`. Primary references: [Ant Design X Card](https://x.ant.design/x-cards/introduce/) and [A2UI v0.9](https://a2ui.org/specification/v0.9-a2ui/), cross-checked against installed package source. This is a deliberately constrained profile, not universal A2UI interoperability certification.

The domain-independent adapter validates create/update/data/delete commands, bounded single-parent graphs, exact issued block bindings and independently issued opaque action mappings. Text/metric/chart/table/choice/form/notice/button implementations reuse owned domain rendering. Unknown components/props, remote catalogs, scripts, endpoints, query fragments, generated validation, unsafe paths, cycles, missing references and mutation-name actions fail before the SDK. Every issued block must appear exactly once. Structure/data may arrive separately at the adapter, but model envelopes are buffered to completion; no speculative partial-render advantage is claimed.

Initial four attempts failed provider format qualification because the application-generated schema used unsupported `oneOf`/dynamic record constraints. They are retained as **schema failures**, not model-quality failures or free requests. The corrected strict closed-binding schema yielded **4/4 valid command surfaces, zero repair requests**:

| Sample | Components | Completion / first useful ms | Total tokens | Serialized command bytes |
| --- | --- | --- | --- | --- |
| Metric | 3 | 3,455.40 | 1,107 | 513 |
| Chart | 3 | 2,411.25 | 1,038 | 506 |
| Table | 3 | 2,385.72 | 1,024 | 507 |
| Form + choice + notice | 5 | 2,703.91 | 1,128 | 715 |

One matched block-selection control for form/choice/notice took 1,936.09 ms, 276 tokens and 173 envelope bytes. The A2UI representation is larger here; **n=1 is not a general performance comparison**. Valid-command rate is distinct from actual render acceptance.

Actual browser rendering caught an additional SDK incompatibility: X Card treats a root `/` data replacement as an empty property. A narrow tested lowering into approved-key writes fixes it without broadening the accepted wire schema. An isolated JSDOM test mounts the actual production `ExperimentalSurface` and X Card, asserting resolved owned content rather than a permanent waiting placeholder. Desktop browser checks confirm metric/chart values, keyboard chart-table alternative, keyboard product selection, and safe controlled fallback for unsupported confirmation surfaces. Domain regression tests preserve action validation regardless of renderer. No renderer-generated mutation route exists.

`?renderer=a2ui` is opt-in; default controlled rendering is unchanged. The experiment establishes bounded portability of owned blocks, not new authority or a demonstrated usability/accessibility advantage. General accessibility certification, arbitrary catalogs and partial-model-stream latency are not claimed. [Browser evidence](assets/2026-10-15-xcard-chart.jpg).

## NLUI-021: analytical artifacts, exact scope and machine benchmark

Provider-free `/api/analysis` creates immutable plan/result IDs, exact parent-result references and strict deltas for metric/group/filter/date/sort/top-N. Unmentioned context survives; `latest`, foreign-conversation IDs, incompatible plans and stale catalog/fixture parents fail closed. Normal chat SQL is not falsely advertised as an editable semantic plan: the explicit Explore/refine path owns this contract.

Private artifacts retain bounded results and SQL. Public receipts include exact definitions/formula/grain/unit, dataset/snapshot identity, live data revision, grouping/filters/period/order/limit, counts/truncation/warnings and query/plan/result hashes. Actual data revision is separate from declared seed identity; revision changes raise warnings. SQL requires explicit owner-scoped debug access. Display sorting on an analytical table issues a new typed delta instead of invalidating provenance. Human-readable scope precedes collapsed technical IDs/hashes.

Provider-free matched protocol benchmark: four cases × five repeats, **20/20 exact receipt checks**, **20/20 deliberately mismatched-filter canaries detected**. One typed submission, zero model turns/requests and zero correction requests per refinement. Mean backend completion across each case's five runs: 12.44, 11.66, 11.25 and 10.77 ms. Chat-only control above completed 4/4 in 8 provider requests with zero rejected-tool repairs (mean 4,967.37 ms); original questions were 147–158 characters. These are **different measurement boundaries**: typed timings exclude selecting inputs, browser/network and human reformulations. They demonstrate a deterministic zero-provider protocol path and detectable scope mismatches, **not a causal human time/turn/reformulation improvement**. No participant study or statistical productivity claim is made.

Browser: regional eligible revenue → West-only typed refinement produced a separate result, retained the original chart, displayed one €325,806.63 row and exact `Region: West` receipt; duplicate DOM IDs and page-width overflow were absent. [Applied scope](assets/2026-10-15-typed-refinement.jpg). A prior disposable fixture separately checked customer-count refinement. All data here is synthetic; the fixture's one return action does not alter the retained dataset.

## Qualification and decision

The [owned-workflow record](2026-10-15-owned-workflows.md) contains fresh 803-test/2601-expectation, source/compiled HTTP, exact reference and production-container results. Both research and workflow changes remain uncommitted/unpushed; hosted CI has not qualified them. Negative/inconclusive comparative results close these bounded experiments without promoting their candidates. A larger repeat study or human usability study would be separately scoped future research, not evidence silently inferred from this pilot.
