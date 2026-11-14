import type { ReactNode } from "react";
import LearningSidebar from "./LearningSidebar";
import BackgroundLayer from "@/components/shared/BackgroundLayer";

export default function LearningLayout({ children }: { children: ReactNode }) {
    return (
        <div className="sy-app">
            <BackgroundLayer />
            <LearningSidebar />
            <main id="main-content" className="sy-main">
                {children}
            </main>
        </div>
    );
}
