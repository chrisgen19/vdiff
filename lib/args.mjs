import { PAGES, VIEWPORTS } from '../pages.mjs';

export const DEFAULT_BEFORE = 'https://dev-access-hire-catalogue-access-group-australia.vercel.app';

const trimSlash = (url) => url.replace(/\/+$/, '');

const splitList = (value, known, label) => {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  for (const item of items) {
    if (!known.includes(item)) throw new Error(`unknown ${label}: ${item}`);
  }
  return items;
};

/**
 * Parses CLI args for run.mjs.
 * @param {string[]} argv args after the script name
 */
export const parseArgs = (argv) => {
  const args = {
    before: DEFAULT_BEFORE,
    after: undefined,
    pages: null,
    viewports: Object.keys(VIEWPORTS),
    noiseCheck: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case '--before':
        args.before = trimSlash(value);
        i += 1;
        break;
      case '--after':
        args.after = trimSlash(value);
        i += 1;
        break;
      case '--pages':
        args.pages = splitList(value, PAGES.map((page) => page.key), 'page');
        i += 1;
        break;
      case '--viewports':
        args.viewports = splitList(value, Object.keys(VIEWPORTS), 'viewport');
        i += 1;
        break;
      case '--no-noise-check':
        args.noiseCheck = false;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }
  if (!args.after) throw new Error('--after is required');
  return args;
};
