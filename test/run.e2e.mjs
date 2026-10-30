import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runScript = path.join(here, '..', 'run.mjs');
const run = promisify(execFile);

let server;
let origin;

before(async () => {
  server = createServer((req, res) => {
    const file = req.url.startsWith('/a/') ? 'after.html' : 'before.html';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(readFileSync(path.join(here, 'fixtures', file)));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

const runOnce = async (beforeUrl, afterUrl) => {
  const runDir = mkdtempSync(path.join(tmpdir(), 'vd-run-'));
  await run('node', [runScript, '--before', beforeUrl, '--after', afterUrl, '--viewports', 'desktop'], {
    env: { ...process.env, VD_RUN_DIR: runDir, VD_NO_OPEN: '1', VD_PAGES: JSON.stringify([{ key: 'fixture', path: '/' }]) },
    timeout: 120_000,
  });
  const [file] = readdirSync(path.join(runDir, 'results'));
  return { runDir, result: JSON.parse(readFileSync(path.join(runDir, 'results', file), 'utf8')) };
};

test('reports the h2 font-size change between before and after', async () => {
  const { runDir, result } = await runOnce(`${origin}/b`, `${origin}/a`);
  const changed = result.sections.filter((section) => section.state === 'changed');
  assert.equal(changed.length, 1, JSON.stringify(result.sections.map((s) => [s.id, s.state])));
  assert.equal(changed[0].id, 'block-hero');
  assert.ok(changed[0].changes.some((c) => c.prop === 'font-size' && c.before === '36px' && c.after === '30px'));
  assert.ok(readFileSync(path.join(runDir, 'report.html'), 'utf8').includes('30px'));
});

test('same URL on both sides reports nothing changed', async () => {
  const { result } = await runOnce(`${origin}/b`, `${origin}/b`);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.sections.filter((s) => s.state !== 'same').map((s) => s.id), []);
  assert.equal(result.sections.reduce((sum, s) => sum + s.changesTotal, 0), 0);
});
