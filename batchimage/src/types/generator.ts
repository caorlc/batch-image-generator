export type GenerationMode = "text" | "style";

export interface SceneDescription {
  id: string;
  text: string;
}

export interface GeneratedImage {
  id: string;
  previewUrl: string;
  promptSummary: string;
  model: string;
  mode: GenerationMode;
  scenario?: string;
  sourceFileName?: string;
  status: "pending" | "ready" | "compressing" | "compressed";
  compressedUrl?: string;
}

export interface CompressionPayload {
  id: string;
  url: string;
  fileName: string;
}

export interface ApiErrorShape {
  message: string;
  requestId?: string;
}
