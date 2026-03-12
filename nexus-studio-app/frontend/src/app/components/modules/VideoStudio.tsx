import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, Film, Loader2, CheckCircle, 
  Download, Settings, Grid3x3, List, Trash2, Play, X, ExternalLink, Volume2, VolumeX, Plus, PlayCircle, Copy, Upload, Image as ImageIcon
} from "lucide-react";

interface QueueItem {
  id: number;
  prompt: string;
  model: string;
  ratio: string;
  status: "pending" | "rendering" | "success" | "failed";
  progress?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  timestamp: Date;
  mode?: "text-to-video" | "ingredients" | "frames" | "nano-video";
  startFrameUrl?: string;
  endFrameUrl?: string;
  ingredientImages?: string[];
}

export function VideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("Veo 3.1");
  const [ratio, setRatio] = useState("16:9");
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

  const generateItem = (id: number) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: "rendering" as const, progress: 0 } : item
    ));
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        const mockVideoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
        const mockThumbnail = `https://picsum.photos/seed/${id}/800/450`;
        
        setTimeout(() => {
          setQueue(prev => prev.map(item => 
            item.id === id ? { 
              ...item, 
              status: "success" as const, 
              progress: 100,
              videoUrl: mockVideoUrl,
              thumbnailUrl: mockThumbnail
            } : item
          ));
        }, 500);
      } else {
        setQueue(prev => prev.map(item => 
          item.id === id ? { ...item, progress } : item
        ));
      }
    }, 600);
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
                {["Veo 3.1", "Veo 3.0", "Runway Gen-3"].map(m => (
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
                {["16:9", "9:16", "21:9", "1:1"].map(r => (
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

                          {/* Success State - Show thumbnail */}
                          {item.status === "success" && item.videoUrl && (
                            <div 
                              className="absolute inset-0 cursor-pointer"
                              onClick={() => setSelectedItem(item)}
                            >
                              {item.thumbnailUrl && (
                                <img 
                                  src={item.thumbnailUrl} 
                                  alt={item.prompt}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 pointer-events-none">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                  }}
                                  className="p-4 bg-[#8b5cf6] hover:bg-[#7c3aed] rounded-full transition-all shadow-lg pointer-events-auto"
                                >
                                  <Play className="w-6 h-6 text-white" />
                                </button>
                                <a 
                                  href={item.videoUrl}
                                  download
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-3 bg-[#10b981] hover:bg-[#059669] rounded-lg transition-all pointer-events-auto"
                                >
                                  <Download className="w-5 h-5 text-white" />
                                </a>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeItem(item.id);
                                  }}
                                  className="p-3 bg-red-500 hover:bg-red-600 rounded-lg transition-all pointer-events-auto"
                                >
                                  <Trash2 className="w-5 h-5 text-white" />
                                </button>
                              </div>
                              {/* Duration Badge */}
                              <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-xs text-white font-mono font-bold pointer-events-none">
                                {duration}
                              </div>
                            </div>
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

      {/* Fullscreen Video Player Modal */}
      <AnimatePresence>
        {selectedItem && selectedItem.videoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-8"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-6xl w-full bg-[#0a0f1d] border border-[#161d2f] rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#161d2f]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#d946ef] flex items-center justify-center">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                      Generation Details
                    </h2>
                    <p className="text-gray-500 text-xs font-mono">
                      {selectedItem.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    className="p-2 hover:bg-[#161d2f] rounded-lg text-gray-400 hover:text-white transition-all"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="p-2 hover:bg-[#161d2f] rounded-lg text-gray-400 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex gap-6 p-6">
                {/* Video Player - Left Side */}
                <div className="flex-1">
                  <div className="aspect-video rounded-xl overflow-hidden bg-[#050810] border border-[#161d2f]">
                    <video
                      src={selectedItem.videoUrl}
                      className="w-full h-full object-cover"
                      controls
                      autoPlay
                      muted={isMuted}
                    />
                  </div>
                </div>

                {/* Details Panel - Right Side */}
                <div className="w-[400px] flex flex-col">
                  {/* Prompt */}
                  <div className="mb-6">
                    <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                      Prompt
                    </label>
                    <div className="p-4 bg-[#050810] border border-[#161d2f] rounded-lg">
                      <p className="text-white font-mono text-sm leading-relaxed">
                        {selectedItem.prompt}
                      </p>
                    </div>
                  </div>

                  {/* Generation Settings */}
                  <div className="space-y-4 mb-6">
                    {/* Model */}
                    <div>
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Model
                      </label>
                      <div className="px-4 py-3 bg-[#050810] border border-[#161d2f] rounded-lg">
                        <p className="text-white font-mono text-sm">{selectedItem.model}</p>
                      </div>
                    </div>

                    {/* Ratio */}
                    <div>
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Aspect Ratio
                      </label>
                      <div className="px-4 py-3 bg-[#050810] border border-[#161d2f] rounded-lg">
                        <p className="text-white font-mono text-sm">{selectedItem.ratio}</p>
                      </div>
                    </div>

                    {/* Resolution */}
                    <div>
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Resolution
                      </label>
                      <div className="px-4 py-3 bg-[#050810] border border-[#161d2f] rounded-lg">
                        <p className="text-white font-mono text-sm">{resolution}</p>
                      </div>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Duration
                      </label>
                      <div className="px-4 py-3 bg-[#050810] border border-[#161d2f] rounded-lg">
                        <p className="text-white font-mono text-sm">{duration}</p>
                      </div>
                    </div>

                    {/* FPS */}
                    <div>
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        FPS
                      </label>
                      <div className="px-4 py-3 bg-[#050810] border border-[#161d2f] rounded-lg">
                        <p className="text-white font-mono text-sm">{fps}</p>
                      </div>
                    </div>

                    {/* Seed */}
                    {seed && (
                      <div>
                        <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                          Seed
                        </label>
                        <div className="px-4 py-3 bg-[#050810] border border-[#161d2f] rounded-lg">
                          <p className="text-white font-mono text-sm">{seed}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Start/End Frames or Ingredient Images */}
                  {selectedItem.mode === "frames" && (selectedItem.startFrameUrl || selectedItem.endFrameUrl) && (
                    <div className="mb-6">
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Frames
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedItem.startFrameUrl && (
                          <div>
                            <div className="aspect-video rounded-lg overflow-hidden border border-[#8b5cf6]/30 bg-[#050810]">
                              <img src={selectedItem.startFrameUrl} alt="Start Frame" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-gray-500 text-xs mt-1 text-center">Start</p>
                          </div>
                        )}
                        {selectedItem.endFrameUrl && (
                          <div>
                            <div className="aspect-video rounded-lg overflow-hidden border border-[#8b5cf6]/30 bg-[#050810]">
                              <img src={selectedItem.endFrameUrl} alt="End Frame" className="w-full h-full object-cover" />
                            </div>
                            <p className="text-gray-500 text-xs mt-1 text-center">End</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedItem.mode === "ingredients" && selectedItem.ingredientImages && selectedItem.ingredientImages.length > 0 && (
                    <div className="mb-6">
                      <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                        Ingredients ({selectedItem.ingredientImages.length})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedItem.ingredientImages.map((img, idx) => (
                          <div key={idx} className="aspect-video rounded-lg overflow-hidden border border-[#d946ef]/30 bg-[#050810]">
                            <img src={img} alt={`Ingredient ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto space-y-3">
                    <button
                      onClick={() => {
                        duplicateItem(selectedItem);
                        setSelectedItem(null);
                      }}
                      className="w-full px-6 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] hover:opacity-90 rounded-xl text-white font-bold text-sm shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Clone Video
                    </button>
                    <div className="flex gap-3">
                      <a
                        href={selectedItem.videoUrl}
                        download
                        className="flex-1 px-6 py-3 bg-[#10b981] hover:bg-[#059669] rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                      <button
                        onClick={() => {
                          removeItem(selectedItem.id);
                          setSelectedItem(null);
                        }}
                        className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    <option value="Veo 3.1">Veo 3.1 - Fast (Audio)</option>
                    <option value="Veo 3.0">Veo 3.0 - Standard</option>
                    <option value="Runway Gen-3">Runway Gen-3 - Alpha</option>
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div className="mb-6">
                  <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                    Aspect Ratio
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {["16:9", "9:16", "1:1", "21:9"].map(r => (
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