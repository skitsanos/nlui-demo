# NLUI-018: Resolve the transitive KaTeX advisory through a compatible upgrade

- Status: Open
- Priority: P3
- Kind: Improvement
- Created: 2026-10-14
- Updated: 2026-10-14
- Scope: package.json; bun.lock; @ant-design/x-markdown dependency tree
- Evidence: 2026-10-14 repository review

## Problem

The reviewed installed KaTeX 0.16.47 has low-severity advisory GHSA-238p-pmpm-9mq7; the reported patched version is 0.18.2.

## Evidence and reproduction

bun audit during the 2026-10-14 review reported the advisory. It requires separate prototype pollution and unsafe output insertion; neither was demonstrated, and the current renderer uses DOMPurify.

Source roadmap: [frozen migration record](reviews/2026-10-14-roadmap-migration.md). This record distinguishes historical tests from fresh verification and contains no configured credentials.

## Proposed correction

Recheck current upstream metadata/advisory and select a compatible maintained Markdown dependency upgrade; avoid assuming a forced transitive override is safe.

## Acceptance criteria

- [ ] Fresh audit confirms the vulnerable path is removed.
- [ ] Math and Markdown rendering and sanitization regressions pass.
- [ ] Dependency changes preserve the user's supplied upgrades and remain separately qualified.

## Resolution

Pending. Record the implemented change and the checks that satisfy each acceptance criterion before closing.
