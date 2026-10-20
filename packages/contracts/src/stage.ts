import { z } from "zod";

/** Funnel stages in pipeline order, followed by the LOST terminal state. */
export const STAGES = [
  "FIRST_CONTACT",
  "QUOTE_PRESENTATION",
  "FOLLOW_UP",
  "FORECAST",
  "CLOSING",
  "LOST",
] as const;

export const stageSchema = z.enum(STAGES);
export type Stage = z.infer<typeof stageSchema>;

/** The five funnel columns, in order. LOST is a state, not a step of the sequence. */
export const PIPELINE_STAGES = [
  "FIRST_CONTACT",
  "QUOTE_PRESENTATION",
  "FOLLOW_UP",
  "FORECAST",
  "CLOSING",
] as const satisfies readonly Stage[];

export const FINAL_STAGES = ["CLOSING", "LOST"] as const satisfies readonly Stage[];

export function isFinalStage(stage: Stage): boolean {
  return (FINAL_STAGES as readonly Stage[]).includes(stage);
}
