const BOX_PROPS = ['x', 'y', 'width', 'height'];
/** Box values are rounded to whole px, so a 1px difference is sub-pixel rounding, not a change. */
const BOX_TOLERANCE_PX = 1;

const byKey = (items, key) => new Map(items.map((item) => [key(item), item]));

/** Pairs before/after sections by id; unmatched ones are added or removed. */
export const matchSections = (before, after) => {
  const afterById = byKey(after, (section) => section.id);
  const beforeIds = new Set(before.map((section) => section.id));
  return {
    pairs: before
      .filter((section) => afterById.has(section.id))
      .map((section) => [section, afterById.get(section.id)]),
    added: after.filter((section) => !beforeIds.has(section.id)),
    removed: before.filter((section) => !afterById.has(section.id)),
  };
};

/**
 * Exact computed-style and box changes between elements matched by path.
 * Style props come from whatever the capture recorded on either side.
 */
export const diffElements = (before, after) => {
  const afterByPath = byKey(after, (element) => element.path);
  const beforePaths = new Set(before.map((element) => element.path));
  const changes = [];
  for (const old of before) {
    const next = afterByPath.get(old.path);
    if (!next) continue;
    const props = new Set([...Object.keys(old.styles), ...Object.keys(next.styles)]);
    for (const prop of props) {
      if (old.styles[prop] !== next.styles[prop]) {
        changes.push({ path: old.path, text: next.text, prop, before: old.styles[prop], after: next.styles[prop] });
      }
    }
    for (const prop of BOX_PROPS) {
      if (Math.abs(old.box[prop] - next.box[prop]) > BOX_TOLERANCE_PX) {
        changes.push({ path: old.path, text: next.text, prop: `box.${prop}`, before: old.box[prop], after: next.box[prop] });
      }
    }
  }
  return {
    changes,
    added: after.filter((element) => !beforePaths.has(element.path)).map((element) => element.path),
    removed: before.filter((element) => !afterByPath.has(element.path)).map((element) => element.path),
  };
};

/** Findings only the after side has (added) and only the before side had (fixed). */
export const diffFindings = (before, after, key) => {
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  return {
    added: after.filter((finding) => !beforeKeys.has(key(finding))),
    fixed: before.filter((finding) => !afterKeys.has(key(finding))),
  };
};

/**
 * diffFindings, minus findings that already came and went between two loads of
 * the before URL (`noise`), e.g. axe contrast results that depend on load timing.
 */
export const diffStableFindings = (before, after, noise, key) => {
  const result = diffFindings(before, after, key);
  if (!noise) return result;
  const unstable = diffFindings(before, noise, key);
  const flaky = new Set([...unstable.added, ...unstable.fixed].map(key));
  return {
    added: result.added.filter((finding) => !flaky.has(key(finding))),
    fixed: result.fixed.filter((finding) => !flaky.has(key(finding))),
  };
};

/** Drops changes on element paths that already differed between two before loads. */
export const withoutNoise = (changes, noisyPaths) =>
  changes.filter((change) => !noisyPaths.has(change.path));
