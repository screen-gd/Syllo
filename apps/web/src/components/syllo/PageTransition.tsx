import { useState, type ReactNode } from "react";
import { cn } from "@/lib/glaze/utils";

/**
 * Marks a page as just navigated to so styles/syllo.css can play the entrance (a staggered rise on pages with a
 * PageFrame, one block otherwise). The first page renders as the server sent it, with no entrance, so nothing is
 * hidden before hydration and the markup matches. At lg this wrapper also carries the page padding: the scrolling
 * panel above it stays padding-free so a sticky top bar can sit flush at the panel's edge.
 */
export default function PageTransition({
    routeKey,
    children,
}: {
    routeKey: string;
    children: ReactNode;
}) {
    const [firstKey] = useState(routeKey);
    return (
        <div
            key={routeKey}
            className={cn(
                "lg:px-8 lg:pb-12",
                routeKey !== firstKey && "page-enter",
            )}
        >
            {children}
        </div>
    );
}
