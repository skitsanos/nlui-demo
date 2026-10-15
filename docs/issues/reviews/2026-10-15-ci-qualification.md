# Source, compiled and container CI qualification — 2026-10-15

Scope: NLUI-015. Existing pending milestones and user dependency changes are preserved. No commit, push, package-version bump, repository-policy change, live provider request, retained-data reset or remote workflow dispatch was performed.

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

Registry validation confirms 32 permanent issues: 21 Closed, ten Open (eight P2/two P3) and NLUI-015 In progress, with synchronized index/status rows and 114 valid relative registry/verification links. Configured-value scanning across 222 changed/untracked files finds no key/model matches; `.env`, TODO.md, retained SQLite, compiled output and evaluation reports remain ignored. New qualification modules and tests are at most 79 lines; `git diff --check` passes. Read-only inspection confirms the retained default database still has `user_version=1`. No owned labelled container or test image remains after the full run.

## Retained diagnostics

The first tool-installer experiment used unsupported global directory flags; Bun correctly rejected them. An isolated local tool install then succeeded but Hurl could not start because its binary-install script had not run. The corrected workflow uses an owned tools directory and explicit `bun add --trust` for only the pinned official wrapper, and its real CLI starts successfully. Application dependencies/trust configuration were not changed.

The first real container probe expected `/api/config.server.port` to reflect the environment override. That endpoint intentionally reports the YAML configuration, whereas the listener and healthcheck use the effective port. The corrected probe proves successful requests and actual Docker health at 3180 instead of changing product behavior to satisfy an incorrect assertion. That failed run removed its owned container/image; later complete runs above passed.

## Disposition and verification limits

Implementation and local qualification are complete. **NLUI-015 remains In progress** for the first hosted GitHub run, because no authorized push/dispatch was performed. After publication, record both hosted source/compiled matrix jobs and the Linux container job before checking its remaining CI acceptance box and closing it. Required-check/branch-protection settings are separate remote policy; none was modified or claimed.

Local macOS arm64 and Docker Linux arm64 evidence is not hosted Linux x64/macOS runner provisioning, Windows qualification, deployment or a new live-model evaluation. No UI change/browser acceptance, retained-volume migration or image-vulnerability remediation is claimed; the existing dependency advisory remains NLUI-018. The seven unsupported semantic checks remain NLUI-031. The retained default database remains v1 and is not automatically upgraded; normal data-backed development still requires the explicit backup/reset or separate-path process documented in the earlier fixture milestone.

References: [Bun setup action](https://github.com/oven-sh/setup-bun), [Bun package-script trust](https://bun.com/docs/pm/cli/add), [Hurl installation](https://hurl.dev/docs/installation.html), [GitHub workflow security](https://docs.github.com/en/actions/reference/security/secure-use).
