import { z } from "zod";

export const quotaValueSchema = z.union([z.number().int().nonnegative(), z.literal("unlimited")]);

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
      }),
    )
    .min(1),
});

export type QuotaValue = z.infer<typeof quotaValueSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type SnapshotModel = Snapshot["models"][number];
export type EstimatedRequests = SnapshotModel["estimatedRequests"];
