import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const NETWORK_IDLE_CAP_MS = 10_000;
const DOM_QUIET_MS = 1000;
const DOM_QUIET_CAP_MS = 10_000;

/**
 * Waits until the DOM has had no mutations for `quietMs` (capped), so content
 * rendered client-side after hydration (Algolia facets and hits) has settled.
 */
const waitForDomQuiet = (page) =>
  page.evaluate(
    ({ quietMs, capMs }) =>
      new Promise((resolve) => {
        let timer = setTimeout(done, quietMs);
        const cap = setTimeout(done, capMs);
        const observer = new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(done, quietMs);
        });
        function done() {
          observer.disconnect();
          clearTimeout(timer);
          clearTimeout(cap);
          resolve();
        }
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      }),
    { quietMs: DOM_QUIET_MS, capMs: DOM_QUIET_CAP_MS },
  );

/** axe.min.js from the axe-core already installed in the pnpm store. */
export const findAxePath = (repoRoot) => {
  const store = path.join(repoRoot, 'node_modules/.pnpm');
  const dir = readdirSync(store).find((name) => name.startsWith('axe-core@'));
  if (!dir) throw new Error(`axe-core not found in ${store}`);
  return path.join(store, dir, 'node_modules/axe-core/axe.min.js');
};

/** Scrolls through the page so lazy Builder blocks and images load, then back to the top. */
const loadLazyContent = async (page) => {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_CAP_MS }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    const pending = [...document.images].filter((img) => !img.complete);
    await Promise.race([
      Promise.all(pending.map((img) => new Promise((resolve) => img.addEventListener('loadend', resolve, { once: true })))),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  });
};

const stabilise = async (page, maskSelectors) => {
  await page.addStyleTag({ path: path.join(here, 'stabilise.css') });
  const masks = maskSelectors.map((selector) => `${selector} { visibility: hidden !important; }`).join('\n');
  if (masks) await page.addStyleTag({ content: masks });
};

const axeViolations = async (page) => {
  const violations = await page.evaluate(
    async (tags) => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] })).violations,
    AXE_TAGS,
  );
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => ({ id: violation.id, impact: violation.impact, help: violation.help, target: node.target.join(' ') })),
  );
};

/**
 * Runs axe twice, a second apart after network idle, and keeps only violations
 * both runs agree on: client-side state (e.g. search card buttons) can still
 * be settling, which made contrast results flip between loads.
 */
const runAxe = async (page, axePath) => {
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_CAP_MS }).catch(() => {});
  await page.addScriptTag({ path: axePath });
  const first = await axeViolations(page);
  await page.waitForTimeout(1000);
  const second = new Set((await axeViolations(page)).map((v) => `${v.id}|${v.target}`));
  return first.filter((v) => second.has(`${v.id}|${v.target}`));
};

const screenshotSection = async (page, index, file) => {
  const locator = page.locator(`[data-vd-section="${index}"]`);
  await page.evaluate((i) => window.__vd.settleSection(i), index);
  await page.evaluate((i) => window.__vd.isolateSection(i), index);
  const box = await locator.boundingBox();
  if (!box || box.width < 1 || box.height < 1) return null;
  await locator.screenshot({ path: file, animations: 'disabled' });
  return file;
};

/**
 * Loads one URL and captures sections (with screenshots), per-element styles,
 * layout findings and axe violations. Section and element shapes are the ones
 * lib/diff.mjs compares.
 */
export const capturePage = async (page, { url, outDir, prefix, maskSelectors, axePath, isMobile }) => {
  const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await stabilise(page, maskSelectors);
  await loadLazyContent(page);
  await waitForDomQuiet(page);
  await page.addScriptTag({ path: path.join(here, 'in-page.js') });
  const marked = await page.evaluate(() => window.__vd.markSections());
  const sections = [];
  for (const [index, section] of marked.entries()) {
    const elements = await page.evaluate((i) => window.__vd.collectElements(i), index);
    const screenshot = await screenshotSection(page, index, path.join(outDir, `${prefix}-${index}.png`));
    sections.push({ ...section, elements, screenshot });
  }
  const layout = await page.evaluate((mobile) => window.__vd.collectLayout(mobile), isMobile);
  const axe = await runAxe(page, axePath);
  return { status: response?.status() ?? 0, sections, layout, axe };
};
