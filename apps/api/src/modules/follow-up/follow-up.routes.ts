import { followUpRunResultSchema, reminderListQuerySchema, reminderListSchema } from "@nobre/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { problemResponses } from "../../shared/http.js";
import type { FollowUpService } from "./follow-up.service.js";

export const followUpRoutes: FastifyPluginAsyncZod<{ service: FollowUpService }> = async (app, { service }) => {
  app.get(
    "/reminders",
    {
      schema: {
        tags: ["follow-up"],
        summary: "Follow-up reminders, longest silence first",
        querystring: reminderListQuerySchema,
        response: { 200: reminderListSchema, ...problemResponses(400) },
      },
    },
    async (request) => ({ data: await service.list(request.query) }),
  );

  app.post(
    "/follow-up/run",
    {
      schema: {
        tags: ["follow-up"],
        summary: "Run the follow-up automation now (same code as the scheduled job; idempotent)",
        response: { 200: followUpRunResultSchema },
      },
    },
    async () => service.run(),
  );
};
