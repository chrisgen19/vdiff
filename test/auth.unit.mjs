import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { readBasicAuth } from '../lib/auth.mjs';

const envFile = (content) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'vd-auth-')), '.env.local');
  writeFileSync(file, content);
  return file;
};

test('reads quoted and bare values, ignoring comments', () => {
  const file = envFile('BASIC_AUTH_USERNAME="u" # c\nBASIC_AUTH_PASSWORD=p\n');
  assert.deepEqual(readBasicAuth(file, {}), { username: 'u', password: 'p' });
});

test('env vars win over the file', () => {
  const file = envFile('BASIC_AUTH_USERNAME="u"\nBASIC_AUTH_PASSWORD="p"\n');
  const env = { VD_BASIC_AUTH_USERNAME: 'eu', VD_BASIC_AUTH_PASSWORD: 'ep' };
  assert.deepEqual(readBasicAuth(file, env), { username: 'eu', password: 'ep' });
});

test('missing file and no env gives undefined', () => {
  assert.equal(readBasicAuth('/nonexistent/.env.local', {}), undefined);
});
