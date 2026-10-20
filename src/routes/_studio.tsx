import { createFileRoute, Outlet } from "@tanstack/react-router";
import Header from "@/components/layout/Header";
import StudioSidebar from "@/components/layout/StudioSidebar";

export const Route = createFileRoute("/_studio")({
    component: StudioLayout,
});

function StudioLayout() {
    return (
        <div className="min-h-screen bg-page text-text">
            <Header />
            <div className="studio-layout-shell grid min-h-[calc(100vh-4rem)] gap-6 py-6 xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-8 xl:py-8 2xl:grid-cols-[19rem_minmax(0,1fr)]">
                <StudioSidebar />
                <main id="main-content" className="min-w-0 pb-4 xl:pb-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
