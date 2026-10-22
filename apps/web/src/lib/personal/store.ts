import { useSyncExternalStore } from "react";
import {
    personalEntrySchema,
    personalSnapshotSchema,
    type PersonalEntry,
    type PersonalSnapshot,
} from "./schema";

export const PERSONAL_STORAGE_KEY = "syllo:personal:v1";
export const PERSONAL_CHANGE_EVENT = "syllo:personal-change";
const empty: PersonalSnapshot = {};
let cachedRaw: string | null = null;
let cached: PersonalSnapshot = empty;
const listeners = new Set<() => void>();

export function getPersonalSnapshot(): PersonalSnapshot {
    if (typeof localStorage === "undefined") return empty;
    const raw = localStorage.getItem(PERSONAL_STORAGE_KEY);
    if (raw === cachedRaw) return cached;
    try {
        const result = personalSnapshotSchema.safeParse(
            raw ? JSON.parse(raw) : {},
        );
        if (result.success) {
            cachedRaw = raw;
            cached = result.data;
        }
    } catch {
        /* A damaged file is kept intact so it can be exported for recovery. */
    }
    return cached;
}

function commit(records: PersonalSnapshot) {
    const raw = JSON.stringify(records);
    const previous = localStorage.getItem(PERSONAL_STORAGE_KEY);
    if (previous && previous !== cachedRaw)
        localStorage.setItem(`syllo:personal:recovery:${Date.now()}`, previous);
    localStorage.setItem(PERSONAL_STORAGE_KEY, raw);
    cachedRaw = raw;
    cached = records;
    listeners.forEach((listener) => listener());
    window.dispatchEvent(new Event(PERSONAL_CHANGE_EVENT));
}

export function putPersonalEntry(input: PersonalEntry) {
    const records = getPersonalSnapshot();
    const previous = records[input.id];
    const parsed = personalEntrySchema.parse({
        ...input,
        updatedAt: Math.max(Date.now(), (previous?.updatedAt ?? 0) + 1),
    });
    commit({ ...records, [parsed.id]: parsed });
}

/** Remote records only replace older versions. Deletions remain as tombstones. */
export function mergePersonalEntries(incoming: readonly PersonalEntry[]) {
    const records = { ...getPersonalSnapshot() };
    let changed = false;
    for (const candidate of incoming) {
        const item = personalEntrySchema.parse(candidate);
        if (!records[item.id] || records[item.id].updatedAt < item.updatedAt) {
            records[item.id] = item;
            changed = true;
        }
    }
    if (changed) commit(records);
}

export function removePersonalEntry(id: string) {
    const item = getPersonalSnapshot()[id];
    if (item) putPersonalEntry({ ...item, deleted: true });
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
        if (event.key === PERSONAL_STORAGE_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
    };
}

export function usePersonalData() {
    return useSyncExternalStore(subscribe, getPersonalSnapshot, () => empty);
}

export function personalEntries<K extends PersonalEntry["kind"]>(
    records: PersonalSnapshot,
    kind: K,
) {
    return Object.values(records).filter(
        (item): item is Extract<PersonalEntry, { kind: K }> =>
            item.kind === kind && !item.deleted,
    );
}
