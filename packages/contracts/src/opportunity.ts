import { z } from "zod";
import { calendarDateSchema, idSchema, pageOf, pageQuerySchema, queryBooleanSchema } from "./common";
import { stageSchema } from "./stage";

export const giftItemInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().positive().max(1_000_000),
});
export type GiftItemInput = z.infer<typeof giftItemInputSchema>;

export const giftItemSchema = giftItemInputSchema.extend({ id: idSchema });
export type GiftItem = z.infer<typeof giftItemSchema>;

export const attentionReasonSchema = z.enum(["NO_CONTACT_RECORDED", "DAYS_WITHOUT_CONTACT"]);
export type AttentionReason = z.infer<typeof attentionReasonSchema>;

/**
 * Urgency order among the deals that already need attention, most urgent first.
 * Derived per request from the business date; never stored.
 */
export const ATTENTION_PRIORITIES = ["UNTOUCHED", "EVENT_IMMINENT", "PROPOSAL_EXPIRED", "OVERDUE_CONTACT"] as const;
export const attentionPrioritySchema = z.enum(ATTENTION_PRIORITIES);
export type AttentionPriority = z.infer<typeof attentionPrioritySchema>;

/** Whether a deal is due, which is all the follow-up automation needs to know. */
export const attentionCheckSchema = z.object({
  needsAttention: z.boolean(),
  reason: attentionReasonSchema.nullable(),
  daysSinceLastContact: z.number().int().nullable(),
});
export type AttentionCheck = z.infer<typeof attentionCheckSchema>;

/** The check plus the ranking the board uses to order what is due. */
export const attentionSchema = attentionCheckSchema.extend({
  /** Null exactly when `needsAttention` is false. */
  priority: attentionPrioritySchema.nullable(),
});
export type Attention = z.infer<typeof attentionSchema>;

export const opportunitySchema = z.object({
  id: idSchema,
  code: z.string(),
  companyName: z.string(),
  seller: z.object({ id: idSchema, name: z.string() }).nullable(),
  /** Money is carried as integer cents to avoid floating point errors. */
  estimatedValueCents: z.number().int().nonnegative().nullable(),
  items: z.array(giftItemSchema),
  lastContactOn: calendarDateSchema.nullable(),
  proposalValidUntil: calendarDateSchema.nullable(),
  eventDate: calendarDateSchema.nullable(),
  stage: stageSchema,
  lostReason: z.string().nullable(),
  /** Optimistic concurrency token; incremented on every write. */
  version: z.number().int().positive(),
  isSynthetic: z.boolean(),
  attention: attentionSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const opportunityPageSchema = pageOf(opportunitySchema);
export type OpportunityPage = z.infer<typeof opportunityPageSchema>;

export const opportunityListQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  stage: stageSchema.optional(),
  sellerId: idSchema.optional(),
  needsAttention: queryBooleanSchema.optional(),
});
export type OpportunityListQuery = z.input<typeof opportunityListQuerySchema>;

export const createOpportunityBodySchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  sellerId: idSchema.nullable().default(null),
  estimatedValueCents: z.number().int().nonnegative().nullable().default(null),
  items: z.array(giftItemInputSchema).max(50).default([]),
  lastContactOn: calendarDateSchema.nullable().default(null),
  proposalValidUntil: calendarDateSchema.nullable().default(null),
  eventDate: calendarDateSchema.nullable().default(null),
});
export type CreateOpportunityBody = z.input<typeof createOpportunityBodySchema>;

/** Partial update of commercial data. Stage changes go through stage transitions only. */
export const updateOpportunityBodySchema = z.object({
  expectedVersion: z.number().int().positive(),
  companyName: z.string().trim().min(1).max(160).optional(),
  sellerId: idSchema.nullable().optional(),
  estimatedValueCents: z.number().int().nonnegative().nullable().optional(),
  /** When present, replaces the whole item list. */
  items: z.array(giftItemInputSchema).max(50).optional(),
  proposalValidUntil: calendarDateSchema.nullable().optional(),
  eventDate: calendarDateSchema.nullable().optional(),
});
export type UpdateOpportunityBody = z.input<typeof updateOpportunityBodySchema>;

export const opportunityParamsSchema = z.object({ id: idSchema });
