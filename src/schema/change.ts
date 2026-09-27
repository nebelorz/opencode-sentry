import { z } from "zod";

import { quotaValueSchema } from "./snapshot.ts";

const quotaPeriodSchema = z.enum(["fiveHour", "weekly", "monthly"]);

const modelRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const estimatedRequestsSchema = z.object({
  fiveHour: quotaValueSchema,
  weekly: quotaValueSchema,
  monthly: quotaValueSchema,
});

const changeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("model_added"),
    model: modelRefSchema,
    estimatedRequests: estimatedRequestsSchema,
  }),
  z.object({
    type: z.literal("model_removed"),
    model: modelRefSchema,
    previousEstimatedRequests: estimatedRequestsSchema,
  }),
  z.object({
    type: z.literal("quota_changed"),
    model: modelRefSchema,
    quota: z.object({
      period: quotaPeriodSchema,
      previous: quotaValueSchema,
      current: quotaValueSchema,
      change: z.number().nullable(),
      changePercent: z.number().nullable(),
    }),
  }),
]);

export const changeReportSchema = z.object({
  schemaVersion: z.literal(1),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  changes: z.array(changeSchema),
});

export type ChangeReport = z.infer<typeof changeReportSchema>;
export type Change = z.infer<typeof changeSchema>;
