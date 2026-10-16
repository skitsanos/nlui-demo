# NLUI-033: Controlled visual explanations with AntV Infographic

- Status: Closed
- Priority: P2
- Kind: Research milestone
- Created: 2026-10-15
- Updated: 2026-10-16
- Scope: Owned infographic catalog, read-only tools, strict JSON responses and React rendering
- Evidence: Source inspection; independent regression checks; real source/compiled HTTP and desktop/mobile browser qualification

## Problem

The existing catalog answers with scalar facts, tables, charts and controls, but cannot explain a recorded sequence or policy process visually. AntV Infographic is a candidate renderer, not a new source of facts, permission boundary or replacement for Ant Design X. A richer picture is not automatically a more useful answer.

## Baseline and bounded experiment

The existing controlled renderer and guarded SQL remain defaults. Compare the same content against an accessible table or policy-excerpt list. Pin `@antv/infographic` and expose only comparison, timeline and process templates behind `NLUI_INFOGRAPHICS=1` (off by default). The model requests only a view and explicit scope; values, timestamps, policy excerpts, template options and provenance are application-owned. Retain strict JSON-schema final responses and non-duplicative annotations.

Hypothesis: bounded visual explanations can convey relationships and recorded sequences without sacrificing exactness, scope or accessibility. This issue qualifies the capability and its failure boundaries; NLUI-034 owns comparative presentation-selection and human-benefit evaluation. No new paid provider budget is authorized.

## Acceptance criteria

- [x] Three approved templates bind only to existing regional revenue, recorded order events and full return-policy sections; exact alternatives preserve the same data.
- [x] Off by default in tool publication/execution and UI; no model-authored data, SDK configuration, SVG/HTML, resource URLs, scripts or actions.
- [x] Explicit period/unit/exclusions, observed timestamps without forecasts/inferred milestones, policy conditions and content provenance are retained.
- [x] Existing scalar/table/chart capabilities stay unchanged/default; experiment guidance excludes scalar, row-list, trend and causal views. Actual model-selection accuracy remains NLUI-034, not inferred from guidance.
- [x] Regression tests cover strict arguments, invalid/missing sources, shape/bounds, binding fidelity, unsafe inputs, JSON selection and readable/error guards; actual browser checks cover mount/unmount, remount and asynchronous failure recovery.
- [x] Actual browser checks cover all templates, readable alternatives, keyboard/mobile containment, multiple figures, disabled/error paths, console and resource requests.
- [x] Source, compiled and container gates pass; dependency/bundle impact and verification limits are recorded. Registry synchronized.

## Resolution

Implemented the off-by-default capability with pinned AntV Infographic 0.2.20, strict owned descriptors and the existing JSON block-reference envelope. Full local qualification and the initial failures/corrections are recorded in [the qualification review](reviews/2026-10-15-infographic-qualification.md): 847 tests, lint/typecheck, source/compiled HTTP and 35 reference cases per mode, and the Linux production-container gate. Actual browser checks verify exact content, full policy conditions, no duplicate IDs or page-width overflow, keyboard/mobile alternatives, normal-load zero third-party requests, recovery from forced asynchronous SDK failures, and controlled fallback for unsupported A2UI surfaces.

Enable locally with `NLUI_INFOGRAPHICS=1 bun run dev`; no `.env` edit or retained-data reset is needed. No paid provider call, commit, push, release or hosted CI run occurred. The SDK adds roughly 808 kB minified / 269 kB independently gzipped in the explicit split build probe; no free disabled-state, transfer/latency or human-benefit claim is made. Editing and remote-font embedding exports are intentionally excluded. NLUI-034 remains Open; no renderer is promoted.

## Publication follow-up, 2026-10-16

The paragraph above records the initial capability phase. NLUI-034 subsequently closed its bounded pilot, and NLUI-035 closed provider-free fallback alignment; neither promotes the renderer. Release **1.7.0**, `8446350366f2d8752f47d632a305a2b6e0c6c572`, now publishes all three milestones to `main`. [Run 38869687421](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421) passes all three hosted jobs, with **912 tests / 4,682 expectations** per matrix platform, source/compiled HTTP and exact references, and Linux production-container qualification. [Publication evidence](reviews/2026-10-16-publication.md) records exact jobs, safety checks and limits. No new provider call or default change occurred. The registry/evidence-only follow-up bumps to 1.7.1 and must pass its own workflow.
