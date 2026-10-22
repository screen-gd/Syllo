import { createFileRoute } from "@tanstack/react-router";
import { getCreditStatus, listCreditTransactions } from "@/lib/server/credits";

export const Route = createFileRoute("/api/credits/status")({
    server: {
        handlers: {
            GET: async () => {
                try {
                    const [status, transactions] = await Promise.all([
                        getCreditStatus(),
                        listCreditTransactions(),
                    ]);
                    return Response.json({ success: true, status, transactions });
                } catch (error) {
                    if (
                        (error as { code?: string } | null)?.code === "AUTH_ERROR" ||
                        (error as Error | null)?.message?.includes("not authenticated") ||
                        (error as Error | null)?.message === "Authentication required"
                    ) {
                        return Response.json({ success: false, authenticated: false }, { status: 401 });
                    }
                    console.error("Credit status error:", error);
                    return Response.json({ success: false, error: "Failed to load credit status" }, { status: 500 });
                }
            },
        },
    },
});
