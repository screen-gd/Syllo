import type { ReactNode } from "react";
import LearningSidebar from "./LearningSidebar";

/** The studio frame: the app sidebar beside the page column every studio route renders into. */
export default function LearningLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-dvh bg-page lg:flex">
            <LearningSidebar />
            <main
                id="main-content"
                className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-5 lg:px-11 lg:pb-18 lg:pt-9"
            >
                {children}
            </main>
        </div>
    );
}
