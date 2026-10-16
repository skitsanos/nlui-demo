# Optional instruction-only Skills prototype

`NLUI_SKILLS=1` enables a developer-reviewed, application-managed workflow catalog. It is **off by default**. It does not enable native provider Skills, shell tools, a sandbox, remote installs, file browsing or model-generated UI. The same strict function-call controller, guarded SQL, block-reference envelope and interaction capabilities remain in charge.

## Reviewed workflows

- `performance-brief`: establish metric/population/period, retrieve verified performance data and add one supported takeaway.
- `order-investigation`: retrieve one supplied order and separate recorded events from forecasts and unknowns.
- `returns-explanation`: retrieve policy evidence with its conditions without claiming order eligibility or refund completion.

The three project-local `SKILL.md` files are build inputs embedded in the server bundle, including compiled executables. They contain a name, discriminating description, `metadata.version` and concise instructions. Only the approved frontmatter subset is accepted. Reviewed names, descriptions, versions and exact SHA-256 pins must match; editing a pack requires review and an explicit version/hash update. Validation alone does not make arbitrary content trustworthy. No resource/script directory, path, URL, upload or inline body can be selected through the loader.

This is a bounded application-managed subset inspired by the Skills format, not a claim of full standard compatibility or native-model support. [Official OpenAI Skills documentation](https://developers.openai.com/api/docs/guides/tools-skills) describes the separate shell/sandbox integrations and their security requirements. Those integrations are not used here.

## Discovery and loading

When enabled, the controller exposes reviewed metadata and one strict `load_skill` function accepting only `skill_id`, an enum of the three approved IDs. Full bodies stay out of discovery and enter only the next within-turn tool context after loading. They are guidance, never verified facts, fresh action intent or higher-priority policy. Data labels/retrieved records cannot authorize loading or grant permissions.

The loader returns no UI blocks or action capabilities. Actual answers still require existing data/policy tools, exact issued block IDs and normal annotation rules. If a lookup issues no block, the controller uses its ordinary message envelope rather than inventing a preferred result layout. Read-only packs do not remove existing action tools: a separate fresh user action request must still pass domain checks, preparation and explicit confirmation.

Each controller invocation has fresh state, at most **two distinct loads**, at most **4,096 UTF-8 instruction bytes** in total, and at most **4,096 bytes per complete source pack**. Failed loads do not consume a distinct-load slot. A repeated ID under a new call returns metadata without repeating its body; an identical controller call ID may replay its cached output, still subject to the existing twelve-call/six-round limits. No token-saving claim follows from this cache behavior. Loads consume ordinary tool calls/rounds; no limits were raised.

Internal traces retain approved ID/version/content hash, byte counts and catalog fingerprint rather than instructions. Invalid load arguments are reduced to a fixed marker before tracing. Public progress uses a fixed application-authored label, not the body, a filesystem path or hidden reasoning. Pack contents are not independently persisted into conversation history; later turns reload as needed. Application-controlled trace/progress projection is tested; arbitrary model-generated prose quality is not qualified by these checks.

## Local use and provider-free inspection

```bash
NLUI_SKILLS=1 bun run dev
```

Ordinary valid chat remains billable and **is not authorized by setting this flag**. Reuse existing ignored provider configuration; do not replace it. `GET /api/config` exposes only the feature boolean, never provider values or pack bodies.

For a disposable fixture with injected responses and outbound fetch disabled:

```bash
NLUI_SKILLS=1 bun --no-env-file tests/fixtures/skills-server.ts
```

Open its printed loopback port with `/docs/skills` for this guide or `/api/fixture/workflow` for the authored load/query/strict-composition reference. This is an explicit fixture, not a production route, intent classifier or model prediction. Stop it when finished; its owned database is disposable. Automated tests also exercise a source-free compiled fixture with embedded packs/SQL worker and no source/dependencies beside it.

## Qualification and future research

The prototype qualifies default-off behavior, load/hash/byte/round limits, public/internal-body filtering, guarded data access and strict presentation using injected responses. It does not establish live model selection, model/account native Skills access, fewer tokens, lower latency or participant benefit. No new provider calls, uploads or budgets are approved. Both existing research ledgers remain exhausted; see [research status](/docs/research).

A future separately approved experiment should compare the existing prompt, identical workflow instructions included eagerly, and those same instructions loaded lazily. Keep the domain tool catalog, data, JSON envelope and action boundaries fixed. Freeze held-out tasks and criteria before execution; count irrelevant/duplicate loads, exact task/content success, refusals, tool rounds, context bytes/tokens and latency. This is a proposed design, not a run or a promotion decision. Provider-native execution would be a separate security/execution milestone, not a feature switch on this prototype.
