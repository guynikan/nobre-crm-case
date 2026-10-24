import { z } from "zod";
import { DEFAULT_ATTENTION_THRESHOLD_DAYS } from "@nobre/domain";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3333),
  HOST: z.string().default("0.0.0.0"),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  BUSINESS_TIME_ZONE: z.string().default("America/Sao_Paulo"),
  ATTENTION_THRESHOLD_DAYS: z.coerce.number().int().min(1).default(DEFAULT_ATTENTION_THRESHOLD_DAYS),
  FOLLOW_UP_CRON: z.string().default("*/15 * * * *"),
  FOLLOW_UP_WEBHOOK_URL: z.union([z.url(), z.literal("")]).optional(),
  LOG_LEVEL: z.string().default("info"),
});

export type Config = {
  databaseUrl: string;
  port: number;
  host: string;
  webOrigin: string;
  businessTimeZone: string;
  attentionThresholdDays: number;
  followUpCron: string;
  followUpWebhookUrl: string | null;
  logLevel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    port: parsed.PORT,
    host: parsed.HOST,
    webOrigin: parsed.WEB_ORIGIN,
    businessTimeZone: parsed.BUSINESS_TIME_ZONE,
    attentionThresholdDays: parsed.ATTENTION_THRESHOLD_DAYS,
    followUpCron: parsed.FOLLOW_UP_CRON,
    followUpWebhookUrl: parsed.FOLLOW_UP_WEBHOOK_URL || null,
    logLevel: parsed.LOG_LEVEL,
  };
}
