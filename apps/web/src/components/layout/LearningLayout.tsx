import {
    createContext,
    useContext,
    useEffect,
    useRef,
    type ReactNode,
    type RefObject,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import PageTransition from "@/components/syllo/PageTransition";
import LearningSidebar from "./LearningSidebar";

/** The studio panel's scroll container, so bars inside pages can tell when content has scrolled beneath them. */
export const StudioScrollContext =
    createContext<RefObject<HTMLElement | null> | null>(null);

/** The studio panel's scroll container, or null outside the studio shell where the window scrolls. */
export function useStudioScroll() {
    return useContext(StudioScrollContext);
}

/**
 * The studio frame: the app sidebar beside the page column every studio route renders into. Below lg the window
 * scrolls the page column. At lg the frame is one dark surface: the sidebar sits on it and the page column becomes a
 * rounded bordered panel that fills the rest of the window and scrolls itself. The panel carries no padding at lg:
 * PageTransition pads the page content so a sticky top bar can sit flush at the panel's edge.
 */
export default function LearningLayout({ children }: { children: ReactNode }) {
    const pathname = useRouterState({
        select: (state) => state.location.pathname,
    });
    const main = useRef<HTMLElement>(null);
    useEffect(() => {
        main.current?.scrollTo(0, 0);
    }, [pathname]);
    return (
        <div className="min-h-dvh bg-page lg:flex lg:h-dvh lg:overflow-hidden lg:bg-frame">
            <LearningSidebar />
            <main
                ref={main}
                id="main-content"
                className="app-scroll min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:my-2 lg:me-2 lg:min-h-0 lg:overflow-y-auto lg:rounded-panel lg:border lg:border-line-faint lg:bg-page lg:p-0"
            >
                <StudioScrollContext value={main}>
                    <PageTransition routeKey={pathname}>
                        {children}
                    </PageTransition>
                </StudioScrollContext>
            </main>
        </div>
    );
}
