import { getScoutDb, newId, nowIso } from "./db";
import type { ScoutSource, ScoutSourceKind } from "./types";

interface SourceRow {
    id: string;
    kind: string;
    label: string;
    value: string;
    enabled: number;
    meta: string;
    last_checked_at: string | null;
    created_at: string;
}

const KINDS: ScoutSourceKind[] = ["youtube_channel", "site", "creator", "book"];

export function isSourceKind(value: unknown): value is ScoutSourceKind {
    return typeof value === "string" && KINDS.includes(value as ScoutSourceKind);
}

function toSource(row: SourceRow): ScoutSource {
    return {
        id: row.id,
        kind: row.kind as ScoutSourceKind,
        label: row.label,
        value: row.value,
        enabled: row.enabled === 1,
        lastCheckedAt: row.last_checked_at,
        createdAt: row.created_at,
    };
}

export function listSources(): ScoutSource[] {
    return (getScoutDb().prepare(`SELECT * FROM sources ORDER BY created_at`).all() as SourceRow[]).map(toSource);
}

export function listEnabledSources(kind?: ScoutSourceKind): ScoutSource[] {
    return listSources().filter((source) => source.enabled && (!kind || source.kind === kind));
}

export function addSource(input: { kind: ScoutSourceKind; label: string; value: string }): ScoutSource {
    const db = getScoutDb();
    const value = input.value.trim();
    const label = input.label.trim() || value;
    const existing = db.prepare(`SELECT * FROM sources WHERE kind = ? AND value = ?`).get(input.kind, value) as SourceRow | undefined;
    if (existing) return toSource(existing);

    const id = newId("src");
    db.prepare(
        `INSERT INTO sources (id, kind, label, value, enabled, meta, created_at) VALUES (?, ?, ?, ?, 1, '{}', ?)`,
    ).run(id, input.kind, label, value, nowIso());

    return toSource(db.prepare(`SELECT * FROM sources WHERE id = ?`).get(id) as SourceRow);
}

export function setSourceEnabled(id: string, enabled: boolean) {
    return getScoutDb().prepare(`UPDATE sources SET enabled = ? WHERE id = ?`).run(enabled ? 1 : 0, id).changes > 0;
}

export function removeSource(id: string) {
    return getScoutDb().prepare(`DELETE FROM sources WHERE id = ?`).run(id).changes > 0;
}

export function touchSource(id: string) {
    getScoutDb().prepare(`UPDATE sources SET last_checked_at = ? WHERE id = ?`).run(nowIso(), id);
}

/**
 * Accepts a bare @handle, a full channel URL or a channel id and returns the
 * canonical channel id when one is already present.
 */
export function normalizeChannelValue(input: string): string {
    const value = input.trim();
    const direct = value.match(/^UC[\w-]{20,}$/);
    if (direct) return value;

    const channelUrl = value.match(/youtube\.com\/channel\/(UC[\w-]+)/i);
    if (channelUrl) return channelUrl[1];

    return value;
}
