# NLUI Issues Registry

This is the tracked, authoritative ledger for defects, verification gaps and research milestones. Each issue has a permanent `NLUI-NNN` ID and one Markdown file. Use [TEMPLATE.md](TEMPLATE.md), check for duplicates and update this index whenever status or priority changes. The ignored root TODO.md is only a pointer; it is no longer a second backlog.

Statuses: **Open**, **In progress**, **Blocked**, **Deferred**, **Closed**. Close only after recording the resolution and evidence against acceptance criteria. Passing baseline checks alone does not close a behavioral defect. Do not reuse IDs or silently discard historical decisions.

Priorities: **P0** critical immediate failure; **P1** high-impact correctness, data loss, secret exposure or delivery blocker; **P2** normal defects and bounded improvements; **P3** low-impact maintenance.

## Current ledger

32 issues: **0 Open**, **0 In progress**, **0 Blocked**, **0 Deferred**, **32 Closed**. Open priorities: **0 P2**, **0 P3**. Next ID: **NLUI-033**; existing IDs remain permanent.

Latest hosted implementation: **1.6.3**, `3b1150ca3fd6edbf1970d598eb4bc50b2ead476e`, passes **all three jobs** in [run 38750393451](https://github.com/skitsanos/nlui-demo/actions/runs/38750393451). Linux/macOS each pass **812 tests / 2,624 expectations**, lint/typecheck, **60 source + 60 compiled Hurl requests plus eight separate-session probes per mode**, and all **35 exact reference cases**. The Linux production-container gate passes non-root HTTP/data/permissions/health/shutdown and its reference cases. [Publication reconciliation](reviews/2026-10-15-owned-workflows.md#hosted-publication-and-ci-reconciliation) records exact jobs, both corrected failures, native cleanup/lock regressions and limits. NLUI-018 and NLUI-021 are reclosed. The evidence-only **1.6.4** follow-up bumps the version before its push and receives its own full workflow; the earlier run is not assumed to qualify a later head.

Preserved initial failures: 1.6.0 [run 38748113060](https://github.com/skitsanos/nlui-demo/actions/runs/38748113060) failed Linux typechecking because two fixtures used `plugins/latex` instead of published `plugins/Latex`; macOS passed. The corrected-import 1.6.1 [run 38748715543](https://github.com/skitsanos/nlui-demo/actions/runs/38748715543) passed Linux but exposed a macOS analytical-revision `SQLITE_BUSY` race; the dependent container job was skipped. Real fixes and regression tests followed; no check was disabled, waived or replaced by blind retry.

Intermediate 1.6.2 [run 38749702794](https://github.com/skitsanos/nlui-demo/actions/runs/38749702794) passed all three jobs with 810 tests/platform after ordered worker cleanup and finite revision lock waits. Version 1.6.3 additionally finalizes worker/seeder native statements with `close(true)` and proves immediate release without GC. Its affected test group passes twenty local repetitions (**200 tests / 920 expectations**) and separate Linux probes, as well as the full hosted run above.

Milestone scope: [Owned workflows](reviews/2026-10-15-owned-workflows.md) and [bounded research](reviews/2026-10-15-remaining-research.md) close NLUI-019 through NLUI-024 in the approved isolated anonymous local-demo scope. Durable replay/capabilities, exact SQL fields and fresh intent, immutable analytical refinements/receipts, quarantined CSV inspection and keyboard/mobile interaction are verified. Browser evidence includes mobile tables, mutation-once refresh, exact scope and opt-in X Card. Original 803-test local evidence is preserved separately from the later 812-test hosted result; dependency audit and secret/exclusion checks are clean.

The approved **40/40 provider-attempt budget is exhausted**: 36 complete usage records and four preserved schema-format failures, with monetary cost explicitly unpriced. Expanded guarded SQL/semantic/hybrid denotations all pass 4/4; there is no demonstrated reliability gain. Corrected A2UI samples qualify 4/4 but do not establish an advantage over controlled blocks. **Guarded SQL and controlled rendering remain defaults.** Machine-only refinement measurements do not establish human productivity gains; anonymous session isolation does not establish authenticated tenancy or production security. The retained v1 database and ignored provider configuration remain untouched.

[Maintenance qualification](reviews/2026-10-15-maintenance-qualification.md) records the earlier NLUI-007/017/018 CORS, protocol and KaTeX fixes; its 727-test/48-request counts are historical. The owned protocol now replaces the earlier provider-continuation exception with application cursors.

Previous published baseline: 1.5.1 at `6f162dc3bc5b1dfff64b2b35e0b6fc52f389e54c`, with all three jobs passing in [run 38728507247](https://github.com/skitsanos/nlui-demo/actions/runs/38728507247). Its 717-test/38-request evidence is historical. [Presentation qualification](reviews/2026-10-15-presentation-qualification.md) and [CI qualification](reviews/2026-10-15-ci-qualification.md) preserve earlier milestones. Retained data/provider settings and deployment remain unchanged.

| ID | Priority | Status | Finding or milestone |
| --- | --- | --- | --- |
| [NLUI-001](NLUI-001.md) | P1 | Closed | Require positive, in-scope foreign-key JOIN predicates |
| [NLUI-002](NLUI-002.md) | P1 | Closed | Make upload allocation exclusive and validate multipart input |
| [NLUI-003](NLUI-003.md) | P1 | Closed | Isolate HTTP smoke fixtures and cleanup from retained data |
| [NLUI-004](NLUI-004.md) | P2 | Closed | Enforce real-path containment for static and document reads |
| [NLUI-005](NLUI-005.md) | P2 | Closed | Require provider terminal completion before publishing a turn |
| [NLUI-006](NLUI-006.md) | P2 | Closed | Grade effective SQL predicates rather than matching fragments |
| [NLUI-007](NLUI-007.md) | P2 | Closed | Make CORS preflights route- and method-aware |
| [NLUI-008](NLUI-008.md) | P2 | Closed | Sanitize unexpected action errors at the public boundary |
| [NLUI-009](NLUI-009.md) | P2 | Closed | Bound request duration and shutdown grace periods |
| [NLUI-010](NLUI-010.md) | P2 | Closed | Align observed fixture timestamps with the snapshot |
| [NLUI-011](NLUI-011.md) | P2 | Closed | Preserve confirmation retries and reconcile ambiguous outcomes |
| [NLUI-012](NLUI-012.md) | P2 | Closed | Normalize cleared optional numeric form values |
| [NLUI-013](NLUI-013.md) | P2 | Closed | Display statistic block titles and descriptions |
| [NLUI-014](NLUI-014.md) | P2 | Closed | Separate form submission progress from completed state |
| [NLUI-015](NLUI-015.md) | P2 | Closed | Automate source, compiled and container qualification in CI |
| [NLUI-016](NLUI-016.md) | P2 | Closed | Complete deterministic evaluation coverage and trace accounting |
| [NLUI-017](NLUI-017.md) | P3 | Closed | Document the sanitized public activity protocol |
| [NLUI-018](NLUI-018.md) | P3 | Closed | Resolve the transitive KaTeX advisory through a compatible upgrade |
| [NLUI-019](NLUI-019.md) | P2 | Closed | Expand the versioned semantic catalog and paired query experiments |
| [NLUI-020](NLUI-020.md) | P2 | Closed | Run a controlled A2UI and Ant Design X Card experiment |
| [NLUI-021](NLUI-021.md) | P2 | Closed | Add artifact-aware analytical refinements and provenance |
| [NLUI-022](NLUI-022.md) | P2 | Closed | Persist replayable provider-neutral conversation events |
| [NLUI-023](NLUI-023.md) | P2 | Closed | Evaluate adversarial data, exact query scope and principal authorization |
| [NLUI-024](NLUI-024.md) | P2 | Closed | Polish control lifecycle, accessibility and dataset onboarding UX |
| [NLUI-025](NLUI-025.md) | P1 | Closed | Establish server-verified interaction capabilities |
| [NLUI-026](NLUI-026.md) | P2 | Closed | Establish executable offline and opt-in live evaluation v1 |
| [NLUI-027](NLUI-027.md) | P2 | Closed | Establish structured annotations and internally scrollable table UX |
| [NLUI-028](NLUI-028.md) | P2 | Closed | Complete the semantic-query A/B pilot and retain the control |
| [NLUI-029](NLUI-029.md) | P2 | Closed | Harden semantic-query v2 scope and owned presentation |
| [NLUI-030](NLUI-030.md) | P2 | Closed | Establish observable activity and selective provenance receipts |
| [NLUI-031](NLUI-031.md) | P2 | Closed | Qualify the seven remaining language and visible-product assertions |
| [NLUI-032](NLUI-032.md) | P1 | Closed | Resolve the embedded SQL worker from the compiled entrypoint |

## Migration and execution order

The [frozen roadmap](reviews/2026-10-14-roadmap-migration.md) preserves every original checklist, hypothesis and recorded result for reference. It is historical evidence, not an active checklist. Earlier unchecked semantic-catalog boxes are reconciled with the later completed pilot/v2 work.

| Original TODO section | Authoritative issues |
| --- | --- |
| Phase 0 interaction capabilities | NLUI-025; remaining principal boundary in NLUI-023 |
| Direction 1 evaluation laboratory | NLUI-026 (v1), NLUI-016 (classification/adapters/trace complete), NLUI-031 (remaining semantic qualification) |
| Direction 2 semantic catalog and SQL comparison | NLUI-028 and NLUI-029 (completed arms), NLUI-019 (expansion) |
| Direction 3 A2UI / X Card | NLUI-020 |
| Direction 4 artifact-aware analysis | NLUI-021 |
| Direction 5 durable transport/history | NLUI-022 |
| Direction 6 adversarial trust and authorization | NLUI-023; individual reviewed defects NLUI-001 and NLUI-004 through NLUI-009 |
| Supporting product work | NLUI-024; concrete recovery defects NLUI-011 through NLUI-014; history NLUI-022 |
| Completed annotations/table and activity milestones | NLUI-027 and NLUI-030 |
| Fresh repository review | NLUI-001 through NLUI-018 |

All existing milestones are closed with bounded evidence; there is no second hidden backlog. Negative/inconclusive research outcomes do not promote a candidate. Further statistically powered model comparisons, participant usability studies or production identity/row-tenancy integration need new separately scoped issues and approval, not a claim inferred from these closed local-demo milestones.

On 2026-10-15 the user approved forty billable attempts and isolated anonymous local ownership, then explicitly authorized committing/pushing all changes and fixing hosted failures. The provider cap is exhausted and was not increased or used during publication/CI. Production identity/tenancy remains outside the approved scope. Every push is version-bumped and each final head must pass its own hosted checks.

## Established baseline and working principles

- Bun full-stack server, React, Ant Design and Ant Design X.
- Server-owned controlled catalog: statistics, charts, tables, choices, forms, confirmations, sources and results; strict tools and JSON-schema response envelopes. No model-generated React/HTML/routes/validation or mutation callbacks.
- Deterministic synthetic SQLite dataset, fixed tools and guarded text-to-SQL with AST checks, canonicalization, isolated read-only workers, time/row limits; a parameterized semantic query arm remains experimental.
- Fixture v2 pins its exact inclusive observed-event snapshot, logical fingerprint and golden-file hashes; forecasts may extend later. Existing incompatible databases require an explicit backed-up reset or separate fixture file.
- Opaque, scoped, two-phase confirmation and server-validated typed UI results.
- Conversational annotations, readable dates, full-width internally scrollable tables, reply-start anchoring and selective observable activity receipts.
- Retryable form states, contract-normalized optional numeric input, and accessible statistic titles/descriptions without changing metric values.
- 35 golden specifications are a catalog, not proof of 35 complete live end-to-end executions.
- Every assertion is executable or explicitly unsupported. Owned provider-free reference runs establish plumbing; incomplete, stale, failed or unverified evidence cannot qualify a candidate. Usage/cost coverage is explicit, never assumed complete or free.
- Every major architectural change needs a baseline, hypothesis, experiment arm and measurable outcome. Preserve controlled rendering and guarded SQL as controls until evidence supports replacement.
- The application owns semantics, validation, permissions, action wiring and catalogs. Model output and dataset text are untrusted.
- Prefer deterministic denotation and safety checks over subjective grading. Live model evaluations must remain explicit, bounded and opt-in because they are billable.
- Predicate grading uses conservative output-scope Boolean proof, separate from denotation. Every required alternative must prove the constraint; unsupported lineage is unproven. Candidate promotion requires all required deterministic evidence to pass.
- Reuse ignored local provider configuration; never put credentials, configured model values, unrestricted trace data or retained user records in issue evidence.

## Reviews and evidence

- [2026-10-15 owned workflows](reviews/2026-10-15-owned-workflows.md): durable ownership/replay, exact SQL scope/intent, artifacts, accessibility/quarantine and browser evidence; initial 803-test local results, corrected CI failures, 812-test hosted qualification and scope limits preserved.
- [2026-10-15 remaining research](reviews/2026-10-15-remaining-research.md): catalog v3/four-arm pilot, A2UI/X Card experiment, typed refinement protocol benchmark, hard forty-attempt accounting, partial usage/unpriced cost and explicit no-promotion conclusion.
- [2026-10-15 maintenance qualification](reviews/2026-10-15-maintenance-qualification.md): route-aware preflight and cache policy, documented/projected public activity, qualified patched KaTeX, 727-test/source/compiled/container gates and browser Markdown/math safety; no paid or hosted verification for these working changes.
- [2026-10-15 presentation qualification](reviews/2026-10-15-presentation-qualification.md): seven bounded presentation/language contracts, independent rendered criteria, strict policy captions, 35 passing reference cases, regressions and local source/compiled/container plus desktop/mobile evidence; not live-model or general-language qualification.
- [2026-10-15 CI qualification](reviews/2026-10-15-ci-qualification.md): safe workflow contract, mandatory tool installation, source/compiled/container gates, owned cleanup, local evidence and all three hosted jobs passing after authorized publication.
- [2026-10-15 deterministic evaluation](reviews/2026-10-15-deterministic-evaluation.md): complete assertion classification, isolated route/trajectory adapters, adversarial expression/denotation checks, safe trace accounting, fail-closed promotion and compiled worker qualification.
- [2026-10-15 snapshot fixture](reviews/2026-10-15-snapshot-fixture.md): uniform lifecycle alignment, full observed-field validation, v2 fingerprint, unchanged golden denotations, isolated tools and source/compiled seed checks.
- [2026-10-15 SQL predicate grading](reviews/2026-10-15-sql-predicate-grading.md): effective Boolean proof, scope/alias resolution, real SQLite counterexamples, fail-closed grading and candidate promotion.
- [2026-10-15 control UX](reviews/2026-10-15-control-ux.md): normalized form values, settled submission state, statistic context, real source/compiled route regressions and desktop/mobile browser checks.
- [2026-10-15 confirmation recovery](reviews/2026-10-15-confirmation-recovery.md): structured action outcomes, original-ID retries, SQLite mutation-once proof, separate chat continuation and rendered browser checks.
- [2026-10-15 action/lifecycle protection](reviews/2026-10-15-action-lifecycle.md): safe typed/public errors, cancellable chat budgets, SQL worker aborts, real source/compiled process shutdown and Linux qualification.
- [2026-10-14 file/provider boundaries](reviews/2026-10-14-file-provider-boundaries.md): canonical file reads, explicit terminal events, cancellation/retry state and macOS/source/compiled/Linux verification.
- [2026-10-14 safety milestone](reviews/2026-10-14-safety-milestone.md): corrected boundaries, regressions and source/compiled qualification.
- [2026-10-14 roadmap migration](reviews/2026-10-14-roadmap-migration.md): frozen historical roadmap and initial fresh-review evidence.
