import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';

import { capturePage } from './lib/capture.mjs';
import { compareCaptures } from './lib/compare.mjs';
import { MASK_SELECTORS, PAGES, VIEWPORTS } from './pages.mjs';

const config = JSON.parse(readFileSync(process.env.VD_CONFIG, 'utf8'));
const pages = process.env.VD_PAGES
  ? JSON.parse(process.env.VD_PAGES)
  : PAGES.filter((page) => !config.pages || config.pages.includes(page.key));
const auth =
  process.env.VD_BASIC_AUTH_USERNAME && process.env.VD_BASIC_AUTH_PASSWORD
    ? { username: process.env.VD_BASIC_AUTH_USERNAME, password: process.env.VD_BASIC_AUTH_PASSWORD }
    : undefined;

const imgDir = path.join(config.runDir, 'img');
const resultsDir = path.join(config.runDir, 'results');
mkdirSync(imgDir, { recursive: true });
mkdirSync(resultsDir, { recursive: true });

const captureSide = async (browser, { baseUrl, pagePath, viewport, prefix }) => {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    deviceScaleFactor: 1,
    // No isMobile emulation: on a page with horizontal overflow it widens the layout
    // viewport to the content (innerWidth 822 on a 390 screen), and element screenshots
    // then crop the wrong area. Overflow itself is still reported by collectLayout.
    isMobile: false,
    hasTouch: viewport === 'mobile',
    reducedMotion: 'reduce',
    httpCredentials: auth,
  });
  try {
    const page = await context.newPage();
    return await capturePage(page, {
      url: `${baseUrl}${pagePath}`,
      outDir: imgDir,
      prefix,
      maskSelectors: MASK_SELECTORS,
      axePath: config.axePath,
      isMobile: viewport === 'mobile',
    });
  } finally {
    await context.close();
  }
};

for (const { key, path: pagePath } of pages) {
  for (const viewport of config.viewports) {
    test(`${key} @ ${viewport}`, async ({ browser }) => {
      const id = `${key}-${viewport}`;
      const result = { page: key, path: pagePath, viewport };
      try {
        const side = (baseUrl, label) => captureSide(browser, { baseUrl, pagePath, viewport, prefix: `${id}-${label}` });
        const before = await side(config.before, 'before');
        const after = await side(config.after, 'after');
        const noise = config.noiseCheck ? await side(config.before, 'noise') : undefined;
        result.status = { before: before.status, after: after.status };
        result.title = { before: before.title, after: after.title };
        Object.assign(result, await compareCaptures({ browser, before, after, noise }));
      } catch (error) {
        result.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
      }
      writeFileSync(path.join(resultsDir, `${id}.json`), JSON.stringify(result, null, 2));
    });
  }
}
