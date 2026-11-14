"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { usePathname } from "@/lib/router-nav";
import { Button } from "@/components/glaze/ui/button";
import { Close, Icon, Menu } from "@/components/glaze/icon";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV_ITEMS } from "@/lib/navigation";

/** Top bar for the public pages. The studio uses `LearningSidebar` instead. */
export default function Header() {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    return (
        <header className="sticky top-0 z-sticky border-b border-line-faint bg-paper">
            <div className="page-shell-wide flex h-14 items-center justify-between gap-4">
                <Link to="/" className="flex min-w-0 items-center gap-2.5">
                    <Logo />
                    <span className="truncate type-label-lg text-text-1">Syllo</span>
                </Link>

                <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
                    {PUBLIC_NAV_ITEMS.map((item) => {
                        const active = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "type-label rounded-pill px-3 py-1.5 transition-colors",
                                    active ? "text-text-1" : "text-text-2 hover:text-text-1",
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="hidden lg:block">
                    <Button render={<Link to="/dashboard" />} nativeButton={false}>
                        Open studio
                    </Button>
                </div>

                <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setMobileOpen((value) => !value)}
                    className="lg:hidden"
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileOpen}
                    aria-controls="mobile-nav"
                >
                    <Icon icon={mobileOpen ? Close : Menu} size={16} />
                </Button>
            </div>

            {mobileOpen && (
                <div id="mobile-nav" className="border-t border-line-faint bg-page lg:hidden">
                    <nav aria-label="Mobile navigation" className="page-shell-wide flex flex-col gap-1 py-4">
                        {PUBLIC_NAV_ITEMS.map((item) => {
                            const active = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "py-2 type-label",
                                        active ? "text-text-1" : "text-text-2 hover:text-text-1",
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                        <Button
                            className="mt-3 self-start"
                            render={<Link to="/dashboard" />}
                            nativeButton={false}
                        >
                            Open studio
                        </Button>
                    </nav>
                </div>
            )}
        </header>
    );
}
