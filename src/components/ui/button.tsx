import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-none text-[12px] font-semibold uppercase tracking-[0.14em] transition-[background-color,border-color,color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(22,20,17,0.18)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-page)] active:scale-[0.985]",
    {
        variants: {
            variant: {
                default:
                    "border border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-page)] hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]",
                secondary:
                    "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-accent-soft)]",
                ghost: "border-b border-transparent px-0 text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:bg-transparent hover:text-[var(--color-text)]",
                destructive:
                    "border border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-page)] hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-accent-strong)]",
                outline:
                    "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-accent-soft)]",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 px-3",
                lg: "h-11 px-6",
                icon: "h-10 w-10",
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
