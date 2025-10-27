# Batch Image Generator – Architecture & Key Decisions

## 1. High-Level Overview
- **Runtime / Framework**: Next.js 15 (App Router) with React Server Components + Client Components, TypeScript, Tailwind CSS.
- **UI Structure**: Single-page workspace with two tabs – `批量文本生成` (text-to-image) and `批量风格转换` (img-to-img). Tabs share the same layout & selection/compression logic.
- **State Strategy**:
  - Local component state (React hooks) for transient form data & status flags.
  - `usePersistentState` hook abstracts LocalStorage sync for `subject`, `corePrompt`, `stylePrompt`.
  - 以 React hooks (`useState`, `useMemo`) 管理阶段状态：Idle → GeneratingScenes → ScenesReady → GeneratingImages → Ready → Compressing → Compressed。
- **Data Contracts**: unified `GeneratedImage` interface with `id`, `previewUrl`, `compressedUrl`, `sourceScenario`, `sourceUploadName`, `status`.

## 2. UI Flow Per Mode
1. **Stage 1 – 参数配置**
   - Text mode: [`Subject`, `Quantity (1-20)`, `Model`, `Core Prompt`].
   - Style mode: [`Uploads[]`, `Model`, `Style Prompt`].
   - `StartButton` derives CTA label (`开始生成 (X张)` / `开始转换 (X张)`).
   - Inputs disabled while downstream stages run.
2. **Stage 2 – 系统生成**
   - Text mode: `POST /api/text-scenarios` 调用 Gemini 2.5 Flash（nano-banana）输出场景列表，前端展示并等待用户确认；确认后再调用 `POST /api/text-to-image`，按场景顺序逐张生成。
   - Style mode: 客户端上传文件后调用 `POST /api/style-transfer`，服务器端顺序对每个文件执行图生图。
3. **Stage 3 – 结果筛选**
   - 网格展示所有生成结果，可复选勾选满意图片，整体计数展示在摘要条。
   - 在未压缩状态下提供“确认并压缩已选项”按钮。
4. **Stage 4 – 压缩与下载**
   - `POST /api/compress` receives selected image URLs/base64, calls TinyPNG, responds with compressed URLs/blobs.
   - Gallery switches to compressed state, per-card `下载` and header `全部下载(.zip)` (using client-side JSZip bundling).

## 3. Backend Modules (Next.js Route Handlers)
```
src/
├── app/api/text-scenarios/route.ts  # Gemini 2.5 Flash（nano-banana）生成场景
├── app/api/text-to-image/route.ts   # GPT-4o 等模型根据场景批量生图
├── app/api/style-transfer/route.ts  # Seedream 图生图
├── app/api/compress/route.ts        # TinyPNG 压缩
├── app/api/proxy-image/route.ts     # 代理远程图片下载
└── lib/services/
    ├── nanoBananaClient.ts
    ├── gptImageClient.ts
    ├── seedreamClient.ts
    └── tinyPngClient.ts
```
- Service layer normalizes request payloads, hides provider-specific formats, and throws typed errors consumed by API routes.
- API routes **never** persist data; they stream-progress results via `ReadableStream` to keep UI responsive.

## 4. External API Strategy
| Purpose | Model / Provider | Env Vars | Notes |
|---------|------------------|----------|-------|
| Scene text generation | Gemini 2.5 Flash (nano-banana) | `TUZI_API_KEY`, `TUZI_API_BASE` (fallback至旧变量) | 通过 OpenAI Responses API，生成场景列表供确认。|
| Text→Image | `gemini-2.5-flash-image` / `gpt-image-1` / `doubao-seedance-1-0-pro-250528` | 同上 | `images.generate` 单张调用，按场景顺序串行。|
| Img→Img | Seedream 3/4 | 同上 | `POST /v1/images/generations`，上传图像 base64。|
| Compression | TinyPNG | `TINIFY_API_KEY` | `https://api.tinify.com/shrink` 顺序压缩。|

Fallback mechanism: if env is missing, services return deterministic mock payloads (flagged in logs) so UI remains testable offline.

## 5. Download / Storage
- Generated images stored as data URLs in memory; when provider responds with remote URLs, app proxies via `/api/proxy-image?url=...` to circumvent CORS when building ZIP.
- `全部下载` uses `JSZip` client-side to bundle currently selected compressed images.

## 6. Error Handling & UX
- `useState` 状态跟踪错误信息并在 CTA 区域以文本提示。
- 异步处理中禁用按钮并显示 loading。
- 卡片状态标签展示生成/压缩进展，服务器错误会写入 `console.error`。

## 7. Non-Functional Guarantees
- Pure front-end storage; all uploads handled via `File` blobs processed in-browser before streaming to API routes. No persistence on disk/server beyond request lifetime.
- Sequential processing loops to mirror “逐张生成” requirement; `await` ensures single active provider request per mode.
- LocalStorage writes debounced (500ms) to avoid performance hits.

## 8. Testing & Extensibility
- Utility-first components (Button, Input, Slider, Tabs) under `src/components/ui` ensure consistency.
- Service layer easily extendable for new providers; simply add new env + client file and wire into dropdown.
- Future: add worker queue or WebSocket status without refactoring UI due to reducer abstraction.
