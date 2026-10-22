#!/usr/bin/env node
/**
 * Syllo Scout MCP server.
 *
 * Any MCP-capable agent (opencode, Codex, Claude) can run this file over stdio
 * to add links to the Scout library and search what is already there. It talks
 * to the same SQLite file as the app; there is no HTTP hop and no API key.
 *
 * Run: node mcp/server.mjs
 * Optional: SCOUT_DB_PATH=/absolute/path/syllo.db node mcp/server.mjs
 */
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const dbPath = resolve(process.env.SCOUT_DB_PATH?.trim() || resolve(repoRoot, ".data", "syllo.db"));

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(readFileSync(resolve(repoRoot, "src", "lib", "scout", "schema.sql"), "utf8"));

function nowIso() {
    return new Date().toISOString();
}

function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
    return (
        String(value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "resource"
    );
}

function youtubeId(url) {
    const match = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{11})/.exec(url);
    return match ? match[1] : null;
}

function inferKind(url) {
    if (youtubeId(url)) return "video";
    if (/\.pdf(?:$|[?#])/i.test(url)) return "doc";
    return "article";
}

function parseJsonArray(value) {
    try {
        const parsed = JSON.parse(value || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function toResource(row) {
    return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        url: row.url,
        creator: row.creator ?? null,
        summary: row.summary ?? null,
        skills: parseJsonArray(row.skill_tags),
        chapters: parseJsonArray(row.chapters).length,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function addResource({ url, title, note, skill }) {
    const cleanUrl = String(url ?? "").trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
        throw new Error("url must start with http:// or https://");
    }

    const existing = db.prepare("SELECT * FROM resources WHERE url = ?").get(cleanUrl);
    const now = nowIso();

    if (existing) {
        const skills = parseJsonArray(existing.skill_tags);
        if (skill) {
            const normalized = String(skill).trim().toLowerCase().slice(0, 60);
            if (normalized && !skills.includes(normalized)) skills.push(normalized);
        }
        db.prepare(
            `UPDATE resources SET
                summary = COALESCE(?, summary),
                skill_tags = ?,
                updated_at = ?
             WHERE id = ?`,
        ).run(note ? String(note).trim().slice(0, 400) : null, JSON.stringify(skills), now, existing.id);

        return { created: false, resource: toResource(db.prepare("SELECT * FROM resources WHERE id = ?").get(existing.id)) };
    }

    const id = newId("res");
    const kind = inferKind(cleanUrl);
    const skills = skill ? [String(skill).trim().toLowerCase().slice(0, 60)] : [];
    const cleanTitle = String(title ?? "").trim().slice(0, 200) || `${kind === "video" ? "Video" : "Link"} · ${slugify(cleanUrl)}`;

    db.prepare(
        `INSERT INTO resources (
            id, kind, source, external_id, url, title, creator, duration_seconds,
            published_at, thumbnail_url, description, summary, key_points, skill_tags,
            chapters, transcript, transcript_status, transcript_chars, content_hash,
            error, created_at, updated_at
        ) VALUES (?, ?, 'agent', ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, '[]', ?, '[]', NULL, 'skipped', 0, NULL, NULL, ?, ?)`,
    ).run(
        id,
        kind,
        kind === "video" ? youtubeId(cleanUrl) : null,
        cleanUrl,
        cleanTitle,
        note ? String(note).trim().slice(0, 400) : "Saved by an agent. Not read yet.",
        JSON.stringify(skills),
        now,
        now,
    );

    return { created: true, resource: toResource(db.prepare("SELECT * FROM resources WHERE id = ?").get(id)) };
}

function searchLibrary({ query, limit }) {
    const clean = String(query ?? "").trim();
    if (!clean) throw new Error("query is required");

    const like = `%${clean.replace(/[%_]/g, "")}%`;
    const max = Math.min(50, Math.max(1, Number(limit) || 20));
    const rows = db
        .prepare(
            `SELECT * FROM resources
             WHERE title LIKE ? OR summary LIKE ? OR skill_tags LIKE ? OR creator LIKE ?
             ORDER BY updated_at DESC
             LIMIT ?`,
        )
        .all(like, like, like, like, max);

    return { count: rows.length, resources: rows.map(toResource) };
}

const server = new McpServer({ name: "syllo-scout", version: "1.0.0" });

server.registerTool(
    "add_resource",
    {
        title: "Add a resource to Syllo Scout",
        description:
            "Save a free learning resource (video, article or doc) to the learner's Syllo Scout library. Use the exact public http(s) URL. Duplicate URLs are updated, not duplicated.",
        inputSchema: z.object({
            url: z.string().describe("Public http(s) URL of the resource"),
            title: z.string().max(200).optional().describe("Resource title"),
            note: z.string().max(400).optional().describe("One or two sentences on why it is useful"),
            skill: z.string().max(60).optional().describe("Skill this resource teaches, e.g. 'UI design'"),
        }),
    },
    async ({ url, title, note, skill }) => {
        const result = addResource({ url, title, note, skill });
        const verb = result.created ? "Saved" : "Updated";
        return {
            content: [
                {
                    type: "text",
                    text: `${verb}: ${result.resource.title}\n${result.resource.url}\nID: ${result.resource.id}`,
                },
            ],
            structuredContent: result,
        };
    },
);

server.registerTool(
    "search_library",
    {
        title: "Search the Syllo Scout library",
        description:
            "Search saved resources by title, summary, skill or creator. Use it before adding a link, and to build a reading or watching list from what the learner already has.",
        inputSchema: z.object({
            query: z.string().min(1).describe("Words to search for"),
            limit: z.number().int().min(1).max(50).optional().describe("Maximum results (default 20)"),
        }),
    },
    async ({ query, limit }) => {
        const result = searchLibrary({ query, limit });
        const text =
            result.count === 0
                ? `Nothing found for "${query}".`
                : result.resources
                      .map((resource) => `• ${resource.title}\n  ${resource.url}${resource.skills.length ? `\n  Skills: ${resource.skills.join(", ")}` : ""}`)
                      .join("\n\n");

        return {
            content: [{ type: "text", text }],
            structuredContent: result,
        };
    },
);

const transport = new StdioServerTransport();
await server.connect(transport);
