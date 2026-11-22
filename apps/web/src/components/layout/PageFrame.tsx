import type { ReactNode } from "react";
import { cn } from "@/lib/glaze/utils";
import { useScrolled } from "@/hooks/useScrolled";
import { useStudioScroll } from "./LearningLayout";

/**
 * One shared page skeleton: the title starts at the same spot on every page,
 * the header keeps one height and one hairline, and the body sits in a
 * column with 16px between its blocks. Below lg the frame is a centred column
 * and the header shows title and subtitle together. At lg the frame fills the
 * content panel and the header becomes a 48px top bar (`material-bar-lg`, a
 * translucent material tinted from --page whose hairline appears once content
 * scrolls under it) that sticks flush to the panel's top and bleeds across it.
 * The subtitle moves to the first line of the body, and `width="reading"`
 * narrows the body only (Settings and Create use it).
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
    const barScrolled = useScrolled({
        container: useStudioScroll() ?? undefined,
    });
    return (
        <div
            className={cn(
                "mx-auto w-full min-w-0 lg:max-w-none",
                width === "reading" ? "max-w-3xl" : "max-w-256",
            )}
        >
            <header
                data-slot="page-bar"
                data-scrolled={barScrolled || undefined}
                className="material-bar-lg mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line-faint pb-4 lg:sticky lg:top-0 lg:z-(--z-sticky) lg:-mx-8 lg:h-12 lg:flex-nowrap lg:items-center lg:px-8 lg:py-0"
            >
                <div className="min-w-0">
                    <h1
                        data-slot="page-title"
                        className="type-title lg:type-heading-sm"
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-1 type-body-sm text-text-2 lg:hidden">
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && (
                    <div
                        data-slot="page-actions"
                        className="flex flex-wrap items-center gap-2"
                    >
                        {actions}
                    </div>
                )}
            </header>
            <div
                data-slot="page-body"
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
