// Injected into the captured page with page.addScriptTag. Exposes window.__vd.
(() => {
  const STYLE_PROPS = [
    'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color',
    'text-align', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'gap',
  ];
  const MAX_ELEMENTS = 400;
  const TARGET_SELECTOR = 'a, button, input, select, textarea, [role="button"]';

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  /** Structural path from root to el, e.g. `div:1>h2:1`. Stable when both sides share markup. */
  const pathFrom = (root, el) => {
    const parts = [];
    for (let node = el; node && node !== root; node = node.parentElement) {
      const tag = node.tagName.toLowerCase();
      const siblings = node.parentElement ? [...node.parentElement.children].filter((c) => c.tagName === node.tagName) : [node];
      parts.unshift(`${tag}:${siblings.indexOf(node) + 1}`);
    }
    return parts.join('>');
  };

  const ownText = (el) =>
    [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(' ')
      .trim();

  /** Top-level Builder blocks, plus any main-area content outside them (breadcrumbs, app components). */
  const splitIntoSections = (container, out) => {
    for (const child of container.children) {
      if (child.hasAttribute('builder-id')) out.push(child);
      else if (child.querySelector('[builder-id]')) splitIntoSections(child, out);
      else if (isVisible(child)) out.push(child);
    }
    return out;
  };

  const sectionLabel = (el) => {
    const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
    const text = (heading ?? el).textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
    return `${el.tagName.toLowerCase()}${text ? `: ${text}` : ''}`;
  };

  const markSections = () => {
    const main = document.querySelector('main') ?? document.body;
    const sections = [
      ...document.querySelectorAll('body > header, header:not(main header)'),
      ...splitIntoSections(main, []),
      ...document.querySelectorAll('body > footer, footer:not(main footer)'),
    ].filter((el, index, all) => all.indexOf(el) === index && isVisible(el));
    return sections.map((el, index) => {
      el.setAttribute('data-vd-section', String(index));
      const rect = el.getBoundingClientRect();
      return {
        id: el.getAttribute('builder-id') ?? pathFrom(document.body, el),
        label: sectionLabel(el),
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height),
      };
    });
  };

  const isTracked = (el) => {
    const style = getComputedStyle(el);
    const spaced = ['padding-top', 'padding-left', 'gap'].some((prop) => !['0px', 'normal'].includes(style.getPropertyValue(prop)));
    return ownText(el) || el.matches('img, svg, video, iframe, canvas, ' + TARGET_SELECTOR) || /^H[1-6]$/.test(el.tagName) || spaced;
  };

  const collectElements = (index) => {
    const root = document.querySelector(`[data-vd-section="${index}"]`);
    if (!root) return [];
    const rootRect = root.getBoundingClientRect();
    return [root, ...root.querySelectorAll('*')]
      .filter((el) => isVisible(el) && isTracked(el))
      .slice(0, MAX_ELEMENTS)
      .map((el) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          path: pathFrom(root, el) || 'root',
          text: (ownText(el) || el.getAttribute('alt') || el.getAttribute('aria-label') || '').slice(0, 60),
          styles: Object.fromEntries(STYLE_PROPS.map((prop) => [prop, style.getPropertyValue(prop)])),
          box: {
            x: Math.round(rect.left - rootRect.left),
            y: Math.round(rect.top - rootRect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
  };

  const isClipped = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== 'visible') return true;
    }
    return false;
  };

  const collectLayout = (isMobile) => {
    const width = document.documentElement.clientWidth;
    const all = [...document.body.querySelectorAll('*')].filter(isVisible);
    const overflowing = all
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return (rect.right > width + 1 || rect.left < -1) && !isClipped(el);
      })
      .slice(0, 50)
      .map((el) => ({ path: pathFrom(document.body, el), label: sectionLabel(el) }));
    const smallTargets = !isMobile
      ? []
      : all
          .filter((el) => el.matches(TARGET_SELECTOR) && getComputedStyle(el).display !== 'inline')
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
          })
          .slice(0, 100)
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return { path: pathFrom(document.body, el), label: sectionLabel(el), width: Math.round(rect.width), height: Math.round(rect.height) };
          });
    return { overflowX: Math.max(0, document.documentElement.scrollWidth - width), overflowing, smallTargets };
  };

  /**
   * Hides fixed and sticky elements (site header, badges) unless they are, contain
   * or sit inside the section about to be screenshotted, so they don't overlap it.
   */
  const isolateSection = (index) => {
    const section = document.querySelector(`[data-vd-section="${index}"]`);
    for (const el of document.body.querySelectorAll('*')) {
      const { position } = getComputedStyle(el);
      if (position === 'fixed' || position === 'sticky') el.setAttribute('data-vd-floating', '');
    }
    for (const el of document.querySelectorAll('[data-vd-floating]')) {
      const related = section && (el === section || el.contains(section) || section.contains(el));
      el.style.setProperty('visibility', related ? '' : 'hidden', related ? '' : 'important');
    }
  };

  /** Scrolls the section into view and waits (max 5s) for its images to load and decode. */
  const settleSection = async (index) => {
    const section = document.querySelector(`[data-vd-section="${index}"]`);
    if (!section) return;
    section.scrollIntoView({ block: 'start' });
    const images = [...section.querySelectorAll('img')];
    const settled = images.map((img) =>
      (img.complete ? Promise.resolve() : new Promise((resolve) => img.addEventListener('loadend', resolve, { once: true })))
        .then(() => img.decode())
        .catch(() => {}),
    );
    await Promise.race([Promise.all(settled), new Promise((resolve) => setTimeout(resolve, 5000))]);
  };

  window.__vd = { markSections, collectElements, collectLayout, isolateSection, settleSection };
})();
