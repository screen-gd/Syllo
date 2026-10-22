import { getNavigationItems, isPublicNavigationPath, MARKETING_NAV_ITEMS, STUDIO_NAV_ITEMS } from "@/lib/navigation";

describe("navigation helpers", () => {
    it("treats public auth and share routes as public navigation surfaces", () => {
        expect(isPublicNavigationPath("/auth")).toBe(true);
        expect(isPublicNavigationPath("/share/abc123")).toBe(true);
        expect(getNavigationItems("/share/abc123")).toEqual(MARKETING_NAV_ITEMS);
    });

    it("keeps private workspace routes on studio navigation", () => {
        expect(isPublicNavigationPath("/workspace/local-id")).toBe(false);
        expect(getNavigationItems("/workspace/local-id")).toEqual(STUDIO_NAV_ITEMS);
    });
});
