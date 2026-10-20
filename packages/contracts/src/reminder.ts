import { z } from "zod";
import { calendarDateSchema, idSchema } from "./common.js";
import { attentionReasonSchema } from "./opportunity.js";

export const reminderStatusSchema = z.enum(["OPEN", "RESOLVED"]);
export type ReminderStatus = z.infer<typeof reminderStatusSchema>;

export const reminderSchema = z.object({
  id: idSchema,
  opportunityId: idSchema,
  opportunityCode: z.string(),
  companyName: z.string(),
  sellerName: z.string().nullable(),
  reason: attentionReasonSchema,
  daysSinceLastContact: z.number().int().nullable(),
  /** The day the reminder was raised for (the business "today" of the run). */
  dueOn: calendarDateSchema,
  status: reminderStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  resolvedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Reminder = z.infer<typeof reminderSchema>;

export const reminderListQuerySchema = z.object({
  status: reminderStatusSchema.default("OPEN"),
  sellerId: idSchema.optional(),
});

export const reminderListSchema = z.object({ data: z.array(reminderSchema) });
export type ReminderList = z.infer<typeof reminderListSchema>;

export const followUpRunResultSchema = z.object({
  referenceDate: calendarDateSchema,
  thresholdDays: z.number().int(),
  created: z.number().int(),
  resolved: z.number().int(),
  open: z.number().int(),
});
export type FollowUpRunResult = z.infer<typeof followUpRunResultSchema>;
