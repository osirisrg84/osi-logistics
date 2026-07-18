import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'leaflet/dist/leaflet.css';

// Capture beforeinstallprompt as early as possible — before React renders.
// The module-level listener in useInstallPrompt.ts runs when that module is
// first evaluated, but that's still later than this top-level script. Storing
// it on window ensures we never miss it regardless of component mount order.
if (typeof window !== 'undefined' && 'onbeforeinstallprompt' in window) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as Window & { __pwaPrompt?: Event }).__pwaPrompt = e;
    window.dispatchEvent(new Event('pwa-prompt-ready'));
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
