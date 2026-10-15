# Owned workflow qualification — 2026-10-15

Closes NLUI-022, NLUI-023 and NLUI-024 in the explicitly approved **isolated anonymous-session local-demo** scope, and records integration verification for NLUI-019/020/021. This is not authenticated production tenancy, human usability certification, deployment or hosted-CI evidence. The retained incompatible v1 business database and existing ignored provider settings were not replaced/reset.

## Durable ownership and replay (NLUI-022)

- Separate `NLUI_STATE_DB_PATH` private SQLite file, versioned append-only public events with monotonic sequences, application request/turn IDs and replay cursors. Unknown/newer databases are refused before schema/file-mode mutation; a byte-preservation regression covers an unrelated retained database.
- Opaque random seven-day HttpOnly/SameSite=Strict cookie; only its hash is stored. Explicit foreign origins fail. Owner checks precede history, artifact/debug, preview and confirmation access. Shared synthetic business rows are **not** tenant-filtered.
- Stable request IDs/input digests reject changed payloads, stale heads and overlapping turns; identical completed requests replay without provider/tool/mutation execution. Limits: 1,000 local sessions, twenty conversations/session, two hundred turns/conversation, one running/conversation, two/owner, eight globally. This is intentionally single-process, not a distributed lease design.
- Replay pages expose `nextCursor`/`hasMore` rather than silently losing later events. Client rebuild is ordered/deduplicated and marks interrupted messages explicitly, including runs interrupted before the first assistant event. Current conversation ID survives refresh; session expiry does not grant recovery to a new owner.
- Persisted capability rules, lifecycle, completed confirmation result and immutable analysis artifacts survive restart. Executing confirmations reconcile against the idempotent durable domain result. Failed model continuation releases its submission claim. No replay triggers a mutation.
- Owned HTTP provider adapter uses `store: false`, bounded committed domain history and no cross-turn provider ID. Required within-turn provider outputs are retained in RAM through the SDK conversion helper, not persisted as hidden reasoning. A legacy isolated control adapter still tests managed chaining; tests verify this distinction rather than claiming a live comparative quality gain.
- AG-UI is a bounded owner-scoped JSON replay projection: run/text plus custom activity/block events, pagination/interruption metadata. It is not an SSE implementation or exhaustive AG-UI conformance. Domain schemas do not depend on its version.

## Adversarial scope and capabilities (NLUI-023)

Exact AST field resolution applies before and after canonicalization: lexical/sequential CTE scopes, published output lineage, physical aliases and unambiguous references. Unpublished rowid/oid/private columns, wrong/hidden aliases, forward/shadowed CTE references, unsupported correlation, comments outside strings, Unicode identifiers and oversized/negative/fractional offsets fail closed. Output-alias precedence follows the supported SQLite ORDER BY/GROUP BY/HAVING rules; a valid joined `region` alias regression prevents over-rejection. Existing effective-predicate proof remains separate and conservative.

Bounded fuzz regressions span quoting, nesting, CTEs, joins, comments, aliases, offsets and Unicode. Real SQLite adversarial fixtures put instruction-like text in descriptions, policies, support subjects and return reasons, and a canary in an unpublished email column. A model request cannot grant itself fresh action intent, reveal the canary, select another action/order or prepare an unspecified target. This proves deterministic controller boundaries, **not that an LLM is immune to prompt injection**. Exact explicit user action type/order or verified domain form submission is required; missing target produces an owned form, not an inferred mutation.

Pending-action supersession and confirmation bind owner + conversation + action type + exact order. One owner's replacement does not invalidate another owner's proposal; cross-owner execution/retry fails. Unknown confirmation identity is not treated as a shared supersession key. Real SQLite tests prove mutation-once behavior and cached/reconstructed retry. Normal progress has fixed labels and no provider/tool/SQL/secret diagnostics. Catalog metadata labels synthetic-personal, untrusted-text and aggregate fields; private trace details remain explicit internal evaluation/debug data, not general logs.

## Lifecycle, accessible data and quarantine (NLUI-024)

- Submitted/superseded/expired/completed/executing states are visible; controls cannot re-submit after replay. Expiry refreshes on a wall clock. Failure keeps the selection and safe retry path; submitting progress settles rather than pretending an action completed.
- Ant Design X starters retain the approved layout but have native keyboard buttons and description/disabled semantics. Product choices and continuation work with Space/Enter.
- Charts expose a keyboard-toggle semantic data table. Tables use intrinsic column widths and an internal horizontal viewport; arrows/Home/End pan that viewport only when its wrapper is focused. Sorting/export applies only to the shown bounded rows; analytical sorting produces a traced refinement.
- CSV export quotes cells, preserves true negative numeric cells and neutralizes spreadsheet formula strings. Real browser download contained 26 records (one header, 25 visible rows); it contains only synthetic data at `~/Downloads/nlui-result.csv`.
- CSV onboarding is an explicitly fixed aggregate-template inspection, not arbitrary upload-to-live-data. Byte/row/cell/type/UTF-8/key/enum checks, duplicate rejection, finite numeric bounds, bounded multipart/deadline/cancellation and per-owner preview limits precede retention. Only ten sample rows plus count/hash/warnings are stored. Status is always quarantined/executable=false, inaccessible to another session and absent from query/provider schemas. No activation endpoint exists.
- Deprecated Ant Design `List` policy rendering was replaced with semantic list markup; existing policy explanations remain application-owned.

## Fresh executable gates

Final `bun --no-env-file run verify:all` **exit 0** on local Bun 1.4.3:

| Gate | Result |
| --- | --- |
| Biome / TypeScript | 299 files clean; typecheck passed |
| Bun regressions | **803 passed, 0 failed**, 2,601 expectations, 96 files |
| Offline catalog | 35 scenarios; 77 labels / 100 rules, 0 unsupported/ungraded/issues |
| Source HTTP | **60/60 Hurl requests**, plus 8 separate-cookie-jar ownership/quarantine requests |
| Compiled HTTP | **60/60 Hurl requests**, plus the same 8 owner-isolation requests |
| Source / source-free compiled reference | **35/35 each**, 0 incomplete; compiled worker has no source fallback |
| Production container | non-root UID 1000, loopback/no external network, real SQL/health/write permissions/shutdown, separate-session probes; **35/35 reference**, 0 incomplete |
| Dependency audit | `bun audit --json`: `{}`, exit 0 |
| Diff hygiene / module size | `git diff --check` clean; largest code/test module 388 LOC, runner 382 |

Private full-gate logs: `/tmp/nlui-remaining-qualified-final.log` and the repeated final documentation/registry pass `/tmp/nlui-remaining-delivery-final.log`, both exit 0 with the same counts. Test subprocesses withhold provider settings and disable dotenv/live evaluation. Images, containers and temporary databases have exact owned cleanup; no Docker prune or retained-data reset is used. `.env`, TODO, generated SQLite/WAL/SHM and `eval-results` remain ignored; container probes reject packaged state/credentials. A final value-comparison scan of tracked/unignored text found neither existing configured provider value; it printed counts/paths only, never the values. No publication/version bump was performed because no push was requested.

## Browser evidence

The browser used the real production App, routes, capability registry, SQLite repository and renderers with an injected deterministic controller over disposable v2 data; **no extra provider request**. The fixture's configured-status badge is fixture metadata, not evidence of a live provider call. The user's existing server/tab was left untouched.

1. Space-activated delayed-orders starter: annotation plus 25-of-70 table; correct dates/currency, actual CSV export. Desktop page/scroll width 1566/1566, table viewport 739 vs content 1248. ArrowRight moved inner scroll from 0 to 80 px.
2. At 390×844, page/scroll width stayed 390/390 while table viewport/content were 248/1248; no outer overflow or broken currency/header wrapping. [Mobile table](assets/2026-10-15-mobile-table.jpg).
3. Keyboard product selection → submitted acknowledgement; refresh restored the read-only submitted state.
4. Return form → explicit proposal → confirmation → completed result. Fixture mutation count was **1 before and after refresh**; replay did not call another tool or mutate again.
5. Two-row synthetic CSV inspection visibly reported **2 validated rows · Quarantined**, with warning that no data entered the chat/schema.
6. Typed eligible-revenue regional chart → West-only result with readable exact filter, preserved parent chart and no duplicate DOM IDs/page overflow. [Scope/refinement](assets/2026-10-15-typed-refinement.jpg).
7. Opt-in actual X Card showed the same metric/chart data, keyboard chart alternative and choices, and a safe controlled fallback for unsupported confirmation. [X Card chart](assets/2026-10-15-xcard-chart.jpg).

No current application console exceptions or Ant Design deprecation warnings remained. Historical initial-fixture errors and expected Bun HMR full-reload/socket messages were not erased or misclassified as a clean initial run. Temporary viewport overrides were reset; the agent-created fixture/tab were closed after verification.

## Initial diagnostics retained and corrected

- A new browser import pulled filesystem dataset constants into the client (`process` undefined): split pure shared metadata and added a real Bun-browser-bundle regression excluding filesystem/SQLite imports.
- An early analysis HTTP request tried revision hashing before first lazy seed: initialization now precedes hashing.
- A purported foreign Cookie test reused Hurl's own valid cookie jar: replaced with independent fetch cookie jars and eight executable probes, not a claimed authorization bypass.
- Confirmation lifecycle integration exposed an undefined supersession-key collision: only identified domain confirmations supersede each other; source/compiled regressions pass.
- Focusability alone did not pan the actual table viewport: added bounded keyboard handler and measured actual movement in-browser.
- X Card root-data updates rendered a waiting placeholder despite valid command parsing: tested SDK lowering plus actual DOM mount/browser verification corrected it.
- Updating protocol docs correctly removed the provider-ID compatibility exception, but an old documentation assertion still demanded that phrase: updated it to assert owned replay/foreign-session denial. The intermediate full gate failed and is retained separately; the final full gate above passed.

## Scope limits

Anonymous cookies are not authenticated users, the synthetic dataset is not tenant-partitioned, local storage is not encrypted, and multi-process recovery/retention/identity integration need a separate production design. A2UI remains off by default; SQL remains the chat control. The [research record](2026-10-15-remaining-research.md) reports bounded results, unknown usage and lack of measured promotion benefit. Current changes are local only: last published release 1.5.1/hosted checks remain historical until an authorized version-bumped push and new CI run.
