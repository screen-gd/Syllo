import { afterEach, expect, it, vi } from "vitest";
import { canAccessServer } from "@/lib/server/access";

afterEach(() => vi.unstubAllEnvs());

it("keeps local APIs accessible without an account when no deployment is configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    await expect(canAccessServer(new Request("http://localhost:3000/api/scout/settings"))).resolves.toBe(true);
});

it("requires a sign-in token once a deployment is connected", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    await expect(canAccessServer(new Request("http://localhost:3000/api/scout/settings"))).resolves.toBe(false);
});
