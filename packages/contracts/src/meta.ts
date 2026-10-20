import { z } from "zod";
import { calendarDateSchema } from "./common.js";

/** Business context the UI needs to render dates and defaults consistently with the API. */
export const appMetaSchema = z.object({
  today: calendarDateSchema,
  /** True when "today" is frozen (e.g. the case reference date) instead of the real date. */
  isTodayFixed: z.boolean(),
  timeZone: z.string(),
  attentionThresholdDays: z.number().int(),
});
export type AppMeta = z.infer<typeof appMetaSchema>;
