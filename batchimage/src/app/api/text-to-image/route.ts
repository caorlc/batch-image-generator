import { NextResponse } from "next/server";
import { generateImageFromPrompt } from "@/lib/services/gptImageClient";
import type { GeneratedImage } from "@/types/generator";

function prepareReplacementMap(input: Record<string, string>) {
  const map = new Map<string, string>();
  Object.entries(input).forEach(([key, value]) => {
    const trimmedKey = key.trim();
    const trimmedValue = value?.trim() ?? "";
    map.set(trimmedKey, trimmedValue);
    map.set(trimmedKey.toLowerCase(), trimmedValue);
  });
  return map;
}

function applyPlaceholders(template: string, replacements: Map<string, string>) {
  return template.replace(/\[([^\]]+)\]/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    const exact = replacements.get(key);
    if (exact !== undefined && exact !== null && exact !== "") {
      return exact;
    }
    const fallback = replacements.get(key.toLowerCase());
    if (fallback !== undefined && fallback !== null && fallback !== "") {
      return fallback;
    }
    return `[${key}]`;
  });
}

export async function POST(request: Request) {
  const {
    subject,
    model,
    corePrompt,
    scenarios,
    placeholders = {},
    scenarioPlaceholder,
    subjectPlaceholder,
    quantity = 1,
  } = await request.json();

  if (!subject || !corePrompt) {
    return NextResponse.json(
      { message: "Subject 与核心 Prompt 均为必填项" },
      { status: 400 }
    );
  }

  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return NextResponse.json(
      { message: "缺少有效的场景描述" },
      { status: 400 }
    );
  }

  if (!scenarioPlaceholder) {
    return NextResponse.json(
      { message: "缺少场景占位符配置" },
      { status: 400 }
    );
  }

  const baseReplacements: Record<string, string> = {
    ...placeholders,
    "1": String(quantity),
  };

  if (subjectPlaceholder) {
    baseReplacements[subjectPlaceholder] = subject;
  }

  const baseMap = prepareReplacementMap(baseReplacements);

  const images: GeneratedImage[] = [];

  for (const scenario of scenarios) {
    const scenarioText = String(scenario).trim();
    const scenarioMap = new Map(baseMap);
    scenarioMap.set(scenarioPlaceholder, scenarioText);
    scenarioMap.set(scenarioPlaceholder.toLowerCase(), scenarioText);

    const prompt = applyPlaceholders(corePrompt, scenarioMap);
    const { id, url, model: providerModel } = await generateImageFromPrompt({
      prompt,
      model,
      scenario: scenarioText,
    });

    images.push({
      id,
      previewUrl: url,
      promptSummary: scenarioText,
      finalPrompt: prompt,
      model: providerModel,
      mode: "text",
      scenario: scenarioText,
      status: "ready",
    });
  }

  return NextResponse.json({ images });
}
