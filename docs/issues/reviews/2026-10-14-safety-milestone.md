# SQL, upload and test safety milestone — 2026-10-14

Scope: NLUI-001, NLUI-002 and NLUI-003, with the ignored roadmap migrated to a tracked registry. This is local qualification on macOS with Bun 1.4.3, not a production-security or complete end-to-end model-evaluation claim.

## Changes

- JOIN validation now proves a positive required foreign-key equality involving the exact new alias and an earlier source. Only direct equalities/AND conjuncts establish that proof. ON clauses reject OR, future/implicit aliases and nested SELECTs. Input and serialized SQL both pass the policy; legal parameterized semantic plans continue to work.
- Uploads use UUID filenames, conservative basename normalization, exclusive `wx` creation and mode 0600. Existing files/symlinks cannot be overwritten; collisions retry at most three times. Unsupported media types return 415, malformed multipart/missing files return 400, and unexpected storage errors remain generic publicly. Only an owned partial file is removed on failure.
- HTTP smoke tests now own their server, ephemeral port, temporary CWD, 8 MB fixture, uploads and cleanup. Read-only runtime inputs are linked/copied; cleanup does not traverse symlink targets. The same Hurl assertions run against source and compiled servers. The runner has bounded startup/request waits and forces child shutdown if graceful exit exceeds two seconds.
- New runner code is included in lint. Broader legacy-script/CI coverage is still NLUI-015.
- The registry has 30 permanent issue files: 9 Closed, 21 Open. Six historical milestones retain dated evidence; they are not presented as newly executed live/visual checks. The original roadmap is frozen and the ignored TODO.md now points to the registry. AGENTS.md describes the maintenance contract.

## Verification

| Check | Result |
| --- | --- |
| `bun install --frozen-lockfile` | Existing upgraded dependency graph accepted; no package changes |
| `bun run check` | 143 files linted; TypeScript passes; 210 tests, 715 expectations, zero failures across 37 test files |
| New deterministic regressions | 32 added tests: JOIN structure/scope, query-worker denotation, upload concurrency/collisions/symlinks/input/partial cleanup, and HTTP cleanup on success/failure after a real upload |
| `bun run compile` / `task test:compiled` | Production binary builds; all 20 HTTP requests pass |
| `bun run test:http` / `task test` | Source server: all 20 HTTP requests pass without an existing dev server |
| `bun run eval:offline` | 35 specifications validated; 32 single-turn, 1 multi-turn, 2 route; 17 assertions/25 rules graded, 55 assertions still ungraded; zero catalog issues |
| Disposable Docker image | Builds and runs healthy on Bun 1.4.3 as UID 1000; JSON upload returns 415; three concurrent same-name uploads have unique names and retain all three bodies |
| Docker exclusions | `.env`, issue-registry files and test fixtures absent from the image |
| `git diff --check` | Passes |
| Registry consistency | All 30 IDs are sequential and uniquely indexed; statuses/counts, local evidence links and closed acceptance criteria agree |
| Configured-value scan | 52 changed/new files checked against both configured provider values; no matches; `.env` and TODO.md remain ignored |

The two originally reproduced invalid joins are rejected before worker execution; the legal repeated-customer-alias join returns exactly 1,500 rows. Upload tests preserve existing content and symlink targets after forced collisions. Cleanup tests place retained sentinel uploads and a root-style random_file alongside the owned smoke root; both survive a passing run and an intentionally failed assertion after an upload, while the owned root is removed.

During runner development, a disturbed startup-log stream, doubled URL slash and Hurl file-root restriction caused failed diagnostics. They were corrected before the final clean source/compiled/task runs above. The deliberately failing Hurl assertion in the cleanup regression is expected; the test passes only if cleanup and sentinel preservation succeed.

Temporary servers, fixture directories, the disposable container and its image tag were removed. Existing dev servers were not stopped. No billable provider requests were made; configured secrets/model values were not printed, replaced or added to evidence. The pre-existing dependency edits in package.json and bun.lock are preserved. No commit, push, version bump or branch operation was performed.

## Remaining boundaries

- Exact resolution of every AST column to a published field is NLUI-023; this milestone specifically repairs relationship-JOIN validation, not all SQL security research.
- Canonical real-path static/document containment is NLUI-004 and remains open.
- Uploads remain an inherited storage example, not trusted dataset ingestion.
- Windows junction/copy and cleanup paths have not been executed on this macOS host. Hurl-dependent cleanup tests explicitly skip if Hurl is unavailable; the HTTP task itself fails clearly when Hurl is missing.
- Current offline evaluation validates contracts/scorers, not 35 complete live trajectories. No new rendered UI acceptance is claimed for these backend/test changes.

Recommended next bounded work: NLUI-004 and NLUI-005 (file containment and provider terminal-state integrity), followed by action failure recovery and finite lifecycle budgets.
