"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { usePathname } from "@/lib/router-nav";
import { BarChart2, HardDrive, LayoutDashboard, LayoutGrid, Menu, PlusCircle, Settings2, Sparkles, X } from "lucide-react";
import CreditBadge from "@/components/credits/CreditBadge";
import { Logo } from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

const PRIMARY_ITEMS = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/scout", label: "Scout", icon: Sparkles },
    { href: "/workspaces", label: "Workspaces", icon: LayoutGrid },
    { href: "/create", label: "Create", icon: PlusCircle },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
] as const;

const SETTINGS_ITEM = { href: "/settings", label: "Settings", icon: Settings2 } as const;

type NavItem = (typeof PRIMARY_ITEMS)[number] | typeof SETTINGS_ITEM;

function isActive(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark() {
    return (
        <Link to="/dashboard" className="flex items-center gap-2.5 px-3">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight text-text">RoadMap Studio</span>
        </Link>
    );
}

/** One nav row. Active is marked by brightness alone: grey label to white. */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
    const active = isActive(pathname, item.href);
    return (
        <Link
            to={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
                "flex h-[34px] items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                active ? "bg-surface text-text" : "text-[#bbbbbb] hover:text-text",
            )}
        >
            <item.icon size={16} strokeWidth={1.75} className={active ? "text-text" : "text-text-soft"} />
            {item.label}
        </Link>
    );
}

function NavBody({ pathname }: { pathname: string }) {
    return (
        <>
            <nav aria-label="Studio navigation" className="flex flex-col gap-0.5">
                {PRIMARY_ITEMS.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
            </nav>

            <div className="mt-auto flex flex-col gap-3 pt-6">
                <div className="px-3">
                    <CreditBadge compact />
                </div>
                <p className="flex items-center gap-2 px-3 text-xs text-text-soft">
                    <HardDrive size={14} strokeWidth={1.75} />
                    Saved in this browser
                </p>
                <NavLink item={SETTINGS_ITEM} pathname={pathname} />
            </div>
        </>
    );
}

/**
 * Studio navigation. A fixed sidebar on the page ground from `xl` up; below
 * that a 56px top bar whose menu opens the same nav as a full-screen sheet.
 */
export default function StudioSidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <>
            <aside className="sticky top-0 hidden h-screen flex-col border-r border-border px-3 py-5 xl:flex">
                <Wordmark />
                <div className="mt-8 flex flex-1 flex-col">
                    <NavBody pathname={pathname} />
                </div>
            </aside>

            <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-page px-1 xl:hidden">
                <Wordmark />
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted hover:text-text"
                    aria-label={open ? "Close menu" : "Open menu"}
                    aria-expanded={open}
                    aria-controls="studio-mobile-nav"
                >
                    {open ? <X size={18} /> : <Menu size={18} />}
                </button>
            </div>

            {open ? (
                <div id="studio-mobile-nav" className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col bg-page px-3 py-4 xl:hidden">
                    <NavBody pathname={pathname} />
                </div>
            ) : null}
        </>
    );
}
