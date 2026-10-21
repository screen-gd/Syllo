import type { ScoutPackDetail } from "./pack";
import type {
    ResourceKind,
    ScoutAgentConnection,
    ScoutAgentStatus,
    ScoutDigest,
    ScoutPack,
    ScoutResource,
    ScoutSettings,
    ScoutSource,
    ScoutSourceKind,
    SpendSummary,
} from "./types";

/**
 * Typed browser client for the Scout API. Every call returns the parsed JSON
 * envelope and turns `{ success: false }` into an Error with the server's
 * message, so views can show one consistent failure state.
 */

interface Envelope {
    success?: boolean;
    error?: string;
}

async function request<T extends Envelope>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
    });

    let payload: T | null = null;
    try {
        payload = (await response.json()) as T;
    } catch {
        payload = null;
    }

    if (!response.ok || !payload || payload.success === false) {
        throw new Error(payload?.error || `Scout request failed (${response.status})`);
    }

    return payload;
}

export interface ScoutStartInput {
    goal: string;
    provider?: string;
    model?: string;
    apiKey?: string;
}

export const scoutApi = {
    start(input: ScoutStartInput) {
        return request<{ success: true; pack: ScoutPack }>("/api/scout/start", {
            method: "POST",
            body: JSON.stringify(input),
        });
    },

    getPack(id: string) {
        return request<{ success: true; pack: ScoutPackDetail }>(`/api/scout/packs/${encodeURIComponent(id)}`);
    },

    approve(id: string, picks: string[]) {
        return request<{ success: true; pack: ScoutPackDetail }>(
            `/api/scout/packs/${encodeURIComponent(id)}/approve`,
            { method: "POST", body: JSON.stringify({ picks }) },
        );
    },

    recent() {
        return request<{ success: true; packs: ScoutPack[] }>("/api/scout/recent");
    },

    getSettings() {
        return request<{ success: true; settings: ScoutSettings; spend: SpendSummary }>("/api/scout/settings");
    },

    patchSettings(patch: Partial<Pick<ScoutSettings, "autoCheck" | "paused" | "monthlyBudgetCents">>) {
        return request<{ success: true; settings: ScoutSettings; spend: SpendSummary }>("/api/scout/settings", {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    },

    listSources() {
        return request<{ success: true; sources: ScoutSource[] }>("/api/scout/sources");
    },

    addSource(input: { kind: ScoutSourceKind; label?: string; value: string }) {
        return request<{ success: true; source: ScoutSource; sources: ScoutSource[] }>("/api/scout/sources", {
            method: "POST",
            body: JSON.stringify(input),
        });
    },

    toggleSource(id: string, enabled: boolean) {
        return request<{ success: true; sources: ScoutSource[] }>("/api/scout/sources", {
            method: "POST",
            body: JSON.stringify({ id, enabled }),
        });
    },

    removeSource(id: string) {
        return request<{ success: true; sources: ScoutSource[] }>(`/api/scout/sources?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
    },

    listResources(input: { q?: string; kind?: ResourceKind | "all"; limit?: number } = {}) {
        const params = new URLSearchParams();
        if (input.q) params.set("q", input.q);
        if (input.kind) params.set("kind", input.kind);
        if (input.limit) params.set("limit", String(input.limit));
        const query = params.toString();
        return request<{ success: true; resources: ScoutResource[]; books: ScoutResource[] }>(
            `/api/scout/resources${query ? `?${query}` : ""}`,
        );
    },

    addResource(input: {
        url?: string;
        title?: string;
        note?: string;
        skill?: string;
        kind?: "book";
        outline?: string[];
    }) {
        return request<{ success: true; resource: ScoutResource }>("/api/scout/resources", {
            method: "POST",
            body: JSON.stringify(input),
        });
    },

    getDigest() {
        return request<{ success: true; digest: ScoutDigest }>("/api/scout/digest");
    },

    getAgents() {
        return request<{ success: true; agents: ScoutAgentStatus[]; connections: ScoutAgentConnection[] }>(
            "/api/scout/agents",
        );
    },

    researchWithAgent(input: { goal: string; agent?: ScoutAgentStatus["id"] }) {
        return request<{
            success: true;
            agent: ScoutAgentStatus;
            resources: ScoutResource[];
            skipped: string[];
        }>("/api/scout/agents", { method: "POST", body: JSON.stringify(input) });
    },
};

/** Human formatting for the cost meter (costs are stored in US cents). */
export function formatCents(cents: number) {
    if (!Number.isFinite(cents) || cents <= 0) return "$0.00";
    const dollars = cents / 100;
    return `$${dollars < 1 ? dollars.toFixed(4) : dollars.toFixed(2)}`;
}
