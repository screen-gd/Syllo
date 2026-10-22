import {
    createContext,
    useContext,
    useEffect,
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
} | null>(null);
const KEY = "syllo:pomodoro-session";

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
    const sessionRef = useRef(session);
    sessionRef.current = session;
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
    return (
        <Context.Provider
            value={{ session, focus, rest, toggle, reset, configure }}
        >
            {children}
        </Context.Provider>
    );
}

export function Pomodoro() {
    const timer = useContext(Context);
    if (!timer) return null;
    const { session, focus, rest, toggle, reset, configure } = timer;
    const minutes = String(Math.floor(session.remaining / 60)).padStart(2, "0");
    const seconds = String(session.remaining % 60).padStart(2, "0");
    return (
        <section className="sy-pomodoro">
            <div className="sy-pomodoro-head">
                <h2>Pomodoro</h2>
                <span>{session.mode === "focus" ? "Focus" : "Break"}</span>
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
