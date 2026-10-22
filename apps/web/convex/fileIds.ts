import { v } from "convex/values";
import { query } from "./model";
export const normalize = query({
    args: { value: v.string() },
    handler: (ctx, { value }) => ctx.db.system.normalizeId("_storage", value),
});
