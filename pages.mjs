/**
 * Fixed page set for access-hire. Between them these cover every block and
 * app component PR #1112 changes (see DESIGN.md "Page set").
 */
export const PAGES = [
  { key: 'moiz-test', path: '/moiz-test' },
  { key: 'blog-showcase', path: '/about-us/news/test-typography-and-block-showcase' },
  {
    key: 'blog-post',
    path: '/about-us/news/how-to-choose-the-best-light-tower-for-hire-according-to-your-project',
  },
  { key: 'home', path: '/' },
  { key: 'blog-listing', path: '/about-us/news' },
  { key: 'contact', path: '/contact-us' },
  { key: 'off-hire', path: '/contact-us/off-hire-or-extend' },
  { key: 'branch', path: '/contact-us/find-a-branch/sydney' },
  { key: 'category', path: '/category/boom-lift' },
  { key: 'brand', path: '/brand/hyster' },
  { key: 'product', path: '/product/dingli-26ft-electric-scissor-lift-narrow-s0808-pace' },
  { key: 'search', path: '/search?q=scissor' },
  { key: 'search-empty', path: '/search?q=zzqxnoresults' },
];

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

/** Elements hidden before capture because they change between loads. */
export const MASK_SELECTORS = [
  '#onetrust-consent-sdk',
  '.grecaptcha-badge',
  '[id*="cookie" i]',
  '[class*="cookie-banner" i]',
  '#marker-io-container',
  '.mio-container',
  'iframe[src*="marker.io"]',
  '[id*="intercom" i]',
  '[id*="hubspot-messages" i]',
];
