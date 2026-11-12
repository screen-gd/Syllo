import { afterEach, expect, it, vi } from "vitest";
import { canAccessServer } from "@/lib/server/access";
import { isCrossOriginRequest } from "@/lib/server/request-origin";

afterEach(() => vi.unstubAllEnvs());

it("keeps local APIs accessible without an account when no deployment is configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    await expect(canAccessServer(new Request("http://localhost:3000/api/scout/settings"))).resolves.toBe(true);
});

it("requires a sign-in token once a deployment is connected", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    await expect(canAccessServer(new Request("http://localhost:3000/api/scout/settings"))).resolves.toBe(false);
});

it("rejects browser requests from another site or port", () => {
    const api = "http://localhost:3000/api/scout/checks";
    expect(isCrossOriginRequest(new Request(api, { headers: { "sec-fetch-site": "same-origin" } }))).toBe(false);
    expect(isCrossOriginRequest(new Request(api))).toBe(false);
    expect(isCrossOriginRequest(new Request(api, { headers: { "sec-fetch-site": "cross-site" } }))).toBe(true);
    expect(isCrossOriginRequest(new Request(api, { headers: { "sec-fetch-site": "same-site" } }))).toBe(true);
    expect(isCrossOriginRequest(new Request(api, { headers: { origin: "http://localhost:3000", host: "localhost:3000" } }))).toBe(false);
    expect(isCrossOriginRequest(new Request(api, { headers: { origin: "https://evil.example", host: "localhost:3000" } }))).toBe(true);
});
