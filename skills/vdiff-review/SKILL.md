---
name: vdiff-review
description: Run the local visual-diff tool (vdiff) for a PR's access-hire preview, or take an existing run, then review it and report the findings in chat so the user doesn't have to read report.html. Use when the user asks to run or review a visual diff, check a PR for visual regressions, or types /vdiff-review. Trigger phrases include "visual diff", "vdiff", "visual regression", "review the report", "check PR 1234 visually".
---

# vdiff review

The user doesn't read `report.html`; you review the run and report back. The tool lives in
`~/projects/vdiff` (its own repo, outside the site repo). Its design and
known noise are in `~/projects/vdiff/DESIGN.md` (read "Build notes" once per session).

## Inputs

One of:
- a PR number: get its access-hire preview URL (step 1)
- a preview or local URL: go to step 2
- an existing run (`~/projects/vdiff/out/<timestamp>` or "the last run"): go to step 3

Optional: `--pages`, `--viewports`, `--before` to pass through.

## 1. Preview URL for a PR

```bash
gh api "repos/AccessGroupAustralia/whitelabel-sites/issues/<PR>/comments?per_page=100" \
  --jq '[.[] | select(.user.login=="github-actions[bot]" and (.body|test("Preview deployed.*access-hire")))] | last | .body'
gh pr view <PR> --json headRefOid,updatedAt
```

- Use the preview only if its **Commit** matches the PR's `headRefOid`; otherwise it's stale.
- No current preview: ask the user before commenting `/deploy access-hire` (it's visible to
  the team). On a yes: `gh pr comment <PR> --body "/deploy access-hire"`, find the run with
  `gh run list --workflow pr-preview-deploy.yml --limit 1`, wait with
  `gh run watch <id> --exit-status` in the background, then read the bot comment again.
- Check how far behind `dev` the PR is
  (`gh api repos/AccessGroupAustralia/whitelabel-sites/compare/dev...<headRefOid> --jq .behind_by`):
  if it's behind, differences from later dev merges show up too. Say so in the report.

## 2. Check the page set, then run

`PAGES` in `~/projects/vdiff/pages.mjs` was chosen for #1112. Read the PR's changed files
(`gh pr diff <PR> --name-only`) and tell the user if it touches pages or blocks the set
doesn't cover; suggest entries, and edit `pages.mjs` only on a yes.

Run in the background (about 12 min for all pages; don't pipe it):

```bash
VD_NO_OPEN=1 node ~/projects/vdiff/run.mjs --after <url> [--pages a,b] [--viewports desktop,mobile]
```

The last lines print `Report:` and `Digest:` paths.

## 3. Review

1. Read `<run>/digest.md` (for an older run without one:
   `node --input-type=module -e "import { buildDigest } from '/home/chrisgen19/projects/vdiff/lib/digest.mjs'; console.log(buildDigest(process.argv[1]))" <run>`).
2. Look at the screenshots behind anything suspicious. Section screenshots are often
   thousands of px tall and unreadable when viewed whole, so crop slices into the scratchpad:
   `node ~/projects/vdiff/crop.mjs <run>/img/<file>.png <scratchpad>/x.png [top] [height]`,
   then Read them. Compare before and after at the same `top`.
3. Sort what you found:
   - **Likely regressions**: layout breaks (columns, overflow, clipped or overlapping
     content, missing sections), new axe violations by **count per rule**, text that
     became hard to read, an HTTP status that isn't 200.
   - **Worth checking**: sections only one side has, structural changes, large pixel
     changes without style changes on pages that aren't Algolia-driven.
   - **Expected changes**: the style patterns, grouped (e.g. "h2 36px -> 30px, 47x").
     Compare them with what the PR says it does (`gh pr view <PR> --json title,body`) and
     call out the ones that don't match it (a font-family or colour change in a
     type-scale PR, say).
   - **Fixed**: overflow that went away, rule counts that went down.
4. Known noise, don't report as findings: axe added/fixed **lists** (class-name churn: use
   the counts), small targets with equal +/- counts, pixel-only changes on `category` and
   `search` (Algolia renders late), sections marked noisy.

## 4. Report back

In chat, short: the sorted lists above, each item one line with page, viewport and exact
values, and say which ones you confirmed by looking at the screenshot. End with the report
path and the `\\wsl.localhost\Ubuntu\...` form of it for the user's browser. Also write the
same review to `<run>/review.md`.

Don't change product code, comment on the PR, or post findings anywhere without asking.
