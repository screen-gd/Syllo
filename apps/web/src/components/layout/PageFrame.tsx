import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One shared page skeleton: the title starts at the same spot on every page,
 * the header keeps one height and one hairline, and the body sits in a 76rem
 * frame centred in the main column. Loading and loaded states render the same
 * frame so nothing shifts when data arrives. `width="reading"` narrows only
 * the body (Settings uses it); the header keeps the full frame width.
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
        <div className="sy-page">
            <header className="sy-page-head">
                <div className="sy-frame-title">
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actions && <div className="sy-head-actions">{actions}</div>}
            </header>
            <div
                className={cn(
                    "sy-frame-body",
                    width === "reading" && "sy-frame-reading",
                )}
            >
                {children}
            </div>
        </div>
    );
}
