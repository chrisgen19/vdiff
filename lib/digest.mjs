import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * digest.md: a short, text-only version of report.html for Claude Code (the
 * /vdiff-review skill) to read and review. Style changes are grouped into
 * patterns across pages, axe is compared as counts per rule, and changed
 * sections are merged across viewports with their screenshot paths.
 */

const MAX_PATTERNS = 40;
const MAX_SECTIONS = 40;
const CHANGES_PER_SECTION = 6;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const readResults = (runDir) => {
  const dir = path.join(runDir, 'results');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(path.join(dir, name)));
};

const clip = (text, length = 40) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length)}...` : flat;
};

const tagOf = (elementPath) => elementPath.split('>').pop().replace(/:\d+$/, '');
const isBox = (change) => change.prop.startsWith('box.');
const countState = (result, state) => result.sections.filter((section) => section.state === state).length;
const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

const pageRow = (result) => {
  if (result.error) return `| ${result.page} | ${result.viewport} | ERROR: ${clip(result.error, 80)} | | | | |`;
  const sections = ['changed', 'added', 'removed', 'noisy'].map((state) => countState(result, state)).join(' / ');
  const style = sum(result.sections, (section) => section.changesTotal);
  const { overflowX, overflowing, smallTargets } = result.layout;
  const small = `+${smallTargets.added.length} / -${smallTargets.fixed.length}`;
  return `| ${result.page} | ${result.viewport} | ${result.status.before} / ${result.status.after} | ${sections} | ${style} | ${overflowX.before} -> ${overflowX.after}, +${overflowing.added.length} overflowing | ${small} |`;
};

const pagesTable = (results) => [
  '## Pages',
  '',
  '| Page | Viewport | HTTP before / after | Sections changed / added / removed / noisy | Style changes | Horizontal overflow (px), new overflowing | Small targets +new / -fixed |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...results.map(pageRow),
];

/** Rule counts summed per page and viewport; rows only where before and after differ. */
const axeSection = (results) => {
  const ok = results.filter((result) => !result.error);
  if (ok.some((result) => !result.axeCounts)) {
    return ['## Accessibility (axe)', '', 'This run predates per-rule counts; see report.html added/fixed lists (they churn when class names change).'];
  }
  const rows = ok.flatMap((result) => {
    const rules = new Set([...Object.keys(result.axeCounts.before), ...Object.keys(result.axeCounts.after)]);
    return [...rules]
      .map((rule) => ({ rule, before: result.axeCounts.before[rule] ?? 0, after: result.axeCounts.after[rule] ?? 0 }))
      .filter(({ before, after }) => before !== after)
      .map(({ rule, before, after }) => `| ${result.page} | ${result.viewport} | ${rule} | ${before} -> ${after} |`);
  });
  const examples = ok
    .flatMap((result) => result.axe.added.map((finding) => `- ${result.page} ${result.viewport}: ${finding.id} (${finding.impact}) \`${clip(finding.target, 90)}\``))
    .slice(0, 12);
  return [
    '## Accessibility (axe): violation counts per rule, only where they differ',
    '',
    ...(rows.length ? ['| Page | Viewport | Rule | Before -> after |', '| --- | --- | --- | --- |', ...rows] : ['No rule count changed.']),
    '',
    'Example targets only the after side has (may be class-name churn, trust the counts):',
    ...(examples.length ? examples : ['- none']),
  ];
};

/** Groups non-box style changes by `prop before -> after`, with where they happen. */
const stylePatterns = (results) => {
  const patterns = new Map();
  for (const result of results.filter((r) => !r.error)) {
    for (const section of result.sections) {
      for (const change of section.changes.filter((c) => !isBox(c))) {
        const key = `${change.prop}: ${change.before} -> ${change.after}`;
        const entry = patterns.get(key) ?? { key, count: 0, pages: new Set(), tags: new Set(), examples: new Set() };
        entry.count += 1;
        entry.pages.add(result.page);
        entry.tags.add(tagOf(change.path));
        if (entry.examples.size < 2 && change.text) entry.examples.add(`"${clip(change.text, 30)}"`);
        patterns.set(key, entry);
      }
    }
  }
  const rows = [...patterns.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_PATTERNS)
    .map((p) => `| ${p.key} | ${p.count} | ${[...p.tags].slice(0, 5).join(', ')} | ${[...p.pages].join(', ')} | ${[...p.examples].join(', ')} |`);
  return [
    `## Style patterns (top ${MAX_PATTERNS}, counts include every viewport)`,
    '',
    '| Change | Count | Elements | Pages | Example text |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ];
};

/** One entry per page + section id, merged across viewports. */
const mergeSections = (results) => {
  const merged = new Map();
  for (const result of results.filter((r) => !r.error)) {
    for (const section of result.sections.filter((s) => s.state !== 'same')) {
      const key = `${result.page}|${section.id}`;
      const entry = merged.get(key) ?? { page: result.page, section, viewports: [], changes: 0, ratio: 0, shots: [] };
      entry.viewports.push(`${result.viewport} (${section.state})`);
      entry.changes += section.changesTotal;
      entry.ratio = Math.max(entry.ratio, section.ratio);
      entry.shots.push({ viewport: result.viewport, before: section.before, after: section.after });
      merged.set(key, entry);
    }
  }
  return [...merged.values()];
};

const sectionEntry = (runDir, entry) => {
  const shown = new Set();
  for (const change of entry.section.changes.filter((c) => !isBox(c))) {
    if (shown.size >= CHANGES_PER_SECTION) break;
    shown.add(`${tagOf(change.path)} ${change.prop} ${change.before} -> ${change.after}`);
  }
  const shot = (file) => (file ? path.relative(runDir, file) : 'none');
  return [
    `### ${entry.page}: ${clip(entry.section.label, 70)}`,
    `- id \`${entry.section.id}\`; ${entry.viewports.join(', ')}; ${entry.changes} style/box changes; max pixel ratio ${(entry.ratio * 100).toFixed(1)}%`,
    ...[...shown].map((line) => `- ${line}`),
    ...entry.shots.map((s) => `- ${s.viewport}: before \`${shot(s.before)}\`, after \`${shot(s.after)}\``),
    '',
  ];
};

const sectionsList = (runDir, results) => {
  const entries = mergeSections(results);
  const oneSided = entries.filter((e) => e.section.state === 'added' || e.section.state === 'removed');
  const changed = entries
    .filter((e) => !oneSided.includes(e))
    .sort((a, b) => b.changes - a.changes || b.ratio - a.ratio)
    .slice(0, MAX_SECTIONS);
  return [
    '## Sections only one side has',
    '',
    ...(oneSided.length ? oneSided.flatMap((e) => sectionEntry(runDir, e)) : ['None.', '']),
    `## Changed sections (top ${MAX_SECTIONS} by number of changes, merged across viewports)`,
    '',
    ...changed.flatMap((e) => sectionEntry(runDir, e)),
  ];
};

/** Writes digest.md next to report.html and returns its path. */
export const buildDigest = (runDir) => {
  const configPath = path.join(runDir, 'config.json');
  const config = existsSync(configPath) ? readJson(configPath) : {};
  const results = readResults(runDir);
  const lines = [
    '# visual-diff digest',
    '',
    `- Before: ${config.before ?? 'unknown'}`,
    `- After: ${config.after ?? 'unknown'}`,
    `- Run: ${runDir} (images are relative to it; full detail in report.html)`,
    '',
    ...pagesTable(results),
    '',
    ...axeSection(results),
    '',
    ...stylePatterns(results),
    '',
    ...sectionsList(runDir, results),
  ];
  const file = path.join(runDir, 'digest.md');
  writeFileSync(file, `${lines.join('\n')}\n`);
  return file;
};
