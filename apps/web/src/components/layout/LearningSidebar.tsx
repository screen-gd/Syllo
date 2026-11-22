import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
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
import SlidingHighlight from "@/components/syllo/SlidingHighlight";
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

/**
 * One destination row: a pill link, washed under the pointer. The current row holds the paper pill with a hairline
 * (the way Glaze marks a selected tab), and that pill slides to the next row when you navigate.
 */
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
        <Link
            to={to}
            search={search}
            aria-current={active ? "page" : undefined}
            data-slot="nav-row"
            data-highlight-host=""
            className={cn(
                "flex h-(--control) min-w-0 items-center gap-2 rounded-pill px-3 type-label transition-[background-color,color,scale] duration-(--dur-press) ease-out active:scale-(--scale-press-flat) focus-visible:focus-ring",
                active
                    ? "text-text-1"
                    : "text-text-2 hover:bg-hover hover:text-text-1",
            )}
        >
            {active && <SlidingHighlight group="sidebar" look="paper" />}
            {icon && <Icon icon={icon} size={16} />}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {trailing}
        </Link>
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
            <aside className="hidden h-dvh w-60 shrink-0 flex-col bg-frame lg:flex">
                    <div className="flex min-h-0 flex-1 flex-col">
                        <Link
                            to="/dashboard"
                            data-slot="nav-brand"
                            className="mt-2 flex h-12 shrink-0 items-center gap-2 px-6 text-text-1"
                        >
                            <SylloMark />
                            <span className="type-label-lg">Syllo</span>
                        </Link>
                        <nav
                            aria-label="Main navigation"
                            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 pt-1"
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
                    <div className="shrink-0 border-t border-line-faint p-3">
                        <NavItem
                            to="/settings"
                            label="Settings"
                            icon={Settings}
                            pathname={pathname}
                        />
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
                                data-highlight-host=""
                                className={cn(
                                    "flex h-(--control) shrink-0 items-center whitespace-nowrap rounded-pill px-3 type-label-sm transition-[background-color,color,scale] duration-(--dur-press) ease-out active:scale-(--scale-press) pointer-coarse:h-(--control-lg)",
                                    active
                                        ? "text-text-1"
                                        : "text-text-2 hover:bg-field hover:text-text-1",
                                )}
                            >
                                {active && <SlidingHighlight group="mobile-nav" />}
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </MaterialBar>
        </>
    );
}
