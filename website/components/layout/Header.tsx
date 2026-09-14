"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNavigationItems } from "@/lib/navigation";

export default function Header() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const navItems = getNavigationItems(pathname);
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        const onScroll = () => {
            const threshold = isHome ? window.innerHeight * 0.55 : 8;
            setScrolled(window.scrollY > threshold);
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [isHome]);

    return (
        <header
            className={cn(
                "fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b",
                scrolled
                    ? "border-white/5 bg-black/50 backdrop-blur-md"
                    : "border-transparent bg-transparent"
            )}
        >
            <div className="page-shell-wide flex h-16 items-center justify-between gap-4">
                <Link href="/" className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center border border-white/10 rounded-lg bg-white/5 shadow-sm">
                        <Logo />
                    </span>
                    <span className="truncate font-display text-xl tracking-[-0.04em] bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-400">RoadMap Studio</span>
                </Link>

                <div className="hidden lg:flex flex-1 items-center justify-center max-w-md mx-6">
                    <div className="flex h-9 w-full max-w-[280px] items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-zinc-400 backdrop-blur-md hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group">
                        <span className="flex items-center gap-2">
                           <Search size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                           Search roadmaps...
                        </span>
                        <div className="flex gap-1">
                            <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] tracking-wider text-zinc-300 font-sans border border-white/5">⌘</kbd>
                            <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] tracking-wider text-zinc-300 font-sans border border-white/5">K</kbd>
                        </div>
                    </div>
                </div>

                <div className="hidden items-center gap-5 lg:flex">
                    <Link href="/create" passHref className="px-5 py-2 text-[12px] font-bold tracking-widest uppercase rounded bg-emerald-600 text-white shadow-lg hover:bg-emerald-500 hover:scale-[1.02] transition-all duration-300">
                        New Roadmap
                    </Link>
                </div>

                <Button
                    type="button"
                    onClick={() => setMobileOpen((value) => !value)}
                    variant="outline"
                    size="icon"
                    className="lg:hidden bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors"
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                    aria-expanded={mobileOpen}
                    aria-controls="mobile-nav"
                >
                    {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </Button>
            </div>

            {mobileOpen && (
                <div id="mobile-nav" className="border-t border-white/10 bg-zinc-950 lg:hidden">
                    <nav aria-label="Mobile navigation" className="page-shell-wide flex flex-col gap-2 py-4">
                        {navItems.map((item) => {
                            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "border-b px-0 py-2 text-[12px] font-semibold uppercase tracking-[0.16em] transition-all",
                                        active
                                            ? "border-emerald-500 text-emerald-400"
                                            : "border-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-300"
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                        <div className="pt-4 flex gap-4 items-center">
                            <Link href="/create" passHref className="px-4 py-2 text-[13px] font-semibold uppercase rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                                New Roadmap
                            </Link>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
