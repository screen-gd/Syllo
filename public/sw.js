const CACHE = "syllo-shell-v1";
const navigationPaths =
    /^\/(dashboard|library|learn|read\/[^/]+|reviews|settings)\/?$/;

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(["/favicon.svg", "/manifest.json"])),
    );
});
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) =>
                                key.startsWith("syllo-shell-") && key !== CACHE,
                        )
                        .map((key) => caches.delete(key)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});
self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;
    const asset = url.pathname.startsWith("/assets/");
    const navigation =
        request.mode === "navigate" && navigationPaths.test(url.pathname);
    if (!asset && !navigation) return;
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE);
            if (asset) {
                const cached = await cache.match(request);
                if (cached) return cached;
            }
            try {
                const response = await fetch(request);
                if (response.ok) await cache.put(request, response.clone());
                return response;
            } catch {
                const cached = await cache.match(request);
                return (
                    cached ??
                    new Response(
                        "Open this page once while online to use it offline.",
                        {
                            status: 503,
                            headers: { "Content-Type": "text/plain" },
                        },
                    )
                );
            }
        })(),
    );
});
