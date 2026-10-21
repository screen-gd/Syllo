import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import schema from "./schema.sql?raw";

export type ScoutDatabase = Database.Database;

const globalKey = Symbol.for("syllo.scout.db");

type GlobalWithDb = typeof globalThis & {
    [globalKey]?: { db: ScoutDatabase; path: string };
};

export function getScoutDbPath() {
    return resolve(process.env.SCOUT_DB_PATH?.trim() || join(process.cwd(), ".data", "syllo.db"));
}

/**
 * One SQLite file for the whole app.
 *
 * The connection is cached on globalThis because the dev server reloads
 * modules on every edit; opening a fresh handle each time leaks file locks.
 */
export function getScoutDb(): ScoutDatabase {
    const path = getScoutDbPath();
    const store = globalThis as GlobalWithDb;
    const cached = store[globalKey];
    if (cached?.path === path) return cached.db;

    mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(schema);
    seedDefaults(db);

    store[globalKey] = { db, path };
    return db;
}

export function closeScoutDb() {
    const store = globalThis as GlobalWithDb;
    const cached = store[globalKey];
    if (!cached) return;
    cached.db.close();
    delete store[globalKey];
}

function seedDefaults(db: ScoutDatabase) {
    db.prepare(
        `INSERT OR IGNORE INTO scout_settings (id, auto_check, paused, monthly_budget_cents, updated_at)
         VALUES (1, 1, 0, 500, ?)`,
    ).run(new Date().toISOString());

    // First run only. A learner who deletes every source keeps it that way.
    const seeded = db.prepare(`SELECT value FROM scout_kv WHERE key = 'seeded_sources'`).get() as
        | { value: string }
        | undefined;
    if (seeded) return;

    const now = new Date().toISOString();
    const seeds: Array<[string, string, string]> = [
        ["youtube_channel", "Juxtopposed", "@juxtopposed"],
        ["youtube_channel", "DesignCourse", "@DesignCourse"],
        ["youtube_channel", "Kevin Powell", "@KevinPowell"],
        ["site", "MDN Web Docs", "developer.mozilla.org"],
        ["site", "web.dev", "web.dev"],
    ];

    const insert = db.prepare(
        `INSERT OR IGNORE INTO sources (id, kind, label, value, enabled, meta, created_at)
         VALUES (?, ?, ?, ?, 1, '{}', ?)`,
    );

    db.transaction(() => {
        for (const [kind, label, value] of seeds) {
            insert.run(newId("src"), kind, label, value, now);
        }
        db.prepare(`INSERT INTO scout_kv (key, value) VALUES ('seeded_sources', '1')`).run();
    })();
}

export function nowIso() {
    return new Date().toISOString();
}

export function newId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
