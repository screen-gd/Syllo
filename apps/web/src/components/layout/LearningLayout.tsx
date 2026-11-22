import { useEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import PageTransition from "@/components/syllo/PageTransition";
import LearningSidebar from "./LearningSidebar";

/**
 * The studio frame: the app sidebar beside the page column every studio route renders into. Below lg the window
 * scrolls the page column. At lg the frame is one dark surface: the sidebar sits on it and the page column becomes a
 * rounded bordered panel that fills the rest of the window and scrolls itself.
 */
export default function LearningLayout({ children }: { children: ReactNode }) {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const main = useRef<HTMLElement>(null);
    useEffect(() => {
        main.current?.scrollTo(0, 0);
    }, [pathname]);
    return (
        <div className="min-h-dvh bg-page lg:flex lg:h-dvh lg:overflow-hidden lg:bg-frame">
            <LearningSidebar />
            <main
                ref={main}
                id="main-content"
                className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:my-2 lg:me-2 lg:min-h-0 lg:overflow-y-auto lg:rounded-panel lg:border lg:border-line-faint lg:bg-page lg:px-8 lg:pb-12 lg:pt-6"
            >
                <PageTransition routeKey={pathname}>{children}</PageTransition>
            </main>
        </div>
    );
}
