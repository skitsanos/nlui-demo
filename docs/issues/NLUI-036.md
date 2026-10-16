# NLUI-036: Refresh current documentation and guard against interface drift

- Status: Closed
- Priority: P2
- Kind: Documentation defect
- Created: 2026-10-16
- Updated: 2026-10-16
- Scope: Served documentation, README, verification guide and current release evidence
- Evidence: Architecture contradicts its own owned-history contract; served docs omit NLUI-033 through NLUI-035; final 1.7.1 CI is successful

## Problem

The served architecture still claims stored provider-response chaining despite the HTTP controller using application-owned history and `store: false`. Served guides omit opt-in infographics, both presentation evaluators, the separate exhausted 32-attempt pilot and provider-free v2 fallback alignment. Current-release summaries still describe 1.7.1 qualification as future work. Dated reviews must remain historical rather than being rewritten to look current.

## Acceptance criteria

- [x] Correct current transport/storage guidance and document gated capabilities, evaluation commands and both exhausted budgets.
- [x] Record exact final 1.7.1 hosted qualification separately from new local working changes.
- [x] Add regression checks for documented commands, route links and published tool/feature coverage; prove served Markdown renders.
- [x] Keep historical evidence and retained configuration/data unchanged; synchronize the registry.

## Resolution

Closed on 2026-10-16. Served guides now describe owned `store: false` history consistently and link a maintained research page covering gated visuals, provider-free evaluators, frozen selection outcomes, v2 limits and both exhausted caps. README/verification/registry reconcile the final 1.7.1 commit with its independently successful [run 38870544256](https://github.com/skitsanos/nlui-demo/actions/runs/38870544256), not a prediction from the earlier implementation run. Historical reviews/results are preserved; initial design QA is explicitly labelled historical.

`bun run docs:check`, TypeScript and targeted Biome pass. Four documentation regressions check real package commands/direct-script paths, links, generated domain tool coverage and feature metadata; mutation canaries prove drift is detected. Every served guide renders via the real contained Markdown handler over loopback HTTP. The focused docs/owned-provider/original-pilot replay group passes **7 tests / 178 expectations**. NLUI-037 adds subsequent integration/full-qualification evidence; the old hosted run does not qualify these new working changes. No provider calls, publication, credential changes or retained-data reset occurred.

The subsequent [combined qualification](reviews/2026-10-16-docs-and-skills.md) passes 941 tests / 4,932 expectations and source/compiled/container gates, with browser inspection and unchanged retained evidence. This supplements rather than rewrites the documentation phase's earlier focused count.

## Hosted publication

Version 1.8.0, `780e420ede08b7383c291f2146f5ce98625bd1c6`, publishes this milestone and NLUI-037 to `main`. All three jobs/checks pass in [run 38876296502](https://github.com/skitsanos/nlui-demo/actions/runs/38876296502), with 941 tests / 4,932 expectations per Linux/macOS platform and the Linux production-container gates. No hosted failure or provider call occurred. The [publication section](reviews/2026-10-16-docs-and-skills.md#authorized-publication-follow-up) records exact receipts, unchanged configuration/data/results and the separately version-bumped 1.8.1 evidence follow-up, which requires its own hosted verification.
