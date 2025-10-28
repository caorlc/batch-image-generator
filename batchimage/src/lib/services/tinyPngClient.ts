const apiKey = process.env.TINIFY_API_KEY;

const BASIC_AUTH = apiKey
  ? `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`
  : "";

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

  let finalResponse: Response | null = null;

  if (downloadUrl) {
    try {
      const convertResponse = await fetch(downloadUrl, {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          convert: { type: "image/webp" },
        }),
      });

      if (!convertResponse.ok) {
        const errorText = await convertResponse.text();
        console.warn("TinyPNG convert failed, falling back to shrink output", errorText);
      } else {
        const convertedLocation =
          convertResponse.headers.get("location") ||
          convertResponse.headers.get("Location");

        if (convertedLocation) {
          finalResponse = await fetch(convertedLocation, {
            headers: { Authorization: BASIC_AUTH },
          });
        }
      }
    } catch (convertError) {
      console.warn("TinyPNG convert error, fallback to shrink result", convertError);
    }

    if (!finalResponse) {
      finalResponse = await fetch(downloadUrl, {
        method: "GET",
        headers: { Authorization: BASIC_AUTH },
      });
    }
  }

  if (!finalResponse) {
    finalResponse = shrinkResponse;
  }

  if (!finalResponse.ok) {
    throw new Error(await finalResponse.text());
  }

  const finalBuffer = Buffer.from(await finalResponse.arrayBuffer());
  const mimeType =
    finalResponse.headers.get("content-type")?.split(";")[0] ?? "image/webp";
  const dataUrl = `data:${mimeType};base64,${finalBuffer.toString("base64")}`;

  return { url: dataUrl };
}
