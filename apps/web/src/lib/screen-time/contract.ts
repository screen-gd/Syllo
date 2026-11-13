import { z } from "zod";

/** Source name Syllo sends so Screen Time can tell its sessions apart. */
export const SCREEN_TIME_SOURCE = "syllo";

/**
 * A focus session as Screen Time reports it. Extra keys are ignored so newer
 * Screen Time versions stay readable.
 */
export const focusSessionSchema = z.looseObject({
    id: z.string(),
    goal: z.string(),
    source: z.string(),
    mode: z.enum(["allow", "block"]),
    apps: z.array(z.string()),
    sites: z.array(z.string()),
    allowSites: z.array(z.string()),
    startedAt: z.string(),
    endsAt: z.string(),
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

/**
 * What Syllo's own API reports to the browser. `ready` is reachable (the
 * session may belong to another source), `busy` is a rejected start, and the
 * rest explain why Screen Time cannot be used.
 */
export const screenTimeStatusSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("ready"),
        session: focusSessionSchema.nullable(),
    }),
    z.object({
        kind: z.literal("busy"),
        session: focusSessionSchema.nullable(),
    }),
    z.object({ kind: z.literal("not-installed") }),
    z.object({ kind: z.literal("not-running") }),
    z.object({ kind: z.literal("outdated") }),
    z.object({ kind: z.literal("unavailable") }),
]);
export type ScreenTimeStatus = z.infer<typeof screenTimeStatusSchema>;

export const MIN_FOCUS_SECONDS = 60;
export const MAX_FOCUS_SECONDS = 43_200;

/** Body the browser sends when a focus period should start a session. */
export const focusStartRequestSchema = z.object({
    goal: z.string().trim().min(1).max(200),
    durationSeconds: z
        .number()
        .int()
        .min(MIN_FOCUS_SECONDS)
        .max(MAX_FOCUS_SECONDS),
    resourceUrls: z.array(z.string().max(2048)).max(100),
});
export type FocusStartRequest = z.infer<typeof focusStartRequestSchema>;

/**
 * The goal shown in Screen Time. Blank lessons fall back to a generic label;
 * long goals are cut on a word boundary so the result always fits 200 chars.
 */
export function focusGoal(raw: string): string {
    const goal = raw.trim().replace(/\s+/g, " ");
    if (!goal) return "Study session";
    if (goal.length <= 200) return goal;
    const lastSpace = goal.lastIndexOf(" ", 199);
    const cut = goal
        .slice(0, lastSpace >= 120 ? lastSpace : 199)
        .replace(/[\s·]+$/u, "");
    return `${cut}…`;
}

/** One line of user-facing copy for each Screen Time status. */
export function screenTimeMessage(status: ScreenTimeStatus | null): string {
    if (status === null) return "Checking for Screen Time…";
    switch (status.kind) {
        case "ready": {
            const session = status.session;
            if (!session) return "Screen Time is running.";
            if (session.source === SCREEN_TIME_SOURCE) {
                const time = new Date(session.endsAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                });
                return `Focus session on until ${time}.`;
            }
            return "Screen Time is running another focus session.";
        }
        case "busy":
            return "Screen Time is busy with another focus session. Your timer keeps going.";
        case "not-installed":
            return "Screen Time isn't installed on this computer.";
        case "not-running":
            return "Screen Time isn't running. Open it to block distractions.";
        case "outdated":
            return "Update Screen Time to use focus sessions.";
        case "unavailable":
            return "Screen Time couldn't be reached. Your timer still works.";
        default: {
            const _exhaustive: never = status;
            return _exhaustive;
        }
    }
}
