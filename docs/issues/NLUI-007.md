# NLUI-007: Make CORS preflights route- and method-aware

- Status: Closed
- Priority: P2
- Kind: Defect
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: src/utils/cors.ts; src/server/requestHandler.ts; src/server/routing.ts
- Evidence: 2026-10-14 repository review; 2026-10-15 maintenance qualification

## Problem

Preflight runs before route resolution, returns 204 for missing routes and advertises DELETE on GET-only health. Ordinary OPTIONS and cache variation are conflated.

## Evidence and reproduction

Live source-server requests reproduced nonexistent-route 204 and the incorrect advertised method set.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Require Origin and Access-Control-Request-Method, resolve route methods before preflight, and apply Vary: Origin consistently when policy varies by Origin.

## Acceptance criteria

- [x] Missing routes and disallowed route methods cannot get successful preflight authorization.
- [x] Ordinary OPTIONS is preserved.
- [x] Allowed, denied and no-origin responses have correct cache variation.

## Resolution

Preflight now runs after filesystem-route/static-resource resolution and intersects actual resource methods with the CORS policy. It validates origins, requested methods and headers without invoking a domain handler. Missing routes remain 404 and forbidden methods return 405. Explicit ordinary OPTIONS is retained, and allowlist responses consistently vary on Origin, including denied/no-origin responses. Credentialed wildcard origins fail configuration validation.

[Maintenance qualification](reviews/2026-10-15-maintenance-qualification.md) records unit regressions and ten additional real HTTP cases, including a mutation counter proving preflight never runs POST. All 48 source and 48 compiled Hurl requests, the complete 727-test suite and the production-container gate pass. This is CORS policy correctness, not authentication or CSRF protection.
