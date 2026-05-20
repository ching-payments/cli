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
  businessIdentityId: z.number().nullable().optional(),
  createdAt: z.string().nullable().optional(),
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

export const chargeSchema = z.object({
  id: z.string(),
  object: z.literal("charge").optional(),
  customer: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  card_brand: z.string().nullable().optional(),
  card_last4: z.string().nullable().optional(),
  wallet_method: z.string().nullable().optional(),
  amount: z.number(),
  amount_captured: z.number().nullable().optional(),
  currency: z.string().optional(),
  status: z.string(),
  description: z.string().nullable().optional(),
  captured: z.boolean().optional(),
  capture_method: z.string().optional(),
  authorized_at: z.string().nullable().optional(),
  capturable_until: z.string().nullable().optional(),
  captured_at: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  refunded_amount: z.number().optional(),
  failure_code: z.string().nullable().optional(),
  failure_message: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  created: z.union([z.string(), z.number()]).optional(),
})

export const chargeListSchema = z.array(
  chargeSchema.extend({ customer_name: z.string().nullable().optional() }),
)

// Webhook create response. The signing `secret` (whsec_...) is disclosed
// once here and never returned again, so the create command must surface
// it loudly.
export const webhookSchema = z.object({
  url: z.string(),
  events: z.array(z.string()),
  secret: z.string(),
  active: z.boolean().optional(),
  livemode: z.boolean().optional(),
})

// Webhook list item. No secret - the API never re-discloses it.
export const webhookListItemSchema = z.object({
  id: z.number(),
  url: z.string(),
  events: z.array(z.string()),
  active: z.boolean().optional(),
  livemode: z.boolean().optional(),
  created: z.union([z.string(), z.number()]).nullable().optional(),
})

export const webhookListSchema = z.array(webhookListItemSchema)

// API key create response. The raw `key` (ck_test_/ck_live_...) is
// disclosed once here and never returned again - only `preview` shows up
// in subsequent reads.
export const apiKeySchema = z.object({
  id: z.number(),
  key: z.string(),
  preview: z.string().optional(),
  name: z.string().optional(),
  livemode: z.boolean().optional(),
  active: z.boolean().optional(),
})

// API key as returned in the list (GET /projects/current). `key` is the
// masked preview here, not the raw key.
export const apiKeyListItemSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  livemode: z.boolean().optional(),
  active: z.boolean().optional(),
  key: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.number()]).nullable().optional(),
  lastUsed: z.union([z.string(), z.number()]).nullable().optional(),
})

// We only read the apiKeys array off /projects/current; everything else
// on that payload is ignored.
export const currentProjectSchema = z.object({
  apiKeys: z.array(apiKeyListItemSchema).default([]),
})

// PATCH/DELETE key responses both echo back at least the id.
export const apiKeyMutationSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
})

export type Me = z.infer<typeof meSchema>
export type Project = z.infer<typeof projectSchema>
export type Product = z.infer<typeof productSchema>
export type Price = z.infer<typeof priceSchema>
export type Customer = z.infer<typeof customerSchema>
export type Charge = z.infer<typeof chargeSchema>
export type Webhook = z.infer<typeof webhookSchema>
export type WebhookListItem = z.infer<typeof webhookListItemSchema>
export type ApiKey = z.infer<typeof apiKeySchema>
export type ApiKeyListItem = z.infer<typeof apiKeyListItemSchema>
