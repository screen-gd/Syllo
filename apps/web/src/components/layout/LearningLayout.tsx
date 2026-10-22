import type { ReactNode } from "react";
import LearningSidebar from "./LearningSidebar";

export default function LearningLayout({ children }: { children: ReactNode }) {
    return (
        <div className="sy-app">
            <LearningSidebar />
            <main id="main-content" className="sy-main">
                {children}
            </main>
        </div>
    );
}
