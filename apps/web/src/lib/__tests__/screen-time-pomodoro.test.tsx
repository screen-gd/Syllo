// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PomodoroProvider, { Pomodoro } from "@/components/learning/Pomodoro";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LINK_KEY = "syllo:screen-time-link";
const SESSION_KEY = "syllo:pomodoro-session";

interface FetchCall {
    method: string;
    url: string;
    body: unknown;
}

let calls: FetchCall[];
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    localStorage.clear();
    calls = [];
    vi.stubGlobal(
        "fetch",
        vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            let body: unknown;
            try {
                body =
                    typeof init?.body === "string"
                        ? JSON.parse(init.body)
                        : undefined;
            } catch {
                body = undefined;
            }
            calls.push({
                method: init?.method ?? "GET",
                url: String(input),
                body,
            });
            return Promise.resolve(
                new Response(
                    JSON.stringify({ kind: "ready", session: null }),
                    {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    },
                ),
            );
        }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(
            <PomodoroProvider>
                <Pomodoro />
            </PomodoroProvider>,
        );
    });
}

async function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
        (el) => el.textContent === text,
    );
    if (!button) throw new Error(`no button labelled ${text}`);
    await act(async () => {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
}

function storeSession(session: Record<string, unknown>) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

describe("pomodoro screen time link", () => {
    it("posts a session for the full focus period on Start", async () => {
        localStorage.setItem(LINK_KEY, "on");
        await render();
        await click("Start");
        const post = calls.find((call) => call.method === "POST");
        expect(post).toBeDefined();
        expect(post?.url).toBe("/api/screen-time/session");
        if (typeof post?.body !== "object" || post.body === null)
            throw new Error("expected a JSON body");
        expect(post.body).toMatchObject({
            goal: "Study session",
            durationSeconds: 1500,
            resourceUrls: [],
        });
    });

    it("deletes the session on Pause", async () => {
        localStorage.setItem(LINK_KEY, "on");
        await render();
        await click("Start");
        await click("Pause");
        expect(calls[calls.length - 1].method).toBe("DELETE");
        expect(calls[calls.length - 1].url).toBe("/api/screen-time/session");
    });

    it("reposts the remaining time for a stored running focus", async () => {
        localStorage.setItem(LINK_KEY, "on");
        storeSession({
            mode: "focus",
            remaining: 300,
            endAt: Date.now() + 300_000,
        });
        await render();
        const post = calls.find((call) => call.method === "POST");
        expect(post).toBeDefined();
        if (typeof post?.body !== "object" || post.body === null)
            throw new Error("expected a JSON body");
        expect(post.body).toMatchObject({ durationSeconds: 300 });
    });

    it("sends a stop for a stored idle timer so nothing keeps blocking", async () => {
        localStorage.setItem(LINK_KEY, "on");
        storeSession({ mode: "focus", remaining: 1500, endAt: null });
        await render();
        expect(calls).toHaveLength(1);
        expect(calls[0].method).toBe("DELETE");
    });

    it("stays silent when the link is off", async () => {
        await render();
        await click("Start");
        expect(calls).toHaveLength(0);
    });
});
