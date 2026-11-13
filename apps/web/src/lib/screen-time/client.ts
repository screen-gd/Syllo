import { useSyncExternalStore } from "react";
import { fetchPrivateApi } from "@/lib/private-api-fetch";
import {
    screenTimeStatusSchema,
    type FocusStartRequest,
    type ScreenTimeStatus,
} from "./contract";

const PATH = "/api/screen-time/session";
const LINK_KEY = "syllo:screen-time-link:v1";
const REQUEST_TIMEOUT_MS = 5000;

async function callApi(init: RequestInit): Promise<ScreenTimeStatus> {
    try {
        const response = await fetchPrivateApi(PATH, {
            ...init,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return { kind: "unavailable" };
        const parsed = screenTimeStatusSchema.safeParse(await response.json());
        return parsed.success ? parsed.data : { kind: "unavailable" };
    } catch {
        return { kind: "unavailable" };
    }
}

/**
 * Talk to Syllo's Screen Time route. Every call resolves a status and never
 * throws, so callers can render the union directly.
 */
export const screenTimeApi = {
    status: () => callApi({ method: "GET" }),
    start: (input: FocusStartRequest) =>
        callApi({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        }),
    stop: () => callApi({ method: "DELETE" }),
};

const listeners = new Set<() => void>();
// localStorage reads show up on every timer tick through the snapshot, so the
// value is cached in memory and only re-read after a real change.
let cached: boolean | null = null;

function readLinked(): boolean {
    if (cached === null) {
        try {
            cached = localStorage.getItem(LINK_KEY) === "on";
        } catch {
            cached = false;
        }
    }
    return cached;
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === LINK_KEY) {
            cached = null;
            listener();
        }
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

/**
 * The per-browser "link Screen Time to the timer" toggle. It is stored in
 * localStorage only and never syncs. Writes notify every listener in this tab;
 * the storage event covers other tabs.
 */
export function useScreenTimeLink(): readonly [
    boolean,
    (on: boolean) => void,
] {
    const linked = useSyncExternalStore(subscribe, readLinked, () => false);
    const setLinked = (on: boolean) => {
        try {
            if (on) localStorage.setItem(LINK_KEY, "on");
            else localStorage.removeItem(LINK_KEY);
        } catch {
            /* Storage may be blocked; the choice then holds for this visit. */
        }
        cached = on;
        for (const listener of listeners) listener();
    };
    return [linked, setLinked] as const;
}

/** What the current lesson contributes to a focus session request. */
export type StudyFocus = { goal: string; resourceUrls: string[] };

/** What the timer wants Screen Time to do after a state change. */
export type FocusIntent =
    | { kind: "stop" }
    | { kind: "start"; goal: string; resourceUrls: string[]; endAt: number };

/**
 * Map timer state to a Screen Time intent. Only a running focus period starts
 * a session; breaks, pauses and idle all stop it.
 */
export function focusIntent(
    session: { mode: "focus" | "break"; endAt: number | null },
    study: StudyFocus | null,
): FocusIntent {
    if (session.mode === "focus" && session.endAt !== null)
        return {
            kind: "start",
            goal: (study?.goal.trim() || "Study session").slice(0, 200),
            resourceUrls: study?.resourceUrls ?? [],
            endAt: session.endAt,
        };
    return { kind: "stop" };
}

type SendIntent =
    | { kind: "stop" }
    | {
          kind: "start";
          goal: string;
          resourceUrls: string[];
          durationSeconds: number;
      };

function intentKey(intent: FocusIntent): string {
    if (intent.kind === "stop") return "stop";
    return JSON.stringify({
        goal: intent.goal,
        resourceUrls: [...intent.resourceUrls].sort(),
        endAt: intent.endAt,
    });
}

/**
 * Turn the intent stream into ordered requests: dedupe repeats, keep one
 * request in flight, coalesce to the latest pending intent, and translate
 * rejections into the unavailable status. The first update always sends, so a
 * reloaded page reconciles Screen Time with the stored timer.
 */
export function createFocusSync({
    send,
    onStatus,
    now = Date.now,
}: {
    send: (intent: SendIntent) => Promise<ScreenTimeStatus>;
    onStatus: (status: ScreenTimeStatus) => void;
    now?: () => number;
}) {
    let lastKey: string | null = null;
    let inFlight = false;
    let pending: FocusIntent | null = null;
    let lastSentStart = false;
    let lastStartEndAt: number | null = null;
    let endedAt: number | null = null;
    let dispatches = 0;

    function dispatch(intent: FocusIntent): void {
        let outgoing: SendIntent;
        if (intent.kind === "stop") {
            outgoing = { kind: "stop" };
        } else {
            const durationSeconds = Math.ceil((intent.endAt - now()) / 1000);
            outgoing =
                durationSeconds <= 0
                    ? { kind: "stop" }
                    : {
                          kind: "start",
                          goal: intent.goal,
                          resourceUrls: intent.resourceUrls,
                          durationSeconds,
                      };
        }
        if (intent.kind === "start" && outgoing.kind === "start")
            lastStartEndAt = intent.endAt;
        dispatches += 1;
        inFlight = true;
        lastSentStart = outgoing.kind === "start";
        send(outgoing)
            .then(onStatus)
            .catch(() => onStatus({ kind: "unavailable" }))
            .finally(() => {
                inFlight = false;
                const next = pending;
                pending = null;
                if (next !== null) update(next);
            });
    }

    function update(intent: FocusIntent): void {
        const key = intentKey(intent);
        if (endedAt !== null) {
            // The user ended this session in Screen Time; a start for the
            // same period is remembered but never re-sent.
            if (intent.kind === "start" && intent.endAt === endedAt) {
                lastKey = key;
                return;
            }
            endedAt = null;
        }
        if (inFlight) {
            // Whatever is queued loses to the newest intent, including "the
            // same as what is already being sent".
            pending = key === lastKey ? null : intent;
            return;
        }
        if (key === lastKey) return;
        lastKey = key;
        dispatch(intent);
    }

    /** How many requests went out; callers discard poll results from before. */
    function version(): number {
        return dispatches;
    }

    /** Stop re-sending the current period after Screen Time ended it. */
    function markEnded(): void {
        endedAt = lastStartEndAt;
    }

    function release(): void {
        pending = null;
        endedAt = null;
        if (lastSentStart) update({ kind: "stop" });
        lastKey = null;
        lastSentStart = false;
    }

    return { update, release, markEnded, version };
}
