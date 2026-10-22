/**
 * Minimal production host for the TanStack Start build.
 *
 * `vite build` emits `dist/client` (static assets) and `dist/server/server.js`
 * (a default export that takes a `Request` and resolves to a `Response`).
 * This file serves the static assets directly and forwards everything else to
 * that handler, which keeps a single origin for the app, its API routes and
 * its server functions.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import handler from "./dist/server/server.js";

const PORT = Number(process.env.PORT ?? 3000);
// Loopback by default: there is no access gate, so expose the app to other
// machines only by setting HOST explicitly.
const HOST = process.env.HOST ?? "127.0.0.1";
const CLIENT_ROOT = resolve(import.meta.dirname, "dist/client");

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".otf": "font/otf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".xml": "application/xml; charset=utf-8",
};

/** Resolve a request path to a file inside `dist/client`, or `undefined`. */
async function findStaticFile(pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        return undefined;
    }

    const candidate = resolve(join(CLIENT_ROOT, decoded));
    if (candidate !== CLIENT_ROOT && !candidate.startsWith(CLIENT_ROOT + sep)) {
        return undefined;
    }

    try {
        const info = await stat(candidate);
        return info.isFile() ? candidate : undefined;
    } catch {
        return undefined;
    }
}

function toWebRequest(request) {
    const url = `http://${request.headers.host ?? `localhost:${PORT}`}${request.url ?? "/"}`;
    const headers = new Headers();

    for (const [name, value] of Object.entries(request.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
            for (const entry of value) headers.append(name, entry);
        } else {
            headers.set(name, value);
        }
    }

    const method = request.method ?? "GET";
    const hasBody = method !== "GET" && method !== "HEAD";

    return new Request(url, {
        method,
        headers,
        body: hasBody ? Readable.toWeb(request) : undefined,
        // Required by undici when streaming a request body.
        ...(hasBody ? { duplex: "half" } : {}),
    });
}

async function sendWebResponse(response, nodeResponse) {
    nodeResponse.statusCode = response.status;
    nodeResponse.statusMessage = response.statusText;

    for (const [name, value] of response.headers) {
        if (name === "set-cookie") continue;
        nodeResponse.setHeader(name, value);
    }

    const cookies = response.headers.getSetCookie?.() ?? [];
    if (cookies.length > 0) nodeResponse.setHeader("set-cookie", cookies);

    if (!response.body) {
        nodeResponse.end();
        return;
    }

    Readable.fromWeb(response.body).pipe(nodeResponse);
}

const server = createServer(async (request, response) => {
    try {
        if (request.method === "GET" || request.method === "HEAD") {
            const pathname = (request.url ?? "/").split("?")[0];
            const file = await findStaticFile(pathname);

            if (file) {
                const headers = {
                    "content-type": MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
                    // Hashed build assets never change; everything else gets a short TTL.
                    "cache-control": pathname.startsWith("/assets/")
                        ? "public, max-age=31536000, immutable"
                        : "public, max-age=3600",
                };
                response.writeHead(200, headers);
                if (request.method === "HEAD") {
                    response.end();
                } else {
                    createReadStream(file).pipe(response);
                }
                return;
            }
        }

        const webResponse = await handler.fetch(toWebRequest(request));
        await sendWebResponse(webResponse, response);
    } catch (error) {
        console.error("Server error:", error);
        if (!response.headersSent) {
            response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        }
        response.end("Internal Server Error");
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Syllo listening on http://${HOST}:${PORT}`);
});
