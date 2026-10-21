PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    payload TEXT NOT NULL DEFAULT '{}',
    result TEXT,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    run_after TEXT NOT NULL,
    locked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_claim ON jobs (status, run_after);

CREATE TABLE IF NOT EXISTS packs (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'discovering',
    progress INTEGER NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'Discovering free resources',
    picks TEXT NOT NULL DEFAULT '[]',
    roadmap_id TEXT,
    roadmap TEXT,
    quizzes TEXT,
    cost_cents REAL NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    creator TEXT,
    duration_seconds INTEGER,
    published_at TEXT,
    thumbnail_url TEXT,
    description TEXT,
    summary TEXT,
    key_points TEXT NOT NULL DEFAULT '[]',
    skill_tags TEXT NOT NULL DEFAULT '[]',
    chapters TEXT NOT NULL DEFAULT '[]',
    transcript TEXT,
    transcript_status TEXT NOT NULL DEFAULT 'pending',
    transcript_chars INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS resources_url ON resources (url);

CREATE TABLE IF NOT EXISTS pack_resources (
    pack_id TEXT NOT NULL REFERENCES packs (id) ON DELETE CASCADE,
    resource_id TEXT NOT NULL REFERENCES resources (id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    selected INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (pack_id, resource_id)
);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    meta TEXT NOT NULL DEFAULT '{}',
    last_checked_at TEXT,
    created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sources_kind_value ON sources (kind, value);

CREATE TABLE IF NOT EXISTS scout_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    auto_check INTEGER NOT NULL DEFAULT 1,
    paused INTEGER NOT NULL DEFAULT 0,
    monthly_budget_cents INTEGER NOT NULL DEFAULT 500,
    last_auto_check_on TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spend_log (
    id TEXT PRIMARY KEY,
    pack_id TEXT,
    provider TEXT,
    model TEXT,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost_cents REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS spend_month ON spend_log (created_at);

CREATE TABLE IF NOT EXISTS channel_cache (
    channel_id TEXT PRIMARY KEY,
    uploads_playlist_id TEXT NOT NULL,
    checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scout_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
