import { InvalidArgs, UnsupportedFeature } from "./errors.js";
import type { Quality, Size } from "./providers/types.js";

export interface ModelCapabilities {
  modelId: string;
  providerId: "openai" | "google";
  supportsEdit: boolean;
  supportsMask: boolean;
  validSizes: ReadonlyArray<Size>;
  defaultQuality: Quality;
  qualityValues: ReadonlyArray<Quality>;
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
    qualityValues: ["low", "medium", "high", "auto"],
    maxRefImages: 16,
  },
  "gpt-image-2": {
    modelId: "gpt-image-2",
    providerId: "openai",
    supportsEdit: true,
    supportsMask: true,
    // Popular presets only. The API also accepts any custom WxH where edges are
    // multiples of 16, max edge 3840, aspect <=3:1, total pixels 655,360-8,294,400.
    validSizes: [
      "auto",
      "1024x1024",
      "1536x1024",
      "1024x1536",
      "2048x2048",
      "2048x1152",
      "3840x2160",
      "2160x3840",
    ],
    defaultQuality: "high",
    qualityValues: ["low", "medium", "high", "auto"],
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
    qualityValues: ["auto"], // placeholder; entry is disabled
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
    qualityValues: ["auto"],
    maxRefImages: 8,
  },
  "gemini-3-pro-image-preview": {
    modelId: "gemini-3-pro-image-preview",
    providerId: "google",
    supportsEdit: true,
    supportsMask: false,
    validSizes: ["auto", "1024x1024"],
    defaultQuality: "1k",
    qualityValues: ["1k", "2k", "4k"],
    maxRefImages: 8,
  },
};

const ALIASES: Record<string, string> = {
  "nano-banana": "gemini-2.5-flash-image",
  "nano-banana-pro": "gemini-3-pro-image-preview",
};

export function resolveModelId(input: string): string {
  return ALIASES[input] ?? input;
}

export const KNOWN_MODELS: ReadonlyArray<string> = Object.values(CAPABILITIES)
  .filter((c) => c.enabled !== false)
  .map((c) => c.modelId);

export function modelCapabilities(modelId: string): ModelCapabilities {
  const cap = CAPABILITIES[resolveModelId(modelId)];
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
  | { kind: "generate"; size?: Size; quality?: Quality }
  | { kind: "edit"; refCount: number; size?: Size; hasMask?: boolean; quality?: Quality };

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

  if (req.quality !== undefined && !cap.qualityValues.includes(req.quality)) {
    throw new InvalidArgs(
      `'${req.quality}' not valid for ${modelId}; valid: ${cap.qualityValues.join(", ")}`,
    );
  }
}
