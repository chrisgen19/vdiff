/** CSS and browser script embedded in report.html (the report has no external assets). */

export const STYLES = `
:root { --bg: #fff; --fg: #1a1a1a; --muted: #666; --line: #ddd; --panel: #f6f6f6; --changed: #c2410c; --same: #15803d; --noisy: #a16207; --error: #b91c1c; --link: #1d4ed8; --link-visited: #6d28d9; }
@media (prefers-color-scheme: dark) { :root { --bg: #111; --fg: #eee; --muted: #999; --line: #333; --panel: #1b1b1b; --link: #93c5fd; --link-visited: #c4b5fd; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 system-ui, sans-serif; }
a { color: var(--link); }
a:visited { color: var(--link-visited); }
code { font-size: 12px; word-break: break-all; }
.muted { color: var(--muted); font-size: 12px; }
.error { color: var(--error); }
.layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
.nav { position: sticky; top: 0; align-self: start; max-height: 100vh; overflow: auto; border-right: 1px solid var(--line); padding: 16px 12px; font-size: 13px; }
.nav h1 { font-size: 16px; margin: 0 0 4px; }
.nav ul { list-style: none; margin: 0 0 10px; padding: 0 0 0 10px; }
.nav li a { display: flex; justify-content: space-between; gap: 6px; padding: 1px 4px; border-radius: 4px; text-decoration: none; color: var(--fg); }
.nav li a:hover { background: var(--panel); }
.nav li a[aria-current="page"] { background: var(--panel); font-weight: 600; box-shadow: inset 3px 0 0 var(--changed); }
.nav .page-name { font-weight: 600; margin-top: 6px; }
.nav-select { display: none; width: 100%; font: inherit; padding: 6px; margin-bottom: 12px; background: var(--panel); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: var(--same); margin-right: 4px; }
.dot.c { background: var(--changed); }
.dot.e { background: var(--error); }
main { padding: 16px; min-width: 0; max-width: 1600px; }
@media (max-width: 760px) { .layout { grid-template-columns: 1fr; } .nav { display: none; } .nav-select { display: block; } }
.view[hidden] { display: none; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 16px; }
th, td { border-bottom: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
.page-head { border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-bottom: 8px; }
.page-head h2 { font-size: 18px; margin: 0; }
.urls { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0 8px; font-size: 12px; }
.urls a { word-break: break-all; }
.badge { display: inline-block; padding: 0 6px; border-radius: 4px; color: #fff; font-size: 12px; background: var(--muted); white-space: nowrap; }
.badge.changed, .badge.added, .badge.removed { background: var(--changed); }
.badge.same { background: var(--same); }
.badge.noisy { background: var(--noisy); }
.sec { border: 1px solid var(--line); border-radius: 6px; margin: 8px 0; }
.sec.same, .sec.noisy { opacity: .6; }
.sec > summary { padding: 8px; cursor: pointer; list-style: none; }
.sec > summary::-webkit-details-marker { display: none; }
.sec > summary::before { content: "\\25B8"; display: inline-block; width: 14px; transition: transform .15s; }
.sec[open] > summary::before { transform: rotate(90deg); }
.sec-title { font-weight: 600; }
.sec-meta { display: block; margin-left: 14px; }
.sec-body { padding: 0 8px 8px; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 4px 0 8px; font-size: 13px; }
.toolbar label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.shots.with-diff { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 760px) { .shots, .shots.with-diff { grid-template-columns: 1fr; } }
figure { margin: 0; min-width: 0; }
figcaption { font-size: 12px; color: var(--muted); }
.shot { display: block; width: 100%; border: 1px solid var(--line); cursor: zoom-in; max-height: 420px; object-fit: cover; object-position: top; background: #fff; }
.overlay { position: relative; background: #000; max-height: 420px; overflow: hidden; cursor: zoom-in; border: 1px solid var(--line); }
.overlay img { display: block; width: 100%; }
.overlay img + img { position: absolute; top: 0; left: 0; mix-blend-mode: difference; }
.diff-only { display: none; }
.with-diff .diff-only { display: block; }
.pattern { border-left: 3px solid var(--changed); padding: 4px 8px; margin: 6px 0; background: var(--panel); border-radius: 0 6px 6px 0; }
.pattern .what { font-weight: 600; }
.from { text-decoration: line-through; color: var(--muted); }
.to { font-weight: 600; }
details.more { margin-top: 8px; }
details.more > summary { cursor: pointer; font-weight: 600; font-size: 13px; }
td.el { width: 40%; }
.el-text { color: var(--muted); font-size: 12px; display: block; }
.findings { margin: 8px 0; }
.findings h4 { margin: 8px 0 4px; }
.viewer { position: fixed; inset: 0; background: #0b0b0b; color: #eee; display: none; flex-direction: column; z-index: 50; }
.viewer.open { display: flex; }
.viewer-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 16px; flex-wrap: wrap; }
.viewer-bar button { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid #555; background: #222; color: #eee; cursor: pointer; }
.viewer-bar label { cursor: pointer; margin-right: 8px; }
.viewer-panes { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 0 16px 16px; min-height: 0; }
@media (max-width: 760px) { .viewer-panes { grid-template-columns: 1fr; } }
.viewer-pane { overflow: auto; border: 1px solid #444; background: #000; min-height: 0; }
.viewer-pane h3 { position: sticky; top: 0; z-index: 1; margin: 0; padding: 4px 8px; font-size: 13px; background: #222; }
.viewer-pane img { display: block; width: 100%; }
.viewer .diffwrap { position: relative; }
.viewer .diffwrap img + img { position: absolute; top: 0; left: 0; mix-blend-mode: difference; display: none; }
.viewer.diff .viewer-panes { grid-template-columns: 1fr; }
.viewer.diff .pane-after { display: none; }
.viewer.diff .diffwrap img + img { display: block; }
`;

/** Hash navigation (one page view at a time), difference toggles, full-screen viewer. */
export const SCRIPT = `
const views = [...document.querySelectorAll('.view')];
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
const select = document.querySelector('.nav-select');
const show = () => {
  const id = location.hash.slice(1) || 'overview';
  const view = views.find((v) => v.dataset.view === id) ?? views[0];
  views.forEach((v) => { v.hidden = v !== view; });
  navLinks.forEach((a) => {
    if (a.getAttribute('href') === '#' + view.dataset.view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  select.value = view.dataset.view;
  document.title = view.dataset.title;
  window.scrollTo(0, 0);
};
select.addEventListener('change', () => { location.hash = select.value; });
window.addEventListener('hashchange', show);
show();

document.addEventListener('change', (e) => {
  if (e.target.matches('.diff-toggle')) e.target.closest('.sec-body').querySelector('.shots').classList.toggle('with-diff', e.target.checked);
  if (e.target.matches('.viewer-diff')) viewer.classList.toggle('diff', e.target.checked);
});

const viewer = document.querySelector('.viewer');
const panes = [...viewer.querySelectorAll('.viewer-pane')];
let syncing = false;
panes.forEach((pane) => pane.addEventListener('scroll', () => {
  if (syncing) return;
  syncing = true;
  panes.forEach((other) => { if (other !== pane) other.scrollTop = pane.scrollTop; });
  requestAnimationFrame(() => { syncing = false; });
}));
let opener = null;
const openViewer = (shots) => {
  const { before, after, title } = shots.dataset;
  viewer.querySelector('.viewer-title').textContent = title;
  viewer.querySelectorAll('.src-before').forEach((img) => { img.src = before; });
  viewer.querySelectorAll('.src-after').forEach((img) => { img.src = after; });
  viewer.querySelector('.viewer-diff').checked = false;
  viewer.classList.remove('diff');
  panes.forEach((p) => { p.scrollTop = 0; });
  opener = document.activeElement;
  viewer.classList.add('open');
  viewer.querySelector('.viewer-close').focus();
};
const closeViewer = () => { viewer.classList.remove('open'); opener?.focus(); };
document.addEventListener('click', (e) => {
  const target = e.target.closest('.shot, .overlay');
  if (target) openViewer(target.closest('.shots'));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && viewer.classList.contains('open')) closeViewer();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.shot, .overlay')) { e.preventDefault(); openViewer(e.target.closest('.shots')); }
});
viewer.querySelector('.viewer-close').addEventListener('click', closeViewer);
`;
