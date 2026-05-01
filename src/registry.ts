import { InvalidArgs, UnsupportedFeature } from "./errors";
import type { Quality, Size } from "./providers/types";

export interface ModelCapabilities {
  modelId: string;
  providerId: "openai" | "google";
  supportsEdit: boolean;
  supportsMask: boolean;
  validSizes: ReadonlyArray<Size>;
  defaultQuality: Quality;
  maxRefImages: number;
  enabled?: boolean;
}

const CAPABILITIES: Record<string, ModelCapabilities> = {
  "gpt-image-1.5": {
    modelId: "gpt-image-1.5",
    providerId: "openai",
    supportsEdit: true,
    supportsMask: true,
    validSizes: ["auto", "1024x1024", "1536x1024", "1024x1536"],
    defaultQuality: "high",
    maxRefImages: 16,
  },
  "dall-e-3": {
    // Negative-case fixture for non-edit models; also useful reference data.
    modelId: "dall-e-3",
    providerId: "openai",
    supportsEdit: false,
    supportsMask: false,
    validSizes: ["1024x1024", "1792x1024", "1024x1792"],
    defaultQuality: "auto",
    maxRefImages: 0,
    enabled: false,
  },
  "gemini-2.5-flash-image": {
    modelId: "gemini-2.5-flash-image",
    providerId: "google",
    supportsEdit: true,
    supportsMask: false,
    validSizes: ["auto"],
    defaultQuality: "auto",
    maxRefImages: 8,
  },
};

export const KNOWN_MODELS: ReadonlyArray<string> = Object.values(CAPABILITIES)
  .filter((c) => c.enabled !== false)
  .map((c) => c.modelId);

export function modelCapabilities(modelId: string): ModelCapabilities {
  const cap = CAPABILITIES[modelId];
  if (!cap) {
    throw new InvalidArgs(
      `Unknown model "${modelId}". Known: ${KNOWN_MODELS.join(", ")}`,
    );
  }
  return cap;
}

export function providerForModel(modelId: string): "openai" | "google" {
  return modelCapabilities(modelId).providerId;
}

export function listModels(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const cap of Object.values(CAPABILITIES)) {
    if (cap.enabled === false) continue;
    (out[cap.providerId] ??= []).push(cap.modelId);
  }
  return out;
}

export type ValidationRequest =
  | { kind: "generate"; size?: Size }
  | { kind: "edit"; refCount: number; size?: Size; hasMask?: boolean };

export function validateRequest(
  modelId: string,
  req: ValidationRequest,
): void {
  const cap = modelCapabilities(modelId);

  if (req.kind === "edit") {
    if (!cap.supportsEdit) {
      throw new UnsupportedFeature(modelId, "edit");
    }
    if (req.refCount < 1) {
      throw new InvalidArgs(`Edit requires at least 1 reference image`);
    }
    if (req.refCount > cap.maxRefImages) {
      throw new InvalidArgs(
        `Model "${modelId}" supports at most ${cap.maxRefImages} reference images (got ${req.refCount})`,
      );
    }
    if (req.hasMask && !cap.supportsMask) {
      throw new UnsupportedFeature(modelId, "mask");
    }
  }

  if (req.size && req.size !== "auto" && !cap.validSizes.includes(req.size)) {
    throw new InvalidArgs(
      `Model "${modelId}" does not support size "${req.size}". Valid: ${cap.validSizes.join(", ")}`,
    );
  }
}
