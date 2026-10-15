# NLUI-004: Enforce real-path containment for static and document reads

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/utils/staticFiles.ts; src/routes/docs/[...slug].ts
- Evidence: Source/compiled HTTP regressions; macOS/Linux tests; disposable Docker requests

## Problem

Lexical prefix checks do not stop a symlink inside the served directory from exposing a file outside it.

## Evidence and reproduction

A disposable symlink inside public served an external sentinel with HTTP 200 during the 2026-10-14 review.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Resolve canonical roots and candidate real paths, enforce separator-aware containment and regular-file checks, and keep URL decoding and missing-file behavior explicit.

## Acceptance criteria

- [x] Static and document symlinks outside canonical roots return 404 without content disclosure.
- [x] Traversal, malformed encoding, directories and sibling-prefix roots have HTTP regressions.
- [x] Ordinary assets/docs, conditional requests, HEAD and compiled/container reads continue working.

## Resolution

Added a shared canonical containment/regular-file helper and segment-wise URL decoding in `src/utils/files.ts`. Static and document loaders use canonical roots; document slugs reject invalid requests rather than rewriting them. Root symlinks resolving to an approved canonical directory remain usable in packaged applications, but escaped targets and sibling-prefix paths are denied.

Added helper and real HTTP tests plus isolated application fixtures. Source and compiled servers pass the same 38-request smoke suite, including symlink/traversal/directory denial, documents, encoded spaces, HEAD, ETag 304 and ranges. The Docker server denies all 12 escape probes and preserves ordinary reads; all 40 new regressions pass on macOS and Linux. See [verification and retained failed diagnostics](reviews/2026-10-14-file-provider-boundaries.md). Public roots remain application-owned and unwritable by request handlers; this does not promise race-free access against an administrator concurrently replacing filesystem entries.
