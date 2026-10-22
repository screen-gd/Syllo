import type { CoachingSession, PrivacySettings, ProgressSnapshot, Roadmap, SrsItem } from "@/types";

export const LOCAL_USER_ID = "local";

export type CreditLedgerRow = {
    user_id: string;
    plan_id: string;
    allowance: number;
    used: number;
    reset_at: string;
    updated_at?: string;
};

export type CreditTransactionRow = {
    id: string;
    kind: string;
    amount: number;
    created_at: string;
    metadata?: Record<string, string>;
};

const roadmaps = new Map<string, Roadmap>();
const srsItems = new Map<string, SrsItem>();
const ledgers = new Map<string, CreditLedgerRow>();
let creditTransactions: CreditTransactionRow[] = [];
let coachingSessions: CoachingSession[] = [];
let progressSnapshots: ProgressSnapshot[] = [];
let privacySettings: PrivacySettings | null = null;

export function listStoredRoadmaps(): Roadmap[] {
    return [...roadmaps.values()].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
}

export function getStoredRoadmap(id: string): Roadmap | undefined {
    return roadmaps.get(id);
}

export function upsertStoredRoadmap(roadmap: Roadmap) {
    roadmaps.set(roadmap.id, roadmap);
}

export function setStoredRoadmapPublic(id: string, isPublic: boolean) {
    const roadmap = roadmaps.get(id);
    if (!roadmap) return false;
    roadmaps.set(id, { ...roadmap, isPublic, updatedAt: new Date().toISOString() });
    return true;
}

export function incrementStoredForkCount(id: string) {
    const roadmap = roadmaps.get(id);
    if (!roadmap) return;
    roadmaps.set(id, { ...roadmap, forkCount: (roadmap.forkCount ?? 0) + 1 });
}

export function unpublishAllStoredRoadmaps() {
    for (const [id, roadmap] of roadmaps) {
        if (roadmap.isPublic) {
            roadmaps.set(id, { ...roadmap, isPublic: false });
        }
    }
}

export function listDueSrsItems(limit: number): SrsItem[] {
    const now = new Date().toISOString();
    return [...srsItems.values()]
        .filter((item) => item.dueAt <= now)
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
        .slice(0, limit);
}

export function upsertSrsItems(items: SrsItem[]) {
    for (const item of items) {
        srsItems.set(item.id, item);
    }
}

export function getStoredLedger(userId: string): CreditLedgerRow | undefined {
    return ledgers.get(userId);
}

export function setStoredLedger(userId: string, ledger: CreditLedgerRow) {
    ledgers.set(userId, ledger);
}

export function listStoredTransactions(limit: number): CreditTransactionRow[] {
    return creditTransactions.slice(-limit).reverse();
}

export function pushStoredTransaction(transaction: CreditTransactionRow) {
    creditTransactions.push(transaction);
}

export function listStoredCoachingSessions(roadmapId?: string): CoachingSession[] {
    return coachingSessions
        .filter((session) => !roadmapId || session.roadmapId === roadmapId)
        .sort((a, b) => b.date.localeCompare(a.date));
}

export function pushStoredCoachingSession(session: CoachingSession) {
    coachingSessions = [session, ...coachingSessions];
}

export function getStoredPrivacySettings(): PrivacySettings | null {
    return privacySettings;
}

export function setStoredPrivacySettings(settings: PrivacySettings) {
    privacySettings = settings;
}

export function listStoredProgressSnapshots(since?: string): ProgressSnapshot[] {
    const filtered = since ? progressSnapshots.filter((s) => s.createdAt >= since) : progressSnapshots;
    return [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function resetServerStore() {
    roadmaps.clear();
    srsItems.clear();
    ledgers.clear();
    creditTransactions = [];
    coachingSessions = [];
    progressSnapshots = [];
    privacySettings = null;
}
