# visual-diff (local only)

Before/after styling check for access-hire ([#1264](https://github.com/AccessGroupAustralia/whitelabel-sites/issues/1264)).
Lives in `~/projects/vdiff`, outside the site repo. `VD_PROJECT_ROOT` points at the site repo (default `~/ag-projects/whitelabel-sites`): its `apps/catalogue-site/.env.local` gives basic auth and its pnpm store gives axe-core. `node_modules` is a symlink to `$VD_PROJECT_ROOT/apps/catalogue-site/node_modules` for Playwright.
Design: `DESIGN.md`. Plan: `PLAN.md`.

## Run

```bash
# from the repo root
vdiff --after <PR preview URL>

# options
vdiff \
  --before https://dev-access-hire-catalogue-access-group-australia.vercel.app \
  --after  https://<preview>.vercel.app \
  --pages home,blog-showcase \
  --viewports desktop,mobile \
  --no-noise-check
```

- `--before` defaults to DEV. `--after` is required.
- `--pages`: keys from `pages.mjs` (default: all 13). `--viewports`: `desktop` (1440), `tablet` (768), `mobile` (390); default all.
- `--no-noise-check` skips the second before load (faster, but load-to-load noise shows up as changes).
- Each run writes `~/projects/vdiff/out/<timestamp>/report.html` and opens it with `wslview`. Set `VD_NO_OPEN=1` to skip opening.
- Basic auth comes from `apps/catalogue-site/.env.local` (`BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD`), or `VD_BASIC_AUTH_USERNAME` / `VD_BASIC_AUTH_PASSWORD`.
- A full run (13 pages x 3 viewports x 3 loads) takes a while; narrow it with `--pages` / `--viewports` while iterating.

### Local "after"

`--after http://localhost:3000` works, but `pnpm dev` adds dev-mode noise. For a fair local comparison, check out the PR branch and run a production build:

```bash
pnpm --filter catalogue-site build && pnpm --filter catalogue-site start --port 3001
vdiff --after http://localhost:3001
```

## Reading the report

- Sidebar: every page and viewport with "sections changed / style changes" (orange dot = something changed). Overview is the summary table. On a phone the sidebar is a dropdown. Each page view has its own link (`report.html#p-home-mobile`).
- Page view: page title, full before and after URLs, then sections in page order, named by their heading, with position and height. Changed sections start open; same and noisy ones are dimmed and closed.
- Section states: `changed`, `same`, `added`/`removed` (only on one side), or `noisy` (differed between two loads of the before URL, so not trustworthy).
- Screenshots: before and after; "Show difference" adds the overlay (black = identical, bright = changed). Click a screenshot for full screen, side by side, scrolling together; Esc closes.
- Changes: repeated changes are grouped ("6 h3 elements: font-weight 600 -> 700"). "Every element" (closed) lists each element with its exact values, including position and size shifts (`box.y`, `box.height`, relative to the section), which are usually just knock-on effects.
- Runs before 2026-10-30 have no page titles or recorded section positions; the report shows the path instead and estimates positions from screenshot heights ("about").

## Add a page

Add `{ key, path }` to `PAGES` in `pages.mjs`. Keys are what `--pages` takes.

## Mask noise

If something changes between loads (carousel, banner, widget), add its selector to `MASK_SELECTORS` in `pages.mjs`. Masked elements are hidden with `visibility: hidden` on both sides.

## Tests

```bash
cd ~/projects/vdiff
node --test 'test/*.unit.mjs'   # unit + capture (uses system Chrome)
node --test 'test/run.e2e.mjs'  # full CLI against local fixtures
```

## Notes

- Uses `@playwright/test` from `apps/catalogue-site` through the `node_modules` symlink, system Chrome (`channel: 'chrome'`), and the `axe-core` already in `node_modules/.pnpm`. No packages added.
- Files are `.mjs` and the test file is `capture.pw.mjs`, outside every package, so repo lint, type-check and Jest never see them.

## Claude Code review

Every run also writes `out/<timestamp>/digest.md`: a short text version of the report
(style changes grouped into patterns, axe violation counts per rule, changed sections
merged across viewports with their screenshot paths). The `/vdiff-review` skill
(`skills/vdiff-review/SKILL.md`, symlinked into the site repo's `.claude/skills/`) runs vdiff for a PR or URL, reads
the digest, crops the relevant screenshots with `crop.mjs`, and reports the findings in
chat (also saved as `review.md` in the run folder).

```bash
node ~/projects/vdiff/crop.mjs <in.png> <out.png> [top=0] [height=1600]
```
