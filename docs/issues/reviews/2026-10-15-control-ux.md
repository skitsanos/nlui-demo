# Control UX — 2026-10-15

Scope: NLUI-012 and NLUI-014 together, followed by NLUI-013. Existing prior milestone edits and dependency upgrades are preserved. No commit, push, version bump or branch operation is requested or performed.

## Resolution

- Form values use the same small, application-owned normalization helper at client submission and server capability consumption. Only null in an issued optional numeric field becomes omission. Exact numbers (including zero), required nulls, nonnumeric nulls, wrong types, ranges and extra fields are not silently rewritten into valid values. Undefined issued fields follow JSON omission; unknown undefined keys are retained as null for rejection. The server uses its stored rules, not a client-provided required flag.
- DynamicForm is extracted from NluiRenderer. Its controller has idle/submitting/submitted/error states. Only in-flight submission loads; success stays visibly submitted and locked. Failure/throw preserves Ant Design's field store and restores editing/retry with a fixed safe notice. Both the synchronous controller and onFinish wrapper guard duplicates. The controller belongs to the issued interaction, surviving parent rerenders; cleanup invalidates late completions.
- StatisticsBlock renders optional titles as h3 headings, descriptions as secondary text, and a named section with unique heading/description references. Untitled groups use Summary statistics. Existing metric cards, labels, values, suffixes, formatting and trends stay intact. Metadata wraps, and the grid's minimum width cannot exceed the available width.
- Fixture-specific styling stays under tests/fixtures. Production modules remain modular (new modules 16–52 lines). No new production endpoint, provider call, mutation capability or principal/authorization behavior is introduced.

## Verification

| Gate | Result |
| --- | --- |
| Runtime / frozen install | Bun 1.4.3; 240 installs across 266 packages checked without changes |
| `bun run check` | Biome checks 189 files; TypeScript passes; 439 tests / 1410 expectations across 60 files, zero failures |
| New regression coverage | 60 tests beyond the previous 379-test milestone |
| Form normalization and authority | Optional null/undefined, exact zero/bounds, required null/missing/type/range failures, other null types, prototype/unknown keys, conversation/expiry/replay scope, invalid attempts preserving the valid capability |
| Client/HTTP/stream round trip | Actual controller -> JSON -> chat route -> stored capability -> injected runner -> NDJSON consumer; raw null from older clients also canonicalizes; failure releases its claim and an edited retry completes; tampered client required flags cannot relax server rules |
| Source/compiled controls | New real-process cases exercise null canonicalization and extra-field rejection in each runtime, with graceful fixture cleanup; the existing 12 lifecycle cases also pass |
| `bun run eval:offline` | 35 specifications; 17 assertions / 25 rules graded; 55 assertions still ungraded; zero catalog issues |
| `task test` | All 38 isolated source HTTP checks pass |
| `task test:compiled` | Production binary (3491 modules) builds; all 38 isolated HTTP checks pass |
| Browser form flow | Real Ant Design fields and chat route in StrictMode: clear optional budgets; observe in-flight disabled controls; release success; confirm no spinner and locked Submitted state; required empty text blocks dispatch; fail another response, retain/edit values, then retry successfully |
| Browser final state | Zero loading buttons; two disabled Submitted buttons; success has one runner attempt, retry has two; all received payloads omit the cleared budget, and the retry contains the edited Travel value |
| Browser statistics | Existing synthetic dataset records (SKU-0001 / ORD-1176) in a disposable seeded database; product/order headings and descriptions, unique valid region associations, fixture h1/h2/h3 hierarchy and unchanged displayed metrics during interaction |
| Responsive layout | Default 1280px viewport: four populated metric columns; 375px viewport: two 162.5px metric columns within each 335px region; document width equals viewport width; viewport override reset afterward |
| Console | No warnings/errors observed in the fixture browser |
| Hygiene | All 30 issue IDs, statuses/index rows, closed acceptance criteria and issue/report links validate; configured-value scan finds zero key/model matches across 138 changed/untracked files; `.env`/TODO.md remain ignored and `git diff --check` passes |

Screenshots: [pending submission](../evidence/2026-10-15/control-form-pending.jpg), [editable failure](../evidence/2026-10-15/control-form-retry.jpg), [desktop final state](../evidence/2026-10-15/control-ux-desktop.jpg), [mobile final state](../evidence/2026-10-15/control-ux-mobile.jpg).

## Retained development diagnostics

- Initial type checks caught test stub/negative-case undefined unions, widened discriminants and a fixture RouteContext mismatch. FormInputValues now explicitly models Ant Design's undefined values while canonical typed results remain JSON-safe; malformed negative tests are explicitly typed. Source fixtures use complete route contexts.
- A static-render expectation incorrectly assumed InputNumber adds thousands separators. The control correctly retains raw 1500; the assertion was corrected to that unchanged value rather than adding formatting to the input.
- Biome import-order fixes were applied to the affected new test modules. Final checks above passed afterward.

## Disposition and limits

NLUI-012, NLUI-014 and NLUI-013 are closed against their acceptance criteria. Registry: 30 permanent issues, 17 Closed and 13 Open. Next bounded direction: NLUI-006 (effective SQL predicate evaluation), followed by coherent fixtures and remaining evaluation/CI work.

No paid model call or live provider request was made. The browser fixture uses the actual renderer, form descriptor factory, chat route, server capability and stream consumer, but a provider-free runner and an isolated copy of the existing seed. It is not whole-application live conversation or production/tenancy acceptance. No new Linux/Docker or Windows evidence is claimed for this milestone.

This does not persist form/controller state across reload, revive expired capabilities, or reconcile a chat completion whose response was lost after server acceptance. Durable conversation replay remains NLUI-022. Wider application heading hierarchy, keyboard/a11y audits and onboarding remain NLUI-024.

Owned test servers/directories were cleaned by their harnesses. The manual browser fixture stopped successfully, its exact owned temporary directory was verified absent, the browser tab was closed and the viewport override was reset. Screenshots are retained as issue evidence. Existing development servers, retained data and uploads were not cleanup targets.
