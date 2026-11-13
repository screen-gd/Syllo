import http from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    allowSitesFor,
    connectionFilePath,
    getFocusStatus,
    startFocusSession,
    stopFocusSession,
} from "@/lib/server/screen-time";

const TOKEN = "test-token";
const SESSION = {
    id: "s1",
    goal: "Study",
    source: "syllo",
    mode: "block",
    apps: ["Mail"],
    sites: ["example.com"],
    allowSites: ["localhost"],
    startedAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-01-01T00:25:00.000Z",
};

interface RecordedRequest {
    method: string | undefined;
    url: string | undefined;
    token: string | string[] | undefined;
    body: unknown;
}

let server: http.Server;
let requests: RecordedRequest[];
let responder: (request: RecordedRequest) => {
    status: number;
    payload: unknown;
};
let port: number;
let dir: string;
let connectionPath: string;

beforeEach(async () => {
    requests = [];
    responder = () => ({ status: 200, payload: { session: null } });
    server = http.createServer((req, res) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk;
        });
        req.on("end", () => {
            let body: unknown;
            try {
                body = JSON.parse(raw);
            } catch {
                body = undefined;
            }
            const recorded: RecordedRequest = {
                method: req.method,
                url: req.url,
                token: req.headers["x-tally-token"],
                body,
            };
            requests.push(recorded);
            const { status, payload } = responder(recorded);
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify(payload));
        });
    });
    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string")
        throw new Error("test server has no port");
    port = address.port;
    dir = await mkdtemp(path.join(tmpdir(), "syllo-screen-time-"));
    connectionPath = path.join(dir, "screen-time", "connection.json");
});

afterEach(async () => {
    await new Promise<void>((resolve) => {
        server.close(() => resolve());
    });
    await rm(dir, { recursive: true, force: true });
});

async function writeConnection(overrides: Record<string, unknown> = {}) {
    await mkdir(path.dirname(connectionPath), { recursive: true });
    await writeFile(
        connectionPath,
        JSON.stringify({
            version: 1,
            url: `http://127.0.0.1:${port}`,
            token: TOKEN,
            pid: process.pid,
            ...overrides,
        }),
    );
}

describe("screen time http adapter", () => {
    it("reports ready with no session and sends the token", async () => {
        await writeConnection();
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "ready", session: null });
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe("GET");
        expect(requests[0].url).toBe("/api/v1/focus/session");
        expect(requests[0].token).toBe(TOKEN);
    });

    it("starts a session with only goal, source, duration and allowSites", async () => {
        await writeConnection();
        responder = () => ({ status: 201, payload: { session: SESSION } });
        const status = await startFocusSession(
            {
                goal: "Read chapter 4",
                durationSeconds: 1500,
                allowSites: ["localhost"],
            },
            { connectionPath },
        );
        expect(status).toEqual({ kind: "ready", session: SESSION });
        const body = requests[0].body;
        if (typeof body !== "object" || body === null)
            throw new Error("expected a JSON body");
        expect(Object.keys(body).sort()).toEqual([
            "allowSites",
            "durationSeconds",
            "goal",
            "source",
        ]);
        expect(body).toMatchObject({
            goal: "Read chapter 4",
            source: "syllo",
            durationSeconds: 1500,
            allowSites: ["localhost"],
        });
    });

    it("stops a session with a source-scoped delete", async () => {
        await writeConnection();
        await expect(
            stopFocusSession({ connectionPath }),
        ).resolves.toEqual({ kind: "ready", session: null });
        expect(requests[0].method).toBe("DELETE");
        expect(requests[0].url).toBe("/api/v1/focus/session?source=syllo");
    });

    it("maps a 409 to busy with the other session", async () => {
        await writeConnection();
        const other = { ...SESSION, source: "other-app" };
        responder = () => ({ status: 409, payload: { session: other } });
        const status = await startFocusSession(
            { goal: "g", durationSeconds: 60, allowSites: [] },
            { connectionPath },
        );
        expect(status).toEqual({ kind: "busy", session: other });
    });

    it("reports not-running when the directory exists without a file", async () => {
        await mkdir(path.dirname(connectionPath), { recursive: true });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "not-running" });
        expect(requests).toHaveLength(0);
    });

    it("reports not-installed when the directory is missing", async () => {
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "not-installed" });
        expect(requests).toHaveLength(0);
    });

    it("reports unavailable for a file that is not JSON", async () => {
        await mkdir(path.dirname(connectionPath), { recursive: true });
        await writeFile(connectionPath, "not json");
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "unavailable" });
        expect(requests).toHaveLength(0);
    });

    it("refuses a non-loopback url and sends nothing", async () => {
        await writeConnection({ url: "http://example.com" });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "unavailable" });
        expect(requests).toHaveLength(0);
    });

    it("reports not-running when the port is closed", async () => {
        const dead = http.createServer();
        await new Promise<void>((resolve) => {
            dead.listen(0, "127.0.0.1", resolve);
        });
        const deadAddress = dead.address();
        if (deadAddress === null || typeof deadAddress === "string")
            throw new Error("dead server has no port");
        const deadPort = deadAddress.port;
        await new Promise<void>((resolve) => {
            dead.close(() => resolve());
        });
        await writeConnection({ url: `http://127.0.0.1:${deadPort}` });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "not-running" });
    });

    it("reports not-running for a dead pid without calling http", async () => {
        await writeConnection({ pid: 2147483646 });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "not-running" });
        expect(requests).toHaveLength(0);
    });

    it("maps 404 to outdated", async () => {
        await writeConnection();
        responder = () => ({ status: 404, payload: { error: "gone" } });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "outdated" });
    });

    it("maps a 200 with a junk body to outdated", async () => {
        await writeConnection();
        responder = () => ({ status: 200, payload: { junk: true } });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "outdated" });
    });

    it("maps 401 to unavailable", async () => {
        await writeConnection();
        responder = () => ({ status: 401, payload: { error: "bad token" } });
        await expect(
            getFocusStatus({ connectionPath }),
        ).resolves.toEqual({ kind: "unavailable" });
    });
});

describe("connectionFilePath", () => {
    const home = path.join("home", "user");

    it("uses APPDATA on win32 and falls back to the profile", () => {
        expect(
            connectionFilePath({
                platform: "win32",
                env: { APPDATA: path.join("C:", "roaming") },
                home,
            }),
        ).toBe(path.join("C:", "roaming", "screen-time", "connection.json"));
        expect(
            connectionFilePath({ platform: "win32", env: {}, home }),
        ).toBe(
            path.join(
                home,
                "AppData",
                "Roaming",
                "screen-time",
                "connection.json",
            ),
        );
    });

    it("uses Application Support on darwin", () => {
        expect(
            connectionFilePath({ platform: "darwin", env: {}, home }),
        ).toBe(
            path.join(
                home,
                "Library",
                "Application Support",
                "screen-time",
                "connection.json",
            ),
        );
    });

    it("honours XDG_CONFIG_HOME and falls back to ~/.config on linux", () => {
        expect(
            connectionFilePath({
                platform: "linux",
                env: { XDG_CONFIG_HOME: path.join("xdg", "cfg") },
                home,
            }),
        ).toBe(path.join("xdg", "cfg", "screen-time", "connection.json"));
        expect(
            connectionFilePath({ platform: "linux", env: {}, home }),
        ).toBe(path.join(home, ".config", "screen-time", "connection.json"));
    });
});

describe("allowSitesFor", () => {
    it("puts the Syllo host first and strips ports", () => {
        expect(
            allowSitesFor({
                requestHost: "localhost:3000",
                resourceUrls: [],
            }),
        ).toEqual(["localhost"]);
        expect(
            allowSitesFor({ requestHost: "[::1]:3000", resourceUrls: [] }),
        ).toEqual(["[::1]"]);
    });

    it("normalizes www, case and trailing dots", () => {
        expect(
            allowSitesFor({
                requestHost: null,
                resourceUrls: ["https://WWW.Example.COM./page"],
            }),
        ).toEqual(["example.com"]);
    });

    it("adds youtube.com for youtube short and nocookie hosts", () => {
        expect(
            allowSitesFor({
                requestHost: null,
                resourceUrls: [
                    "https://youtu.be/abc",
                    "https://www.youtube-nocookie.com/embed/abc",
                ],
            }),
        ).toEqual(["youtu.be", "youtube.com", "youtube-nocookie.com"]);
    });

    it("skips non-http urls and dedupes", () => {
        expect(
            allowSitesFor({
                requestHost: "example.com:3000",
                resourceUrls: [
                    "ftp://files.example.com/a",
                    "not a url",
                    "https://example.com/x",
                    "https://example.com/y",
                ],
            }),
        ).toEqual(["example.com"]);
    });
});
