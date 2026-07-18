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

export const DISPATCH_MANIFEST = '/manifest-dispatch.webmanifest';
export const DRIVER_MANIFEST   = '/manifest-driver.webmanifest';
export const DISPATCH_COLOR    = '#f97316';
export const DRIVER_COLOR      = '#0f1e35';
