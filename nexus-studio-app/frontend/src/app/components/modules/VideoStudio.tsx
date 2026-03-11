import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Film, Loader2, CheckCircle,
  Download, Settings, Grid3x3, List, Trash2, Play, X, ExternalLink, Volume2, VolumeX, Plus, PlayCircle, Copy, Upload, Image as ImageIcon
} from "lucide-react";
import { api, STORAGE_BASE } from "../../../services/api";
import { MediaInspectorModal } from "../MediaInspectorModal";

interface QueueItem {
  id: number;
  prompt: string;
  model: string;
  ratio: string;
  status: "pending" | "queued" | "rendering" | "success" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  timestamp: Date;
  mode?: "text-to-video" | "ingredients" | "frames" | "nano-video";
  startFrameUrl?: string;
  endFrameUrl?: string;
  ingredientImages?: string[];
}

const POLL_INTERVAL_MS = 3000;

export function VideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("Veo 3.1");
  const [ratio, setRatio] = useState("16:9");
  const [videoModels, setVideoModels] = useState<string[]>([]);
  const [videoAspects, setVideoAspects] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [duration, setDuration] = useState("5s");
  const [fps, setFps] = useState("30");
  const [resolution, setResolution] = useState("1080p");
  const [videoMode, setVideoMode] = useState<"text-to-video" | "ingredients" | "frames" | "nano-video">("text-to-video");
  const [count, setCount] = useState(2);
  const [seed, setSeed] = useState("");
  const [startFrameUrl, setStartFrameUrl] = useState<string>("");
  const [endFrameUrl, setEndFrameUrl] = useState<string>("");
  const [ingredientImages, setIngredientImages] = useState<string[]>([]);

  useEffect(() => {
    api.flowConfig().then((c) => {
      setVideoModels(c.videoModels?.length ? c.videoModels : ["Veo 3.1", "Veo 3.0", "Runway Gen-3"]);
      setVideoAspects(c.videoAspects?.length ? c.videoAspects : ["16:9", "9:16", "21:9", "1:1"]);
      setModel(c.defaults?.videoModel ?? "Veo 3.1");
      setRatio(c.defaults?.videoAspect ?? "16:9");
    }).catch(() => {
      setVideoModels(["Veo 3.1", "Veo 3.0", "Runway Gen-3"]);
      setVideoAspects(["16:9", "9:16", "21:9", "1:1"]);
    });
  }, []);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if it exists
      const startIndex = lines[0].toLowerCase().includes('prompt') ? 1 : 0;
      
      const newItems: QueueItem[] = lines.slice(startIndex).map((line, index) => {
        const prompt = line.trim().replace(/^["']|["']$/g, ''); // Remove quotes
        return {
          id: Date.now() + index,
          prompt,
          model,
          ratio,
          status: "pending" as const,
          progress: 0,
          timestamp: new Date(),
          mode: videoMode,
          startFrameUrl,
          endFrameUrl,
          ingredientImages,
        };
      }).filter(item => item.prompt); // Remove empty prompts

      setQueue([...newItems, ...queue]);
      setShowSettingsModal(false);
    };

    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const addToQueue = () => {
    if (!prompt.trim()) return;
    
    // Split by newlines and filter out empty lines
    const lines = prompt.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Create queue items for each line
    const newItems: QueueItem[] = lines.map((line, index) => ({
      id: Date.now() + index,
      prompt: line,
      model,
      ratio,
      status: "pending" as const,
      progress: 0,
      timestamp: new Date(),
      mode: videoMode,
      startFrameUrl,
      endFrameUrl,
      ingredientImages,
    }));
    
    setQueue([...newItems, ...queue]);
    setPrompt("");
  };

  function resolveVideoUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    if (url.startsWith("/")) return `${window.location.origin}${url}`;
    const base = STORAGE_BASE.replace(/\/$/, "");
    return `${base}/${url}`;
  }

  const generateItem = async (id: number) => {
    const item = queue.find((i) => i.id === id);
    if (!item || item.status !== "pending") return;

    setQueue(prev => prev.map(i => i.id === id ? { ...i, status: "rendering" as const, progress: 0 } : i));

    try {
      const { jobId } = await api.flowGenerate({
        prompt: item.prompt,
        mode: "video",
        model: item.model,
        aspect: item.ratio,
        count: 1,
        res: resolution === "1080p" ? "720p" : resolution,
      });

      const poll = async (): Promise<void> => {
        const res = await api.flowGenerateStatus(jobId);
        if (res.status === "done" && res.result) {
          const r = res.result as { videos?: Array<{ url?: string; video_url?: string; fifeUrl?: string }>; video?: { url?: string; fifeUrl?: string } };
          const vid = r.videos?.[0] ?? r.video;
          const url = vid?.url ?? (vid as { video_url?: string })?.video_url ?? (vid as { fifeUrl?: string })?.fifeUrl;
          const videoUrl = resolveVideoUrl(url);
          setQueue(prev => prev.map(i => i.id === id ? { ...i, status: "success" as const, progress: 100, videoUrl, thumbnailUrl: videoUrl } : i));
          return;
        }
        if (res.status === "error") {
          setQueue(prev => prev.map(i => i.id === id ? { ...i, status: "failed" as const } : i));
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      };
      await poll();
    } catch {
      setQueue(prev => prev.map(i => i.id === id ? { ...i, status: "failed" as const } : i));
    }
  };

  const generateAll = () => {
    const pendingItems = queue.filter(item => item.status === "pending");
    pendingItems.forEach((item, index) => {
      setTimeout(() => {
        generateItem(item.id);
      }, index * 300);
    });
  };

  const duplicateItem = (item: QueueItem) => {
    const newItem: QueueItem = {
      ...item,
      id: Date.now(),
      status: "pending",
      progress: 0,
      videoUrl: undefined,
      thumbnailUrl: undefined,
      timestamp: new Date(),
    };
    setQueue([newItem, ...queue]);
  };

  const removeItem = (id: number) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  const clearAll = () => {
    setQueue([]);
    setSelectedItem(null);
  };

  const pendingCount = queue.filter(item => item.status === "pending").length;
  const queuedCount = queue.filter(item => item.status === "queued").length;
  const renderingCount = queue.filter(item => item.status === "rendering").length;
  const completedCount = queue.filter(item => item.status === "success").length;

  return (
    <div className="h-full bg-[#050810] flex flex-col">
      {/* Top Bar */}
      <div className="h-16 border-b border-[#161d2f] flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>Video Studio</h1>
            <p className="text-gray-500 text-xs font-medium">4K video rendering & generation</p>
          </div>
        </div>

        {queue.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg">
              {pendingCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span className="text-gray-400 font-mono text-sm">{pendingCount}</span>
                </div>
              )}
              {renderingCount > 0 && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  <span className="text-amber-400 font-mono text-sm">{renderingCount}</span>
                </div>
              )}
              {completedCount > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-400 font-mono text-sm">{completedCount}</span>
                </div>
              )}
            </div>

            {pendingCount > 0 && (
              <motion.button
                onClick={generateAll}
                className="px-6 py-2.5 bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] hover:opacity-90 rounded-lg text-white font-bold text-sm shadow-lg shadow-purple-500/30 transition-all flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <PlayCircle className="w-4 h-4" />
                Render All ({pendingCount})
              </motion.button>
            )}

            <div className="flex items-center gap-1 bg-[#0a0f1d] border border-[#161d2f] rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded transition-all ${
                  viewMode === "grid" ? "bg-[#161d2f] text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded transition-all ${
                  viewMode === "list" ? "bg-[#161d2f] text-white" : "text-gray-500 hover:text-white"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button 
              onClick={clearAll}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Prompt Section */}
        <div className="max-w-5xl mx-auto px-8 py-12">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to create..."
              className="w-full h-[300px] px-8 py-8 bg-[#0a0f1d] border-2 border-[#161d2f] focus:border-[#8b5cf6] rounded-2xl text-white text-xl font-['JetBrains_Mono'] leading-relaxed placeholder:text-gray-700 outline-none resize-none transition-all"
              style={{ fontWeight: 300 }}
              autoFocus
            />

            {/* Floating Bottom Bar */}
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 bg-[#050810]/90 backdrop-blur-sm border border-[#161d2f] rounded-lg text-gray-500 font-mono text-xs">
                  {prompt.length} characters
                </span>
                <button onClick={() => setShowSettingsModal(true)} className="px-4 py-1.5 bg-[#050810]/90 backdrop-blur-sm border border-[#161d2f] hover:border-[#8b5cf6] rounded-lg text-gray-400 hover:text-white font-medium text-xs transition-all flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
              </div>

              <motion.button
                onClick={addToQueue}
                disabled={!prompt.trim()}
                className="px-10 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm shadow-xl shadow-purple-500/40 transition-all flex items-center gap-3"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Sparkles className="w-5 h-5" />
                Add to Queue
              </motion.button>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="mt-8 flex items-center gap-2">
            {[
              { id: "text-to-video", label: "Text to Video" },
              { id: "ingredients", label: "Ingredients" },
              { id: "frames", label: "Frames" },
              { id: "nano-video", label: "Nano Video" }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setVideoMode(mode.id as typeof videoMode)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  videoMode === mode.id
                    ? "bg-[#8b5cf6]/20 border-2 border-[#8b5cf6] text-[#8b5cf6]"
                    : "bg-[#161d2f] border-2 border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Frames Mode - Start & End Upload */}
          {videoMode === "frames" && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">Start Frame</label>
                <div className="relative aspect-video bg-[#0a0f1d] border-2 border-dashed border-[#161d2f] hover:border-[#8b5cf6] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  <Upload className="w-8 h-8 text-gray-600 group-hover:text-[#8b5cf6] transition-all" />
                  <span className="text-gray-600 text-sm mt-2 group-hover:text-[#8b5cf6]">Upload Start Frame</span>
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">End Frame</label>
                <div className="relative aspect-video bg-[#0a0f1d] border-2 border-dashed border-[#161d2f] hover:border-[#8b5cf6] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group">
                  <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                  <Upload className="w-8 h-8 text-gray-600 group-hover:text-[#8b5cf6] transition-all" />
                  <span className="text-gray-600 text-sm mt-2 group-hover:text-[#8b5cf6]">Upload End Frame</span>
                </div>
              </div>
            </div>
          )}

          {/* Ingredients Mode - Multiple Upload */}
          {videoMode === "ingredients" && (
            <div className="mt-6">
              <label className="block text-gray-400 text-sm font-medium mb-3">Ingredient Images</label>
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="relative aspect-video bg-[#0a0f1d] border-2 border-dashed border-[#161d2f] hover:border-[#8b5cf6] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                    <ImageIcon className="w-6 h-6 text-gray-600 group-hover:text-[#8b5cf6] transition-all" />
                    <span className="text-gray-600 text-xs mt-1 group-hover:text-[#8b5cf6]">Image {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Options */}
          <div className="mt-6 flex items-center gap-6 hidden">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm font-medium">Model:</span>
              <div className="flex gap-2">
                {(videoModels.length ? videoModels : ["Veo 3.1", "Veo 3.0", "Runway Gen-3"]).map(m => (
                  <button 
                    key={m}
                    onClick={() => setModel(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      model === m
                        ? "bg-[#8b5cf6] text-white"
                        : "bg-[#161d2f] text-gray-400 hover:text-white hover:bg-[#1a1f30]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px h-6 bg-[#161d2f]" />

            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm font-medium">Ratio:</span>
              <div className="flex gap-2">
                {(videoAspects.length ? videoAspects : ["16:9", "9:16", "21:9", "1:1"]).map(r => (
                  <button 
                    key={r}
                    onClick={() => setRatio(r)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      ratio === r
                        ? "bg-[#8b5cf6] text-white"
                        : "bg-[#161d2f] text-gray-400 hover:text-white hover:bg-[#1a1f30]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Queue Section */}
        {queue.length > 0 && (
          <div className="max-w-7xl mx-auto px-8 pb-12">
            <div className="mb-6">
              <h2 className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk' }}>
                Render Queue ({queue.length})
              </h2>
            </div>

            {viewMode === "grid" ? (
              <div className="grid grid-cols-3 gap-4">
                <AnimatePresence>
                  {queue.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group relative"
                    >
                      <div className="bg-[#0a0f1d] border border-[#161d2f] hover:border-[#8b5cf6]/50 rounded-xl overflow-hidden transition-all">
                        {/* Video Preview */}
                        <div className="aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] flex items-center justify-center relative overflow-hidden">
                          {/* Pending State */}
                          {item.status === "pending" && (
                            <>
                              <div className="flex flex-col items-center gap-3">
                                <Plus className="w-12 h-12 text-gray-600" />
                                <span className="text-gray-500 text-xs font-mono">Pending</span>
                              </div>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                <button 
                                  onClick={() => generateItem(item.id)}
                                  className="p-4 bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-full transition-all shadow-lg"
                                >
                                  <Play className="w-6 h-6 text-white" />
                                </button>
                                <button 
                                  onClick={() => duplicateItem(item)}
                                  className="p-3 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                                >
                                  <Copy className="w-5 h-5 text-white" />
                                </button>
                                <button 
                                  onClick={() => removeItem(item.id)}
                                  className="p-3 bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-5 h-5 text-white" />
                                </button>
                              </div>
                            </>
                          )}

                          {/* Queued State */}
                          {item.status === "queued" && (
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-full border-2 border-gray-600 border-dashed animate-spin" />
                              <span className="text-gray-500 text-xs font-mono">Queued</span>
                            </div>
                          )}

                          {/* Rendering State */}
                          {item.status === "rendering" && (
                            <>
                              <Loader2 className="w-12 h-12 text-[#8b5cf6] animate-spin" />
                              <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#0a0f1d]">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.progress}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                              <div className="absolute top-2 right-2 px-2 py-1 bg-[#0a0f1d]/90 backdrop-blur-sm rounded text-xs text-white font-mono font-semibold">
                                {Math.round(item.progress || 0)}%
                              </div>
                              <div className="absolute top-2 left-2 px-2 py-1 bg-[#8b5cf6]/20 backdrop-blur-sm rounded text-xs text-[#8b5cf6] font-mono font-semibold flex items-center gap-1">
                                <Film className="w-3 h-3" />
                                Rendering
                              </div>
                            </>
                          )}

                          {/* Success State - Show video thumbnail */}
                          {item.status === "success" && (
                            <>
                              {item.thumbnailUrl && (
                                <img 
                                  src={item.thumbnailUrl} 
                                  alt={item.prompt}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                <button 
                                  onClick={() => setSelectedItem(item)}
                                  className="p-4 bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-full transition-all shadow-lg"
                                >
                                  <Play className="w-6 h-6 text-white" />
                                </button>
                                <a 
                                  href={item.videoUrl}
                                  download
                                  className="p-3 bg-[#10b981] hover:bg-[#059669] rounded-lg transition-all"
                                >
                                  <Download className="w-5 h-5 text-white" />
                                </a>
                                <button 
                                  onClick={() => removeItem(item.id)}
                                  className="p-3 bg-red-500 hover:bg-red-600 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-5 h-5 text-white" />
                                </button>
                              </div>
                              <div className="absolute bottom-3 left-3 px-2 py-1 bg-emerald-500/90 backdrop-blur-sm rounded text-xs text-white font-semibold flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Ready
                              </div>
                            </>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3">
                          <p className="text-white text-xs font-mono line-clamp-2 leading-relaxed mb-2">
                            {item.prompt}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{item.model}</span>
                            <span>{item.ratio}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {queue.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group"
                    >
                      <div className="bg-[#0a0f1d] border border-[#161d2f] hover:border-[#8b5cf6]/50 rounded-xl p-4 transition-all flex items-center gap-4">
                        {/* Thumbnail */}
                        <div className="w-24 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] flex items-center justify-center relative">
                          {item.status === "pending" && (
                            <Plus className="w-6 h-6 text-gray-600" />
                          )}
                          {item.status === "queued" && (
                            <div className="w-6 h-6 rounded-full border-2 border-gray-600 border-dashed animate-spin" />
                          )}
                          {item.status === "rendering" && (
                            <Loader2 className="w-6 h-6 text-[#8b5cf6] animate-spin" />
                          )}
                          {item.status === "success" && item.thumbnailUrl && (
                            <>
                              <img src={item.thumbnailUrl} alt={item.prompt} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <Play className="w-5 h-5 text-white" />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-mono truncate mb-1">
                            {item.prompt}
                          </p>
                          {item.status === "rendering" && (
                            <div className="h-1 bg-[#161d2f] rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef]"
                                initial={{ width: 0 }}
                                animate={{ width: `${item.progress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          )}
                          {(item.status === "pending" || item.status === "queued" || item.status === "success") && (
                            <span className="text-xs text-gray-500">{item.model} • {item.ratio}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {item.status === "pending" && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => generateItem(item.id)}
                                className="p-2 bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-lg transition-all"
                                title="Render Now"
                              >
                                <Play className="w-4 h-4 text-white" />
                              </button>
                              <button 
                                onClick={() => duplicateItem(item)}
                                className="p-2 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4 text-white" />
                              </button>
                              <button 
                                onClick={() => removeItem(item.id)}
                                className="p-2 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          )}
                          {item.status === "queued" && (
                            <span className="text-gray-500 text-xs font-mono">Queued</span>
                          )}
                          {item.status === "rendering" && (
                            <span className="text-[#8b5cf6] font-mono text-xs">{Math.round(item.progress || 0)}%</span>
                          )}
                          {item.status === "success" && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setSelectedItem(item)}
                                className="p-2 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                              >
                                <Play className="w-4 h-4 text-white" />
                              </button>
                              <a 
                                href={item.videoUrl}
                                download
                                className="p-2 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                              >
                                <Download className="w-4 h-4 text-white" />
                              </a>
                              <button 
                                onClick={() => removeItem(item.id)}
                                className="p-2 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedItem && selectedItem.videoUrl && (
        <MediaInspectorModal
          open={true}
          onClose={() => setSelectedItem(null)}
          type="video"
          mediaUrl={selectedItem.videoUrl}
          title="Video"
          subtitle={`${selectedItem.model} • ${selectedItem.ratio}`}
          resolution="720P"
          aspectRatio={selectedItem.ratio}
          format="MP4"
          visionPrompt={selectedItem.prompt}
          onDownload={() => {
            const a = document.createElement("a");
            a.href = selectedItem.videoUrl!;
            a.download = `video-${selectedItem.id}.mp4`;
            a.rel = "noopener";
            a.click();
          }}
        />
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
            onClick={() => setShowSettingsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Content */}
              <div className="bg-[#0a0f1d] border border-[#161d2f] rounded-2xl p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                    Video Settings
                  </h2>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="p-2 hover:bg-[#161d2f] rounded-lg transition-all"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {/* Mode Tabs */}
                <div className="flex items-center gap-2 mb-8">
                  {[
                    { id: "text-to-video", label: "Text to Video" },
                    { id: "ingredients", label: "Ingredients" },
                    { id: "frames", label: "Frames" },
                    { id: "nano-video", label: "Nano Video" }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setVideoMode(mode.id as typeof videoMode)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        videoMode === mode.id
                          ? "bg-[#8b5cf6]/20 border border-[#8b5cf6] text-[#8b5cf6]"
                          : "bg-[#161d2f] border border-[#161d2f] text-gray-400 hover:text-white hover:bg-[#1a1f30]"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Generation Model */}
                <div className="mb-6">
                  <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                    Generation Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#8b5cf6] focus:border-[#8b5cf6] rounded-lg text-white text-sm outline-none transition-all cursor-pointer"
                  >
                    {(videoModels.length ? videoModels : ["Veo 3.1", "Veo 3.0", "Runway Gen-3"]).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div className="mb-6">
                  <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {(videoAspects.length ? videoAspects : ["16:9", "9:16", "1:1", "21:9"]).map(r => (
                      <button 
                        key={r}
                        onClick={() => setRatio(r)}
                        className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all border ${
                          ratio === r
                            ? "bg-[#8b5cf6]/20 border-[#8b5cf6] text-[#8b5cf6]"
                            : "bg-[#161d2f] border-[#1f2937] text-gray-400 hover:text-white hover:border-[#374151]"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#161d2f] my-6" />

                {/* Advanced Settings Header */}
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                  <h3 className="text-[#f59e0b] font-semibold text-sm">
                    Advanced Settings
                  </h3>
                </div>

                {/* Advanced Settings Grid */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Resolution */}
                  <div>
                    <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                      Resolution
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#8b5cf6] focus:border-[#8b5cf6] rounded-lg text-white text-sm font-mono outline-none transition-all cursor-pointer"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>

                  {/* Count */}
                  <div>
                    <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                      Count
                    </label>
                    <select
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value))}
                      className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#8b5cf6] focus:border-[#8b5cf6] rounded-lg text-white text-sm font-mono outline-none transition-all cursor-pointer"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="8">8</option>
                    </select>
                  </div>
                </div>

                {/* Seed */}
                <div className="mt-6">
                  <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                    Seed
                  </label>
                  <input
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="Random if empty"
                    className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#8b5cf6] focus:border-[#8b5cf6] rounded-lg text-white text-sm placeholder:text-gray-600 outline-none transition-all"
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-[#161d2f] my-6" />

                {/* Bulk Upload */}
                <div>
                  <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                    Bulk Upload
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="flex items-center justify-center gap-3 px-6 py-4 bg-[#161d2f] border-2 border-dashed border-[#1f2937] hover:border-[#8b5cf6] rounded-xl cursor-pointer transition-all group"
                    >
                      <Upload className="w-5 h-5 text-gray-500 group-hover:text-[#8b5cf6] transition-all" />
                      <div className="text-left">
                        <div className="text-white text-sm font-semibold group-hover:text-[#8b5cf6] transition-all">
                          Upload CSV File
                        </div>
                        <div className="text-gray-600 text-xs">
                          Bulk add prompts to queue
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="px-8 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] hover:opacity-90 rounded-xl text-white font-bold text-sm shadow-lg shadow-purple-500/30 transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}