import { z } from "zod";
import { calendarDateSchema } from "./common.js";

/** Registers a contact with the lead; it updates lastContactOn and resolves open reminders. */
export const registerContactBodySchema = z.object({
  contactedOn: calendarDateSchema,
  note: z.string().trim().max(1000).optional(),
});
export type RegisterContactBody = z.infer<typeof registerContactBodySchema>;
