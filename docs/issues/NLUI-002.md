# NLUI-002: Make upload allocation exclusive and validate multipart input

- Status: Closed
- Priority: P1
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/routes/api/upload.ts; src/utils/uploadStorage.ts
- Evidence: Regression tests and isolated execution

## Problem

Timestamp-based names collided for simultaneous same-name uploads, and Bun.write overwrote the first body. JSON and malformed multipart input escaped parsing as internal errors.

## Evidence and reproduction

The original isolated reproduction returned 200 twice for the same timestamp destination and retained only the second body. `src/utils/uploadStorage.test.ts` now exercises concurrency, collisions, existing symlinks, malformed input and partial-write cleanup.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Use server-generated UUID names with exclusive wx creation and private file permissions. Retry collisions without overwriting. Validate media type and catch multipart parsing errors before filesystem allocation; return generic write errors.

## Acceptance criteria

- [x] Concurrent same-name uploads preserve unique filenames and every body.
- [x] Existing files and symlink targets survive collisions and exhaustion unchanged.
- [x] Invalid media types return 415; malformed multipart or missing file returns 400 without writes.
- [x] Sanitized names remain inside storage and failed writes remove only their own partial files.

## Resolution

Implemented bounded exclusive allocation and a testable upload handler. Upload regressions and source/compiled HTTP assertions pass. Storage is not public NLUI dataset onboarding; that remains NLUI-024.
