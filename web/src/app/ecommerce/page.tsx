"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, FilePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuthGuard } from "@/lib/auth-provider";
import { createImageEditTask, fetchImageTasks } from "@/lib/api";
import type { ImageTask } from "@/lib/api";
import type { StoredReferenceImage } from "@/store/image-conversations";
import type { EcommerceProject, ImageScheme, GeneratedResult } from "@/store/ecommerce";
import { listProjects, saveProject, deleteProject } from "@/store/ecommerce";
import { planSchemes } from "./lib/scheme-planner";
import { ProductForm } from "./components/product-form";
import { SchemeCard } from "./components/scheme-card";
import { ResultGrid } from "./components/result-grid";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, content] = dataUrl.split(",", 2);
  const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const binary = atob(content ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ---------------------------------------------------------------------------
// EcommercePageContent
// ---------------------------------------------------------------------------

function EcommercePageContent() {
  // -- Form state -----------------------------------------------------------
  const [projectName, setProjectName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageCount, setImageCount] = useState("4");
  const [autoPlan, setAutoPlan] = useState(false);
  const [productImages, setProductImages] = useState<StoredReferenceImage[]>([]);

  // -- Data state -----------------------------------------------------------
  const [schemes, setSchemes] = useState<ImageScheme[]>([]);
  const [results, setResults] = useState<GeneratedResult[]>([]);

  // -- UI state -------------------------------------------------------------
  const [isPlanning, setIsPlanning] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<EcommerceProject[]>([]);

  // -- Refs -----------------------------------------------------------------
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schemesRef = useRef(schemes);
  const resultsRef = useRef(results);

  // Keep refs in sync
  useEffect(() => {
    schemesRef.current = schemes;
  }, [schemes]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  // -- Load last project on mount -------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadLastProject = async () => {
      try {
        const allProjects = await listProjects();
        if (cancelled) return;
        setProjects(allProjects);
        if (allProjects.length === 0) return;

        const project = allProjects[0];
        setProjectName(project.productName);
        setProductDescription(project.productDescription);
        setAspectRatio(project.aspectRatio);
        setImageCount(project.imageCount !== null ? String(project.imageCount) : "4");
        setAutoPlan(project.autoPlan);
        setProductImages(project.productImages);
        setSchemes(project.schemes);
        setResults(project.results);
        setCurrentProjectId(project.id);
      } catch {
        // silently ignore load errors
      }
    };

    void loadLastProject();
    return () => {
      cancelled = true;
    };
  }, []);

  // -- Auto-save with 1s debounce -------------------------------------------
  useEffect(() => {
    if (schemes.length === 0 && results.length === 0) return;

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      const project: EcommerceProject = {
        id: currentProjectId ?? createId(),
        productName: projectName,
        productDescription,
        productImages,
        aspectRatio,
        imageCount: autoPlan ? null : Number(imageCount) || null,
        autoPlan,
        schemes: schemesRef.current,
        results: resultsRef.current,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!currentProjectId) {
        setCurrentProjectId(project.id);
      }
      await saveProject(project);
      const updated = await listProjects();
      setProjects(updated);
    }, 1000);

    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [schemes, results, projectName, productDescription, productImages, aspectRatio, imageCount, autoPlan, currentProjectId]);

  // -- Plan -----------------------------------------------------------------
  const handlePlan = useCallback(async () => {
    setIsPlanning(true);
    try {
      const planned = await planSchemes({
        productName: projectName,
        productDescription,
        imageCount: autoPlan ? null : Number(imageCount) || null,
        aspectRatio,
      });
      setSchemes(planned);
      setResults([]);
      toast.success(`已生成 ${planned.length} 个方案`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成方案失败";
      toast.error(message);
    } finally {
      setIsPlanning(false);
    }
  }, [projectName, productDescription, imageCount, autoPlan, aspectRatio]);

  // -- New project -----------------------------------------------------------
  const handleNewProject = useCallback(() => {
    setProjectName("");
    setProductDescription("");
    setAspectRatio("1:1");
    setImageCount("4");
    setAutoPlan(false);
    setProductImages([]);
    setSchemes([]);
    setResults([]);
    setCurrentProjectId(null);
  }, []);

  // -- Delete project --------------------------------------------------------
  const handleDeleteProject = useCallback(async (projectId?: string) => {
    const targetId = projectId ?? currentProjectId;
    if (!targetId) return;
    try {
      await deleteProject(targetId);
      const remaining = await listProjects();
      setProjects(remaining);
      if (targetId === currentProjectId) {
        if (remaining.length > 0) {
          const p = remaining[0];
          setProjectName(p.productName);
          setProductDescription(p.productDescription);
          setAspectRatio(p.aspectRatio);
          setImageCount(p.imageCount !== null ? String(p.imageCount) : "4");
          setAutoPlan(p.autoPlan);
          setProductImages(p.productImages);
          setSchemes(p.schemes);
          setResults(p.results);
          setCurrentProjectId(p.id);
        } else {
          handleNewProject();
        }
      }
      toast.success("项目已删除");
    } catch {
      toast.error("删除失败");
    }
  }, [currentProjectId, handleNewProject]);

  // -- Switch project --------------------------------------------------------
  const handleSwitchProject = useCallback((project: EcommerceProject) => {
    setProjectName(project.productName);
    setProductDescription(project.productDescription);
    setAspectRatio(project.aspectRatio);
    setImageCount(project.imageCount !== null ? String(project.imageCount) : "4");
    setAutoPlan(project.autoPlan);
    setProductImages(project.productImages);
    setSchemes(project.schemes);
    setResults(project.results);
    setCurrentProjectId(project.id);
  }, []);

  // -- Build final prompt ---------------------------------------------------
  const buildFinalPrompt = useCallback(
    (scheme: ImageScheme) => {
      let prompt = scheme.prompt;
      if (
        scheme.textMode === "prompt" &&
        scheme.textOverlay.enabled
      ) {
        const parts: string[] = [];
        if (scheme.textOverlay.title) parts.push(`main title: "${scheme.textOverlay.title}"`);
        if (scheme.textOverlay.subtitle) parts.push(`subtitle: "${scheme.textOverlay.subtitle}"`);
        if (scheme.textOverlay.description) parts.push(`description: "${scheme.textOverlay.description}"`);
        if (parts.length > 0) {
          const position = scheme.textOverlay.position === "top" ? "top" : scheme.textOverlay.position === "bottom" ? "bottom" : "center";
          prompt += `\n\nAdd text overlay on the image at the ${position} area. Text color should be ${scheme.textOverlay.color}. ${parts.join(", ")}.`;
        }
      }
      return prompt;
    },
    [],
  );

  // -- Generate single scheme -----------------------------------------------
  const handleGenerateSingle = useCallback(
    async (scheme: ImageScheme) => {
      // Update scheme status to generating
      setSchemes((prev) =>
        prev.map((s) =>
          s.id === scheme.id ? { ...s, status: "generating" as const } : s,
        ),
      );

      // Create loading result
      const resultId = createId();
      const loadingResult: GeneratedResult = {
        id: resultId,
        schemeId: scheme.id,
        status: "loading",
      };
      setResults((prev) => [
        ...prev.filter((r) => r.schemeId !== scheme.id),
        loadingResult,
      ]);

      try {
        // Convert product images to files
        const files = productImages.map((img, idx) =>
          dataUrlToFile(img.dataUrl, img.name || `product-${idx + 1}.png`),
        );
        const finalPrompt = buildFinalPrompt(scheme);
        const taskId = resultId;
        const task = await createImageEditTask(
          taskId,
          files,
          finalPrompt,
          undefined,
          aspectRatio,
        );

        // Poll until done (with timeout and error tolerance)
        let currentTask: ImageTask = task;
        const deadline = Date.now() + 5 * 60 * 1000; // 5 min timeout
        let emptyPollCount = 0;
        while (currentTask.status === "queued" || currentTask.status === "running") {
          if (Date.now() > deadline) {
            throw new Error("生成超时，请重试");
          }
          await sleep(2000);
          try {
            const taskList = await fetchImageTasks([taskId]);
            if (taskList.items.length > 0) {
              currentTask = taskList.items[0];
              emptyPollCount = 0;
            } else if (taskList.missing_ids.includes(taskId)) {
              // Task not found in backend — may have been cleaned up or owner mismatch
              throw new Error("任务在后端未找到，请重试");
            } else {
              emptyPollCount += 1;
              if (emptyPollCount >= 5) {
                throw new Error("轮询无响应，请重试");
              }
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes("任务在后端未找到")) throw error;
            if (error instanceof Error && error.message.includes("轮询无响应")) throw error;
            // Network hiccup — continue polling
          }
        }

        if (currentTask.status === "success") {
          const first = currentTask.data?.[0];
          const successResult: GeneratedResult = {
            id: resultId,
            schemeId: scheme.id,
            taskId,
            status: "success",
            b64_json: first?.b64_json,
            url: first?.url,
          };
          setResults((prev) =>
            prev.map((r) => (r.id === resultId ? successResult : r)),
          );
          setSchemes((prev) =>
            prev.map((s) =>
              s.id === scheme.id ? { ...s, status: "done" as const } : s,
            ),
          );
          toast.success(`${scheme.type || "图片"} 生成成功`);
        } else {
          const errorMsg = currentTask.error || "生成失败";
          const errorResult: GeneratedResult = {
            id: resultId,
            schemeId: scheme.id,
            taskId,
            status: "error",
            error: errorMsg,
          };
          setResults((prev) =>
            prev.map((r) => (r.id === resultId ? errorResult : r)),
          );
          setSchemes((prev) =>
            prev.map((s) =>
              s.id === scheme.id ? { ...s, status: "error" as const } : s,
            ),
          );
          toast.error(errorMsg);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "生成失败";
        const errorResult: GeneratedResult = {
          id: resultId,
          schemeId: scheme.id,
          status: "error",
          error: message,
        };
        setResults((prev) =>
          prev.map((r) => (r.id === resultId ? errorResult : r)),
        );
        setSchemes((prev) =>
          prev.map((s) =>
            s.id === scheme.id ? { ...s, status: "error" as const } : s,
          ),
        );
        toast.error(message);
      }
    },
    [productImages, buildFinalPrompt, aspectRatio],
  );

  // -- Generate all ---------------------------------------------------------
  const handleGenerateAll = useCallback(async () => {
    const pendingSchemes = schemes.filter(
      (s) => s.status === "draft" || s.status === "error",
    );
    await Promise.all(pendingSchemes.map((scheme) => handleGenerateSingle(scheme)));
  }, [schemes, handleGenerateSingle]);

  // -- Update / delete scheme -----------------------------------------------
  const handleUpdateScheme = useCallback((updatedScheme: ImageScheme) => {
    setSchemes((prev) =>
      prev.map((s) => (s.id === updatedScheme.id ? updatedScheme : s)),
    );
  }, []);

  const handleDeleteScheme = useCallback((schemeId: string) => {
    setSchemes((prev) => prev.filter((s) => s.id !== schemeId));
    setResults((prev) => prev.filter((r) => r.schemeId !== schemeId));
  }, []);

  // -- Retry result ---------------------------------------------------------
  const handleRetryResult = useCallback(
    (result: GeneratedResult) => {
      const scheme = schemes.find((s) => s.id === result.schemeId);
      if (scheme) {
        void handleGenerateSingle(scheme);
      }
    },
    [schemes, handleGenerateSingle],
  );

  // -- Derived state --------------------------------------------------------
  const canGenerateAll = schemes.some(
    (s) => s.status === "draft" || s.status === "error",
  );

  // -- Render ---------------------------------------------------------------
  return (
    <section className="flex h-[calc(100vh-64px)] flex-col overflow-hidden lg:flex-row">
      {/* Left: Product Form */}
      <div className="w-full shrink-0 overflow-y-auto border-b border-stone-200 bg-stone-50/50 p-5 lg:w-[340px] lg:border-b-0 lg:border-r">
        {/* Project management */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewProject}
              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-800"
            >
              <FilePlus className="size-3.5" />
              新建项目
            </button>
            {currentProjectId && (
              <button
                type="button"
                onClick={() => void handleDeleteProject()}
                className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-400 transition-colors hover:border-rose-300 hover:text-rose-500"
              >
                <Trash2 className="size-3.5" />
                删除
              </button>
            )}
          </div>
          {projects.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[11px] text-stone-400">
                <Clock className="size-3" />
                历史记录
              </div>
              <div className="max-h-40 space-y-0.5 overflow-y-auto">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                      currentProjectId === p.id
                        ? "bg-stone-900 text-white"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSwitchProject(p)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="flex-1 truncate">{p.productName || "未命名项目"}</span>
                      <span className="shrink-0 text-[10px] opacity-60">
                        {p.schemes.length}方案
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteProject(p.id); }}
                      className={`shrink-0 rounded p-0.5 transition-colors ${
                        currentProjectId === p.id
                          ? "text-white/60 hover:text-white"
                          : "text-stone-400 opacity-0 group-hover:opacity-100 hover:text-rose-500"
                      }`}
                      title="删除项目"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
          onPlan={handlePlan}
        />
      </div>

      {/* Right: Schemes + Results */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Scheme editor — fixed 45% height */}
        <div className="h-[45%] shrink-0 overflow-y-auto border-b border-stone-200 p-4">
          {schemes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-stone-400">
              填写商品信息后点击 &quot;生成方案&quot; 开始
            </div>
          ) : (
            <>
              {canGenerateAll && (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateAll}
                    className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                  >
                    一键全部生成
                  </button>
                </div>
              )}

              <div className="space-y-2">
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

        {/* Result grid — takes remaining 55% */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ResultGrid results={results} onRetry={handleRetryResult} />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page (auth gate)
// ---------------------------------------------------------------------------

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
