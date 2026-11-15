import { Progress } from "@/components/glaze/ui/progress";
import { formatCents } from "@/lib/scout/api-client";
import { cn } from "@/lib/glaze/utils";

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
        <div className={cn("flex flex-col gap-2", className)}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="type-caption text-text-2">Monthly cost</span>
                <span className="type-caption text-text-3">
                    <span className="text-text-1">{formatCents(monthCents)}</span>
                    {hasBudget ? ` / ${formatCents(budgetCents)}` : " / no cap"}
                </span>
            </div>

            <Progress
                mode="meter"
                size="sm"
                value={percent}
                status={nearLimit ? "warn" : undefined}
                aria-label="Monthly cost"
            />

            <p className="type-caption text-text-2">
                {packCents > 0 ? `This pack: ${formatCents(packCents)}. ` : ""}
                Estimated from published token prices, not a bill.
            </p>
        </div>
    );
}
