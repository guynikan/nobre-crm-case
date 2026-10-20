import {
  contactListSchema,
  createOpportunityBodySchema,
  opportunityListQuerySchema,
  opportunityPageSchema,
  opportunityParamsSchema,
  opportunitySchema,
  registerContactBodySchema,
  stageHistorySchema,
  stageTransitionBodySchema,
  updateOpportunityBodySchema,
} from "@nobre/contracts";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { problemResponses } from "../../shared/http.js";
import type { OpportunityService } from "./opportunity.service.js";

export const opportunityRoutes: FastifyPluginAsyncZod<{ service: OpportunityService }> = async (app, { service }) => {
  app.get(
    "/opportunities",
    {
      schema: {
        tags: ["opportunities"],
        summary: "List opportunities, most urgent first",
        querystring: opportunityListQuerySchema,
        response: { 200: opportunityPageSchema, ...problemResponses(400) },
      },
    },
    async (request) => service.list(request.query),
  );

  app.post(
    "/opportunities",
    {
      schema: {
        tags: ["opportunities"],
        summary: "Create an opportunity in First Contact",
        body: createOpportunityBodySchema,
        response: { 201: opportunitySchema, ...problemResponses(400) },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.get(
    "/opportunities/:id",
    {
      schema: {
        tags: ["opportunities"],
        params: opportunityParamsSchema,
        response: { 200: opportunitySchema, ...problemResponses(400, 404) },
      },
    },
    async (request) => service.get(request.params.id),
  );

  app.patch(
    "/opportunities/:id",
    {
      schema: {
        tags: ["opportunities"],
        summary: "Update commercial data (stage changes go through /stage)",
        params: opportunityParamsSchema,
        body: updateOpportunityBodySchema,
        response: { 200: opportunitySchema, ...problemResponses(400, 404, 409, 422) },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post(
    "/opportunities/:id/stage",
    {
      schema: {
        tags: ["opportunities"],
        summary: "Move the opportunity to another stage; the history entry is written in the same transaction",
        params: opportunityParamsSchema,
        body: stageTransitionBodySchema,
        response: { 200: opportunitySchema, ...problemResponses(400, 404, 409, 422) },
      },
    },
    async (request) => service.transition(request.params.id, request.body),
  );

  app.get(
    "/opportunities/:id/history",
    {
      schema: {
        tags: ["opportunities"],
        params: opportunityParamsSchema,
        response: { 200: stageHistorySchema, ...problemResponses(400, 404) },
      },
    },
    async (request) => ({ data: await service.history(request.params.id) }),
  );

  app.get(
    "/opportunities/:id/contacts",
    {
      schema: {
        tags: ["opportunities"],
        params: opportunityParamsSchema,
        response: { 200: contactListSchema, ...problemResponses(400, 404) },
      },
    },
    async (request) => ({ data: await service.contacts(request.params.id) }),
  );

  app.post(
    "/opportunities/:id/contacts",
    {
      schema: {
        tags: ["opportunities"],
        summary: "Register a contact; closes the open follow-up reminder when attention is no longer needed",
        params: opportunityParamsSchema,
        body: registerContactBodySchema,
        response: { 201: opportunitySchema, ...problemResponses(400, 404, 422) },
      },
    },
    async (request, reply) => reply.status(201).send(await service.registerContact(request.params.id, request.body)),
  );
};
