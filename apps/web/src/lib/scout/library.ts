import { getScoutDb, nowIso } from "./db";
import { normalizeSkill } from "./extract";
import { findResourceByUrl, toScoutResource, upsertDiscoveredResource, type ResourceRow } from "./pack";
import type { Chapter, ResourceKind, ScoutResource } from "./types";

function parseSkills(values: string[] | string | undefined): string[] {
    const raw = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
    const cleaned: string[] = [];
    for (const value of raw) {
        const skill = normalizeSkill(value);
        if (skill && !cleaned.includes(skill)) cleaned.push(skill);
    }
    return cleaned.slice(0, 6);
}

function inferKind(url: string, requested?: ResourceKind): ResourceKind {
    if (requested) return requested;
    if (/youtu\.be|youtube\.com\/(?:watch|shorts)/i.test(url)) return "video";
    if (/\.pdf(?:$|\?)/i.test(url)) return "doc";
    return "article";
}

function slugify(value: string) {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "book"
    );
}

function youtubeId(url: string) {
    return (
        url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ??
        url.match(/youtube\.com\/watch\?.*v=([\w-]{6,})/)?.[1] ??
        url.match(/youtube\.com\/shorts\/([\w-]{6,})/)?.[1] ??
        null
    );
}

/**
 * Manual additions never trigger fetching. They are library entries the
 * learner chose; a later pack can still process a link if needed.
 */
export function addManualResource(input: {
    url?: string | null;
    kind?: ResourceKind;
    title?: string | null;
    creator?: string | null;
    note?: string | null;
    skills?: string[] | string;
    outline?: string[];
}): ScoutResource {
    const rawUrl = input.url?.trim() || "";
    const kind = inferKind(rawUrl, input.kind);

    if (rawUrl && !/^https?:\/\//i.test(rawUrl) && kind !== "book") {
        throw new Error("Add a full http(s) URL");
    }

    const url = rawUrl || `book://${slugify(input.title ?? "book")}-${Date.now().toString(36)}`;
    const existing = findResourceByUrl(url);
    const externalId = kind === "video" ? youtubeId(url) : null;

    const row = upsertDiscoveredResource({
        kind,
        source: kind === "book" ? "shelf" : "manual",
        externalId,
        url,
        title: input.title?.trim() || existing?.title || (kind === "book" ? "Untitled book" : url),
        creator: input.creator?.trim() || existing?.creator || null,
        description: existing?.description ?? null,
        durationSeconds: existing?.duration_seconds ?? null,
        publishedAt: existing?.published_at ?? null,
        thumbnailUrl: existing?.thumbnail_url ?? null,
    });

    const skills = parseSkills(input.skills);
    const chapters: Chapter[] =
        kind === "book" && input.outline?.length
            ? input.outline.map((title, index) => ({
                  startSeconds: index,
                  title: title.slice(0, 160),
                  url,
                  suggested: true,
              }))
            : (JSON.parse(row.chapters || "[]") as Chapter[]) ?? [];

    getScoutDb()
        .prepare(
            `UPDATE resources SET
                summary = COALESCE(?, summary, ?),
                skill_tags = ?,
                chapters = ?,
                transcript_status = CASE WHEN transcript_status = 'pending' THEN 'skipped' ELSE transcript_status END,
                updated_at = ?
             WHERE id = ?`,
        )
        .run(
            input.note?.trim() || null,
            kind === "book" ? "Added to your reading shelf." : "Saved for later.",
            JSON.stringify(skills.length > 0 ? skills : (JSON.parse(row.skill_tags || "[]") as string[])),
            JSON.stringify(chapters),
            nowIso(),
            row.id,
        );

    return toScoutResource(getScoutDb().prepare(`SELECT * FROM resources WHERE id = ?`).get(row.id) as ResourceRow);
}

export function listLibrary(input: { query?: string; kind?: ResourceKind | "all"; since?: string; limit?: number } = {}) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const query = input.query?.trim() ?? "";

    if (query) {
        clauses.push(`(title LIKE ? OR summary LIKE ? OR skill_tags LIKE ? OR creator LIKE ?)`);
        const like = `%${query.replace(/[%_]/g, "")}%`;
        values.push(like, like, like, like);
    }

    if (input.kind && input.kind !== "all") {
        clauses.push(`kind = ?`);
        values.push(input.kind);
    }

    if (input.since) {
        clauses.push(`updated_at >= ?`);
        values.push(input.since);
    }

    const limit = Math.min(200, Math.max(1, input.limit ?? 60));
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = getScoutDb()
        .prepare(`SELECT * FROM resources ${where} ORDER BY updated_at DESC LIMIT ?`)
        .all(...values, limit) as ResourceRow[];

    return rows.map((row) => toScoutResource(row));
}

/** Used by the MCP server and the Sources panel. */
export function searchLibrary(query: string, limit = 8): ScoutResource[] {
    const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.replace(/[^a-z0-9+#.-]/g, ""))
        .filter((token) => token.length > 1)
        .slice(0, 6);

    if (tokens.length === 0) return listLibrary({ limit });
    if (tokens.length === 1) return listLibrary({ query: tokens[0], limit });

    // Any token can match; the JS pass ranks by how many did.
    const likeClauses = tokens.map(() => `(title LIKE ? OR summary LIKE ? OR skill_tags LIKE ?)`).join(" OR ");
    const values = tokens.flatMap((token) => [`%${token}%`, `%${token}%`, `%${token}%`]);

    const rows = getScoutDb()
        .prepare(`SELECT * FROM resources WHERE ${likeClauses} ORDER BY updated_at DESC LIMIT ?`)
        .all(...values, Math.max(limit * 4, 24)) as ResourceRow[];

    return rows
        .map((row) => {
            const haystack = `${row.title} ${row.summary ?? ""} ${row.skill_tags} ${row.creator ?? ""}`.toLowerCase();
            const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
            return { row, score };
        })
        .sort((left, right) => right.score - left.score || right.row.updated_at.localeCompare(left.row.updated_at))
        .slice(0, limit)
        .map((entry) => toScoutResource(entry.row));
}

export function countResourcesSince(since: string) {
    const row = getScoutDb()
        .prepare(`SELECT COUNT(*) AS count FROM resources WHERE created_at >= ?`)
        .get(since) as { count: number };
    return row.count;
}

export function listBooks(): ScoutResource[] {
    return listLibrary({ kind: "book", limit: 50 });
}
