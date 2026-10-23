import { httpRouter, makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { auth } from "./auth";
import { httpAction } from "./model";

const http = httpRouter();
auth.addHttpRoutes(http);
const ownedFile = makeFunctionReference<
    "query",
    { storageId: GenericId<"_storage"> },
    boolean
>("cloud:ownedFile");
function headers(request: Request) {
    const origin = request.headers.get("origin");
    const allowed = process.env.SITE_URL
        ? new URL(process.env.SITE_URL).origin
        : "http://localhost:3000";
    return {
        "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        Vary: "Origin",
        "Cache-Control": "private, no-store",
    };
}
http.route({
    path: "/library/file",
    method: "OPTIONS",
    handler: httpAction(
        async (_ctx, request) =>
            new Response(null, { status: 204, headers: headers(request) }),
    ),
});
http.route({
    path: "/library/file",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
        const cors = headers(request);
        const rawId = new URL(request.url).searchParams.get("id");
        if (!rawId)
            return new Response("File not found", {
                status: 404,
                headers: cors,
            });
        // Convex validates the storage id and the caller's identity in the query.
        const storageId = await ctx.runQuery(
            makeFunctionReference<
                "query",
                { value: string },
                GenericId<"_storage"> | null
            >("fileIds:normalize"),
            { value: rawId },
        );
        if (!storageId || !(await ctx.runQuery(ownedFile, { storageId })))
            return new Response("Sign in to read this book", {
                status: 401,
                headers: cors,
            });
        const file = await ctx.storage.get(storageId);
        return file
            ? new Response(file, {
                  headers: {
                      ...cors,
                      "Content-Type": file.type || "application/epub+zip",
                  },
              })
            : new Response("File not found", { status: 404, headers: cors });
    }),
});
export default http;
