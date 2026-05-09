import { z } from "zod"

// Only the fields the CLI renders. The API may return more; we accept
// extras silently (z.object().passthrough() not used because we never
// re-serialize - we just read).

export const meSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
})

export const projectSchema = z.object({
  id: z.number(),
  visibleId: z.string(),
  name: z.string(),
})

export const projectListSchema = z.array(projectSchema)

export const productSchema = z.object({
  id: z.string(),
  object: z.literal("product").optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  features: z
    .array(
      z.object({
        title: z.string(),
        subtitle: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  unlisted: z.boolean().optional(),
  livemode: z.boolean().optional(),
  created: z.union([z.string(), z.number()]).optional(),
})

export const productListSchema = z.array(productSchema)

export const priceSchema = z.object({
  id: z.string(),
  object: z.literal("price").optional(),
  product: z.string(),
  currency: z.string().optional(),
  unit_amount: z.number(),
  type: z.string().optional(),
  tax_mode: z.string().optional(),
  recurring: z
    .object({
      interval: z.string(),
      interval_count: z.number().optional(),
      trial_period_days: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  livemode: z.boolean().optional(),
  created: z.union([z.string(), z.number()]).optional(),
})

export const priceListSchema = z.array(priceSchema)

export const customerSchema = z.object({
  id: z.string(),
  object: z.literal("customer").optional(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  created: z.union([z.string(), z.number()]).optional(),
})

export const customerListSchema = z.array(customerSchema)

export type Me = z.infer<typeof meSchema>
export type Project = z.infer<typeof projectSchema>
export type Product = z.infer<typeof productSchema>
export type Price = z.infer<typeof priceSchema>
export type Customer = z.infer<typeof customerSchema>
