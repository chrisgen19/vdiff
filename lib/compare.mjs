import { diffElements, diffStableFindings, matchSections, withoutNoise } from './diff.mjs';
import { comparePngs } from './pixels.mjs';

/**
 * Share of differing pixels above which a section counts as visually changed.
 * Image decode timing alone reached ~0.25% on DEV vs DEV runs; typography
 * changes are caught exactly by the style diff, so pixels only need to catch
 * larger visual shifts.
 */
const CHANGED_RATIO = 0.005;
const MAX_CHANGES_PER_SECTION = 200;

const MEDIA_TAG = /(^|>)(img|video|iframe|canvas):\d+$/;

/** Boxes of media elements on either side; their pixels are excluded from the ratio. */
const mediaRects = (a, b) =>
  [...a.elements, ...b.elements].filter((element) => MEDIA_TAG.test(element.path)).map((element) => element.box);

const pixelDiff = async (browser, a, b) =>
  a?.screenshot && b?.screenshot
    ? comparePngs(browser, a.screenshot, b.screenshot, mediaRects(a, b))
    : { ratio: 0, sizeChanged: false };

const isVisualChange = ({ ratio, sizeChanged }) => sizeChanged || ratio > CHANGED_RATIO;

/** Element paths and pixel noise seen between two loads of the same before URL. */
const noiseFor = async (browser, section, noiseById) => {
  const repeat = noiseById?.get(section.id);
  if (!repeat) return { paths: new Set(), visual: false };
  const paths = new Set(diffElements(section.elements, repeat.elements).changes.map((change) => change.path));
  return { paths, visual: isVisualChange(await pixelDiff(browser, section, repeat)) };
};

const compareSectionPair = async (browser, before, after, noiseById) => {
  const pixels = await pixelDiff(browser, before, after);
  const noise = await noiseFor(browser, before, noiseById);
  const elements = diffElements(before.elements, after.elements);
  const changes = withoutNoise(elements.changes, noise.paths);
  // Style changes are exact, so they win; a pixel-only difference that also
  // shows between two before loads is noise.
  const styleChanged = changes.length > 0 || elements.added.length > 0 || elements.removed.length > 0;
  const pixelState = isVisualChange(pixels) ? (noise.visual ? 'noisy' : 'changed') : 'same';
  return {
    id: before.id,
    label: after.label,
    top: { before: before.top, after: after.top },
    height: { before: before.height, after: after.height },
    state: styleChanged ? 'changed' : pixelState,
    ...pixels,
    before: before.screenshot,
    after: after.screenshot,
    changes: changes.slice(0, MAX_CHANGES_PER_SECTION),
    changesTotal: changes.length,
    addedElements: elements.added,
    removedElements: elements.removed,
  };
};

const oneSided = (section, state) => ({
  id: section.id,
  label: section.label,
  top: state === 'removed' ? { before: section.top } : { after: section.top },
  height: state === 'removed' ? { before: section.height } : { after: section.height },
  state,
  ratio: 1,
  sizeChanged: true,
  before: state === 'removed' ? section.screenshot : null,
  after: state === 'added' ? section.screenshot : null,
  changes: [],
  changesTotal: 0,
  addedElements: [],
  removedElements: [],
});

/**
 * Violations per axe rule. Targets are class-based selectors, so a PR that renames
 * classes lists the same element as added and fixed; counts per rule don't churn.
 */
const countByRule = (violations) =>
  violations.reduce((counts, { id }) => ({ ...counts, [id]: (counts[id] ?? 0) + 1 }), {});

/**
 * Compares two captures from lib/capture.mjs capturePage. `noise` is an
 * optional second capture of the before URL; differences it shows are not
 * reported as changes.
 */
export const compareCaptures = async ({ browser, before, after, noise }) => {
  const { pairs, added, removed } = matchSections(before.sections, after.sections);
  const noiseById = noise ? new Map(noise.sections.map((section) => [section.id, section])) : null;
  const sections = [];
  for (const [old, next] of pairs) sections.push(await compareSectionPair(browser, old, next, noiseById));
  sections.push(...added.map((s) => oneSided(s, 'added')), ...removed.map((s) => oneSided(s, 'removed')));
  const byPath = (finding) => finding.path;
  const findings = (pick, key) => diffStableFindings(pick(before), pick(after), noise && pick(noise), key);
  return {
    sections,
    layout: {
      overflowX: { before: before.layout.overflowX, after: after.layout.overflowX },
      overflowing: findings((c) => c.layout.overflowing, byPath),
      smallTargets: findings((c) => c.layout.smallTargets, byPath),
    },
    axe: findings((c) => c.axe, (finding) => `${finding.id}|${finding.target}`),
    axeCounts: { before: countByRule(before.axe), after: countByRule(after.axe) },
  };
};
