"use client";

import * as React from "react";
import {
  GripVertical,
  Trash2,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react";

import type { ImageScheme, TextMode, TextOverlay } from "@/store/ecommerce";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  { label: string; variant: "default" | "success" | "warning" | "danger" }
> = {
  draft: { label: "草稿", variant: "default" },
  generating: { label: "生成中", variant: "warning" },
  done: { label: "已完成", variant: "success" },
  error: { label: "失败", variant: "danger" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SchemeCard(props: SchemeCardProps) {
  const { scheme, onUpdate, onDelete, onGenerate } = props;
  const [textOverlayOpen, setTextOverlayOpen] = React.useState(
    scheme.textOverlay.enabled,
  );

  const statusCfg = STATUS_CONFIG[scheme.status];

  // -- Update helpers -------------------------------------------------------

  function updateField<K extends keyof ImageScheme>(
    key: K,
    value: ImageScheme[K],
  ) {
    onUpdate({ ...scheme, [key]: value });
  }

  function updateOverlay<K extends keyof TextOverlay>(
    key: K,
    value: TextOverlay[K],
  ) {
    onUpdate({
      ...scheme,
      textOverlay: { ...scheme.textOverlay, [key]: value },
    });
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div className="group rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
        <GripVertical className="size-4 shrink-0 cursor-grab text-stone-300" />

        <Badge variant="secondary" className="shrink-0">
          {scheme.type || "未分类"}
        </Badge>

        <Badge variant={statusCfg.variant} className="shrink-0">
          {statusCfg.label}
        </Badge>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-stone-400 hover:text-rose-500"
          onClick={onDelete}
          title="删除方案"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Prompt */}
      <div className="px-4 pt-3 pb-2">
        <Textarea
          placeholder="输入图片生成提示词 (英文效果更佳)..."
          value={scheme.prompt}
          onChange={(e) => updateField("prompt", e.target.value)}
          className="min-h-20 rounded-xl text-sm"
        />
      </div>

      {/* Text Overlay Section */}
      <div className="px-4 pb-3">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 text-sm font-medium text-stone-500 transition-colors hover:text-stone-700"
          onClick={() => setTextOverlayOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              textOverlayOpen && "rotate-180",
            )}
          />
          文字叠加
        </button>

        {textOverlayOpen && (
          <div className="mt-2 space-y-3 rounded-xl bg-stone-50 p-3">
            {/* Enable toggle */}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={scheme.textOverlay.enabled}
                onCheckedChange={(checked) =>
                  updateOverlay("enabled", checked === true)
                }
              />
              <span className="text-stone-600">启用文字叠加</span>
            </label>

            {/* Text mode radio */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-stone-500">模式：</span>
              {(
                [
                  { value: "prompt", label: "提示词生成" },
                  { value: "canvas", label: "Canvas 叠加" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <input
                    type="radio"
                    name={`textMode-${scheme.id}`}
                    value={opt.value}
                    checked={scheme.textMode === opt.value}
                    onChange={() =>
                      updateField("textMode", opt.value as TextMode)
                    }
                    className="accent-stone-600"
                  />
                  <span
                    className={
                      scheme.textMode === opt.value
                        ? "text-stone-800"
                        : "text-stone-500"
                    }
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>

            {/* Text inputs (shown when enabled) */}
            {scheme.textOverlay.enabled && (
              <div className="space-y-2">
                <Input
                  placeholder="主标题"
                  value={scheme.textOverlay.title}
                  onChange={(e) => updateOverlay("title", e.target.value)}
                  className="h-9 rounded-xl bg-white text-sm"
                />
                <Input
                  placeholder="副标题"
                  value={scheme.textOverlay.subtitle}
                  onChange={(e) => updateOverlay("subtitle", e.target.value)}
                  className="h-9 rounded-xl bg-white text-sm"
                />
                <Input
                  placeholder="补充描述"
                  value={scheme.textOverlay.description}
                  onChange={(e) =>
                    updateOverlay("description", e.target.value)
                  }
                  className="h-9 rounded-xl bg-white text-sm"
                />
                <div className="flex gap-2">
                  <select
                    value={scheme.textOverlay.position}
                    onChange={(e) =>
                      updateOverlay(
                        "position",
                        e.target.value as TextOverlay["position"],
                      )
                    }
                    className="h-9 flex-1 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-stone-300"
                  >
                    <option value="top">顶部</option>
                    <option value="center">居中</option>
                    <option value="bottom">底部</option>
                  </select>
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`color-${scheme.id}`}
                      className="text-sm text-stone-500"
                    >
                      颜色
                    </label>
                    <input
                      id={`color-${scheme.id}`}
                      type="color"
                      value={scheme.textOverlay.color}
                      onChange={(e) => updateOverlay("color", e.target.value)}
                      className="size-7 cursor-pointer rounded border border-stone-200"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="border-t border-stone-100 px-4 py-3">
        <Button
          className={cn(
            "w-full rounded-xl",
            scheme.status === "done" &&
              "bg-emerald-600 hover:bg-emerald-700",
          )}
          variant={scheme.status === "error" ? "destructive" : "default"}
          disabled={scheme.status === "generating"}
          onClick={onGenerate}
        >
          {scheme.status === "generating" && (
            <Loader2 className="size-4 animate-spin" />
          )}
          {scheme.status === "done" && <CheckCircle2 className="size-4" />}
          {scheme.status === "error" && <AlertCircle className="size-4" />}
          {scheme.status === "draft" && <ImageIcon className="size-4" />}
          {scheme.status === "generating"
            ? "生成中..."
            : scheme.status === "done"
              ? "重新生成"
              : scheme.status === "error"
                ? "重新生成"
                : "生成此图"}
        </Button>
      </div>
    </div>
  );
}
