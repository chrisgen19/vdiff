import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const STATE_ORDER = { changed: 0, added: 1, removed: 2, noisy: 3, same: 4 };

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const readResults = (runDir) => {
  const dir = path.join(runDir, 'results');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')));
};

const countFindings = (result) => ({
  changedSections: result.sections.filter((s) => ['changed', 'added', 'removed'].includes(s.state)).length,
  styleChanges: result.sections.reduce((sum, s) => sum + s.changesTotal, 0),
  layout: result.layout.overflowing.added.length + result.layout.smallTargets.added.length,
  axe: result.axe.added.length,
});

const summaryRow = (result, index) => {
  const name = `<a href="#r${index}">${escape(result.page)}</a>`;
  if (result.error) return `<tr class="error"><td>${name}</td><td>${escape(result.viewport)}</td><td colspan="5">Error: ${escape(result.error)}</td></tr>`;
  const counts = countFindings(result);
  const status = `${result.status.before} / ${result.status.after}`;
  return `<tr><td>${name}</td><td>${escape(result.viewport)}</td><td>${status}</td><td>${counts.changedSections}</td><td>${counts.styleChanges}</td><td>${counts.layout}</td><td>${counts.axe}</td></tr>`;
};

const image = (runDir, file, label) =>
  file ? `<figure><figcaption>${label}</figcaption><img src="${escape(path.relative(runDir, file))}" loading="lazy"></figure>` : '';

const overlay = (runDir, section) =>
  section.before && section.after
    ? `<figure><figcaption>Difference (bright = changed)</figcaption><div class="overlay"><img src="${escape(path.relative(runDir, section.before))}" loading="lazy"><img class="diff" src="${escape(path.relative(runDir, section.after))}" loading="lazy"></div></figure>`
    : '';

const changesTable = (section) => {
  if (!section.changes.length) return '';
  const rows = section.changes
    .map((c) => `<tr><td><code>${escape(c.path)}</code><div class="muted">${escape(c.text)}</div></td><td>${escape(c.prop)}</td><td>${escape(c.before)}</td><td>${escape(c.after)}</td></tr>`)
    .join('');
  const more = section.changesTotal > section.changes.length ? `<p class="muted">Showing ${section.changes.length} of ${section.changesTotal} changes.</p>` : '';
  return `<table class="changes"><thead><tr><th>Element</th><th>Property</th><th>Before</th><th>After</th></tr></thead><tbody>${rows}</tbody></table>${more}`;
};

const elementList = (label, paths) =>
  paths.length ? `<p><strong>${label}:</strong> ${paths.slice(0, 30).map((p) => `<code>${escape(p)}</code>`).join(', ')}${paths.length > 30 ? ` and ${paths.length - 30} more` : ''}</p>` : '';

const sectionBlock = (runDir, section) => {
  const pixels = section.sizeChanged ? 'size changed' : `${(section.ratio * 100).toFixed(2)}% pixels`;
  return `<details ${section.state === 'changed' ? 'open' : ''} class="section ${section.state}">
<summary><span class="badge ${section.state}">${section.state}</span> ${escape(section.label)} <span class="muted">${escape(section.id)} · ${pixels} · ${section.changesTotal} style changes</span></summary>
<div class="images">${image(runDir, section.before, 'Before')}${image(runDir, section.after, 'After')}${overlay(runDir, section)}</div>
${changesTable(section)}${elementList('Only after', section.addedElements)}${elementList('Only before', section.removedElements)}
</details>`;
};

const findingList = (title, findings, describe) =>
  findings.length ? `<h4>${title}</h4><ul>${findings.map((f) => `<li>${describe(f)}</li>`).join('')}</ul>` : '';

const findingsBlock = (result) => {
  const target = (f) => `${escape(f.label)} <code>${escape(f.path)}</code>${f.width ? ` (${f.width}x${f.height})` : ''}`;
  const axe = (f) => `<strong>${escape(f.id)}</strong> (${escape(f.impact)}): ${escape(f.help)} <code>${escape(f.target)}</code>`;
  const { overflowX } = result.layout;
  const html = [
    overflowX.before !== overflowX.after ? `<p>Horizontal page overflow: ${overflowX.before}px → ${overflowX.after}px</p>` : '',
    findingList('New overflowing elements', result.layout.overflowing.added, target),
    findingList('New small touch targets', result.layout.smallTargets.added, target),
    findingList('New accessibility violations', result.axe.added, axe),
    findingList('Fixed accessibility violations', result.axe.fixed, axe),
  ].join('');
  return html || '<p class="muted">No new layout or accessibility findings.</p>';
};

const resultBlock = (runDir, result, index) => {
  const heading = `<h2 id="r${index}">${escape(result.page)} · ${escape(result.viewport)} <span class="muted">${escape(result.path)}</span></h2>`;
  if (result.error) return `${heading}<p class="error">Error: ${escape(result.error)}</p>`;
  const sections = [...result.sections].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
  return `${heading}${findingsBlock(result)}${sections.map((s) => sectionBlock(runDir, s)).join('')}`;
};

const STYLES = `
:root { --bg: #fff; --fg: #1a1a1a; --muted: #666; --line: #ddd; --changed: #c2410c; --same: #15803d; --noisy: #a16207; --error: #b91c1c; --link: #1d4ed8; --link-visited: #6d28d9; }
@media (prefers-color-scheme: dark) { :root { --bg: #111; --fg: #eee; --muted: #999; --line: #333; --link: #93c5fd; --link-visited: #c4b5fd; } }
body { margin: 0 auto; max-width: 1600px; padding: 16px; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
a { color: var(--link); }
a:visited { color: var(--link-visited); }
table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; }
th, td { border-bottom: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
.muted { color: var(--muted); font-size: 12px; }
.error { color: var(--error); }
.badge { display: inline-block; padding: 0 6px; border-radius: 4px; color: #fff; font-size: 12px; background: var(--muted); }
.badge.changed, .badge.added, .badge.removed { background: var(--changed); }
.badge.same { background: var(--same); }
.badge.noisy { background: var(--noisy); }
details.section { border: 1px solid var(--line); border-radius: 6px; margin: 8px 0; padding: 8px; }
summary { cursor: pointer; }
.images { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin: 8px 0; }
figure { margin: 0; }
figure img { max-width: 100%; border: 1px solid var(--line); }
.overlay { position: relative; background: #000; }
.overlay img { display: block; max-width: 100%; }
.overlay img.diff { position: absolute; top: 0; left: 0; mix-blend-mode: difference; }
code { font-size: 12px; word-break: break-all; }
`;

/** Writes report.html for a run from its results/*.json and returns the path. */
export const buildReport = (runDir) => {
  const config = JSON.parse(readFileSync(path.join(runDir, 'config.json'), 'utf8'));
  const results = readResults(runDir);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Visual diff report</title><style>${STYLES}</style></head><body>
<h1>Visual diff</h1>
<p>Before: <code>${escape(config.before)}</code><br>After: <code>${escape(config.after)}</code></p>
<table><thead><tr><th>Page</th><th>Viewport</th><th>Status (before / after)</th><th>Sections changed</th><th>Style changes</th><th>New layout issues</th><th>New axe violations</th></tr></thead>
<tbody>${results.map(summaryRow).join('')}</tbody></table>
${results.map((result, index) => resultBlock(runDir, result, index)).join('')}
</body></html>`;
  const reportPath = path.join(runDir, 'report.html');
  writeFileSync(reportPath, html);
  return reportPath;
};
