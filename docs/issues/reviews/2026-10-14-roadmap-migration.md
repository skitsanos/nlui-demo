# Frozen roadmap migration — 2026-10-14

This is a read-only historical snapshot of the former ignored TODO.md, captured when its work was migrated to [the Issues Registry](../README.md). It preserves the original proposals, checklists, hypotheses, review findings and dated results. Some early unchecked boxes were superseded by later completed milestones; current statuses and execution order are only in the registry. Historical billable/visual results below were not rerun during this migration. The historical configured model label has been redacted.

---

# NLUI Runtime Research Roadmap

This is the local research and development ledger for the project. It is intentionally ignored by Git so it can evolve during experiments without becoming product documentation or a public commitment.

## Baseline established

- Bun full-stack server and React client.
- Ant Design and Ant Design X conversation UX.
- Controlled, application-owned NLUI block catalog: statistics, charts, tables, choices, forms, confirmations, sources, and results.
- Strict OpenAI function tools; the model selects capabilities but does not emit React, HTML, routes, validation rules, or mutation callbacks.
- Deterministic synthetic retail dataset in SQLite.
- Specialized fixed-query tools plus guarded `query_dataset` text-to-SQL.
- SQL AST parsing, allowlists, canonicalization, read-only worker isolation, timeout, and result-size limits.
- Opaque two-phase mutation confirmation.
- Schema-required conversational annotations for every model-produced UI response; trusted values remain in controlled blocks.
- Full-width internally scrollable tables and reply-start scroll anchoring across desktop and mobile layouts.
- 35 golden scenario specifications.

## Working principles

- Treat this as research, not a feature-count exercise.
- Every major architectural change needs a baseline, hypothesis, experiment arm, and measurable outcome.
- Keep the current controlled renderer and guarded SQL path as control groups until evidence supports replacing them.
- The application owns business semantics, validation, permissions, action wiring, and rendering catalogs.
- Model output and dataset text are untrusted input.
- Prefer deterministic denotation and safety checks over subjective output grading.
- Keep live model evaluations explicit and opt-in because they are billable and nondeterministic.

## Phase 0 — Close interaction trust-boundary gaps

Research prerequisite: interactive controls must be real server-issued capabilities before they can be safely evaluated.

- [x] Add an application-owned interaction registry.
- [x] Register every emitted choice/form interaction with:
  - conversation scope;
  - interaction kind;
  - exact allowed fields or option values;
  - expiry;
  - single-use state;
  - optional action scope.
- [x] Resolve and canonicalize each `ui_result` server-side before it reaches the model.
- [x] Reject unknown interaction IDs.
- [x] Reject extra or missing fields.
- [x] Reject altered select/choice values.
- [x] Reject replayed and expired interactions.
- [x] Bind prepared action confirmations to conversation scope; real principal authorization remains production work.
- [x] Add idempotency for confirmation requests.
- [x] Add adversarial tests for invented IDs, payload tampering, replay, expiry, and cross-conversation use.

## Direction 1 — Executable NLUI evaluation laboratory

### Research question

Does the system reliably choose the right tools, produce correct data results, render an appropriate interface, and avoid unsafe actions across paraphrases and repeated runs?

### Build

- [x] Promote the scenario JSONL contract into a reusable strict schema.
- [x] Add `bun run eval:offline` for non-billable fixture and scorer validation.
- [x] Add opt-in `bun run eval:live` using the approved ignored OpenAI configuration.
- [x] Support scenario selection, category selection, and repeat count.
- [ ] Add bounded concurrency only after a serial latency baseline exists.
- [ ] Reset or isolate fixture state for mutation scenarios.
- [ ] Complete per-run trace coverage:
  - [x] scenario/dataset, model, and prompt versions;
  - [x] response, tool-call, block, validated tool argument, emitted block, and final-answer evidence;
  - [x] latency to first text, first useful UI, and completion;
  - [x] provider token usage and tool/round durations;
  - [ ] canonical SQL or semantic plan hash, policy outcome, and explicit repair count;
  - [ ] normalized cancellation, timeout, empty-result, and stream failure states;
  - [ ] estimated cost only after selecting a versioned pricing source.
- [x] Produce JSON results plus a concise Markdown/terminal summary.

### Scoring

- [x] Expected and forbidden tool selection.
- [x] First-attempt and one-repair execution success.
- [x] Exact or tolerance-based denotation accuracy.
- [x] Required filters, time field, grain, units, and join semantics.
- [x] Expected renderer-class scoring; unit-format assertions still need migration.
- [ ] Unsupported numerical-claim rate.
- [ ] Forbidden-column, forbidden-tool, and mutation rate.
- [x] Capture latency, tool rounds, and tokens per run.
- [x] Aggregate run-to-run outcome stability plus latency/token ranges; cost remains intentionally unresolved without a versioned pricing source.
- [ ] Prefer deterministic pass/fail checks; calibrate any model grader against human labels.

### Corpus expansion

- [x] Add three paraphrases for each of the three Semantic Query Plan pilot intents; broader scenario coverage remains future work.
- [ ] Add multi-turn trajectories, not only independent prompts.
- [ ] Add ambiguity cases: registered versus active customers, revenue versus merchandise revenue, forecast versus observed events.
- [ ] Add null-heavy data, partial refunds, multiple payments/shipments, sparse periods, and deliberate quality anomalies.
- [ ] Promote every discovered failure into a regression scenario.

## Direction 2 — Semantic query plan versus text-to-SQL

### Research question

Does a typed, server-compiled business query plan improve correctness, consistency, latency, and safety compared with guarded model-generated SQL?

### Build a versioned semantic catalog

- [ ] Define entities and approved relationships.
- [ ] Define dimensions, enums, synonyms, types, sensitivity, and display metadata.
- [ ] Define measures with canonical formulas, grain, units, default exclusions, and valid time dimensions:
  - registered customer count;
  - active customer count over an explicit period;
  - eligible order count;
  - eligible order revenue;
  - merchandise revenue;
  - average order value;
  - refund amount.
- [ ] Generate model guidance, tool schemas, SQL compilation rules, renderer metadata, and documentation from the same catalog.
- [ ] Add a strict `semantic_query` tool whose input contains metrics, dimensions, filters, ordering, limit, and presentation intent.
- [ ] Compile semantic plans to parameterized application-owned SQL.
- [ ] Retain `query_dataset` behind an experiment flag.

### Experiment arms

1. Specialized fixed tools only.
2. Current guarded text-to-SQL.
3. Semantic plan compiled to SQL.
4. Hybrid semantic-first with guarded SQL fallback.

### Compare

- [ ] Denotation accuracy rather than exact SQL strings.
- [ ] Correct business definition, grain, joins, filters, and units.
- [ ] First-pass success and repair rate.
- [ ] Prompt and schema token usage.
- [ ] Latency and estimated cost.
- [ ] Presentation consistency across paraphrases.

## Direction 3 — Controlled A2UI and Ant Design X Card experiment

### Research question

Can a standards-based declarative UI offer meaningful runtime flexibility without degrading safety, accessibility, consistency, or model reliability?

### Build

- [ ] Keep the existing `NluiBlock` renderer as the control group.
- [ ] Add `@ant-design/x-card` behind an experiment flag.
- [ ] Pin one supported A2UI protocol version behind an adapter; do not bind domain logic directly to the evolving protocol.
- [ ] Define a small application-owned catalog: text, metrics, chart, table, choice group, form, notice, and button.
- [ ] Validate every surface, component, property, binding, and action server-side.
- [ ] Keep action resolution on the existing opaque capability boundary.
- [ ] Forbid model-provided URLs, routes, endpoints, query fragments, validation rules, and mutation names.
- [ ] Provide graceful fallback to Markdown/current blocks.
- [ ] Support progressive `createSurface`, component update, data update, and surface completion events.

### Compare with the controlled renderer

- [ ] Valid-render rate and repair rate.
- [ ] Time to first useful UI and completion.
- [ ] Layout consistency and user muscle memory.
- [ ] Accessibility and keyboard usability.
- [ ] Action-integrity violations.
- [ ] Token and latency cost.
- [ ] Cross-renderer portability.

## Direction 4 — Mixed-initiative, artifact-aware data analysis

### Research question

Can users refine and inspect an analytical object directly instead of repeatedly paraphrasing the same intent in chat?

### Build

- [ ] Assign immutable `planId` and `resultId` values to analytical results.
- [ ] Store application-owned analysis context per conversation: dataset version, metrics, dimensions, filters, time range, sorting, and result reference.
- [ ] Make follow-ups deterministic plan deltas:
  - break down by another dimension;
  - add/remove a region or tier filter;
  - compare with a previous period;
  - switch metric from revenue to units;
  - drill into the rows behind a chart point.
- [ ] Add controlled filter chips, date-range controls, group-by controls, top-N, metric switches, and drill-down actions.
- [ ] Send typed plan deltas back to the server rather than string paraphrases.
- [ ] Store complete results server-side and give the model only the bounded summary it needs.

### Provenance receipt

- [ ] Dataset and snapshot timestamp.
- [ ] Canonical metric identifier and human definition.
- [ ] Applied filters and grouping.
- [ ] Grain and time field.
- [ ] Row count, truncation, and quality warnings.
- [ ] Query/plan hash.
- [ ] Optional SQL disclosure in an explicit developer/debug view.

### Compare

- [ ] Chat-only versus chat plus direct manipulation.
- [ ] Task completion time and number of turns.
- [ ] Reformulation and correction rate.
- [ ] Accuracy of pronoun/reference follow-ups.
- [ ] User detection of intentionally mismatched filters.

## Direction 5 — Durable, replayable, provider-neutral event transport

### Research question

Can conversation, tool, and UI state survive refreshes, reconnects, provider changes, and mid-stream failures without ambiguity?

### Build

- [ ] Add an application conversation ID and SQLite append-only event log.
- [ ] Version every event and add sequence, request, turn, tool-call, plan, and block identifiers.
- [ ] Add idempotency keys and replay cursors.
- [ ] Rebuild the client from event replay.
- [ ] Resume after disconnect and reconcile interrupted tool calls.
- [ ] Put the OpenAI Responses integration behind a provider/controller adapter.
- [ ] Compare app-owned history with provider-managed Conversations/previous-response chaining.
- [ ] Add an AG-UI adapter for run, step, text, tool, activity, state snapshot/delta, and interrupt events.
- [ ] Keep the internal domain/NLUI contract independent from AG-UI and A2UI versions.

## Direction 6 — Adversarial trust, authorization, and data provenance

### Research question

Can untrusted dataset content, UI events, or tool results alter the controller's instructions, expose restricted data, or trigger an unintended action?

### Data-to-model prompt injection

- [ ] Seed adversarial instructions into product descriptions, policy documents, support subjects, and return reasons.
- [ ] Measure changes in prose, tool selection, SQL, and proposed actions.
- [ ] Label tool output provenance and treat all free-text fields as untrusted data.
- [ ] Separate model-facing summaries from UI payloads.
- [ ] Evaluate separate read and action controllers.
- [ ] Require fresh explicit user intent for actions; never derive authorization from tool-returned text.

### Query and authorization hardening

- [ ] Scope pending-action supersession and ownership to a durable conversation/principal boundary; the demo currently de-duplicates by order and action type globally.
- [ ] Resolve every AST column reference against an exact in-scope table and published field.
- [ ] Prefer sanitized analytical views over physical tables with hidden columns.
- [ ] Classify fields as public dimension, identifier, sensitive, free text, or internal.
- [ ] Add simulated tenants and canary rows to test row-scope leakage.
- [ ] Add query concurrency and per-turn budgets.
- [ ] Fuzz comments, quoting, alias shadowing, nested queries, malformed CTEs, joins, offsets, and Unicode confusables.

### Observability safety

- [ ] Correlate traces without logging API keys, raw prompts, row values, or free-text dataset fields by default.
- [ ] Hash raw SQL/semantic plans in normal traces; allow full text only in an explicit development mode.
- [ ] Record policy codes, durations, result shapes, truncation, and renderer fallback.

## Supporting product work, not primary research

- [ ] Persist and manage real conversation history.
- [ ] Mark submitted, superseded, expired, and completed controls visibly.
- [ ] Add retry and action-result reconciliation after failures.
- [ ] Improve prompt-card keyboard semantics.
- [ ] Provide accessible table alternatives for charts.
- [ ] Add chart tooltips, table sorting/export, responsive refinements, and richer empty/error states.
- [ ] Connect upload handling to a future approved dataset-onboarding experiment.

## Recommended execution order

1. Server-verified interaction capabilities and adversarial tests.
2. Executable offline/live evaluation harness and trace model.
3. Semantic catalog and `semantic_query` experiment beside `query_dataset`.
4. Artifact-aware refinements and provenance receipts.
5. A2UI/X Card renderer experiment beside the current renderer.
6. Durable event log and AG-UI adapter.
7. Simulated tenancy, prompt-injection corpus, and production-grade authorization experiments.

## Completed milestone — NLUI Evaluation Harness v1

- [x] Finish Phase 0 interaction capability validation.
- [x] Introduce reusable scenario, trace, score, and report modules.
- [x] Add a non-billable offline command.
- [x] Add a bounded, opt-in live command with scenario/category/repeat controls.
- [x] Capture expected/forbidden tools, emitted block types, latency, final output, and deterministic assertions.
- [x] Add unit tests for parsing and scoring.
- [x] Run the full local suite.
- [x] Run a small approved live smoke sample, not the full billable corpus.
- [x] Document the commands and limitations in tracked project docs.

## Completed milestone — Structured response annotations and table UX

- [x] Require a concise annotation whenever the model selects controlled UI blocks.
- [x] Keep prose-only replies separate from block annotations in the strict response schema.
- [x] Prevent table rows and known record values from being repeated in assistant prose through prompt rules and deterministic checks.
- [x] Render annotations before controlled blocks with a restrained reading width.
- [x] Keep tables full-width and horizontally scrollable inside their cards.
- [x] Anchor each new assistant reply at its annotation instead of auto-scrolling to the bottom of tall content.
- [x] Verify sales-trend and delayed-order starters at desktop and mobile widths.

## Completed milestone — Semantic Query Plan A/B pilot

### Hypothesis

A small typed semantic catalog compiled to application-owned SQL will improve business-semantic correctness and consistency over guarded free-form text-to-SQL without weakening the current safety boundary.

### Stage A — Establish the text-to-SQL control baseline

- [x] Add normalized exact/tolerance denotation assertions for scalars, rows, and chart series.
- [x] Score required filters, time field, grain, units, joins, and default exclusions.
- [x] Derive first-attempt success and repair count from tool traces.
- [x] Add at least three paraphrases for each pilot intent and run bounded serial repeats.

### Stage B — Build the semantic arm

- [x] Define a versioned pilot catalog for registered customers, active customers, eligible order count, eligible revenue, and average order value.
- [x] Define month, region, customer tier, and order status dimensions plus the approved customers-to-orders relationship.
- [x] Give every metric a stable identifier, definition, formula, unit, grain, exclusions, valid time field, allowed dimensions, and display metadata.
- [x] Add a strict `semantic_query` input containing only catalog identifiers, typed filters, date range, ordering, limit, and presentation intent.
- [x] Compile accepted plans to parameterized SQLite and emit a canonical plan hash.
- [x] Reuse the existing trusted result normalization and NLUI renderers; retain `query_dataset` unchanged as the control arm.
- [x] Reject unknown or incompatible catalog entries, invalid typed values, and injection-shaped input in unit tests.

### Stage C — Compare

- [x] Cover at minimum customer count, customers by tier, and eligible revenue by tier in both arms.
- [x] Compare denotation accuracy, semantic correctness, first-pass/repair rate, renderer consistency, latency, tokens, and run-to-run variance.
- [x] Publish a concise local experiment report with the dataset, model, prompt/catalog versions, and raw ignored JSON traces.
- [x] Keep guarded text-to-SQL as the default unless the semantic arm shows no denotation regression and a measurable reliability benefit.

### Pilot result — 2026-07-31

- Run: 9 paraphrases × 2 repeats × 2 arms = 36 bounded serial provider calls on `gpt-5.4-mini-2026-03-17`.
- Control: 18/18 exact denotations, 16/18 first-attempt success, 14/18 expected renderer, 12/18 complete passes.
- All six successful control revenue queries passed 30/30 deterministic join, time-field, grain, unit, and exclusion checks in post-run inspection.
- Semantic: 16/18 exact denotations, 17/18 first-attempt success, 6/18 expected renderer, 5/18 complete passes.
- Semantic used about 19.1% fewer tokens and was 2.8% faster in this small sample, but two lifetime-count prompts incorrectly gained acquisition time ranges.
- Decision: keep guarded SQL as production control; iterate on lifetime-versus-period semantics and application-owned presentation defaults before another promotion comparison.
- Ignored artifacts: `eval-results/semantic-query-v1-repeat2-summary.md` and `eval-results/semantic-query-v1-repeat2.json`.

## Completed milestone — Semantic Query Plan v2

### Contract hardening

- [x] Separate the lifetime `registered_customer_count` from period-required `customer_registrations`.
- [x] Reject time ranges and month grouping/filtering for lifetime customer totals by construction.
- [x] Require explicit observation windows for customer registrations and active-customer metrics.
- [x] Canonicalize provable semantic no-ops so equivalent plans share one plan hash.
- [x] Preserve different hashes for plans with materially different meaning.

### Application-owned presentation

- [x] Remove presentation selection from the provider-facing semantic tool contract.
- [x] Map scalar aggregates to metrics, monthly series to lines, one-dimensional categorical groups to bars, and record-shaped results to tables.
- [x] Ignore legacy presentation hints while retaining them only as trace evidence.
- [x] Keep concise structured-response annotations ahead of trusted blocks.

### Regression and promotion gate

- [x] Turn the v1 lifetime-range and table-instead-of-bar failures into deterministic regressions.
- [x] Run all local checks and compilation after the v2 integration.
- [x] Rerun the unchanged nine-prompt paired corpus with the existing ignored `.env` configuration.
- [x] Promote only if semantic v2 has no denotation regression and improves reliability; otherwise retain guarded SQL as the production control.

### v2 result — 2026-07-31

- Run: unchanged 9-paraphrase corpus × 2 repeats × 2 arms = 36 bounded serial provider calls.
- Control: 18/18 exact denotations, 18/18 expected UI, 18/18 first-attempt success, 18/18 complete passes.
- Semantic v2: 18/18 exact denotations, 18/18 expected UI, 18/18 first-attempt success, 18/18 complete passes.
- Semantic v2 fixed all v1 lifetime-scope and renderer failures, averaged 7.0% lower latency and 0.9% fewer tokens, and preserved the dataset fingerprint.
- A separate semantic-only smoke prompt selected `customer_registrations` with the exact December 2025 window and returned the expected count of 4 as a metric on its first attempt.
- Promotion gate: full-corpus coverage, complete denotation/UI/first-attempt, and all paired no-regression checks passed; reliability improvement failed because both arms were perfect.
- Decision: retain guarded SQL as production control. Treat Semantic v2 as a successful bounded arm, then expand the corpus before reconsidering promotion.
- Visual regression: sales-trend annotation/chart and delayed-order annotation/full-width scrollable table rendered correctly with no browser warnings or errors.
- Ignored artifacts: `eval-results/semantic-query-v2-repeat2-summary.md` and `eval-results/semantic-query-v2-repeat2.json` (configured model values redacted).

## Completed milestone — Trustworthy activity and provenance UI

### Product boundary

- [x] Use Ant Design X `Think` only for observable, application-authored live activity—not hidden model reasoning.
- [x] Use `ThoughtChain` as a selective execution/provenance receipt for analytical artifacts, multi-tool flows, actions, and failed or aborted runs.
- [x] Keep prompts, raw SQL, tool arguments, provider payloads, internal traces, and unrestricted result data out of the browser-facing activity contract.

### Runtime and UI

- [x] Add typed, sanitized activity lifecycle events with stable application-owned IDs and server-owned labels.
- [x] Cover request interpretation, tool execution, result review, completion, failure, and cancellation without silent loading gaps.
- [x] Render live activity with `Think` while preserving polite assistive-technology announcements.
- [x] Render completed receipt steps with `ThoughtChain` behind an accessible collapsed control.
- [x] Suppress persistent receipts for simple prose and single-scalar answers.

### Verification

- [x] Add deterministic server lifecycle, public-stream sanitization, multi-round ordering, and client reducer/selection/accessibility tests.
- [x] Run lint, type checking, the full 178-test suite, compilation, and the 35-scenario offline evaluation.
- [x] Visually verify simple scalar, chart, table, expanded receipt, and cancellation behavior in the browser.

### Result — 2026-07-31

- Live status advances through application-authored request, tool, and composition steps without displaying hidden model reasoning.
- Completed receipts appear only for table/chart artifacts, multi-step work, actions, failures, or cancellations; a one-metric customer-count answer remains uncluttered.
- The public HTTP stream removes legacy raw tool events, replaces provider/tool/internal diagnostics with an allowlisted safe error, and never exposes provider call IDs.
- Receipt disclosure is keyboard-operable; step icons are decorative, while completed, failed, cancelled, and in-progress states have explicit assistive text.
- Fresh browser verification covered the sales-trend chart, delayed-orders table, scalar customer count, and a cancelled multi-step analysis.

## Fresh repository review — 2026-10-14

Review scope: Bun bootstrap and filesystem dispatch, configuration/CORS/static files/uploads, data seeding and fixed queries, guarded SQL and semantic compilation, provider orchestration, structured composition, interaction capabilities/actions, React transport/rendering, evaluation tooling, documentation, and source/compiled/container packaging.

Current baseline on Bun 1.4.3: frozen install, lint/typecheck, 178 tests (620 expectations), production compilation, and the 35-scenario offline catalog validator pass. Live source and compiled HTTP/assets checks pass. A fresh Docker image builds and runs healthy as UID 1000, excludes `.env`, and executes the isolated customer-count query with result 200. Offline validation reports 55 ungraded assertions; it does not execute 35 complete end-to-end model scenarios. No billable provider calls were made during this review. UI findings are based on source inspection and React static rendering, not a new browser interaction run.

### Priority 1 — Data and test safety

- [ ] Fix the relationship-JOIN validator in `src/data/queryPolicy.ts`. Require the new source alias to participate in a positive, required equality with an already introduced alias. The current tree walk accepts a second customer alias whose ON clause references only the first alias (1,500 legitimate rows become 300,000), and accepts `(o.customer_id = c.id) = 0` (298,500 rows). Add regressions for both cases and for predicates under Boolean negation/disjunction.
- [ ] Replace timestamp-based upload names and overwriting writes with UUID identifiers and exclusive creation. Two uploads of `same.txt` with an identical millisecond clock both return 200 for the same destination; only the second content survives. Validate multipart Content-Type and malformed bodies before writing; `POST /api/upload` with JSON currently returns 500.
- [ ] Isolate the Hurl task's fixtures and cleanup. `Taskfile.tests.yaml` overwrites the root `random_file` fixture and recursively deletes the entire `uploads/` directory on Unix and Windows. Do not run that task against user-owned fixtures until it removes only its own recorded artifacts.

### Priority 2 — Runtime boundaries and reliable evaluation

- [ ] Apply canonical real-path containment and regular-file checks to static and document reads. A disposable symlink inside the supplied public directory successfully serves a sentinel outside that directory with HTTP 200. The current prefix check only constrains the lexical path.
- [ ] Require an actual provider completion event before executing a streamed tool call, issuing interaction capabilities, or emitting `message.completed`. A mock provider stream containing `response.created` and valid JSON but no `response.completed` currently succeeds and advances its response ID. Also recheck cancellation before tool execution and final publication.
- [ ] Grade effective SQL predicates instead of searching for matching AST fragments. The exclusion scorer passes `status NOT IN ('cancelled', 'returned') OR 1 = 1`, and the equality scorer passes `tier = 'gold' OR 1 = 1`. Use conservative Boolean implication checks and denotation regressions to prevent false evidence in promotion decisions.
- [ ] Resolve routes and allowed methods before CORS preflight handling; require both Origin and Access-Control-Request-Method. Current live requests return 204 for a nonexistent route and advertise DELETE on GET-only health. Preserve ordinary OPTIONS behavior and include Vary: Origin on denied/no-origin variants when response policy depends on Origin.
- [ ] Give unexpected `/api/actions` failures the same generic public-error boundary as `/api/chat`, while preserving typed domain errors. Injecting an internal diagnostic containing a filesystem path currently returns that exact diagnostic as the public 409 response.
- [ ] Add a finite request deadline and shutdown grace period. Chat currently disables its socket idle timeout, and shutdown waits on `server.stop()` without a deadline. A disposable server with an unfinished response remains alive after SIGTERM until that response is closed externally.
- [ ] Make synthetic observed-event timestamps consistent with the June 2026 snapshot. Fresh generation contains eight delivered timestamps, two shipped timestamps, three return requests, and one support-case creation after the reference instant; expected-delivery forecasts can legitimately remain future-dated. Changing the fixture requires versioning and refreshing golden denotations.

### Priority 2 — Interaction and rendering recovery

- [ ] Preserve a retry path for failed or ambiguous action-confirmation requests. `Confirmation` replaces the action UI with an error result when `/api/actions` fails; only failed chat continuation has a retry button. Reuse the same action/interaction IDs to benefit from server idempotency, and distinguish an uncertain network result from a definite domain rejection.
- [ ] Normalize cleared optional number fields before capability validation. Ant Design InputNumber emits null when cleared; the server accepts omission but rejects null even for an optional field. An optional budget cleared before submission therefore receives an invalid-interaction error.
- [ ] Render `stats` block titles and descriptions. A static-render probe confirms that both are dropped, hiding the exact product name/description in SKU follow-up responses and the order identity in summary blocks.
- [ ] Separate a form's submitting and submitted states. The current successful DynamicForm keeps its submit button loading indefinitely because one Boolean controls both locking and the spinner.

### Coverage and maintenance follow-ups

- [ ] Add automated HTTP regressions and CI around source/compiled/container behavior. The existing unit suite is strong on data and capabilities but has no server integration suite or tracked GitHub workflow, and lint excludes scripts.
- [ ] Expand deterministic scenario grading beyond the current 17 assertions/25 rules; 55 catalog assertions are still ungraded. Implement isolated adapters for multi-turn conversations and route confirmations before reporting comprehensive end-to-end coverage.
- [ ] Update architecture documentation to describe public `activity.updated` events; it still lists `tool.started`/`tool.completed`, which the public stream filters out.
- [ ] Resolve the low-severity transitive KaTeX advisory GHSA-238p-pmpm-9mq7 through compatible upstream dependency upgrades. Installed KaTeX is 0.16.47; the advisory's patched release is 0.18.2. Its exploitation requires separate prototype pollution and unsafe output insertion; neither was demonstrated here, and the current Markdown renderer uses DOMPurify.

Suggested bounded milestones: (1) SQL/file/upload/test safety, (2) provider/action/form failure recovery and HTTP lifecycle, (3) trustworthy semantic grading, coherent fixtures, and automated evaluation coverage. Preserve the current JSON-schema envelope, server-owned block catalog, and explicit confirmation capabilities.
