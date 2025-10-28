"use client";

import { useEffect, useMemo, useState } from "react";
import Dropzone from "react-dropzone";
import Image from "next/image";
import {
  Download,
  FolderDown,
  ImageIcon,
  Loader2,
  Palette,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RangeSlider } from "@/components/ui/range-slider";
import { usePersistentState } from "@/hooks/usePersistentState";
import type { GeneratedImage, GenerationMode } from "@/types/generator";
import { downloadZipBundle } from "@/utils/download";

const TEXT_IMAGE_MODELS = [
  { label: "Gemini 2.5 Flash Image", value: "gemini-2.5-flash-image" },
  { label: "Doubao Seedance", value: "doubao-seedance" },
  { label: "GPT-Image-1", value: "gpt-image-1" },
];

const STYLE_MODELS = [
  { label: "Gemini 2.5 Flash Image", value: "gemini-2.5-flash-image" },
  { label: "Doubao Seedance", value: "doubao-seedance" },
  { label: "GPT-Image-1", value: "gpt-image-1" },
];

const DEFAULT_CORE_PROMPT =
  "prompt: Create [1] coloring pages of [godzilla], [summer time].\nCore Requirements:\nArt Style: Strictly pure black and white line art. Use ONLY solid black and pure white.\nAbsolute Prohibition: No gray, no shades, no gradients, no gray fills, no shadows, no textures. Solid pure white background. yellow tint, yellow spots, dots, noise, grain, texture, shadows, shading, gradients, color, gray, smudges, dirty background, blurry lines\nLine Quality: Thick, continuous, unbroken black lines. High contrast. Suitable for children's coloring.\nContent: Simple, engaging scenes. Large, distinct areas. Minimal fine details. Focus on the character";

type GenerationStage =
  | "idle"
  | "scenes-ready"
  | "generating-images"
  | "ready"
  | "compressing"
  | "compressed";

interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
}

const PLACEHOLDER_REGEX = /\[([^\]]+)\]/g;

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<GenerationMode>("text");
  const [subject, setSubject] = usePersistentState("batch-subject", "godzilla");
  const [corePrompt, setCorePrompt] = usePersistentState(
    "batch-core-prompt",
    DEFAULT_CORE_PROMPT
  );
  const [stylePrompt, setStylePrompt] = usePersistentState(
    "batch-style-prompt",
    "Van Gogh style, vibrant oil painting, cinematic lighting."
  );
  const [quantity, setQuantity] = useState(5);
  const [textModel, setTextModel] = useState(TEXT_IMAGE_MODELS[0].value);
  const [styleModel, setStyleModel] = useState(STYLE_MODELS[0].value);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [stage, setStage] = useState<GenerationStage>("idle");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [placeholderKeys, setPlaceholderKeys] = useState<string[]>([]);
  const [placeholderValues, setPlaceholderValues] = usePersistentState<Record<string, string>>(
    "batch-placeholder-values",
    {}
  );
  const [scenarioPlaceholder, setScenarioPlaceholder] = useState<string | null>(null);
  const [subjectPlaceholder, setSubjectPlaceholder] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      uploads.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [uploads]);

  useEffect(() => {
    if (!previewImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [previewImage]);

  useEffect(() => {
    const matches = Array.from(corePrompt.matchAll(PLACEHOLDER_REGEX)).map((match) =>
      match[1].trim()
    );
    const unique = Array.from(new Set(matches));
    setPlaceholderKeys(unique);

    setPlaceholderValues((prev) => {
      let changed = false;
      const next: Record<string, string> = {};

      unique.forEach((key) => {
        let value = prev[key];
        if (key === "1") {
          value = String(quantity);
        } else if (value === undefined) {
          if (key.toLowerCase().includes("subject") || key.toLowerCase() === subject.toLowerCase()) {
            value = subject;
          } else {
            value = "";
          }
        }
        next[key] = value ?? "";
        if (prev[key] !== next[key]) {
          changed = true;
        }
      });

      if (Object.keys(prev).length !== unique.length) {
        changed = true;
      }

      return changed ? next : prev;
    });

    const normalizedSubject = subject.toLowerCase();
    const candidateSubject =
      unique.find((key) => key.toLowerCase().includes("subject")) ??
      unique.find((key) => key.toLowerCase() === normalizedSubject) ??
      null;

    setSubjectPlaceholder((prevKey) => {
      if (prevKey && unique.includes(prevKey)) {
        return prevKey;
      }
      return candidateSubject;
    });

    setScenarioPlaceholder((prevKey) => {
      if (prevKey && unique.includes(prevKey)) {
        return prevKey;
      }
      return null;
    });
  }, [corePrompt, subject, quantity, setPlaceholderValues]);

  useEffect(() => {
    if (!subjectPlaceholder) return;
    setPlaceholderValues((prev) => {
      if (prev[subjectPlaceholder] === subject) {
        return prev;
      }
      return { ...prev, [subjectPlaceholder]: subject };
    });
  }, [subject, subjectPlaceholder, setPlaceholderValues]);

  useEffect(() => {
    setPlaceholderValues((prev) => {
      if (prev["1"] === undefined) {
        return prev;
      }
      const value = String(quantity);
      if (prev["1"] === value) {
        return prev;
      }
      return { ...prev, "1": value };
    });
  }, [quantity, setPlaceholderValues]);

  useEffect(() => {
    if (activeTab === "style") {
      setScenarios([]);
      if (stage === "scenes-ready") {
        setStage("idle");
      }
    }
  }, [activeTab, stage]);

  const scenarioSeedValue = scenarioPlaceholder
    ? placeholderValues[scenarioPlaceholder] ?? ""
    : "";

  const scenarioLines = useMemo(() => {
    if (!scenarioPlaceholder) return [] as string[];
    return scenarioSeedValue
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [scenarioPlaceholder, scenarioSeedValue]);

  const placeholderMap = useMemo(() => {
    const map: Record<string, string> = {};
    placeholderKeys.forEach((key) => {
      map[key] = placeholderValues[key]?.trim() ?? "";
    });
    if (subjectPlaceholder) {
      map[subjectPlaceholder] = subject;
    }
    const effectiveQuantity = scenarioLines.length > 0 ? scenarioLines.length : quantity;
    map["1"] = String(effectiveQuantity);
    return map;
  }, [placeholderKeys, placeholderValues, subjectPlaceholder, subject, scenarioLines.length, quantity]);

  const selectedImages = useMemo(
    () => images.filter((image) => selectedIds.includes(image.id)),
    [images, selectedIds]
  );

  const placeholdersFilled = useMemo(() => {
    return placeholderKeys.every((key) => {
      if (key === "1") return true;
      if (key === subjectPlaceholder) return Boolean(subject.trim());
      if (key === scenarioPlaceholder) return scenarioLines.length > 0;
      return Boolean(placeholderValues[key]?.trim());
    });
  }, [placeholderKeys, placeholderValues, subject, subjectPlaceholder, scenarioPlaceholder, scenarioLines.length]);

  const isBusy = stage === "generating-images" || stage === "compressing";

  const generationDisabled =
    activeTab === "text"
      ? !subject.trim() ||
        !corePrompt.trim() ||
        !scenarioPlaceholder ||
        scenarioLines.length === 0 ||
        !placeholdersFilled ||
        isBusy
      : uploads.length === 0 || !stylePrompt.trim() || isBusy;

  const hasCompressedResults =
    stage === "compressed" && images.some((img) => Boolean(img.compressedUrl));

  async function handleGenerate() {
    if (generationDisabled) return;
    setError(null);
    setImages([]);
    setSelectedIds([]);
    setPreviewImage(null);

    if (activeTab === "text") {
      if (!scenarioPlaceholder) {
        setError("请先在占位符列表中选择用于生成场景的占位符");
        return;
      }
      if (scenarioLines.length === 0) {
        setError("请在对应占位符中按行填写至少一个场景主题");
        return;
      }

      setScenarios(scenarioLines);
      setStage("scenes-ready");
      return;
    }

    setStage("generating-images");
    setScenarios([]);
    try {
      const generated = await runStyleTransfer();
      setImages(generated);
      setSelectedIds(generated.map((image) => image.id));
      setStage("ready");
    } catch (err) {
      console.error(err);
      setStage("idle");
      setError(err instanceof Error ? err.message : "风格转换失败，请稍后再试。");
    }
  }

  async function handleConfirmScenes() {
    if (!scenarios.length || !scenarioPlaceholder) return;
    try {
      setStage("generating-images");
      const generated = await runTextImageGeneration(scenarios);
      setImages(generated);
      setSelectedIds(generated.map((image) => image.id));
      setStage("ready");
    } catch (err) {
      console.error(err);
      setStage("scenes-ready");
      setError(err instanceof Error ? err.message : "图像生成失败，请稍后再试。");
    }
  }

  async function runTextImageGeneration(scenariosToUse: string[]) {
    const effectiveQuantity = scenariosToUse.length > 0 ? scenariosToUse.length : quantity;
    const response = await fetch("/api/text-to-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        model: textModel,
        corePrompt,
        scenarios: scenariosToUse,
        placeholders: placeholderMap,
        scenarioPlaceholder,
        subjectPlaceholder,
        quantity: effectiveQuantity,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { images: GeneratedImage[] };
    return data.images;
  }

  async function runStyleTransfer() {
    const formData = new FormData();
    formData.set("model", styleModel);
    formData.set("stylePrompt", stylePrompt);
    uploads.forEach((item) => {
      formData.append("images", item.file, item.file.name);
    });

    const response = await fetch("/api/style-transfer", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = (await response.json()) as { images: GeneratedImage[] };
    return data.images;
  }

  async function handleCompress() {
    if (!selectedImages.length) return;
    setStage("compressing");
    setError(null);

    try {
      const response = await fetch("/api/compress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: selectedImages.map((image) => ({
            id: image.id,
            url: image.compressedUrl || image.previewUrl,
            fileName:
              image.sourceFileName || `${image.mode === "text" ? "text" : "style"}-${image.id}.png`,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { images: Array<{ id: string; url: string }> };
      setImages((prev) =>
        prev.map((image) => {
          const compressed = data.images.find((item) => item.id === image.id);
          if (!compressed) return image;
          return { ...image, compressedUrl: compressed.url, status: "compressed" };
        })
      );
      setStage("compressed");
    } catch (err) {
      console.error(err);
      setStage("ready");
      setError(err instanceof Error ? err.message : "压缩失败，请稍后再试。");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (selectedIds.length === images.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(images.map((image) => image.id));
    }
  }

  function handleRemoveUpload(id: string) {
    setUploads((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function handlePlaceholderValueChange(key: string, value: string) {
    setPlaceholderValues((prev) => {
      if (prev[key] === value) return prev;
      return { ...prev, [key]: value };
    });
  }

  if (!isMounted) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-16 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-10 flex flex-col gap-4">
          <p className="text-sm font-medium text-blue-600">AI批量图片生成工具</p>
          <h1 className="text-4xl font-semibold text-slate-900">两种工作流，一站式生成 + 风格转换</h1>
          <p className="max-w-3xl text-base text-slate-500">
            支持批量文本生成与批量风格转换，全流程在本地浏览器与外部 API 闭环完成，生成结果即时筛选、压缩与下载。
          </p>
        </header>

        <section className="mb-6 flex w-full flex-wrap gap-3">
          <button
            className={`flex flex-1 items-center gap-2 rounded-2xl border px-5 py-4 text-left text-base font-medium transition ${
              activeTab === "text"
                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
            }`}
            onClick={() => setActiveTab("text")}
            disabled={isBusy}
          >
            <Sparkles className="h-5 w-5" />
            批量文本生成
          </button>
          <button
            className={`flex flex-1 items-center gap-2 rounded-2xl border px-5 py-4 text-left text-base font-medium transition ${
              activeTab === "style"
                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
            }`}
            onClick={() => setActiveTab("style")}
            disabled={isBusy}
          >
            <Palette className="h-5 w-5" />
            批量风格转换
          </button>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-900">1. 配置生成参数</h2>
            {activeTab === "text" ? (
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">主题 (Subject)</label>
                  <Input
                    value={subject}
                    placeholder="请输入核心对象，例如 labubu"
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={isBusy}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>生成数量</span>
                      <span>
                        当前: <strong className="text-blue-600">{quantity}</strong>
                      </span>
                    </div>
                    <RangeSlider
                      min={1}
                      max={20}
                      value={quantity}
                      onValueChange={setQuantity}
                      disabled={isBusy}
                    />
                  </div>
                  <div className="text-sm text-slate-500">范围 1 - 20，系统顺序逐张生成。</div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">图片生成模型</label>
                  <div className="relative">
                    <select
                      value={textModel}
                      onChange={(event) => setTextModel(event.target.value)}
                      disabled={isBusy}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500"
                    >
                      {TEXT_IMAGE_MODELS.map((modelItem) => (
                        <option key={modelItem.value} value={modelItem.value}>
                          {modelItem.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">占位符配置</p>
                    <span className="text-xs text-slate-500">识别核心 Prompt 中的 [变量]</span>
                  </div>
                  <div className="space-y-4">
                    {placeholderKeys.length === 0 && (
                      <p className="text-xs text-slate-400">
                        当前 Prompt 未检测到任何占位符。
                      </p>
                    )}
                    {placeholderKeys.map((key) => {
                      if (key === "1") {
                        return (
                          <div
                            key={key}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-700">[{key}]</span>
                              <span className="text-xs text-slate-400">自动替换为生成数量</span>
                            </div>
                            <div className="mt-1 text-slate-500">当前值：{quantity}</div>
                          </div>
                        );
                      }

                      const value = placeholderValues[key] ?? "";
                      const isSubject = key === subjectPlaceholder;
                      const isScenario = key === scenarioPlaceholder;

                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-sm font-semibold text-slate-700">
                              [{key}]
                              {isSubject && (
                                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">
                                  主题占位
                                </span>
                              )}
                              {isScenario && (
                                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-600">
                                  场景占位
                                </span>
                              )}
                            </label>
                            {!isSubject && (
                              <label className="flex items-center gap-1 text-xs text-slate-500">
                                <input
                                  type="radio"
                                  name="scenario-placeholder"
                                  checked={isScenario}
                                  onChange={() => setScenarioPlaceholder(key)}
                                />
                                用作场景生成
                              </label>
                            )}
                          </div>
                          {isScenario ? (
                            <Textarea
                              value={value}
                              rows={Math.max(3, value.split("\n").length)}
                              onChange={(event) => handlePlaceholderValueChange(key, event.target.value)}
                              placeholder="请按行输入场景，每行一个短语，例如：summer carnival"
                              disabled={isBusy}
                            />
                          ) : (
                            <Input
                              value={value}
                              onChange={(event) => handlePlaceholderValueChange(key, event.target.value)}
                              placeholder="请输入占位符对应的内容"
                              disabled={isBusy && key !== subjectPlaceholder}
                            />
                          )}
                          {isSubject && (
                            <p className="mt-1 text-xs text-slate-400">此处会在生成时与主题保持同步，若需修改主题请在上方“主题 (Subject)”中编辑。</p>
                          )}
                          {isScenario && (
                            <p className="mt-1 text-xs text-slate-400">
                              系统会按行拆分内容，每行作为一个场景依次生成图片。
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {scenarioPlaceholder === null && placeholderKeys.length > 0 && (
                      <p className="text-xs text-rose-500">请选择一个占位符用于生成场景。</p>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">2. 核心需求 Prompt (本地自动保存)</span>
                    <span className="text-xs text-slate-400">支持多行描述</span>
                  </div>
                  <Textarea
                    rows={6}
                    value={corePrompt}
                    onChange={(event) => setCorePrompt(event.target.value)}
                    placeholder="描述艺术风格、颜色、构图等要求"
                    disabled={isBusy}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">上传图片 (拖拽或点击)</label>
                  <Dropzone
                    onDrop={(acceptedFiles) => {
                      const next = acceptedFiles.slice(0, 20 - uploads.length).map((file) => ({
                        id: crypto.randomUUID(),
                        file,
                        previewUrl: URL.createObjectURL(file),
                      }));
                      setUploads((prev) => [...prev, ...next]);
                    }}
                    multiple
                    disabled={isBusy}
                  >
                    {({ getRootProps, getInputProps }) => (
                      <div
                        {...getRootProps()}
                        className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500 transition hover:border-blue-400 hover:bg-blue-50"
                      >
                        <input {...getInputProps()} />
                        <ImageIcon className="mb-2 h-8 w-8 text-blue-500" />
                        <p>拖拽或点击上传，最多 20 张</p>
                        <p className="text-xs text-slate-400">仅存于本地，不会上传服务器</p>
                      </div>
                    )}
                  </Dropzone>
                  {uploads.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50">
                      {uploads.map((item) => (
                        <li key={item.id} className="flex items-center justify-between px-4 py-2 text-sm text-slate-600">
                          <span className="truncate">{item.file.name}</span>
                          <button
                            onClick={() => handleRemoveUpload(item.id)}
                            className="text-xs text-slate-400 transition hover:text-rose-500"
                            disabled={isBusy}
                          >
                            删除
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">图片生成模型</label>
                  <div className="relative">
                    <select
                      value={styleModel}
                      onChange={(event) => setStyleModel(event.target.value)}
                      disabled={isBusy}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-blue-500"
                    >
                      {STYLE_MODELS.map((modelItem) => (
                        <option key={modelItem.value} value={modelItem.value}>
                          {modelItem.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">风格 Prompt (本地自动保存)</label>
                  <Textarea
                    rows={4}
                    value={stylePrompt}
                    onChange={(event) => setStylePrompt(event.target.value)}
                    placeholder="例如：Van Gogh style, oil painting, neon cyberpunk."
                    disabled={isBusy}
                  />
                </div>
              </div>
            )}
            <div className="mt-6">
              <Button
                onClick={handleGenerate}
                disabled={generationDisabled}
                className="h-12 w-full gap-2 text-base"
              >
                {(isBusy) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {activeTab === "text" ? `开始生成 (${quantity} 张)` : `开始转换 (${uploads.length} 张)`}
              </Button>
              {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200 bg-slate-900/95 p-6 text-white shadow-lg">
            <p className="text-sm uppercase tracking-wide text-blue-200">工作流程</p>
            <ol className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="mt-1 h-6 w-6 rounded-full bg-white/10 text-center text-xs leading-6">1</span>
                <div>
                  <p className="font-semibold">配置参数</p>
                  <p className="text-white/70">主题 / 模型 / Prompt 本地保存，便于复用。</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-6 w-6 rounded-full bg-white/10 text-center text-xs leading-6">2</span>
                <div>
                  <p className="font-semibold">场景生成 & 确认</p>
                  <p className="text-white/70">使用 Gemini 2.5 Flash 输出多场景描述，人工确认后再批量绘制。</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-6 w-6 rounded-full bg-white/10 text-center text-xs leading-6">3</span>
                <div>
                  <p className="font-semibold">筛选 + 压缩</p>
                  <p className="text-white/70">勾选满意结果 → TinyPNG 压缩 → 下载单张或打包。</p>
                </div>
              </li>
            </ol>
            <div className="mt-6 rounded-2xl border border-white/20 bg-white/5 p-4 text-xs text-white/80">
              数据隐私：图片文件仅在浏览器与 API 之间传输，不会落库；LocalStorage 仅存储文本输入。
            </div>
          </aside>
        </div>

        <section className="mt-10 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-400">状态 A</p>
                <h3 className="text-lg font-semibold text-slate-900">生成结果预览与筛选</h3>
              </div>
              {images.length > 0 && stage !== "compressed" && (
                <Button variant="ghost" onClick={handleSelectAll}>
                  {selectedIds.length === images.length ? "取消全选" : "全选"}
                </Button>
              )}
            </header>

            {stage === "idle" && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                生成完成后，图片会在此处批量展示并可勾选。
              </div>
            )}

            {stage === "scenes-ready" && (
              <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-6 text-sm text-blue-900">
                <div>
                  <p className="font-semibold">场景确认</p>
                  <p className="mt-1 text-blue-800/80">
                    以下内容来自占位符输入，请确认 {scenarios.length} 个场景描述后系统将逐条调用所选图片模型生成图片。
                  </p>
                </div>
                <ol className="list-decimal space-y-2 pl-5 text-left">
                  {scenarios.map((scenario, index) => (
                    <li key={index} className="rounded-xl bg-white/70 px-3 py-2 text-slate-700">
                      {scenario}
                    </li>
                  ))}
                </ol>
                <Button className="h-11 w-full gap-2" onClick={handleConfirmScenes}>
                  <Sparkles className="h-4 w-4" />
                  确认场景，开始生成图片
                </Button>
              </div>
            )}

            {stage === "generating-images" && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-blue-50/80 p-4 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在逐张调用图片模型生成，请稍候…
              </div>
            )}

            {(stage === "ready" || stage === "compressed") && (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>共 {images.length} 张</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    已选 {selectedIds.length} 张
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewImage(image)}
                        title="点击放大预览"
                        className="group/image relative h-48 w-full cursor-zoom-in overflow-hidden bg-black/5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      >
                        <Image
                          src={image.compressedUrl || image.previewUrl}
                          alt={image.promptSummary}
                          fill
                          sizes="(min-width: 1024px) 240px, 100vw"
                          className="object-cover transition group-hover/image:scale-[1.02]"
                          unoptimized
                        />
                        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/30 text-xs font-medium tracking-wide text-white group-hover/image:flex">
                          点击放大预览
                        </span>
                      </button>
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{image.model}</p>
                          {image.scenario && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{image.scenario}</p>
                          )}
                        </div>
                        {stage !== "compressed" ? (
                          <Checkbox
                            checked={selectedIds.includes(image.id)}
                            onCheckedChange={() => toggleSelect(image.id)}
                          />
                        ) : image.compressedUrl ? (
                          <Button
                            variant="ghost"
                            className="gap-1 px-2 py-1 text-xs"
                            onClick={() => window.open(image.compressedUrl!, "_blank")}
                          >
                            <Download className="h-3.5 w-3.5" />
                            下载
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                {stage === "ready" && selectedIds.length > 0 && (
                  <Button className="mt-6 h-12 w-full gap-2 text-base" onClick={handleCompress} disabled={stage !== "ready"}>
                    <FolderDown className="h-4 w-4" />
                    确认并压缩已选项 ({selectedIds.length} 项)
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-slate-400">状态 B</p>
                <h3 className="text-lg font-semibold text-slate-900">压缩完成，可供下载</h3>
              </div>
              {hasCompressedResults && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    className="gap-2"
                    disabled={!selectedImages.length}
                    onClick={() => selectedImages.length && downloadZipBundle(selectedImages)}
                  >
                    <Download className="h-4 w-4" />
                    下载已选 (.zip)
                  </Button>
                  <Button variant="primary" className="gap-2" onClick={() => downloadZipBundle(images)}>
                    <Download className="h-4 w-4" />
                    全部下载 (.zip)
                  </Button>
                </div>
              )}
            </header>
            {stage !== "compressed" && stage !== "compressing" && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">
                完成 TinyPNG 压缩后，此区域将展示可下载的图片。
              </div>
            )}
            {stage === "compressing" && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-amber-50 p-4 text-sm text-amber-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在压缩已选图片，请稍候…
              </div>
            )}
            {stage === "compressed" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {images
                  .filter((image) => image.compressedUrl)
                  .map((image) => (
                    <div
                      key={`compressed-${image.id}`}
                      className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewImage(image)}
                        title="点击放大预览"
                        className="group/image relative h-40 w-full cursor-zoom-in overflow-hidden bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      >
                        <Image
                          src={image.compressedUrl!}
                          alt={image.promptSummary}
                          fill
                          sizes="(min-width: 1024px) 220px, 100vw"
                          className="object-cover transition group-hover/image:scale-[1.02]"
                          unoptimized
                        />
                        <span className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/30 text-xs font-medium tracking-wide text-white group-hover/image:flex">
                          点击放大预览
                        </span>
                      </button>
                      <div className="flex items-center justify-between p-3 text-xs text-slate-600">
                        <span className="truncate">{image.model}</span>
                        <Button
                          variant="ghost"
                          className="gap-1 px-2 py-1 text-xs"
                          onClick={() => window.open(image.compressedUrl!, "_blank")}
                        >
                          <Download className="h-3.5 w-3.5" />
                          下载
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {uploads.length > 0 && activeTab === "style" && (
          <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>已选择 {uploads.length} 个文件。</span>
            <button
              className="inline-flex items-center gap-1 text-rose-500 transition hover:text-rose-600"
              onClick={() => {
                uploads.forEach((item) => URL.revokeObjectURL(item.previewUrl));
                setUploads([]);
              }}
            >
              <Trash2 className="h-3 w-3" />
              清空全部
            </button>
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-12"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0"
            onClick={() => setPreviewImage(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute right-6 top-6 rounded-full border border-slate-200 bg-white/80 p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              aria-label="关闭预览"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-100">
              <Image
                src={previewImage.compressedUrl || previewImage.previewUrl}
                alt={previewImage.promptSummary}
                fill
                sizes="(min-width: 1024px) 800px, 100vw"
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{previewImage.model}</p>
              {previewImage.scenario && <p className="text-slate-500">{previewImage.scenario}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
