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
import { cn } from "@/lib/utils";

/** Sidebar groups: where you study, the tools you study with, then Scout. */
const groups = [
    [
        { to: "/dashboard", label: "Home", icon: Home },
        { to: "/workspaces", label: "Learn", icon: Learn },
        { to: "/library", label: "Library", icon: Library },
    ],
    [
        { to: "/notes", label: "Notes", icon: Notes },
        { to: "/glossary", label: "Glossary", icon: Glossary },
        { to: "/reviews", label: "Reviews", icon: Reviews },
        { to: "/progress", label: "Progress", icon: Progress },
    ],
    [{ to: "/scout", label: "Scout", icon: Scout }],
] as const;
const destinations = groups.flat();

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

/**
 * One destination row: the Item itself is the link, so the whole row navigates. A row with no icon is indented to
 * the icon rows' text, so every label starts at the same x.
 */
function NavItem({
    to,
    label,
    icon,
    badge,
    pathname,
    search,
    selected,
}: {
    to: string;
    label: string;
    icon?: GlazeIcon;
    badge?: React.ReactNode;
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
            <ItemContent className={icon ? undefined : "ps-6"}>
                <ItemTitle>
                    <span>{label}</span>
                </ItemTitle>
            </ItemContent>
            {badge}
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
    return (
        <>
            <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-e border-line-faint px-3 pb-6 pt-6 lg:flex">
                <Link
                    to="/dashboard"
                    data-slot="nav-brand"
                    className="mb-8 flex items-center gap-2 px-3 text-text-1"
                >
                    <SylloMark />
                    <span className="type-label-lg">Syllo</span>
                </Link>
                <nav aria-label="Main navigation" className="flex flex-col gap-2">
                    {groups.map((group, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex flex-col gap-0.5",
                                index > 0 && "border-t border-line-faint pt-2",
                            )}
                        >
                            {group.map(({ to, label, icon }) => (
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
                                    badge={
                                        to === "/reviews" && dueCount > 0 ? (
                                            <Badge
                                                count={dueCount}
                                                aria-label={`${dueCount} ready`}
                                            />
                                        ) : undefined
                                    }
                                />
                            ))}
                        </div>
                    ))}
                </nav>
                {roadmaps.length > 0 && (
                    <nav
                        aria-label="Learning topics"
                        className="mt-6 flex flex-col gap-0.5 border-t border-line-faint pt-2"
                    >
                        {roadmaps.slice(0, 4).map((roadmap) => (
                            <NavItem
                                key={roadmap.id}
                                to="/learn"
                                label={roadmap.title}
                                pathname={pathname}
                                search={{ roadmap: roadmap.id }}
                                selected={activeRoadmap === roadmap.id}
                            />
                        ))}
                    </nav>
                )}
                <div className="mt-auto pt-8">
                    <NavItem
                        to="/settings"
                        label="Settings"
                        icon={Settings}
                        pathname={pathname}
                    />
                </div>
            </aside>
            <header className="sticky top-0 z-(--z-sticky) border-b border-line-faint bg-paper px-4 pt-2 lg:hidden">
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
                                to={to}
                                data-slot="nav-link"
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "flex h-(--control) shrink-0 items-center whitespace-nowrap rounded-pill px-3 type-label-sm",
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
            </header>
        </>
    );
}
