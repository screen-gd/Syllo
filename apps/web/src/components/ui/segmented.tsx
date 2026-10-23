import { cn } from "@/lib/utils";

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
                            "min-h-8 rounded px-3 py-1 text-[13px] transition-colors",
                            selected
                                ? "bg-raised text-text"
                                : "text-text-soft hover:text-text",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
