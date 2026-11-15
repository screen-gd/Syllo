import type { ReactNode } from "react";
import { cn } from "@/lib/glaze/utils";

/**
 * One shared page skeleton: the title starts at the same spot on every page,
 * the header keeps one height and one hairline, and the body sits in a
 * centred column with 16px between its blocks. `width="reading"` narrows the
 * whole frame, header included (Settings and Create use it).
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
                "mx-auto w-full min-w-0",
                width === "reading" ? "max-w-3xl" : "max-w-256",
            )}
        >
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line-faint pb-4">
                <div className="min-w-0">
                    <h1 className="type-title">{title}</h1>
                    {subtitle && (
                        <p className="mt-1 type-body-sm text-text-2">
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
            <div className="flex min-w-0 flex-col gap-4">{children}</div>
        </div>
    );
}
