'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only. In development a cached app
 * shell fights the dev server on every reload, which is a worse trade than
 * losing offline support on localhost.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // An unavailable service worker costs offline support, nothing else.
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
