import { test } from 'node:test';
import assert from 'node:assert/strict';

import { changesByElement, groupChanges, sectionMetrics, sectionName } from '../lib/report-group.mjs';

const change = (path, prop, before, after, text = '') => ({ path, prop, before, after, text });

test('groupChanges merges the same change across elements and only counts box shifts', () => {
  const result = groupChanges([
    change('div:1>h3:1', 'font-weight', '600', '700', 'Card one'),
    change('div:2>h3:1', 'font-weight', '600', '700', 'Card two'),
    change('div:3>h3:1', 'font-weight', '600', '700', 'Card three'),
    change('h2:1', 'font-size', '36px', '30px', 'Heading'),
    change('h2:1', 'line-height', '40px', '36px', 'Heading'),
    change('h2:1', 'box.height', 40, 36, 'Heading'),
    change('div:1', 'box.y', 10, 6),
  ]);
  assert.equal(result.styleCount, 5);
  assert.equal(result.boxCount, 2);
  assert.equal(result.elementCount, 4);
  assert.deepEqual(result.groups[0], {
    tag: 'h3',
    count: 3,
    examples: ['Card one', 'Card two'],
    props: [{ prop: 'font-weight', before: '600', after: '700' }],
  });
  assert.deepEqual(result.groups[1].props.map((p) => p.prop), ['font-size', 'line-height']);
});

test('sectionName names header and footer, else uses the heading text', () => {
  assert.equal(sectionName({ id: 'header:1', label: 'header: Credit Application' }), 'Site header');
  assert.equal(sectionName({ id: 'footer:1', label: 'footer: Equipment' }), 'Site footer');
  assert.equal(sectionName({ id: 'builder-abc', label: 'div: Explore Access News' }), 'Explore Access News');
  assert.equal(sectionName({ id: 'main:1>img:1', label: 'img' }), 'Untitled img');
});

test('sectionMetrics uses recorded positions, else stacks screenshot heights', () => {
  const recorded = sectionMetrics([{ top: { before: 120, after: 118 }, height: { before: 300, after: 280 } }]);
  assert.deepEqual(recorded, [{ height: { before: 300, after: 280 }, top: 120, approx: false }]);

  const estimated = sectionMetrics([{ height: { before: 100 } }, { height: { before: 50, after: 40 } }, { height: { after: 10 } }]);
  assert.deepEqual(estimated.map((m) => [m.top, m.approx]), [[0, true], [100, true], [150, true]]);
});

test('changesByElement lists elements with style changes before box-only ones', () => {
  const rows = changesByElement([change('div:1', 'box.y', 1, 5), change('p:1', 'color', 'red', 'blue', 'Text')]);
  assert.deepEqual(rows.map((r) => r.path), ['p:1', 'div:1']);
});
