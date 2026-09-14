import type { ReactNode } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-page text-text">
            <Header />
            <main id="main-content">{children}</main>
            <Footer />
        </div>
    );
}
