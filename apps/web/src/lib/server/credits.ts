import type { CreditStatus, CreditTransaction } from "@/types";
import { CREDIT_COSTS, firstOfNextMonth, getPlanAllowance, maybeResetCredits, type CreditKind } from "@/lib/credits";
import { getEffectivePlanId } from "@/lib/billing";
import {
    getStoredLedger,
    listStoredTransactions,
    LOCAL_USER_ID,
    pushStoredTransaction,
    setStoredLedger,
    type CreditLedgerRow,
} from "@/lib/server/store";

function toStatus(ledger: CreditLedgerRow): CreditStatus {
    return {
        planId: ledger.plan_id,
        allowance: ledger.allowance,
        used: ledger.used,
        remaining: Math.max(0, ledger.allowance - ledger.used),
        resetDate: ledger.reset_at,
    };
}

function getOrCreateLedger(): CreditLedgerRow {
    const planId = getEffectivePlanId(null);
    const allowance = getPlanAllowance(planId);

    const base: CreditLedgerRow = getStoredLedger(LOCAL_USER_ID) ?? {
        user_id: LOCAL_USER_ID,
        plan_id: planId,
        allowance,
        used: 0,
        reset_at: firstOfNextMonth().toISOString(),
    };

    const normalized = maybeResetCredits({
        ...base,
        plan_id: planId,
        allowance,
    });

    setStoredLedger(LOCAL_USER_ID, normalized);
    return normalized;
}

export async function getCreditStatus(): Promise<CreditStatus> {
    return toStatus(getOrCreateLedger());
}

export async function listCreditTransactions(limit = 20): Promise<CreditTransaction[]> {
    return listStoredTransactions(limit).map((row) => ({
        id: row.id,
        kind: row.kind as CreditTransaction["kind"],
        amount: row.amount,
        createdAt: row.created_at,
        metadata: row.metadata,
    }));
}

export async function deductCredits(options: {
    kind: CreditKind;
    metadata?: Record<string, string>;
    amount?: number;
    userApiKey?: string | null;
}) {
    const amount = options.amount ?? CREDIT_COSTS[options.kind];
    if (options.userApiKey?.trim()) {
        return {
            charged: false,
            reason: "byok" as const,
            status: await getCreditStatus(),
        };
    }

    const ledger = getOrCreateLedger();
    if (amount <= 0) {
        return {
            charged: false,
            reason: "free_action" as const,
            status: toStatus(ledger),
        };
    }

    if (ledger.used + amount > ledger.allowance) {
        return {
            charged: false,
            reason: "insufficient" as const,
            status: toStatus(ledger),
        };
    }

    const nextUsed = ledger.used + amount;
    setStoredLedger(LOCAL_USER_ID, {
        ...ledger,
        used: nextUsed,
        updated_at: new Date().toISOString(),
    });

    pushStoredTransaction({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: options.kind,
        amount,
        created_at: new Date().toISOString(),
        metadata: options.metadata ?? {},
    });

    return {
        charged: true,
        reason: "deducted" as const,
        status: toStatus({ ...ledger, used: nextUsed }),
    };
}
