export const MARKETING_NAV_ITEMS = [
    { href: "/", label: "Overview" },
    { href: "/gallery", label: "Gallery" },
    { href: "/pricing", label: "Pricing" },
    { href: "/contact", label: "Contact" },
] as const;

export const STUDIO_NAV_ITEMS = [
    { href: "/create", label: "Create" },
    { href: "/workspaces", label: "Workspaces" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/analytics", label: "Analytics" },
    { href: "/settings", label: "Settings" },
] as const;

export const FOOTER_NAV_GROUPS = [
    {
        title: "Explore",
        items: [
            { href: "/", label: "Overview" },
            { href: "/gallery", label: "Gallery" },
            { href: "/pricing", label: "Pricing" },
        ],
    },
    {
        title: "Studio",
        items: [
            { href: "/create", label: "Create" },
            { href: "/workspaces", label: "Workspaces" },
            { href: "/dashboard", label: "Dashboard" },
        ],
    },
    {
        title: "Company",
        items: [
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
            { href: "/contact", label: "Contact" },
        ],
    },
] as const;

const PUBLIC_NAV_PREFIXES = ["/", "/pricing", "/gallery", "/privacy", "/terms", "/contact", "/auth", "/share"] as const;

export function isPublicNavigationPath(pathname: string | null): boolean {
    if (!pathname) return true;
    if (pathname === "/") return true;

    return PUBLIC_NAV_PREFIXES.some((prefix) => prefix !== "/" && pathname.startsWith(prefix));
}

export function getNavigationItems(pathname: string | null) {
    return isPublicNavigationPath(pathname) ? MARKETING_NAV_ITEMS : STUDIO_NAV_ITEMS;
}
