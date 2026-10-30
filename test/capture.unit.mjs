import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

import { capturePage, findAxePath } from '../lib/capture.mjs';
import { comparePngs } from '../lib/pixels.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.VD_PROJECT_ROOT ?? path.join(homedir(), 'ag-projects/whitelabel-sites');
const fixture = (name) => pathToFileURL(path.join(here, 'fixtures', name)).href;

let browser;
let page;
const outDir = mkdtempSync(path.join(tmpdir(), 'vd-capture-'));

before(async () => {
  browser = await chromium.launch({ channel: 'chrome' });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
});

after(async () => {
  await browser?.close();
});

const capture = (name, prefix) =>
  capturePage(page, {
    url: fixture(name),
    outDir,
    prefix,
    maskSelectors: [],
    axePath: findAxePath(repoRoot),
    isMobile: false,
  });

test('captures builder sections, styles, axe, and pixel differences', async () => {
  const old = await capture('before.html', 'before');
  const next = await capture('after.html', 'after');
  const again = await capture('before.html', 'again');

  assert.deepEqual(old.sections.map((section) => section.id), ['header:1', 'block-hero', 'block-text', 'footer:1']);

  const heading = (result) => result.sections[1].elements.find((element) => element.path.startsWith('h2'));
  assert.equal(heading(old).styles['font-size'], '36px');
  assert.equal(heading(next).styles['font-size'], '30px');

  assert.ok(Array.isArray(old.axe));
  assert.equal(typeof old.layout.overflowX, 'number');

  const changed = await comparePngs(browser, old.sections[1].screenshot, next.sections[1].screenshot);
  assert.ok(changed.ratio > 0.001 || changed.sizeChanged, `ratio ${changed.ratio}`);

  const same = await comparePngs(browser, old.sections[2].screenshot, again.sections[2].screenshot);
  assert.deepEqual(same, { ratio: 0, sizeChanged: false });

  const ignored = await comparePngs(browser, old.sections[1].screenshot, next.sections[1].screenshot, [
    { x: 0, y: 0, width: 5000, height: 5000 },
  ]);
  assert.equal(ignored.ratio, 0);
});
