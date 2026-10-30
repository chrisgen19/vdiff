#!/usr/bin/env node
// Crops a slice of a (tall) section screenshot so it can be viewed at full size.
// Usage: node ~/projects/vdiff/crop.mjs <in.png> <out.png> [top=0] [height=1600]
import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [input, output, top = '0', height = '1600'] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node ~/projects/vdiff/crop.mjs <in.png> <out.png> [top=0] [height=1600]');
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(input)).href);
  await page.addStyleTag({ content: 'body { margin: 0 } img { display: block }' });
  const size = await page.evaluate(() => ({ width: document.images[0].naturalWidth, height: document.images[0].naturalHeight }));
  await page.setViewportSize({ width: size.width, height: size.height });
  const y = Math.min(Number(top), Math.max(size.height - 1, 0));
  const clip = { x: 0, y, width: size.width, height: Math.min(Number(height), size.height - y) };
  await page.screenshot({ path: output, clip, fullPage: true });
  console.log(`${output} (${clip.width}x${clip.height} from y=${y} of ${size.height})`);
} finally {
  await browser.close();
}
