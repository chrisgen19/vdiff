# visual-diff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local CLI that captures the same access-hire pages on a before and an after URL in one run and writes one HTML report of section, style, layout and axe differences.

**Architecture:** `run.mjs` parses args, reads basic auth, writes a run config and spawns Playwright with `playwright.config.mjs`. `capture.pw.mjs` runs one test per page x viewport: it opens before (twice, for noise) and after in separate contexts, captures sections, styles, layout and axe, compares them, and writes one result JSON. `run.mjs` then builds `report.html` from the result JSONs.

**Tech Stack:** Node 24 ESM, `@playwright/test` 1.57.0 (via `visual-diff/node_modules` symlink), installed Chromium, `axe-core` 4.11.0 from `node_modules/.pnpm`, `node:test` for unit tests.

**Spec:** `visual-diff/DESIGN.md`

## Global Constraints

- Nothing tracked changes; no commits, no pushes. `/visual-diff/` is in `.git/info/exclude`. No "Commit" steps in this plan.
- No new packages. Only Node built-ins, `@playwright/test`, `axe-core` (file injected via `page.addScriptTag({ path })`).
- Plain `.mjs`. No file matches `*.spec.*` or `*.test.*`; unit tests live in `visual-diff/test/*.unit.mjs`.
- Default before URL: `https://dev-access-hire-catalogue-access-group-australia.vercel.app`.
- Viewports: desktop 1440x900, tablet 768x1024, mobile 390x844.
- Style props: `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `color`, `text-align`, `padding-top/right/bottom/left`, `margin-top/right/bottom/left`, `gap`, box `x`,`y`,`width`,`height` rounded to 1px.
- Pixel tolerance: per-channel 16; section counts as changed above 0.1% differing pixels or a size difference.
- Touch targets under 44x44, mobile viewport only. axe tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- Credentials never written to files; read from `apps/catalogue-site/.env.local` or `VD_BASIC_AUTH_USERNAME` / `VD_BASIC_AUTH_PASSWORD`.
- Hyphens, not em or en dashes, in all copy.

## Review Focus

- Page returns non-200 or times out on one side: that page x viewport is reported as an error row; the run continues and other pages still report.
- Section present on only one side (block added/removed, or no `builder-id` on a non-Builder page): listed as added/removed, never crashes the matcher.
- Section heights differ (typography changes): pixel compare reports `sizeChanged`, overlay still renders; never a thrown error.
- Same URL on both sides: zero changed sections and zero style changes (noise loads excluded).
- Missing `.env.local` or missing auth vars: run proceeds without credentials and prints one warning.

---

### Task 1: Scaffold, args and auth

**Files:**
- Create: `visual-diff/lib/args.mjs`, `visual-diff/lib/auth.mjs`, `visual-diff/pages.mjs`, `visual-diff/node_modules` (symlink to `../apps/catalogue-site/node_modules`)
- Test: `visual-diff/test/args.unit.mjs`, `visual-diff/test/auth.unit.mjs`

**Interfaces:**
- Produces:
  - `DEFAULT_BEFORE: string`
  - `parseArgs(argv: string[]): { before: string, after: string, pages: string[] | null, viewports: string[], noiseCheck: boolean }`. Throws `Error('--after is required')`; throws on unknown page key or viewport name. Strips trailing `/` from URLs.
  - `readBasicAuth(envFilePath: string, env?: Record<string,string|undefined>): { username: string, password: string } | undefined`. Env vars win; parses `KEY="value" # comment` and `KEY=value`.
  - `pages.mjs`: `PAGES: { key: string, path: string }[]` (13 entries from DESIGN.md), `VIEWPORTS: Record<'desktop'|'tablet'|'mobile', { width: number, height: number }>`, `MASK_SELECTORS: string[]`.

- [ ] **Step 1: Write failing tests**
  - `parseArgs(['--after','http://x/'])` → `{ before: DEFAULT_BEFORE, after: 'http://x', pages: null, viewports: ['desktop','tablet','mobile'], noiseCheck: true }`
  - `--pages home,blog-showcase --viewports mobile --no-noise-check` parsed; `--pages nope` throws `/unknown page: nope/`; missing `--after` throws `/--after is required/`.
  - `readBasicAuth` on a temp file `BASIC_AUTH_USERNAME="u" # c\nBASIC_AUTH_PASSWORD=p` → `{username:'u',password:'p'}`; env override wins; missing file and no env → `undefined`.
- [ ] **Step 2: Run** `node --test visual-diff/test/` → FAIL (modules missing).
- [ ] **Step 3: Implement** `args.mjs`, `auth.mjs`, `pages.mjs`; create the symlink.
- [ ] **Step 4: Run** `node --test visual-diff/test/` → PASS; `node -e "import('@playwright/test')"` from `visual-diff/` resolves.

### Task 2: Pure diffing

**Files:**
- Create: `visual-diff/lib/diff.mjs`
- Test: `visual-diff/test/diff.unit.mjs`

**Interfaces:**
- Consumes: capture shapes from Task 3 (defined here so both agree):
  - `Element = { path: string, text: string, styles: Record<string,string>, box: {x,y,width,height} }`
  - `Section = { id: string, label: string, elements: Element[], screenshot: string | null }`
- Produces:
  - `matchSections(before: Section[], after: Section[]): { pairs: [Section, Section][], added: Section[], removed: Section[] }` by `id`.
  - `diffElements(before: Element[], after: Element[]): { changes: { path, text, prop, before, after }[], added: string[], removed: string[] }`. Box props compared as `box.x` etc.
  - `diffFindings<T>(before: T[], after: T[], key: (t: T) => string): { added: T[], fixed: T[] }`.
  - `withoutNoise(changes, noisyPaths: Set<string>)` drops changes whose `path` is noisy.

- [ ] **Step 1: Write failing tests**: font-size `36px`→`30px` yields one change `{prop:'font-size', before:'36px', after:'30px'}`; identical lists yield `[]`; element only in after lands in `added`; `matchSections` with ids `a,b` vs `b,c` gives one pair, added `c`, removed `a`; `diffFindings` by `id|target` gives added and fixed.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 3: Browser capture and pixel compare

**Files:**
- Create: `visual-diff/lib/capture.mjs`, `visual-diff/lib/pixels.mjs`, `visual-diff/lib/stabilise.css`
- Test: `visual-diff/test/fixtures/before.html`, `visual-diff/test/fixtures/after.html`, `visual-diff/test/capture.unit.mjs`

**Interfaces:**
- Consumes: `MASK_SELECTORS`, `Section`/`Element` shapes (Task 2).
- Produces:
  - `capturePage(page, { url, outDir, prefix, maskSelectors, axePath, isMobile }): Promise<{ status: number, sections: Section[], layout: { overflowX: number, overflowing: {path,label}[], smallTargets: {path,label,width,height}[] }, axe: { id, impact, help, target }[] }>`. Steps: `goto` (waitUntil `load`, 60s), add `stabilise.css` (animations/transitions off, caret hidden), hide `maskSelectors` with `visibility:hidden`, `document.fonts.ready`, scroll to bottom in viewport steps and back to top, wait `networkidle` capped at 10s. Sections: top-level `[builder-id]` elements (no `[builder-id]` ancestor) inside `main` if any, else `header`, each child of `main`, `footer`. Section id = `builder-id` or `tag:index`. Each section screenshot to `${outDir}/${prefix}-${index}.png` via `locator.screenshot({ animations: 'disabled' })`. Elements: visible descendants with text or a box, path = `tag:nth-of-type` chain from section root, capped at 400 per section.
  - `findAxePath(repoRoot: string): string` (first `node_modules/.pnpm/axe-core@*/node_modules/axe-core/axe.min.js`).
  - `comparePngs(browser, beforePath, afterPath): Promise<{ ratio: number, sizeChanged: boolean }>`: loads both as data URLs into canvases on a blank page, counts pixels where any channel differs by more than 16, over the larger area.

- [ ] **Step 1: Write failing test** (Playwright `chromium.launch`, file:// fixtures): fixtures share two `builder-id` sections; `after.html` has `h2` at `30px` instead of `36px`. Assert two sections with ids from `builder-id`, `h2` element `styles['font-size']` is `36px`/`30px`, `comparePngs` on section 0 gives `ratio > 0.001` and on identical files gives `ratio === 0`, and `axe` is an array.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 4: Playwright test, report, CLI

**Files:**
- Create: `visual-diff/playwright.config.mjs`, `visual-diff/capture.pw.mjs`, `visual-diff/lib/report.mjs`, `visual-diff/run.mjs`, `visual-diff/README.md`
- Test: `visual-diff/test/report.unit.mjs`, `visual-diff/test/run.e2e.mjs`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces:
  - Run config at `${runDir}/config.json`: `{ before, after, pages, viewports, noiseCheck, auth?, axePath, runDir }`; path passed to Playwright as `VD_CONFIG`. Auth passed via env `VD_BASIC_AUTH_*`, never in config.json.
  - Result per test at `${runDir}/results/${page}-${viewport}.json`: `{ page, path, viewport, error?, status: {before, after}, sections: { id, label, state: 'changed'|'same'|'noisy'|'added'|'removed', ratio, sizeChanged, before, after, changes }[], layout: {added, fixed}, axe: {added, fixed} }`.
  - `buildReport(runDir: string): string` writes `${runDir}/report.html` and returns its path. Summary table then per-page sections, changed first; images `src` relative; overlay = after image absolutely positioned over before with `mix-blend-mode: difference`.
  - Config: `testMatch: 'capture.pw.mjs'`, `workers: 3`, `timeout: 300_000`, `reporter: 'list'`, `outputDir: ${runDir}/pw`, Chromium, `reducedMotion: 'reduce'`, `ignoreHTTPSErrors: true`.
  - `run.mjs`: exits 0 even when changes exist; exits 1 only on bad args or no results at all. Warns when `after` is `localhost` and when auth is missing. Opens with `wslview` if on PATH.

- [ ] **Step 1: Write failing tests**: `report.unit.mjs` builds from a hand-written result JSON (one changed section with a font-size change, one error row) and asserts the HTML contains `font-size`, `36px`, `30px`, the error message, and no `—` or `–`. `run.e2e.mjs` starts a `node:http` server for the fixtures on a random port serving `before.html` at `/b/` and `after.html` at `/a/`, runs `run.mjs` with a test-only `VD_PAGES` override `[{key:'fixture',path:'/'}]`, `--viewports desktop`, and asserts the result JSON has one `changed` section with the `font-size` change; a second run with `/b/` on both sides has zero changed sections.
- [ ] **Step 2: Run** `node --test visual-diff/test/` → FAIL.
- [ ] **Step 3: Implement** config, spec, report, CLI, README (run, add pages, mask noise, local-build tip).
- [ ] **Step 4: Run** `node --test visual-diff/test/` → PASS.

### Task 5: Real-world verification

- [ ] **Step 1:** `node visual-diff/run.mjs --before <DEV> --after <DEV> --pages home,blog-showcase --viewports desktop,mobile` → report shows 0 changed sections, 0 style changes. Repeat 3 times. If noise appears, add mask selectors / stabilisation, not tolerance hacks.
- [ ] **Step 2:** Full page set DEV vs DEV once: all 13 pages status 200, no error rows.
- [ ] **Step 3:** `git status --short` shows only `.codex/` and `docs/superpowers/`; `pnpm --filter catalogue-site run lint` and `run type-check` pass.
