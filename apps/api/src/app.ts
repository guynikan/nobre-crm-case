import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Config } from "./config.js";
import type { Db } from "./db/pool.js";
import { followUpRoutes } from "./modules/follow-up/follow-up.routes.js";
import { createFollowUpService, webhookNotifier } from "./modules/follow-up/follow-up.service.js";
import { opportunityRoutes } from "./modules/opportunities/opportunity.routes.js";
import { createOpportunityService } from "./modules/opportunities/opportunity.service.js";
import { sellerRoutes } from "./modules/sellers/seller.routes.js";
import { systemRoutes } from "./modules/system/system.routes.js";
import type { Clock } from "./shared/clock.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

export interface AppDeps {
  config: Config;
  db: Db;
  clock: Clock;
  logger?: boolean;
}

export async function buildApp({ config, db, clock, logger = true }: AppDeps) {
  const app = Fastify({ logger: logger ? { level: config.logLevel } : false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.webOrigin, methods: ["GET", "POST", "PATCH"] });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(swagger, {
    openapi: { info: { title: "Nobre Brindes CRM API", version: "0.1.0" } },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  const deps = { db, clock, attentionThresholdDays: config.attentionThresholdDays };
  const opportunities = createOpportunityService(deps);
  const followUp = createFollowUpService({
    ...deps,
    log: app.log,
    ...(config.followUpWebhookUrl ? { notify: webhookNotifier(config.followUpWebhookUrl) } : {}),
  });

  await app.register(systemRoutes, {
    db,
    clock,
    timeZone: config.businessTimeZone,
    attentionThresholdDays: config.attentionThresholdDays,
  });
  await app.register(sellerRoutes, { db });
  await app.register(opportunityRoutes, { service: opportunities });
  await app.register(followUpRoutes, { service: followUp });

  return { app, followUp };
}
