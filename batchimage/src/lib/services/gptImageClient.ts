import { randomUUID } from "crypto";
import { File as NodeFile } from "node:buffer";
import { lookup as lookupMime } from "mime-types";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

if (typeof File === "undefined") {
  (globalThis as { File?: typeof NodeFile }).File = NodeFile;
}

const apiKey =
  process.env.TUZI_API_KEY ?? process.env.GPT4O_API_KEY ?? "";
const rawBaseURL =
  process.env.TUZI_API_BASE ??
  process.env.GPT4O_API_BASE ??
  "https://api.tu-zi.com/v1";
const normalizedBase = rawBaseURL.replace(/\/+$/, "");
const restBase = normalizedBase.endsWith("/v1") ? normalizedBase : `${normalizedBase}/v1`;

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

  const wantsUrl = resolvedModel.includes("doubao") || resolvedModel.includes("seedream");

  if (resolvedModel.startsWith("doubao")) {
    const response = await fetch(`${restBase}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: resolvedModel,
        prompt: params.prompt,
        n: 1,
        response_format: "url",
        size: "1024x1024",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Doubao request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ url?: string; b64_json?: string }>;
    };

    const url =
      payload.data?.[0]?.url ??
      (payload.data?.[0]?.b64_json
        ? `data:image/png;base64,${payload.data[0].b64_json}`
        : buildMockUrl(params.prompt));

    return {
      id: randomUUID(),
      url,
      model: resolvedModel,
    };
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: rawBaseURL,
    });
  }

  const response = await client.images.generate({
    model: resolvedModel,
    prompt: params.prompt,
    n: 1,
    size: "1024x1024",
    response_format: wantsUrl ? "url" : "b64_json",
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

export async function editImageWithPrompt(params: {
  prompt: string;
  model: string;
  fileName: string;
  buffer: Buffer;
}) {
  const resolvedModel = MODEL_MAP[params.model] ?? params.model ?? "gpt-image-1";

  if (!apiKey) {
    return {
      id: randomUUID(),
      url: buildMockUrl(params.prompt),
      model: resolvedModel,
    };
  }

  const mime = lookupMime(params.fileName) || "image/png";

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: rawBaseURL,
    });
  }

  const imageFile = await toFile(params.buffer, params.fileName, { type: mime });

  const response = await client.images.edit({
    model: resolvedModel,
    prompt: params.prompt,
    image: imageFile,
    size: "1024x1024",
    response_format: "b64_json",
  });

  const data = response.data?.[0];
  const url =
    data?.url ??
    (data?.b64_json
      ? `data:image/png;base64,${data.b64_json}`
      : buildMockUrl(params.prompt));

  return {
    id: randomUUID(),
    url,
    model: resolvedModel,
  };
}
