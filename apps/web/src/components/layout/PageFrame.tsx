import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One shared page skeleton: the title starts at the same spot on every page,
 * the header keeps one height and one hairline, and the body sits in a
 * centred column. `width="reading"` narrows only the body (Settings uses
 * it); the header keeps the full width.
 */
export default function PageFrame({
    title,
    subtitle,
    actions,
    width = "wide",
    glazed = false,
    children,
}: {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
    width?: "wide" | "reading";
    // glazed screens opt out of the data-legacy island so Glaze controls inside
    // them stay shielded from the legacy stylesheets.
    glazed?: boolean;
    children: ReactNode;
}) {
    return (
        <div data-glaze className="mx-auto w-full min-w-0 max-w-256">
            <header className="relative mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-line-faint pb-4">
                <div className="min-w-0">
                    <h1 className="type-title">{title}</h1>
                    {subtitle && (
                        <p className="mt-1.5 type-body-sm text-text-2">
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && (
                    <div
                        data-legacy={glazed ? undefined : ""}
                        className="flex flex-wrap gap-2"
                    >
                        {actions}
                    </div>
                )}
            </header>
            <div
                data-legacy={glazed ? undefined : ""}
                className={cn("min-w-0", width === "reading" && "max-w-3xl")}
            >
                {children}
            </div>
        </div>
    );
}
