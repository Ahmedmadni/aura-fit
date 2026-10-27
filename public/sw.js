/*
 * Aura Fit PWA media cache — Phase 46.
 *
 * App navigation is NEVER written to CacheStorage after installation:
 * profile/workout HTML may depend on the signed-in account. Only the public
 * shell is precached. Approved pinned GitHub exercise visuals are cached
 * on first successful view, with strict source/file allowlists and FIFO caps.
 */
importScripts("/media-offline-allowlist.js");

const CACHE_VERSION = "aura-fit-v3";
const GIF_CACHE = "aura-fit-approved-gifs-v1";
const POSTER_CACHE = "aura-fit-approved-posters-v1";
const FRAME_CACHE = "aura-fit-exercise-frames-v1";
const MEDIA_LIMITS = { gif: 24, poster: 48, frame: 120 };
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/media-offline-allowlist.js",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];
const KEEP_CACHES = new Set([
  CACHE_VERSION, GIF_CACHE, POSTER_CACHE, FRAME_CACHE,
]);
const offlineManifest = self.AURA_OFFLINE_MEDIA;
const approvedGifs = new Set(offlineManifest.gifs);
const approvedPosters = new Set(offlineManifest.posters);
const fallbackSlugs = new Set(offlineManifest.slugs);

function classifyExerciseMedia(url, request) {
  // No user-controlled query, authorization, storage, analytics or API URLs.
  if (request.method !== "GET" || request.cache === "no-store") return null;
  if (request.headers?.has?.("authorization")) return null;
  if (url.origin !== "https://raw.githubusercontent.com" ||
      url.search || url.hash || url.username || url.password) return null;

  const sourcePrefix = "/hasaneyldrm/exercises-dataset/" +
    offlineManifest.sourceCommit + "/";
  if (url.pathname.startsWith(sourcePrefix)) {
    const asset = url.pathname.slice(sourcePrefix.length);
    if (approvedGifs.has(asset)) return "gif";
    if (approvedPosters.has(asset)) return "poster";
    return null;
  }
  const framePrefix = "/bryllim/workout-guide/" +
    offlineManifest.fallbackCommit + "/packages/workout-guide/";
  if (url.pathname.startsWith(framePrefix)) {
    const rest = url.pathname.slice(framePrefix.length);
    const match = /^assets\/([a-z0-9]+(?:-[a-z0-9]+)*)\/frame-([123])\.svg$/.exec(rest);
    if (match && fallbackSlugs.has(match[1])) return "frame";
  }
  return null;
}

// Install the public shell's build dependency graph before taking control.
// Requests omit account cookies; only immutable same-origin /assets JS/CSS
// are discovered. Never follow API, navigation, dev-server or remote URLs.
async function precachePublicShell(cache) {
  await cache.addAll(APP_SHELL.filter((asset) => asset !== "/"));
  const response = await fetch("/", { credentials: "omit", cache: "reload" });
  if (!response.ok) throw new Error("Public shell is unavailable");
  const html = await response.clone().text();
  const pending = [];
  const visited = new Set();
  const discover = (text, base) => {
    for (const match of text.matchAll(/["']([^"'\s<>]+\.(?:js|css))["']/g)) {
      // Vite preload maps use root-relative "assets/chunk.js" strings even
      // inside an /assets entry module; imports use ./chunk.js instead.
      const reference = match[1].startsWith("assets/") ? "/" + match[1] : match[1];
      const url = new URL(reference, base);
      if (url.origin !== self.location.origin || !(/^\/assets\//).test(url.pathname) ||
          url.search || url.hash || url.username || url.password || visited.has(url.href)) continue;
      visited.add(url.href);
      if (visited.size > 256) throw new Error("Public shell asset graph exceeds its budget");
      pending.push(url.href);
    }
  };
  discover(html, self.location.origin + "/");
  for (let index = 0; index < pending.length; index++) {
    const url = pending[index];
    const asset = await fetch(url, { credentials: "omit", cache: "reload" });
    if (!asset.ok) throw new Error("Public shell dependency is unavailable");
    discover(await asset.clone().text(), url);
    await cache.put(url, asset);
  }
  // Publish the shell only after every required dependency was saved.
  await cache.put("/", response);
}

async function trimMediaCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key);
  }
}

async function serveExerciseMedia(request, kind, event) {
  const cacheName = kind === "gif" ? GIF_CACHE :
    kind === "poster" ? POSTER_CACHE : FRAME_CACHE;
  const cache = await caches.open(cacheName);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  // Standard cross-origin <img> fetches may be opaque. Only cache them when
  // the URL is an exact member of our commit-pinned allowlist. Opaque responses
  // cannot prove HTTP success, so users can retry by clearing site data.
  if (response.ok || response.type === "opaque") {
    event.waitUntil(
      cache.put(request, response.clone())
        .then(() => trimMediaCache(cache, MEDIA_LIMITS[kind]))
        .catch(() => {}),
    );
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => precachePublicShell(cache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) =>
          (key.startsWith("aura-fit-") && !KEEP_CACHES.has(key))
        ).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const mediaKind = classifyExerciseMedia(url, request);
  if (mediaKind) {
    event.respondWith(serveExerciseMedia(request, mediaKind, event));
    return;
  }
  // No other cross-origin requests are intercepted, especially Supabase.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        // Only the public app shell from installation, never a previously
        // visited /profile, /workout or account-specific server HTML response.
        return (await caches.match("/")) ??
          (await caches.match("/offline.html"));
      }),
    );
    return;
  }

  // Only immutable build assets and known public app icons may enter the
  // shared CacheStorage. A same-origin URL ending in .png/.js may be a
  // personalized export or authenticated response and must NOT be cached.
  const publicIcons = new Set([
    "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png",
    "/apple-touch-icon.png",
  ]);
  const isStaticAsset =
    (url.pathname.startsWith("/assets/") &&
      /\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname)) ||
    publicIcons.has(url.pathname);
  if (!isStaticAsset || url.search || request.headers?.has?.("authorization")) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_VERSION)
                .then((cache) => cache.put(request, response.clone()))
                .catch(() => {}),
            );
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
      // Freshen cached same-origin static assets, retaining update work while
      // the service worker may otherwise terminate after a cached response.
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
