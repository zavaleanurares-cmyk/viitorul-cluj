"use client";
import { useEffect } from "react";

/**
 * Pe ecranele de dinainte de autentificare nu e nimeni conectat: golim ecranele de prezență păstrate
 * pentru teren (conțin numele jucătorilor). Acoperă orice drum de ieșire: meniu, profil, consimțământ, sesiune expirată.
 */
export function ClearOfflinePages() {
  useEffect(() => {
    navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "clear-pages" })).catch(() => {});
  }, []);
  return null;
}
