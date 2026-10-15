# Delivery qualification

Use Bun from the project root. Application dependencies are installed with `bun install --frozen-lockfile`; qualification does not upgrade the runtime or rewrite dependency constraints. Current Bun is exercised in CI rather than enforcing an exact runtime/type-package version match.

## Commands and prerequisites

| Command | Required tools | Gates |
| --- | --- | --- |
| `bun run check` | Bun | Biome across source/scripts/tests, TypeScript, Bun regressions |
| `bun run verify` | Bun, Hurl | Check, offline catalog, 38 source HTTP requests, exact reference profile |
| `bun run test:compiled` | Bun, Hurl | Owned production server binary, 38 HTTP requests, owned source-free reference binary with embedded SQL worker |
| `bun run test:docker` | Bun, Docker daemon | Pulled production image, HTTP/data/permissions/health/shutdown, exact reference profile |
| `bun run verify:all` | Bun, Hurl, Docker daemon | Source, compiled and container modes in sequence |

Task equivalents are `task test:verify`, `task test:compiled` and `task test:docker`; `task test` retains the direct source HTTP smoke command. Missing Hurl is an error before source/compiled qualification. Install it using the [official Hurl instructions](https://hurl.dev/docs/installation.html), for example Homebrew on macOS. The CI workflow instead installs the pinned official npm wrapper into `$RUNNER_TEMP/hurl` with Bun's explicit `--trust` flag for that package's binary-install script; it does not change application dependencies or global user packages. The wrapper package version and reported native Hurl version are distinct and recorded separately.

The provider-free reference contract is the exact set of 35 case IDs, all passed with zero incomplete results. Changed/missing/duplicate IDs, incomplete/failing/error results or stale evaluator/fixture/presentation versions fail qualification. NLUI-031 replaces seven unsupported checks with production-rendered, record-bound product facts, explicit form questions and bounded application-owned policy captions. This is reference contract/plumbing evidence, not a live-model evaluation, arbitrary-language grader or promotion override. The earlier 28/seven profile is retained only in dated historical reviews.

## GitHub workflow

`.github/workflows/qualification.yml` triggers on push, ordinary pull requests and manual dispatch, without path filters that could silently omit a gate. It uses SHA-pinned checkout/setup actions, read-only contents permission, non-persisted checkout credentials, per-ref cancellation and 20-minute job deadlines. Linux/macOS source-and-compiled jobs use a non-fail-fast matrix. The Linux container job depends on both matrix jobs. No provider secrets, privileged `pull_request_target`, publishing or `continue-on-error` is configured.

The workflow uses `bun-version: latest`; the Dockerfile uses `oven/bun:latest` resolved with `--pull` during qualification. Frozen application dependencies remain controlled by `bun.lock`. These choices detect current-runtime behavior; recorded local versions are evidence, not permanent compatibility guarantees. See [Bun setup](https://github.com/oven-sh/setup-bun), [Hurl installation](https://hurl.dev/docs/installation.html) and [GitHub workflow security guidance](https://docs.github.com/en/actions/reference/security/secure-use).

The first hosted [Qualification run 38721607962](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962) passed all three jobs on 2026-10-15 for release 1.4.0, commit `6a41630318af59630045789ed4f7b46dc8dd511c`. It qualifies the observed Ubuntu 24.04 x64/macOS 26 arm64 source-and-compiled jobs and Linux x64 production container; NLUI-015 is closed. Repository required-check and branch-protection settings were not changed and remain separate policy. Local or hosted success does not qualify untested platforms, fork settings or deployment.

## Non-billable and retained-data boundaries

Qualification commands use `--no-env-file`; subprocess environments withhold inherited OpenAI configuration and force live evaluation off. This is test isolation, not replacement of the existing ignored development `.env`. No credentials or configured model values are printed or forwarded to a test container. Production development/live verification keeps its existing configuration behavior.

Source HTTP smoke uses copied source/public fixtures and ephemeral ports. Compiled output goes into an owned temporary directory, preserving any existing `dist/demo`. The reference binary runs with only its policy corpus/scenarios alongside it, so a missing embedded worker cannot use the source tree or developer dependencies as fallback. Unit/setup/route/reference fixtures use owned databases; no retained default database or upload directory is reset or used as a cleanup target.

The production container is uniquely labelled/tagged, has `--network none`, no published ports, no provider credentials and no retained mounts. HTTP probes run through `docker exec` against its loopback listener. The probe is copied into `/tmp` only for testing, not added to production route discovery or packaged as an endpoint. Before lazy seeding, it verifies no default SQLite, local environment, Git configuration or test/issue files were packaged; data/uploads are writable as non-root. It exercises real SQL, the Dockerfile's port-aware health command and exit code after SIGTERM. Reference runs then exercise all 35 real-tool/adapted cases using production dependencies.

Cleanup removes only the owned temporary directory, exact container name and exact image tag. It does not prune images/volumes/build cache, alter retained mounts or stop a developer server. Failed start/probe/reference/shutdown, unhealthy/never-ready state, removal failures and ambiguous create acknowledgement have regression coverage. Normal errors, cancellation and bounded subprocess timeouts execute cleanup; an unavailable daemon or forced host/process loss still requires inspection of owned labels rather than a broad cleanup command.

## Evidence

The [NLUI-015 review](issues/reviews/2026-10-15-ci-qualification.md) records fresh commands/results, initial diagnostics, cleanup/hygiene and the successful first hosted run. Historical milestone reports remain dated evidence, not current CI state; verify the run for the current commit before making a new qualification claim.
