import type { Roadmap, Section, SrsItem } from "@/types";

export const WORKSPACE_STATE_KEY = "zns:v2:workspace-state";

export interface WorkspaceVersion {
    versionNumber: number;
    createdAt: string;
    label: string;
    sections: Section[];
}

export interface LearningRecord {
    currentStreak: number;
    lastActivityDate: string | null;
    tasksByDate: Record<string, number>;
    unlockedBadges: Record<string, number>;
    sessionTimeMs: number;
    moduleTimeMs: Record<string, number>;
    moduleStartedAt: Record<string, number>;
}

interface WorkspaceState {
    roadmaps: Roadmap[];
    sessions: Record<string, Section[]>;
    versions: Record<string, WorkspaceVersion[]>;
    reviews: Record<string, SrsItem[]>;
    learning: LearningRecord;
}

export interface WorkspaceStateAdapter {
    read(): string | null;
    write(value: string): void;
    clear(): void;
}

export class BrowserWorkspaceStateAdapter implements WorkspaceStateAdapter {
    read() { return typeof localStorage === "undefined" ? null : localStorage.getItem(WORKSPACE_STATE_KEY); }
    write(value: string) { if (typeof localStorage !== "undefined") localStorage.setItem(WORKSPACE_STATE_KEY, value); }
    clear() { if (typeof localStorage !== "undefined") localStorage.removeItem(WORKSPACE_STATE_KEY); }
}

export class MemoryWorkspaceStateAdapter implements WorkspaceStateAdapter {
    private value: string | null = null;
    read() { return this.value; }
    write(value: string) { this.value = value; }
    clear() { this.value = null; }
}

function emptyLearningRecord(): LearningRecord {
    return { currentStreak: 0, lastActivityDate: null, tasksByDate: {}, unlockedBadges: {}, sessionTimeMs: 0, moduleTimeMs: {}, moduleStartedAt: {} };
}

function emptyState(): WorkspaceState {
    return { roadmaps: [], sessions: {}, versions: {}, reviews: {}, learning: emptyLearningRecord() };
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export class WorkspacePersistence {
    constructor(private readonly adapter: WorkspaceStateAdapter) {}

    private readState(): WorkspaceState {
        try {
            const raw = this.adapter.read();
            if (!raw) return emptyState();
            const parsed = JSON.parse(raw) as Partial<WorkspaceState>;
            return {
                roadmaps: Array.isArray(parsed.roadmaps) ? parsed.roadmaps : [],
                sessions: parsed.sessions ?? {},
                versions: parsed.versions ?? {},
                reviews: parsed.reviews ?? {},
                learning: { ...emptyLearningRecord(), ...(parsed.learning ?? {}) },
            };
        } catch {
            return emptyState();
        }
    }

    private writeState(state: WorkspaceState) { this.adapter.write(JSON.stringify(state)); }

    getRoadmaps() { return clone(this.readState().roadmaps); }
    getRoadmap(id: string) { return this.getRoadmaps().find((roadmap) => roadmap.id === id) ?? null; }

    saveRoadmap(roadmap: Roadmap) {
        const state = this.readState();
        const index = state.roadmaps.findIndex((item) => item.id === roadmap.id);
        if (index >= 0) state.roadmaps[index] = clone(roadmap);
        else state.roadmaps.unshift(clone(roadmap));
        this.writeState(state);
    }

    updateRoadmap(id: string, updates: Partial<Roadmap>) {
        const roadmap = this.getRoadmap(id);
        if (!roadmap) return;
        this.saveRoadmap({ ...roadmap, ...clone(updates), updatedAt: new Date().toISOString() });
    }

    deleteRoadmap(id: string) {
        const state = this.readState();
        state.roadmaps = state.roadmaps.filter((roadmap) => roadmap.id !== id);
        delete state.sessions[id];
        delete state.versions[id];
        delete state.reviews[id];
        this.writeState(state);
    }

    getWorkspace(id: string, session = false) {
        const roadmap = this.getRoadmap(id);
        if (!roadmap || !session) return roadmap;
        const sections = this.readState().sessions[id];
        return sections ? { ...roadmap, sections: clone(sections) } : roadmap;
    }

    saveSession(id: string, sections: Section[]) {
        const state = this.readState();
        state.sessions[id] = clone(sections);
        this.writeState(state);
    }

    getVersions(id: string) { return clone(this.readState().versions[id] ?? []); }

    saveVersion(workspace: Roadmap, now = new Date()) {
        const state = this.readState();
        const versions = state.versions[workspace.id] ?? [];
        const versionNumber = (versions.at(-1)?.versionNumber ?? 0) + 1;
        const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(now);
        const version = { versionNumber, createdAt: now.toISOString(), label: `v${versionNumber} · ${date}`, sections: clone(workspace.sections) };
        state.versions[workspace.id] = [...versions, version].slice(-5);
        this.writeState(state);
        return clone(version);
    }

    getReviews(id: string) { return clone(this.readState().reviews[id] ?? []); }
    saveReviews(id: string, items: SrsItem[]) { const state = this.readState(); state.reviews[id] = clone(items); this.writeState(state); }
    getLearningRecord() { return clone(this.readState().learning); }
    saveLearningRecord(record: LearningRecord) { const state = this.readState(); state.learning = clone(record); this.writeState(state); }
    exportJson() { return JSON.stringify(this.readState(), null, 2); }
    clearRoadmaps() { this.adapter.clear(); }
}

let browserPersistence: WorkspacePersistence | null = null;

export function getWorkspacePersistence() {
    if (!browserPersistence) browserPersistence = new WorkspacePersistence(new BrowserWorkspaceStateAdapter());
    return browserPersistence;
}
