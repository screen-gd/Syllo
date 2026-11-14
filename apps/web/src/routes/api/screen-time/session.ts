import { createFileRoute } from "@tanstack/react-router";
import { focusStartRequestSchema } from "@/lib/screen-time/contract";
import {
    allowSitesFor,
    getFocusStatus,
    startFocusSession,
    stopFocusSession,
} from "@/lib/server/screen-time";

/**
 * Browser-facing proxy for the local Screen Time app. The token stays in the
 * connection file on this server; only the status union crosses to the
 * browser. Status kinds are data, not HTTP errors, so they return 200.
 */
export const Route = createFileRoute("/api/screen-time/session")({
    server: {
        handlers: {
            GET: async () => Response.json(await getFocusStatus()),
            POST: async ({ request }) => {
                let body: unknown;
                try {
                    body = await request.json();
                } catch {
                    return Response.json(
                        { success: false, error: "Send a JSON body." },
                        { status: 400 },
                    );
                }
                const parsed = focusStartRequestSchema.safeParse(body);
                if (!parsed.success)
                    return Response.json(
                        { success: false, error: "Invalid focus session request." },
                        { status: 400 },
                    );
                const requestHost =
                    request.headers
                        .get("x-forwarded-host")
                        ?.split(",")[0]
                        .trim() ?? request.headers.get("host");
                return Response.json(
                    await startFocusSession({
                        goal: parsed.data.goal,
                        durationSeconds: parsed.data.durationSeconds,
                        allowSites: allowSitesFor({
                            requestHost,
                            resourceUrls: parsed.data.resourceUrls,
                        }),
                    }),
                );
            },
            DELETE: async () => Response.json(await stopFocusSession()),
        },
    },
});
