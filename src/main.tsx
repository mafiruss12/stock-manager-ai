import { initTheme } from '@/lib/theme';
initTheme();
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initNativeApp, isNative } from './lib/mobile';
import { initTiun } from './lib/tiun';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Capacitor (app native Android)
initNativeApp().catch(() => {});

// Tiun payments (si VITE_TIUN_SNIPPET_ID configuré)
try { initTiun(); } catch { /* optional */ }

// Service Worker uniquement sur le web (pas dans la WebView native)
if ('serviceWorker' in navigator && !isNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
