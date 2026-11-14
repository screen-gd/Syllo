import { Link, useRouterState } from "@tanstack/react-router";
import { Badge } from "@/components/glaze/ui/badge";
import { Button } from "@/components/glaze/ui/button";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/glaze/ui/item";
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
} from "@/components/glaze/icon";
import { useReviews } from "@/hooks/useReviews";
import { isDue } from "@/lib/reviews";

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
    return pathname.startsWith(to) || (to === "/workspaces" && pathname.startsWith("/learn"));
}

function SylloMark() {
    return (
        <svg
            viewBox="0 0 26 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
        >
            <path d="M21 6H10a4 4 0 0 0 0 8h6a3 3 0 0 1 0 6H5M5 6v14M21 6v14" />
        </svg>
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
            <aside className="sy-sidebar border-line-faint">
                <Link className="sy-brand text-text-1" to="/dashboard">
                    <SylloMark />
                    <span>Syllo</span>
                </Link>
                <nav aria-label="Main navigation">
                    {groups.map((group, index) => (
                        <ItemGroup key={index} variant="plain" className="sy-nav-group">
                            {group.map(({ to, label, icon }) => {
                                const active = isActive(to, pathname);
                                return (
                                    <Item
                                        key={to}
                                        size="sm"
                                        selected={active}
                                        render={
                                            <Link
                                                to={to}
                                                aria-current={active ? "page" : undefined}
                                            />
                                        }
                                    >
                                        <Icon icon={icon} size={16} />
                                        <ItemContent>
                                            <ItemTitle>{label}</ItemTitle>
                                        </ItemContent>
                                        {to === "/reviews" && dueCount > 0 && (
                                            <Badge
                                                count={dueCount}
                                                aria-label={`${dueCount} ready`}
                                            />
                                        )}
                                    </Item>
                                );
                            })}
                        </ItemGroup>
                    ))}
                </nav>
                {roadmaps.length > 0 && (
                    <div className="sy-nav-topics">
                        <p className="text-text-3">Learning topics</p>
                        {roadmaps.slice(0, 4).map((roadmap) => (
                            <Link
                                key={roadmap.id}
                                to="/learn"
                                search={{ roadmap: roadmap.id }}
                                className="text-text-2"
                            >
                                {roadmap.title}
                            </Link>
                        ))}
                    </div>
                )}
                <div className="sy-nav-bottom">
                    <Item
                        size="sm"
                        selected={pathname === "/settings"}
                        render={
                            <Link
                                to="/settings"
                                aria-current={pathname === "/settings" ? "page" : undefined}
                            />
                        }
                    >
                        <Icon icon={Settings} size={16} />
                        <ItemContent>
                            <ItemTitle>Settings</ItemTitle>
                        </ItemContent>
                    </Item>
                </div>
            </aside>
            <header className="sy-mobile-nav bg-paper border-line-faint">
                <div className="sy-mobile-brand">
                    <Link className="sy-brand text-text-1" to="/dashboard">
                        <SylloMark />
                        <span>Syllo</span>
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
                <nav aria-label="Mobile navigation">
                    {destinations.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className="text-text-2"
                            aria-current={isActive(to, pathname) ? "page" : undefined}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </header>
        </>
    );
}
