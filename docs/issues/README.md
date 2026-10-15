# NLUI Issues Registry

This is the tracked, authoritative ledger for defects, verification gaps and research milestones. Each issue has a permanent `NLUI-NNN` ID and one Markdown file. Use [TEMPLATE.md](TEMPLATE.md), check for duplicates and update this index whenever status or priority changes. The ignored root TODO.md is only a pointer; it is no longer a second backlog.

Statuses: **Open**, **In progress**, **Blocked**, **Deferred**, **Closed**. Close only after recording the resolution and evidence against acceptance criteria. Passing baseline checks alone does not close a behavioral defect. Do not reuse IDs or silently discard historical decisions.

Priorities: **P0** critical immediate failure; **P1** high-impact correctness, data loss, secret exposure or delivery blocker; **P2** normal defects and bounded improvements; **P3** low-impact maintenance.

## Current ledger

32 issues: **10 Open**, **0 In progress**, **0 Blocked**, **0 Deferred**, **22 Closed**. Open priorities: **8 P2**, **2 P3**. No open P0/P1 issues. Next ID: **NLUI-033**.

Latest milestone: [Hosted CI qualification](reviews/2026-10-15-ci-qualification.md). [Run 38721607962](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962) passes Linux/macOS source-and-compiled jobs and the separate Linux production-container job; NLUI-015 is Closed. Both matrix jobs pass 628 tests and both HTTP modes. The reference profile remains 28 passed/seven explicitly incomplete; no live model experiment, retained-data reset, branch-policy change or deployment is claimed.

| ID | Priority | Status | Finding or milestone |
| --- | --- | --- | --- |
| [NLUI-001](NLUI-001.md) | P1 | Closed | Require positive, in-scope foreign-key JOIN predicates |
| [NLUI-002](NLUI-002.md) | P1 | Closed | Make upload allocation exclusive and validate multipart input |
| [NLUI-003](NLUI-003.md) | P1 | Closed | Isolate HTTP smoke fixtures and cleanup from retained data |
| [NLUI-004](NLUI-004.md) | P2 | Closed | Enforce real-path containment for static and document reads |
| [NLUI-005](NLUI-005.md) | P2 | Closed | Require provider terminal completion before publishing a turn |
| [NLUI-006](NLUI-006.md) | P2 | Closed | Grade effective SQL predicates rather than matching fragments |
| [NLUI-007](NLUI-007.md) | P2 | Open | Make CORS preflights route- and method-aware |
| [NLUI-008](NLUI-008.md) | P2 | Closed | Sanitize unexpected action errors at the public boundary |
| [NLUI-009](NLUI-009.md) | P2 | Closed | Bound request duration and shutdown grace periods |
| [NLUI-010](NLUI-010.md) | P2 | Closed | Align observed fixture timestamps with the snapshot |
| [NLUI-011](NLUI-011.md) | P2 | Closed | Preserve confirmation retries and reconcile ambiguous outcomes |
| [NLUI-012](NLUI-012.md) | P2 | Closed | Normalize cleared optional numeric form values |
| [NLUI-013](NLUI-013.md) | P2 | Closed | Display statistic block titles and descriptions |
| [NLUI-014](NLUI-014.md) | P2 | Closed | Separate form submission progress from completed state |
| [NLUI-015](NLUI-015.md) | P2 | Closed | Automate source, compiled and container qualification in CI |
| [NLUI-016](NLUI-016.md) | P2 | Closed | Complete deterministic evaluation coverage and trace accounting |
| [NLUI-017](NLUI-017.md) | P3 | Open | Document the sanitized public activity protocol |
| [NLUI-018](NLUI-018.md) | P3 | Open | Resolve the transitive KaTeX advisory through a compatible upgrade |
| [NLUI-019](NLUI-019.md) | P2 | Open | Expand the versioned semantic catalog and paired query experiments |
| [NLUI-020](NLUI-020.md) | P2 | Open | Run a controlled A2UI and Ant Design X Card experiment |
| [NLUI-021](NLUI-021.md) | P2 | Open | Add artifact-aware analytical refinements and provenance |
| [NLUI-022](NLUI-022.md) | P2 | Open | Persist replayable provider-neutral conversation events |
| [NLUI-023](NLUI-023.md) | P2 | Open | Evaluate adversarial data, exact query scope and principal authorization |
| [NLUI-024](NLUI-024.md) | P2 | Open | Polish control lifecycle, accessibility and dataset onboarding UX |
| [NLUI-025](NLUI-025.md) | P1 | Closed | Establish server-verified interaction capabilities |
| [NLUI-026](NLUI-026.md) | P2 | Closed | Establish executable offline and opt-in live evaluation v1 |
| [NLUI-027](NLUI-027.md) | P2 | Closed | Establish structured annotations and internally scrollable table UX |
| [NLUI-028](NLUI-028.md) | P2 | Closed | Complete the semantic-query A/B pilot and retain the control |
| [NLUI-029](NLUI-029.md) | P2 | Closed | Harden semantic-query v2 scope and owned presentation |
| [NLUI-030](NLUI-030.md) | P2 | Closed | Establish observable activity and selective provenance receipts |
| [NLUI-031](NLUI-031.md) | P2 | Open | Qualify the seven remaining language and visible-product assertions |
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

Next bounded milestones, in order:

1. Trustworthy evaluation: qualify the seven explicitly unsupported language/visible-product assertions (NLUI-031). Hosted CI qualification (NLUI-015), classification/adapters/trace accounting (NLUI-016), effective predicates (NLUI-006), coherent fixtures (NLUI-010) and embedded SQL worker resolution (NLUI-032) are complete.
2. Evidence-led research: expand the semantic comparison (NLUI-019), then artifact refinement/provenance (NLUI-021), controlled A2UI (NLUI-020), durable transport (NLUI-022) and adversarial tenancy (NLUI-023).

The bounded control-recovery work (NLUI-011 through NLUI-014), file/provider boundaries and public-error/request/shutdown protection (NLUI-004/005/008/009) are complete. Broader control accessibility/onboarding polish remains NLUI-024.

CORS, protocol documentation and the dependency advisory remain independently tracked in NLUI-007, NLUI-017 and NLUI-018.

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
