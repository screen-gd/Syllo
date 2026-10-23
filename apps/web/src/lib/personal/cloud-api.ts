import {
    makeFunctionReference,
    type ApiFromModules,
    type FunctionArgs,
    type FunctionReturnType,
} from "convex/server";

type CloudApi = ApiFromModules<{
    cloud: typeof import("../../../convex/cloud");
}>["cloud"];
export const cloudApi = {
    viewer: makeFunctionReference<
        "query",
        FunctionArgs<CloudApi["viewer"]>,
        FunctionReturnType<CloudApi["viewer"]>
    >("cloud:viewer"),
    list: makeFunctionReference<
        "query",
        FunctionArgs<CloudApi["list"]>,
        FunctionReturnType<CloudApi["list"]>
    >("cloud:list"),
    write: makeFunctionReference<
        "mutation",
        FunctionArgs<CloudApi["write"]>,
        FunctionReturnType<CloudApi["write"]>
    >("cloud:write"),
    uploadUrl: makeFunctionReference<
        "mutation",
        FunctionArgs<CloudApi["uploadUrl"]>,
        FunctionReturnType<CloudApi["uploadUrl"]>
    >("cloud:uploadUrl"),
    registerFile: makeFunctionReference<
        "mutation",
        FunctionArgs<CloudApi["registerFile"]>,
        FunctionReturnType<CloudApi["registerFile"]>
    >("cloud:registerFile"),
};
