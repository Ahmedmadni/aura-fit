/**
 * Browser-level PWA contract using Chromium's real Service Worker/CacheStorage.
 * A tiny valid synthetic GIF is seeded into the real cache for one approved
 * pinned URL, so CI does not rely on the public CDN being reachable.
 * The separate SW contract verifies automatic writes and eviction.
 */
export async function assertNoPrivateNavigationCache(evaluate) {
  const state = await evaluate(`(async () => {
    const entries = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        entries.push({ cache: name, url: request.url });
      }
    }
    const paths = new Set([
      "/profile", "/workout", "/progress", "/onboarding", "/nutrition",
      "/coach", "/builder", "/dna",
    ]);
    return {
      count: entries.length,
      privateEntries: entries.filter(item => {
        const url = new URL(item.url);
        return url.origin === location.origin && paths.has(url.pathname);
      }),
      publicShell: entries.some(item => {
        const url = new URL(item.url);
        return url.origin === location.origin && url.pathname === "/";
      }),
    };
  })()`, true);
  if (!state?.publicShell) {
    throw new Error("SW public installation shell is missing from CacheStorage.");
  }
  if (state.privateEntries?.length) {
    throw new Error("SW cached account-specific navigation HTML: " +
      JSON.stringify(state.privateEntries.slice(0, 5)));
  }
  return state.count;
}

export async function seedApprovedMediaProbe(evaluate) {
  const probe = await evaluate(`(async () => {
    const response = await fetch("/media-offline-allowlist.js");
    if (!response.ok) throw new Error("Media allowlist script unavailable");
    const text = await response.text();
    const marker = "Object.freeze(";
    const start = text.indexOf(marker);
    const end = text.lastIndexOf(");");
    if (start < 0 || end <= start) throw new Error("Malformed media allowlist");
    const allowed = JSON.parse(text.slice(start + marker.length, end));
    if (allowed.gifs.length !== 191 || allowed.slugs.length !== 302) {
      throw new Error("Wrong exercise media inventory");
    }
    const prefix = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/" +
      allowed.sourceCommit + "/";
    const gifUrl = prefix + allowed.gifs[0];
    const rejectedUrl = prefix + "videos/3217-epOSYUZ.gif";
    const gifBytes = Uint8Array.from(
      atob("R0lGODlhAQABAIAAAP///////ywAAAAAAQABAAACAUwAOw=="),
      ch => ch.charCodeAt(0),
    );
    const cache = await caches.open("aura-fit-approved-gifs-v1");
    const request = new Request(gifUrl, { mode: "no-cors" });
    await cache.put(request, new Response(gifBytes, {
      status: 200,
      headers: { "Content-Type": "image/gif" },
    }));
    return {
      gifUrl, rejectedUrl,
      seeded: Boolean(await cache.match(request)),
    };
  })()`, true);
  if (!probe?.seeded || !probe.gifUrl || !probe.rejectedUrl) {
    throw new Error("Cannot seed approved media into real browser cache");
  }
  return probe;
}

export async function assertRealOfflineMediaFetch(evaluate, probe) {
  const expression = `(async () => {
    if (!navigator.serviceWorker?.controller) {
      throw new Error("Offline page lacks a controlling service worker");
    }
    const inspect = url => new Promise(resolve => {
      const image = new Image();
      const timer = setTimeout(() => resolve("timeout"), 5000);
      image.onload = () => { clearTimeout(timer); resolve("loaded"); };
      image.onerror = () => { clearTimeout(timer); resolve("blocked"); };
      image.src = url;
    });
    return {
      approved: await inspect(__APPROVED__),
      rejected: await inspect(__REJECTED__),
      online: navigator.onLine,
    };
  })()`
    .replace("__APPROVED__", JSON.stringify(probe.gifUrl))
    .replace("__REJECTED__", JSON.stringify(probe.rejectedUrl));
  const outcome = await evaluate(expression, true);
  if (outcome?.online !== false) {
    throw new Error("Chromium did not switch to offline network conditions");
  }
  if (outcome.approved !== "loaded") {
    throw new Error("Previously cached approved GIF was unavailable offline: " +
      JSON.stringify(outcome));
  }
  if (outcome.rejected !== "blocked") {
    throw new Error("Previously rejected GIF unexpectedly loaded offline: " +
      JSON.stringify(outcome));
  }
}
