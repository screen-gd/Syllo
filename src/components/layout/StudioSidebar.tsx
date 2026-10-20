"use client";

import { Link } from "@tanstack/react-router";
import { usePathname } from "@/lib/router-nav";
import { BarChart2, LayoutDashboard, LayoutGrid, PlusCircle, Settings2 } from "lucide-react";
import CreditBadge from "@/components/credits/CreditBadge";
import { cn } from "@/lib/utils";

const PRIMARY_ITEMS = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/create", label: "Create", icon: PlusCircle },
    { href: "/workspaces", label: "Workspaces", icon: LayoutGrid },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
] as const;

export default function StudioSidebar() {
    const pathname = usePathname();

    return (
        <aside className="sticky top-24 hidden self-start xl:block">
            <div className="flex min-h-[calc(100vh-7rem)] flex-col border-l border-white/10 pl-6">
                <nav aria-label="Studio navigation" className="space-y-4">
                    {PRIMARY_ITEMS.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold tracking-wide transition-all duration-300 ease-out overflow-hidden hover:scale-[1.02]",
                                    active
                                        ? "text-zinc-100 bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.03)]"
                                        : "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                                )}
                            >
                                {active && (
                                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-r shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                                )}
                                <div className={cn("transition-all duration-300 ease-out relative z-10", active ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "text-zinc-500 group-hover:text-zinc-300")}>
                                    <item.icon size={18} />
                                </div>
                                <div className="min-w-0 relative z-10">
                                    <span className="block">{item.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto pt-6 space-y-4">
                    <div className="px-3">
                       <CreditBadge compact />
                    </div>

                    <div className="mx-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[11px] font-medium tracking-wide text-emerald-400/90 uppercase">Local Storage</span>
                    </div>

                    <Link
                        to="/settings"
                        aria-current={pathname === "/settings" ? "page" : undefined}
                        className={cn(
                            "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold tracking-wide transition-all duration-300 ease-out hover:scale-[1.02]",
                            pathname === "/settings"
                                ? "text-zinc-100 bg-white/5"
                                : "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                        )}
                    >
                        {pathname === "/settings" && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-zinc-400 to-zinc-600 rounded-r"></span>
                        )}
                        <div className={cn("transition-all duration-300 ease-out relative z-10", pathname === "/settings" ? "text-zinc-300" : "text-zinc-500 group-hover:text-zinc-300")}>
                            <Settings2 size={18} />
                        </div>
                        <div className="min-w-0 relative z-10">
                            <span className="block">Settings</span>
                        </div>
                    </Link>
                </div>
            </div>
        </aside>
    );
}
