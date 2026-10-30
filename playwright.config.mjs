import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const config = JSON.parse(readFileSync(process.env.VD_CONFIG, 'utf8'));

export default defineConfig({
  testDir: '.',
  testMatch: 'capture.pw.mjs',
  fullyParallel: true,
  workers: 3,
  timeout: 300_000,
  retries: 0,
  reporter: 'list',
  outputDir: path.join(config.runDir, 'pw'),
  use: {
    channel: 'chrome',
    reducedMotion: 'reduce',
    ignoreHTTPSErrors: true,
  },
});
