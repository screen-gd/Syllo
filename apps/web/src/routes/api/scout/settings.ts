import { createFileRoute } from "@tanstack/react-router";
import { readJsonBody, scoutFailure, scoutJson, scoutReady } from "@/lib/scout/http";
import { latestPack } from "@/lib/scout/pack";
import { getScoutSettings, updateScoutSettings } from "@/lib/scout/settings";
import { monthSpendCents } from "@/lib/scout/spend";

function spendSummary() {
    const settings = getScoutSettings();
    const pack = latestPack();
    return {
        monthCents: monthSpendCents(),
        budgetCents: settings.monthlyBudgetCents,
        packCents: pack?.costCents ?? 0,
    };
}

export const Route = createFileRoute("/api/scout/settings")({
    server: {
        handlers: {
            GET: async () => {
                scoutReady();

                try {
                    return scoutJson({ success: true, settings: getScoutSettings(), spend: spendSummary() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not read its settings");
                }
            },
            PATCH: async ({ request }) => {
                scoutReady();

                try {
                    const body = await readJsonBody<{
                        autoCheck?: unknown;
                        paused?: unknown;
                        monthlyBudgetCents?: unknown;
                    }>(request);

                    const patch: {
                        autoCheck?: boolean;
                        paused?: boolean;
                        monthlyBudgetCents?: number;
                    } = {};

                    if (typeof body?.autoCheck === "boolean") patch.autoCheck = body.autoCheck;
                    if (typeof body?.paused === "boolean") patch.paused = body.paused;
                    if (typeof body?.monthlyBudgetCents === "number" && Number.isFinite(body.monthlyBudgetCents)) {
                        patch.monthlyBudgetCents = Math.max(0, Math.min(100_000, Math.round(body.monthlyBudgetCents)));
                    }

                    return scoutJson({ success: true, settings: updateScoutSettings(patch), spend: spendSummary() });
                } catch (error) {
                    return scoutFailure(error, "Scout could not save its settings");
                }
            },
        },
    },
});
