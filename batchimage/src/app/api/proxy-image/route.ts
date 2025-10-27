import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ message: "缺少 url 参数" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target);
    if (!upstream.ok) {
      return NextResponse.json({ message: "无法拉取图片资源" }, { status: 400 });
    }
    const arrayBuffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message || "代理请求失败" },
      { status: 500 }
    );
  }
}
