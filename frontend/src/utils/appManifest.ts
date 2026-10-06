export function setAppManifest(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
}

export function setThemeColor(color: string) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = color;
}

// Swaps the actual browser tab/bookmark favicon (distinct from the PWA
// manifest icons above) -- lets the Admin Console show a purple icon while
// the rest of the app keeps the orange one, same /admin index.html for both.
export function setFavicon(href: string) {
  const sel = 'link[rel="icon"]';
  let link = document.querySelector<HTMLLinkElement>(sel);
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
}

export const DISPATCH_MANIFEST = '/manifest-dispatch.webmanifest';
export const DRIVER_MANIFEST   = '/manifest-driver.webmanifest';
export const ADMIN_MANIFEST    = '/manifest-admin.webmanifest';
export const DISPATCH_COLOR    = '#f97316';
export const DRIVER_COLOR      = '#2563eb';
export const ADMIN_COLOR       = '#9333ea';
export const NEUTRAL_COLOR     = '#0f172a';
export const DISPATCH_FAVICON  = '/favicon-32.png';
export const ADMIN_FAVICON     = '/favicon-32-admin.png';
