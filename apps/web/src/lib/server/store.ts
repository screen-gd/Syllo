import type { SrsItem } from "@/types";

const srsItems = new Map<string, SrsItem>();

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
