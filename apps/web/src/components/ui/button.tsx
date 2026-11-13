import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Neutral controls; reserve the inverted primary for the main action. */
const buttonVariants = cva(
    "sy-action inline-flex items-center justify-center gap-2 whitespace-normal rounded-md text-sm font-medium transition-[color,opacity] disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default: "",
                secondary: "",
                ghost: "text-text-muted hover:text-text",
                destructive: "text-danger hover:bg-danger-soft",
                outline: "",
            },
            size: {
                default: "min-h-10 px-4 py-2",
                sm: "min-h-9 px-3 py-1.5 text-[0.8125rem]",
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
