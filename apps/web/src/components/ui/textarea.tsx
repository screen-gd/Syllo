import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
    return (
        <textarea
            ref={ref}
            className={cn(
                "sy-control flex min-h-24 min-w-0 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-soft focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
});
Textarea.displayName = "Textarea";

export { Textarea };
