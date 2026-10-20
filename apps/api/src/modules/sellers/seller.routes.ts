import { sellerListSchema } from "@nobre/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../../db/pool.js";
import { listSellers } from "../opportunities/opportunity.repository.js";

export const sellerRoutes: FastifyPluginAsyncZod<{ db: Db }> = async (app, { db }) => {
  app.get(
    "/sellers",
    { schema: { tags: ["sellers"], response: { 200: sellerListSchema } } },
    async () => ({ data: await listSellers(db) }),
  );
};
