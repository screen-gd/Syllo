import { useRouterState } from "@tanstack/react-router";

/**
 * Thin adapters that mirror the two Next.js navigation hooks this codebase
 * used. Keeping the call sites unchanged makes the framework migration a
 * one-line import swap per file instead of a component rewrite.
 */
export function usePathname(): string {
    return useRouterState({ select: (state) => state.location.pathname });
}

export function useSearchParams(): URLSearchParams {
    const search = useRouterState({ select: (state) => state.location.searchStr });
    return new URLSearchParams(search);
}
