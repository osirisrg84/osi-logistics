import { useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type WindowWithPrompt = Window & { __pwaPrompt?: BeforeInstallPromptEvent };

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isDesktop() {
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function supportsNativePrompt() {
  return typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;
}

// Read any event captured early in main.tsx before modules loaded
function getEarlyPrompt(): BeforeInstallPromptEvent | null {
  return (window as WindowWithPrompt).__pwaPrompt ?? null;
}

let deferredEvent: BeforeInstallPromptEvent | null =
  typeof window !== 'undefined' ? getEarlyPrompt() : null;
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
  // Listen for the event dispatched by main.tsx's early capture
  window.addEventListener('pwa-prompt-ready', () => {
    deferredEvent = getEarlyPrompt();
    installed = false;
    emitChange();
  });

  // Also listen directly in case this module loads before the event fires
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    (window as WindowWithPrompt).__pwaPrompt = deferredEvent;
    installed = false;
    emitChange();
  });

  window.addEventListener('appinstalled', () => {
    deferredEvent = null;
    (window as WindowWithPrompt).__pwaPrompt = undefined;
    if (isStandalone()) installed = true;
    emitChange();
  });
}

export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, getSnapshot);
  const isInstalled = useSyncExternalStore(subscribe, getInstalledSnapshot);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return false;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    deferredEvent = null;
    (window as WindowWithPrompt).__pwaPrompt = undefined;
    emitChange();
    return outcome === 'accepted';
  }, []);

  return {
    canInstall: !isInstalled && event !== null,
    installed: isInstalled,
    promptInstall,
    needsManualInstall: !isInstalled && !supportsNativePrompt(),
    showManualFallback: !isInstalled && supportsNativePrompt() && event === null,
    isIOS: isIOS(),
    isDesktop: isDesktop(),
  };
}
