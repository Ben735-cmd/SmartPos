"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* the app still works online without it */
    });
    // Ask the browser not to clear our saved sales when the phone is low on space.
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  return null;
}
