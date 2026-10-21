import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pill buttons. `default` is the inverted white primary; use one per screen. */
const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[background-color,border-color,color,opacity] disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "border border-text bg-text text-page hover:border-[#e6e6e6] hover:bg-[#e6e6e6]",
                secondary: "border border-border-strong bg-transparent text-text hover:border-[#555555] hover:bg-surface-subtle",
                ghost: "border border-transparent text-text-muted hover:text-text",
                destructive: "border border-danger/40 bg-transparent text-danger hover:border-danger hover:bg-danger-soft",
                outline: "border border-border-strong bg-transparent text-text hover:border-[#555555] hover:bg-surface-subtle",
            },
            size: {
                default: "h-9 px-4",
                sm: "h-8 px-3 text-[13px]",
                lg: "h-10 px-5",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
