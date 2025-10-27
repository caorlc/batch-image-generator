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
  { label: "Seedream 4.0", value: "seedream-4.0" },
  { label: "Seedream 3.0", value: "seedream-3.0" },
  { label: "Seedream Lite", value: "seedream-lite" },
];

const DEFAULT_CORE_PROMPT =
  "Art Style: Strictly pure black and white line art, bold outlines, no shading.\nResolution: 1024 x 1024.\nRestrictions: child-friendly scenes, simple backgrounds.";

type GenerationStage =
  | "idle"
  | "generating-scenes"
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      uploads.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [uploads]);

  useEffect(() => {
    // 切换到风格模式时清空场景确认阶段
    if (activeTab === "style") {
      setScenarios([]);
      if (stage === "scenes-ready" || stage === "generating-scenes") {
        setStage("idle");
      }
    }
  }, [activeTab, stage]);

  const selectedImages = useMemo(
    () => images.filter((image) => selectedIds.includes(image.id)),
    [images, selectedIds]
  );

  const generationDisabled =
    activeTab === "text"
      ? !subject.trim() || !corePrompt.trim()
      : uploads.length === 0 || !stylePrompt.trim();

  const isBusy =
    stage === "generating-scenes" ||
    stage === "generating-images" ||
    stage === "compressing";

  const hasCompressedResults =
    stage === "compressed" && images.some((img) => Boolean(img.compressedUrl));

  async function handleGenerate() {
    if (generationDisabled || isBusy) return;
    setError(null);
    setImages([]);
    setSelectedIds([]);

    if (activeTab === "text") {
      setStage("generating-scenes");
      setScenarios([]);
      try {
        const response = await fetch("/api/text-scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, quantity, corePrompt }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = (await response.json()) as { scenarios: string[] };
        setScenarios(data.scenarios);
        setStage("scenes-ready");
      } catch (err) {
        console.error(err);
        setStage("idle");
        setError(err instanceof Error ? err.message : "生成场景失败，请稍后重试。");
      }
    } else {
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
  }

  async function handleConfirmScenes() {
    if (!scenarios.length) return;
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
    const response = await fetch("/api/text-to-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        model: textModel,
        corePrompt,
        scenarios: scenariosToUse,
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
                    placeholder="请输入核心对象，例如 godzilla"
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
                      {TEXT_IMAGE_MODELS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
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
                      {STYLE_MODELS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label}
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
              <Button onClick={handleGenerate} disabled={generationDisabled || isBusy} className="h-12 w-full gap-2 text-base">
                {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
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

            {stage === "generating-scenes" && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-blue-50/80 p-4 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在调用 Gemini 2.5 Flash 生成场景，请稍候…
              </div>
            )}

            {stage === "scenes-ready" && (
              <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-6 text-sm text-blue-900">
                <div>
                  <p className="font-semibold">场景确认</p>
                  <p className="mt-1 text-blue-800/80">
                    请确认以下 {scenarios.length} 个场景描述，确认后系统将逐条调用所选图片模型生成图片。
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
                      <div className="relative h-48 w-full overflow-hidden bg-black/5">
                        <Image
                          src={image.compressedUrl || image.previewUrl}
                          alt={image.promptSummary}
                          fill
                          sizes="(min-width: 1024px) 240px, 100vw"
                          className="object-cover transition group-hover:scale-[1.02]"
                          unoptimized
                        />
                      </div>
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
                      <div className="relative h-40 w-full overflow-hidden">
                        <Image
                          src={image.compressedUrl!}
                          alt={image.promptSummary}
                          fill
                          sizes="(min-width: 1024px) 220px, 100vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
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
    </main>
  );
}
