import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { GeneratedImage } from "@/types/generator";

export async function downloadZipBundle(images: GeneratedImage[]) {
  if (!images.length) return;
  const zip = new JSZip();

  await Promise.all(
    images.map(async (image, index) => {
      const fileName =
        image.sourceFileName ??
        `image-${index + 1}${inferredExtension(image.compressedUrl || image.previewUrl)}`;
      const source = image.compressedUrl || image.previewUrl;
      const response = source.startsWith("data:")
        ? await fetch(source)
        : await fetch(`/api/proxy-image?url=${encodeURIComponent(source)}`);
      const blob = await response.blob();
      zip.file(fileName, blob);
    })
  );

  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `batch-images-${Date.now()}.zip`);
}

function inferredExtension(url: string) {
  const match = url.match(/\\.([a-zA-Z0-9]{3,4})(?:\\?|$)/);
  return match ? `.${match[1]}` : ".png";
}
