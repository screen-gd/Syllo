import { Link, useRouterState } from "@tanstack/react-router";
import {
    BookOpen,
    House,
    Library,
    RotateCcw,
    Settings2,
    Telescope,
} from "lucide-react";
import { useLearningRoadmaps } from "@/hooks/useLearningRoadmaps";

const destinations = [
    { to: "/dashboard", label: "Home", icon: House },
    { to: "/library", label: "Library", icon: Library },
    { to: "/workspaces", label: "Learn", icon: BookOpen },
    { to: "/reviews", label: "Reviews", icon: RotateCcw },
    { to: "/scout", label: "Scout", icon: Telescope },
] as const;

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
    const { roadmaps } = useLearningRoadmaps();
    return (
        <>
            <aside className="sy-sidebar">
                <Link className="sy-brand" to="/dashboard">
                    <SylloMark />
                    <span>Syllo</span>
                </Link>
                <nav aria-label="Main navigation">
                    {destinations.map(({ to, label, icon: Icon }) => {
                        const active =
                            pathname.startsWith(to) ||
                            (to === "/workspaces" &&
                                pathname.startsWith("/learn"));
                        return (
                            <Link
                                key={to}
                                to={to}
                                className="sy-nav-item"
                                aria-current={active ? "page" : undefined}
                            >
                                <Icon size={17} />
                                <span>{label}</span>
                            </Link>
                        );
                    })}
                </nav>
                {roadmaps.length > 0 && (
                    <div className="sy-nav-topics">
                        <p>Learning topics</p>
                        {roadmaps.slice(0, 4).map((roadmap) => (
                            <Link
                                key={roadmap.id}
                                to="/learn"
                                search={{ roadmap: roadmap.id }}
                            >
                                <i />
                                {roadmap.title}
                            </Link>
                        ))}
                    </div>
                )}
                <div className="sy-nav-bottom">
                    <Link
                        to="/settings"
                        className="sy-nav-item"
                        aria-current={
                            pathname === "/settings" ? "page" : undefined
                        }
                    >
                        <Settings2 size={17} />
                        Settings
                    </Link>
                </div>
            </aside>
            <header className="sy-mobile-nav">
                <div className="sy-mobile-brand">
                    <Link className="sy-brand" to="/dashboard">
                        <SylloMark />
                        <span>Syllo</span>
                    </Link>
                    <Link
                        className="sy-button quiet"
                        to="/settings"
                        aria-label="Settings"
                    >
                        <Settings2 size={18} />
                    </Link>
                </div>
                <nav aria-label="Mobile navigation">
                    {destinations.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            aria-current={
                                pathname.startsWith(to) ||
                                (to === "/workspaces" &&
                                    pathname.startsWith("/learn"))
                                    ? "page"
                                    : undefined
                            }
                        >
                            {label}
                        </Link>
                    ))}
                </nav>
            </header>
        </>
    );
}
