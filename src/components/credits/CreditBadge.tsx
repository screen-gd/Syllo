"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import type { CreditStatus, CreditTransaction } from "@/types";

type CreditStatusResponse = {
    success: boolean;
    status?: CreditStatus;
    transactions?: CreditTransaction[];
};

/** Grey by default; white once the allowance is nearly spent. */
function getBadgeClasses(status: CreditStatus) {
    return status.remaining <= 5 ? "text-text" : "text-text-muted";
}

export default function CreditBadge({ compact = false }: { compact?: boolean }) {
    const [status, setStatus] = useState<CreditStatus | null>(null);

    useEffect(() => {
        let active = true;

        void fetch("/api/credits/status", { cache: "no-store" })
            .then(async (response) => {
                if (response.status === 401) return { success: false } satisfies CreditStatusResponse;
                if (!response.ok) return null;
                return (await response.json()) as CreditStatusResponse;
            })
            .then((payload) => {
                if (!active) return;
                if (!payload?.success || !payload.status) {
                    setStatus(null);
                    return;
                }
                setStatus(payload.status);
            })
            .catch(() => {
                if (active) setStatus(null);
            });

        return () => {
            active = false;
        };
    }, []);

    if (!status || status.allowance <= 0) return null;

    return (
        <div
            className={`inline-flex items-center gap-2 text-xs font-medium tabular-nums ${getBadgeClasses(status)}`}
            title={`${status.remaining} of ${status.allowance} credits remaining this cycle`}
        >
            <Coins size={compact ? 14 : 15} />
            <span>{compact ? `${status.remaining} left` : `${status.remaining} credits`}</span>
        </div>
    );
}
