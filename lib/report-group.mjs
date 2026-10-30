import { closeSync, openSync, readSync } from 'node:fs';

/** Helpers that turn a result's raw sections and changes into what the report shows. */

const isBox = (change) => change.prop.startsWith('box.');
const tagOf = (elementPath) => elementPath.split('>').pop().replace(/:\d+$/, '');

/** Height in px from a PNG's header, or undefined if the file can't be read. */
export const pngHeight = (file) => {
  if (!file) return undefined;
  try {
    const fd = openSync(file, 'r');
    const header = Buffer.alloc(24);
    readSync(fd, header, 0, 24, 0);
    closeSync(fd);
    return header.readUInt32BE(20);
  } catch {
    return undefined;
  }
};

/** A readable section name: "Site header", "Site footer", else its heading or first text. */
export const sectionName = (section) => {
  if (/^header(:|$)/.test(section.id) || /^header\b/.test(section.label)) return 'Site header';
  if (/^footer(:|$)/.test(section.id) || /^footer\b/.test(section.label)) return 'Site footer';
  const text = section.label.replace(/^[a-z0-9-]+:\s*/, '');
  return text && text !== section.label ? text : `Untitled ${section.label}`;
};

/**
 * Position and height per section. Runs captured before positions were recorded
 * fall back to screenshot heights, stacked in page order (`approx` is then true).
 */
export const sectionMetrics = (sections) => {
  let estimate = 0;
  return sections.map((section) => {
    const height = {
      before: section.height?.before ?? pngHeight(section.before),
      after: section.height?.after ?? pngHeight(section.after),
    };
    const recorded = section.top?.before ?? section.top?.after;
    const top = recorded ?? estimate;
    estimate = top + (height.before ?? height.after ?? 0);
    return { height, top, approx: recorded === undefined };
  });
};

/**
 * Style changes merged across elements: one line per tag and set of changes, so
 * six card titles that all went from 600 to 700 read as one line. Box changes
 * (elements moving because something above them changed size) are only counted.
 */
export const groupChanges = (changes) => {
  const byElement = new Map();
  for (const change of changes.filter((c) => !isBox(c))) {
    const entry = byElement.get(change.path) ?? { tag: tagOf(change.path), text: change.text, props: [] };
    entry.props.push(`${change.prop}|${change.before}|${change.after}`);
    byElement.set(change.path, entry);
  }
  const groups = new Map();
  for (const element of byElement.values()) {
    const key = `${element.tag}|${[...new Set(element.props)].sort().join(';')}`;
    const group = groups.get(key) ?? { tag: element.tag, props: [...new Set(element.props)].sort(), count: 0, examples: [] };
    group.count += 1;
    if (element.text && group.examples.length < 2 && !group.examples.includes(element.text)) group.examples.push(element.text);
    groups.set(key, group);
  }
  return {
    groups: [...groups.values()]
      .map((g) => ({ ...g, props: g.props.map((p) => { const [prop, before, after] = p.split('|'); return { prop, before, after }; }) }))
      .sort((a, b) => b.count - a.count),
    elementCount: byElement.size,
    styleCount: changes.filter((c) => !isBox(c)).length,
    boxCount: changes.filter(isBox).length,
  };
};

/** Changes grouped per element for the "every element" table, style changes first. */
export const changesByElement = (changes) => {
  const byElement = new Map();
  for (const change of changes) {
    const entry = byElement.get(change.path) ?? { path: change.path, tag: tagOf(change.path), text: change.text, changes: [] };
    entry.changes.push(change);
    byElement.set(change.path, entry);
  }
  const hasStyle = (entry) => entry.changes.some((c) => !isBox(c));
  return [...byElement.values()].sort((a, b) => Number(hasStyle(b)) - Number(hasStyle(a)));
};
