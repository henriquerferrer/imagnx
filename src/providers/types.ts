export type Size =
  | "auto"
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "2048x2048"
  | "2048x1152"
  | "3840x2160"
  | "2160x3840"
  | (string & {}); // allow provider-specific custom sizes
export type Quality = "low" | "medium" | "high" | "auto";

export interface GenerateInput {
  prompt: string;
  size?: Size;
  quality?: Quality;
  n?: number;
}

export interface EditInput extends GenerateInput {
  refImages: Uint8Array[];
  mask?: Uint8Array;
}

export interface ImageResult {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  modelId: string;
  promptUsed: string;
}

export interface Provider {
  id: string;
  models: string[];
  generate(modelId: string, input: GenerateInput): Promise<ImageResult[]>;
  edit?(modelId: string, input: EditInput): Promise<ImageResult[]>;
}
