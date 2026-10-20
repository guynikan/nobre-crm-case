import { z } from "zod";

/** Calendar date without time zone, e.g. "2026-10-15". */
export const calendarDateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof calendarDateSchema>;

export const idSchema = z.uuid();

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

/** Query-string boolean: only the literal strings "true" and "false" are accepted. */
export const queryBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
