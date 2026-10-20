import { z } from "zod";

/** Machine-readable error codes. Human-readable text (pt-BR) lives in the API. */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "SAME_STAGE",
  "STAGE_IS_FINAL",
  "TRANSITION_NOT_ALLOWED",
  "MISSING_ESTIMATED_VALUE",
  "MISSING_GIFT_ITEMS",
  "LOST_REASON_REQUIRED",
  "LOST_REASON_NOT_ALLOWED",
  "ITEMS_REQUIRED_FOR_STAGE",
  "ESTIMATED_VALUE_REQUIRED_FOR_STAGE",
  "OPPORTUNITY_IS_FINAL",
  "CONTACT_IN_FUTURE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** RFC 9457 Problem Details, extended with a stable `code` and field errors. */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: errorCodeSchema,
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
