import { createFileRoute } from "@tanstack/react-router";
import {
    GATE_COOKIE,
    GATE_COOKIE_MAX_AGE,
    GATE_COOKIE_VALUE,
    isGatePasswordValid,
} from "@/lib/access-gate";

export const Route = createFileRoute("/api/gate")({
    server: {
        handlers: {
            POST: async ({ request }) => {
                let password = "";
                try {
                    const body = await request.json();
                    if (typeof body?.password === "string") {
                        password = body.password;
                    }
                } catch {
                    return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
                }

                if (!isGatePasswordValid(password)) {
                    return Response.json({ ok: false, error: "Incorrect password" }, { status: 401 });
                }

                const attributes = [
                    `${GATE_COOKIE}=${GATE_COOKIE_VALUE}`,
                    "Path=/",
                    `Max-Age=${GATE_COOKIE_MAX_AGE}`,
                    "HttpOnly",
                    "SameSite=Lax",
                ];
                if (process.env.NODE_ENV === "production") {
                    attributes.push("Secure");
                }

                return Response.json(
                    { ok: true },
                    { headers: { "set-cookie": attributes.join("; ") } },
                );
            },
        },
    },
});
