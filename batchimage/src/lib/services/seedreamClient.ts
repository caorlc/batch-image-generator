import { randomUUID } from "crypto";
import { lookup as lookupMime } from "mime-types";

const apiKey =
  process.env.TUZI_API_KEY ?? process.env.SEEDREAM_API_KEY ?? "";
const baseURL =
  process.env.TUZI_API_BASE ??
  process.env.SEEDREAM_API_BASE ??
  "https://api.tu-zi.com";

export async function runSeedreamStyleTransfer(params: {
  model: string;
  stylePrompt: string;
  fileName: string;
  buffer: Buffer;
}) {
  if (!params.stylePrompt) {
    throw new Error("Style prompt 不能为空");
  }

  if (!apiKey) {
    return {
      id: randomUUID(),
      url: buildMockUrl(params.stylePrompt),
      model: params.model,
    };
  }

  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.stylePrompt,
    n: 1,
    response_format: "url",
    size: "1024x1024",
  };

  const mime = lookupMime(params.fileName) || "image/png";
  payload.image = `data:${mime};base64,${params.buffer.toString("base64")}`;

  const response = await fetch(`${baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Seedream API 请求失败");
  }

  const data = (await response.json()) as {
    data?: Array<{ url?: string }>;
  };

  const url =
    data.data?.[0]?.url ??
    payload.image?.toString() ??
    buildMockUrl(params.stylePrompt);

  return {
    id: randomUUID(),
    url,
    model: params.model,
  };
}

function buildMockUrl(prompt: string) {
  const encoded = encodeURIComponent(prompt.slice(0, 32));
  return `https://placehold.co/600x600/0f172a/ffffff?text=${encoded}`;
}
