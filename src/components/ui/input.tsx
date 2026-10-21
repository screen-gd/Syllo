import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => {
    return (
        <input
            ref={ref}
            className={cn(
"flex h-10 w-full rounded-[10px] border border-[#2e2e2e] bg-surface px-3 text-sm text-text transition-[border-color] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-soft hover:border-[#4a4a4a] focus:border-[#4a4a4a] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        />
    );
});
Input.displayName = "Input";

export { Input };
