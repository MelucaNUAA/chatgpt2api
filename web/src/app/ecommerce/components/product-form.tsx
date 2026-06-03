"use client";

import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { useRef, type ClipboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StoredReferenceImage } from "@/store/image-conversations";

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

const aspectRatioOptions = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "9:16", label: "9:16" },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  const handleFilesSelected = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const newImages: StoredReferenceImage[] = await Promise.all(
      imageFiles.map(async (file) => ({
        name: file.name,
        type: file.type,
        dataUrl: await readFileAsDataUrl(file),
      })),
    );

    onProductImagesChange([...productImages, ...newImages]);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;
    event.preventDefault();
    void handleFilesSelected(imageFiles);
  };

  const handleRemoveImage = (index: number) => {
    onProductImagesChange(productImages.filter((_, i) => i !== index));
  };

  const canPlan = projectName.trim().length > 0 && productImages.length > 0;

  return (
    <div className="flex flex-col gap-5" onPaste={handlePaste}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFilesSelected(Array.from(event.target.files || []));
          event.target.value = "";
        }}
      />

      {/* Project Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-stone-700">
          项目名称 <span className="text-red-500">*</span>
        </label>
        <Input
          value={projectName}
          onChange={(event) => onProjectNameChange(event.target.value)}
          placeholder="输入项目名称"
          className="h-10 rounded-xl border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400"
        />
      </div>

      {/* Product Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-stone-700">商品描述</label>
        <Textarea
          value={productDescription}
          onChange={(event) => onProductDescriptionChange(event.target.value)}
          placeholder="描述你的商品特点、风格、目标用户等"
          className="min-h-[100px] resize-none rounded-xl border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 focus-visible:ring-0"
        />
      </div>

      {/* Product Images */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-stone-700">
          商品图片 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {productImages.map((image, index) => (
            <div key={`${image.name}-${index}`} className="group relative size-16 shrink-0">
              <div className="size-16 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                <img
                  src={image.dataUrl}
                  alt={image.name || `商品图 ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 opacity-0 transition group-hover:opacity-100 hover:border-stone-300 hover:text-stone-800"
                aria-label={`移除图片 ${image.name || index + 1}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 bg-stone-50 text-stone-400 transition hover:border-stone-400 hover:text-stone-500"
          >
            <ImagePlus className="size-5" />
            <span className="text-[10px]">上传</span>
          </button>
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-stone-700">图片比例</label>
        <div className="flex flex-wrap gap-2">
          {aspectRatioOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onAspectRatioChange(option.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                aspectRatio === option.value
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-800",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Image Count */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-stone-700">生成数量</label>
        <div className="flex items-center gap-3">
          {!autoPlan && (
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              max="20"
              step="1"
              value={imageCount}
              onChange={(event) => onImageCountChange(event.target.value)}
              className="h-10 w-24 rounded-xl border-stone-200 bg-white text-center text-sm text-stone-900"
            />
          )}
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <Checkbox
              checked={autoPlan}
              onCheckedChange={(checked) => onAutoPlanChange(checked === true)}
              className="border-stone-300 data-[state=checked]:bg-stone-900 data-[state=checked]:text-white"
            />
            AI 自动推荐
          </label>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="button"
        disabled={!canPlan || isPlanning}
        onClick={onPlan}
        className="mt-2 h-11 w-full rounded-full bg-stone-900 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {isPlanning ? (
          <>
            <LoaderCircle className="size-4 animate-spin" />
            生成中...
          </>
        ) : (
          "生成方案"
        )}
      </Button>
    </div>
  );
}
