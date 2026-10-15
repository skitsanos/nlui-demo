# NLUI-018: Resolve the transitive KaTeX advisory through a compatible upgrade

- Status: In progress
- Priority: P3
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-15
- Scope: package.json; bun.lock; @ant-design/x-markdown dependency tree
- Evidence: 2026-10-14 repository review; 2026-10-15 maintenance qualification

## Problem

The reviewed installed KaTeX 0.16.47 has low-severity advisory GHSA-238p-pmpm-9mq7; the reported patched version is 0.18.2.

## Evidence and reproduction

bun audit during the 2026-10-14 review reported the advisory. It requires separate prototype pollution and unsafe output insertion; neither was demonstrated, and the current renderer uses DOMPurify.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Recheck current upstream metadata/advisory and select a compatible maintained Markdown dependency upgrade; avoid assuming a forced transitive override is safe.

## Acceptance criteria

- [x] Fresh audit confirms the vulnerable path is removed.
- [ ] Math/Markdown rendering, sanitization and exact published plugin imports pass on hosted Linux and macOS.
- [x] Dependency changes preserve the user's supplied upgrades and remain separately qualified.

## Resolution

Fresh upstream/advisory inspection found XMarkdown still declaring the vulnerable 0.16 range. The application therefore pins a specifically qualified KaTeX 0.18.2 override, rather than assuming upstream semver compatibility. Its public renderToString adapter remains compatible; a small .katex-tag CSS bridge preserves the renamed equation-tag positioning. Revisit the override when upstream publishes a suitable patched dependency range.

Isolated regressions exercise the actual production Markdown component and upstream math adapter, including escaped HTML, inert links/images, inherited trust options, inline/block formulas and equation tags. A real browser confirms readable output, correct positioning, no unsafe executable nodes and no console warnings/errors. Fresh bun audit --json returns {} with exit 0 and the tree resolves one patched KaTeX path.

The regular bun update/install preserves existing constraints while refreshing OpenAI to 7.34.0 and React/React DOM to 19.3.1. [Maintenance qualification](reviews/2026-10-15-maintenance-qualification.md) records 727 passing tests and source/compiled/container checks for these dependency changes. The override is tested application compatibility, not an upstream support claim; no live-provider performance/compatibility claim is made.

### Hosted portability follow-up

Reopened after release 1.6.0 [run 38748113060](https://github.com/skitsanos/nlui-demo/actions/runs/38748113060/job/116467019520) failed Linux typechecking: `markdown-probe.tsx` and `markdown-ui.tsx` imported `plugins/latex`, but the installed package publishes `plugins/Latex`. A case-insensitive macOS filesystem masked the fixture defect. Both imports now use the exact package spelling. `markdownSafety.test.ts` compares fixture plugin specifiers against real directory entries, so a case-insensitive host also catches a recurrence. Reclosure requires the corrected hosted matrix/container gates; the vulnerable dependency is not restored and no check is waived.
