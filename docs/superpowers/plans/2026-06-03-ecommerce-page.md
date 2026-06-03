# 电商配图生成页面 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent `/ecommerce` page for AI-driven e-commerce product image generation, where users upload product photos, AI plans multi-dimensional image schemes, and users review before batch generation.

**Architecture:** Left-right split layout. Left panel for product info input, right panel split into scheme editor (top) and result grid (bottom). Frontend calls ChatGPT via `/v1/chat/completions` for AI planning, then uses existing async image task pipeline for generation. Persistence via localforage.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, localforage, sonner (toast), lucide-react icons. Follows existing patterns: `"use client"` pages, `localforage` with write queue, `useAuthGuard()` for auth, `httpRequest` for API calls.

---

## Chunk 1: Foundation — Store, Types, API

### Task 1: Create ecommerce store with types and localforage persistence

**Files:**
- Create: `web/src/store/ecommerce.ts`

**Reference:** `web/src/store/image-conversations.ts` — follow exact same pattern: localforage instance, write queue, normalization, exported async functions.

- [ ] **Step 1: Create the store file with types and localforage setup**

```typescript
// web/src/store/ecommerce.ts
import localforage from "localforage";
import type { StoredReferenceImage } from "@/store/image-conversations";

// --- Types ---

export type TextMode = "prompt" | "canvas";

export type TextOverlay = {
  enabled: boolean;
  title: string;
  subtitle: string;
  description: string;
  position: "top" | "center" | "bottom";
  color: string;
};

export type ImageScheme = {
  id: string;
  type: string;
  prompt: string;
  textOverlay: TextOverlay;
  textMode: TextMode;
  status: "draft" | "generating" | "done" | "error";
  resultImageId?: string;
};

export type GeneratedResult = {
  id: string;
  schemeId: string;
  taskId: string;
  status: "loading" | "success" | "error";
  b64_json?: string;
  url?: string;
  error?: string;
};

export type EcommerceProject = {
  id: string;
  productName: string;
  productDescription: string;
  productImages: StoredReferenceImage[];
  aspectRatio: string;
  imageCount: number | null;
  autoPlan: boolean;
  schemes: ImageScheme[];
  results: GeneratedResult[];
  createdAt: string;
  updatedAt: string;
};

// --- Storage setup ---

const ecommerceStorage = localforage.createInstance({
  name: "chatgpt2api",
  storeName: "ecommerce_projects",
});

const PROJECTS_KEY = "items";

// --- Write queue (same pattern as image-conversations.ts) ---

let writeQueue: Promise<void> = Promise.resolve();

function queueWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

// --- Normalization ---

function normalizeTextOverlay(data: Partial<TextOverlay>): TextOverlay {
  return {
    enabled: data.enabled ?? false,
    title: data.title ?? "",
    subtitle: data.subtitle ?? "",
    description: data.description ?? "",
    position: data.position ?? "bottom",
    color: data.color ?? "#ffffff",
  };
}

function normalizeScheme(data: Partial<ImageScheme>): ImageScheme {
  return {
    id: data.id ?? crypto.randomUUID(),
    type: data.type ?? "未分类",
    prompt: data.prompt ?? "",
    textOverlay: normalizeTextOverlay(data.textOverlay),
    textMode: data.textMode ?? "prompt",
    status: data.status ?? "draft",
    resultImageId: data.resultImageId,
  };
}

function normalizeResult(data: Partial<GeneratedResult>): GeneratedResult {
  return {
    id: data.id ?? crypto.randomUUID(),
    schemeId: data.schemeId ?? "",
    taskId: data.taskId ?? "",
    status: data.status ?? "loading",
    b64_json: data.b64_json,
    url: data.url,
    error: data.error,
  };
}

function normalizeProject(data: Partial<EcommerceProject>): EcommerceProject {
  return {
    id: data.id ?? crypto.randomUUID(),
    productName: data.productName ?? "",
    productDescription: data.productDescription ?? "",
    productImages: data.productImages ?? [],
    aspectRatio: data.aspectRatio ?? "1:1",
    imageCount: data.imageCount ?? null,
    autoPlan: data.autoPlan ?? false,
    schemes: (data.schemes ?? []).map(normalizeScheme),
    results: (data.results ?? []).map(normalizeResult),
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}

// --- Exported API ---

export async function listProjects(): Promise<EcommerceProject[]> {
  const items = await ecommerceStorage.getItem<EcommerceProject[]>(PROJECTS_KEY);
  return (items ?? []).map(normalizeProject);
}

export async function saveProject(project: EcommerceProject): Promise<void> {
  return queueWrite(async () => {
    const items = await listProjects();
    const idx = items.findIndex((p) => p.id === project.id);
    const normalized = normalizeProject({ ...project, updatedAt: new Date().toISOString() });
    if (idx >= 0) {
      items[idx] = normalized;
    } else {
      items.unshift(normalized);
    }
    await ecommerceStorage.setItem(PROJECTS_KEY, items);
  });
}

export async function deleteProject(id: string): Promise<void> {
  return queueWrite(async () => {
    const items = await listProjects();
    await ecommerceStorage.setItem(
      PROJECTS_KEY,
      items.filter((p) => p.id !== id),
    );
  });
}

export async function clearProjects(): Promise<void> {
  return queueWrite(async () => {
    await ecommerceStorage.setItem(PROJECTS_KEY, []);
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd web && npx tsc --noEmit src/store/ecommerce.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/store/ecommerce.ts
git commit -m "feat: 添加电商配图 store 和数据类型定义"
```

---

### Task 2: Add chat completions API function

**Files:**
- Modify: `web/src/lib/api.ts` — add `chatCompletions()` function

**Reference:** Existing API functions in `api.ts` use `httpRequest<T>()` from `@/lib/request`. The backend `/v1/chat/completions` accepts standard OpenAI format with `messages` array.

- [ ] **Step 1: Add the chatCompletions function**

Add after the existing `fetchImageTasks` function (around line 453):

```typescript
export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
};

export type ChatCompletionResponse = {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
};

export async function chatCompletions(
  messages: ChatMessage[],
  model?: string,
): Promise<ChatCompletionResponse> {
  return httpRequest<ChatCompletionResponse>("/v1/chat/completions", {
    method: "POST",
    body: {
      messages,
      ...(model ? { model } : {}),
    },
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat: 添加 chatCompletions API 函数"
```

---

## Chunk 2: AI Planning Logic

### Task 3: Create the scheme planner module

**Files:**
- Create: `web/src/app/ecommerce/lib/scheme-planner.ts`

This module encapsulates the AI planning logic — constructing the prompt, calling chatCompletions, parsing the structured JSON response.

- [ ] **Step 1: Create the planner module**

```typescript
// web/src/app/ecommerce/lib/scheme-planner.ts
import { chatCompletions, type ChatMessage } from "@/lib/api";
import type { ImageScheme, TextOverlay } from "@/store/ecommerce";

type PlanInput = {
  productName: string;
  productDescription: string;
  imageCount: number | null;
  aspectRatio: string;
};

function buildSystemPrompt(): string {
  return `你是一个专业的电商配图规划师。用户会提供商品信息，你需要为其规划一组电商配图方案。

规则：
1. 根据商品特性，规划多个维度的图片：主图、细节展示、使用场景、包装展示等
2. 如果用户指定了图片数量，严格按照该数量生成方案；否则根据商品特性推荐合适数量（3-8张）
3. 每张图片的提示词应该是专业的摄影/设计指令，用英文撰写
4. 为每张图片规划文字叠加内容（主标题、副标题、说明文字），用中文
5. 提示词中不要包含文字指令，文字由前端叠加

你必须返回一个 JSON 数组，不要包含任何其他文字。格式如下：
[
  {
    "type": "图片类型（如：主图、细节展示、使用场景、包装展示等）",
    "prompt": "英文图片生成提示词",
    "textOverlay": {
      "title": "中文主标题",
      "subtitle": "中文副标题",
      "description": "中文说明文字"
    }
  }
]`;
}

function buildUserPrompt(input: PlanInput): string {
  let text = `商品名称：${input.productName}`;
  if (input.productDescription) {
    text += `\n商品描述：${input.productDescription}`;
  }
  text += `\n图片比例：${input.aspectRatio}`;
  if (input.imageCount) {
    text += `\n需要 ${input.imageCount} 张图片`;
  } else {
    text += `\n请根据商品特性推荐合适数量的图片（3-8张）`;
  }
  return text;
}

export async function planSchemes(input: PlanInput): Promise<ImageScheme[]> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(input) },
  ];

  const response = await chatCompletions(messages);
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI 未返回有效内容");
  }

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("AI 返回格式无效，无法解析方案");
  }

  const parsed = JSON.parse(jsonMatch[0]) as Array<{
    type: string;
    prompt: string;
    textOverlay: { title?: string; subtitle?: string; description?: string };
  }>;

  return parsed.map((item) => ({
    id: crypto.randomUUID(),
    type: item.type,
    prompt: item.prompt,
    textOverlay: {
      enabled: true,
      title: item.textOverlay?.title ?? "",
      subtitle: item.textOverlay?.subtitle ?? "",
      description: item.textOverlay?.description ?? "",
      position: "bottom" as const,
      color: "#ffffff",
    },
    textMode: "prompt" as const,
    status: "draft" as const,
  }));
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/ecommerce/lib/scheme-planner.ts
git commit -m "feat: 添加 AI 方案规划模块"
```

---

## Chunk 3: Page Components

### Task 4: Add ecommerce nav item to top-nav

**Files:**
- Modify: `web/src/components/top-nav.tsx` — add `{ href: "/ecommerce", label: "电商配图" }` to `adminNavItems`

- [ ] **Step 1: Add the nav item**

In `top-nav.tsx`, find the `adminNavItems` array and add the ecommerce entry after "画图":

```typescript
const adminNavItems = [
  { href: "/image", label: "画图" },
  { href: "/ecommerce", label: "电商配图" },
  { href: "/accounts", label: "号池管理" },
  // ...rest unchanged
];
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/top-nav.tsx
git commit -m "feat: 在导航栏添加电商配图入口"
```

---

### Task 5: Create the ProductForm component (left panel)

**Files:**
- Create: `web/src/app/ecommerce/components/product-form.tsx`

**Reference:** `web/src/app/image/components/image-composer.tsx` for file upload pattern (hidden input, paste support, preview thumbnails).

- [ ] **Step 1: Create the ProductForm component**

```typescript
"use client";

import { useCallback, useRef } from "react";
import { ImagePlus, LoaderCircle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoredReferenceImage } from "@/store/image-conversations";
import type { EcommerceProject } from "@/store/ecommerce";
import { cn } from "@/lib/utils";

type ProductFormProps = {
  projectName: string;
  productDescription: string;
  aspectRatio: string;
  imageCount: string;
  autoPlan: boolean;
  productImages: StoredReferenceImage[];
  isPlanning: boolean;
  onProjectNameChange: (value: string) => void;
  onProductDescriptionChange: (value: string) => void;
  onAspectRatioChange: (value: string) => void;
  onImageCountChange: (value: string) => void;
  onAutoPlanChange: (value: boolean) => void;
  onProductImagesChange: (images: StoredReferenceImage[]) => void;
  onPlan: () => void;
};

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "9:16", label: "9:16" },
];

export function ProductForm({
  projectName,
  productDescription,
  aspectRatio,
  imageCount,
  autoPlan,
  productImages,
  isPlanning,
  onProjectNameChange,
  onProductDescriptionChange,
  onAspectRatioChange,
  onImageCountChange,
  onAutoPlanChange,
  onProductImagesChange,
  onPlan,
}: ProductFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: File[]) => {
      const newImages: StoredReferenceImage[] = [];
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        newImages.push({ name: file.name, type: file.type, dataUrl });
      }
      onProductImagesChange([...productImages, ...newImages]);
    },
    [productImages, onProductImagesChange],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (files.length > 0) void handleFiles(files);
      event.target.value = "";
    },
    [handleFiles],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const files = Array.from(event.clipboardData.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length > 0) {
        event.preventDefault();
        void handleFiles(files);
      }
    },
    [handleFiles],
  );

  const removeImage = useCallback(
    (index: number) => {
      onProductImagesChange(productImages.filter((_, i) => i !== index));
    },
    [productImages, onProductImagesChange],
  );

  const canPlan = projectName.trim() && productImages.length > 0 && !isPlanning;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6" onPaste={handlePaste}>
      <h2 className="text-lg font-semibold text-stone-900">商品信息</h2>

      {/* Product images upload */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700">商品照片 *</label>
        <div className="flex flex-wrap gap-2">
          {productImages.map((img, i) => (
            <div key={i} className="group relative size-16 overflow-hidden rounded-xl border border-stone-200 sm:size-20">
              <img src={img.dataUrl} alt={img.name} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-stone-300 text-stone-400 transition-colors hover:border-stone-400 hover:text-stone-500 sm:size-20"
          >
            <ImagePlus className="size-5" />
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <p className="text-xs text-stone-400">支持粘贴上传</p>
      </div>

      {/* Product name */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700">产品名称 *</label>
        <Input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="如：无线蓝牙耳机 Pro X1"
        />
      </div>

      {/* Product description */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700">产品描述</label>
        <Textarea
          value={productDescription}
          onChange={(e) => onProductDescriptionChange(e.target.value)}
          placeholder="产品特点、卖点、适用场景等（选填）"
          rows={3}
        />
      </div>

      {/* Aspect ratio */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-stone-700">图片比例</label>
        <div className="flex flex-wrap gap-2">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onAspectRatioChange(r.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                aspectRatio === r.value
                  ? "bg-stone-950 text-white"
                  : "border border-stone-200 bg-white text-stone-600 hover:border-stone-300",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Image count */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-stone-700">图片数量</label>
          <label className="flex items-center gap-1.5 text-xs text-stone-500">
            <input
              type="checkbox"
              checked={autoPlan}
              onChange={(e) => onAutoPlanChange(e.target.checked)}
              className="size-3.5 rounded border-stone-300"
            />
            AI 自动推荐
          </label>
        </div>
        {!autoPlan && (
          <Input
            type="number"
            min={1}
            max={20}
            value={imageCount}
            onChange={(e) => onImageCountChange(e.target.value)}
            placeholder="如：6"
          />
        )}
      </div>

      {/* Plan button */}
      <Button
        onClick={onPlan}
        disabled={!canPlan}
        className="mt-auto w-full rounded-full bg-stone-950 text-white hover:bg-stone-800 disabled:bg-stone-300"
      >
        {isPlanning ? (
          <>
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            AI 规划中...
          </>
        ) : (
          "生成方案"
        )}
      </Button>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/ecommerce/components/product-form.tsx
git commit -m "feat: 添加商品信息表单组件"
```

---

### Task 6: Create the SchemeCard component

**Files:**
- Create: `web/src/app/ecommerce/components/scheme-card.tsx`

- [ ] **Step 1: Create the SchemeCard component**

```typescript
"use client";

import { useState } from "react";
import { GripVertical, Trash2, Wand2, LoaderCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ImageScheme } from "@/store/ecommerce";
import { cn } from "@/lib/utils";

type SchemeCardProps = {
  scheme: ImageScheme;
  onUpdate: (scheme: ImageScheme) => void;
  onDelete: () => void;
  onGenerate: () => void;
};

export function SchemeCard({ scheme, onUpdate, onDelete, onGenerate }: SchemeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const updateOverlay = (field: string, value: string | boolean) => {
    onUpdate({
      ...scheme,
      textOverlay: { ...scheme.textOverlay, [field]: value },
    });
  };

  const isGenerating = scheme.status === "generating";
  const isDone = scheme.status === "done";
  const isError = scheme.status === "error";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="mt-1 cursor-grab text-stone-300">
          <GripVertical className="size-4" />
        </div>
        <Badge variant="secondary" className="shrink-0">
          {scheme.type}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          {isDone && <Check className="size-4 text-green-500" />}
          {isError && <span className="text-xs text-red-500">失败</span>}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Prompt */}
      <div className="mt-3 space-y-2">
        <label className="text-xs font-medium text-stone-500">提示词</label>
        <Textarea
          value={scheme.prompt}
          onChange={(e) => onUpdate({ ...scheme, prompt: e.target.value })}
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Text overlay toggle */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-700"
        >
          <Wand2 className="size-3" />
          文字叠加
          <span className="text-stone-400">
            ({scheme.textOverlay.enabled ? "开启" : "关闭"})
          </span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-2 rounded-xl bg-stone-50 p-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={scheme.textOverlay.enabled}
                onChange={(e) => updateOverlay("enabled", e.target.checked)}
                className="size-3.5 rounded border-stone-300"
              />
              启用文字叠加
            </label>
            {scheme.textOverlay.enabled && (
              <>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 text-xs text-stone-500">
                    <input
                      type="radio"
                      name={`textMode-${scheme.id}`}
                      checked={scheme.textMode === "prompt"}
                      onChange={() => onUpdate({ ...scheme, textMode: "prompt" })}
                      className="size-3"
                    />
                    提示词生成
                  </label>
                  <label className="flex items-center gap-1 text-xs text-stone-500">
                    <input
                      type="radio"
                      name={`textMode-${scheme.id}`}
                      checked={scheme.textMode === "canvas"}
                      onChange={() => onUpdate({ ...scheme, textMode: "canvas" })}
                      className="size-3"
                    />
                    Canvas 叠加
                  </label>
                </div>
                <Input
                  value={scheme.textOverlay.title}
                  onChange={(e) => updateOverlay("title", e.target.value)}
                  placeholder="主标题"
                  className="text-sm"
                />
                <Input
                  value={scheme.textOverlay.subtitle}
                  onChange={(e) => updateOverlay("subtitle", e.target.value)}
                  placeholder="副标题"
                  className="text-sm"
                />
                <Input
                  value={scheme.textOverlay.description}
                  onChange={(e) => updateOverlay("description", e.target.value)}
                  placeholder="说明文字"
                  className="text-sm"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Generate button */}
      <Button
        size="sm"
        onClick={onGenerate}
        disabled={isGenerating || isDone}
        className={cn(
          "mt-3 w-full rounded-full text-xs",
          isDone
            ? "bg-green-100 text-green-700 hover:bg-green-100"
            : "bg-stone-950 text-white hover:bg-stone-800 disabled:bg-stone-300",
        )}
      >
        {isGenerating ? (
          <>
            <LoaderCircle className="mr-1.5 size-3 animate-spin" />
            生成中...
          </>
        ) : isDone ? (
          <>
            <Check className="mr-1.5 size-3" />
            已生成
          </>
        ) : (
          "生成此图"
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/ecommerce/components/scheme-card.tsx
git commit -m "feat: 添加方案卡片组件"
```

---

### Task 7: Create the ResultGrid component

**Files:**
- Create: `web/src/app/ecommerce/components/result-grid.tsx`

**Reference:** `web/src/app/image/components/image-results.tsx` for lightbox pattern.

- [ ] **Step 1: Create the ResultGrid component**

```typescript
"use client";

import { useState } from "react";
import { Download, Maximize2, RefreshCw, X } from "lucide-react";
import type { GeneratedResult } from "@/store/ecommerce";
import { cn } from "@/lib/utils";

type ResultGridProps = {
  results: GeneratedResult[];
  onRetry: (result: GeneratedResult) => void;
};

export function ResultGrid({ results, onRetry }: ResultGridProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-400">
        生成的图片将显示在这里
      </div>
    );
  }

  const getImageSrc = (result: GeneratedResult) => {
    if (result.url) return result.url;
    if (result.b64_json) return `data:image/png;base64,${result.b64_json}`;
    return "";
  };

  const handleDownload = (result: GeneratedResult) => {
    const src = getImageSrc(result);
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `ecommerce-${result.id}.png`;
    a.click();
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {results.map((result) => {
          const src = getImageSrc(result);
          return (
            <div
              key={result.id}
              className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
            >
              {result.status === "loading" && (
                <div className="flex aspect-square items-center justify-center">
                  <div className="size-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
                </div>
              )}
              {result.status === "error" && (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center">
                  <span className="text-xs text-red-500">{result.error ?? "生成失败"}</span>
                  <button
                    type="button"
                    onClick={() => onRetry(result)}
                    className="flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-xs text-white"
                  >
                    <RefreshCw className="size-3" />
                    重试
                  </button>
                </div>
              )}
              {result.status === "success" && src && (
                <>
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(src)}
                      className="rounded-full bg-white/90 p-2 text-stone-700 hover:bg-white"
                    >
                      <Maximize2 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(result)}
                      className="rounded-full bg-white/90 p-2 text-stone-700 hover:bg-white"
                    >
                      <Download className="size-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/ecommerce/components/result-grid.tsx
git commit -m "feat: 添加结果展示网格组件"
```

---

## Chunk 4: Main Page

### Task 8: Create the ecommerce page

**Files:**
- Create: `web/src/app/ecommerce/page.tsx`

**Reference:** `web/src/app/image/page.tsx` for auth gate pattern, state management, task queue.

- [ ] **Step 1: Create the page component**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuthGuard } from "@/lib/auth-provider";
import { createImageEditTask, fetchImageTasks } from "@/lib/api";
import type { ImageTask } from "@/lib/api";
import type { StoredReferenceImage } from "@/store/image-conversations";
import type { EcommerceProject, ImageScheme, GeneratedResult } from "@/store/ecommerce";
import {
  listProjects,
  saveProject,
  deleteProject,
} from "@/store/ecommerce";
import { planSchemes } from "./lib/scheme-planner";
import { ProductForm } from "./components/product-form";
import { SchemeCard } from "./components/scheme-card";
import { ResultGrid } from "./components/result-grid";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function EcommercePage() {
  const { isCheckingAuth, session } = useAuthGuard(["admin"]);
  if (isCheckingAuth || !session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoaderCircle className="size-5 animate-spin text-stone-400" />
      </div>
    );
  }
  return <EcommercePageContent />;
}

function EcommercePageContent() {
  // --- Form state ---
  const [projectName, setProjectName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageCount, setImageCount] = useState("");
  const [autoPlan, setAutoPlan] = useState(false);
  const [productImages, setProductImages] = useState<StoredReferenceImage[]>([]);

  // --- Schemes and results ---
  const [schemes, setSchemes] = useState<ImageScheme[]>([]);
  const [results, setResults] = useState<GeneratedResult[]>([]);

  // --- UI state ---
  const [isPlanning, setIsPlanning] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // --- Refs for stale closure access ---
  const schemesRef = useRef(schemes);
  const resultsRef = useRef(results);
  useEffect(() => { schemesRef.current = schemes; }, [schemes]);
  useEffect(() => { resultsRef.current = results; }, [results]);

  // --- Load last project on mount ---
  useEffect(() => {
    void listProjects().then((projects) => {
      if (projects.length > 0) {
        const p = projects[0];
        setCurrentProjectId(p.id);
        setProjectName(p.productName);
        setProductDescription(p.productDescription);
        setAspectRatio(p.aspectRatio);
        setImageCount(p.imageCount?.toString() ?? "");
        setAutoPlan(p.autoPlan);
        setProductImages(p.productImages);
        setSchemes(p.schemes);
        setResults(p.results);
      }
    });
  }, []);

  // --- Auto-save ---
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const project: EcommerceProject = {
        id: currentProjectId ?? crypto.randomUUID(),
        productName: projectName,
        productDescription,
        productImages,
        aspectRatio,
        imageCount: autoPlan ? null : (parseInt(imageCount) || null),
        autoPlan,
        schemes: schemesRef.current,
        results: resultsRef.current,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCurrentProjectId(project.id);
      void saveProject(project);
    }, 1000);
  }, [currentProjectId, projectName, productDescription, productImages, aspectRatio, imageCount, autoPlan]);

  useEffect(() => {
    if (schemes.length > 0 || results.length > 0) scheduleSave();
  }, [schemes, results, scheduleSave]);

  // --- AI Planning ---
  const handlePlan = useCallback(async () => {
    setIsPlanning(true);
    try {
      const planned = await planSchemes({
        productName: projectName,
        productDescription,
        imageCount: autoPlan ? null : (parseInt(imageCount) || null),
        aspectRatio,
      });
      setSchemes(planned);
      setResults([]);
      toast.success(`已生成 ${planned.length} 个图片方案`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "方案生成失败");
    } finally {
      setIsPlanning(false);
    }
  }, [projectName, productDescription, imageCount, autoPlan, aspectRatio]);

  // --- Build final prompt for a scheme ---
  const buildFinalPrompt = useCallback(
    (scheme: ImageScheme) => {
      let prompt = scheme.prompt;
      if (scheme.textMode === "prompt" && scheme.textOverlay.enabled) {
        const parts: string[] = [];
        if (scheme.textOverlay.title) parts.push(`"${scheme.textOverlay.title}"`);
        if (scheme.textOverlay.subtitle) parts.push(`"${scheme.textOverlay.subtitle}"`);
        if (scheme.textOverlay.description) parts.push(`"${scheme.textOverlay.description}"`);
        if (parts.length > 0) {
          prompt += `\n\nInclude the following text in the image: ${parts.join(", ")}`;
        }
      }
      return prompt;
    },
    [],
  );

  // --- Generate a single scheme ---
  const handleGenerateSingle = useCallback(
    async (scheme: ImageScheme) => {
      if (productImages.length === 0) {
        toast.error("请先上传商品照片");
        return;
      }

      // Update scheme status
      setSchemes((prev) =>
        prev.map((s) => (s.id === scheme.id ? { ...s, status: "generating" as const } : s)),
      );

      const clientTaskId = crypto.randomUUID();
      const resultId = crypto.randomUUID();

      // Add loading result
      const newResult: GeneratedResult = {
        id: resultId,
        schemeId: scheme.id,
        taskId: clientTaskId,
        status: "loading",
      };
      setResults((prev) => [...prev, newResult]);

      try {
        // Convert stored images to Files for the edit API
        const files = await Promise.all(
          productImages.map((img) => dataUrlToFile(img.dataUrl, img.name || "product.png")),
        );

        const prompt = buildFinalPrompt(scheme);
        const task: ImageTask = await createImageEditTask(clientTaskId, files, prompt, undefined, aspectRatio);

        // Poll for completion
        let finalTask = task;
        while (finalTask.status === "queued" || finalTask.status === "running") {
          await sleep(2000);
          const resp = await fetchImageTasks([finalTask.id]);
          if (resp.items.length > 0) finalTask = resp.items[0];
        }

        if (finalTask.status === "success" && finalTask.data) {
          const imgData = finalTask.data[0];
          setResults((prev) =>
            prev.map((r) =>
              r.id === resultId
                ? { ...r, status: "success", b64_json: imgData.b64_json, url: imgData.url }
                : r,
            ),
          );
          setSchemes((prev) =>
            prev.map((s) =>
              s.id === scheme.id ? { ...s, status: "done" as const, resultImageId: resultId } : s,
            ),
          );
          toast.success(`${scheme.type} 生成完成`);
        } else {
          throw new Error(finalTask.error ?? "生成失败");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "生成失败";
        setResults((prev) =>
          prev.map((r) => (r.id === resultId ? { ...r, status: "error", error: msg } : r)),
        );
        setSchemes((prev) =>
          prev.map((s) => (s.id === scheme.id ? { ...s, status: "error" as const } : s)),
        );
        toast.error(`${scheme.type}: ${msg}`);
      }
    },
    [productImages, buildFinalPrompt, aspectRatio],
  );

  // --- Generate all schemes ---
  const handleGenerateAll = useCallback(async () => {
    const pending = schemes.filter((s) => s.status === "draft" || s.status === "error");
    for (const scheme of pending) {
      await handleGenerateSingle(scheme);
    }
  }, [schemes, handleGenerateSingle]);

  // --- Retry a failed result ---
  const handleRetryResult = useCallback(
    (result: GeneratedResult) => {
      const scheme = schemes.find((s) => s.id === result.schemeId);
      if (scheme) void handleGenerateSingle(scheme);
    },
    [schemes, handleGenerateSingle],
  );

  // --- Scheme update/delete ---
  const handleUpdateScheme = useCallback((updated: ImageScheme) => {
    setSchemes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const handleDeleteScheme = useCallback((id: string) => {
    setSchemes((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const hasSchemes = schemes.length > 0;
  const hasPending = schemes.some((s) => s.status === "draft" || s.status === "error");

  return (
    <section className="flex h-[calc(100vh-64px)] flex-col lg:flex-row">
      {/* Left panel - Product form */}
      <div className="w-full shrink-0 border-b border-stone-200 bg-white lg:w-[340px] lg:border-b-0 lg:border-r">
        <ProductForm
          projectName={projectName}
          productDescription={productDescription}
          aspectRatio={aspectRatio}
          imageCount={imageCount}
          autoPlan={autoPlan}
          productImages={productImages}
          isPlanning={isPlanning}
          onProjectNameChange={setProjectName}
          onProductDescriptionChange={setProductDescription}
          onAspectRatioChange={setAspectRatio}
          onImageCountChange={setImageCount}
          onAutoPlanChange={setAutoPlan}
          onProductImagesChange={setProductImages}
          onPlan={() => void handlePlan()}
        />
      </div>

      {/* Right panel */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Scheme editor (top) */}
        <div className="flex-1 overflow-y-auto border-b border-stone-200 p-3 sm:p-4">
          {!hasSchemes ? (
            <div className="flex h-full items-center justify-center text-sm text-stone-400">
              填写商品信息后点击「生成方案」
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-700">
                  图片方案 ({schemes.length})
                </h3>
                {hasPending && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateAll()}
                    className="rounded-full bg-stone-950 px-3 py-1.5 text-xs text-white hover:bg-stone-800"
                  >
                    全部生成
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {schemes.map((scheme) => (
                  <SchemeCard
                    key={scheme.id}
                    scheme={scheme}
                    onUpdate={handleUpdateScheme}
                    onDelete={() => handleDeleteScheme(scheme.id)}
                    onGenerate={() => void handleGenerateSingle(scheme)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Result grid (bottom) */}
        <div className="min-h-[200px] flex-1 overflow-y-auto p-3 sm:p-4">
          <h3 className="mb-3 text-sm font-semibold text-stone-700">
            生成结果 {results.length > 0 && `(${results.filter((r) => r.status === "success").length}/${results.length})`}
          </h3>
          <ResultGrid results={results} onRetry={handleRetryResult} />
        </div>
      </div>
    </section>
  );
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/app/ecommerce/page.tsx
git commit -m "feat: 添加电商配图主页面"
```

---

### Task 9: Build and verify

- [ ] **Step 1: Run the full build**

Run: `cd web && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run lint**

Run: `cd web && pnpm lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: 修复电商配图页面构建问题"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Ecommerce store + types | `web/src/store/ecommerce.ts` |
| 2 | chatCompletions API function | `web/src/lib/api.ts` |
| 3 | AI scheme planner module | `web/src/app/ecommerce/lib/scheme-planner.ts` |
| 4 | Nav item | `web/src/components/top-nav.tsx` |
| 5 | ProductForm component | `web/src/app/ecommerce/components/product-form.tsx` |
| 6 | SchemeCard component | `web/src/app/ecommerce/components/scheme-card.tsx` |
| 7 | ResultGrid component | `web/src/app/ecommerce/components/result-grid.tsx` |
| 8 | Main page | `web/src/app/ecommerce/page.tsx` |
| 9 | Build verification | — |
