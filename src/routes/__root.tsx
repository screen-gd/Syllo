import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import "@/styles/globals.css";
import { Providers } from "@/components/shared/Providers";
import { getAppUrl } from "@/lib/app-url";
import { APP_NAME, APP_TAGLINE, BRAND_OWNER } from "@/lib/constants";

const appUrl = getAppUrl();
const defaultTitle = `${APP_NAME} - Paste Any Guide, Get a Full Interactive Workspace`;

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: defaultTitle },
            {
                name: "description",
                content: `Transform any roadmap, guide, or curriculum into a fully interactive workspace. Built by ${BRAND_OWNER}.`,
            },
            { name: "theme-color", content: "#000000" },
            { property: "og:title", content: defaultTitle },
            { property: "og:description", content: APP_TAGLINE },
            { property: "og:type", content: "website" },
            { property: "og:url", content: appUrl },
            { property: "og:site_name", content: APP_NAME },
            { property: "og:image", content: `${appUrl}/og.png` },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
            { property: "og:image:alt", content: APP_NAME },
            { name: "twitter:card", content: "summary_large_image" },
            { name: "twitter:title", content: defaultTitle },
            { name: "twitter:description", content: APP_TAGLINE },
            { name: "twitter:image", content: `${appUrl}/og.png` },
        ],
        links: [
            { rel: "manifest", href: "/manifest.json" },
            { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
            { rel: "shortcut icon", href: "/favicon.svg" },
            { rel: "apple-touch-icon", href: "/favicon.svg" },
        ],
    }),
    shellComponent: RootDocument,
    component: Outlet,
    notFoundComponent: NotFound,
    errorComponent: RootError,
});

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <head>
                <HeadContent />
            </head>
            <body className="min-h-screen bg-page text-text">
                <a
                    href="#main-content"
                    className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:border focus:border-[color:var(--color-accent)] focus:bg-[color:color-mix(in_srgb,var(--color-accent)_16%,var(--color-surface))] focus:px-4 focus:py-2 focus:text-[color:var(--color-text)]"
                >
                    Skip to main content
                </a>
                <Providers>{children}</Providers>
                <Scripts />
            </body>
        </html>
    );
}

function NotFound() {
    return (
        <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="font-mono text-sm text-text-soft">404</p>
            <h1 className="text-2xl font-medium tracking-tight">This page does not exist</h1>
            <a href="/" className="button-primary px-4 py-2 text-sm">
                Back to home
            </a>
        </main>
    );
}

function RootError({ error }: { error: unknown }) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";

    return (
        <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-2xl font-medium tracking-tight">Something went wrong</h1>
            <p className="max-w-md text-sm text-text-muted">{message}</p>
            <a href="/" className="button-secondary px-4 py-2 text-sm">
                Reload
            </a>
        </main>
    );
}
