const CACHE_PREFIX = "finhealth-pwa";
const STATIC_CACHE = `${CACHE_PREFIX}-static-v1`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets-v1`;
const PRECACHE_URLS = [
  "/offline.html",
  "/icons/favicon-16x16.png",
  "/icons/favicon-32x32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-192x192.png",
  "/icons/maskable-icon-512x512.png",
  "/favicon.ico",
];

const DEFAULT_NOTIFICATION = {
  title: "FinHealth",
  body: "You have a FinHealth update.",
  url: "/dashboard",
  icon: "/icons/icon-192x192.png",
  badge: "/icons/maskable-icon-192x192.png",
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== STATIC_CACHE &&
              key !== ASSET_CACHE
          )
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|mjs|png|svg|jpg|jpeg|gif|webp|woff2?|ttf)$/i.test(pathname)
  );
}

function shouldBypass(url) {
  return (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/register") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/sw.js"
  );
}

function canCacheResponse(response) {
  if (!response || response.status !== 200 || response.type !== "basic") {
    return false;
  }

  const cacheControl = response.headers.get("cache-control") || "";
  return !/(?:no-store|private)/i.test(cacheControl);
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (canCacheResponse(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

function normalizeNotificationUrl(url) {
  if (typeof url !== "string" || url.length === 0) {
    return DEFAULT_NOTIFICATION.url;
  }

  if (!url.startsWith("/dashboard") || url.includes("://")) {
    return DEFAULT_NOTIFICATION.url;
  }

  return url;
}

self.addEventListener("push", (event) => {
  const payload = (() => {
    if (!event.data) {
      return DEFAULT_NOTIFICATION;
    }

    try {
      const parsed = event.data.json();
      return {
        title: parsed.title || DEFAULT_NOTIFICATION.title,
        body: parsed.body || DEFAULT_NOTIFICATION.body,
        url: normalizeNotificationUrl(parsed.url),
        icon: DEFAULT_NOTIFICATION.icon,
        badge: DEFAULT_NOTIFICATION.badge,
        tag: parsed.tag || undefined,
      };
    } catch {
      return DEFAULT_NOTIFICATION;
    }
  })();

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: {
        url: normalizeNotificationUrl(payload.url),
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  const targetUrl = normalizeNotificationUrl(event.notification.data?.url);
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith("/dashboard")) {
          if ("focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client && clientUrl.pathname !== targetUrl) {
                return client.navigate(targetUrl);
              }
              return undefined;
            });
          }
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return cache.match("/offline.html");
      })
    );
    return;
  }

  if (shouldBypass(url) || !isStaticAsset(url.pathname)) {
    return;
  }

  event.respondWith(cacheFirst(request));
});
