import { describe, expect, it, vi } from "vitest";
import {
    createFocusSync,
    focusIntent,
    type FocusIntent,
} from "@/lib/screen-time/client";
import {
    focusGoal,
    focusStartRequestSchema,
    type ScreenTimeStatus,
} from "@/lib/screen-time/contract";

type SendIntent =
    | { kind: "stop" }
    | {
          kind: "start";
          goal: string;
          resourceUrls: string[];
          durationSeconds: number;
      };

const READY: ScreenTimeStatus = { kind: "ready", session: null };

function makeSync(now: () => number = () => 0) {
    const sent: SendIntent[] = [];
    const statuses: ScreenTimeStatus[] = [];
    let gate: Promise<void> | null = null;
    const send = (intent: SendIntent): Promise<ScreenTimeStatus> => {
        sent.push(intent);
        return gate ? gate.then(() => READY) : Promise.resolve(READY);
    };
    const sync = createFocusSync({
        send,
        onStatus: (status) => statuses.push(status),
        now,
    });
    return {
        sent,
        statuses,
        sync,
        hold: (pending: Promise<void> | null) => {
            gate = pending;
        },
    };
}

describe("focusIntent", () => {
    it("stops for an idle timer and a running break", () => {
        expect(
            focusIntent({ mode: "focus", endAt: null }, null),
        ).toEqual({ kind: "stop" });
        expect(
            focusIntent({ mode: "break", endAt: 1000 }, null),
        ).toEqual({ kind: "stop" });
    });

    it("starts for a running focus with a fallback goal", () => {
        expect(
            focusIntent({ mode: "focus", endAt: 1000 }, null),
        ).toEqual({
            kind: "start",
            goal: "Study session",
            resourceUrls: [],
            endAt: 1000,
        });
    });

    it("uses the lesson goal and resources", () => {
        expect(
            focusIntent(
                { mode: "focus", endAt: 1000 },
                { goal: "  Kerning  ", resourceUrls: ["https://a.test"] },
            ),
        ).toEqual({
            kind: "start",
            goal: "Kerning",
            resourceUrls: ["https://a.test"],
            endAt: 1000,
        });
    });
});

describe("createFocusSync", () => {
    it("sends the first update even when it is a stop", () => {
        const { sent, sync } = makeSync();
        sync.update({ kind: "stop" });
        expect(sent).toEqual([{ kind: "stop" }]);
    });

    it("does not resend an unchanged intent", async () => {
        const { sent, statuses, sync } = makeSync();
        const start: FocusIntent = {
            kind: "start",
            goal: "g",
            resourceUrls: [],
            endAt: 60_000,
        };
        sync.update(start);
        sync.update(start);
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        sync.update({ kind: "stop" });
        sync.update({ kind: "stop" });
        await vi.waitFor(() => expect(statuses).toHaveLength(2));
        expect(sent).toHaveLength(2);
    });

    it("sends stop on pause and start on resume", async () => {
        const { sent, statuses, sync } = makeSync();
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        sync.update({ kind: "stop" });
        await vi.waitFor(() => expect(statuses).toHaveLength(2));
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 90_000 });
        await vi.waitFor(() => expect(statuses).toHaveLength(3));
        expect(sent.map((i) => i.kind)).toEqual(["start", "stop", "start"]);
    });

    it("derives durationSeconds from endAt at send time", () => {
        const { sent, sync } = makeSync(() => 10_000);
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 70_500 });
        expect(sent[0]).toEqual({
            kind: "start",
            goal: "g",
            resourceUrls: [],
            durationSeconds: 61,
        });
    });

    it("sends a stop instead when endAt already passed", () => {
        const { sent, sync } = makeSync(() => 80_000);
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 70_000 });
        expect(sent).toEqual([{ kind: "stop" }]);
    });

    it("coalesces updates while a request is in flight", async () => {
        const { sent, sync, hold } = makeSync();
        let release!: () => void;
        hold(new Promise<void>((resolve) => (release = resolve)));
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        sync.update({ kind: "start", goal: "h", resourceUrls: [], endAt: 70_000 });
        sync.update({ kind: "stop" });
        expect(sent).toHaveLength(1);
        release();
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1]).toEqual({ kind: "stop" });
    });

    it("reports unavailable when send rejects and keeps working", async () => {
        const statuses: ScreenTimeStatus[] = [];
        let fail = true;
        const send = (): Promise<ScreenTimeStatus> =>
            fail ? Promise.reject(new Error("down")) : Promise.resolve(READY);
        const sync = createFocusSync({
            send,
            onStatus: (status) => statuses.push(status),
            now: () => 0,
        });
        sync.update({ kind: "stop" });
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        expect(statuses[0]).toEqual({ kind: "unavailable" });
        fail = false;
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        await vi.waitFor(() => expect(statuses).toHaveLength(2));
        expect(statuses[1]).toEqual(READY);
    });

    it("release stops only after a start and re-arms the next update", async () => {
        const { sent, statuses, sync } = makeSync();
        sync.release();
        expect(sent).toHaveLength(0);
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        sync.release();
        await vi.waitFor(() => expect(sent).toHaveLength(2));
        expect(sent[1]).toEqual({ kind: "stop" });
        await vi.waitFor(() => expect(statuses).toHaveLength(2));
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 90_000 });
        await vi.waitFor(() => expect(sent).toHaveLength(3));
    });

    it("drops a queued start when released while a stop is in flight", async () => {
        const { sent, statuses, sync, hold } = makeSync();
        let resolve!: () => void;
        hold(new Promise<void>((done) => (resolve = done)));
        sync.update({ kind: "stop" });
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        sync.release();
        resolve();
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        await new Promise((done) => setTimeout(done, 0));
        expect(sent).toEqual([{ kind: "stop" }]);
    });

    it("lets a later stop replace a queued start", async () => {
        const { sent, statuses, sync, hold } = makeSync();
        let resolve!: () => void;
        hold(new Promise<void>((done) => (resolve = done)));
        sync.update({ kind: "stop" });
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        sync.update({ kind: "stop" });
        resolve();
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        await new Promise((done) => setTimeout(done, 0));
        expect(sent).toEqual([{ kind: "stop" }]);
    });

    it("never re-sends a period the user ended in screen time", async () => {
        const { sent, statuses, sync } = makeSync();
        const start = (goal: string, endAt: number): FocusIntent => ({
            kind: "start",
            goal,
            resourceUrls: [],
            endAt,
        });
        sync.update(start("g", 60_000));
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        sync.markEnded();
        sync.update(start("renamed", 60_000));
        await new Promise((done) => setTimeout(done, 0));
        expect(sent).toHaveLength(1);
        sync.update(start("g", 90_000));
        await vi.waitFor(() => expect(sent).toHaveLength(2));
    });

    it("bumps its version for each dispatch", async () => {
        const { statuses, sync } = makeSync();
        expect(sync.version()).toBe(0);
        sync.update({ kind: "stop" });
        expect(sync.version()).toBe(1);
        await vi.waitFor(() => expect(statuses).toHaveLength(1));
        sync.update({ kind: "start", goal: "g", resourceUrls: [], endAt: 60_000 });
        expect(sync.version()).toBe(2);
    });

    it("skips a start with under a minute left", async () => {
        const { sent, sync } = makeSync(() => 40_000);
        sync.update({
            kind: "start",
            goal: "g",
            resourceUrls: [],
            endAt: 70_000,
        });
        await new Promise((done) => setTimeout(done, 0));
        expect(sent).toHaveLength(0);
        expect(sync.version()).toBe(0);
    });

    it("clamps the duration to the screen time maximum", () => {
        const { sent, sync } = makeSync(() => 0);
        sync.update({
            kind: "start",
            goal: "g",
            resourceUrls: [],
            endAt: 50_000_000,
        });
        expect(sent[0]).toMatchObject({
            kind: "start",
            durationSeconds: 43_200,
        });
    });
});

describe("focusGoal", () => {
    it("collapses whitespace and falls back when blank", () => {
        expect(focusGoal("   ")).toBe("Study session");
        expect(focusGoal("  Kern   ing \n basics ")).toBe("Kern ing basics");
    });

    it("cuts long goals at a word boundary and marks them", () => {
        const separated = `${"A".repeat(150)} · ${"B".repeat(150)}`;
        expect(focusGoal(separated)).toBe(`${"A".repeat(150)}…`);
        const solid = focusGoal("x".repeat(250));
        expect(solid).toHaveLength(200);
        expect(solid.endsWith("…")).toBe(true);
        expect(focusGoal("short")).toBe("short");
    });

    it("rejects a requested duration under a minute", () => {
        expect(
            focusStartRequestSchema.safeParse({
                goal: "g",
                durationSeconds: 30,
                resourceUrls: [],
            }).success,
        ).toBe(false);
        expect(
            focusStartRequestSchema.safeParse({
                goal: "g",
                durationSeconds: 60,
                resourceUrls: [],
            }).success,
        ).toBe(true);
    });
});
