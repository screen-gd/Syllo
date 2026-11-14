import type { ReactNode } from "react";
import LearningSidebar from "./LearningSidebar";

// The sy-app class stays as the legacy style scope for screens not yet
// migrated; its grid moved to the utilities on this element.
export default function LearningLayout({ children }: { children: ReactNode }) {
    return (
        <div className="sy-app min-h-dvh bg-page lg:flex">
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
