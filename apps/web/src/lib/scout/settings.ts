import { getScoutDb, nowIso } from "./db";
import type { ScoutSettings } from "./types";

interface SettingsRow {
    auto_check: number;
    paused: number;
    monthly_budget_cents: number;
    last_auto_check_on: string | null;
}

function readRow(): SettingsRow {
    return getScoutDb()
        .prepare(`SELECT auto_check, paused, monthly_budget_cents, last_auto_check_on FROM scout_settings WHERE id = 1`)
        .get() as SettingsRow;
}

export function getScoutSettings(): ScoutSettings {
    const row = readRow();
    return {
        autoCheck: row.auto_check === 1,
        paused: row.paused === 1,
        monthlyBudgetCents: row.monthly_budget_cents,
        lastAutoCheckOn: row.last_auto_check_on,
    };
}

export function updateScoutSettings(patch: Partial<ScoutSettings>): ScoutSettings {
    const current = getScoutSettings();
    const next: ScoutSettings = { ...current, ...patch };

    getScoutDb()
        .prepare(
            `UPDATE scout_settings SET auto_check = ?, paused = ?, monthly_budget_cents = ?, last_auto_check_on = ?, updated_at = ? WHERE id = 1`,
        )
        .run(
            next.autoCheck ? 1 : 0,
            next.paused ? 1 : 0,
            Math.max(0, Math.round(next.monthlyBudgetCents)),
            next.lastAutoCheckOn ?? null,
            nowIso(),
        );

    return next;
}

export function markAutoCheckScheduled(date: string) {
    getScoutDb()
        .prepare(`UPDATE scout_settings SET last_auto_check_on = ?, updated_at = ? WHERE id = 1`)
        .run(date, nowIso());
}

export function isScoutPaused() {
    return getScoutSettings().paused;
}
