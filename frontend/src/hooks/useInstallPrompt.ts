import { useCallback, useEffect, useState } from 'react';

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
  return 'onbeforeinstallprompt' in window;
}

/**
 * Captures the browser's `beforeinstallprompt` event (Chrome/Edge/Android) so a
 * custom "Install App" button can trigger it on demand instead of relying on the
 * browser's own install UI. Safari/iOS never fires this event — there's no
 * programmatic install prompt there, only the manual "Add to Home Screen" flow.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    if (installed) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [installed]);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return false;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return outcome === 'accepted';
  }, [deferredEvent]);

  return {
    canInstall: !installed && deferredEvent !== null,
    installed,
    promptInstall,
    /** True once we know no native prompt will ever fire (Firefox, Safari) — show manual instructions instead. */
    needsManualInstall: !installed && !supportsNativePrompt(),
    isIOS: isIOS(),
  };
}
