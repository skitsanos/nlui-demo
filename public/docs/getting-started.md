# Getting Started

## Prerequisites

- Bun 1.3 or newer
- An OpenAI API key and a Responses API-compatible chat model
- Optional: Hurl and Task for HTTP smoke tests
- Optional: Docker for the container path

## Install and configure

```bash
bun install --frozen-lockfile
```

Create an ignored `.env` file in the project root:

```dotenv
OPENAI_API_KEY=your-api-key
CHAT_MODEL=your-responses-api-model
```

The key is read only by the Bun server. Do not expose it through client code or a public environment-variable prefix.

## Seed and reset the demo

The server lazily creates `data/demo.sqlite` on the first data request. You can create it explicitly:

```bash
bun run seed
```

The current deterministic fixture is `nlui-retail-operations-v2` (version 2). Observed seed events stop at exactly `2026-06-30T12:00:00.000Z`, inclusive; expected-delivery forecasts may extend later. The checked-in `data/fixture-manifest.json` pins the baseline fingerprint and golden-file hashes.

Older/incompatible databases are refused without replacement. Back up any local changes you want to preserve before explicitly opting into a reset. To discard confirmed demo actions and recreate the baseline:

```bash
bun run reset:data
```

Both scripts accept a separate database path when you need an isolated fixture:

```bash
bun run scripts/seed.ts --database /tmp/nlui-demo.sqlite
bun run scripts/reset-demo.ts --database /tmp/nlui-demo.sqlite
```

## Development

```bash
bun run dev
```

Open `http://localhost:3000`. Bun imports `src/client/index.html`, bundles its TSX and CSS dependencies, and enables React HMR. API and documentation requests fall through to the file-system route loader.

Try these deterministic prompts:

- `Show the sales trend for the last six months.`
- `How many customers do we have now? Break them down by tier.`
- `Show delayed orders over EUR 500, highest value first.`
- `Help me choose a laptop for design work.`
- `What is the return window and refund timing?`
- `Change the delivery address for order 1176.`

## Local validation

Run all non-network code checks:

```bash
bun run check
```

That command runs Biome, TypeScript, and Bun tests. The tests use deterministic or disposable SQLite fixtures and do not contact OpenAI.

Validate the 35-scenario evaluation catalog and its tool-to-renderer expectations without contacting OpenAI:

```bash
bun run eval:offline
```

The Hurl-backed task starts its own isolated server and temporary storage; no existing server is required:

```bash
task test
task test:compiled
```

The smoke suite checks the frontend, health/config/docs endpoints, routing errors, validators, upload handling, and malformed `/api/chat` and `/api/actions` requests. The malformed NLUI requests are rejected before any model call or action execution.

## Finite deadlines

Chat requests have a 120-second total budget, including request-body parsing, provider rounds and tools. `server.chatRequestTimeoutMs` in `config/server.yaml`, or `CHAT_REQUEST_TIMEOUT_MS`, can set 1–600000 milliseconds. Stalled bodies return 408; a running NDJSON response instead ends with a safe timeout error and no completion event. SQL workers receive the cancellation signal. Successful or failed requests clean up deadline timers and listeners.

Shutdown gives healthy HTTP requests 5 seconds to finish and closes tracked WebSockets with code 1012. `server.shutdownGracePeriodMs`, or `SHUTDOWN_GRACE_PERIOD_MS`, can set 1–60000 milliseconds; remaining connections are force-closed at that limit. Keep Docker/orchestrator termination grace longer than this value. Zero and malformed limits fail at startup rather than disabling protection.

## Compile

```bash
bun run compile
./dist/demo
```

The HTML import, frontend assets, and isolated dataset-query worker are embedded in the executable. The current custom route loader, configuration, public documentation, and policy seed files remain filesystem-backed, so run the executable from a checkout or package those directories beside it.

## Docker

```bash
docker build -t nlui-demo .
docker run --rm -p 3000:3000 \
  --env-file .env \
  --mount source=nlui-demo-data,target=/app/data \
  nlui-demo
```

The image runs as the unprivileged `bun` user. Seed inputs are included, generated SQLite files are excluded, and `/app/data` plus `/app/uploads` are writable. Docker initializes a new named volume with the image's `data/` contents, including the policy corpus. Omit the mount when you want all mutations discarded with the container.

The image exposes port 3000 and reports health through `/api/health`.

## Delivery qualification

`bun run verify` requires Hurl and runs lint, TypeScript, all regressions, offline catalog validation, the exact provider-free reference profile and isolated source HTTP tests. `bun run test:compiled` builds owned production binaries, runs the same HTTP requests and checks the reference executable without a source/dependency fallback. `bun run test:docker` requires Docker and pulls/builds a production-only image, then verifies non-root permissions, uploads, default-path seed/SQL, health on an overridden port and clean shutdown without external networking or retained mounts. `bun run verify:all` runs all three modes.

The GitHub workflow defines Linux/macOS source-and-compiled jobs followed by a Linux container job. Hurl is installed explicitly; missing tools and failed gates are errors, not skips. Provider configuration is withheld from qualification subprocesses and dotenv loading is disabled; no local `.env` values are printed, replaced or forwarded to the test image. The 28 passed/seven explicitly incomplete reference profile is a plumbing check, not a model-performance result. The first hosted [Qualification run](https://github.com/skitsanos/nlui-demo/actions/runs/38721607962) passes all three jobs for release 1.4.0; verify the current commit's run before making a new claim. Required-check and branch-protection settings were not changed.

## Cost boundary

Valid chat messages call the configured OpenAI model and can incur charges. `bun run check` and the default Hurl smoke suite are intentionally non-billable. The current conversation implementation chains stored Responses API results, so use synthetic or otherwise demo-safe prompts.

The live evaluation runner requires both an environment opt-in and a command-line acknowledgement, plus an explicit scenario or category:

```bash
NLUI_EVAL_LIVE=1 bun run eval:live -- \
  --id analytics-customer-count \
  --confirm-billable
```

Selection is capped at 10 scenarios and repeat count at 3. Each provider response is capped at 1,200 output tokens, and runs are serial. Each run uses an owned, freshly seeded database checked against the versioned fixture fingerprint before provider work. Safe-action runs require `--allow-safe-actions`; repeated mutations use independent fixtures and never dirty the retained demo database. The contextual case chains its prerequisites in one conversation; confirmation cases exercise the real action handler and idempotent retry without a provider.

`--json` includes redacted synthetic tool results, versions, hashes, outcomes, latency, token coverage and repeated-run stability; do not use it with sensitive prompts. Pricing is intentionally not hardcoded. Estimates require attributable versioned rates and complete matching usage. Incomplete runs exit nonzero unless `--allow-incomplete` is given, and cannot promote an experiment arm.

`bun run eval:offline` validates 70 executable assertion labels, 100 rules and seven explicitly unsupported labels, with zero unconfigured labels. `bun run eval:fixtures` runs all 35 reference cases through real tools and isolated adapters without a provider: the expected outcome is 28 passed and seven incomplete. Its explicit oracle arguments and annotations test the evaluation plumbing, not LLM capability. No uncalibrated language grader is treated as deterministic evidence.
