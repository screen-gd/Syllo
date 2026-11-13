import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SPRING } from "@/components/shared/motion";

interface SegmentedProps<T extends string> {
    label: string;
    value: T;
    options: readonly { key: T; label: string }[];
    onChange: (value: T) => void;
    className?: string;
}

/**
 * A row of mutually exclusive options on one track, as wide as its options.
 * Options wrap when space is tight and share the app's neutral control styles.
 */
export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
    className,
}: SegmentedProps<T>) {
    const groupId = useId();
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                "sy-segmented inline-flex max-w-full flex-wrap items-center gap-1 rounded-md bg-surface p-1",
                className,
            )}
        >
            {options.map((option) => {
                const selected = option.key === value;
                return (
                    <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(option.key)}
                        className={cn(
                            "relative min-h-8 rounded px-3 py-1 text-[0.8125rem] transition-colors",
                            selected
                                ? "text-text"
                                : "text-text-soft hover:text-text",
                        )}
                    >
                        {selected && (
                            <motion.span
                                layoutId={`seg-${groupId}`}
                                className="absolute inset-0 rounded border border-border bg-surface"
                                transition={SPRING}
                            />
                        )}
                        <span className="relative">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
