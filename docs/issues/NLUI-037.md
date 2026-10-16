# NLUI-037: Prototype optional reviewed instruction-only Skills

- Status: Closed
- Priority: P2
- Kind: Research milestone
- Created: 2026-10-16
- Updated: 2026-10-16
- Scope: Off-by-default application-managed skill discovery/loading over existing capabilities
- Evidence: User approval; current strict function-tool controller; official Skills guidance

## Hypothesis and boundaries

Small reviewed workflow packs may help assemble existing capabilities without expanding authority. This milestone qualifies an instruction-only loader and integration, not model comprehension, native provider Skills, shell execution, token savings or participant benefit. Existing prompts/renderers remain the control. Native provider adapters, scripts, arbitrary files/remote catalogs and end-user uploaded packs are excluded. No new provider calls or budget are approved.

## Acceptance criteria

- [x] Embed three reviewed/versioned packs, publish metadata only when enabled and load by strict opaque ID, with no runtime filesystem/network/executable-resource capability.
- [x] Enforce per-turn unique-load/byte limits, safe duplicate behavior, cancellation and provenance; skill content must not enter ordinary progress or internal trace exports.
- [x] Preserve existing tool rounds/calls, SQL validation, renderer JSON schema, capability/action checks, owned history and default-off behavior.
- [x] Add independent loader, injected-controller, source/compiled HTTP and packaging regressions; no billable/native provider execution.
- [x] Document optional configuration, limitations and a future baseline/eager/lazy evaluation design without claiming it was run.
- [x] Record verification, preservation and no-promotion decision; synchronize the registry.

## Resolution

Closed on 2026-10-16 after NLUI-036. `NLUI_SKILLS=1` optionally exposes three hash-pinned, embedded instruction-only packs through strict ID loading, with fresh per-turn two-pack/4,096-byte limits. The helper creates no data/UI/action authority. Internal provenance excludes bodies; ordinary activity uses a fixed label. Existing SQL, structured composition, owned history and action checks remain unchanged. This is application-managed guidance, not native provider Skills, scripts or arbitrary resource loading.

Eleven loader, ten injected-controller and four source/compiled HTTP regressions supplement the four documentation tests. Final qualification passes **941 tests / 4,932 expectations**, Biome/TypeScript, documentation parity, offline/source/compiled/container gates and all exact references. Source-free compiled execution proves embedded packs and worker behavior; fixture teardown now proves owned cleanup. All three manifests pass the standalone validator. Browser inspection verifies the served guides and links. The [qualification review](reviews/2026-10-16-docs-and-skills.md) records exact boundaries, diagnostics/fixes and preservation.

All 111 protected files and 99 original pilot inventory entries remain unchanged; both exhausted ledgers remain 40/40 and 32/32. No provider calls, publication, version bump or default promotion occurred. Baseline/eager/lazy research is documented but unrun; live quality, token/latency savings, participant benefit and native account/model support remain unqualified.
