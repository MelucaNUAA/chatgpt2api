import { chatCompletions } from "@/lib/api";
import type { ChatMessage } from "@/lib/api";
import type { ImageScheme, TextOverlay } from "@/store/ecommerce";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlanInput = {
  productName: string;
  productDescription: string;
  imageCount: number | null;
  aspectRatio: string;
};

type PlannedScheme = {
  type: string;
  prompt: string;
  textOverlay?: {
    enabled?: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    position?: "top" | "center" | "bottom";
    color?: string;
  };
};

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return `你是一个专业的电商图片策划师。根据用户提供的商品信息，为电商营销场景规划一组图片方案。

你需要返回一个 JSON 数组，每个元素包含以下字段：
- "type": 图片类型，简短描述这张图片的用途（如"主图"、"详情页"、"场景图"、"白底图"、"卖点图"、"对比图"、"包装图"等）
- "prompt": 图片生成提示词，用英文撰写，描述需要生成的图片内容，要求详细、专业、适合 AI 图片生成
- "textOverlay": 可选的文字叠加配置对象，当需要在图片上添加文字时提供，包含：
  - "enabled": true
  - "title": 主标题
  - "subtitle": 副标题
  - "description": 补充描述文字
  - "position": 文字位置，可选 "top"、"center"、"bottom"
  - "color": 文字颜色，十六进制色值（如 "#ffffff"）

规划原则：
1. 以提升电商转化率为目标，规划能展示商品卖点和使用场景的图片
2. prompt 用英文撰写，内容详细、具体，包含构图、光影、风格等描述
3. 根据商品特点灵活选择图片类型，不同类型之间应有互补性
4. 当某些图片适合添加营销文字时，提供 textOverlay 配置
5. prompt 不要包含文字排版指令，文字相关需求放在 textOverlay 中

只返回 JSON 数组，不要包含任何其他文字。`;
}

export function buildUserPrompt(input: PlanInput): string {
  const parts: string[] = [
    `商品名称：${input.productName}`,
    `商品描述：${input.productDescription}`,
  ];

  if (input.imageCount !== null && input.imageCount > 0) {
    parts.push(`需要规划 ${input.imageCount} 张图片`);
  } else {
    parts.push("请根据商品特点自行决定需要多少张图片（建议 4-8 张）");
  }

  if (input.aspectRatio) {
    parts.push(`图片比例：${input.aspectRatio}`);
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

function extractJsonArray(text: string): PlannedScheme[] {
  // Try parsing the raw text first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not raw JSON, try code block extraction
  }

  // Try extracting from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // code block content wasn't valid JSON
    }
  }

  // Try finding the first [ ... ] in the text
  const bracketMatch = text.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const parsed = JSON.parse(bracketMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // bracket content wasn't valid JSON
    }
  }

  throw new Error("AI 返回的内容中未找到有效的 JSON 数组");
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_TEXT_OVERLAY: TextOverlay = {
  enabled: false,
  title: "",
  subtitle: "",
  description: "",
  position: "center",
  color: "#ffffff",
};

// ---------------------------------------------------------------------------
// Main planning function
// ---------------------------------------------------------------------------

export async function planSchemes(input: PlanInput): Promise<ImageScheme[]> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(input) },
  ];

  const response = await chatCompletions(messages);
  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("AI 未返回任何内容");
  }

  const planned = extractJsonArray(content);

  return planned.map((item) => {
    const overlay = item.textOverlay;
    return {
      id: crypto.randomUUID(),
      type: typeof item.type === "string" ? item.type : "",
      prompt: typeof item.prompt === "string" ? item.prompt : "",
      textOverlay: {
        ...DEFAULT_TEXT_OVERLAY,
        ...(overlay
          ? {
              enabled: overlay.enabled === true,
              title: typeof overlay.title === "string" ? overlay.title : "",
              subtitle: typeof overlay.subtitle === "string" ? overlay.subtitle : "",
              description: typeof overlay.description === "string" ? overlay.description : "",
              position: ["top", "center", "bottom"].includes(overlay.position as string)
                ? (overlay.position as "top" | "center" | "bottom")
                : "center",
              color: typeof overlay.color === "string" ? overlay.color : "#ffffff",
            }
          : {}),
      },
      textMode: "prompt" as const,
      status: "draft" as const,
    };
  });
}
