import { useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

/**
 * Chromium (Chrome/Edge/Samsung Internet) defines `onbeforeinstallprompt` on
 * `window` even before the event ever fires. Firefox and Safari don't define
 * it at all — that's the only reliable way to know up front whether the
 * native install prompt can ever appear, vs. just hasn't fired yet.
 */
function supportsNativePrompt() {
  return typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;
}

/**
 * `beforeinstallprompt` fires at most once per page load, whichever component
 * happens to be mounted at that moment. Dispatch and Driver Portal are
 * mutually-exclusive routes — if the event fires while one is mounted, a
 * per-component listener in the other would simply never see it. So the
 * listener is registered once at module scope (not inside a component effect)
 * and the captured event is shared through this tiny store; every component
 * using useInstallPrompt() reads the same state regardless of which one was
 * on screen when the browser actually fired the event.
 */
let deferredEvent: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' && isStandalone();
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return deferredEvent;
}

function getInstalledSnapshot() {
  return installed;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    installed = false;   // a new prompt means this PWA scope isn't installed yet
    emitChange();
  });
  window.addEventListener('appinstalled', () => {
    // Don't set installed=true globally — only mark installed when actually
    // running in standalone mode. This prevents hiding the install button for
    // the *other* portal (dispatch vs driver) after one of them is installed.
    deferredEvent = null;
    if (isStandalone()) installed = true;
    emitChange();
  });
}

/**
 * Exposes the shared `beforeinstallprompt` event so a custom "Install App"
 * button can trigger it on demand instead of relying on the browser's own
 * install UI. Safari/iOS never fires this event — there's no programmatic
 * install prompt there, only the manual "Add to Home Screen" flow.
 */
export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, getSnapshot);
  const isInstalled = useSyncExternalStore(subscribe, getInstalledSnapshot);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return false;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    deferredEvent = null;
    emitChange();
    return outcome === 'accepted';
  }, []);

  return {
    canInstall: !isInstalled && event !== null,
    installed: isInstalled,
    promptInstall,
    /** True once we know no native prompt will ever fire (Firefox, Safari) — show manual instructions instead. */
    needsManualInstall: !isInstalled && !supportsNativePrompt(),
    /** True when Chrome/Edge supports install but beforeinstallprompt hasn't fired yet (e.g. cooldown after uninstall). */
    showManualFallback: !isInstalled && supportsNativePrompt() && event === null,
    isIOS: isIOS(),
  };
}
