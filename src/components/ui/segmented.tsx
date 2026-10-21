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
 * The selected option is a raised neutral pill, never the accent.
 */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
    return (
        <div role="radiogroup" aria-label={label} className={cn("inline-flex h-9 items-center gap-0.5 rounded-full bg-surface p-1", className)}>
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
                            "h-7 rounded-full px-3 text-[13px] transition-colors",
                            selected ? "bg-raised text-text" : "text-text-soft hover:text-text",
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
