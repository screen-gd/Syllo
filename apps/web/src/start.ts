import { createMiddleware, createStart } from "@tanstack/react-start";
import { getScoutAccessToken } from "@/lib/scout/api-client";

const privateApis = createMiddleware().server(async ({ request, next }) => {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/") || path.startsWith("/_serverFn/")) {
        const { canAccessServer } = await import("@/lib/server/access");
        if (!(await canAccessServer(request)))
            return Response.json(
                {
                    success: false,
                    error: "Sign in through Settings to use this private learning space.",
                },
                { status: 401 },
            );
    }
    return next();
});

export const startInstance = createStart(() => ({
    requestMiddleware: [privateApis],
    serverFns: {
        fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            const token = getScoutAccessToken();
            if (token) headers.set("Authorization", `Bearer ${token}`);
            return fetch(input, { ...init, headers });
        },
    },
}));
