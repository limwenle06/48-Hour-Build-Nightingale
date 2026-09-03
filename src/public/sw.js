const CACHE = "nightingale-public-shell-v3";
const PUBLIC_SHELL_PATHS = new Set(["/", "/start", "/manifest.webmanifest"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...PUBLIC_SHELL_PATHS])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  const isPublicShell =
    requestUrl.search === "" && PUBLIC_SHELL_PATHS.has(requestUrl.pathname);
  if (
    event.request.method !== "GET" ||
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/patient") ||
    requestUrl.pathname.startsWith("/staff") ||
    requestUrl.pathname.startsWith("/_next/static/") ||
    !isPublicShell
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
