import {
    queryGeneric,
    mutationGeneric,
    httpActionGeneric,
    type DataModelFromSchemaDefinition,
    type QueryBuilder,
    type MutationBuilder,
    type HttpActionBuilder,
} from "convex/server";
import type schema from "./schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export const query: QueryBuilder<DataModel, "public"> = queryGeneric;
export const mutation: MutationBuilder<DataModel, "public"> = mutationGeneric;
export const httpAction: HttpActionBuilder = httpActionGeneric;
