# NLUI-007, NLUI-017 and NLUI-018 — Maintenance qualification

Date: 2026-10-15. Local working changes based on published 1.5.1. No commit, push, new hosted-CI run, live model call or deployment is claimed by this review.

## CORS: NLUI-007

The global pre-route OPTIONS shortcut is removed. Genuine preflight requires OPTIONS, Origin and Access-Control-Request-Method and is evaluated only after resolving a real filesystem route or canonically contained static resource. Allowed methods are the intersection of actual route handlers (including implicit HEAD/ordinary OPTIONS and default handlers) and server policy. Missing resources remain 404; disallowed methods return 405; denied origins/headers return 403; malformed method/header tokens return 400. Preflight never invokes the domain handler.

Explicit ordinary OPTIONS is preserved, and known routes/static resources otherwise expose ordinary 204/Allow. Non-wildcard CORS adds Vary: Origin to allowed, denied and no-origin responses, preserving existing variation without duplicates. Preflight additionally varies on requested method/headers. Header comparison is case-insensitive; wildcard headers never implicitly authorize Authorization or credentialed arbitrary headers. Credentialed wildcard origins fail configuration validation. CORS remains a browser response policy, not authentication or CSRF protection.

Unit regressions cover positive, denied, malformed, no-origin, disabled, wildcard, credential and cache cases. Ten new real HTTP assertions cover nonexistent routes, GET-only health versus DELETE, unknown request headers, static HEAD preflight, explicit ordinary OPTIONS, Vary and a POST counter proving preflight does not execute a mutation. The same 48-request smoke corpus passes in source and compiled modes. Fixtures use owned temporary configuration/routes only; they do not edit developer configuration or add production test endpoints.

## Public protocol: NLUI-017

Architecture docs now enumerate the six actual public types and link to `/docs/activity-protocol`: message.started, activity.updated, text.delta, ui.block, message.completed and error. The dedicated document covers newline framing (not SSE), upsert identity, lifecycle, cancellation/EOF, fixed application-authored labels, selective receipts, structured-response publication and the action boundary. Internal tool/provider/evaluation events are described separately; no hidden reasoning is presented as progress.

Executable documentation tests compare its event table to the public type catalog and round-trip its safe examples through the actual projection. Public envelope/activity fields are explicitly projected, so unexpected diagnostic properties are not forwarded. Existing raw tool-event and private-error filtering regressions remain passing. The document explicitly records the legacy provider-continuation responseId exception instead of falsely claiming provider neutrality; replacing that coupling remains NLUI-022. Validated UI blocks intentionally contain display data, unlike raw tool/debug envelopes.

## Dependency remediation: NLUI-018

The fresh baseline audit still reported [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7) through KaTeX 0.16.47. The advisory identifies 0.18.2 as patched. [Upstream XMarkdown's package](https://github.com/ant-design/x/blob/main/packages/x-markdown/package.json) and npm metadata still declare a 0.16 range; no compatible maintained upstream package upgrade removing the path was available at this check.

The application therefore pins an explicit, tested KaTeX 0.18.2 override rather than assuming semver compatibility. XMarkdown's LaTeX adapter uses the public renderToString API, not the internal API changed in 0.17. [The migration guide](https://katex.org/docs/migration) documents 0.18's prefixed CSS classes. XMarkdown's inline-tag selector is bridged to .katex-tag to preserve its existing positioning. This is application-scoped compatibility qualification, not a claim that upstream widened its supported dependency range. Retest/remove the override when upstream supplies an appropriate patched range.

An isolated JSDOM subprocess renders the actual production AssistantMarkdown component and upstream LaTeX adapter, checking bold/lists, escaped raw HTML, inert links/images, inline/block fractions, equation tags and the new class names. An inherited trust:true options prototype cannot enable an unsafe link. The subprocess closes its DOM and cannot leak global/prototype state into other tests. JSDOM and its types are development-only; no new math feature is enabled in the production chat.

Fresh bun audit --json returns an empty advisory object with exit 0; bun pm ls --all resolves one KaTeX 0.18.2 path. The requested regular bun update followed by bun install --force also preserves the supplied constraints while updating OpenAI 7.34.0 and React/React DOM 19.3.1. Those dependency changes receive the same complete local qualification; no live-provider compatibility/performance claim is made.

## Final evidence

`bun --no-env-file run verify:all` completed successfully:

- Bun 1.4.3; Biome 250 files; TypeScript clean.
- 727 tests, 2238 expectations, 82 files; zero failures.
- 48 source and 48 compiled Hurl requests, all passed.
- 77 executable labels/100 deterministic rules and exact 35/35 provider-free reference profiles in source, standalone compiled and container modes.
- Production container: non-root UID 1000, no provider configuration/external networking/retained mounts, real HTTP/SQL/permissions, overridden-port health and successful shutdown/owned cleanup.
- Browser fixture `bun --no-env-file tests/fixtures/markdown-server.ts`: production Markdown and patched upstream math render correctly; zero unsafe executable DOM nodes, correct static equation-tag positioning and no console warnings/errors. This is a disposable provider-free view, not a paid model run or production deployment.

The existing ignored provider settings, retained database and uploads were not reset or replaced. Generated tests own their temporary roots and the container gate removes only its exact container/image. Historical hosted evidence remains dated, not proof for these uncommitted changes.

## Remaining work and scope decisions

The other six issues remain Open. Finishing model-driven reliability/token/latency/cost comparisons requires a bounded live-evaluation opt-in; provider-free reference passes are not a reliability benefit. Durable ownership/history/onboarding require a choice between an isolated anonymous local demo and production authenticated tenancy (including identity-provider and tenant-model requirements). These choices were requested before paid calls or introducing a materially different authorization model. No research benefit, authenticated principal, migration of retained data or completion of those six milestones is claimed here.
