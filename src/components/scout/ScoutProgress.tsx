import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
    { number: 1, label: "Set a goal" },
    { number: 2, label: "Approve picks" },
    { number: 3, label: "Roadmap" },
] as const;

interface ScoutProgressProps {
    /** 1 = goal, 2 = finding/approving, 3 = building/ready. */
    step: 1 | 2 | 3;
    detail?: string;
}

export default function ScoutProgress({ step, detail }: ScoutProgressProps) {
    return (
        <div className="border-b border-border pb-5">
            <ol className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {STEPS.map((item) => {
                    const done = item.number < step;
                    const active = item.number === step;

                    return (
                        <li key={item.number} className="flex items-center gap-2.5">
                            <span
                                aria-hidden="true"
                                className={cn(
"flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors",
                                    done && "border-text bg-text text-page",
                                    active && "border-text text-text",
                                    !done && !active && "border-border-strong text-text-soft",
                                )}
                            >
                                {done ? <Check size={13} strokeWidth={3} /> : item.number}
                            </span>
                            <span
                                className={cn(
"text-[13px]",
                                    active ? "text-[var(--color-text)]" : "text-[var(--color-text-soft)]",
                                )}
                            >
                                {item.label}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {detail ? <p className="mt-3 text-xs text-[var(--color-text-muted)]">{detail}</p> : null}
        </div>
    );
}
