# Documentation refresh and optional instruction-only Skills qualification

Date: 2026-10-16. Scope: NLUI-036 followed by NLUI-037, in that order. The user approved documentation updates, an optional Skills prototype and regression coverage, explicitly **without new provider calls**. No publication, version bump, native provider execution, new budget or retained-data reset is included.

## Documentation refresh

Current README, served guides and delivery guidance now consistently describe application-owned bounded history with `store: false`, gated infographics, both presentation evaluators, preserved selection results, fallback-v2 limitations and the two exhausted budgets. The final published 1.7.1 commit has its own independently successful hosted run; it is not qualified by substituting the earlier implementation run. Dated reviews and frozen reports remain historical. Initial design QA is explicitly labelled historical, including its later-resolved keyboard finding.

`bun run docs:check` compares maintained documentation with package commands/direct-script paths, local Markdown/served-route links, generated domain-tool catalogs and shared runtime feature metadata. Four regressions include deliberate drift canaries and real loopback rendering of every served guide through the contained Markdown handler. These checks do not establish semantic correctness of arbitrary prose or rewrite old evidence. The documentation phase's focused docs/owned-provider/original-pilot replay group passed seven tests / 178 expectations before prototype work began.

## Prototype contract

`NLUI_SKILLS=1` enables an application-managed instruction-only catalog; default behavior remains off. This is a bounded subset inspired by the Skills format, **not native provider Skills or full standard compatibility**. The [official Skills guidance](https://developers.openai.com/api/docs/guides/tools-skills) describes separate shell/sandbox integrations and security requirements; none is enabled here.

Three developer-reviewed build inputs are embedded in source bundles and compiled executables:

| ID | Version | Reviewed complete-pack SHA-256 |
| --- | --- | --- |
| `performance-brief` | 1.0.0 | `2429f296d61c1dd8925939b9b62e12d417f8d7c42072fcc230593f43c06a5f65` |
| `order-investigation` | 1.0.0 | `1ae0f4809946b546b9328edef826f07c6fd8b3402ca60203edef0b2b5923f242` |
| `returns-explanation` | 1.0.0 | `52319fc1c636e1488103aa960ef62948af8af78f05330410ed615f63b62f9c5c` |

Discovery contains only reviewed metadata. `load_skill` accepts a strict enum ID, not a path, URL, inline body or arbitrary resource. Only pinned names/descriptions/versions/hashes and the approved frontmatter subset are accepted. Structural validity is not developer approval. Source packs are at most 4,096 bytes; each fresh controller invocation may load at most two distinct packs and 4,096 combined UTF-8 instruction bytes. Failed loads do not reserve a slot. Duplicate IDs under new calls omit bodies; the existing identical call-ID cache can replay its earlier output, without raising the ordinary twelve-call/six-round ceilings or demonstrating token savings.

The loader issues no UI blocks, capabilities, data reads or mutations. Existing SQL restrictions, strict response schemas, exact issued block IDs, fresh intent and explicit confirmations remain authoritative. Investigation cannot supply action intent; a separate verified explicit action can still prepare a confirmation without executing it. A lookup that issues no block retains the normal message path, rather than inventing a result layout. No filesystem, network, shell, sandbox, executable-resource or end-user installation capability is added.

Internal provenance records reviewed IDs/versions/hashes, byte counts and catalog fingerprints, not instruction bodies. Invalid arguments become a fixed trace marker. Public progress uses the fixed request activity label “Loading a reviewed workflow.” Pack bodies enter within-turn tool context only and are not independently persisted in conversation history. Prompt versions gain a catalog-bound suffix only when enabled. Tests qualify application-controlled projection, not the quality or confidentiality of arbitrary model-authored prose.

## Regression and execution evidence

- **29 new tests**: four documentation, eleven loader, ten injected-controller and four source/compiled HTTP regressions.
- Loader coverage includes hash/manifest approval, invalid IDs and extras, default-off identity, metadata-only discovery, UTF-8 and unique-load limits, duplicate semantics, generic errors, cancellation before/during loading and reserved-name collisions.
- Injected completed responses exercise the real controller, guarded SQL worker and issued-block composition. Coverage includes valid count=200, no body in traces/progress, stateless owned history, per-turn isolation, unchanged call/round caps, invalid UI refusal, SQL/mutation denial and a positive explicit-intent confirmation control. Authored responses have no API client and are not model observations.
- Four HTTP cases cover source and source-free compiled execution with the feature both off and on. The compiled fixture has no source tree, dependencies or pack files beside it; packs and the SQL worker must be embedded. Outbound fetch throws, credentials are blank and actual configuration reports unconfigured. Real docs and the authored load/query/composition workflow succeed.
- Child fixture roots are parent-owned for fallback cleanup. Tests assert graceful SIGTERM exit and removal in all four cases; forced/startup failures still fall within the parent's exact temporary-root cleanup.
- All three packs pass the standalone Skill Creator manifest validator using isolated PyYAML through `uv`; no application dependency was added. Bun additionally checks stricter application-specific manifests and hash pins.
- Final `bun --no-env-file run verify:all` succeeds on Bun **1.4.3**, macOS arm64: Biome **356 files**, TypeScript, **941 tests / 4,932 expectations / 110 files**, offline **35 scenarios / 77 assertion labels / 100 configured deterministic rules**, **60 source + 60 compiled Hurl requests plus eight separate-session probes per mode**, and **35 passed / zero incomplete** reference cases per source/compiled/container mode.
- The production container succeeds as **UID 1000** with external networking disabled, no provider configuration or retained mounts: real HTTP/data/permissions/health/shutdown and exact references. This is local Linux-container evidence, not a new hosted macOS/Linux run or deployment.
- `bun run docs:check` and `git diff --check` pass. Browser inspection through the disposable fixture verifies readable Skills/research pages, their working cross-link and the refreshed architecture/history contract; no warning/error console entries were observed. The temporary tab and fixture were closed without touching the user's existing tab/server.

Initial diagnostics were fixed rather than waived: nested function-output JSON assertions now parse the actual envelope; the action positive control tests real behavior rather than assuming one prose word; TypeScript/import-order errors were corrected. The standalone validator's missing PyYAML was resolved in an isolated environment. Review also found the new fixture's initial SIGKILL-only teardown could strand disposable SQLite directories: parent ownership, graceful removal assertions and fallback cleanup now cover it, and the twelve exact abandoned fixtures from this turn were validated as closed, synthetic, unmutated data and removed. The final run includes these fixes. No existing check was disabled.

## Preservation and research limits

All **111 snapshotted protected files** remain byte-identical, including ignored `.env`, retained databases/WAL/SHM, both ledgers, private pilot files and frozen public evidence. Independently, every one of the **99 original pilot inventory entries** matches its original bytes/SHA-256. Read-only inspection confirms **40/40** and **32/32** remain exhausted. A scoped configured-value scan finds no key/model value in changed or new source/docs. Git/Docker exclusions remain effective; pack files are deliberate non-secret server build inputs, not public assets.

No provider calls were made, no prior observation was relabelled, and no prompt/renderer was promoted. No token, latency, model-selection, participant-benefit or native-model/account-support claim follows. A future separately approved study should freeze held-out tasks and compare baseline versus the same eager versus lazy instructions, holding tools/data/JSON/action authority fixed and measuring exact task success, refusals, irrelevant/duplicate loads, context/usage, rounds and latency. This is a proposed design, not an executed evaluation.

At the end of this local phase, NLUI-036 and NLUI-037 were closed within those bounds. Version was **1.7.1**, with changes uncommitted/unpushed. The published [1.7.1 run 38870544256](https://github.com/skitsanos/nlui-demo/actions/runs/38870544256) was dated baseline evidence only, not qualification of the new working tree. The separately authorized publication follows below.

## Authorized publication follow-up

After the local milestone above, the user separately authorized committing/pushing all changes, a version bump, hosted qualification and failure remediation, still **without new provider calls**. Version **1.8.0**, commit `780e420ede08b7383c291f2146f5ce98625bd1c6`, is published to `main`. All three jobs and all three commit check runs in [Qualification run 38876296502](https://github.com/skitsanos/nlui-demo/actions/runs/38876296502) conclude **success**, attempt 1:

| Hosted job | Result |
| --- | --- |
| [Source and compiled (ubuntu-latest), 116892061544](https://github.com/skitsanos/nlui-demo/actions/runs/38876296502/job/116892061544) | Success; Linux x64, Bun 1.4.3 |
| [Source and compiled (macos-latest), 116892061725](https://github.com/skitsanos/nlui-demo/actions/runs/38876296502/job/116892061725) | Success; macOS arm64, Bun 1.4.3 |
| [Production container (Linux), 116892800081](https://github.com/skitsanos/nlui-demo/actions/runs/38876296502/job/116892800081) | Success; production dependencies, UID 1000, port 3180 |

The [machine-readable publication receipt](assets/2026-10-16-skills-publication.json) records the exact commit, run and completed jobs/checks. Independently inspected logs confirm **941 tests / 4,932 expectations across 110 files on each matrix platform**, Biome/TypeScript, 35 offline scenarios / 77 labels / 100 rules with zero unsupported/ungraded assertions, 60 source + 60 compiled Hurl requests plus eight session probes per mode, and all 35 exact references. The separate Linux container job passes real HTTP/data/permissions/health/shutdown and all references with external networking disabled and no provider credentials or retained mounts.

**No hosted failures, fixes, reruns or waived checks were needed.** Ubuntu-label migration and macOS runner-capacity notices are informational, not application failures. Fresh local `verify:all`, documentation parity and frozen installation also pass before publication; the 352-package resolution and lockfile remain unchanged. Scoped staged-content/configured-value/pattern scans find no secret exposure or forbidden data/config paths. All 111 protected files and all 99 original pilot inventory entries remain unchanged; both exhausted ledgers remain 40/40 and 32/32. The Skills feature stays off by default and no live-model or native-provider result is inferred from hosted fixture success.

This registry/documentation/receipt-only follow-up is bumped to **1.8.1 before its push**. Its own complete workflow must be checked before handoff; the successful 1.8.0 run is not substituted for final-head qualification. No new provider calls, tag, GitHub release, deployment, branch-policy change or additional research budget occurred.
