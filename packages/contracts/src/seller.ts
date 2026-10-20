import { z } from "zod";
import { idSchema } from "./common";

export const sellerSchema = z.object({
  id: idSchema,
  name: z.string(),
});
export type Seller = z.infer<typeof sellerSchema>;

export const sellerListSchema = z.object({ data: z.array(sellerSchema) });
export type SellerList = z.infer<typeof sellerListSchema>;
