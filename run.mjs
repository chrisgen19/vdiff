#!/usr/bin/env node
// Before/after visual diff for access-hire. Usage: see README.md.
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs } from './lib/args.mjs';
import { readBasicAuth } from './lib/auth.mjs';
import { findAxePath } from './lib/capture.mjs';
import { buildDigest } from './lib/digest.mjs';
import { buildReport } from './lib/report.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
/** The site's repo: its .env.local has the basic auth and its pnpm store has axe-core. */
const projectRoot = process.env.VD_PROJECT_ROOT ?? path.join(os.homedir(), 'ag-projects/whitelabel-sites');
const USAGE = 'Usage: vdiff --after <url> [--before <url>] [--pages a,b] [--viewports desktop,tablet,mobile] [--no-noise-check]';

const timestamp = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

const parseOrExit = () => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : error}\n${USAGE}`);
    process.exit(1);
  }
};

const warn = (args, auth) => {
  if (!auth) console.warn('Warning: no basic auth found (apps/catalogue-site/.env.local or VD_BASIC_AUTH_*); running without credentials.');
  if (/localhost|127\.0\.0\.1/.test(args.after) && !process.env.VD_PAGES) {
    console.warn('Warning: --after is local. `pnpm dev` adds dev-mode noise; a local `next build && next start` is the fair comparison.');
  }
};

const runPlaywright = (configPath, auth) => {
  const binary = path.join(here, 'node_modules/.bin/playwright');
  const env = { ...process.env, VD_CONFIG: configPath };
  if (auth) Object.assign(env, { VD_BASIC_AUTH_USERNAME: auth.username, VD_BASIC_AUTH_PASSWORD: auth.password });
  spawnSync(binary, ['test', '--config', path.join(here, 'playwright.config.mjs')], { cwd: here, env, stdio: 'inherit' });
};

const main = () => {
  const args = parseOrExit();
  const auth = readBasicAuth(path.join(projectRoot, 'apps/catalogue-site/.env.local'));
  warn(args, auth);

  const runDir = process.env.VD_RUN_DIR ?? path.join(here, 'out', timestamp());
  mkdirSync(runDir, { recursive: true });
  const configPath = path.join(runDir, 'config.json');
  writeFileSync(configPath, JSON.stringify({ ...args, axePath: findAxePath(projectRoot), runDir }, null, 2));

  console.log(`Before: ${args.before}\nAfter:  ${args.after}\nOutput: ${runDir}`);
  runPlaywright(configPath, auth);

  const resultsDir = path.join(runDir, 'results');
  if (!existsSync(resultsDir) || readdirSync(resultsDir).length === 0) {
    console.error('No results were written; see the Playwright output above.');
    process.exit(1);
  }
  const reportPath = buildReport(runDir);
  console.log(`\nReport: ${reportPath}\nDigest: ${buildDigest(runDir)}`);
  if (!process.env.VD_NO_OPEN && spawnSync('which', ['wslview']).status === 0) {
    spawnSync('wslview', [reportPath], { stdio: 'ignore' });
  }
};

main();
