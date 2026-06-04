"use client";

import * as React from "react";
import {
  Trash2,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Wand2,
} from "lucide-react";

import type { ImageScheme, TextMode, TextOverlay } from "@/store/ecommerce";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SchemeCardProps = {
  scheme: ImageScheme;
  onUpdate: (scheme: ImageScheme) => void;
  onDelete: () => void;
  onGenerate: () => void;
};

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ImageScheme["status"],
  { label: string; color: string }
> = {
  draft: { label: "草稿", color: "bg-stone-100 text-stone-600" },
  generating: { label: "生成中", color: "bg-amber-50 text-amber-600" },
  done: { label: "完成", color: "bg-emerald-50 text-emerald-600" },
  error: { label: "失败", color: "bg-red-50 text-red-600" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchemeCard(props: SchemeCardProps) {
  const { scheme, onUpdate, onDelete, onGenerate } = props;
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  const statusCfg = STATUS_CONFIG[scheme.status];

  function updateOverlay<K extends keyof TextOverlay>(
    key: K,
    value: TextOverlay[K],
  ) {
    onUpdate({
      ...scheme,
      textOverlay: { ...scheme.textOverlay, [key]: value },
    });
  }

  const isGenerating = scheme.status === "generating";

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      {/* Main row: badge + prompt + actions */}
      <div className="flex items-start gap-2 p-2.5">
        <Badge
          variant="secondary"
          className={cn("mt-0.5 shrink-0 rounded-md text-[11px]", statusCfg.color)}
        >
          {scheme.type || "未分类"}
        </Badge>

        <Textarea
          placeholder="输入提示词 (英文效果更佳)..."
          value={scheme.prompt}
          onChange={(e) => onUpdate({ ...scheme, prompt: e.target.value })}
          rows={2}
          className="min-h-0 flex-1 resize-none rounded-lg border-0 bg-stone-50 px-2.5 py-1.5 text-xs focus-visible:ring-1"
        />

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOverlayOpen((v) => !v)}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              scheme.textOverlay.enabled
                ? "text-blue-500 hover:bg-blue-50"
                : "text-stone-400 hover:bg-stone-100",
            )}
            title="文字叠加"
          >
            <Wand2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-rose-500"
            title="删除"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={onGenerate}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              scheme.status === "done"
                ? "bg-emerald-100 text-emerald-700"
                : scheme.status === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-stone-900 text-white hover:bg-stone-800 disabled:bg-stone-300",
            )}
          >
            {isGenerating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : scheme.status === "done" ? (
              <CheckCircle2 className="size-3" />
            ) : scheme.status === "error" ? (
              <AlertCircle className="size-3" />
            ) : (
              <ImageIcon className="size-3" />
            )}
            {isGenerating ? "生成中" : scheme.status === "done" ? "重新生成" : scheme.status === "error" ? "重试" : "生成"}
          </button>
        </div>
      </div>

      {/* Text overlay (collapsed by default) */}
      {overlayOpen && (
        <div className="border-t border-stone-100 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={scheme.textOverlay.enabled}
                onCheckedChange={(checked) =>
                  updateOverlay("enabled", checked === true)
                }
                className="size-3"
              />
              <span className="text-stone-500">启用</span>
            </label>

            {(
              [
                { value: "prompt", label: "提示词生成" },
                { value: "canvas", label: "Canvas叠加" },
              ] as const
            ).map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-1 text-xs">
                <input
                  type="radio"
                  name={`tm-${scheme.id}`}
                  value={opt.value}
                  checked={scheme.textMode === opt.value}
                  onChange={() =>
                    onUpdate({ ...scheme, textMode: opt.value as TextMode })
                  }
                  className="accent-stone-600"
                />
                <span className={scheme.textMode === opt.value ? "text-stone-700" : "text-stone-400"}>
                  {opt.label}
                </span>
              </label>
            ))}

            <select
              value={scheme.textOverlay.position}
              onChange={(e) =>
                updateOverlay("position", e.target.value as TextOverlay["position"])
              }
              className="h-6 rounded border border-stone-200 bg-white px-1.5 text-xs text-stone-600"
            >
              <option value="top">顶部</option>
              <option value="center">居中</option>
              <option value="bottom">底部</option>
            </select>

            <input
              type="color"
              value={scheme.textOverlay.color}
              onChange={(e) => updateOverlay("color", e.target.value)}
              className="size-6 cursor-pointer rounded border border-stone-200"
              title="文字颜色"
            />
          </div>

          {scheme.textOverlay.enabled && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-stone-400">主标题</span>
                <Input
                  value={scheme.textOverlay.title}
                  onChange={(e) => updateOverlay("title", e.target.value)}
                  className="h-7 flex-1 rounded-md bg-stone-50 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-stone-400">副标题</span>
                <Input
                  value={scheme.textOverlay.subtitle}
                  onChange={(e) => updateOverlay("subtitle", e.target.value)}
                  className="h-7 flex-1 rounded-md bg-stone-50 text-xs"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] text-stone-400">说明文字</span>
                <Input
                  value={scheme.textOverlay.description}
                  onChange={(e) => updateOverlay("description", e.target.value)}
                  className="h-7 flex-1 rounded-md bg-stone-50 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
