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

The seed is deterministic. To discard confirmed demo actions and recreate the baseline:

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

To exercise the HTTP boundary, leave the server running and use the Hurl-backed task:

```bash
PORT=3000 task test
```

The smoke suite checks the frontend, health/config/docs endpoints, routing errors, validators, upload handling, and malformed `/api/chat` and `/api/actions` requests. The malformed NLUI requests are rejected before any model call or action execution.

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

## Cost boundary

Valid chat messages call the configured OpenAI model and can incur charges. `bun run check` and the default Hurl smoke suite are intentionally non-billable. The current conversation implementation chains stored Responses API results, so use synthetic or otherwise demo-safe prompts.

The live evaluation runner requires both an environment opt-in and a command-line acknowledgement, plus an explicit scenario or category:

```bash
NLUI_EVAL_LIVE=1 bun run eval:live -- \
  --id analytics-customer-count \
  --confirm-billable
```

Selection is capped at 10 scenarios and repeat count at 3. Each provider response is capped at 1,200 output tokens, and runs are serial in v1. Before billing, the runner compares the active database with a freshly generated logical fingerprint and refuses a modified fixture; read-only runs also fail if that fingerprint changes unexpectedly. Safe-action runs require an additional flag and exactly one repeat until isolated mutation runners exist. `--json` includes provider events, validated synthetic tool results, model and prompt versions, latency, and token usage; do not use it with sensitive prompts. Pricing is intentionally not hardcoded. Incomplete runs exit nonzero unless `--allow-incomplete` is given. Two route-action cases and one multi-turn case are identified in the catalog but refused by the single-turn live adapter until isolated workflow adapters exist.
