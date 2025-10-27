import { randomUUID } from "crypto";
import OpenAI from "openai";

const apiKey =
  process.env.TUZI_API_KEY ?? process.env.GPT4O_API_KEY ?? "";
const baseURL =
  process.env.TUZI_API_BASE ??
  process.env.GPT4O_API_BASE ??
  "https://api.tu-zi.com/v1";

const MODEL_MAP: Record<string, string> = {
  "gemini-2.5-flash-image": "gemini-2.5-flash-image",
  "doubao-seedance": "doubao-seedance-1-0-pro-250528",
  "gpt-image-1": "gpt-image-1",
};

let client: OpenAI | null = null;

export async function generateImageFromPrompt(params: {
  prompt: string;
  model: string;
  scenario?: string;
}) {
  const resolvedModel = MODEL_MAP[params.model] ?? params.model ?? "gpt-image-1";

  if (!apiKey) {
    return {
      id: randomUUID(),
      url: buildMockUrl(params.prompt),
      model: resolvedModel,
    };
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  const response = await client.images.generate({
    model: resolvedModel,
    prompt: params.prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
  });

  const data = response.data?.[0];
  const url =
    data?.url ??
    (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : buildMockUrl(params.prompt));

  return {
    id: randomUUID(),
    url,
    model: resolvedModel,
  };
}

function buildMockUrl(prompt: string) {
  const encoded = encodeURIComponent(prompt.slice(0, 32));
  return `https://placehold.co/600x600/EEF2FF/1e3a8a?text=${encoded}`;
}
