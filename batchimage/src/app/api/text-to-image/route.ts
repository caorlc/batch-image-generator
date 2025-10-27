import { NextResponse } from "next/server";
import { generateImageFromPrompt } from "@/lib/services/gptImageClient";
import type { GeneratedImage } from "@/types/generator";

export async function POST(request: Request) {
  const { subject, model, corePrompt, scenarios } = await request.json();

  if (!subject || !corePrompt) {
    return NextResponse.json(
      { message: "Subject 与核心 Prompt 均为必填项" },
      { status: 400 }
    );
  }

  const scenarioList = Array.isArray(scenarios)
    ? scenarios.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  if (!scenarioList.length) {
    return NextResponse.json({ message: "缺少有效的场景描述" }, { status: 400 });
  }

  const cappedScenarios = scenarioList.slice(0, 20);
  const images: GeneratedImage[] = [];

  for (const scenario of cappedScenarios) {
    const prompt = `${subject} | ${scenario} | ${corePrompt}`;
    const { id, url, model: providerModel } = await generateImageFromPrompt({
      prompt,
      model,
      scenario,
    });
    images.push({
      id,
      previewUrl: url,
      promptSummary: prompt,
      model: providerModel,
      mode: "text",
      scenario,
      status: "ready",
    });
  }

  return NextResponse.json({ images });
}
