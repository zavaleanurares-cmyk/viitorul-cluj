"use client";
import { useEffect } from "react";

/** Înregistrează service worker-ul (instalare ca aplicație + pagină de rezervă fără conexiune). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
