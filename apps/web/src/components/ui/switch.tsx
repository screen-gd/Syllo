import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        ref={ref}
        className={cn(
"peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-raised transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-text",
            className
        )}
        {...props}
    >
        <SwitchPrimitives.Thumb
            className={cn(
"pointer-events-none block h-3.5 w-3.5 rounded-full bg-text-muted ring-0 transition-transform data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-page data-[state=unchecked]:translate-x-0.5"
            )}
        />
    </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
