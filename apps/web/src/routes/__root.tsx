import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import "@/styles/globals.css";
import "@/styles/learning.css";
import "@/styles/parts.css";
import "@/styles/parts-pages.css";
import { Providers } from "@/components/shared/Providers";
import { getAppUrl } from "@/lib/app-url";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const appUrl = getAppUrl();
const defaultTitle = `${APP_NAME} | Your learning and reading`;

// Reapplies the saved theme before first paint so returning users never see
// a flash of the default Study Desk colours. Written by applyAppearance.
const BOOT_SCRIPT = `try{var b=JSON.parse(localStorage.getItem("syllo_appearance_boot")||"null"),h=/^#[0-9a-f]{6}$/i;if(b&&h.test(b.page)&&h.test(b.surface)&&h.test(b.text)&&h.test(b.accent)){var r=document.documentElement,s=r.style;s.setProperty("--color-page",b.page);s.setProperty("--color-surface",b.surface);s.setProperty("--color-text",b.text);s.setProperty("--color-accent",b.accent);if(b.scheme==="dark"||b.scheme==="light"){r.dataset.scheme=b.scheme;r.style.colorScheme=b.scheme}if(b.headingFont==="sans"||b.headingFont==="serif")r.dataset.headingFont=b.headingFont;if(b.bg&&typeof b.bg.tint==="number"&&typeof b.bg.blur==="number"){r.dataset.bg="on";s.setProperty("--sy-bg-tint",String(b.bg.tint));s.setProperty("--sy-bg-blur",b.bg.blur+"px")}}}catch(e){}`;

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
            { name: "theme-color", content: "#F4EEE2" },
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
        <html lang="en">
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
