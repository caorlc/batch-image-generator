const apiKey = process.env.TINIFY_API_KEY;

const BASIC_AUTH =
  apiKey && `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;

export async function compressImageFromUrl(url: string) {
  if (!url) throw new Error("Invalid image url");
  if (!apiKey || !BASIC_AUTH) {
    return { url };
  }

  const sourceResponse = await fetch(url);
  if (!sourceResponse.ok) {
    throw new Error("无法获取图片资源用于压缩");
  }
  const buffer = Buffer.from(await sourceResponse.arrayBuffer());

  const shrinkResponse = await fetch("https://api.tinify.com/shrink", {
    method: "POST",
    headers: {
      Authorization: BASIC_AUTH,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });

  if (!shrinkResponse.ok) {
    throw new Error(await shrinkResponse.text());
  }

  const downloadUrl =
    shrinkResponse.headers.get("location") ||
    shrinkResponse.headers.get("Location");

  const finalResponse = downloadUrl
    ? await fetch(downloadUrl, {
        headers: { Authorization: BASIC_AUTH },
      })
    : shrinkResponse;

  if (!finalResponse.ok) {
    throw new Error(await finalResponse.text());
  }

  const finalBuffer = Buffer.from(await finalResponse.arrayBuffer());
  const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;

  return { url: dataUrl };
}
