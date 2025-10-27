import { NextResponse } from "next/server";
import { generateScenes } from "@/lib/services/nanoBananaClient";

export async function POST(request: Request) {
  const { subject, quantity = 5, corePrompt } = await request.json();

  if (!subject || !corePrompt) {
    return NextResponse.json(
      { message: "Subject 与核心 Prompt 均为必填项" },
      { status: 400 }
    );
  }

  const scenarios = await generateScenes(subject, quantity, corePrompt);
  return NextResponse.json({ scenarios });
}
