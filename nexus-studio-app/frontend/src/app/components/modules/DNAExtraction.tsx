import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload, Dna, Sparkles, Loader2,
  Trash2, Download, Archive, Film, Image as ImageIcon,
  Wand2, X, ArrowLeft, Search, User, Maximize2,
  Settings
} from "lucide-react";
import { CloneSettingsPanel } from "./CloneSettingsPanel";
import { api, type ImagePromptFromApi } from "../../../services/api";

interface CSVAsset {
  id: string;
  title: string;
  thumbnailUrl: string;
  downloads: number;
  creator: string;
  category: string;
  keywords: string;
}

interface CloneSession {
  id: string;
  asset: CSVAsset;
  currentStep: number; // 0 = idle, 1 = analyze, 2 = image gen, 3 = video gen, 4 = complete
  analyzing: boolean;
  cloning: boolean;
  progress: number;
  clonedImageUrl?: string;
  videoUrl?: string;
  imagePrompt?: string;
  videoPrompt?: string;
}

interface StoredImagePromptMeta {
  source: "generate-cloning-prompts";
  analysis: ImagePromptFromApi | null;
  flowPrompt: string;
  model: string;
  aspect: string;
  count: number;
  resolution: string;
  negativePrompt?: string;
  error?: string;
}

interface StoredVideoPromptMeta {
  source: "flow-video";
  basedOn: "cloned-image";
  flowPrompt: string;
  model: string;
  aspect: string;
  count: number;
  resolution: string;
  duration: string;
  cameraMotion: string;
  negativePrompt?: string;
  error?: string;
}

const DEFAULT_FLOW_IMAGE_MODEL = "Nano Banana Pro";

function mapImageAspectRatio(value: string): string {
  switch (value) {
    case "1:1":
      return "1:1 Square";
    case "9:16":
      return "9:16 Portrait";
    default:
      return "16:9 Landscape";
  }
}

function mapVideoAspectRatio(value: string): string {
  switch (value) {
    case "PORTRAIT (9:16)":
      return "9:16 Portrait";
    case "1:1":
      return "1:1 Square";
    default:
      return "16:9 Landscape";
  }
}

function mapVideoResolution(value: string): string {
  const normalized = value.toUpperCase();
  if (normalized.includes("4K")) return "4K";
  if (normalized.includes("1080")) return "1080p";
  return "720p";
}

function mapVideoModel(value: string): string {
  switch (value) {
    case "VEO 3.1 HIGH QUALITY":
      return "Veo 3.1 - Quality";
    default:
      return "Veo 3.1 - Fast";
  }
}

function buildImageClonePrompt(prompt: ImagePromptFromApi, negativePrompt: string): string {
  const sections: string[] = [];
  if (prompt.scene) sections.push(prompt.scene.trim());
  if (prompt.style) sections.push(`style: ${prompt.style}`);
  if (prompt.shot?.composition) sections.push(`composition: ${prompt.shot.composition}`);
  if (prompt.shot?.lens) sections.push(`lens: ${prompt.shot.lens}`);
  if (prompt.shot?.resolution) sections.push(`target resolution: ${prompt.shot.resolution}`);
  if (prompt.lighting?.primary) sections.push(`primary lighting: ${prompt.lighting.primary}`);
  if (prompt.lighting?.secondary) sections.push(`secondary lighting: ${prompt.lighting.secondary}`);
  if (prompt.lighting?.accents) sections.push(`accents: ${prompt.lighting.accents}`);

  const palette = prompt.color_palette
    ? Object.entries(prompt.color_palette)
        .map(([name, color]) => `${name} ${color}`)
        .join(", ")
    : "";
  if (palette) sections.push(`color palette: ${palette}`);
  if (prompt.constraints?.length) sections.push(`constraints: ${prompt.constraints.join(", ")}`);
  if (prompt.visual_rules?.grain) sections.push(`grain: ${prompt.visual_rules.grain}`);
  if (prompt.visual_rules?.sharpen) sections.push(`sharpen: ${prompt.visual_rules.sharpen}`);

  const avoid = [
    ...(prompt.visual_rules?.prohibited_elements ?? []),
    ...negativePrompt.split(",").map((item) => item.trim()).filter(Boolean),
  ];
  if (avoid.length) sections.push(`avoid: ${Array.from(new Set(avoid)).join(", ")}`);

  return sections.filter(Boolean).join(". ");
}

function buildVideoClonePrompt(imagePrompt: string, cameraMotion: string, duration: string, negativePrompt: string): string {
  const sections = [
    imagePrompt,
    "Animate this cloned image into a polished stock-style video shot.",
    "Preserve the original subject, composition, style, and lighting.",
    cameraMotion ? `Camera motion: ${cameraMotion}.` : "",
    duration ? `Target duration: ${duration}.` : "",
  ];
  const avoid = negativePrompt.split(",").map((item) => item.trim()).filter(Boolean);
  if (avoid.length) sections.push(`Avoid: ${Array.from(new Set(avoid)).join(", ")}.`);
  return sections.filter(Boolean).join(" ");
}

function parseStoredJson<T>(value?: string): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function DNAExtraction() {
  const [assets, setAssets] = useState<CSVAsset[]>([]);
  const [sessions, setSessions] = useState<CloneSession[]>([]);
  const [cloneSettingsExpanded, setCloneSettingsExpanded] = useState(false);
  const [inspectorSession, setInspectorSession] = useState<CloneSession | null>(null);
  const [inspectorType, setInspectorType] = useState<"image" | "video" | null>(null);
  const [cloneMode, setCloneMode] = useState<"keyword" | "creator">("keyword");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  
  // Clone Settings States
  const [imageModel, setImageModel] = useState("FLUX.1.1 PRO");
  const [videoModel, setVideoModel] = useState("VEO 3.1 FAST (DRAFT)");
  const [imageResolution, setImageResolution] = useState("1K");
  const [videoResolution, setVideoResolution] = useState("1080P");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [videoDuration, setVideoDuration] = useState("5s");
  const [cameraMotion, setCameraMotion] = useState("cinematic pan");
  const [videoAspectRatio, setVideoAspectRatio] = useState("LANDSCAPE (16:9)");
  const [autoDownload, setAutoDownload] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [threadCount, setThreadCount] = useState(2);
  const [activeThreads, setActiveThreads] = useState(0);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionsRef = useRef<CloneSession[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const updateSession = (sessionId: string, updates: Partial<CloneSession>) => {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? { ...session, ...updates } : session)));
  };

  const getSession = (sessionId: string) => sessionsRef.current.find((session) => session.id === sessionId);

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const ensureDataUrl = async (source: string) => {
    if (!source) return "";
    if (source.startsWith("data:")) return source;
    try {
      const response = await fetch(source);
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch {
      return source;
    }
  };

  const pollFlowJob = async (
    jobId: string,
    onProgress?: (progress: number) => void
  ): Promise<NonNullable<Awaited<ReturnType<typeof api.flowGenerateStatus>>["result"]>> => {
    while (true) {
      const status = await api.flowGenerateStatus(jobId);
      onProgress?.(status.progress ?? 0);
      if (status.status === "done" && status.result) {
        return status.result;
      }
      if (status.status === "error") {
        throw new Error(status.error ?? "Flow generation failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  const analyzeSession = async (sessionId: string) => {
    const session = getSession(sessionId);
    if (!session) return;

    updateSession(sessionId, {
      currentStep: 1,
      analyzing: true,
      cloning: false,
      progress: 0,
      clonedImageUrl: undefined,
      videoUrl: undefined,
      videoPrompt: undefined,
    });

    try {
      const imageUrl = session.asset.thumbnailUrl?.startsWith("data:") ? session.asset.thumbnailUrl : session.asset.thumbnailUrl;
      const res = await api.generateCloningPrompts({
        images: [{ url: imageUrl ?? "", title: session.asset.title, id: session.asset.id }],
      });
      const prompts = res.prompts ?? [];
      const firstPrompt = prompts[0];
      const flowImagePrompt = firstPrompt ? buildImageClonePrompt(firstPrompt, negativePrompt) : "";
      if (!flowImagePrompt) {
        throw new Error("No cloning prompt was returned for the selected asset.");
      }

      const imagePromptMeta: StoredImagePromptMeta = {
        source: "generate-cloning-prompts",
        analysis: firstPrompt ?? null,
        flowPrompt: flowImagePrompt,
        model: DEFAULT_FLOW_IMAGE_MODEL,
        aspect: mapImageAspectRatio(aspectRatio),
        count: 1,
        resolution: imageResolution,
        negativePrompt: negativePrompt || undefined,
      };

      updateSession(sessionId, {
        currentStep: 1,
        analyzing: false,
        progress: 100,
        imagePrompt: JSON.stringify(imagePromptMeta, null, 2),
      });
    } catch (error) {
      const fallback: StoredImagePromptMeta = {
        source: "generate-cloning-prompts",
        analysis: null,
        flowPrompt: "",
        model: DEFAULT_FLOW_IMAGE_MODEL,
        aspect: mapImageAspectRatio(aspectRatio),
        count: 1,
        resolution: imageResolution,
        negativePrompt: negativePrompt || undefined,
        error: error instanceof Error ? error.message : "Cloning prompt request failed.",
      };
      updateSession(sessionId, {
        currentStep: 1,
        analyzing: false,
        progress: 0,
        imagePrompt: JSON.stringify(fallback, null, 2),
      });
    }
  };

  const generateImageForSession = async (sessionId: string) => {
    const session = getSession(sessionId);
    if (!session) return;

    const storedImagePrompt = parseStoredJson<StoredImagePromptMeta>(session.imagePrompt);
    if (!storedImagePrompt?.flowPrompt) {
      updateSession(sessionId, {
        currentStep: 1,
        cloning: false,
        progress: 0,
        imagePrompt: JSON.stringify(
          {
            source: "generate-cloning-prompts",
            analysis: storedImagePrompt?.analysis ?? null,
            flowPrompt: "",
            model: DEFAULT_FLOW_IMAGE_MODEL,
            aspect: mapImageAspectRatio(aspectRatio),
            count: 1,
            resolution: imageResolution,
            negativePrompt: negativePrompt || undefined,
            error: "Run STEP 1: ANALYZE first to get the clone prompt.",
          } satisfies StoredImagePromptMeta,
          null,
          2
        ),
      });
      return;
    }

    const imagePromptMeta: StoredImagePromptMeta = {
      ...storedImagePrompt,
      aspect: mapImageAspectRatio(aspectRatio),
      resolution: imageResolution,
      count: 1,
      negativePrompt: negativePrompt || undefined,
      error: undefined,
    };

    updateSession(sessionId, {
      currentStep: 2,
      analyzing: false,
      cloning: true,
      progress: 0,
      imagePrompt: JSON.stringify(imagePromptMeta, null, 2),
    });

    try {
      const { jobId } = await api.flowGenerate({
        prompt: imagePromptMeta.flowPrompt,
        mode: "image",
        model: imagePromptMeta.model,
        aspect: imagePromptMeta.aspect,
        count: 1,
        res: imagePromptMeta.resolution,
      });

      const result = await pollFlowJob(jobId, (progress) => {
        updateSession(sessionId, {
          progress: Math.max(5, Math.min(95, progress)),
        });
      });

      const clonedImageUrl = result.images?.map((img) => img.url ?? "").find(Boolean);
      if (!clonedImageUrl) {
        throw new Error("Flow image generation finished without returning an image.");
      }

      updateSession(sessionId, {
        currentStep: 2,
        cloning: false,
        progress: 100,
        clonedImageUrl,
        imagePrompt: JSON.stringify(imagePromptMeta, null, 2),
      });
    } catch (error) {
      updateSession(sessionId, {
        currentStep: 1,
        cloning: false,
        progress: 0,
        imagePrompt: JSON.stringify(
          {
            ...imagePromptMeta,
            error: error instanceof Error ? error.message : "Image generation failed.",
          },
          null,
          2
        ),
      });
    }
  };

  const generateVideoForSession = async (sessionId: string) => {
    const session = getSession(sessionId);
    if (!session) return;

    const storedImagePrompt = parseStoredJson<StoredImagePromptMeta>(session.imagePrompt);
    const videoPromptMeta: StoredVideoPromptMeta = {
      source: "flow-video",
      basedOn: "cloned-image",
      flowPrompt: buildVideoClonePrompt(storedImagePrompt?.flowPrompt ?? "", cameraMotion, videoDuration, negativePrompt),
      model: mapVideoModel(videoModel),
      aspect: mapVideoAspectRatio(videoAspectRatio),
      count: 1,
      resolution: mapVideoResolution(videoResolution),
      duration: videoDuration,
      cameraMotion,
      negativePrompt: negativePrompt || undefined,
    };

    if (!videoPromptMeta.flowPrompt) {
      updateSession(sessionId, {
        currentStep: 2,
        videoUrl: undefined,
        videoPrompt: JSON.stringify(
          {
            ...videoPromptMeta,
            error: "Run STEP 1: ANALYZE first to get the clone prompt.",
          },
          null,
          2
        ),
      });
      return;
    }

    updateSession(sessionId, {
      currentStep: 3,
      videoUrl: undefined,
      videoPrompt: JSON.stringify(videoPromptMeta, null, 2),
    });

    try {
      const image_bytes = await ensureDataUrl(session.clonedImageUrl ?? session.asset.thumbnailUrl ?? "");
      const { jobId } = await api.flowGenerate({
        prompt: videoPromptMeta.flowPrompt,
        mode: "video",
        model: videoPromptMeta.model,
        aspect: videoPromptMeta.aspect,
        count: 1,
        res: videoPromptMeta.resolution,
        image_bytes,
      });

      const result = await pollFlowJob(jobId);
      const videoUrl =
        result.videos?.map((video) => video.url ?? video.video_url ?? video.fifeUrl ?? "").find(Boolean) ??
        result.video?.url ??
        result.video?.fifeUrl;

      if (!videoUrl) {
        throw new Error("Flow video generation finished without returning a video.");
      }

      updateSession(sessionId, {
        currentStep: 4,
        videoUrl,
        videoPrompt: JSON.stringify(videoPromptMeta, null, 2),
      });
    } catch (error) {
      updateSession(sessionId, {
        currentStep: 2,
        videoUrl: undefined,
        videoPrompt: JSON.stringify(
          {
            ...videoPromptMeta,
            error: error instanceof Error ? error.message : "Video generation failed.",
          },
          null,
          2
        ),
      });
    }
  };

  const runSessionsWithThreads = async (sessionIds: string[], worker: (sessionId: string) => Promise<void>) => {
    if (!sessionIds.length || isBatchRunning) return;

    setIsBatchRunning(true);
    let nextIndex = 0;
    const workerCount = Math.min(threadCount, sessionIds.length);

    try {
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= sessionIds.length) return;

            setActiveThreads((count) => count + 1);
            try {
              await worker(sessionIds[currentIndex]);
            } finally {
              setActiveThreads((count) => Math.max(0, count - 1));
            }
          }
        })
      );
    } finally {
      setIsBatchRunning(false);
      setActiveThreads(0);
    }
  };

  const parseCSV = (text: string): CSVAsset[] => {
    const lines = text.split('\n').filter(line => line.trim());
    
    return lines.slice(1).map((line, index) => {
      const values = line.match(/(\".*?\"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const cleaned = values.map(v => v.replace(/^\"|\"$/g, '').trim());
      
      return {
        id: cleaned[0] || `asset-${index}`,
        title: cleaned[1] || '',
        thumbnailUrl: cleaned[2] || '',
        downloads: parseInt(cleaned[3]) || 0,
        creator: cleaned[5] || '',
        category: cleaned[7] || '',
        keywords: cleaned[13] || '',
      };
    }).filter(asset => asset.id && asset.title);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setAssets(parsed);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    }
  };

  const toggleImageSelection = (id: string) => {
    const newSelected = new Set(selectedImageIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedImageIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedImageIds.size === assets.length) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(assets.map(a => a.id)));
    }
  };

  const startCloning = () => {
    const selected = assets.filter(a => selectedImageIds.has(a.id));
    const newSessions: CloneSession[] = selected.map(asset => ({
      id: `session-${Date.now()}-${asset.id}`,
      asset,
      currentStep: 0,
      analyzing: false,
      cloning: false,
      progress: 0,
    }));

    setSessions(prev => [...newSessions, ...prev]);
    setSelectedImageIds(new Set());
  };

  const removeSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const clearSessions = () => {
    setSessions([]);
  };

  const completeCount = sessions.filter(s => s.currentStep === 4).length;

  return (
    <div className="h-full bg-[#050810] flex flex-col">
      {/* Top Bar */}
      <div className="h-16 border-b border-[#161d2f] flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Dna className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>
              DNA Extraction
            </h1>
            <p className="text-gray-500 text-xs font-medium">Competitor cloning using Vision AI</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {assets.length === 0 ? (
          /* Upload State */
          <div className="max-w-4xl mx-auto px-8 py-16">
            <div className="text-center mb-12">
              <h2 
                className="text-5xl font-bold mb-4 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] bg-clip-text text-transparent"
                style={{ fontFamily: 'Space Grotesk', fontStyle: 'italic', letterSpacing: '-0.02em' }}
              >
                VIRAL CLONING
              </h2>
              <p className="text-gray-400 text-lg">
                Find high-performing stock assets and clone their style using Vision AI.
              </p>
            </div>

            {/* Clone Mode Tabs */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <button
                onClick={() => setCloneMode("keyword")}
                className={`px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wide transition-all flex items-center gap-3 ${
                  cloneMode === "keyword"
                    ? "bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white shadow-lg shadow-pink-500/30"
                    : "bg-[#0a0f1d] border border-[#161d2f] text-gray-500 hover:text-gray-400"
                }`}
              >
                <Search className="w-5 h-5" />
                KEYWORD CLONING
              </button>
              <button
                onClick={() => setCloneMode("creator")}
                className={`px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wide transition-all flex items-center gap-3 ${
                  cloneMode === "creator"
                    ? "bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-white shadow-lg shadow-pink-500/30"
                    : "bg-[#0a0f1d] border border-[#161d2f] text-gray-500 hover:text-gray-400"
                }`}
              >
                <User className="w-5 h-5" />
                CREATOR CLONING
              </button>
            </div>

            {/* Search Interface */}
            {cloneMode === "keyword" ? (
              <div className="bg-[#0a0f1d] border-2 border-[#161d2f] rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 px-6 py-5 bg-[#050810] border border-[#161d2f] rounded-xl">
                    <Sparkles className="w-6 h-6 text-gray-600" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search viral niche (e.g. 'cats', 'business', 'travel')"
                      className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-gray-600"
                    />
                  </div>
                  <button className="px-8 py-5 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:opacity-90 rounded-xl text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-pink-500/30 transition-all">
                    FIND BEST
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#161d2f] hover:border-[#ec4899] rounded-2xl p-20 cursor-pointer transition-all group bg-[#0a0f1d]/50 hover:bg-[#0a0f1d]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-gray-600 group-hover:text-[#ec4899] transition-colors" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-white text-2xl font-bold mb-2">CLICK TO UPLOAD CSV</h3>
                    <p className="text-gray-600 text-sm uppercase tracking-wide">OR DRAG AND DROP</p>
                  </div>
                  <p className="text-gray-700 text-xs font-mono">SUPPORTS ADOBE STOCK CSV EXPORT FORMAT</p>
                </div>
              </div>
            )}
          </div>
        ) : sessions.length === 0 ? (
          /* Asset Selection View */
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#161d2f]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setAssets([]);
                    setSelectedImageIds(new Set());
                  }}
                  className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors group"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                </button>
                <h2 className="text-white font-bold text-xl uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk' }}>
                  LOADED {assets.length} ASSETS
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-pink-500 font-bold text-sm uppercase tracking-wider">
                  {selectedImageIds.size} SELECTED
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="px-4 py-2.5 bg-[#0a0f1d] hover:bg-[#161d2f] border border-[#161d2f] rounded-lg text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wide transition-all"
                >
                  {selectedImageIds.size === assets.length ? "DESELECT ALL" : "SELECT ALL"}
                </button>
                {selectedImageIds.size > 0 && (
                  <motion.button
                    onClick={startCloning}
                    className="px-6 py-3 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:opacity-90 rounded-xl text-white font-bold text-sm shadow-lg shadow-pink-500/30 transition-all flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Sparkles className="w-4 h-4" />
                    CLONE SELECTED
                  </motion.button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-4">
              <div className="grid grid-cols-3 gap-6">
                {assets.map((asset) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group cursor-pointer"
                    onClick={() => toggleImageSelection(asset.id)}
                  >
                    <div className={`bg-[#0a0f1d] rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIds.has(asset.id)
                        ? 'border-[#ec4899] shadow-lg shadow-pink-500/30'
                        : 'border-[#161d2f] hover:border-[#1a1f30]'
                    }`}>
                      <div className="relative aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] overflow-hidden">
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                          }}
                        />
                        
                        {selectedImageIds.has(asset.id) && (
                          <div className="absolute top-3 right-3 w-7 h-7 rounded-md bg-[#ec4899] border-2 border-[#ec4899] flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                        )}

                        <div className="absolute top-3 left-3 px-3 py-1.5 bg-[#0ea5e9] backdrop-blur-sm rounded-lg">
                          <span className="text-white font-mono font-bold text-sm">
                            {asset.downloads}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-white text-xs font-mono leading-relaxed line-clamp-2 min-h-[2.5rem]">
                          {asset.title}
                        </p>

                        <div className="flex items-center gap-2 pt-2 border-t border-[#161d2f]">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {asset.creator.charAt(0)}
                            </span>
                          </div>
                          <span className="text-gray-500 text-xs truncate flex-1">
                            {asset.creator}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Active Sessions */
          <div className="max-w-[1800px] mx-auto px-8 py-8 pb-32">
            {/* Session Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => setSessions([])}
                    className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors group"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                  </button>
                  <h2 className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                    <span className="italic bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] bg-clip-text text-transparent">
                      ACTIVE SESSIONS
                    </span>
                  </h2>
                </div>
                <p className="text-gray-400 text-sm ml-14">{sessions.length} active cloning sessions</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg">
                  <span className="text-gray-500 font-mono text-xs">THREADS</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setThreadCount((count) => Math.max(1, count - 1))}
                      disabled={isBatchRunning}
                      className="w-6 h-6 rounded border border-[#161d2f] text-gray-400 disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="text-white font-mono font-bold min-w-4 text-center">{threadCount}</span>
                    <button
                      type="button"
                      onClick={() => setThreadCount((count) => Math.min(8, count + 1))}
                      disabled={isBatchRunning}
                      className="w-6 h-6 rounded border border-[#161d2f] text-gray-400 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  {isBatchRunning && (
                    <span className="text-[10px] font-mono text-pink-400">
                      ACTIVE {activeThreads}
                    </span>
                  )}
                </div>

                <button 
                  onClick={clearSessions}
                  className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-bold text-sm transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  CLEAR
                </button>
              </div>
            </div>

            {/* Clone Settings Panel - Hidden by Default */}
            <CloneSettingsPanel
              expanded={cloneSettingsExpanded}
              onToggle={() => setCloneSettingsExpanded(!cloneSettingsExpanded)}
              // Image Setting
              imageModel={imageModel}
              setImageModel={setImageModel}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              imageResolution={imageResolution}
              setImageResolution={setImageResolution}
              // Video Settings
              videoModel={videoModel}
              setVideoModel={setVideoModel}
              videoAspectRatio={videoAspectRatio}
              setVideoAspectRatio={setVideoAspectRatio}
              videoResolution={videoResolution}
              setVideoResolution={setVideoResolution}
              // Global
              autoDownload={autoDownload}
              setAutoDownload={setAutoDownload}
              negativePrompt={negativePrompt}
              setNegativePrompt={setNegativePrompt}
            />

            {/* Sessions List - Compact */}
            <div className="space-y-4">
              <AnimatePresence>
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0a0f1d] border border-[#161d2f] rounded-xl p-4"
                  >
                    {/* Compact Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] flex items-center justify-center">
                          <Dna className="w-3 h-3 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-xs" style={{ fontFamily: 'Space Grotesk' }}>
                            {session.asset.title.substring(0, 40)}...
                          </h3>
                          <p className="text-gray-500 text-[10px] font-mono">ID: {session.asset.id}</p>
                        </div>
                      </div>
                      
                      {/* Step Indicator */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4].map((step) => (
                            <div
                              key={step}
                              className={`w-2 h-2 rounded-full transition-all ${
                                session.currentStep >= step 
                                  ? 'bg-gradient-to-r from-[#ec4899] to-[#8b5cf6]' 
                                  : 'bg-[#161d2f]'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-gray-500 text-[10px] font-mono">
                          STEP {session.currentStep}/4
                        </span>
                        <button 
                          onClick={() => removeSession(session.id)}
                          className="p-1.5 hover:bg-[#161d2f] rounded-lg transition-colors ml-2"
                        >
                          <X className="w-3 h-3 text-gray-500 hover:text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Compact 3-Column Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Reference - Compact */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <ImageIcon className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-500 text-[10px] font-mono font-semibold uppercase">Reference</span>
                        </div>
                        <div className="aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-lg overflow-hidden">
                          <img
                            src={session.asset.thumbnailUrl}
                            alt={session.asset.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Reference';
                            }}
                          />
                        </div>
                        <div className="mt-3 space-y-2">
                          <div>
                            <span className="text-gray-600 text-[9px] font-mono uppercase">Creator</span>
                            <p className="text-white text-[11px] font-medium">{session.asset.creator}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-[9px] font-mono uppercase">Downloads</span>
                            <p className="text-[#0ea5e9] text-[11px] font-mono font-bold">{session.asset.downloads}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-[9px] font-mono uppercase">Keywords</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {session.asset.keywords.split(',').slice(0, 6).map((kw, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-[#161d2f] rounded text-[9px] text-gray-400 font-mono">
                                  {kw.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cloned Image - Compact */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Sparkles className="w-3 h-3 text-pink-500" />
                          <span className="text-pink-500 text-[10px] font-mono font-semibold uppercase">Cloned Image</span>
                        </div>
                        <div className="aspect-video bg-gradient-to-br from-[#1a0a1d] to-[#0a0f1d] rounded-lg overflow-hidden relative flex items-center justify-center border border-[#ec4899]/30">
                          {session.analyzing && (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-8 h-8 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" />
                              <p className="text-pink-500 font-bold text-[10px]">ANALYZING {Math.round(session.progress)}%</p>
                            </div>
                          )}
                          {session.cloning && (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                              <p className="text-purple-500 font-bold text-[10px]">CLONING {Math.round(session.progress)}%</p>
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0a0f1d]">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${session.progress}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            </div>
                          )}
                          {session.clonedImageUrl && !session.analyzing && !session.cloning && (
                            <>
                              <img
                                src={session.clonedImageUrl}
                                alt="Cloned"
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("image");
                                }}
                              />
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-500/90 backdrop-blur-sm rounded text-[9px] text-white font-bold">
                                READY
                              </div>
                              <button
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("image");
                                }}
                                className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors"
                              >
                                <Maximize2 className="w-3 h-3 text-white" />
                              </button>
                            </>
                          )}
                          {!session.clonedImageUrl && !session.analyzing && !session.cloning && (
                            <div className="flex flex-col items-center gap-2">
                              <Sparkles className="w-8 h-8 text-gray-700" />
                              <p className="text-gray-700 text-[10px] font-mono uppercase">Waiting...</p>
                            </div>
                          )}
                        </div>
                        {session.imagePrompt && (
                          <div className="mt-3">
                            <span className="text-gray-500 text-[9px] font-mono uppercase mb-1 block">Vision Analysis Prompt</span>
                            <pre className="p-2 bg-[#050810] border border-[#161d2f] rounded text-[8px] text-emerald-400 font-mono leading-tight overflow-x-auto max-h-[120px] overflow-y-auto">
                              {session.imagePrompt}
                            </pre>
                          </div>
                        )}
                      </div>

                      {/* Animated Clone (Video) - Compact */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Film className="w-3 h-3 text-purple-500" />
                          <span className="text-purple-500 text-[10px] font-mono font-semibold uppercase">Video Clone</span>
                        </div>
                        <div className="aspect-video bg-gradient-to-br from-[#0a0a1d] to-[#0a0f1d] rounded-lg overflow-hidden relative flex items-center justify-center border border-[#8b5cf6]/30">
                          {session.currentStep < 3 ? (
                            <div className="flex flex-col items-center gap-2">
                              <Film className="w-8 h-8 text-gray-700" />
                              <p className="text-gray-700 text-[10px] font-mono uppercase">Waiting...</p>
                            </div>
                          ) : session.videoUrl ? (
                            <>
                              <video
                                src={session.videoUrl}
                                className="w-full h-full object-cover cursor-pointer"
                                muted
                                loop
                                autoPlay
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("video");
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-purple-500/90 backdrop-blur-sm rounded text-[9px] text-white font-bold">
                                READY
                              </div>
                              <button
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("video");
                                }}
                                className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors"
                              >
                                <Maximize2 className="w-3 h-3 text-white" />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                              <p className="text-purple-500 font-bold text-[10px]">GENERATING...</p>
                            </div>
                          )}
                        </div>
                        {session.videoPrompt && (
                          <div className="mt-3">
                            <span className="text-gray-500 text-[9px] font-mono uppercase mb-1 block">Director Mode Metadata</span>
                            <pre className="p-2 bg-[#050810] border border-[#161d2f] rounded text-[8px] text-purple-400 font-mono leading-tight overflow-x-auto max-h-[120px] overflow-y-auto">
                              {session.videoPrompt}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {sessions.length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-[#0a0f1d] border-2 border-[#ec4899]/50 rounded-2xl shadow-2xl shadow-pink-500/20 px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-4">


              {/* Step Buttons */}
              <button
                onClick={() => {
                  const idleSessions = sessions
                    .filter((s) => s.currentStep === 0 && !s.analyzing)
                    .map((s) => s.id);
                  void runSessionsWithThreads(idleSessions, analyzeSession);
                }}
                disabled={isBatchRunning}
                className="px-4 py-2.5 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                STEP 1: ANALYZE
              </button>

              <button
                onClick={() => {
                  const analyzedSessions = sessions
                    .filter((s) => s.currentStep === 1 && !s.analyzing && !!s.imagePrompt)
                    .map((s) => s.id);
                  void runSessionsWithThreads(analyzedSessions, generateImageForSession);
                }}
                disabled={isBatchRunning}
                className="px-4 py-2.5 bg-gradient-to-r from-[#f59e0b] to-[#ec4899] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <Wand2 className="w-3 h-3" />
                STEP 2: IMAGE
              </button>

              <button
                onClick={() => {
                  const imagedSessions = sessions
                    .filter((s) => s.currentStep === 2 && !s.analyzing && !s.cloning && !!s.clonedImageUrl)
                    .map((s) => s.id);
                  void runSessionsWithThreads(imagedSessions, generateVideoForSession);
                }}
                disabled={isBatchRunning}
                className="px-4 py-2.5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <Film className="w-3 h-3" />
                STEP 3: VIDEO
              </button>

              {/* Divider */}
              <div className="w-px h-8 bg-[#161d2f]" />

              {/* Batch Actions */}
              {completeCount > 0 && (
                <>
                  <button className="px-4 py-2.5 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2">
                    <Download className="w-3 h-3" />
                    DOWNLOAD ALL
                  </button>
                  <button className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-500/90 rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2">
                    <Archive className="w-3 h-3" />
                    ARCHIVE
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Inspector Modal */}
      <AnimatePresence>
        {inspectorSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-8"
            onClick={() => {
              setInspectorSession(null);
              setInspectorType(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-5xl w-full bg-[#0a0f1d] border border-[#161d2f] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#161d2f]">
                <h2 className="text-white font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                  {inspectorType === "image" ? "Cloned Image" : "Animated Clone"}
                </h2>
                <button
                  onClick={() => {
                    setInspectorSession(null);
                    setInspectorType(null);
                  }}
                  className="p-2 hover:bg-[#161d2f] rounded-lg text-gray-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                {inspectorType === "image" ? (
                  <img
                    src={inspectorSession.clonedImageUrl}
                    alt="Cloned"
                    className="w-full rounded-xl"
                  />
                ) : (
                  <video
                    src={inspectorSession.videoUrl}
                    className="w-full rounded-xl"
                    controls
                    autoPlay
                    loop
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}