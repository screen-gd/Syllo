import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
"flex min-h-[140px] w-full rounded-[10px] border border-[#2e2e2e] bg-surface px-3 py-2.5 text-sm text-text transition-[border-color] placeholder:text-text-soft hover:border-[#4a4a4a] focus:border-[#4a4a4a] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                {...props}
            />
        );
    },
);
Textarea.displayName = "Textarea";

export { Textarea };
