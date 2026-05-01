export interface SavedResult {
  path: string;
  modelId: string;
  mimeType: string;
  costEstimateUsd?: number;
}

export interface SerializedFailure {
  modelId: string;
  message: string;
}

export function formatJsonOutput(
  results: SavedResult[],
  errors: SerializedFailure[],
): string {
  return JSON.stringify({ results, errors }, null, 2);
}
