# NLUI-033 through NLUI-035: publication and hosted qualification

Date: 2026-10-16. The user authorized committing/pushing all pending work, bumping the version, verifying hosted CI and fixing failures, with **no new provider calls**. This publication does not authorize another live experiment, budget reset, deployment or branch-policy change.

## Published implementation

Release **1.7.0**, commit `8446350366f2d8752f47d632a305a2b6e0c6c572`, publishes the complete NLUI-033 capability, NLUI-034 deterministic/rendered and preserved live-pilot evidence, and NLUI-035 provider-free v2 fallback contract to `main`. No tags or GitHub release artifacts were created.

All three jobs in [Qualification run 38869687421](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421) conclude **success** for that exact commit:

| Hosted job | Result |
| --- | --- |
| [Source and compiled (ubuntu-latest), 116870597220](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421/job/116870597220) | Success; Linux x64, Bun 1.4.3 |
| [Source and compiled (macos-latest), 116870597359](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421/job/116870597359) | Success; macOS arm64, Bun 1.4.3 |
| [Production container (Linux), 116871553038](https://github.com/skitsanos/nlui-demo/actions/runs/38869687421/job/116871553038) | Success; production image, UID 1000, overridden port 3180 |

The [machine-readable receipt](assets/2026-10-16-publication.json) records the exact commit, run and completed job metadata. Both matrix platforms pass **912 tests / 4,682 expectations across 106 files**, Biome/TypeScript, 35 offline scenarios / 77 assertion labels / 100 deterministic rules with zero unsupported/ungraded labels, **60 source + 60 compiled Hurl requests plus eight separate-session probes per mode**, and all **35 exact references** in both modes. The separate Linux container job passes production HTTP/data/permissions/health/shutdown and all 35 references without external networking, retained mounts or provider credentials.

**No hosted failure occurred; no fixes, reruns, waived checks or retry-to-green were needed.** GitHub's Ubuntu-label migration and macOS-runner-capacity annotations are informational notices, not failed application checks. Prior milestone failures remain in their original dated reviews; this successful run does not erase them.

## Local checks and preservation

- `bun --no-env-file install --frozen-lockfile` confirms the existing 352-package dependency resolution without changing the lockfile. Dependencies were already refreshed during the earlier milestone; this publication does not rewrite a frozen pilot's dependency metadata.
- `bun --no-env-file run verify:all` exits **0** on macOS arm64/Bun 1.4.3 with the same 912-test profile, static/offline/HTTP/reference gates, source-free compiled worker, and owned Linux production-container qualification. `bun audit --json` reports no advisories. Local and hosted evidence remain distinct.
- All **90 staged implementation files** pass configured-value and credential-pattern scans; `.env`, local database/WAL/SHM files, private evaluation journals, TODO.md and private-key targets are excluded. `.gitignore`, `data/.gitignore` and `.dockerignore` retain their existing protections. No configured key/model value is printed, committed or replaced; public evidence uses aliases/hashes and sanitized visible outputs only.
- SHA-256 checks confirm **112 protected existing files unchanged**, including ignored configuration, retained databases, the lockfile, both ledgers and frozen public/private pilot evidence. All **99 original journal files** still match the preserved inventory. Read-only budget checks remain **40/40** and **32/32**, with no new reservations, reset or replacement requests.
- Publication uses the existing `main` branch and a normal fast-forward push. No additional local/remote branch, retained-data reset, deployment, branch-protection change or live workflow dispatch was performed.

## Registry reconciliation and final-head boundary

After all three hosted checks passed, NLUI-033/034/035, NLUI-015 and the registry were updated with this receipt. All **35 issues remain Closed** within their recorded scope. The original 13/16 versus 16/16 pilot scores and all three baseline misses stay frozen; controlled rendering remains default, infographics opt-in, **no promotion**. NLUI-035's live verification remains **pending separate authorization and a preregistered study**, not implicitly passed by CI.

The evidence-only follow-up bumps to **1.7.1 before its push**, as required for every push. It changes only documentation/receipt and package version; no implementation, dependency, evaluator or frozen result is changed. That follow-up receives its own complete hosted workflow and must pass before handoff; the earlier 1.7.0 run is not substituted for final-head qualification. The final response links the independently verified final-head run. A commit cannot contain its own future CI outcome without another revision, so the durable receipt above deliberately binds the completed implementation run rather than predicting that outcome.
