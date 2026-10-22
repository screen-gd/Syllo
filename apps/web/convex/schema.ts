import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    ...authTables,
    personalDocuments: defineTable({
        owner: v.id("users"),
        key: v.string(),
        payload: v.string(),
        updatedAt: v.number(),
    })
        .index("by_owner", ["owner"])
        .index("by_owner_key", ["owner", "key"]),
    libraryFiles: defineTable({
        owner: v.id("users"),
        storageId: v.id("_storage"),
        createdAt: v.number(),
    }).index("by_storage", ["storageId"]),
});
