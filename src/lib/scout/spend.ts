import { getScoutDb, newId, nowIso } from "./db";

/**
 * Published list prices in USD per million tokens. These are estimates for
 * the cost meter, not billing. Override with SCOUT_PRICE_* env vars when a
 * provider changes pricing.
 */
const PRICES: Record<string, { input: number; output: number }> = {
    deepseek: { input: 0.28, output: 0.42 },
    gemini: { input: 0.1, output: 0.4 },
    openai: { input: 2.5, output: 10 },
    groq: { input: 0.59, output: 0.79 },
    openrouter: { input: 0.4, output: 1.6 },
};

export interface SpendInput {
    packId?: string | null;
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
}

export function estimateCostCents(input: SpendInput): number {
    const price = PRICES[input.provider] ?? PRICES.deepseek;
    const usd =
        ((input.inputTokens ?? 0) * price.input + (input.outputTokens ?? 0) * price.output) / 1_000_000;
    return Math.round(usd * 100 * 10_000) / 10_000;
}

export function recordSpend(input: SpendInput) {
    const cost = estimateCostCents(input);
    const db = getScoutDb();

    db.prepare(
        `INSERT INTO spend_log (id, pack_id, provider, model, input_tokens, output_tokens, cost_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
        newId("spend"),
        input.packId ?? null,
        input.provider,
        input.model,
        input.inputTokens ?? 0,
        input.outputTokens ?? 0,
        cost,
        nowIso(),
    );

    if (input.packId) {
        db.prepare(`UPDATE packs SET cost_cents = cost_cents + ?, updated_at = ? WHERE id = ?`).run(cost, nowIso(), input.packId);
    }

    return cost;
}

function monthStartIso(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function monthSpendCents(now = new Date()) {
    const row = getScoutDb()
        .prepare(`SELECT COALESCE(SUM(cost_cents), 0) AS cents FROM spend_log WHERE created_at >= ?`)
        .get(monthStartIso(now)) as { cents: number };
    return row.cents;
}

export function packSpendCents(packId: string) {
    const row = getScoutDb().prepare(`SELECT cost_cents FROM packs WHERE id = ?`).get(packId) as { cost_cents: number } | undefined;
    return row?.cost_cents ?? 0;
}

export function hasBudget(monthlyBudgetCents: number, now = new Date()) {
    if (monthlyBudgetCents <= 0) return true;
    return monthSpendCents(now) < monthlyBudgetCents;
}
