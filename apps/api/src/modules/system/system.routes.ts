import { appMetaSchema, healthSchema } from "@nobre/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { Db } from "../../db/pool.js";
import type { Clock } from "../../shared/clock.js";

// A cron of "every N minutes" becomes N. Any other schedule is not an interval the UI can state.
function intervalMinutesOf(cron: string): number | null {
  const match = /^\*\/(\d+) \* \* \* \*$/.exec(cron.trim());
  const minutes = match ? Number(match[1]) : NaN;
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}

export const systemRoutes: FastifyPluginAsyncZod<{
  db: Db;
  clock: Clock;
  timeZone: string;
  attentionThresholdDays: number;
  followUpCron: string;
}> = async (app, { db, clock, timeZone, attentionThresholdDays, followUpCron }) => {
  app.get(
    "/health",
    { config: { rateLimit: false }, schema: { tags: ["system"], response: { 200: healthSchema, 503: healthSchema } } },
    async (request, reply) => {
      try {
        await db.query("SELECT 1");
        return { status: "ok" as const, database: "up" as const };
      } catch (error) {
        request.log.error({ err: error }, "health check: database unreachable");
        return reply.status(503).send({ status: "degraded", database: "down" });
      }
    },
  );

  app.get(
    "/meta",
    { schema: { tags: ["system"], summary: "Business date and rules the UI must agree with", response: { 200: appMetaSchema } } },
    async () => ({
      today: clock.today(),
      timeZone,
      attentionThresholdDays,
      followUpIntervalMinutes: intervalMinutesOf(followUpCron),
    }),
  );
};
