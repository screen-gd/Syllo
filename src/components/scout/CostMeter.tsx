import { formatCents } from "@/lib/scout/api-client";
import { cn } from "@/lib/utils";

interface CostMeterProps {
    monthCents: number;
    budgetCents: number;
    packCents?: number;
    className?: string;
}

/** Estimated Scout spend against the learner's monthly budget. */
export default function CostMeter({ monthCents, budgetCents, packCents = 0, className }: CostMeterProps) {
    const hasBudget = budgetCents > 0;
    const percent = hasBudget ? Math.min(100, Math.round((monthCents / budgetCents) * 100)) : 0;
    const nearLimit = hasBudget && percent >= 80;

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-soft)]">Monthly cost</span>
                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-text)]">{formatCents(monthCents)}</span>
                    {hasBudget ? ` / ${formatCents(budgetCents)}` : " / no cap"}
                </span>
            </div>

            <div className="h-1.5 overflow-hidden border border-[var(--color-border)] bg-black/40">
                <div
                    className={cn(
                        "h-full transition-[width] duration-700",
                        nearLimit ? "bg-amber-400" : "bg-[var(--color-accent)]",
                    )}
                    style={{ width: hasBudget ? `${Math.max(percent, monthCents > 0 ? 2 : 0)}%` : "0%" }}
                />
            </div>

            <p className="text-[11px] leading-5 text-[var(--color-text-soft)]">
                {packCents > 0 ? `This pack: ${formatCents(packCents)}. ` : ""}
                Estimated from published token prices, not a bill.
            </p>
        </div>
    );
}
