# NLUI-031 — Bounded presentation qualification

Date: 2026-10-15. Local milestone based on release 1.4.1, followed by authorized release 1.5.0 publication and successful hosted qualification on `main`. The evidence follow-up bumps to 1.5.1 before its own push. No paid provider run or deployment is claimed.

## Baseline, hypothesis and outcome

NLUI-016 deliberately left seven of 77 labels unsupported: retrieved attributes and structural field names did not prove visible specifications, adequate questions or correct policy explanations. Its dated 28 passed/seven incomplete reference result is preserved.

Hypothesis: application-owned presentation contracts can make these seven specific claims executable without pretending a keyword heuristic is a semantic grader. Product facts/questions are rendered by production components; safety-critical explanations are selected from finite application-authored wording in the existing structured response format. Normal analytical annotations remain conversational.

Outcome: 77 executable labels, 100 deterministic rules, zero unsupported/unconfigured labels. All 35 explicit reference cases pass in source, isolated compiled and production-container modes. This qualifies the bounded catalog contracts and evaluation plumbing, not model planning, all prompt semantics, recommendation quality, general language understanding or performance on unseen conversations. NLUI-019 and NLUI-023 remain open.

## Executable criteria

| Scenario | Required proof |
| --- | --- |
| products-laptop-travel | Every displayed choice is bound to a captured SKU/name/attribute record; Battery life in hours and Weight in kg render in that product's specification list. |
| products-compare-laptops | Both requested SKUs remain captured; displayed choices match the captured set and visibly render correctly bound RAM/Storage in GB. |
| products-design-monitor | Monitor choices visibly render the corresponding source resolution, with a readable multiplication sign. |
| products-office-bundle | Production form labels and controls explicitly ask maximum price, desk/accessibility requirements and devices/connections, including frozen explanatory help. |
| disambiguation-order | Production form has a required order number and required controlled intended outcome; labels, types and allowed choices match the independent criteria. |
| policy-address-change | A successful address-after-dispatch tool decision is bound to the owned shipping-policy Address changes section; final text is registered safe wording and no mutation UI is present. |
| action-cancel-delivered-refusal | A successful cancellation-intent order lookup proves delivered state; final text is registered refusal/return-option wording and no mutation UI is present. |

`src/evals/presentationCriteria.ts` intentionally freezes form labels/help/options and fact labels/units independently of production factories. `presentationRules.tsx` renders the actual `NluiRenderer`, checks record/receipt binding and rejects missing, partial, wrong-SKU, wrong-value, misleading-label and unbound evidence. DOM markup checks establish application-owned rendered content, not a substitute for CSS/browser inspection.

The two policy templates each have two registered paraphrases. Tool metadata—not model-authored UI or database prose—selects the applicable contract. The final response JSON schema restricts caption to the finite allowed set; the resolver independently validates it. Multiple contracts compose deterministically, duplicates are removed, unknown metadata is rejected and all combinations fit the existing caption limit. Unsafe additions, quoted/negated policy text and a provider-refusal bypass fail before text/UI/completion publication. Guarded address retrieval shows only the relevant section and respects the requested result limit.

This is **not a language grader**. A reasonable but unregistered paraphrase is unproven, not classified as unsafe or silently repaired. No human-labelled calibration or held-out semantic-grader results are claimed. Those would be required before accepting arbitrary prose. Choosing the right tool intent/topic remains model planning; omitted/wrong intent metadata cannot satisfy these evaluation contracts. Existing server action validation and explicit confirmation remain unchanged.

## Regression and local execution evidence

Final `bun --no-env-file run verify:all` completed with exit 0:

- Biome: 244 files; TypeScript: clean.
- Bun 1.4.3: 717 tests, 2181 expectations, 80 files, zero failures.
- Offline catalog: 35 cases; 32 single-turn, one multi-turn, two route; 77 executable labels/100 deterministic rules; zero unsupported, unconfigured or validation issues.
- Source and compiled HTTP modes: 38 Hurl requests each, all passed.
- Source reference and standalone compiled reference: exact 35 case IDs, all passed, zero incomplete. The binary has only policy/scenario data beside it: no source or node_modules fallback.
- Linux production container: frozen production install, UID 1000, provider unconfigured, loopback port 3180, real HTTP/SQL, writable owned data/uploads, healthy port-aware healthcheck and successful SIGTERM shutdown. All 35 reference cases passed. Exact owned container/image resources were removed by qualification; no broad prune or retained mounts.

The new regression cases exercise positive content, paraphrased surrounding annotations, registered policy paraphrases, misleading/negated/quoted/appended text, missing/unbound/partial data, invalid types/values, incorrect source/status/intent, cancelled receipts, form-label/help/option drift, strict JSON composition, combined policies and typed capability submission/tampering. Exact IDs and current versions/fingerprints are required by the qualification profile. Missing, duplicate, renamed, incomplete or stale reports fail; promotion still rejects unsupported/external-unverified assertions.

An early typecheck caught and corrected an order-outcome field accidentally inserted in the shipping-address branch, plus test-only type annotations. Initial browser inspection found the existing radio-card grid placing description/specifications in an excessively narrow column. The layout now reserves a fixed radio/checkbox column, keeps content in its own flexible column and top-aligns controls; a stylesheet regression protects that structure. These diagnostics were fixed before the final qualification run.

## Browser evidence and limits

Owned provider-free fixture: `bun --no-env-file tests/fixtures/presentation-server.ts`. It uses a fresh temporary v2 repository, real tools, the production renderer and actual chat/capability validation; it has no production-discovered test endpoint. All seven examples were inspected at the default 1280×720 browser viewport. At 390×844, product specifications and both forms stayed readable with document width 390px and no page-level horizontal overflow. The temporary viewport override was reset afterward.

The home-office form submitted a numeric budget plus desk/device strings; the ambiguous-order form submitted `order_number` plus the controlled `return` outcome. Server receipts confirmed typed `ui_result` payloads. Both controls settled to Submitted/disabled with a successful continuation, without granting or executing any order action. Policy views showed the bounded explanation and relevant sources/order evidence with no mutation control.

A non-blocking existing Ant Design `List` deprecation warning is recorded in NLUI-024. The deliberate fixture restart caused an expected old-tab HMR disconnect. No application exception blocked the checked flows. These are disposable fixture/browser checks, not live-model or full production-chat end-to-end verification. The retained default v1 database was not reset, and ignored provider values were not printed, replaced or used for paid calls.

## Version and evidence boundary

- Evaluator: `deterministic-v3-presentation`; trace: 2; presentation policy: `policy-captions-v1`.
- Presentation criteria/caption fingerprint: `4ee03ac517c11b1548537febfd724f1203bc5f11386edacbe24af0b316354f01`.
- Fixture v2 logical fingerprint unchanged: `271d123d9e803ffe18941ecd189bf6303b816f9d42ad4faba6bb0f093f1c7502`.
- Updated general golden JSONL SHA-256: `423cd88cceac573c9bd26dfda8b4d159f1cc61d9b6ecf9e371248d9c1c3da816`.
- Experiment JSONL unchanged: `00af499b65bff5681f7566e87c1720c6124e8802e68df5c0c1b64ac67e0f2542`.

Older reports cannot qualify the new evaluator/fixture/presentation contract. Historical issue reviews remain dated evidence. Publication was not yet requested at the time of the local milestone; the subsequent user-authorized release is recorded separately below.

## Publication follow-up

Release 1.5.0 includes the full NLUI-031 milestone, committed and pushed as `cc4c00d016dbc698d925e011699adb7311fcfc52`. [Qualification run 38727922140](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140) completed successfully on 2026-10-15 at 11:34:07 UTC. All three hosted commit check-runs are completed/success; there are no legacy commit-status checks in addition to those check-runs. No failure was waived, skipped or repaired.

| Hosted job | Result and observed evidence |
| --- | --- |
| [Source and compiled, Ubuntu](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140/job/116398254691) | Passed on Linux x64: Biome/TypeScript, 717 tests/2181 expectations/80 files, offline 77-label/100-rule catalog, 38 source and 38 compiled HTTP requests, exact 35/35 source and standalone compiled reference profiles. |
| [Source and compiled, macOS](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140/job/116398255022) | Passed on macOS arm64: the same 717 tests/2181 expectations/80 files, static/offline checks, both 38-request HTTP modes and both exact 35/35 reference profiles. |
| [Production container, Linux](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140/job/116398979597) | Passed production-image build and real non-root HTTP/data/SQL/permissions checks, overridden-port health, exact 35/35 reference profile and graceful shutdown/owned-resource cleanup. |

Bun 1.4.3 and Hurl 8.0.1 were observed in the hosted matrix. Workflow inputs still use current Bun and frozen application dependencies; these versions are evidence, not exact compatibility requirements. GitHub's runner-capacity and upcoming Ubuntu-image-migration annotations were informational, not failed checks. No provider configuration was supplied to hosted jobs or test containers. This is not a billable/live-model result, Windows qualification, branch-protection change or deployment.

Before publication, the frozen dependency install changed no lockfile entries, `git diff --check` was clean, and fresh local `bun --no-env-file run verify:all` passed with the same 717-test and 35-case profiles. A local scan of all 331 publishable files plus the exact 53 staged files found no configured provider values or credential signatures; the scan printed only counts/findings, never configured values. `.env`, `TODO.md`, retained SQLite/runtime files and build outputs remained ignored. Docker exclusions and the real production-image probe confirmed private inputs and browser/test fixtures were absent from the runtime image.

After all hosted jobs passed, the registry and active verification documentation were updated with this exact run. The evidence-only follow-up bumps to 1.5.1 under the version-before-every-push rule; application/runtime/test code remains identical to qualified release 1.5.0. Its own push triggers the same full hosted workflow and must also be checked before handoff. Historical reviews remain unchanged, and the registry remains 23 Closed/nine Open.
