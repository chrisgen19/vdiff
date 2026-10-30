import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BEFORE, parseArgs } from '../lib/args.mjs';

test('defaults: before is DEV, all pages, all viewports, noise check on', () => {
  assert.deepEqual(parseArgs(['--after', 'http://x/']), {
    before: DEFAULT_BEFORE,
    after: 'http://x',
    pages: null,
    viewports: ['desktop', 'tablet', 'mobile'],
    noiseCheck: true,
  });
});

test('parses pages, viewports and --no-noise-check', () => {
  const args = parseArgs([
    '--before', 'http://b',
    '--after', 'http://a',
    '--pages', 'home,blog-showcase',
    '--viewports', 'mobile',
    '--no-noise-check',
  ]);
  assert.equal(args.before, 'http://b');
  assert.deepEqual(args.pages, ['home', 'blog-showcase']);
  assert.deepEqual(args.viewports, ['mobile']);
  assert.equal(args.noiseCheck, false);
});

test('rejects unknown pages and viewports', () => {
  assert.throws(() => parseArgs(['--after', 'http://a', '--pages', 'nope']), /unknown page: nope/);
  assert.throws(() => parseArgs(['--after', 'http://a', '--viewports', 'watch']), /unknown viewport: watch/);
});

test('requires --after', () => {
  assert.throws(() => parseArgs([]), /--after is required/);
});
