// SmartPOS service worker: lets the app open without internet.
// Only SmartPOS's own files are cached. Supabase API calls are never touched here;
// the app saves its own data on the device (see lib/offline.ts).
const VERSION = "v2"; // bumped so phones pick up the new logo and icons
const STATIC = `smartpos-static-${VERSION}`;
const PAGES = `smartpos-pages-${VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/", { credentials: "same-origin" });
        if (res.ok && !res.redirected) await (await caches.open(PAGES)).put("/", res);
      } catch (_) {
        /* offline during install: fine, it will be cached on the first online visit */
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES]);
      for (const key of await caches.keys()) {
        if (key.startsWith("smartpos-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

function fetchWithTimeout(req, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// Pages: use the network when it answers quickly, otherwise the last saved copy.
async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetchWithTimeout(req, 5000);
    if (res.ok && !res.redirected) cache.put("/", res.clone());
    return res;
  } catch (_) {
    const saved = await cache.match("/");
    return (
      saved ||
      new Response("You're offline and SmartPOS hasn't been opened on this phone with internet yet.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

// Build files have unique names per release, so a saved copy never goes stale.
async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
  } else if (/\.(?:png|jpg|jpeg|svg|ico|woff2?)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(req));
  }
});
