import { useState, type ReactNode } from "react";

/**
 * Fades a page in with a 4px rise when the route changes (styles/syllo.css, page-enter). The first page renders as
 * the server sent it, with no entrance, so nothing is hidden before hydration and the markup matches.
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
        <div key={routeKey} className={routeKey === firstKey ? undefined : "page-enter"}>
            {children}
        </div>
    );
}
