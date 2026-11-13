import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import {
    focusGoal,
    focusSessionSchema,
    MAX_FOCUS_SECONDS,
    MIN_FOCUS_SECONDS,
    SCREEN_TIME_SOURCE,
    type ScreenTimeStatus,
} from "@/lib/screen-time/contract";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const REQUEST_TIMEOUT_MS = 1500;
const MAX_ALLOW_SITES = 50;

interface Connection {
    base: string;
    token: string;
    pid: number;
}

const connectionSchema = z.object({
    version: z.literal(1),
    url: z.string(),
    token: z.string().min(1),
    pid: z.number().int().positive(),
});

/** Where Screen Time writes its connection file on each platform. */
export function connectionFilePath({
    platform,
    env,
    home,
}: {
    platform: NodeJS.Platform;
    env: NodeJS.ProcessEnv;
    home: string;
}): string {
    switch (platform) {
        case "win32":
            return path.join(
                env.APPDATA ?? path.join(home, "AppData", "Roaming"),
                "screen-time",
                "connection.json",
            );
        case "darwin":
            return path.join(
                home,
                "Library",
                "Application Support",
                "screen-time",
                "connection.json",
            );
        default:
            return path.join(
                env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
                "screen-time",
                "connection.json",
            );
    }
}

function hasCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    );
}

/**
 * Read and validate the connection file. Any failure resolves to a status so
 * callers never send the token anywhere a tampered file points to.
 */
async function readConnection(
    connectionPath: string,
): Promise<Connection | ScreenTimeStatus> {
    let raw: string;
    try {
        raw = await readFile(connectionPath, "utf8");
    } catch (error) {
        if (!hasCode(error, "ENOENT")) return { kind: "unavailable" };
        try {
            await stat(path.dirname(connectionPath));
            return { kind: "not-running" };
        } catch {
            return { kind: "not-installed" };
        }
    }
    let json: unknown;
    try {
        json = JSON.parse(raw);
    } catch {
        return { kind: "unavailable" };
    }
    const parsed = connectionSchema.safeParse(json);
    if (!parsed.success) return { kind: "unavailable" };
    let url: URL;
    try {
        url = new URL(parsed.data.url);
    } catch {
        return { kind: "unavailable" };
    }
    if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname))
        return { kind: "unavailable" };
    return { base: url.origin, token: parsed.data.token, pid: parsed.data.pid };
}

/** AbortSignal.timeout rejects with a DOMException named TimeoutError. */
function isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.name === "TimeoutError";
}

/** A stale connection file often outlives the app; EPERM still means alive. */
function processAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return hasCode(error, "EPERM");
    }
}

function resolvePath(options?: { connectionPath?: string }): string {
    return (
        options?.connectionPath ??
        connectionFilePath({
            platform: process.platform,
            env: process.env,
            home: os.homedir(),
        })
    );
}

async function parseBody(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return undefined;
    }
}

/** Status codes that mean something other than "reachable". */
function mapFailureStatus(response: Response): ScreenTimeStatus {
    if (
        response.status === 404 ||
        response.status === 405 ||
        response.status === 501
    )
        return { kind: "outdated" };
    return { kind: "unavailable" };
}

async function callScreenTime(
    connectionPath: string,
    method: "GET" | "POST" | "DELETE",
    body?: unknown,
): Promise<Response | ScreenTimeStatus> {
    const connection = await readConnection(connectionPath);
    if ("kind" in connection) return connection;
    if (!processAlive(connection.pid)) return { kind: "not-running" };
    const query = method === "DELETE" ? `?source=${SCREEN_TIME_SOURCE}` : "";
    try {
        return await fetch(
            `${connection.base}/api/v1/focus/session${query}`,
            {
                method,
                headers: {
                    "X-Tally-Token": connection.token,
                    ...(body === undefined
                        ? {}
                        : { "Content-Type": "application/json" }),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            },
        );
    } catch (error) {
        // A timeout means the app is alive but slow, not gone: surface it so
        // a half-finished stop does not read as "not running".
        if (isTimeoutError(error)) return { kind: "unavailable" };
        return { kind: "not-running" };
    }
}

const sessionResponseSchema = z.object({
    session: focusSessionSchema.nullable(),
});

/** Report what Screen Time is doing right now, per the API route's GET. */
export async function getFocusStatus(options?: {
    connectionPath?: string;
}): Promise<ScreenTimeStatus> {
    const result = await callScreenTime(resolvePath(options), "GET");
    if (!(result instanceof Response)) return result;
    if (!result.ok) return mapFailureStatus(result);
    const parsed = sessionResponseSchema.safeParse(await parseBody(result));
    return parsed.success
        ? { kind: "ready", session: parsed.data.session }
        : { kind: "outdated" };
}

/**
 * Ask Screen Time to start a focus session. Only goal, source, duration and
 * allowed sites go over; the user's saved app and site rules stay in Screen
 * Time.
 */
export async function startFocusSession(
    {
        goal,
        durationSeconds,
        allowSites,
    }: {
        goal: string;
        durationSeconds: number;
        allowSites: string[];
    },
    options?: { connectionPath?: string },
): Promise<ScreenTimeStatus> {
    const result = await callScreenTime(resolvePath(options), "POST", {
        goal: focusGoal(goal),
        source: SCREEN_TIME_SOURCE,
        durationSeconds: Math.min(
            MAX_FOCUS_SECONDS,
            Math.max(MIN_FOCUS_SECONDS, durationSeconds),
        ),
        allowSites,
    });
    if (!(result instanceof Response)) return result;
    if (result.status === 409) {
        const parsed = sessionResponseSchema.safeParse(
            await parseBody(result),
        );
        return {
            kind: "busy",
            session: parsed.success ? parsed.data.session : null,
        };
    }
    if (!result.ok) return mapFailureStatus(result);
    const parsed = sessionResponseSchema.safeParse(await parseBody(result));
    return parsed.success
        ? { kind: "ready", session: parsed.data.session }
        : { kind: "outdated" };
}

/** End Syllo's focus session without touching another source's. */
export async function stopFocusSession(options?: {
    connectionPath?: string;
}): Promise<ScreenTimeStatus> {
    const result = await callScreenTime(resolvePath(options), "DELETE");
    if (!(result instanceof Response)) return result;
    if (result.status === 409) {
        // Not our session to stop: report whatever is running instead.
        const parsed = sessionResponseSchema.safeParse(
            await parseBody(result),
        );
        return {
            kind: "ready",
            session: parsed.success ? parsed.data.session : null,
        };
    }
    if (!result.ok) return mapFailureStatus(result);
    const parsed = z
        .object({ session: z.null() })
        .safeParse(await parseBody(result));
    return parsed.success
        ? { kind: "ready", session: null }
        : { kind: "outdated" };
}

/**
 * Sites Syllo asks Screen Time to keep reachable: the host serving Syllo plus
 * the lesson's resource hosts. YouTube embeds need youtube.com alongside the
 * nocookie and short-link hosts.
 */
export function allowSitesFor({
    requestHost,
    resourceUrls,
}: {
    requestHost: string | null;
    resourceUrls: string[];
}): string[] {
    const sites: string[] = [];
    const push = (hostname: string) => {
        let host = hostname.toLowerCase();
        if (host.startsWith("www.")) host = host.slice(4);
        host = host.replace(/\.+$/, "");
        if (!host) return;
        sites.push(host);
        if (
            host === "youtu.be" ||
            host === "youtube-nocookie.com" ||
            host.endsWith(".youtube-nocookie.com")
        )
            sites.push("youtube.com");
    };
    if (requestHost) {
        try {
            push(new URL(`http://${requestHost}`).hostname);
        } catch {
            /* An unreadable Host header contributes nothing. */
        }
    }
    for (const value of resourceUrls) {
        try {
            const url = new URL(value);
            if (url.protocol === "http:" || url.protocol === "https:")
                push(url.hostname);
        } catch {
            /* Skip resource URLs that are not absolute http(s) links. */
        }
    }
    return [...new Set(sites)].slice(0, MAX_ALLOW_SITES);
}
