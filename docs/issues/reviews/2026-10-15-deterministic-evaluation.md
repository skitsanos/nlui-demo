# Deterministic evaluation coverage and trace accounting — 2026-10-15

Scope: NLUI-016, the remaining semantic checks in NLUI-031 and the compiled worker defect NLUI-032. Existing pending changes and dependency upgrades are preserved. No commit, push, project-version bump, retained-data reset or live provider request was performed.

## Coverage contract

All 35 specifications remain in the catalog: 32 single-turn, one contextual multi-turn and two application-route cases. All 77 assertion labels are classified: 70 executable, seven explicitly unsupported, zero unconfigured. There are 100 configured rules: 93 deterministic rules and seven unsupported markers, with deterministic partial evidence attached to some unsupported labels. An unsupported marker cannot be overridden by a passing partial rule.

New deterministic evidence covers collection bounds/values, required UI fields, opaque action identifiers, citation paths, forbidden SQL/output columns, business-state changes and numeric claims matched against trusted tool values. Empty/missing/null/wrong-type collections cannot satisfy positive universal predicates. Numeric rules check every captured claim within their explicitly configured patterns; they are not general natural-language numerical reasoning.

The SQL units proof follows the whole selected expression through supported columns, aggregates, division, rounding and zero-default wrappers. `SUM(total_cents) + 1 / 100.0`, unrelated CASE branches, mixed raw/scaled sums and wrong divisors fail. Exact grouping rejects extra order-ID grain and CASE decoys while supporting direct projection aliases. This is conservative proof for supported expression/lineage forms, not a full SQL theorem prover. Existing effective-predicate proof remains independent from observed denotation.

Deliberately modified owned fixtures cover nullable payment times, captures/refunds, multiple payment/shipment rows, empty aggregates, sparse sets, JOIN multiplication and nonrepresentable numbers. For example, valid net paid revenue EUR 95 differs from the incorrect EUR 155 gross calculation. Variant constraints are changed only inside their temporary databases to represent repeated legs; the pinned baseline remains unchanged.

## Owned workflow adapters

Every run starts from a fresh, owned v2 database whose logical fingerprint must match the manifest before a configured provider runner is created. Repositories and directories are closed/removed in `finally`, including when a non-cooperative adapter ignores its timeout signal; retained databases and uploads are never cleanup targets. Non-route runs capture before/after business-state hashes and fail unexpected mutations, including mutation followed by an exception. Allowed pending capability preparation is distinct from business mutation.

The multi-turn adapter resolves declared prerequisites with depth/cycle/missing checks, uses one conversation and previous response IDs, and stops after a failed prerequisite. Reports retain preceding turns, their tool safety evidence, aggregate usage and full trajectory latency. A later timeout retains prior usage/checkpoints rather than reporting only the last turn.

Route cases prepare a real pending action, issue an actual scoped capability and invoke the real action handler twice with the same identifiers. They require the same cached result and a single business mutation. Accounting records one execution and one replay with separate timings. These adapters invoke handlers with real Request objects, not a new network listener; existing route/HTTP regressions provide separate boundary evidence. Safe-action repeats now use independent baselines rather than dirtying the default database.

## Trace accounting and promotion

Trace version 2 records provider attempts even when connection fails before an ID is assigned; missing IDs are not reported as real responses. Tool traces distinguish accepted/rejected/error/cancelled/timeout outcomes, policy rejection codes, query/plan hashes where available, empty results, execution attempts and cached replays. Cache identity binds the call ID to its name and exact arguments: changed arguments cannot reuse a cached result. Public activity/protocol payloads do not gain SQL or internal trace data.

Successful rounds before later failures retain known usage. Incomplete/truncated/provider-failed streams, thrown tools and non-cooperative timeouts retain partial evidence. Late emitted events cannot mutate frozen checkpoints. A stalled usage resolver is also bounded and accounting failure preserves the completed turn. Deadlines bound asynchronous work; they are not a claim that synchronous JavaScript or native work can be preempted mid-instruction.

Reports pin evaluator `deterministic-v2`, trace 2, dataset 2, semantic catalog version, fixture fingerprint and golden hashes. They include repeated-run status stability and latency/token ranges. Unknown legacy coverage is partial, not inferred complete. Configured key/model values are redacted from object keys as well as nested strings.

No rates are hardcoded. Estimated costs require a source URL, effective date, pricing version, matching observed model for every round and complete safe-integer input/cache/output usage. Cached input is charged once; reasoning tokens are not double-counted as extra output. Missing coverage, mixed-model rounds, unattributed estimates, inconsistent amounts, invalid provider amounts and numeric overflow fail accounting rather than inventing cost. Pricing tests use synthetic fixture rates only, not current provider prices. Summary counters expose priced/usage run coverage; known partial totals are not presented as full-bill estimates.

Promotion requires current evaluator/fixture/catalog metadata, complete deterministic assertions and every candidate run passed. Better aggregate reliability cannot hide one incomplete or failed candidate. External assertion hooks remain explicitly unverified and cannot qualify as deterministic promotion evidence. Historical artifacts need a current rerun/regrade, not a version stamp added after the fact.

## Reference execution is not model evaluation

`bun run eval:fixtures` uses explicit oracle arguments and annotations with real tools, renderers, isolated routes and the declared trajectory. All 35 cases execute: **28 passed, seven incomplete**, zero failed/error. The CLI's successful exit allows those declared incomplete reference cases as a plumbing check only; they cannot promote an arm. Unit regressions pin the exact profile so a newly incomplete or failing case is visible.

The seven remaining visible-product/language assertions are enumerated in [NLUI-031](../NLUI-031.md). No uncalibrated semantic grader was introduced and no live planning, paraphrase reliability, latency comparison or model-performance result is claimed. Existing broader semantic/paraphrase expansion remains NLUI-019; tenancy/adversarial authorization remains NLUI-023.

## Compiled worker diagnostic

The first compiled reference CLI failed the five generic SQL scenarios with worker-startup errors, although the source corpus and malformed-request HTTP suites passed. The module-relative worker URL resolved from the bundled main entrypoint. This confirmed defect is [NLUI-032](../NLUI-032.md), not dismissed as a harness-only failure.

Compiled queries now reuse the shared runtime detector and select the explicitly embedded worker entrypoint. Source mode retains its original module-relative URL. Bun documents explicit worker entrypoints and their compiled specifiers in [standalone executables](https://bun.sh/docs/bundler/executables). The new regression builds the real reference CLI plus worker, then runs from an owned directory containing only the policy corpus and scenarios: no source tree or `node_modules` can hide a missing embedded worker. The corrected complete reference profile passes there.

## Verification

| Gate | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3; 240 installs across 266 packages checked; no dependency changes |
| `bun run check` | Biome 223 files; TypeScript passes; 597 tests / 1870 expectations across 73 files, zero failures |
| Added regression coverage | 69 tests beyond the 528-test snapshot milestone, including seven new test modules and extensions to promotion/redaction tests |
| `bun run eval:offline` | 35 specifications; 70 executable labels / 93 deterministic rules / 100 configured rules / seven explicitly unsupported / zero unconfigured / zero catalog issues |
| `bun run eval:fixtures` | All 35 execute with real tools/adapters; 28 passed / seven incomplete / zero failed/error; no provider |
| Compiled reference CLI | Both entrypoints compiled; all 35 classifications preserved without source/dependency fallback; configured-value redaction checked |
| Route repeats / trajectory | Three isolated return confirmations each mutate once and replay once; prerequisite conversation/response chain, failure short-circuit and later-timeout usage retained |
| Accounting failures | Provider connection/stream failures, thrown tools, policy repair, hash/empty receipts, cache identity, timeouts/late events, bounded resolver and invalid/unattributed cost regressions pass |
| Source / compiled HTTP | All 38 source and 38 compiled requests pass; production executable bundles 3491 modules |
| Promotion | Incomplete/failed/unverified/stale evidence cannot qualify, even when other aggregate gates pass |

Registry validation confirms 32 permanent issues: 21 Closed and 11 Open (nine P2/two P3), with synchronized index/status/priority rows and 109 valid relative links. Configured-value scanning across 206 changed/untracked files finds no key/model matches; `.env`, TODO.md, retained SQLite, executable output and evaluation reports remain ignored. The evaluator modules stay below 400 lines; the changed provider runner is 371 lines. `git diff --check` passes. Read-only inspection confirms the actual retained default database still has `user_version=1`; it was not reset to make tests pass.

## Diagnostics and limits

Earlier targeted runs exposed ordinary type/import checks and the compiled-worker defect; the later complete gate above is the qualified boundary, not a claim of uninterrupted success. Broader expression forms, linguistic assertions, general rendered-product guarantees, model-grader calibration and new concurrency experiments are not proven. Execution remains serial; no uncontrolled benchmark or paid call was run. No UI change/browser acceptance, new Docker/Linux/Windows check, CI run, remote deployment or production qualification is claimed.

The retained default database was not reset or migrated; prior v1 compatibility restrictions still apply. All temporary databases/binaries used by the new harnesses are owned and cleaned by those harnesses. The project package version is unchanged because no push was requested.
