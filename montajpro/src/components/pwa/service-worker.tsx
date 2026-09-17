"use client";

import { useEffect } from "react";

/**
 * Înregistrează service worker-ul care ține aplicația funcțională offline.
 * Rulează doar în producție — în dev ar servi fișiere vechi din cache.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Înregistrarea eșuează în contexte fără HTTPS — aplicația merge oricum.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
