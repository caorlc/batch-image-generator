import { NextResponse } from "next/server";
import { runSeedreamStyleTransfer } from "@/lib/services/seedreamClient";
import { editImageWithPrompt } from "@/lib/services/gptImageClient";
import type { GeneratedImage } from "@/types/generator";

export async function POST(request: Request) {
  const formData = await request.formData();
  const stylePrompt = formData.get("stylePrompt")?.toString() ?? "";
  const model = formData.get("model")?.toString() ?? "seedream-4.0";
  const files = formData.getAll("images").filter((item): item is File => item instanceof File);

  if (!files.length) {
    return NextResponse.json({ message: "至少需要上传一张图片" }, { status: 400 });
  }

  if (model.includes("gemini")) {
    return NextResponse.json(
      { message: "当前模型暂不支持图生图，请选择 Doubao Seedance 或 GPT-Image-1。" },
      { status: 400 }
    );
  }

  const isDoubao = model.includes("seedream") || model.includes("seedance");
  const results: GeneratedImage[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { id, url, model: resolvedModel } = isDoubao
      ? await runSeedreamStyleTransfer({
          model,
          stylePrompt,
          fileName: file.name,
          buffer,
        })
      : await editImageWithPrompt({
          model,
          prompt: stylePrompt,
          fileName: file.name,
          buffer,
        });

    results.push({
      id,
      previewUrl: url,
      promptSummary: stylePrompt,
      model: resolvedModel,
      mode: "style",
      sourceFileName: file.name,
      status: "ready",
    });
  }

  return NextResponse.json({ images: results });
}
