import { z } from "zod";

export const quotaValueSchema = z.union([z.number().int().nonnegative(), z.literal("unlimited")]);

export const pricingPlanSchema = z.enum(["go", "go-plus"]);

export const monthlyLimitSchema = z.union([
  z.object({
    amount: z.number().nonnegative(),
    currency: z.literal("USD"),
  }),
  z.literal("unlimited"),
]);

export const pricingEntrySchema = z.object({
  plan: pricingPlanSchema,
  variant: z.string().min(1),
  variantLabel: z.string().min(1),
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cachedRead: z.number().nonnegative().nullable(),
  cachedWrite: z.number().nonnegative().nullable(),
  monthlyLimit: monthlyLimitSchema,
});

export const modelModalitiesSchema = z.object({
  input: z.array(z.string().min(1)),
  output: z.array(z.string().min(1)),
});

export const modelCapabilitiesSchema = z.object({
  attachment: z.boolean().optional(),
  reasoning: z.boolean().optional(),
  toolCall: z.boolean().optional(),
  structuredOutput: z.boolean().optional(),
  temperature: z.boolean().optional(),
  openWeights: z.boolean().optional(),
});

export const modelMetadataSchema = z.object({
  contextLimit: z.number().int().nonnegative(),
  outputLimit: z.number().int().nonnegative(),
  modalities: modelModalitiesSchema.optional(),
  capabilities: modelCapabilitiesSchema.optional(),
  family: z.string().min(1).optional(),
  knowledgeCutoff: z.string().min(1).optional(),
  releaseDate: z.string().min(1).optional(),
  canonicalModelId: z.string().min(1).optional(),
});

export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    provider: z.literal("opencode"),
    plan: z.literal("go"),
    url: z.url(),
  }),
  scrapedAt: z.iso.datetime(),
  models: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        estimatedRequests: z.object({
          fiveHour: quotaValueSchema,
          weekly: quotaValueSchema,
          monthly: quotaValueSchema,
        }),
        pricing: z.array(pricingEntrySchema).optional(),
        metadata: modelMetadataSchema.optional(),
      }),
    )
    .min(1),
});

export type QuotaValue = z.infer<typeof quotaValueSchema>;
export type PricingPlan = z.infer<typeof pricingPlanSchema>;
export type MonthlyLimit = z.infer<typeof monthlyLimitSchema>;
export type PricingEntry = z.infer<typeof pricingEntrySchema>;
export type ModelModalities = z.infer<typeof modelModalitiesSchema>;
export type ModelCapabilities = z.infer<typeof modelCapabilitiesSchema>;
export type ModelMetadata = z.infer<typeof modelMetadataSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotModel = Snapshot["models"][number];
export type EstimatedRequests = SnapshotModel["estimatedRequests"];
