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

/** One destination row: the Item itself is the link, so the whole row navigates. */
function NavItem({
    to,
    label,
    icon,
    badge,
    pathname,
    search,
}: {
    to: string;
    label: string;
    icon?: GlazeIcon;
    badge?: React.ReactNode;
    pathname: string;
    search?: Record<string, string>;
}) {
    const active = isActive(to, pathname);
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
                <ItemTitle>{label}</ItemTitle>
            </ItemContent>
            {badge}
        </Item>
    );
}

export default function LearningSidebar() {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const { reviews, roadmaps } = useReviews();
    const dueCount = reviews.filter((item) => isDue(item)).length;
    return (
        <>
            <aside
                data-glaze
                className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-e border-line-faint px-3 pb-5 pt-6 lg:flex"
            >
                <Link
                    to="/dashboard"
                    data-slot="nav-brand"
                    className="mb-8 flex items-center gap-2.5 px-2.5 text-text-1"
                >
                    <SylloMark />
                    <span className="type-label-lg">Syllo</span>
                </Link>
                <nav
                    aria-label="Main navigation"
                    className="flex flex-col gap-2.5"
                >
                    {groups.map((group, index) => (
                        <div
                            key={index}
                            className={
                                index === 0
                                    ? "contents"
                                    : "border-t border-line-faint pt-2.5"
                            }
                        >
                            {group.map(({ to, label, icon }) => (
                                <NavItem
                                    key={to}
                                    to={to}
                                    label={label}
                                    icon={icon}
                                    pathname={pathname}
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
                    <nav aria-label="Learning topics" className="mt-8">
                        {roadmaps.slice(0, 4).map((roadmap) => (
                            <NavItem
                                key={roadmap.id}
                                to="/learn"
                                label={roadmap.title}
                                pathname={pathname}
                                search={{ roadmap: roadmap.id }}
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
            <header
                data-glaze
                className="sticky top-0 z-sticky border-b border-line-faint bg-paper px-5 py-2.5 lg:hidden"
            >
                <div className="flex items-center justify-between">
                    <Link
                        to="/dashboard"
                        data-slot="nav-brand"
                        className="flex items-center gap-2 text-text-1"
                    >
                        <span className="size-5.5">
                            <SylloMark />
                        </span>
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
                    className="mt-1.5 flex gap-1 overflow-x-auto"
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
                                    "flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-tag px-2.5 py-1.5 type-label-sm",
                                    active
                                        ? "bg-pressed text-text-1"
                                        : "text-text-2",
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
