import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import "@/styles/globals.css";
import "@/components/glaze/styles.css";
import { Providers } from "@/components/shared/Providers";
import { GlazePortalProvider } from "@/lib/glaze/portal";
import { Button } from "@/components/glaze/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/glaze/ui/empty-state";
import { getAppUrl } from "@/lib/app-url";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const appUrl = getAppUrl();
const defaultTitle = `${APP_NAME} | Your learning and reading`;

// Sets data-theme before first paint so a saved or system dark theme never
// flashes light. Mirrors resolveTheme in lib/appearance.ts.
const BOOT_SCRIPT = `try{var v=JSON.parse(localStorage.getItem("syllo_theme")||"null"),d=v==="dark"||(v!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches),r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=r.dataset.theme}catch(e){}`;

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: defaultTitle },
            {
                name: "description",
                content: "Continue learning, read your books, and review the ideas you want to remember.",
            },
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
        scripts: [{ children: BOOT_SCRIPT }],
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
        <html lang="en" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body className="glaze min-h-dvh bg-page text-text-1">
                <a
                    href="#main-content"
                    data-slot="skip-link"
                    className="sr-only focus-ring focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-(--z-overlay) focus:rounded-pill focus:bg-paper focus:px-4 focus:py-2 focus:text-text-1"
                >
                    Skip to main content
                </a>
                <GlazePortalProvider>
                    <Providers>{children}</Providers>
                </GlazePortalProvider>
                <Scripts />
            </body>
        </html>
    );
}

function NotFound() {
    return (
        <main id="main-content" className="flex min-h-dvh items-center justify-center p-6">
            <h1 className="sr-only">This page does not exist</h1>
            <Empty reason="empty" className="w-full max-w-md">
                <EmptyHeader>
                    <EmptyTitle>This page does not exist</EmptyTitle>
                    <EmptyDescription>The link may be old or mistyped.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button size="sm" variant="secondary" render={<a href="/" />} nativeButton={false}>
                        Back to home
                    </Button>
                </EmptyContent>
            </Empty>
        </main>
    );
}

function RootError({ error }: { error: unknown }) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";

    return (
        <main id="main-content" className="flex min-h-dvh items-center justify-center p-6">
            <Empty reason="error" className="w-full max-w-md">
                <EmptyHeader>
                    <EmptyTitle>Something went wrong</EmptyTitle>
                    <EmptyDescription>{message}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button size="sm" variant="secondary" render={<a href="/" />} nativeButton={false}>
                        Reload
                    </Button>
                </EmptyContent>
            </Empty>
        </main>
    );
}
