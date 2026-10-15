/*
 * Service worker minim.
 *  - NU pune în cache pagini sau răspunsuri de API, cu o singură excepție: ecranul de prezență al antrenorului
 *    (/program/<id>/prezenta), ca să se poată deschide la teren fără semnal. Acesta conține doar nume, numere
 *    și starea „accidentat", fără diagnostic; se șterge la ieșirea din cont (mesajul „clear-pages" și orice navigare spre /autentificare).
 *  - Ține în cache resursele statice (JS/CSS/fonturi) și o pagină „fără conexiune".
 *  - Pregătit pentru notificări push (se activează odată cu aplicația nativă / web push).
 */
const CACHE = "static-v1";
const PAGES = "pages-v1";
const OFFLINE_URL = "/offline";
const OFFLINE_PAGE = /^\/program\/[0-9a-f-]{36}\/prezenta$/;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PAGES).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
    return;
  }
  if (req.mode === "navigate" && OFFLINE_PAGE.test(url.pathname)) {
    // rețeaua întâi; fără semnal, ultima variantă deschisă
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok && !res.redirected) {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(url.pathname, copy));
        }
        return res;
      }).catch(() => caches.match(url.pathname).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
    return;
  }
  if (req.mode === "navigate") {
    // o încărcare completă a ecranului de autentificare golește ecranele de prezență păstrate
    // (navigările din aplicație le acoperă ClearOfflinePages, montat pe ecranele de autentificare)
    if (url.pathname.startsWith("/autentificare")) event.waitUntil(caches.delete(PAGES));
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear-pages") {
    event.waitUntil(caches.delete(PAGES));
  }
  // pregătește pentru teren ecranele de prezență ale zilei (trimise de pagina „Azi" a antrenorului)
  if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(caches.open(PAGES).then((c) => Promise.all(
      data.urls.filter((u) => OFFLINE_PAGE.test(u)).map((u) =>
        fetch(u, { credentials: "same-origin" }).then((res) => (res.ok && !res.redirected ? c.put(u, res) : null)).catch(() => null)),
    )));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(self.registration.showNotification(data.title || "Notificare", {
    body: data.body || "", icon: "/icon/192", badge: "/icon/192", data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow((event.notification.data && event.notification.data.url) || "/"));
});
