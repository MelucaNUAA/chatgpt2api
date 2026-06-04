"use client";

import { useCallback, useState } from "react";
import { Download, Maximize2, RefreshCw, X } from "lucide-react";

import type { GeneratedResult } from "@/store/ecommerce";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ResultGridProps = {
  results: GeneratedResult[];
  onRetry: (result: GeneratedResult) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getImageSrc(result: GeneratedResult): string {
  if (result.url) return result.url;
  if (result.b64_json) return `data:image/png;base64,${result.b64_json}`;
  return "";
}

function downloadImage(result: GeneratedResult): void {
  const src = getImageSrc(result);
  if (!src) return;
  const a = document.createElement("a");
  a.href = src;
  a.download = `ecommerce-${result.id}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingCell() {
  return (
    <div className="flex aspect-square items-center justify-center rounded-xl border border-stone-200 bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
    </div>
  );
}

function ErrorCell({
  result,
  onRetry,
}: {
  result: GeneratedResult;
  onRetry: (result: GeneratedResult) => void;
}) {
  return (
    <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
      <p className="text-sm text-stone-500 line-clamp-3">{result.error ?? "生成失败"}</p>
      <button
        type="button"
        onClick={() => onRetry(result)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-stone-200 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-300"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        重试
      </button>
    </div>
  );
}

function SuccessCell({
  result,
  onPreview,
}: {
  result: GeneratedResult;
  onPreview: (result: GeneratedResult) => void;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-stone-200">
      <img
        src={getImageSrc(result)}
        alt="生成结果"
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onPreview(result)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-stone-700 transition-colors hover:bg-white"
          title="预览"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => downloadImage(result)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-stone-700 transition-colors hover:bg-white"
          title="下载"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({
  result,
  onClose,
}: {
  result: GeneratedResult;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative"
        style={{ maxHeight: "60vh", maxWidth: "60vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={getImageSrc(result)}
          alt="预览"
          className="rounded-lg object-contain"
          style={{ maxHeight: "60vh", maxWidth: "60vw" }}
        />
        <div className="absolute -top-3 -right-3 flex gap-2">
          <button
            type="button"
            onClick={() => downloadImage(result)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-700 shadow-lg transition-colors hover:bg-stone-100"
            title="下载"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-700 shadow-lg transition-colors hover:bg-stone-100"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultGrid
// ---------------------------------------------------------------------------

export function ResultGrid({ results, onRetry }: ResultGridProps) {
  const [previewResult, setPreviewResult] = useState<GeneratedResult | null>(null);

  const handlePreview = useCallback((result: GeneratedResult) => {
    setPreviewResult(result);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewResult(null);
  }, []);

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-stone-400">
        生成的图片将显示在这里
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {results.map((result) => {
          switch (result.status) {
            case "loading":
              return <LoadingCell key={result.id} />;
            case "error":
              return <ErrorCell key={result.id} result={result} onRetry={onRetry} />;
            case "success":
              return (
                <SuccessCell
                  key={result.id}
                  result={result}
                  onPreview={handlePreview}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      {previewResult && (
        <Lightbox result={previewResult} onClose={handleClosePreview} />
      )}
    </>
  );
}
