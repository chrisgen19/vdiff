import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffElements, diffFindings, diffStableFindings, matchSections, withoutNoise } from '../lib/diff.mjs';

const element = (path, styles, box = { x: 0, y: 0, width: 100, height: 40 }) => ({
  path,
  text: 'Heading',
  styles,
  box,
});

const section = (id) => ({ id, label: id, elements: [], screenshot: null });

test('reports a font-size change with exact values', () => {
  const result = diffElements(
    [element('h2:1', { 'font-size': '36px', color: 'rgb(0, 0, 0)' })],
    [element('h2:1', { 'font-size': '30px', color: 'rgb(0, 0, 0)' })],
  );
  assert.deepEqual(result.changes, [
    { path: 'h2:1', text: 'Heading', prop: 'font-size', before: '36px', after: '30px' },
  ]);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, []);
});

test('reports box changes as box.<prop>', () => {
  const result = diffElements(
    [element('p:1', {}, { x: 0, y: 10, width: 100, height: 40 })],
    [element('p:1', {}, { x: 0, y: 10, width: 100, height: 32 })],
  );
  assert.deepEqual(result.changes.map((change) => [change.prop, change.before, change.after]), [
    ['box.height', 40, 32],
  ]);
});

test('ignores 1px box shifts from sub-pixel rounding', () => {
  const result = diffElements(
    [element('h2:1', {}, { x: 619, y: 10, width: 100, height: 40 })],
    [element('h2:1', {}, { x: 620, y: 10, width: 100, height: 41 })],
  );
  assert.deepEqual(result.changes, []);
});

test('identical lists give no changes', () => {
  const list = [element('h2:1', { 'font-size': '36px' })];
  assert.deepEqual(diffElements(list, list), { changes: [], added: [], removed: [] });
});

test('elements on one side only are added or removed', () => {
  const result = diffElements([element('p:1', {})], [element('p:1', {}), element('p:2', {})]);
  assert.deepEqual(result.added, ['p:2']);
  assert.deepEqual(result.removed, []);
});

test('matchSections pairs by id', () => {
  const result = matchSections([section('a'), section('b')], [section('b'), section('c')]);
  assert.deepEqual(result.pairs.map(([before, after]) => [before.id, after.id]), [['b', 'b']]);
  assert.deepEqual(result.added.map((s) => s.id), ['c']);
  assert.deepEqual(result.removed.map((s) => s.id), ['a']);
});

test('diffFindings splits added and fixed by key', () => {
  const key = (finding) => `${finding.id}|${finding.target}`;
  const result = diffFindings(
    [{ id: 'color-contrast', target: 'h2' }, { id: 'link-name', target: 'a' }],
    [{ id: 'color-contrast', target: 'h2' }, { id: 'image-alt', target: 'img' }],
    key,
  );
  assert.deepEqual(result.added, [{ id: 'image-alt', target: 'img' }]);
  assert.deepEqual(result.fixed, [{ id: 'link-name', target: 'a' }]);
});

test('diffStableFindings drops findings that differ between two before loads', () => {
  const key = (finding) => finding.id;
  const result = diffStableFindings(
    [{ id: 'stable-fixed' }, { id: 'flaky-a' }],
    [{ id: 'real-new' }, { id: 'flaky-b' }],
    [{ id: 'stable-fixed' }, { id: 'flaky-b' }],
    key,
  );
  assert.deepEqual(result.added, [{ id: 'real-new' }]);
  assert.deepEqual(result.fixed, [{ id: 'stable-fixed' }]);
});

test('diffStableFindings without a noise load is a plain diff', () => {
  const result = diffStableFindings([{ id: 'a' }], [{ id: 'b' }], undefined, (finding) => finding.id);
  assert.deepEqual(result, { added: [{ id: 'b' }], fixed: [{ id: 'a' }] });
});

test('withoutNoise drops changes on noisy paths', () => {
  const changes = [
    { path: 'p:1', prop: 'color' },
    { path: 'p:2', prop: 'color' },
  ];
  assert.deepEqual(withoutNoise(changes, new Set(['p:1'])), [{ path: 'p:2', prop: 'color' }]);
});
