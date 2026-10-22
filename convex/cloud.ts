import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./model";
import { personalEntrySchema } from "../src/lib/personal/schema";

export const viewer = query({
    args: {},
    handler: async (ctx) => {
        const owner = await getAuthUserId(ctx);
        if (!owner) throw new Error("Sign in to your learning space.");
        const user = await ctx.db.get(owner);
        return { id: owner, email: user?.email ?? null };
    },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
        const owner = await getAuthUserId(ctx);
        if (!owner) throw new Error("Sign in to sync your learning space.");
        const docs = await ctx.db
            .query("personalDocuments")
            .withIndex("by_owner", (q) => q.eq("owner", owner))
            .collect();
        return docs.map((doc) => ({
            key: doc.key,
            payload: doc.payload,
            updatedAt: doc.updatedAt,
        }));
    },
});

export const write = mutation({
    args: {
        entries: v.array(
            v.object({
                key: v.string(),
                payload: v.string(),
                updatedAt: v.number(),
            }),
        ),
    },
    handler: async (ctx, { entries }) => {
        const owner = await getAuthUserId(ctx);
        if (!owner) throw new Error("Sign in to sync your learning space.");
        if (entries.length > 30)
            throw new Error("Sync up to 30 changes at a time.");
        for (const entry of entries) {
            if (new TextEncoder().encode(entry.payload).byteLength > 750_000)
                throw new Error(
                    "A learning record is too large to sync. Export it before editing.",
                );
            const parsed = personalEntrySchema.parse(JSON.parse(entry.payload));
            if (parsed.id !== entry.key || parsed.updatedAt !== entry.updatedAt)
                throw new Error("Invalid sync record.");
            const previous = await ctx.db
                .query("personalDocuments")
                .withIndex("by_owner_key", (q) =>
                    q.eq("owner", owner).eq("key", entry.key),
                )
                .unique();
            if (previous && previous.updatedAt >= entry.updatedAt) continue;
            if (previous)
                await ctx.db.patch(previous._id, {
                    payload: entry.payload,
                    updatedAt: entry.updatedAt,
                });
            else await ctx.db.insert("personalDocuments", { owner, ...entry });
        }
    },
});

export const uploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        if (!(await getAuthUserId(ctx)))
            throw new Error("Sign in to upload a book.");
        return ctx.storage.generateUploadUrl();
    },
});

export const registerFile = mutation({
    args: { storageId: v.string() },
    handler: async (ctx, args) => {
        const owner = await getAuthUserId(ctx);
        if (!owner) throw new Error("Sign in to save a book.");
        const storageId = ctx.db.system.normalizeId("_storage", args.storageId);
        if (!storageId) throw new Error("Invalid file id.");
        const existing = await ctx.db
            .query("libraryFiles")
            .withIndex("by_storage", (q) => q.eq("storageId", storageId))
            .unique();
        if (existing && existing.owner !== owner)
            throw new Error("This file belongs to another learning space.");
        const metadata = await ctx.db.system.get(storageId);
        if (!metadata || metadata.size > 50 * 1024 * 1024)
            throw new Error(
                "The file is missing or exceeds the 50 MB book limit.",
            );
        if (!existing)
            await ctx.db.insert("libraryFiles", {
                owner,
                storageId,
                createdAt: Date.now(),
            });
        return storageId;
    },
});

export const ownedFile = query({
    args: { storageId: v.id("_storage") },
    handler: async (ctx, { storageId }) => {
        const owner = await getAuthUserId(ctx);
        if (!owner) return false;
        const file = await ctx.db
            .query("libraryFiles")
            .withIndex("by_storage", (q) => q.eq("storageId", storageId))
            .unique();
        return file?.owner === owner;
    },
});
