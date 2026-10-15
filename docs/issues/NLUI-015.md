# NLUI-015: Automate source, compiled and container qualification in CI

- Status: In progress
- Priority: P2
- Kind: Verification gap
- Created: 2026-10-14
- Updated: 2026-10-15
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

- [ ] Record the first hosted Linux/macOS source/compiled jobs and Linux container job passing static checks, regressions, offline evaluation and probes after an authorized push.
- [x] Scripts receive lint coverage without generated artifacts.
- [x] Non-billable tests never execute valid provider requests or touch retained state.

## Resolution

Implementation and local qualification complete; hosted-run acceptance remains pending. See [the recorded verification and initial diagnostics](reviews/2026-10-15-ci-qualification.md) and [command/security contract](../verification.md).

The new workflow defines read-only, SHA-pinned push/PR/manual Linux/macOS source-and-compiled jobs, then a Linux production-container job. Current Bun, frozen application dependencies and mandatory Hurl are explicit. The shared Bun commands withhold provider configuration, disable dotenv loading, bound subprocess execution and clean only owned binaries/container/tag. Container probes use the production image without external networking or retained mounts and cover non-root permissions, uploads, lazy seed/SQL, overridden-port health, all 35 reference cases and successful shutdown. The seven unsupported reference cases remain incomplete, not passing model evaluations.

31 new regressions pass; `bun run verify:all` exits zero with Biome 235 files, TypeScript, 628 tests / 2032 expectations across 78 files, 38 source plus 38 compiled HTTP requests, source-free compiled worker evaluation and actual Docker/Linux arm64 production qualification. actionlint and the exact Hurl installation also pass. No provider calls, retained-data reset, commit, push, hosted dispatch or branch-policy change was performed. Keep this issue In progress until the first hosted result is recorded rather than presenting local execution as remote CI evidence.
