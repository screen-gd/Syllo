"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { usePathname } from "@/lib/router-nav";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { MARKETING_NAV_ITEMS } from "@/lib/navigation";

/** Top bar for the public pages. The studio uses `StudioSidebar` instead. */
export default function Header() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    return (
        <header className="sticky top-0 z-50 border-b border-border bg-page">
            <div className="page-shell-wide flex h-14 items-center justify-between gap-4">
                <Link to="/" className="flex min-w-0 items-center gap-2.5">
                    <Logo />
                    <span className="truncate text-[15px] font-semibold tracking-tight text-text">RoadMap Studio</span>
                </Link>

                <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
                    {MARKETING_NAV_ITEMS.map((item) => {
                        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "rounded-full px-3 py-1.5 text-sm transition-colors",
                                    active ? "text-text" : "text-[#bbbbbb] hover:text-text",
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="hidden lg:block">
                    <Link to="/dashboard" className="button-primary">
                        Open studio
                    </Link>
                </div>

                <button
                    type="button"
                    onClick={() => setMobileOpen((value) => !value)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:text-text lg:hidden"
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileOpen}
                    aria-controls="mobile-nav"
                >
                    {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>

            {mobileOpen && (
                <div id="mobile-nav" className="border-t border-border bg-page lg:hidden">
                    <nav aria-label="Mobile navigation" className="page-shell-wide flex flex-col gap-1 py-4">
                        {MARKETING_NAV_ITEMS.map((item) => {
                            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn("py-2 text-sm", active ? "text-text" : "text-[#bbbbbb] hover:text-text")}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                        <Link to="/dashboard" className="button-primary mt-3 self-start">
                            Open studio
                        </Link>
                    </nav>
                </div>
            )}
        </header>
    );
}
