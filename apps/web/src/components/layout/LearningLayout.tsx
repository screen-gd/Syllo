import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import PageTransition from "@/components/syllo/PageTransition";
import LearningSidebar from "./LearningSidebar";

/** The studio frame: the app sidebar beside the page column every studio route renders into. */
export default function LearningLayout({ children }: { children: ReactNode }) {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    return (
        <div className="min-h-dvh bg-page lg:flex">
            <LearningSidebar />
            <main
                id="main-content"
                className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10"
            >
                <PageTransition routeKey={pathname}>{children}</PageTransition>
            </main>
        </div>
    );
}
