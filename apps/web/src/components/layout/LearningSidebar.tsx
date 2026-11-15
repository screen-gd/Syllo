import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Item, ItemContent, ItemTitle } from "@/components/glaze/ui/item";
import {
    Glossary,
    Home,
    Icon,
    Learn,
    Library,
    Notes,
    Progress,
    Reviews,
    Scout,
    Settings,
    type GlazeIcon,
} from "@/components/glaze/icon";
import { useReviews } from "@/hooks/useReviews";
import { isDue } from "@/lib/reviews";
import { getRoadmapStats } from "@/lib/workspace-stats";
import MaterialBar from "@/components/syllo/MaterialBar";
import { cn } from "@/lib/utils";

/** Sidebar groups: where you study, the tools you study with, then Scout. */
const groups = [
    {
        label: "Study",
        items: [
            { to: "/dashboard", label: "Home", icon: Home },
            { to: "/workspaces", label: "Learn", icon: Learn },
            { to: "/library", label: "Library", icon: Library },
        ],
    },
    {
        label: "Tools",
        items: [
            { to: "/notes", label: "Notes", icon: Notes },
            { to: "/glossary", label: "Glossary", icon: Glossary },
            { to: "/reviews", label: "Reviews", icon: Reviews },
            { to: "/progress", label: "Progress", icon: Progress },
        ],
    },
    { label: "Discover", items: [{ to: "/scout", label: "Scout", icon: Scout }] },
] as const;
const destinations: { to: string; label: string; icon: GlazeIcon }[] =
    groups.flatMap((group) => [...group.items]);

function isActive(to: string, pathname: string) {
    return (
        pathname.startsWith(to) ||
        (to === "/workspaces" && pathname.startsWith("/learn"))
    );
}

function SylloMark() {
    return (
        <svg
            viewBox="0 0 26 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
            className="size-6 shrink-0"
        >
            <path d="M21 6H10a4 4 0 0 0 0 8h6a3 3 0 0 1 0 6H5M5 6v14M21 6v14" />
        </svg>
    );
}

/** A labelled run of destinations: the label in caption text-2 over its rows, aligned with their icons. */
function NavSection({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div role="group" aria-label={label} className="flex flex-col gap-0.5">
            <p aria-hidden="true" className="px-3 pb-1 pt-2 type-caption text-text-2">
                {label}
            </p>
            {children}
        </div>
    );
}

/** One destination row: the Item itself is the link, so the whole row navigates. */
function NavItem({
    to,
    label,
    icon,
    trailing,
    pathname,
    search,
    selected,
}: {
    to: string;
    label: string;
    icon?: GlazeIcon;
    trailing?: React.ReactNode;
    pathname: string;
    search?: Record<string, string>;
    selected?: boolean;
}) {
    const active = selected ?? isActive(to, pathname);
    return (
        <Item
            size="sm"
            selected={active}
            render={
                <Link
                    to={to}
                    search={search}
                    aria-current={active ? "page" : undefined}
                />
            }
        >
            {icon && <Icon icon={icon} size={16} />}
            <ItemContent>
                <ItemTitle>
                    <span>{label}</span>
                </ItemTitle>
            </ItemContent>
            {trailing}
        </Item>
    );
}

export default function LearningSidebar() {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const activeRoadmap = useRouterState({
        select: (state) => {
            if (!state.location.pathname.startsWith("/learn")) return undefined;
            const search: Record<string, unknown> = state.location.search;
            return typeof search.roadmap === "string" ? search.roadmap : undefined;
        },
    });
    const { reviews, roadmaps } = useReviews();
    const dueCount = reviews.filter((item) => isDue(item)).length;
    const activeLink = useRef<HTMLAnchorElement>(null);
    useEffect(() => {
        activeLink.current?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [pathname]);
    return (
        <>
            <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 py-3 ps-3 lg:block">
                <div className="shell flex h-full flex-col">
                    <div className="panel flex min-h-0 flex-1 flex-col">
                        <Link
                            to="/dashboard"
                            data-slot="nav-brand"
                            className="flex items-center gap-2 border-b border-line-faint p-3 text-text-1"
                        >
                            <SylloMark />
                            <span className="type-label-lg">Syllo</span>
                        </Link>
                        <nav
                            aria-label="Main navigation"
                            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1.5 pb-3"
                        >
                            {groups.map((group) => (
                                <NavSection key={group.label} label={group.label}>
                                    {group.items.map(({ to, label, icon }) => (
                                        <NavItem
                                            key={to}
                                            to={to}
                                            label={label}
                                            icon={icon}
                                            pathname={pathname}
                                            selected={
                                                to === "/workspaces" && activeRoadmap
                                                    ? false
                                                    : undefined
                                            }
                                            trailing={
                                                to === "/reviews" && dueCount > 0 ? (
                                                    <Badge
                                                        count={dueCount}
                                                        aria-label={`${dueCount} ready`}
                                                    />
                                                ) : undefined
                                            }
                                        />
                                    ))}
                                </NavSection>
                            ))}
                            {roadmaps.length > 0 && (
                                <NavSection label="Topics">
                                    {roadmaps.slice(0, 4).map((roadmap) => {
                                        const percent = getRoadmapStats(roadmap).percent;
                                        return (
                                            <NavItem
                                                key={roadmap.id}
                                                to="/learn"
                                                label={roadmap.title}
                                                pathname={pathname}
                                                search={{ roadmap: roadmap.id }}
                                                selected={activeRoadmap === roadmap.id}
                                                trailing={
                                                    <span className="shrink-0 type-caption tabular-nums text-text-2">
                                                        {percent}%
                                                    </span>
                                                }
                                            />
                                        );
                                    })}
                                </NavSection>
                            )}
                        </nav>
                    </div>
                    <div className="shell-foot">
                        <Button
                            variant={pathname.startsWith("/settings") ? "secondary" : "ghost"}
                            size="sm"
                            render={
                                <Link
                                    to="/settings"
                                    aria-current={
                                        pathname.startsWith("/settings") ? "page" : undefined
                                    }
                                />
                            }
                            nativeButton={false}
                        >
                            <Icon icon={Settings} />
                            Settings
                        </Button>
                    </div>
                </div>
            </aside>
            <MaterialBar className="sticky top-0 z-(--z-sticky) px-4 pt-2 lg:hidden">
                <div className="flex items-center justify-between">
                    <Link
                        to="/dashboard"
                        data-slot="nav-brand"
                        className="flex items-center gap-2 text-text-1"
                    >
                        <SylloMark />
                        <span className="type-label-lg">Syllo</span>
                    </Link>
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Settings"
                        render={<Link to="/settings" />}
                        nativeButton={false}
                    >
                        <Icon icon={Settings} size={16} />
                    </Button>
                </div>
                <nav
                    aria-label="Mobile navigation"
                    className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2"
                >
                    {destinations.map(({ to, label }) => {
                        const active = isActive(to, pathname);
                        return (
                            <Link
                                key={to}
                                ref={active ? activeLink : undefined}
                                to={to}
                                data-slot="nav-link"
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "flex h-(--control) shrink-0 items-center whitespace-nowrap rounded-pill px-3 type-label-sm transition-[background-color,color,scale] duration-(--dur-press) ease-out active:scale-(--scale-press) pointer-coarse:h-(--control-lg)",
                                    active
                                        ? "bg-pressed text-text-1"
                                        : "text-text-2 hover:bg-field hover:text-text-1",
                                )}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </MaterialBar>
        </>
    );
}
