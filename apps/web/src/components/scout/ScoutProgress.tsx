import { Check, Icon } from "@/components/glaze/icon";
import { cn } from "@/lib/glaze/utils";

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
        <div className="border-b border-line-faint pb-4">
            <ol className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {STEPS.map((item) => {
                    const done = item.number < step;
                    const active = item.number === step;

                    return (
                        <li key={item.number} className="flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    "flex size-6 items-center justify-center rounded-full border type-caption",
                                    done && "border-ink bg-ink text-page",
                                    active && "border-ink text-text-1",
                                    !done && !active && "border-line-faint text-text-2",
                                )}
                            >
                                {done ? <Icon icon={Check} size={12} /> : item.number}
                            </span>
                            <span
                                className={
                                    active
                                        ? "type-body-sm text-text-1"
                                        : "type-body-sm text-text-2"
                                }
                            >
                                {item.label}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {detail ? <p className="mt-2 type-caption text-text-3">{detail}</p> : null}
        </div>
    );
}
