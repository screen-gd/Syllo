import { createFileRoute, Outlet } from "@tanstack/react-router";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

export const Route = createFileRoute("/_marketing")({
    component: MarketingLayout,
});

function MarketingLayout() {
    return (
        <div className="min-h-screen bg-page text-text">
            <Header />
            <main id="main-content">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
