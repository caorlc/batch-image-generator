import { NextResponse } from "next/server";
import { compressImageFromUrl } from "@/lib/services/tinyPngClient";

export async function POST(request: Request) {
  const { images } = await request.json();

  if (!Array.isArray(images) || !images.length) {
    return NextResponse.json({ message: "缺少需要压缩的图片" }, { status: 400 });
  }

  const compressed: Array<{ id: string; url: string }> = [];

  for (const image of images) {
    const result = await compressImageFromUrl(image.url);
    compressed.push({ id: image.id, url: result.url });
  }

  return NextResponse.json({ images: compressed });
}
