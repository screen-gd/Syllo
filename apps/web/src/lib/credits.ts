import type { CreditTransaction } from "@/types";

export const PLAN_CREDITS = {
    free: 10,
    pro: 500,
    agency: 2000,
} as const;

export type CreditKind = CreditTransaction["kind"];

export const CREDIT_COSTS: Record<CreditKind, number> = {
    workspace_generation: 10,
    module_regeneration: 3,
    quiz: 2,
    export_pdf: 1,
    review: 4,
    adjustment: 0,
};

export function getPlanAllowance(planId: string) {
    if (planId === "pro" || planId === "agency") {
        return PLAN_CREDITS[planId];
    }

    return PLAN_CREDITS.free;
}

export function firstOfNextMonth(from = new Date()) {
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

export function maybeResetCredits<T extends { plan_id: string; allowance: number; used: number; reset_at: string }>(
    ledger: T,
    now = new Date(),
) {
    if (new Date(ledger.reset_at) > now) {
        return ledger;
    }

    return {
        ...ledger,
        allowance: getPlanAllowance(ledger.plan_id),
        used: 0,
        reset_at: firstOfNextMonth(now).toISOString(),
    };
}
