# NLUI-007: Make CORS preflights route- and method-aware

- Status: Open
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: src/utils/cors.ts; src/server/requestHandler.ts; src/server/routing.ts
- Evidence: 2026-10-14 repository review

## Problem

Preflight runs before route resolution, returns 204 for missing routes and advertises DELETE on GET-only health. Ordinary OPTIONS and cache variation are conflated.

## Evidence and reproduction

Live source-server requests reproduced nonexistent-route 204 and the incorrect advertised method set.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Require Origin and Access-Control-Request-Method, resolve route methods before preflight, and apply Vary: Origin consistently when policy varies by Origin.

## Acceptance criteria

- [ ] Missing routes and disallowed route methods cannot get successful preflight authorization.
- [ ] Ordinary OPTIONS is preserved.
- [ ] Allowed, denied and no-origin responses have correct cache variation.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
