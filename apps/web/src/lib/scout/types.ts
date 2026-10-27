/**
 * Shared Scout types.
 *
 * Everything here is plain data so it can cross the API boundary. The raw
 * transcript never leaves the server: `ScoutResource` deliberately has no
 * transcript field.
 */

import type { LearningLevel } from "@/types";

export type ScoutSourceKind = "youtube_channel" | "site" | "creator" | "book";

export interface ScoutSource {
    id: string;
    kind: ScoutSourceKind;
    label: string;
    value: string;
    enabled: boolean;
    lastCheckedAt?: string | null;
    createdAt: string;
}

export type ResourceKind = "video" | "article" | "doc" | "book";

export type TranscriptStatus = "pending" | "ok" | "unavailable" | "skipped";

export interface Chapter {
    startSeconds: number;
    endSeconds?: number | null;
    title: string;
    url: string;
    /** True when the chapter list was suggested by the model, not supplied by the creator. */
    suggested?: boolean;
}

export interface KeyPoint {
    text: string;
    atSeconds?: number | null;
    quote?: string | null;
}

export interface ScoutResource {
    id: string;
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
    summary?: string | null;
    level?: LearningLevel | null;
    keyPoints: KeyPoint[];
    skillTags: string[];
    chapters: Chapter[];
    transcriptStatus: TranscriptStatus;
    transcriptChars: number;
    error?: string | null;
    createdAt: string;
    updatedAt: string;
    /** Per-pack selection, only present when the resource is read through a pack. */
    approved?: boolean;
    approvedAt?: string | null;
}

export type PackStatus = "discovering" | "processing" | "review" | "building" | "ready" | "failed";

export interface ScoutPack {
    id: string;
    goal: string;
    status: PackStatus;
    progress: number;
    stage: string;
    picks: string[];
    roadmapId?: string | null;
    costCents: number;
    error?: string | null;
    createdAt: string;
    updatedAt: string;
    resources: ScoutResource[];
}

export interface ScoutSettings {
    autoCheck: boolean;
    paused: boolean;
    monthlyBudgetCents: number;
    lastAutoCheckOn?: string | null;
}

export interface SpendSummary {
    monthCents: number;
    budgetCents: number;
    packCents: number;
}

export interface ScoutDigest {
    weekOf: string;
    newResources: number;
    minutesWatched: number;
    tasksCompleted: number;
    reviewDue: number;
    headline: string;
    highlights: Array<{ title: string; url: string; skill?: string }>;
}

export interface ScoutAgentStatus {
    id: "opencode" | "codex" | "claude";
    label: string;
    available: boolean;
    version?: string | null;
    command?: string | null;
}

export interface ScoutAgentConnection {
    id: ScoutAgentStatus["id"] | "chatgpt";
    label: string;
    file: string;
    snippet: string;
    note: string;
}

export type JobKind = "discover" | "process_resource" | "build_workspace" | "auto_check";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobRow {
    id: string;
    kind: JobKind;
    status: JobStatus;
    payload: string;
    result: string | null;
    error: string | null;
    attempts: number;
    max_attempts: number;
    run_after: string;
    locked_at: string | null;
    created_at: string;
    updated_at: string;
}
