# NLUI-003: Isolate HTTP smoke fixtures and cleanup from retained data

- Status: Closed
- Priority: P1
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: Taskfile.tests.yaml; scripts/smoke-http.ts; tests/http-smoke.hurl
- Evidence: Regression tests and isolated execution

## Problem

The old task overwrote the root random_file and recursively removed all uploads on Unix and Windows, potentially destroying unrelated user data.

## Evidence and reproduction

`Taskfile.tests.yaml` previously contained dd/PowerShell writes to random_file and whole-directory uploads deletion. `src/server/httpSmoke.test.ts` retains sentinel uploads and a same-named fixture while running successful and deliberately failed tests after an actual upload.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Start a separate server with a unique temporary CWD and ephemeral port. Supply read-only runtime inputs and an 8 MB owned fixture. Stop children in finally and remove only the mkdtemp-created root.

## Acceptance criteria

- [x] The default task needs no existing server and never cleans the caller's uploads or databases.
- [x] Success and failure after an upload remove only owned fixtures while preserving sentinel data.
- [x] Source and compiled modes execute the same non-billable HTTP assertions.
- [x] Child processes stop on failures/timeouts and cleanup is implemented in Bun rather than platform shell deletion.

## Resolution

Replaced destructive inline shell tasks with the isolated Bun runner and tracked Hurl fixture. Both modes pass 20 requests; cleanup regressions pass. Windows code paths are portable by construction but have not been executed on this macOS host.
