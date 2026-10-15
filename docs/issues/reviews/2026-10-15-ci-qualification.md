# Source, compiled and container CI qualification — 2026-10-15

Scope: NLUI-015. Existing pending milestones and user dependency changes are preserved. The implementation/local verification phase below did not publish or change the project version. The subsequent user-authorized release and successful hosted run are recorded under Hosted qualification. No repository-policy change, live provider request, retained-data reset or manual remote workflow dispatch was performed.

## Implementation

The new [qualification workflow](../../../.github/workflows/qualification.yml) defines push, ordinary pull-request and manual triggers with read-only contents permission, SHA-pinned checkout/setup actions, non-persisted checkout credentials and bounded per-ref cancellation. Linux/macOS run source and compiled gates; a Linux production-container job follows both. Current Bun and a frozen application lockfile are explicit. The official Hurl wrapper is installed separately in the runner's temporary tools directory with explicit package-script trust, not added to application dependencies. No secrets, privileged PR trigger, publishing or allowed-failure gate is configured.

The shared Bun runner executes `verify`, `test:compiled`, `test:docker` and `verify:all`. Source mode requires Hurl before any gate and runs lint/type/tests, offline validation, the 38-request source suite and the exact provider-free profile. Compiled mode creates owned production binaries with both entrypoints, runs the same HTTP suite and executes its reference binary without a source/dependency fallback. Existing `dist/demo` is not overwritten or removed. Static checks already included all scripts/tests after NLUI-016; the new modules remain covered without linting generated output.

The production Docker image now follows current Bun via `oven/bun:latest`, pulled during qualification, while application dependencies remain frozen and production-only. The runner creates a unique labelled container with no external network, published ports, provider credentials or retained mounts. A copied `/tmp` probe exercises the real app, not a test endpoint: UID, package exclusions, writable data/uploads, HTTP/docs/config/malformed boundaries, upload byte preservation, lazy default-path v2 seed and real read-only SQL. Docker's actual health command must pass on overridden port 3180. The full 35-case reference profile also executes with production dependencies, then SIGTERM must exit zero.

Qualification subprocesses withhold inherited provider settings, disable dotenv loading and force live evaluation off; the development `.env` is unchanged. Captured diagnostics are withheld from generic failures. Command deadlines and cancellation kill subprocess groups on Linux/macOS; cleanup runs in `finally` and targets only owned directories/container/tag. Ambiguous container-create acknowledgement triggers exact-name cleanup, and image removal is attempted even if container removal fails. There are no prune/volume-delete commands or retained mounts. Build cache and pulled parent layers are intentionally left alone.

The profile validator pins 35 unique case results and the identities of the seven expected incomplete cases, not just aggregate counts. Unsupported language claims remain incomplete and ineligible for promotion; the green reference gate is not a model-quality result.

## Regression coverage

31 new tests across five modules cover:

- Workflow triggers/matrix/dependencies/deadlines, read-only permissions, full action SHAs, no persisted credentials/secrets, explicit Hurl installation, frozen dependencies and all package gate commands.
- Withheld provider configuration without caller mutation, missing-Hurl preflight, ordered/fail-fast source gates, real child environment/exit behavior, deadlines/cancellation and drift/duplicates/missing reference results.
- Compiled entrypoints, production flags, no-env-file execution, source-free layout and owned-directory preservation/cleanup at build, HTTP, reference-build, profile-failure and success boundaries.
- Network/mount/credential-free container arguments, startup/probe/reference/stop failures, unhealthy/never-ready/nonzero exits, exact-resource cleanup and removal-error handling.
- Frozen production-only image inputs, non-root/writable paths, port-aware health and exclusion of credentials, retained data, tests, reports and CI files.

## Fresh verification

| Gate | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3 on macOS arm64; 240 installs across 266 packages checked, no dependency changes |
| Workflow validation | actionlint 1.7.12 passes; checkout v7.0.1/setup-bun v2.2.0 identities verified against their official repository refs |
| Hurl installation | Exact workflow package installation succeeds in an owned tools directory; wrapper 8.0.4 reports native Hurl 8.0.1 |
| `bun run verify:all` | Entire source → compiled → container sequence exits zero |
| Static / regression | Biome 235 files, TypeScript passes; 628 tests / 2032 expectations across 78 files, zero failures |
| Offline / source reference | 35 specifications, 70 executable labels / 93 deterministic rules / 100 configured rules / seven unsupported / zero unconfigured; exact 28 passed/seven incomplete profile |
| Source / compiled HTTP | 38 requests pass in each mode; production server bundles 3491 modules |
| Compiled reference | Production CLI bundles 406 modules and preserves the exact profile without source/dependency fallback |
| Production container | Docker 29.8.2, Linux arm64, Bun 1.4.3, UID 1000; actual HTTP, default lazy seed/SQL worker, uploads, port override, health, reference and zero-exit shutdown pass with production-only dependencies and no external network |
| Image identity | Pulled Bun base manifest `sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598`; runtime version recorded, not enforced as an exact release |
| Owned cleanup | After successful/failing real runs, no `io.nlui.qualification` labelled containers or tagged test images remain; temporary binaries/install fixtures are removed |

At the local-only boundary, registry validation confirmed 32 permanent issues: 21 Closed, ten Open (eight P2/two P3) and NLUI-015 In progress, with synchronized index/status rows and 114 valid relative registry/verification links. Configured-value scanning across 222 changed/untracked files found no key/model matches; `.env`, TODO.md, retained SQLite, compiled output and evaluation reports remain ignored. New qualification modules and tests are at most 79 lines; `git diff --check` passes. Read-only inspection confirms the retained default database still has `user_version=1`. No owned labelled container or test image remains after the full run.

## Hosted qualification and authorized publication

All 222 pending changed/new files were committed on `main` as release 1.4.0, commit `6a41630318af59630045789ed4f7b46dc8dd511c`, after the user explicitly authorized committing/pushing everything and bumping the version. Pre-publication scanning checked all 320 indexed files against the configured key/model values and credential/private-file patterns with no findings; generated databases, credentials, reports and compiled artifacts remained excluded. All five committed screenshots were visually checked and contain disposable synthetic fixtures only. Frozen install, actionlint and the complete local `verify:all` gate passed again before publication.

[Qualification run 38721607962](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962), run number 1, was triggered by that push and completed successfully on 2026-10-15 at 10:40:31 UTC. The workflow and all three commit check-runs report success:

| Hosted job | Observed environment | Result |
| --- | --- | --- |
| [Source and compiled (ubuntu-latest)](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962/job/116377260568) | Ubuntu 24.04, Linux x64, Bun 1.4.3, native Hurl 8.0.1 | 628 tests across 78 files, lint/typecheck, offline/reference, 38 source plus 38 compiled HTTP requests and source-free embedded-worker reference all pass |
| [Source and compiled (macos-latest)](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962/job/116377260754) | macOS 26 arm64, Bun 1.4.3, native Hurl 8.0.1 | The same full source/compiled gates and 628 tests pass |
| [Production container (Linux)](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962/job/116377983661) | Ubuntu 24.04 host, Linux x64 production image, Bun 1.4.3, UID 1000 | Frozen production-only build, actual HTTP/upload/data/SQL, overridden port 3180, Docker healthcheck, exact reference profile and successful SIGTERM exit pass |

No failures required a fix or retry and no check was waived. GitHub emitted only informational notices about upcoming Ubuntu-label migration and macOS arm64 capacity; those are not failed checks. The seven unsupported reference cases remain explicitly incomplete, not evidence of full linguistic/model correctness. The follow-up closure/evidence commit bumps the project to 1.4.1 before its push, as required by AGENTS.md; its current-commit checks must also be verified rather than assuming this earlier run covers it.

## Retained diagnostics

The first tool-installer experiment used unsupported global directory flags; Bun correctly rejected them. An isolated local tool install then succeeded but Hurl could not start because its binary-install script had not run. The corrected workflow uses an owned tools directory and explicit `bun add --trust` for only the pinned official wrapper, and its real CLI starts successfully. Application dependencies/trust configuration were not changed.

The first real container probe expected `/api/config.server.port` to reflect the environment override. That endpoint intentionally reports the YAML configuration, whereas the listener and healthcheck use the effective port. The corrected probe proves successful requests and actual Docker health at 3180 instead of changing product behavior to satisfy an incorrect assertion. That failed run removed its owned container/image; later complete runs above passed.

## Disposition and verification limits

**NLUI-015 is Closed** after the implementation, local gates and all three first hosted jobs passed. The registry now contains 32 permanent issues: 22 Closed, ten Open (eight P2/two P3), none In progress; next ID remains NLUI-033. Required-check/branch-protection settings are separate remote policy; none was modified or claimed.

Evidence covers local macOS/Linux arm64 and the hosted environments listed above, not Windows qualification, deployment or a new live-model evaluation. No new UI change/browser acceptance, retained-volume migration or image-vulnerability remediation is claimed; the existing dependency advisory remains NLUI-018. The seven unsupported semantic checks remain NLUI-031. The retained default database remains v1 and is not automatically upgraded; normal data-backed development still requires the explicit backup/reset or separate-path process documented in the earlier fixture milestone.

References: [Bun setup action](https://github.com/oven-sh/setup-bun), [Bun package-script trust](https://bun.com/docs/pm/cli/add), [Hurl installation](https://hurl.dev/docs/installation.html), [GitHub workflow security](https://docs.github.com/en/actions/reference/security/secure-use).
