import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { z } from "zod";
import {
    getPersonalSnapshot,
    putPersonalEntry,
    usePersonalData,
} from "@/lib/personal/store";
import {
    createFocusSync,
    focusIntent,
    screenTimeApi,
    useScreenTimeLink,
    type StudyFocus,
} from "@/lib/screen-time/client";
import {
    SCREEN_TIME_SOURCE,
    screenTimeMessage,
    type ScreenTimeStatus,
} from "@/lib/screen-time/contract";

const sessionSchema = z.object({
    mode: z.enum(["focus", "break"]),
    remaining: z.number().nonnegative(),
    endAt: z.number().nullable(),
});
type Session = z.infer<typeof sessionSchema>;
const initial: Session = { mode: "focus", remaining: 25 * 60, endAt: null };
const Context = createContext<{
    session: Session;
    focus: number;
    rest: number;
    toggle: () => void;
    reset: () => void;
    configure: (kind: "focus" | "rest", value: number) => void;
    linked: boolean;
    linkStatus: ScreenTimeStatus | null;
} | null>(null);
const StudyFocusContext = createContext<
    ((focus: StudyFocus | null) => void) | null
>(null);
const KEY = "syllo:pomodoro-session";

/**
 * The lesson page reports the open lesson through this hook so a running focus
 * period can name its Screen Time session and keep the lesson's sites allowed.
 * The setter lives outside the timer context so ticks never re-render the page,
 * and the last lesson stays the goal after the page unmounts.
 */
export function useStudyFocus(focus: StudyFocus | null) {
    const setStudy = useContext(StudyFocusContext);
    const key = focus ? [focus.goal, ...focus.resourceUrls].join("\n") : "";
    const focusRef = useRef(focus);
    focusRef.current = focus;
    useEffect(() => {
        setStudy?.(focusRef.current);
    }, [key, setStudy]);
}

/**
 * Owns the timer state for the whole app and mirrors it to Screen Time when
 * the user linked the two. The sync only sends on real intent changes, never
 * on the per-second tick.
 */
export default function PomodoroProvider({
    children,
}: {
    children: ReactNode;
}) {
    const records = usePersonalData();
    const entry = records["timer:settings"];
    const focus = entry?.kind === "timer" ? entry.data.focus : 25;
    const rest = entry?.kind === "timer" ? entry.data.rest : 5;
    const [session, setSession] = useState<Session>(initial);
    const [loaded, setLoaded] = useState(false);
    const [study, setStudy] = useState<StudyFocus | null>(null);
    const [linked] = useScreenTimeLink();
    const [linkStatus, setLinkStatus] = useState<ScreenTimeStatus | null>(null);
    const [tracking, setTracking] = useState(false);
    const sessionRef = useRef(session);
    sessionRef.current = session;
    const syncRef = useRef<ReturnType<typeof createFocusSync> | null>(null);
    if (syncRef.current === null)
        syncRef.current = createFocusSync({
            send: (intent) =>
                intent.kind === "start"
                    ? screenTimeApi.start({
                          goal: intent.goal,
                          durationSeconds: intent.durationSeconds,
                          resourceUrls: intent.resourceUrls,
                      })
                    : screenTimeApi.stop(),
            onStatus: (status) => {
                setLinkStatus(status);
                setTracking(
                    status.kind === "ready" &&
                        status.session?.source === SCREEN_TIME_SOURCE,
                );
            },
        });
    useEffect(() => {
        try {
            const raw = localStorage.getItem(KEY);
            const stored = sessionSchema.safeParse(
                raw ? JSON.parse(raw) : null,
            );
            if (stored.success) setSession(stored.data);
        } catch {
            /* Start fresh when the saved timer is unreadable. */
        }
        setLoaded(true);
    }, []);
    useEffect(() => {
        if (loaded) localStorage.setItem(KEY, JSON.stringify(session));
    }, [session, loaded]);
    useEffect(() => {
        if (session.endAt === null) return;
        function tick() {
            const current = sessionRef.current;
            if (current.endAt === null) return;
            const remaining = Math.max(
                0,
                Math.ceil((current.endAt - Date.now()) / 1000),
            );
            if (remaining === 0) {
                const mode = current.mode === "focus" ? "break" : "focus";
                setSession({
                    mode,
                    remaining: (mode === "focus" ? focus : rest) * 60,
                    endAt: null,
                });
            } else setSession({ ...current, remaining });
        }
        tick();
        const timer = setInterval(tick, 1000);
        document.addEventListener("visibilitychange", tick);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", tick);
        };
    }, [session.endAt, focus, rest]);
    const toggle = () =>
        setSession((current) =>
            current.endAt === null
                ? { ...current, endAt: Date.now() + current.remaining * 1000 }
                : {
                      ...current,
                      remaining: Math.max(
                          0,
                          Math.ceil((current.endAt - Date.now()) / 1000),
                      ),
                      endAt: null,
                  },
        );
    const reset = () =>
        setSession({ mode: "focus", remaining: focus * 60, endAt: null });
    function configure(kind: "focus" | "rest", value: number) {
        const settings = {
            focus,
            rest,
            [kind]: Math.min(
                kind === "focus" ? 120 : 60,
                Math.max(1, Math.round(value) || (kind === "focus" ? 25 : 5)),
            ),
        };
        putPersonalEntry({
            kind: "timer",
            id: "timer:settings",
            data: settings,
            updatedAt: Date.now(),
            deleted: false,
        });
        setSession({
            mode: "focus",
            remaining: settings.focus * 60,
            endAt: null,
        });
    }
    // Ticks only change `remaining`, so this intent identity stays put between
    // real state changes and the effect below never re-sends on a tick.
    const intent = useMemo(
        () =>
            focusIntent(
                { mode: session.mode, endAt: session.endAt },
                study,
            ),
        [session.mode, session.endAt, study],
    );
    useEffect(() => {
        if (!loaded) return;
        const sync = syncRef.current;
        if (!sync) return;
        if (linked) sync.update(intent);
        else {
            sync.release();
            setLinkStatus(null);
            setTracking(false);
        }
    }, [loaded, linked, intent]);
    const runningFocus = session.mode === "focus" && session.endAt !== null;
    // While our session is believed on, watch for the user ending it in Screen
    // Time so the label drops instead of claiming a block that is not there.
    useEffect(() => {
        if (!linked || !runningFocus || !tracking) return;
        const sync = syncRef.current;
        if (!sync) return;
        let cancelled = false;
        const poll = async () => {
            const before = sync.version();
            const result = await screenTimeApi.status();
            if (cancelled || sync.version() !== before) return;
            if (
                result.kind === "ready" &&
                result.session?.source === SCREEN_TIME_SOURCE
            ) {
                setLinkStatus(result);
            } else if (result.kind === "ready") {
                sync.markEnded();
                setTracking(false);
                setLinkStatus(result);
            } else {
                setLinkStatus(result);
            }
        };
        const timer = setInterval(() => void poll(), 20_000);
        const onVisible = () => {
            if (document.visibilityState === "visible") void poll();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            cancelled = true;
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [linked, runningFocus, tracking]);
    return (
        <StudyFocusContext.Provider value={setStudy}>
            <Context.Provider
                value={{
                    session,
                    focus,
                    rest,
                    toggle,
                    reset,
                    configure,
                    linked,
                    linkStatus,
                }}
            >
                {children}
            </Context.Provider>
        </StudyFocusContext.Provider>
    );
}

/**
 * The timer card on the lesson page. When the Screen Time link is on it shows
 * whether the local app is blocking distractions, and otherwise stays a plain
 * timer.
 */
export function Pomodoro() {
    const timer = useContext(Context);
    if (!timer) return null;
    const {
        session,
        focus,
        rest,
        toggle,
        reset,
        configure,
        linked,
        linkStatus,
    } = timer;
    const runningFocus = session.mode === "focus" && session.endAt !== null;
    const blocking =
        linked &&
        runningFocus &&
        linkStatus?.kind === "ready" &&
        linkStatus.session?.source === SCREEN_TIME_SOURCE;
    const minutes = String(Math.floor(session.remaining / 60)).padStart(2, "0");
    const seconds = String(session.remaining % 60).padStart(2, "0");
    return (
        <section className="sy-pomodoro">
            <div className="sy-pomodoro-head">
                <h2>Pomodoro</h2>
                <span
                    title={
                        blocking
                            ? "Screen Time is blocking distractions"
                            : undefined
                    }
                >
                    {session.mode === "focus" ? "Focus" : "Break"}
                    {blocking ? " · Screen Time" : ""}
                </span>
            </div>
            <div
                className="sy-timer-clock"
                role="timer"
                aria-label={`${session.mode}, ${minutes} minutes ${seconds} seconds`}
            >
                {minutes}:{seconds}
            </div>
            <div className="sy-timer-actions">
                <button className="sy-button secondary" onClick={toggle}>
                    {session.endAt === null ? "Start" : "Pause"}
                </button>
                <button className="sy-button quiet" onClick={reset}>
                    Reset
                </button>
            </div>
            {linked && runningFocus && linkStatus?.kind !== "ready" ? (
                <p className="sy-form-hint" role="status">
                    {screenTimeMessage(linkStatus)}
                </p>
            ) : null}
            <div className="sy-timer-settings">
                <label>
                    Focus · min
                    <input
                        type="number"
                        min={1}
                        max={120}
                        value={focus}
                        onChange={(event) =>
                            configure("focus", Number(event.target.value))
                        }
                    />
                </label>
                <label>
                    Break · min
                    <input
                        type="number"
                        min={1}
                        max={60}
                        value={rest}
                        onChange={(event) =>
                            configure("rest", Number(event.target.value))
                        }
                    />
                </label>
            </div>
        </section>
    );
}

export function getTimerSettings() {
    const entry = getPersonalSnapshot()["timer:settings"];
    return entry?.kind === "timer" ? entry.data : { focus: 25, rest: 5 };
}
