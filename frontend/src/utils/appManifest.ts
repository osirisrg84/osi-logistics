/**
 * Swaps the document's <link rel="manifest"> so each portal installs as its
 * own PWA (distinct name/icon/start_url) instead of one generic app —
 * dispatch/admin get manifest-dispatch.webmanifest, drivers get
 * manifest-driver.webmanifest. index.html ships the dispatch one as the
 * default for pre-login pages.
 */
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

export const DISPATCH_MANIFEST = '/manifest-dispatch.webmanifest';
export const DRIVER_MANIFEST = '/manifest-driver.webmanifest';
