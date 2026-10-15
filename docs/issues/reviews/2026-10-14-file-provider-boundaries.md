# File containment and provider completion integrity — 2026-10-14

Scope: NLUI-004 and NLUI-005. The previous SQL/upload/cleanup work and the user's dependency upgrades remain intact and uncommitted. No branch, version, commit or push operation is part of this milestone.

## Implementation

### Canonical public-file boundaries

`src/utils/files.ts` resolves the configured root and candidate through realpath, checks separator-aware canonical containment and permits only regular files. Missing, inaccessible, looping and broken targets are treated as unavailable. URL segments are decoded independently; traversal segments, encoded separators, NULs and malformed escapes are rejected without turning them into a different resource name.

Static assets and Markdown documents share the helper. The document root is specifically public/docs, so a document symlink to another public file cannot cross that narrower boundary. Approved root symlinks remain usable in packaged/runtime fixtures. Existing MIME/cache behavior is retained, including ETag revalidation; Bun still provides HEAD and ranges.

The HTTP harness now copies source and public assets into its owned application root, linking only dependencies and copying package/TypeScript metadata. Source and compiled modes therefore test actual isolated file boundaries, without placing adversarial fixtures in the user's public directory. Directory escape fixtures point at a bounded outside sibling, not recursively back at the application root.

### Successful provider rounds and cancellation

`ProviderRoundGuard` requires an explicit response.completed event with a stable nonempty ID. If status is supplied it must be completed. A response.created ID, a valid structured JSON body or a completed function-call item is not sufficient. Mismatched IDs, contradictory terminal status, post-completion events and stream/disconnect errors cannot publish the buffered response or execute a tool from that incomplete round.

The runner checks cancellation before provider work, while consuming events, before each tool, after awaited execution, before issuing final capabilities and before publishing completion. Failed/incomplete streams settle activity as failed; provider or request cancellation settles active steps as aborted. An earlier legitimately completed tool round is not undone if a later composition round fails, but its candidate controls are not issued from the failed final round.

The route checks cancellation again immediately before committing response-chain state. Failed/cancelled turns preserve the last successful ID, release the in-flight turn and make a claimed UI submission retryable. Factories allow these behaviors to be tested with isolated registries and injected providers; production POST wiring still uses the existing configured runner and registries.

## Verification

| Check | Result |
| --- | --- |
| Runtime / install | Bun 1.4.3; frozen install accepts existing lockfile without dependency changes |
| `bun run check` | Biome checks 150 files; TypeScript passes; 250 tests, 891 expectations, zero failures across 41 files |
| New regressions | 40 added tests: 12 file/helper/HTTP tests, 23 provider completion/cancellation tests, 5 route state/retry tests |
| `task test` / `bun run test:http` | 38 HTTP requests pass against an isolated source application |
| `task test:compiled` | Production compilation succeeds; the same 38 HTTP requests pass against the binary |
| `bun run eval:offline` | 35 specifications, zero catalog issues; 17 assertions/25 rules graded, 55 assertions remain ungraded |
| Docker HTTP | Unprivileged UID 1000 server on Linux/arm64; 12 outside-file/document/traversal/directory probes return 404 without sentinel disclosure; normal assets, encoded spaces, documents, HEAD, ETag 304 and range 206 pass |
| Linux regressions | All 40 new tests pass, 176 expectations, using production dependencies in the disposable container |
| Fresh final container | Rebuilt with the corrected non-cyclic fixture generator; root-level test discovery passes, health is healthy, OOMKilled is false and cgroup OOM counters stay zero |
| Hygiene | Git diff whitespace checks pass; configured values and the registry are checked separately before handoff |

Provider regressions include created-only, JSON-only and tool-only truncation; failed/incomplete/error/cancelled terminals; response-ID changes; contradictory status; events/disconnect after completion; truncation after an earlier valid tool round; successful tool/structured-output and refusal rounds; pre-abort; provider ignoring cancellation until EOF; trace/tool-start/tool-completion/composition cancellation; failed initial/continued turns; UI-result retry; and late cancellation between runner resolution and route commit.

File checks cover direct/directory/sibling-prefix escapes, narrower document containment, regular files versus directories, malformed/traversal/encoded-separator/NUL paths, benign spaces/Unicode/dots, contained symlinks, canonical root symlinks, broken/looping targets, normal Markdown rendering, HEAD, existing ETag handling and ranges.

## Retained failed diagnostics and clean reruns

Early static-check attempts identified an import ordering issue and test-only typing problems (Bun's test.each rest-argument declaration includes a done callback; partial provider fixtures need an explicit unknown cast). These were corrected before the clean checks above.

Initial container-root test discovery was killed with exit 137; cgroup memory events recorded OOM kills, although the application server remained responsive and its HTTP boundary checks passed. The first directory-escape fixture linked public directories back to /app, creating a test-discovery cycle. Running from /app/src passed all 40 regressions. Retargeting only the fixture links to an outside sibling then made the original container-root command pass all 40 as well, without further product-code changes. The tracked fixture generator now uses that bounded sibling design. These failed attempts are not presented as passing checks.

## Limits and disposition

- Closed NLUI-004 and NLUI-005 with recorded behavioral regressions and runtime evidence. The registry now has 30 issues: 11 Closed and 19 Open.
- No paid/live provider request was made; provider behavior is tested against injected stream fixtures and the installed SDK contract. No configured secret/model value was printed, replaced or written to evidence.
- This is not new browser visual acceptance, production authentication/tenant qualification or comprehensive live scenario coverage. No frontend layout redesign was made.
- Canonical containment assumes application-owned public roots are not concurrently modified by an adversarial filesystem writer; it is not a race-free file-descriptor sandbox.
- Cancellation prevents further tool execution/publication and state commitment; it does not roll back work already completed or interrupt every uncooperative pending iterator/tool. Finite deadlines and shutdown grace remain NLUI-009. Broader recovery/durable reconciliation remain separately tracked.
- Windows has not been executed. CI qualification and legacy-script lint coverage remain NLUI-015.
- Owned servers, fixture directories, Docker containers and image tags are removed after verification; existing dev servers, uploads and databases are not cleanup targets.

Next bounded milestone: NLUI-008 public action-error sanitization and NLUI-009 finite request/shutdown budgets, followed by confirmation/form recovery.
