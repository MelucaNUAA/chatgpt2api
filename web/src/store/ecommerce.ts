"use client";

import localforage from "localforage";

import type { StoredReferenceImage } from "@/store/image-conversations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextMode = "prompt" | "canvas";

export type TextOverlay = {
  enabled: boolean;
  title: string;
  subtitle: string;
  description: string;
  position: "top" | "center" | "bottom";
  color: string;
};

export type ImageSchemeStatus = "draft" | "generating" | "done" | "error";

export type ImageScheme = {
  id: string;
  type: string;
  prompt: string;
  textOverlay: TextOverlay;
  textMode: TextMode;
  status: ImageSchemeStatus;
  resultImageId?: string;
};

export type GeneratedResultStatus = "loading" | "success" | "error";

export type GeneratedResult = {
  id: string;
  schemeId: string;
  taskId?: string;
  status: GeneratedResultStatus;
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

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const ecommerceStorage = localforage.createInstance({
  name: "chatgpt2api",
  storeName: "ecommerce_projects",
});

const ECOMMERCE_PROJECTS_KEY = "items";
let ecommerceWriteQueue: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeTextOverlay(overlay: Partial<TextOverlay> | undefined): TextOverlay {
  const validPositions: TextOverlay["position"][] = ["top", "center", "bottom"];
  const position = overlay?.position;
  return {
    enabled: overlay?.enabled === true,
    title: typeof overlay?.title === "string" ? overlay.title : "",
    subtitle: typeof overlay?.subtitle === "string" ? overlay.subtitle : "",
    description: typeof overlay?.description === "string" ? overlay.description : "",
    position: position && validPositions.includes(position) ? position : "center",
    color: typeof overlay?.color === "string" ? overlay.color : "#ffffff",
  };
}

function normalizeImageScheme(scheme: Partial<ImageScheme> & Record<string, unknown>): ImageScheme {
  const validStatuses: ImageSchemeStatus[] = ["draft", "generating", "done", "error"];
  const status = scheme.status;
  return {
    id: typeof scheme.id === "string" && scheme.id ? scheme.id : crypto.randomUUID(),
    type: typeof scheme.type === "string" ? scheme.type : "",
    prompt: typeof scheme.prompt === "string" ? scheme.prompt : "",
    textOverlay: normalizeTextOverlay(scheme.textOverlay),
    textMode: scheme.textMode === "canvas" ? "canvas" : "prompt",
    status: status && validStatuses.includes(status as ImageSchemeStatus) ? (status as ImageSchemeStatus) : "draft",
    resultImageId: typeof scheme.resultImageId === "string" ? scheme.resultImageId : undefined,
  };
}

function normalizeGeneratedResult(result: Partial<GeneratedResult> & Record<string, unknown>): GeneratedResult {
  const validStatuses: GeneratedResultStatus[] = ["loading", "success", "error"];
  const status = result.status;
  return {
    id: typeof result.id === "string" && result.id ? result.id : crypto.randomUUID(),
    schemeId: typeof result.schemeId === "string" ? result.schemeId : "",
    taskId: typeof result.taskId === "string" && result.taskId ? result.taskId : undefined,
    status: status && validStatuses.includes(status as GeneratedResultStatus) ? (status as GeneratedResultStatus) : "loading",
    b64_json: typeof result.b64_json === "string" ? result.b64_json : undefined,
    url: typeof result.url === "string" && result.url ? result.url : undefined,
    error: typeof result.error === "string" ? result.error : undefined,
  };
}

function normalizeReferenceImage(image: StoredReferenceImage): StoredReferenceImage {
  return {
    name: image.name || "reference.png",
    type: image.type || "image/png",
    dataUrl: image.dataUrl,
  };
}

function normalizeProject(project: EcommerceProject & Record<string, unknown>): EcommerceProject {
  const productImages = Array.isArray(project.productImages)
    ? project.productImages
        .filter((img): img is StoredReferenceImage => {
          if (!img || typeof img !== "object") return false;
          const candidate = img as StoredReferenceImage;
          return typeof candidate.dataUrl === "string" && candidate.dataUrl.length > 0;
        })
        .map(normalizeReferenceImage)
    : [];

  const schemes = Array.isArray(project.schemes)
    ? project.schemes.map((s) => normalizeImageScheme(s as Partial<ImageScheme> & Record<string, unknown>))
    : [];

  const results = Array.isArray(project.results)
    ? project.results.map((r) => normalizeGeneratedResult(r as Partial<GeneratedResult> & Record<string, unknown>))
    : [];

  return {
    id: typeof project.id === "string" && project.id ? project.id : crypto.randomUUID(),
    productName: typeof project.productName === "string" ? project.productName : "",
    productDescription: typeof project.productDescription === "string" ? project.productDescription : "",
    productImages,
    aspectRatio: typeof project.aspectRatio === "string" ? project.aspectRatio : "1:1",
    imageCount: typeof project.imageCount === "number" ? project.imageCount : null,
    autoPlan: project.autoPlan === true,
    schemes,
    results,
    createdAt: typeof project.createdAt === "string" ? project.createdAt : new Date().toISOString(),
    updatedAt: typeof project.updatedAt === "string" ? project.updatedAt : new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Sorting & helpers
// ---------------------------------------------------------------------------

function sortProjects(projects: EcommerceProject[]): EcommerceProject[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getTimestamp(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function pickLatestProject(current: EcommerceProject, next: EcommerceProject): EcommerceProject {
  return getTimestamp(next.updatedAt) >= getTimestamp(current.updatedAt) ? next : current;
}

// ---------------------------------------------------------------------------
// Write queue
// ---------------------------------------------------------------------------

function queueEcommerceWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = ecommerceWriteQueue.then(operation);
  ecommerceWriteQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// ---------------------------------------------------------------------------
// Internal read
// ---------------------------------------------------------------------------

async function readStoredProjects(): Promise<EcommerceProject[]> {
  const items =
    (await ecommerceStorage.getItem<Array<EcommerceProject & Record<string, unknown>>>(ECOMMERCE_PROJECTS_KEY)) || [];
  return items.map(normalizeProject);
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<EcommerceProject[]> {
  return sortProjects(await readStoredProjects());
}

export async function saveProject(project: EcommerceProject): Promise<void> {
  await queueEcommerceWrite(async () => {
    const items = await readStoredProjects();
    const nextProject = normalizeProject(project);
    const current = items.find((item) => item.id === nextProject.id);
    const persistedProject = current ? pickLatestProject(current, nextProject) : nextProject;
    const nextItems = sortProjects([
      persistedProject,
      ...items.filter((item) => item.id !== persistedProject.id),
    ]);
    await ecommerceStorage.setItem(ECOMMERCE_PROJECTS_KEY, nextItems);
  });
}

export async function deleteProject(id: string): Promise<void> {
  await queueEcommerceWrite(async () => {
    const items = await readStoredProjects();
    await ecommerceStorage.setItem(
      ECOMMERCE_PROJECTS_KEY,
      items.filter((item) => item.id !== id),
    );
  });
}

export async function clearProjects(): Promise<void> {
  await queueEcommerceWrite(async () => {
    await ecommerceStorage.removeItem(ECOMMERCE_PROJECTS_KEY);
  });
}
