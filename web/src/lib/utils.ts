import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function compressImageFile(file: File, maxMb: number, maxDimension = 4096): Promise<File> {
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size <= maxBytes) {
    return file;
  }

  const image = await createImageBitmap(file);
  let { width, height } = image;

  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, width, height);
  image.close();

  for (const quality of [0.85, 0.7, 0.5, 0.35]) {
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
    if (blob.size <= maxBytes) {
      return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    }
  }

  const ratio = Math.sqrt(maxBytes / (canvas.width * canvas.height * 0.5));
  const finalW = Math.max(1, Math.round(width * ratio));
  const finalH = Math.max(1, Math.round(height * ratio));
  canvas.width = finalW;
  canvas.height = finalH;
  ctx.drawImage(image, 0, 0, finalW, finalH);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.35));
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}
