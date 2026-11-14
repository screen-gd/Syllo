import { createFileRoute, Outlet } from "@tanstack/react-router";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export const Route = createFileRoute("/_marketing")({
    component: MarketingLayout,
});

function MarketingLayout() {
    return (
        <div className="min-h-dvh bg-page text-text-1">
            <Header />
            <main id="main-content">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
