import { registerPipelineHandlers } from "./pipeline";
import { ensureScoutRunner } from "./runner";

let registered = false;

/**
 * Every Scout endpoint calls this first. Registering handlers is idempotent,
 * and starting the queue is cheap; a cold server starts working on the first
 * request instead of waiting for a boot hook that TanStack Start does not
 * give us.
 */
export function scoutReady() {
    if (!registered) {
        registerPipelineHandlers();
        registered = true;
    }
    ensureScoutRunner();
}

export function scoutJson(data: unknown, status = 200) {
    return Response.json(data, { status });
}

export function scoutFailure(error: unknown, fallback = "Scout could not finish that request") {
    const message = error instanceof Error && error.message ? error.message : fallback;
    console.error("[scout] api error:", error);
    return scoutJson({ success: false, error: message }, 500);
}

export function scoutBadRequest(message: string) {
    return scoutJson({ success: false, error: message }, 400);
}

/** Path segments of the request URL, so route files can read their own ids. */
export function pathSegments(request: Request): string[] {
    return new URL(request.url).pathname.split("/").filter(Boolean);
}

export async function readJsonBody<T extends Record<string, unknown>>(request: Request): Promise<T | null> {
    try {
        const parsed = (await request.json()) as unknown;
        return parsed && typeof parsed === "object" ? (parsed as T) : null;
    } catch {
        return null;
    }
}
