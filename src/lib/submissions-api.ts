/* ═══════════════════════════════════════════════════════════
   ZNS Nexus Backend — Submissions API Contract
   ═══════════════════════════════════════════════════════════
   v1: All operations run on localStorage.
   v2: Replace fetch targets with ZNS Nexus backend URLs.

   ---------- ZNS NEXUS BACKEND CONTRACT ----------
   POST   /api/submissions/create       → Submit new work
   GET    /api/submissions/list         → Get all submissions (admin)
   GET    /api/submissions/mine         → Get current user's submissions
   PATCH  /api/submissions/:id/review   → Admin: approve / request revision + feedback
   ═══════════════════════════════════════════════════════════ */

import type { Submission } from "@/types";

const STORAGE_KEY = "zns:v1:submissions";

function readSubmissions(): Submission[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeSubmissions(subs: Submission[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subs));
    } catch {
        // quota exceeded or private browsing
    }
}

/**
 * Submit new work
 * TODO: ZNS Nexus backend → POST /api/submissions/create
 * Replace localStorage logic with:
 *   await fetch(`${BASE_URL}/api/submissions/create`, {
 *     method: "POST",
 *     headers: { Authorization: `Bearer ${AUTH_TOKEN}`, "Content-Type": "application/json" },
 *     body: JSON.stringify(submission),
 *   });
 */
export async function createSubmission(
    submission: Omit<Submission, "id" | "status" | "createdAt">
): Promise<Submission> {
    const newSub: Submission = {
        ...submission,
        id: crypto.randomUUID(),
        status: "submitted",
        createdAt: new Date().toISOString(),
    };
    const all = readSubmissions();
    all.unshift(newSub);
    writeSubmissions(all);
    return newSub;
}

/**
 * Get all submissions (admin view)
 * TODO: ZNS Nexus backend → GET /api/submissions/list
 */
export async function listAllSubmissions(): Promise<Submission[]> {
    return readSubmissions();
}

/**
 * Get current user's submissions
 * TODO: ZNS Nexus backend → GET /api/submissions/mine
 */
export async function listMySubmissions(userId?: string): Promise<Submission[]> {
    const all = readSubmissions();
    if (!userId) return all; // v1: return all since there's no auth
    return all.filter((s) => s.submittedBy === userId);
}

/**
 * Admin: approve or request revision with feedback
 * TODO: ZNS Nexus backend → PATCH /api/submissions/:id/review
 */
export async function reviewSubmission(
    id: string,
    action: "approved" | "revision",
    feedback: string
): Promise<Submission | null> {
    const all = readSubmissions();
    const idx = all.findIndex((s) => s.id === id);
    if (idx < 0) return null;

    all[idx] = {
        ...all[idx],
        status: action,
        feedback,
        reviewedAt: new Date().toISOString(),
    };
    writeSubmissions(all);
    return all[idx];
}
