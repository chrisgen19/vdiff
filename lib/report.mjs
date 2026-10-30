import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { VIEWPORTS } from '../pages.mjs';
import { SCRIPT, STYLES } from './report-assets.mjs';
import { changesByElement, groupChanges, sectionMetrics, sectionName } from './report-group.mjs';

/**
 * report.html: a sidebar of pages and viewports, one page view at a time (hash
 * navigation), sections in page order named by their heading, changes grouped
 * across elements, and a full-screen before/after viewer. Static, no external assets.
 */

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const px = (value) => (value === undefined ? '?' : `${Math.round(value).toLocaleString('en')}px`);
const clip = (text, length) => (text.length > length ? `${text.slice(0, length)}...` : text);

const readResults = (runDir) => {
  const dir = path.join(runDir, 'results');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')));
};

const viewId = (result) => `p-${result.page}-${result.viewport}`;
const pageTitle = (result) => result.title?.after || result.title?.before || result.path;

const countFindings = (result) => ({
  changedSections: result.sections.filter((s) => ['changed', 'added', 'removed'].includes(s.state)).length,
  styleChanges: result.sections.reduce((sum, s) => sum + s.changesTotal, 0),
  layout: result.layout.overflowing.added.length + result.layout.smallTargets.added.length,
  axe: result.axe.added.length,
});

const hasFindings = (counts) => counts.changedSections + counts.layout + counts.axe > 0;

const navEntry = (result) => {
  if (result.error) return `<li><a href="#${viewId(result)}"><span><span class="dot e"></span>${escape(result.viewport)}</span><span class="muted">error</span></a></li>`;
  const counts = countFindings(result);
  const dot = hasFindings(counts) ? 'dot c' : 'dot';
  return `<li><a href="#${viewId(result)}"><span><span class="${dot}"></span>${escape(result.viewport)}</span><span class="muted">${counts.changedSections} / ${counts.styleChanges}</span></a></li>`;
};

const nav = (results) => {
  const pages = [...new Set(results.map((r) => r.page))];
  const groups = pages.map((page) => `<div class="page-name">${escape(page)}</div><ul>${results.filter((r) => r.page === page).map(navEntry).join('')}</ul>`);
  return `<nav class="nav" aria-label="Pages"><h1>Visual diff</h1><p class="muted">${pages.length} pages. Counts: sections changed / style changes.</p>
<ul><li><a href="#overview"><span>Overview</span></a></li></ul>${groups.join('')}</nav>`;
};

const navSelect = (results) =>
  `<select class="nav-select" aria-label="Page"><option value="overview">Overview</option>${results
    .map((r) => `<option value="${viewId(r)}">${escape(r.page)}, ${escape(r.viewport)}${r.error ? ' (error)' : ` (${countFindings(r).changedSections} sections, ${countFindings(r).styleChanges} changes)`}</option>`)
    .join('')}</select>`;

const summaryRow = (result) => {
  const name = `<a href="#${viewId(result)}">${escape(result.page)}</a>`;
  if (result.error) return `<tr class="error"><td>${name}</td><td>${escape(result.viewport)}</td><td colspan="5">Error: ${escape(result.error)}</td></tr>`;
  const counts = countFindings(result);
  return `<tr><td>${name}<span class="el-text">${escape(pageTitle(result))}</span></td><td>${escape(result.viewport)}</td><td>${result.status.before} / ${result.status.after}</td><td>${counts.changedSections}</td><td>${counts.styleChanges}</td><td>${counts.layout}</td><td>${counts.axe}</td></tr>`;
};

const overview = (config, results) => `<section class="view" data-view="overview" data-title="Visual diff: overview">
<h2>Overview</h2>
<div class="urls"><span class="muted">Before</span><a href="${escape(config.before)}" target="_blank" rel="noopener">${escape(config.before)}</a><span class="muted">After</span><a href="${escape(config.after)}" target="_blank" rel="noopener">${escape(config.after)}</a></div>
<table><thead><tr><th>Page</th><th>Viewport</th><th>Status (before / after)</th><th>Sections changed</th><th>Style changes</th><th>New layout issues</th><th>New axe violations</th></tr></thead>
<tbody>${results.map(summaryRow).join('')}</tbody></table></section>`;

const change = ({ prop, before, after }) =>
  `${escape(prop)} <span class="from">${escape(before)}</span> &rarr; <span class="to">${escape(after)}</span>`;

const patterns = (grouped) =>
  grouped.groups
    .map((g) => {
      const what = g.count > 1 ? `${g.count} ${escape(g.tag)} elements` : `${escape(g.tag)}`;
      const examples = g.examples.map((t) => `"${escape(clip(t, 50))}"`).join(', ');
      return `<div class="pattern"><span class="what">${what}</span> <span class="muted">${examples ? `${g.count > 1 ? 'e.g. ' : ''}${examples}` : ''}</span><br>${g.props.map(change).join(', ')}</div>`;
    })
    .join('');

const elementTable = (section, grouped) => {
  if (!section.changes.length) return '';
  const rows = changesByElement(section.changes)
    .map((e) => `<tr><td class="el"><code>${escape(e.tag)}</code><span class="el-text">${escape(clip(e.text || '', 60))}</span><span class="el-text">${escape(e.path)}</span></td><td>${e.changes.map(change).join('<br>')}</td></tr>`)
    .join('');
  const shown = section.changesTotal > section.changes.length ? `, showing ${section.changes.length} of ${section.changesTotal}` : '';
  return `<details class="more"><summary>Every element (${grouped.styleCount} style changes, ${grouped.boxCount} position and size shifts${shown})</summary>
<table><thead><tr><th>Element</th><th>Changes</th></tr></thead><tbody>${rows}</tbody></table></details>`;
};

const elementList = (label, paths) =>
  paths.length ? `<p><strong>${label}:</strong> ${paths.slice(0, 30).map((p) => `<code>${escape(p)}</code>`).join(', ')}${paths.length > 30 ? ` and ${paths.length - 30} more` : ''}</p>` : '';

const shots = (runDir, section, title) => {
  const rel = (file) => escape(path.relative(runDir, file));
  if (!section.before && !section.after) return '';
  if (!section.before || !section.after) {
    const [label, file] = section.before ? ['Before only', section.before] : ['After only', section.after];
    return `<figure><figcaption>${label}</figcaption><img class="shot" style="cursor:default" src="${rel(file)}" loading="lazy" alt="${label}: ${escape(title)}"></figure>`;
  }
  return `<div class="toolbar"><label><input type="checkbox" class="diff-toggle"> Show difference</label><span class="muted">Click a screenshot for full screen, side by side</span></div>
<div class="shots" data-before="${rel(section.before)}" data-after="${rel(section.after)}" data-title="${escape(title)}">
<figure><figcaption>Before</figcaption><img class="shot" tabindex="0" src="${rel(section.before)}" loading="lazy" alt="Before: ${escape(title)}"></figure>
<figure><figcaption>After</figcaption><img class="shot" tabindex="0" src="${rel(section.after)}" loading="lazy" alt="After: ${escape(title)}"></figure>
<figure class="diff-only"><figcaption>Difference (bright = changed)</figcaption><div class="overlay" tabindex="0"><img src="${rel(section.before)}" loading="lazy" alt=""><img src="${rel(section.after)}" loading="lazy" alt="Difference: ${escape(title)}"></div></figure></div>`;
};

const sectionMeta = (section, metrics, index, total) => {
  const { height, top, approx } = metrics;
  const size = height.before !== undefined && height.after !== undefined && height.before !== height.after
    ? `Height ${px(height.before)} &rarr; ${px(height.after)}`
    : `Height ${px(height.before ?? height.after)}`;
  const pixels = section.state === 'added' || section.state === 'removed' ? '' : `, ${(section.ratio * 100).toFixed(1)}% of pixels differ`;
  return `Section ${index + 1} of ${total}, ${approx ? 'about ' : ''}${px(top)} from the top. ${size}${pixels}`;
};

const sectionBlock = (runDir, result, section, metrics, index, total) => {
  const name = sectionName(section);
  const grouped = groupChanges(section.changes);
  const open = ['changed', 'added', 'removed'].includes(section.state) ? ' open' : '';
  const summaryCounts = grouped.styleCount ? ` ${grouped.styleCount} style changes on ${grouped.elementCount} elements.` : '';
  return `<details class="sec ${section.state}"${open}>
<summary><span class="sec-title">${escape(name)}</span> <span class="badge ${section.state}">${section.state}</span>
<span class="sec-meta muted">${sectionMeta(section, metrics, index, total)}.${summaryCounts}</span>
<span class="sec-meta muted">id ${escape(section.id)}</span></summary>
<div class="sec-body">${shots(runDir, section, `${name}, ${result.page} ${result.viewport}`)}${patterns(grouped)}${elementTable(section, grouped)}
${elementList('Only after', section.addedElements)}${elementList('Only before', section.removedElements)}</div></details>`;
};

const findingList = (title, findings, describe) =>
  findings.length ? `<h4>${title}</h4><ul>${findings.map((f) => `<li>${describe(f)}</li>`).join('')}</ul>` : '';

const findingsBlock = (result) => {
  const target = (f) => `${escape(f.label)} <code>${escape(f.path)}</code>${f.width ? ` (${f.width}x${f.height})` : ''}`;
  const axe = (f) => `<strong>${escape(f.id)}</strong> (${escape(f.impact)}): ${escape(f.help)} <code>${escape(f.target)}</code>`;
  const { overflowX } = result.layout;
  const html = [
    overflowX.before !== overflowX.after ? `<p>Horizontal page overflow: ${overflowX.before}px &rarr; ${overflowX.after}px</p>` : '',
    findingList('New overflowing elements', result.layout.overflowing.added, target),
    findingList('New small touch targets', result.layout.smallTargets.added, target),
    findingList('New accessibility violations', result.axe.added, axe),
    findingList('Fixed accessibility violations', result.axe.fixed, axe),
  ].join('');
  return html ? `<details class="more findings"><summary>Layout and accessibility findings</summary>${html}</details>` : '<p class="muted">No new layout or accessibility findings.</p>';
};

const pageHead = (config, result) => {
  const width = VIEWPORTS[result.viewport]?.width;
  const urls = ['before', 'after']
    .map((side) => `<span class="muted">${side === 'before' ? 'Before' : 'After'}</span><a href="${escape(config[side] + result.path)}" target="_blank" rel="noopener">${escape(config[side] + result.path)}</a>`)
    .join('');
  const titles = result.title && result.title.before !== result.title.after ? `<div class="muted">Title before: ${escape(result.title.before)}</div>` : '';
  if (result.error) return `<div class="page-head"><h2>${escape(result.page)} <span class="muted">${escape(result.viewport)}</span></h2><div class="urls">${urls}</div></div><p class="error">Error: ${escape(result.error)}</p>`;
  const counts = countFindings(result);
  return `<div class="page-head"><h2>${escape(pageTitle(result))} <span class="muted">${escape(result.page)}, ${escape(result.viewport)}${width ? ` ${width}px` : ''}</span></h2>${titles}
<div class="urls">${urls}</div>
<div class="muted">HTTP ${result.status.before} / ${result.status.after}. ${counts.changedSections} of ${result.sections.length} sections changed, ${counts.styleChanges} style changes, ${counts.layout} new layout issues, ${counts.axe} new axe violations</div></div>`;
};

/** Sections in page order: by recorded or estimated top, one-sided sections where they sit. */
const pageView = (runDir, config, result) => {
  const head = pageHead(config, result);
  const viewTitle = `Visual diff: ${result.page} ${result.viewport}`;
  if (result.error) return `<section class="view" data-view="${viewId(result)}" data-title="${escape(viewTitle)}" hidden>${head}</section>`;
  const metrics = sectionMetrics(result.sections);
  const ordered = result.sections.map((section, i) => ({ section, metrics: metrics[i] })).sort((a, b) => a.metrics.top - b.metrics.top);
  const blocks = ordered.map(({ section, metrics: m }, i) => sectionBlock(runDir, result, section, m, i, ordered.length));
  return `<section class="view" data-view="${viewId(result)}" data-title="${escape(viewTitle)}" hidden>${head}${findingsBlock(result)}${blocks.join('')}</section>`;
};

const VIEWER = `<div class="viewer" role="dialog" aria-modal="true" aria-label="Before and after, full screen">
<div class="viewer-bar"><strong class="viewer-title"></strong><span><label><input type="checkbox" class="viewer-diff"> Show difference</label><button class="viewer-close">Close (Esc)</button></span></div>
<div class="viewer-panes"><div class="viewer-pane pane-before"><h3>Before</h3><div class="diffwrap"><img class="src-before" alt="Before"><img class="src-after" alt="Difference"></div></div>
<div class="viewer-pane pane-after"><h3>After</h3><img class="src-after" alt="After"></div></div></div>`;

/** Writes report.html for a run from its results/*.json and returns the path. */
export const buildReport = (runDir) => {
  const config = JSON.parse(readFileSync(path.join(runDir, 'config.json'), 'utf8'));
  const results = readResults(runDir);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Visual diff report</title><style>${STYLES}</style></head><body>
<div class="layout">${nav(results)}<main>${navSelect(results)}${overview(config, results)}${results.map((r) => pageView(runDir, config, r)).join('')}</main></div>
${VIEWER}<script>${SCRIPT}</script></body></html>`;
  const reportPath = path.join(runDir, 'report.html');
  writeFileSync(reportPath, html);
  return reportPath;
};
