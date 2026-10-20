import { z } from "zod";
import { idSchema } from "./common";
import { stageSchema } from "./stage";

export const stageTransitionBodySchema = z.object({
  toStage: stageSchema,
  /** Required (and only accepted) when moving to LOST. */
  lostReason: z.string().trim().min(3).max(500).optional(),
  expectedVersion: z.number().int().positive(),
});
export type StageTransitionBody = z.infer<typeof stageTransitionBodySchema>;

export const stageHistoryEntrySchema = z.object({
  id: idSchema,
  opportunityId: idSchema,
  /** Null for the entry that records the initial stage of the opportunity. */
  fromStage: stageSchema.nullable(),
  toStage: stageSchema,
  lostReason: z.string().nullable(),
  source: z.enum(["USER", "SEED"]),
  changedAt: z.iso.datetime({ offset: true }),
});
export type StageHistoryEntry = z.infer<typeof stageHistoryEntrySchema>;

export const stageHistorySchema = z.object({ data: z.array(stageHistoryEntrySchema) });
export type StageHistory = z.infer<typeof stageHistorySchema>;
