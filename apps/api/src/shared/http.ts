import { problemDetailsSchema } from "@nobre/contracts";

/** Documents the Problem Details responses of a route in the OpenAPI spec. */
export function problemResponses<const S extends number>(...statuses: S[]) {
  return Object.fromEntries(statuses.map((status) => [status, problemDetailsSchema])) as Record<
    S,
    typeof problemDetailsSchema
  >;
}
