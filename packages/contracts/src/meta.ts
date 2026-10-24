import { z } from "zod";
import { calendarDateSchema } from "./common";

/** Business context the UI needs to render dates and defaults consistently with the API. */
export const appMetaSchema = z.object({
  today: calendarDateSchema,
  timeZone: z.string(),
  attentionThresholdDays: z.number().int(),
  /** Minutes between automatic follow-up runs; null when the schedule is not a plain interval. */
  followUpIntervalMinutes: z.number().int().positive().nullable(),
});
export type AppMeta = z.infer<typeof appMetaSchema>;

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  database: z.enum(["up", "down"]),
});
export type Health = z.infer<typeof healthSchema>;
