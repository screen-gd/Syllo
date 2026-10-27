import { LEARNING_LEVELS, type LearningLevel, type Roadmap, type SrsItem } from "@/types";
import { getScoutDb, newId, nowIso } from "./db";
import type { Chapter, KeyPoint, PackStatus, ResourceKind, ScoutPack, ScoutResource, TranscriptStatus } from "./types";

export interface PackRow {
    id: string;
    goal: string;
    status: PackStatus;
    progress: number;
    stage: string;
    picks: string;
    roadmap_id: string | null;
    roadmap: string | null;
    quizzes: string | null;
    cost_cents: number;
    error: string | null;
    created_at: string;
    updated_at: string;
}

export interface ResourceRow {
    id: string;
    kind: ResourceKind;
    source: string;
    external_id: string | null;
    url: string;
    title: string;
    creator: string | null;
    duration_seconds: number | null;
    published_at: string | null;
    thumbnail_url: string | null;
    description: string | null;
    summary: string | null;
    level: string | null;
    key_points: string;
    skill_tags: string;
    chapters: string;
    transcript: string | null;
    transcript_status: TranscriptStatus;
    transcript_chars: number;
    content_hash: string | null;
    error: string | null;
    created_at: string;
    updated_at: string;
}

function parseLevel(value: string | null): LearningLevel | null {
    return LEARNING_LEVELS.find((level) => level === value) ?? null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export function toScoutResource(row: ResourceRow, approved?: boolean): ScoutResource {
    return {
        id: row.id,
        kind: row.kind,
        source: row.source,
        externalId: row.external_id,
        url: row.url,
        title: row.title,
        creator: row.creator,
        durationSeconds: row.duration_seconds,
        publishedAt: row.published_at,
        thumbnailUrl: row.thumbnail_url,
        description: row.description,
        summary: row.summary,
        level: parseLevel(row.level),
        keyPoints: parseJson<KeyPoint[]>(row.key_points, []),
        skillTags: parseJson<string[]>(row.skill_tags, []),
        chapters: parseJson<Chapter[]>(row.chapters, []),
        transcriptStatus: row.transcript_status,
        transcriptChars: row.transcript_chars,
        error: row.error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(approved === undefined ? {} : { approved }),
    };
}

export function getPackRow(id: string): PackRow | null {
    return (getScoutDb().prepare(`SELECT * FROM packs WHERE id = ?`).get(id) as PackRow | undefined) ?? null;
}

export function getResourceRow(id: string): ResourceRow | null {
    return (getScoutDb().prepare(`SELECT * FROM resources WHERE id = ?`).get(id) as ResourceRow | undefined) ?? null;
}

export function findResourceByUrl(url: string): ResourceRow | null {
    return (getScoutDb().prepare(`SELECT * FROM resources WHERE url = ?`).get(url) as ResourceRow | undefined) ?? null;
}

export function packResourceRows(packId: string): ResourceRow[] {
    return getScoutDb()
        .prepare(
            `SELECT r.* FROM resources r
             JOIN pack_resources pr ON pr.resource_id = r.id
             WHERE pr.pack_id = ?
             ORDER BY pr.position, r.created_at`,
        )
        .all(packId) as ResourceRow[];
}

function packResourceRowsWithSelection(packId: string): Array<ResourceRow & { selected: number }> {
    return getScoutDb()
        .prepare(
            `SELECT r.*, pr.selected FROM resources r
             JOIN pack_resources pr ON pr.resource_id = r.id
             WHERE pr.pack_id = ?
             ORDER BY pr.position, r.created_at`,
        )
        .all(packId) as Array<ResourceRow & { selected: number }>;
}

export function toScoutPack(row: PackRow): ScoutPack {
    const picks = parseJson<string[]>(row.picks, []);
    const resources = packResourceRowsWithSelection(row.id).map((resource) =>
        toScoutResource(resource, picks.includes(resource.id)),
    );

    return {
        id: row.id,
        goal: row.goal,
        status: row.status,
        progress: row.progress,
        stage: row.stage,
        picks,
        roadmapId: row.roadmap_id,
        costCents: Math.round(row.cost_cents * 100) / 100,
        error: row.error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resources,
    };
}

export function getPack(id: string): ScoutPack | null {
    const row = getPackRow(id);
    return row ? toScoutPack(row) : null;
}

export function getPackRoadmap(id: string): Roadmap | null {
    const row = getPackRow(id);
    if (!row) return null;
    return parseJson<Roadmap | null>(row.roadmap, null);
}

export function getPackQuizzes(id: string): SrsItem[] {
    const row = getPackRow(id);
    if (!row) return [];
    return parseJson<SrsItem[]>(row.quizzes, []);
}

/** The shape the pack endpoint returns. Transcripts are never included. */
export interface ScoutPackDetail extends ScoutPack {
    roadmap: Roadmap | null;
    quizzes: SrsItem[];
}

export function getPackDetail(id: string): ScoutPackDetail | null {
    const row = getPackRow(id);
    if (!row) return null;
    return {
        ...toScoutPack(row),
        roadmap: parseJson<Roadmap | null>(row.roadmap, null),
        quizzes: parseJson<SrsItem[]>(row.quizzes, []),
    };
}

export function createPack(goal: string): ScoutPack {
    const db = getScoutDb();
    const id = newId("pack");
    const now = nowIso();
    db.prepare(
        `INSERT INTO packs (id, goal, status, progress, stage, picks, created_at, updated_at)
         VALUES (?, ?, 'discovering', 0, 'Looking for free resources', '[]', ?, ?)`,
    ).run(id, goal.trim(), now, now);

    return toScoutPack(getPackRow(id) as PackRow);
}

export interface PackPatch {
    status?: PackStatus;
    progress?: number;
    stage?: string;
    error?: string | null;
    picks?: string[];
    roadmapId?: string | null;
    roadmap?: Roadmap | null;
    quizzes?: SrsItem[] | null;
}

export function updatePack(id: string, patch: PackPatch) {
    const fields: string[] = [];
    const values: unknown[] = [];

    const add = (column: string, value: unknown) => {
        fields.push(`${column} = ?`);
        values.push(value);
    };

    if (patch.status !== undefined) add("status", patch.status);
    if (patch.progress !== undefined) add("progress", Math.max(0, Math.min(100, Math.round(patch.progress))));
    if (patch.stage !== undefined) add("stage", patch.stage);
    if (patch.error !== undefined) add("error", patch.error);
    if (patch.picks !== undefined) add("picks", JSON.stringify(patch.picks));
    if (patch.roadmapId !== undefined) add("roadmap_id", patch.roadmapId);
    if (patch.roadmap !== undefined) add("roadmap", patch.roadmap ? JSON.stringify(patch.roadmap) : null);
    if (patch.quizzes !== undefined) add("quizzes", patch.quizzes ? JSON.stringify(patch.quizzes) : null);

    if (fields.length === 0) return;

    fields.push("updated_at = ?");
    values.push(nowIso(), id);
    getScoutDb().prepare(`UPDATE packs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function failPack(id: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "Scout stopped unexpectedly");
    updatePack(id, {
        status: "failed",
        stage: "Scout hit a problem",
        progress: 100,
        error: message.slice(0, 2000),
    });
}

/**
 * Upserts a discovered resource by URL. Re-running a pack reuses the earlier
 * extraction, so the learner is not charged twice for the same video.
 */
export function upsertDiscoveredResource(item: {
    kind: ResourceKind;
    source: string;
    externalId?: string | null;
    url: string;
    title: string;
    creator?: string | null;
    durationSeconds?: number | null;
    publishedAt?: string | null;
    thumbnailUrl?: string | null;
    description?: string | null;
}): ResourceRow {
    const db = getScoutDb();
    const now = nowIso();
    const id = newId("res");

    const row = db
        .prepare(
            `INSERT INTO resources (
                id, kind, source, external_id, url, title, creator, duration_seconds,
                published_at, thumbnail_url, description, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(url) DO UPDATE SET
                kind = excluded.kind,
                source = excluded.source,
                external_id = COALESCE(excluded.external_id, resources.external_id),
                title = excluded.title,
                creator = COALESCE(excluded.creator, resources.creator),
                duration_seconds = COALESCE(excluded.duration_seconds, resources.duration_seconds),
                published_at = COALESCE(excluded.published_at, resources.published_at),
                thumbnail_url = COALESCE(excluded.thumbnail_url, resources.thumbnail_url),
                description = COALESCE(excluded.description, resources.description),
                updated_at = excluded.updated_at
             RETURNING *`,
        )
        .get(
            id,
            item.kind,
            item.source,
            item.externalId ?? null,
            item.url,
            item.title,
            item.creator ?? null,
            item.durationSeconds ?? null,
            item.publishedAt ?? null,
            item.thumbnailUrl ?? null,
            item.description ?? null,
            now,
            now,
        ) as ResourceRow;

    return row;
}

export function attachResourceToPack(packId: string, resourceId: string, position: number) {
    getScoutDb()
        .prepare(
            `INSERT INTO pack_resources (pack_id, resource_id, position, selected)
             VALUES (?, ?, ?, 1)
             ON CONFLICT(pack_id, resource_id) DO UPDATE SET position = excluded.position`,
        )
        .run(packId, resourceId, position);
}

export function isResourceInPack(packId: string, resourceId: string) {
    const row = getScoutDb()
        .prepare(`SELECT 1 AS ok FROM pack_resources WHERE pack_id = ? AND resource_id = ?`)
        .get(packId, resourceId) as { ok: number } | undefined;
    return Boolean(row);
}

/** Approving picks is idempotent; only resources already in the pack survive. */
export function approvePackPicks(packId: string, picks: string[]): string[] {
    const allowed = new Set(packResourceRows(packId).map((row) => row.id));
    const accepted = [...new Set(picks.filter((id) => allowed.has(id)))];

    const db = getScoutDb();
    db.transaction(() => {
        db.prepare(`UPDATE pack_resources SET selected = 0 WHERE pack_id = ?`).run(packId);
        const select = db.prepare(`UPDATE pack_resources SET selected = 1 WHERE pack_id = ? AND resource_id = ?`);
        for (const id of accepted) select.run(packId, id);
        updatePack(packId, { picks: accepted });
    })();

    return accepted;
}

export interface ExtractionWrite {
    summary: string;
    level?: LearningLevel | null;
    keyPoints: KeyPoint[];
    skillTags: string[];
    chapters: Chapter[];
    transcript?: string | null;
    transcriptStatus: TranscriptStatus;
    transcriptChars: number;
    durationSeconds?: number | null;
    error?: string | null;
}

export function saveResourceExtraction(id: string, data: ExtractionWrite) {
    getScoutDb()
        .prepare(
            `UPDATE resources SET
                summary = ?, level = ?, key_points = ?, skill_tags = ?, chapters = ?,
                transcript = COALESCE(?, transcript),
                transcript_status = ?, transcript_chars = ?,
                duration_seconds = COALESCE(?, duration_seconds),
                error = ?, updated_at = ?
             WHERE id = ?`,
        )
        .run(
            data.summary,
            data.level ?? null,
            JSON.stringify(data.keyPoints),
            JSON.stringify(data.skillTags),
            JSON.stringify(data.chapters),
            data.transcript ?? null,
            data.transcriptStatus,
            data.transcriptChars,
            data.durationSeconds ?? null,
            data.error ?? null,
            nowIso(),
            id,
        );
}

export function setResourceError(id: string, error: string | null) {
    getScoutDb().prepare(`UPDATE resources SET error = ?, updated_at = ? WHERE id = ?`).run(error, nowIso(), id);
}

export function recentPacks(limit = 8): ScoutPack[] {
    const rows = getScoutDb()
        .prepare(`SELECT * FROM packs ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as PackRow[];
    return rows.map(toScoutPack);
}

export function latestPack(): ScoutPack | null {
    return recentPacks(1)[0] ?? null;
}

export function latestGoal(): string | null {
    const row = getScoutDb()
        .prepare(`SELECT goal FROM packs ORDER BY created_at DESC LIMIT 1`)
        .get() as { goal: string } | undefined;
    return row?.goal ?? null;
}

export function countPackResources(packId: string) {
    const row = getScoutDb()
        .prepare(`SELECT COUNT(*) AS count FROM pack_resources WHERE pack_id = ?`)
        .get(packId) as { count: number };
    return row.count;
}

export function countUnprocessedPackResources(packId: string) {
    const row = getScoutDb()
        .prepare(
            `SELECT COUNT(*) AS count FROM resources r
             JOIN pack_resources pr ON pr.resource_id = r.id
             WHERE pr.pack_id = ? AND r.summary IS NULL AND r.transcript_status = 'pending'`,
        )
        .get(packId) as { count: number };
    return row.count;
}

/** True when every resource in the pack has been processed (or failed softly). */
export function packProcessingFinished(packId: string) {
    const row = getScoutDb()
        .prepare(
            `SELECT COUNT(*) AS count FROM resources r
             JOIN pack_resources pr ON pr.resource_id = r.id
             WHERE pr.pack_id = ? AND r.summary IS NULL AND r.error IS NULL`,
        )
        .get(packId) as { count: number };
    return row.count === 0;
}
