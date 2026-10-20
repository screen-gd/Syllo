import type { SrsItem } from "@/types";
import { listDueSrsItems, upsertSrsItems } from "@/lib/server/store";

export async function saveSrsItems(items: SrsItem[]) {
    if (items.length === 0) return [];
    upsertSrsItems(items);
    return items;
}

export async function getDueSrsItems(limit = 20): Promise<SrsItem[]> {
    return listDueSrsItems(limit);
}
