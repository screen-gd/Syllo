import { ConvexHttpClient } from "convex/browser";
import { cloudApi } from "@/lib/personal/cloud-api";

/** Local mode needs no account. A connected deployment gates server APIs too. */
export async function canAccessServer(request: Request) {
    const url = import.meta.env.VITE_CONVEX_URL;
    if (typeof url !== "string" || !url.trim()) return true;
    const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return false;
    try {
        const client = new ConvexHttpClient(url);
        client.setAuth(token);
        await client.query(cloudApi.viewer, {});
        return true;
    } catch {
        return false;
    }
}
