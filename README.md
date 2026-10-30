# vdiff

Before/after visual diff for **access-hire** (whitelabel-sites, Builder.io blocks).
It loads the same pages on two versions of the site, usually DEV and a PR
preview, and reports exactly what changed: font sizes, spacing, colours,
layout, new accessibility issues, with screenshots side by side.

Built for [#1264](https://github.com/AccessGroupAustralia/whitelabel-sites/issues/1264)
and first used on PR #1112. Local tool only: it lives here, outside the site
repo, and is never committed there. For other sites see `~/projects/vdiff-u`.

## Quick start

```bash
vdiff --after https://catalogue-access-hire-<id>-access-group-australia.vercel.app
```

About 12 minutes later the report opens in your browser. That's it.

## Setup (once)

You need:

1. **The site repo** at `~/ag-projects/whitelabel-sites` with dependencies
   installed (`pnpm install`). vdiff borrows its Playwright and axe-core.
2. **The `node_modules` link** in this folder:
   ```bash
   ln -s ~/ag-projects/whitelabel-sites/apps/catalogue-site/node_modules ~/projects/vdiff/node_modules
   ```
3. **Google Chrome** installed (vdiff uses it instead of downloading a browser).
4. **Basic auth** for DEV and previews in
   `~/ag-projects/whitelabel-sites/apps/catalogue-site/.env.local`
   (`BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD`). vdiff reads it from there;
   don't copy it anywhere else.
5. **The `vdiff` command** in `~/.zshrc`:
   ```bash
   alias vdiff='node ~/projects/vdiff/run.mjs'
   ```

Check it works: `vdiff` with no options should print `--after is required` and
the usage line.

If the site repo lives somewhere else, set `VD_PROJECT_ROOT=/path/to/whitelabel-sites`.

## Testing a PR

1. **Deploy the PR as access-hire.** Comment on the PR:
   ```
   /deploy access-hire
   ```
   Vercel's automatic PR builds skip access-hire, so this comment is needed.
2. **Get the preview URL.** After about 2 minutes `github-actions[bot]` replies
   "Preview deployed for access-hire (catalogue)" with the **Preview URL**.
   Check its **Commit** matches the PR's latest commit.
3. **Check the page list** in `pages.mjs` covers what the PR touches (see
   [Choosing pages](#choosing-pages)).
4. **Run it:**
   ```bash
   vdiff --after <Preview URL>
   ```
5. **Read the report** (opens by itself) or ask Claude Code to review it (below).

Keep the PR up to date with `dev`. "Before" is always the latest DEV, so if the
PR branch is behind, changes merged into dev since then show up as differences.

### Let Claude Code do it

In a Claude Code session in whitelabel-sites:

```
/vdiff-review 1234
```

It finds the PR's preview (and asks before commenting `/deploy`), checks the
page list against the PR's changed files, runs vdiff, looks at the screenshots
that matter, and reports in chat: likely regressions, worth checking, expected
changes, fixed. Also works with a URL or "the last run". The skill is in
`skills/vdiff-review/SKILL.md`, linked into whitelabel-sites' `.claude/skills/`.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `--after <url>` | required | The new version: a PR preview, or a local build |
| `--before <url>` | DEV access-hire | The version to compare against (e.g. UAT) |
| `--pages a,b` | all 13 | Only these pages (keys from `pages.mjs`) |
| `--viewports a,b` | all | `desktop` (1440px), `tablet` (768px), `mobile` (390px) |
| `--no-noise-check` | off | Skips a second load of "before" that filters out flaky differences. About a third faster, but expect false "changed" sections |

Environment variables:

| Variable | What it does |
| --- | --- |
| `VD_NO_OPEN=1` | Don't open the report when done |
| `VD_RUN_DIR=<dir>` | Write the run to this folder instead of `out/<timestamp>` |
| `VD_PROJECT_ROOT=<dir>` | Where whitelabel-sites is (default `~/ag-projects/whitelabel-sites`) |
| `VD_BASIC_AUTH_USERNAME`, `VD_BASIC_AUTH_PASSWORD` | Use these instead of `.env.local` |

Examples:

```bash
# Quick check while iterating (about 1 minute)
vdiff --after <url> --pages home,product --viewports desktop,mobile

# Compare against UAT instead of DEV
vdiff --before <UAT url> --after <url>

# Local production build of the PR branch (not `pnpm dev`, which adds noise)
pnpm --filter catalogue-site build && pnpm --filter catalogue-site start --port 3001
vdiff --after http://localhost:3001
```

## What you get

Each run is a folder `out/<timestamp>/`:

| File | What it is |
| --- | --- |
| `report.html` | The full report. Open in a browser; from Windows: `\\wsl.localhost\Ubuntu\home\chrisgen19\projects\vdiff\out\<timestamp>\report.html` |
| `digest.md` | Short text version for Claude Code to review |
| `img/` | Section screenshots (the report needs these next to it) |
| `results/` | Raw data per page and viewport |

Runs are about 2 MB of HTML plus screenshots each. Clear old ones with
`rm -rf ~/projects/vdiff/out/*`.

## Reading the report

- **Sidebar:** every page and viewport, with "sections changed / style
  changes". Orange dot = something changed. **Overview** is the summary table.
  On a phone it's a dropdown at the top. Each page has its own link, e.g.
  `report.html#p-home-mobile`.
- **Page header:** page title and the full before and after URLs (click to
  open the real pages).
- **Sections** run in page order, named by their heading, with position and
  height ("Section 5 of 6, 588px from the top, height 1,428px → 1,392px").
  Changed ones start open; unchanged ones are dimmed and closed.

  | State | Meaning |
  | --- | --- |
  | `changed` | Styles or pixels differ |
  | `same` | Nothing changed |
  | `added` / `removed` | The section exists on only one side |
  | `noisy` | Pixels differ, but they also differed between two loads of "before", so it's probably not the PR |

- **Screenshots:** before and after. **Show difference** adds an overlay
  (black = identical, bright = changed). **Click a screenshot** for full screen,
  side by side, scrolling together; Esc closes.
- **Changes** are grouped: "6 h3 elements: font-weight 600 → 700" means six
  headings all changed the same way. **Every element** (closed) lists each
  element with exact values, plus position and size shifts (`box.y`,
  `box.height`), which are usually knock-on effects of something above
  getting smaller or bigger.
- **Layout and accessibility findings** (per page, closed): new horizontal
  overflow, elements spilling out of their section, small tap targets on
  mobile, and axe violations only one side has.

Reading tips:

- **Trust style changes over pixels.** Style changes are measured from the
  page; pixel differences can come from images or load timing.
- **Axe "added" and "fixed" lists can be the same element twice** when a PR
  renames CSS classes. Compare the number of violations per rule instead
  (`digest.md` has them).
- **Category and search pages** render products with Algolia after load, so
  small pixel-only changes there are usually noise.

## Choosing pages

The page list is `PAGES` in `pages.mjs`. It was chosen for PR #1112 (one page
of each type, plus `/moiz-test`, that PR author's test page, which may be
deleted). For a new PR, check which blocks and pages it changes and add or
remove entries:

```js
{ key: 'faq', path: '/faq' },
```

The key is what `--pages` takes. A page that no longer exists shows as an
error row in the report, and the run carries on.

## Hiding noise

If something changes on every load (cookie banner, chat widget, a carousel
that isn't pinned), add its CSS selector to `MASK_SELECTORS` in `pages.mjs`.
It's hidden on both sides before capture.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `--after is required` | Pass `--after <url>` |
| `unknown page: X` / `unknown viewport: X` | Use a key from `pages.mjs` / `desktop`, `tablet`, `mobile` |
| `Warning: no basic auth found` | Check `apps/catalogue-site/.env.local` has `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`, or set the `VD_BASIC_AUTH_*` variables |
| Every page is 401 | Same as above: wrong or missing basic auth |
| `Cannot find package '@playwright/test'` | The `node_modules` link is missing or the site repo needs `pnpm install` (see [Setup](#setup-once)) |
| Chrome not found | Install Google Chrome |
| `axe-core not found` | Run `pnpm install` in the site repo |
| Report opened an old run | Each run makes a new folder; check the timestamp in the path |
| Lots of `noisy` sections | Normal on Algolia pages; elsewhere, add the moving element to `MASK_SELECTORS` |

## For developers

- Design and the decisions behind it: `DESIGN.md` ("Build notes" lists every
  noise fix). Original build plan: `PLAN.md`.
- Tests:
  ```bash
  cd ~/projects/vdiff
  node --test 'test/*.unit.mjs'   # unit tests and capture (uses Chrome)
  node --test 'test/*.e2e.mjs'    # full runs against local test pages
  ```
- Crop a slice of a tall screenshot to view it at full size:
  ```bash
  node ~/projects/vdiff/crop.mjs <in.png> <out.png> [top=0] [height=1600]
  ```
- Code: `run.mjs` (CLI) runs `capture.pw.mjs` with Playwright, then builds
  `report.html` and `digest.md`. `lib/` holds capture, compare, diff, pixel
  compare and report code; `lib/in-page.js` runs inside the captured page.
