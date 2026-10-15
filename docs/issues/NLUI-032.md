# NLUI-032: Resolve the embedded SQL worker from the compiled entrypoint

- Status: Closed
- Priority: P1
- Kind: Defect
- Created: 2026-10-15
- Updated: 2026-10-15
- Scope: src/data/queryDataset.ts; src/evals/compiledEvaluation.test.ts
- Evidence: Compiled provider-free corpus reproduction and source-free executable regression

## Problem

A production-compiled evaluation failed all five generic SQL scenarios with `SQL_INTERNAL`: the isolated worker could not start. The module-relative URL used in source mode resolved relative to the bundled main entrypoint in compiled mode, rather than the embedded worker entrypoint. Existing malformed-request HTTP checks did not execute a data query, so they did not detect this defect.

## Evidence and reproduction

Compile `scripts/eval-fixtures.ts` and `src/data/queryWorker.ts` as entrypoints and run the binary with `--json`. Before the fix, the five `query_dataset` scenarios failed even though their source executions passed. The strengthened regression runs the binary from its owned directory containing only `data/knowledge/` and `data/scenarios.jsonl`: no source tree or `node_modules` can supply a fallback worker.

See [the recorded diagnostics and qualification](reviews/2026-10-15-deterministic-evaluation.md). Bun requires worker entrypoints to be included explicitly; the documented compiled worker specifier is relative to the build entrypoint, not the original source module. See [Bun executable worker documentation](https://bun.sh/docs/bundler/executables).

## Proposed correction

Reuse the shared compiled-runtime detection, select the explicit embedded `./src/data/queryWorker.ts` entrypoint in compiled mode and retain the module-relative file URL in source mode. Keep the worker in the existing production build entrypoint list.

## Acceptance criteria

- [x] Source queries continue to use the isolated read-only worker with unchanged SQL safety and cancellation behavior.
- [x] A compiled executable executes the five SQL cases without source/dependency fallback and preserves the full expected corpus profile.
- [x] Source/compiled HTTP gates and the full lint/type/test suite pass; the failed initial diagnostic is retained in evidence.

## Resolution

`queryDataset.ts` now selects the embedded entrypoint using the existing `isCompiled` helper. The new compiled CLI regression builds both entrypoints and executes all 35 reference cases from a source-free owned directory: 28 passed, seven explicitly incomplete, zero errors/failures. The five generic SQL cases pass. `bun run check` passes 597 tests / 1870 expectations across 73 files; source and compiled HTTP suites pass 38 requests each. This verifies the compiled worker locally on macOS/Bun 1.4.3, not a new container, remote deployment or Windows qualification. No retained database was reset.
