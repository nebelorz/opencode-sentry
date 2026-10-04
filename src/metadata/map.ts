import { modelMetadataSchema, type ModelMetadata } from "../schema/snapshot.ts";

const CAPABILITY_FIELDS = {
  attachment: "attachment",
  reasoning: "reasoning",
  toolCall: "tool_call",
  structuredOutput: "structured_output",
  temperature: "temperature",
  openWeights: "open_weights",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCapabilities(source: Record<string, unknown>): Record<string, boolean> | undefined {
  const capabilities: Record<string, boolean> = {};
  for (const [field, key] of Object.entries(CAPABILITY_FIELDS)) {
    const value = source[key];
    if (typeof value === "boolean") {
      capabilities[field] = value;
    }
  }
  return Object.keys(capabilities).length > 0 ? capabilities : undefined;
}

function readModalities(source: Record<string, unknown>): Record<string, unknown> | undefined {
  const modalities = source.modalities;
  if (!isRecord(modalities)) {
    return undefined;
  }
  return { input: modalities.input, output: modalities.output };
}

export function toModelMetadata(entry: unknown): ModelMetadata {
  if (!isRecord(entry)) {
    throw new Error("models.dev catalog entry is not an object");
  }

  const limits = isRecord(entry.limit) ? entry.limit : undefined;
  const candidate: Record<string, unknown> = {
    contextLimit: limits?.context,
    outputLimit: limits?.output,
  };

  const modalities = readModalities(entry);
  if (modalities) {
    candidate.modalities = modalities;
  }

  const capabilities = readCapabilities(entry);
  if (capabilities) {
    candidate.capabilities = capabilities;
  }

  if (typeof entry.family === "string") {
    candidate.family = entry.family;
  }
  if (typeof entry.knowledge === "string") {
    candidate.knowledgeCutoff = entry.knowledge;
  }
  if (typeof entry.release_date === "string") {
    candidate.releaseDate = entry.release_date;
  }
  if (typeof entry.canonical_model_id === "string") {
    candidate.canonicalModelId = entry.canonical_model_id;
  }

  return modelMetadataSchema.parse(candidate);
}
