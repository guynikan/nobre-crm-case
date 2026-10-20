import { z } from "zod";
import { calendarDateSchema, idSchema } from "./common";

/** Registers a contact with the lead; it updates lastContactOn and resolves open reminders. */
export const registerContactBodySchema = z.object({
  contactedOn: calendarDateSchema,
  note: z.string().trim().max(1000).optional(),
});
export type RegisterContactBody = z.infer<typeof registerContactBodySchema>;

export const contactSchema = z.object({
  id: idSchema,
  opportunityId: idSchema,
  contactedOn: calendarDateSchema,
  note: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Contact = z.infer<typeof contactSchema>;

export const contactListSchema = z.object({ data: z.array(contactSchema) });
export type ContactList = z.infer<typeof contactListSchema>;
