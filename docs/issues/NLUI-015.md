# NLUI-015: Automate source, compiled and container qualification in CI

- Status: Closed
- Priority: P2
- Kind: Verification gap
- Created: 2026-10-14
- Updated: 2026-10-16
- Scope: package.json; biome.json; Taskfile.tests.yaml; Dockerfile; .github/workflows
- Evidence: 2026-10-14 repository review

## Problem

At the initial review, manual source/compiled/container evidence was not an automated delivery gate and lint omitted the older evaluation/seed scripts. NLUI-016 subsequently completed source/script/test lint coverage; this milestone implements the automated gates and retains the first hosted run as an explicit verification requirement.

## Evidence and reproduction

The initial review found no HTTP integration suite or tracked GitHub workflow. NLUI-003 supplies isolated source/compiled HTTP tests. NLUI-016 subsequently extended lint to all source, scripts and test modules; CI/container automation remains unfinished at the start of this milestone.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Build on the new isolated runner; add deterministic server integration regressions and source/compiled/container CI, include scripts in static checks and explicitly declare Hurl prerequisites.

## Acceptance criteria

- [x] Record the first hosted Linux/macOS source/compiled jobs and Linux container job passing static checks, regressions, offline evaluation and probes after an authorized push.
- [x] Scripts receive lint coverage without generated artifacts.
- [x] Non-billable tests never execute valid provider requests or touch retained state.

## Resolution

Closed after [Qualification run 38721607962](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962) passed all three hosted jobs on 2026-10-15 for `6a41630318af59630045789ed4f7b46dc8dd511c` (release 1.4.0). See [the recorded local/hosted evidence and initial diagnostics](reviews/2026-10-15-ci-qualification.md) and [command/security contract](../verification.md).

The new workflow defines read-only, SHA-pinned push/PR/manual Linux/macOS source-and-compiled jobs, then a Linux production-container job. Current Bun, frozen application dependencies and mandatory Hurl are explicit. The shared Bun commands withhold provider configuration, disable dotenv loading, bound subprocess execution and clean only owned binaries/container/tag. Container probes use the production image without external networking or retained mounts and cover non-root permissions, uploads, lazy seed/SQL, overridden-port health, all 35 reference cases and successful shutdown. The seven unsupported reference cases remain incomplete, not passing model evaluations.

31 new regressions pass; local `bun run verify:all` exits zero with Biome 235 files, TypeScript, 628 tests / 2032 expectations across 78 files, 38 source plus 38 compiled HTTP requests, source-free compiled worker evaluation and Docker/Linux arm64 production qualification. Hosted Ubuntu 24.04 x64 and macOS 26 arm64 each pass the same 628 tests, offline/reference gates and both HTTP modes. The separate hosted Linux x64 production-image job passes its non-root HTTP, lazy seed/SQL, health, reference and shutdown probes. All three commit check-runs conclude success; no failure was waived or repaired. Bun 1.4.3 and native Hurl 8.0.1 were observed, not imposed as exact requirements.

The user authorized publication of all pending work; release 1.4.0 was committed/pushed, and this closure/evidence follow-up bumps to 1.4.1 before its own push. No provider calls, retained-data reset, manual hosted dispatch or branch-policy change was performed. Windows, deployment and branch protection are not qualified by these results.

Subsequent qualification on 2026-10-15: [run 38727922140](https://github.com/skitsanos/nlui-demo/actions/runs/38727922140) passes all three hosted jobs for release 1.5.0, `cc4c00d016dbc698d925e011699adb7311fcfc52`. NLUI-031 replaces the earlier seven incomplete reference cases with bounded rendered/question/policy contracts: 717 tests pass on each matrix platform and all 35 reference cases pass in each execution mode. See [the later presentation review](reviews/2026-10-15-presentation-qualification.md) for exact jobs, fingerprints and limits. The original closure evidence above remains historical, not the current case classification.

Remaining-milestone publication: release 1.6.3, `3b1150ca3fd6edbf1970d598eb4bc50b2ead476e`, passes all three jobs in [run 38750393451](https://github.com/skitsanos/nlui-demo/actions/runs/38750393451). Hosted Linux/macOS each pass 812 tests / 2,624 expectations, lint/typecheck, 60 source and 60 compiled Hurl requests plus eight separate-session probes per mode, and all 35 exact reference cases. The production container passes non-root HTTP/data/permissions/health/shutdown and reference gates. [Publication reconciliation](reviews/2026-10-15-owned-workflows.md#hosted-publication-and-ci-reconciliation) records the initial Linux plugin-case failure and macOS SQLite contention failure, regression fixes, successful runs and scope limits. No checks were disabled or waived. The registry/evidence-only follow-up bumps to 1.6.4 before its push and must pass its own workflow; this earlier run is not silently reused as current-head evidence.

Presentation-research publication on 2026-10-16: **1.7.0**, `8446350366f2d8752f47d632a305a2b6e0c6c572`, passes all three jobs in [run 38869687421](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421). Both matrix platforms pass **912 tests / 4,682 expectations**, static/offline gates, 60 source + 60 compiled Hurl requests with separate-session probes and all 35 exact references; the Linux production container passes its full non-root/HTTP/data/permissions/health/shutdown/reference gate. No failure, waived check or rerun occurred. [The receipt](reviews/2026-10-16-publication.md) preserves exact job IDs and scope. No provider calls were made; both exhausted ledgers and retained configuration/data are unchanged. The evidence-only 1.7.1 follow-up receives its own full workflow before handoff.
