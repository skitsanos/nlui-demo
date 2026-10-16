# NLUI-033 — controlled infographic qualification

## Scope and decision

Local working-tree qualification on 2026-10-15, Bun **1.4.3** on macOS arm64, plus the Linux production-container gate. This is a bounded capability experiment, not a claim of better model selection, comprehension, task time or production readiness. Ant Design X, strict structured response envelopes, guarded SQL and the existing controlled renderer remain defaults. **NLUI-034 stays Open.** No provider request was made; the prior forty-attempt budget remains exhausted. Ignored provider configuration and retained business/state databases were not edited or reset.

`@antv/infographic` is pinned to **0.2.20**. Official references: [object-based rendering API](https://infographic.antv.vision/reference/infographic-api), [template gallery](https://infographic.antv.vision/gallery), [resource protocols](https://infographic.antv.vision/learn/resources). Installed package source was also inspected; the catalog is not a pass-through to that library's configuration surface.

## Implemented boundary

`NLUI_INFOGRAPHICS=1` enables the model-visible read-only tool, independently gates execution, publishes the UI feature flag and exposes three additional conversation starters. It is off by default. The server accepts only a view and bounded scope, never values, generated labels, dates, templates, style, resources or actions. The final JSON response still selects exact issued block IDs and supplies a short annotation; it cannot replace block content.

| View | Verified source and limits | Owned presentation and alternative |
| --- | --- | --- |
| Comparison | Existing dashboard query; exactly two distinct regions, explicit inclusive period, EUR eligible order totals, order creation time, cancelled/returned excluded | `compare-binary-horizontal-underline-text-vs`, with its decorative VS divider removed and region names included in visible labels; exact two-row table |
| Timeline | Existing order repository; actual creation/payment/dispatch/delivery/return-request timestamps through the declared snapshot, UTC, chronological, at most ten events | `sequence-timeline-simple`; no forecasts or invented milestones, equal spacing is explicitly not duration; exact event/time table |
| Process | Four **full** return-policy sections from the existing SQLite policy document, parameterized read-only lookup | `sequence-steps-simple`; full conditions, conditional damage guidance and no eligibility/action guarantee; identical readable policy sections |

Source/scope and a SHA-256 content fingerprint are retained. That hash identifies the bounded displayed content and scope; it is not an independent database revision or authenticated provenance proof. A source that is unavailable, outside bounds or unsafe fails closed. Zero-revenue periods preserve exact zero rather than manufacture growth. No customer contact details or addresses are added to timelines.

The client revalidates the descriptor and explicitly projects only plain approved fields into three owned SDK options. Editing/plugins/interactions, arbitrary SVG/HTML, asset URLs and model-authored SDK configuration are excluded. Plain SDK `foreignObject > span` text is permitted; arbitrary embedded HTML is not. IDs and fragment references are namespaced per mounted figure. Overflowing/unfinished layouts and errors fall back to exact readable content. The guard is defense for this constrained catalog, **not a general-purpose SVG sanitizer**.

Readable alternatives are always available; chat columns narrower than 320 px use them automatically. Wider diagrams scroll inside a named keyboard-accessible region (arrows/Home/End), never the page. SDK instances are destroyed on unmount, pending frames are cancelled and late callbacks cannot update an unmounted component. Unsupported A2UI surfaces use the existing controlled fallback rather than broadening its catalog.

## Failures discovered and corrected

1. The binary template did not actually render its root region labels. A schema-valid first render showed two unlabeled values. Visible child labels now contain both region and exact EUR amount; the projection regression and browser check cover this.
2. Full browser/compiled builds traversed the optional exporter's PostCSS dependency into Node `fs`/`path`/`url`. The first full suite preserved **838 pass / 1 failed setup** in the compiled controls fixture. A narrowly documented `postcss` alias now explicitly **throws** if the excluded remote-font CSS/export path is invoked; it does not pretend CSS was parsed. Normal visual rendering never needs that path. Browser/compiled tests and production packaging pass without Node filesystem modules in the client.
3. The SDK renders plain text using `foreignObject > span`, so an initial blanket ban rejected every legitimate figure. Qualification permits only that inert shape and still rejects arbitrary children, events and external resources.
4. Selecting Arial alone did not disable remote fonts: the SDK loads every registered font. An initial re-registration attempt added encoded-name aliases and left the original six remote registrations intact; browser network evidence caught those requests. The correction clears the live registry URL maps before render. A regression against the **actual pinned SDK registry**, plus a clean browser network capture, proves the corrected path has no external font/resource request. No asset loader or icon search is exposed.
5. Search excerpts truncated return conditions. The infographic now reads full owned policy sections; regressions independently require the authorization wording and the final expedited-shipping exception. Process text was initially clipped; bounded item heights plus an overflow guard now preserve it or show the full readable alternative.
6. Forced `getBBox` failure occurs in the SDK's asynchronous MutationObserver, outside both React error boundaries and its own `error` event. A provisional nonzero viewBox was not enough to establish success. The renderer now rejects a still-hidden layout and preserves all alternatives. Deliberately injected faults produce three expected upstream geometry diagnostics in the development overlay; these were not hidden or counted as a clean normal load.

## Regression and runtime evidence

- `bun update && bun install --force`: existing dependency ranges unchanged; the new pinned SDK installed with its dependencies. `bun audit --json`: **no advisories**.
- Final `bun run verify:all`: **847 tests, zero failures, 2,744 expectations across 101 files**; lint/typecheck pass. This adds **35 tests** to the prior 812-test baseline, including four real source/compiled × flag-on/off HTTP cases.
- New tests cover exact independent regional sums, ordering, zero periods, valid UTC history, missing/future milestones, no contact leakage, full policy conditions/missing sources, strict arguments, incompatible views, invented data/config/actions, resource/markup/control-character rejection, non-finite values, bounds, exact issued-ID JSON selection, inert SVG qualification/scoped IDs, hidden layouts, readable fallback and the actual SDK font registry. Existing scalar/table/chart and action regressions remain unchanged.
- Source and compiled smoke each pass **60 Hurl requests plus eight separate-session probes**, and each mode passes all **35** provider-free reference cases with zero incomplete results. Those historical catalog cases are not falsely relabeled as infographic model-selection coverage.
- Linux production container passes non-root UID 1000, HTTP/data/permissions/health/shutdown and all 35 reference cases. These are local gates, not hosted CI/release verification. The build-measurement script is separately executed and included in final lint/typechecking.

## Actual browser evidence

Used the existing in-app browser with a separate disposable fixture server, actual production App/renderer, real fixture-v2 repository and durable chat routes, and **no provider**. The fixture controller selects predetermined tools/captions; the UI's fixture configuration badge is not evidence of a live model call. Agent-owned tabs and fixture files/processes are cleaned up afterwards; the user's AntV tab is not changed.

- All three templates finish rendering together; there are no duplicate DOM IDs. Comparison shows **West €86,554.26 / East €117,577.77**, matching independent SQLite sums. Timeline shows the four recorded ORD-1042 events: 17 Jun 2026 10:30/11:30 UTC, 18 Jun 10:30 UTC and 22 Jun 10:30 UTC.
- All three new starters work through the real chat shell with short annotations. Readable data/sections match the visual bindings; switching visuals off removes every SDK canvas, and switching back remounts correctly.
- A clean reload captures only five same-origin requests (document, two CSS assets, client JS and fixture data), with **zero third-party requests and zero normal-load warnings/errors**. Earlier HMR reload warnings and injected-fault diagnostics are preserved separately, not represented as clean evidence.
- At **390 × 844**, page scroll width equals viewport width (**390 px**). The lab's visual regions scroll internally; End reaches the last policy step (desktop 318 px of panning; mobile bounded within its card). Native disclosure/keyboard access exposes exact alternatives. The narrower actual chat column automatically shows readable data rather than shrinking labels to tiny text. [Mobile chat](assets/2026-10-15-infographic-mobile.jpg).
- Simulated renderer failure shows **three readable fallbacks**, preserving values, all timestamps, complete policy conditions and scope; no action or provider request occurs. The deliberately forced upstream diagnostics are expected, not swallowed.
- Reloading the same owned comparison with `?renderer=a2ui` shows the explicit controlled-view notice and the correct infographic rather than an unresolved X Card surface; an adapter regression also rejects this unsupported block.
- [Annotated chat comparison](assets/2026-10-15-infographic-chat.jpg).

## Build footprint and research limits

`bun run measure:infographic` uses minified browser JS with explicit splitting; each output is gzipped independently. Its control is **the same current app with only the SDK component replaced by a no-op**, not the historical release and not a UI correctness control.

| Arm | Total JS bytes | Sum of independently gzipped outputs |
| --- | ---: | ---: |
| Candidate | 2,388,337 | 778,159 |
| Same app without SDK | 1,580,726 | 508,662 |
| Incremental SDK build footprint | 807,611 | 269,497 |

The SDK-specific split chunk is 805,595 bytes / 268,508 gzipped; small remaining differences are shared-code placement. These measurements are not HTTP transfer, cache, execution or user-time measurements. React defers SDK execution through a lazy boundary, but Bun HTML/HMR may still bundle its code into the initial client payload; **no zero-cost disabled state or proven network-lazy-load benefit is claimed**. Editing and font-embedding exports are intentionally unsupported in this profile.

Dense process diagrams can require internal panning, especially beside chat avatars. NLUI-034 must compare them against simpler readable alternatives, test inappropriate representation/causal claims, measure deployed payload/load behavior and separately qualify live model selection and any human benefit. This issue closes only the bounded controlled capability; no renderer is promoted and no additional provider budget is inferred.

Final hygiene checks: 34 permanent issue records (33 Closed / 1 Open), no broken relative links in changed Markdown, zero configured-secret matches across 41 changed text files, and ignored `.env`, business/state SQLite files and TODO pointer remain excluded. No commit or push was requested or performed; project version stays 1.6.4 until the next authorized push.
