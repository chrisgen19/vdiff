import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildReport } from '../lib/report.mjs';

const writeResult = (runDir, name, result) => {
  mkdirSync(path.join(runDir, 'results'), { recursive: true });
  writeFileSync(path.join(runDir, 'results', `${name}.json`), JSON.stringify(result));
};

test('report lists exact style changes and error rows', () => {
  const runDir = mkdtempSync(path.join(tmpdir(), 'vd-report-'));
  writeFileSync(path.join(runDir, 'config.json'), JSON.stringify({ before: 'http://b', after: 'http://a' }));
  writeResult(runDir, 'home-desktop', {
    page: 'home',
    path: '/',
    viewport: 'desktop',
    status: { before: 200, after: 200 },
    sections: [
      {
        id: 'block-hero',
        label: 'section: Hire <equipment>',
        state: 'changed',
        ratio: 0.12,
        sizeChanged: true,
        before: path.join(runDir, 'img/home-desktop-before-1.png'),
        after: path.join(runDir, 'img/home-desktop-after-1.png'),
        changes: [{ path: 'h2:1', text: 'Hire', prop: 'font-size', before: '36px', after: '30px' }],
        changesTotal: 1,
        addedElements: [],
        removedElements: [],
      },
    ],
    layout: {
      overflowX: { before: 0, after: 0 },
      overflowing: { added: [], fixed: [] },
      smallTargets: { added: [], fixed: [] },
    },
    axe: { added: [], fixed: [] },
  });
  writeResult(runDir, 'brand-mobile', { page: 'brand', path: '/brand/hyster', viewport: 'mobile', error: 'page.goto: Timeout 60000ms exceeded.' });

  const reportPath = buildReport(runDir);
  const html = readFileSync(reportPath, 'utf8');

  assert.equal(reportPath, path.join(runDir, 'report.html'));
  assert.match(html, /font-size/);
  assert.match(html, /36px/);
  assert.match(html, /30px/);
  assert.match(html, /Timeout 60000ms exceeded/);
  assert.match(html, /img\/home-desktop-before-1\.png/);
  assert.match(html, /Hire &lt;equipment&gt;/);
  assert.doesNotMatch(html, /[–—]/);
});
