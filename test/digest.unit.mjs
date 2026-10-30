import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildDigest } from '../lib/digest.mjs';

const layout = { overflowX: { before: 0, after: 0 }, overflowing: { added: [], fixed: [] }, smallTargets: { added: [], fixed: [] } };

const result = (viewport, runDir) => ({
  page: 'home',
  path: '/',
  viewport,
  status: { before: 200, after: 200 },
  sections: [
    {
      id: 'block-hero',
      label: 'section: Hire equipment',
      state: 'changed',
      ratio: 0.12,
      sizeChanged: false,
      before: path.join(runDir, `img/home-${viewport}-before-1.png`),
      after: path.join(runDir, `img/home-${viewport}-after-1.png`),
      changes: [
        { path: 'div:1>h2:1', text: 'Hire', prop: 'font-size', before: '36px', after: '30px' },
        { path: 'div:1>h2:1', text: 'Hire', prop: 'box.height', before: 40, after: 36 },
      ],
      changesTotal: 2,
      addedElements: [],
      removedElements: [],
    },
    { id: 'footer:1', label: 'footer', state: 'same', ratio: 0, sizeChanged: false, changes: [], changesTotal: 0, addedElements: [], removedElements: [] },
  ],
  layout,
  axe: { added: [{ id: 'button-name', impact: 'critical', target: 'button.a' }], fixed: [{ id: 'button-name', impact: 'critical', target: 'button.b' }] },
  axeCounts: { before: { 'button-name': 1, 'color-contrast': 2 }, after: { 'button-name': 3, 'color-contrast': 2 } },
});

const writeRun = () => {
  const runDir = mkdtempSync(path.join(tmpdir(), 'vd-digest-'));
  mkdirSync(path.join(runDir, 'results'));
  writeFileSync(path.join(runDir, 'config.json'), JSON.stringify({ before: 'http://b', after: 'http://a' }));
  for (const viewport of ['desktop', 'mobile']) {
    writeFileSync(path.join(runDir, 'results', `home-${viewport}.json`), JSON.stringify(result(viewport, runDir)));
  }
  writeFileSync(path.join(runDir, 'results', 'brand-desktop.json'), JSON.stringify({ page: 'brand', viewport: 'desktop', error: 'Timeout' }));
  return runDir;
};

test('digest groups style patterns and compares axe as counts per rule', () => {
  const runDir = writeRun();
  const md = readFileSync(buildDigest(runDir), 'utf8');

  assert.match(md, /\| font-size: 36px -> 30px \| 2 \| h2 \| home \| "Hire" \|/);
  assert.doesNotMatch(md, /box\.height: 40 -> 36/);
  assert.match(md, /\| home \| desktop \| button-name \| 1 -> 3 \|/);
  assert.doesNotMatch(md, /color-contrast \| 2 -> 2/);
  assert.match(md, /\| brand \| desktop \| ERROR: Timeout/);
});

test('digest merges a section across viewports with relative screenshot paths', () => {
  const runDir = writeRun();
  const md = readFileSync(buildDigest(runDir), 'utf8');

  assert.equal(md.match(/### home: section: Hire equipment/g).length, 1);
  assert.match(md, /desktop \(changed\), mobile \(changed\); 4 style\/box changes; max pixel ratio 12\.0%/);
  assert.match(md, /- mobile: before `img\/home-mobile-before-1\.png`, after `img\/home-mobile-after-1\.png`/);
  assert.doesNotMatch(md, /footer/);
});
