import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Neutral controls; reserve the inverted primary for the main action. */
const buttonVariants = cva(
    "sy-action inline-flex items-center justify-center gap-2 whitespace-normal rounded-md text-sm font-medium transition-[border-color,color,opacity] disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "border border-text bg-text text-page hover:border-[#e6e6e6] hover:bg-[#e6e6e6]",
                secondary:
                    "border border-border-strong bg-transparent text-text hover:border-[#555555] hover:bg-surface-subtle",
                ghost: "border border-transparent text-text-muted hover:text-text",
                destructive:
                    "border border-danger/40 bg-transparent text-danger hover:border-danger hover:bg-danger-soft",
                outline:
                    "border border-border-strong bg-transparent text-text hover:border-[#555555] hover:bg-surface-subtle",
            },
            size: {
                default: "min-h-10 px-4 py-2",
                sm: "min-h-9 px-3 py-1.5 text-[13px]",
                lg: "min-h-11 px-5 py-2.5",
                icon: "min-h-10 w-10 shrink-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                data-variant={variant ?? "default"}
                data-size={size ?? "default"}
                ref={ref}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";

export { Button, buttonVariants };
