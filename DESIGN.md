# visual-diff: before/after styling check (local only)

Local implementation of [#1264](https://github.com/AccessGroupAustralia/whitelabel-sites/issues/1264).
Never committed or pushed: the whole `visual-diff/` folder is hidden through
`.git/info/exclude`, so it never shows in `git status` and works on any branch.

## Why

PR #1112 (MACU-170) moves ~36 components, blog prose, breadcrumbs and
`AccordionTrigger` onto one shared type scale. Chris wants to see, before and
after that PR, exactly what moved: font size and specs, alignment, padding,
margin, and anything else, with exact values rather than eyeballing two tabs.

A committed-PNG baseline (the cgendio-v2 `visual.spec.ts` pattern) doesn't fit:
Builder content is live, so baselines drift whenever content is edited. Both
sides are captured **in the same run**, so content is identical and every
difference comes from code.

## Goals

- One command compares two URLs (default before: DEV) across a fixed page set
  at several viewports and writes one HTML report.
- The report shows, per page and viewport: section screenshots with a visual
  diff, exact computed-style changes per element, layout problems, and axe
  violations that only the after side has.
- Same URL on both sides gives zero changes (no flaky noise).

## Non-goals

- PR-comment trigger, CI, blocking merges (ticket follow-ups; not local work).
- Other sites (blueprint, access-express, C&S), signed-in or checkout pages.
- Checking against Figma. The report says what changed; Chris judges it
  against the expected-changes table in #1264.

## Anti-goals (a failure even if it runs)

- Touching any tracked file: no `package.json`, lockfile, `turbo.json`, app
  config or `.gitignore` changes, and no new packages.
- Getting picked up by repo tooling (`eslint .`, `tsc` `**/*.ts`, Jest's
  `*.spec.*` match, lint-staged, husky). Hence the repo-root location below,
  outside every package.
- Storing credentials in the tool's files.
- A report so noisy (animation, carousels, lazy loading) that real changes
  hide in it.

## Constraints

- Uses what's installed: `@playwright/test` 1.57.0 from
  `apps/catalogue-site/node_modules`, the installed Chromium
  (`~/.cache/ms-playwright`), and `axe-core` 4.11.0 already in
  `node_modules/.pnpm` (injected with `page.addScriptTag({ path })`).
- Node 24, plain ESM `.mjs` (no TS build step, nothing for `tsc` to find).
- Basic auth from `apps/catalogue-site/.env.local`
  (`BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD`, same vars the existing
  `playwright.config.ts` reads), overridable by env vars. Sent to both sides;
  ignored by a local server that doesn't ask for it.

## Decided

**Location and layout** (repo root, excluded):

```
visual-diff/
  run.mjs              CLI entry: args, auth, runs Playwright, builds report
  playwright.config.mjs
  capture.pw.mjs       the one test file (name avoids Jest's *.spec.* match)
  pages.mjs            page set + mask selectors
  lib/                 capture, compare and report helpers
  README.md            how to run, add pages, mask noise
  DESIGN.md            this file
  node_modules ->      symlink to ../apps/catalogue-site/node_modules so
                       '@playwright/test' resolves (untracked, local)
  out/<timestamp>/     report.html, images, data.json per run
```

`.git/info/exclude` gets `/visual-diff/`.

**Command:**

```bash
node visual-diff/run.mjs \
  --before https://dev-access-hire-catalogue-access-group-australia.vercel.app \
  --after  <PR #1112 /deploy access-hire preview URL> \
  [--pages home,moiz-test] [--viewports desktop,mobile]
```

`--before` defaults to the DEV URL above. `--after` is required. It accepts a
local server (`http://localhost:3000`), with a printed warning that
`pnpm dev` adds dev-mode noise and a local `next build && next start` is the
fair local comparison. Ends by printing the report path (and opening it with
`wslview` when available).

**Same-run capture:** one test per page x viewport opens the before and after
URLs in two browser contexts, captures both, then compares in-process. No
snapshot directories, no second pass.

**Page set** (all return 200 on DEV, checked 2026-10-30):

| Key | Path | Covers |
| --- | --- | --- |
| `moiz-test` | `/moiz-test` | 29 of the 31 changed Builder blocks (PR author's test page; may disappear) |
| `blog-showcase` | `/about-us/news/test-typography-and-block-showcase` | Prose h2-h6, lists, quotes |
| `blog-post` | `/about-us/news/how-to-choose-the-best-light-tower-for-hire-according-to-your-project` | Real post, header block, h2/h3 |
| `home` | `/` | Toggle Block, real block use |
| `blog-listing` | `/about-us/news` | Listing blocks |
| `contact` | `/contact-us` | Contact and enquiry forms, accordions |
| `off-hire` | `/contact-us/off-hire-or-extend` | Off-hire toggle and forms |
| `branch` | `/contact-us/find-a-branch/sydney` | Locations, branch page |
| `category` | `/category/boom-lift` | Category listing, breadcrumbs |
| `brand` | `/brand/hyster` | Brand page |
| `product` | `/product/dingli-26ft-electric-scissor-lift-narrow-s0808-pace` | Product detail, enquiry, related products |
| `search` | `/search?q=scissor` | Results, sort |
| `search-empty` | `/search?q=zzqxnoresults` | No-results state |

**Viewports:** desktop 1440x900, mobile 390x844. Tablet 768x1024 is also on by
default (my call: #1112 adds tablet heading steps).

**Checks:**

1. *Sections and screenshots.* Each page is split into sections: top-level
   Builder blocks matched by their `builder-id` (identical on both sides,
   same content), otherwise `header`, each child of `main`, `footer`. Each
   section is screenshotted on both sides. Changed ratio comes from a canvas
   pixel compare run in Chromium (no pixelmatch needed). The report shows
   before, after, and a `mix-blend-mode: difference` overlay, which works
   even when heights differ.
2. *Computed-style diff.* For visible elements inside each section, matched
   by a structural path (tag + nth-of-type from the section root), compare
   `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`,
   `color`, `text-align`, `padding-*`, `margin-*`, `gap`, and the box
   (`x`, `y`, `width`, `height`, rounded to 1px). Report exact values
   (`h2 font-size 36px -> 30px`). Elements that exist on only one side are
   listed as added or removed.
3. *Layout.* Horizontal page overflow, elements overflowing their section,
   tappable elements under 44x44 (mobile only). Reported as new or fixed vs
   before.
4. *Accessibility.* axe WCAG 2.2 AA tags. Only violations (rule id + target)
   that the after side has and the before side doesn't.

**Determinism:** `reducedMotion: 'reduce'`, a stylesheet that zeroes
animations and transitions, `document.fonts.ready`, scroll to the bottom and
back to trigger lazy Builder blocks and images, then wait for network idle
(capped). Mask selectors in `pages.mjs` hide cookie/consent banners, Marker.io,
chat widgets and carousel autoplay regions. A page or section that differs
between two before-only loads is flagged noisy, not changed.

**Report:** one `report.html`. A summary table (page x viewport: sections
changed, style changes, layout and axe findings), then per page a section
list, changed sections first, each with images and its style-change table.
Static HTML, no external assets. A page that fails on one side (non-200,
timeout) is reported and the run continues.

## Left to the builder

- Exact mask selectors (find them on DEV).
- Pixel tolerance for anti-aliasing (start per-channel 16, flag above 0.1%).
- Caps on elements per section to keep the report readable.
- Worker count (2-4) and timeouts.

## Build notes (2026-10-30)

Calls made while building, found by DEV vs DEV runs:

- System Chrome (`channel: 'chrome'`), same as `catalogue-site`'s Playwright
  config. Playwright 1.57's bundled Chromium build isn't installed, and both
  sides use the same browser, so no download.
- Fixed and sticky elements (site header, reCAPTCHA badge) are hidden while
  other sections are screenshotted, or they overlap them.
- Embla carousels are pinned to their first-slide layout (`transform: none`
  on track and slides); autoplay moved them between loads.
- Box differences of 1px or less are ignored (sub-pixel rounding).
- Pixels inside `img`, `video`, `iframe` and `canvas` boxes are excluded from
  the pixel ratio: the srcset candidate that loads varies. Their size and
  position still go through the style diff.
- Section counts as visually changed above 0.5% differing pixels (not 0.1%);
  image decode timing alone reached ~0.25%. Style changes always mark a
  section changed, whatever the pixels say.
- Embla `AutoHeight` (carousel-block) resized the track to the active slide;
  the track is pinned to `height: auto`.
- Capture waits until the DOM has had no mutations for 1s (capped at 10s):
  Algolia facets and hits on category and search render after hydration and
  changed heights and contrast results between loads.
- axe runs twice a second apart and keeps only agreed violations; added and
  fixed findings (axe and layout) that also differ between the two before
  loads are dropped as unstable.
- `node --test` needs a glob in Node 24: `node --test 'test/*.unit.mjs'`.

## Acceptance

- `--before X --after X` with X = DEV gives zero changed sections and zero
  style changes on all pages, three runs in a row.
- A deliberate local change (e.g. a heading `font-size` on a local
  production build) shows up with exact before/after values and a diff image.
- `git status` is clean after install and a run; `pnpm --filter
  catalogue-site run lint` and `type-check` still pass.
- The first real run against #1112's preview produces a readable report.
- Mobile captures don't use Playwright's `isMobile` emulation (width 390 and touch
  only). With it, horizontal overflow widened the layout viewport to the content
  (`innerWidth` 822 on DEV blog-showcase) and section screenshots cropped the wrong
  area while the reported box stayed the same: the #1112 run's blog-showcase mobile
  "before" images showed the section above. Found 2026-10-30.
