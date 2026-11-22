import type { ReactNode } from "react";
import { cn } from "@/lib/glaze/utils";

/**
 * One shared page skeleton: the title starts at the same spot on every page,
 * the header keeps one height and one hairline, and the body sits in a
 * column with 16px between its blocks. Below lg the frame is a centred column
 * and the header shows title and subtitle together. At lg the frame fills the
 * content panel, the header becomes a 48px top bar that is sticky and bleeds
 * across the panel, the subtitle moves to the first line of the body, and
 * `width="reading"` narrows the body only (Settings and Create use it).
 */
export default function PageFrame({
    title,
    subtitle,
    actions,
    width = "wide",
    children,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    width?: "wide" | "reading";
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                "mx-auto w-full min-w-0 lg:max-w-none",
                width === "reading" ? "max-w-3xl" : "max-w-256",
            )}
        >
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line-faint pb-4 lg:sticky lg:top-0 lg:z-(--z-sticky) lg:-mx-8 lg:-mt-6 lg:h-12 lg:flex-nowrap lg:items-center lg:bg-page lg:px-8 lg:pb-0">
                <div className="min-w-0">
                    <h1 className="type-title lg:type-heading-sm">{title}</h1>
                    {subtitle && (
                        <p className="mt-1 type-body-sm text-text-2 lg:hidden">
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </header>
            <div
                className={cn(
                    "flex min-w-0 flex-col gap-4",
                    width === "reading" && "lg:mx-auto lg:max-w-3xl",
                )}
            >
                {subtitle && (
                    <p className="hidden type-body-sm text-text-2 lg:block">
                        {subtitle}
                    </p>
                )}
                {children}
            </div>
        </div>
    );
}
