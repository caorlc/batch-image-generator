import OpenAI from "openai";

const apiKey =
  process.env.TUZI_API_KEY ?? process.env.NANOBANANA_API_KEY ?? "";
const baseURL =
  process.env.TUZI_API_BASE ??
  process.env.NANOBANANA_API_BASE ??
  "https://api.tu-zi.com/v1";
const model =
  process.env.TUZI_GEMINI_MODEL ??
  process.env.NANOBANANA_MODEL ??
  "gemini-2.5-flash";

let client: OpenAI | null = null;

export async function generateScenes(
  subject: string,
  quantity: number,
  corePrompt: string
) {
  if (!subject.trim()) return [];
  const cappedQuantity = Math.min(Math.max(quantity, 1), 20);

  if (!apiKey) {
    return buildFallbackScenes(subject, cappedQuantity);
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `主题：${subject}\n需求：${corePrompt}\n请生成 ${cappedQuantity} 个不同场景的中文描述，强调动作、地点、氛围。每行「序号. 场景描述」。`,
            },
          ],
        },
      ],
    });

    const rawText =
      (response.output_text as string | undefined) ||
      response.output
        ?.map((item) =>
          item.content
            ?.map((chunk) => ("text" in chunk ? chunk.text ?? "" : ""))
            .join("\n")
        )
        .join("\n") ||
      "";

    const scenes = rawText
      .split("\n")
      .map((line) => line.replace(/^[\\d\\-\\.)\\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, cappedQuantity);

    if (scenes.length === 0) {
      return buildFallbackScenes(subject, cappedQuantity);
    }

    return scenes;
  } catch (error) {
    console.error(
      "[nanoBananaClient] 场景生成失败，回退到模板",
      (error as Error)?.message ?? error
    );
    return buildFallbackScenes(subject, cappedQuantity);
  }
}

function buildFallbackScenes(subject: string, quantity: number) {
  const templates = [
    `${subject} 在日落的海滩上追逐海鸥`,
    `${subject} 在云端城市巡航，脚下是霓虹大厦`,
    `${subject} 在复古集市里与市民互动`,
    `${subject} 漫步在北欧松林的雪地`,
    `${subject} 登上蒸汽朋克飞船探索天空`,
    `${subject} 与孩子们在公园放风筝`,
    `${subject} 在未来实验室操控全息屏`,
    `${subject} 潜入深海，与发光水母共舞`,
    `${subject} 坐在咖啡馆窗边静静阅读`,
    `${subject} 穿梭在古代集市的灯火之间`,
  ];

  return Array.from({ length: quantity }, (_, index) => templates[index % templates.length]);
}
