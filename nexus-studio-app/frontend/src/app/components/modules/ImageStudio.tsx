import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Image as ImageIcon, Loader2, CheckCircle,
  Download, Settings, Grid3x3, List, Trash2, Play, X, ExternalLink, Plus, PlayCircle, Copy, Upload, FileText
} from "lucide-react";
import { api, STORAGE_BASE } from "../../../services/api";
import { MediaInspectorModal } from "../MediaInspectorModal";

interface QueueItem {
  id: number;
  prompt: string;
  model: string;
  ratio: string;
  status: "pending" | "rendering" | "success" | "failed";
  progress?: number;
  imageUrl?: string;
  timestamp: Date;
  referenceImages?: string[];
}

interface PromptMapping {
  [filename: string]: string;
}

function aspectShort(full: string): string {
  const m = full.match(/^(\d+:\d+)/);
  return m ? m[1] : full;
}

const POLL_INTERVAL_MS = 2000;

export function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("Imagen 3.5");
  const [ratio, setRatio] = useState("1:1");
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [imageAspects, setImageAspects] = useState<string[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [promptMapping, setPromptMapping] = useState<PromptMapping>({});
  const [csvLoaded, setCsvLoaded] = useState(false);
  const [mode, setMode] = useState<"text-to-image" | "image-to-image">("text-to-image");
  const [resolution, setResolution] = useState("1K");
  const [count, setCount] = useState(2);
  const [seed, setSeed] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    api.flowConfig().then((c) => {
      setImageModels(c.imageModels?.length ? c.imageModels : ["Imagen 3.5", "DALL-E 3", "Midjourney"]);
      setImageAspects(c.imageAspects?.length ? c.imageAspects : ["1:1", "16:9", "9:16", "4:3"]);
      setModel(c.defaults?.imageModel ?? "Imagen 3.5");
      const defaultAspect = c.defaults?.imageAspect ?? "1:1";
      setRatio(defaultAspect);
      setConfigLoaded(true);
    }).catch(() => {
      setImageModels(["Imagen 3.5", "DALL-E 3", "Midjourney"]);
      setImageAspects(["1:1", "16:9", "9:16", "4:3"]);
      setConfigLoaded(true);
    });
  }, []);

  const addToQueue = () => {
    if (!prompt.trim()) return;
    
    const newItem: QueueItem = {
      id: Date.now(),
      prompt,
      model,
      ratio,
      status: "pending",
      progress: 0,
      timestamp: new Date(),
      referenceImages: referenceImages.length > 0 ? [...referenceImages] : undefined,
    };
    
    setQueue([newItem, ...queue]);
    setPrompt("");
    setReferenceImages([]);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    
    const newImages: string[] = [];
    let loaded = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newImages.push(e.target?.result as string);
          loaded++;
          if (loaded === files.length) {
            setReferenceImages(prev => [...prev, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    // Process and auto-add images to queue
    const newQueueItems: QueueItem[] = [];
    let loaded = 0;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target?.result as string;
          
          // Get prompt from CSV mapping or use default
          const fileName = file.name;
          const mappedPrompt = promptMapping[fileName];
          const itemPrompt = mappedPrompt || prompt.trim() || `Image-to-image generation ${i + 1}`;
          
          // Create a new queue item for each dropped image
          const newItem: QueueItem = {
            id: Date.now() + i,
            prompt: itemPrompt,
            model,
            ratio,
            status: "pending",
            progress: 0,
            timestamp: new Date(),
            referenceImages: [imageData],
          };
          
          newQueueItems.push(newItem);
          loaded++;
          
          // When all images are loaded, add them to queue
          if (loaded === files.length) {
            setQueue(prev => [...newQueueItems, ...prev]);
            // Clear prompt after auto-adding
            setPrompt("");
          }
        };
        reader.readAsDataURL(file);
      } else {
        loaded++;
      }
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  function resolveImageUrl(url: string | undefined): string | undefined {
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
      const body = {
        prompt: item.prompt,
        mode: "image" as const,
        model: item.model,
        aspect: item.ratio,
        count: count || 1,
      };
      if (item.referenceImages?.length) {
        const base64 = item.referenceImages[0];
        if (typeof base64 === "string" && base64.startsWith("data:")) {
          body.image_bytes = base64.split(",")[1];
        }
      }
      if (seed.trim()) body.seed = parseInt(seed, 10);

      const { jobId } = await api.flowGenerate(body);

      const poll = async (): Promise<void> => {
        const res = await api.flowGenerateStatus(jobId);
        if (res.status === "done" && res.result?.images?.length) {
          const url = res.result.images[0]?.url;
          setQueue(prev => prev.map(i => i.id === id ? { ...i, status: "success" as const, progress: 100, imageUrl: resolveImageUrl(url) } : i));
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
      imageUrl: undefined,
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

  const handleCsvUpload = (files: FileList | null) => {
    if (!files) return;
    
    const file = files[0];
    if (file.type !== 'text/csv') {
      alert('Please upload a CSV file.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvData = e.target?.result as string;
      const rows = csvData.split('\n').map(row => row.trim());
      const mapping: PromptMapping = {};
      
      rows.forEach(row => {
        const [filename, prompt] = row.split(',');
        if (filename && prompt) {
          mapping[filename] = prompt;
        }
      });
      
      setPromptMapping(mapping);
      setCsvLoaded(true);
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full bg-[#050810] flex flex-col">
      {/* Top Bar */}
      <div className="h-16 border-b border-[#161d2f] flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ec4899] flex items-center justify-center shadow-lg shadow-orange-500/30">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>Image Studio</h1>
            <p className="text-gray-500 text-xs font-medium">High-fidelity image generation</p>
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
                className="px-6 py-2.5 bg-gradient-to-r from-[#f59e0b] to-[#ec4899] hover:opacity-90 rounded-lg text-white font-bold text-sm shadow-lg shadow-orange-500/30 transition-all flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <PlayCircle className="w-4 h-4" />
                Generate All ({pendingCount})
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
          <div 
            className="relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`relative transition-all ${isDragging ? 'opacity-50' : ''}`}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to create..."
                className="w-full h-[300px] px-8 py-8 bg-[#0a0f1d] border-2 border-[#161d2f] focus:border-[#f59e0b] rounded-2xl text-white text-xl font-['JetBrains_Mono'] leading-relaxed placeholder:text-gray-700 outline-none resize-none transition-all"
                style={{ fontWeight: 300 }}
                autoFocus
              />

              {/* Reference Images Grid - Inside Prompt Area */}
              {referenceImages.length > 0 && (
                <div className="absolute top-6 left-6 right-6 flex flex-wrap gap-2">
                  {referenceImages.map((img, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="relative group"
                    >
                      <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-[#ec4899] bg-[#0a0f1d]">
                        <img 
                          src={img} 
                          alt={`Reference ${index + 1}`} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => removeReferenceImage(index)}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full shadow-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="px-1.5 py-0.5 bg-[#ec4899]/90 backdrop-blur-sm rounded text-[10px] text-white font-mono font-bold text-center">
                          REF {index + 1}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Add More Button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-[#ec4899]/50 hover:border-[#ec4899] bg-[#0a0f1d]/50 hover:bg-[#0a0f1d] transition-all flex flex-col items-center justify-center gap-1 group"
                  >
                    <Plus className="w-6 h-6 text-[#ec4899] group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] text-[#ec4899] font-mono font-bold">ADD</span>
                  </button>
                </div>
              )}

              {/* Floating Bottom Bar */}
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 bg-[#050810]/90 backdrop-blur-sm border border-[#161d2f] rounded-lg text-gray-500 font-mono text-xs">
                    {prompt.length} characters
                  </span>
                  {referenceImages.length > 0 && (
                    <span className="px-3 py-1.5 bg-[#ec4899]/10 backdrop-blur-sm border border-[#ec4899]/30 rounded-lg text-[#ec4899] font-mono text-xs font-bold">
                      {referenceImages.length} {referenceImages.length === 1 ? 'Image' : 'Images'}
                    </span>
                  )}
                  <button onClick={() => setShowSettingsModal(true)} className="px-4 py-1.5 bg-[#050810]/90 backdrop-blur-sm border border-[#161d2f] hover:border-[#f59e0b] rounded-lg text-gray-400 hover:text-white font-medium text-xs transition-all flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                </div>

                <motion.button
                  onClick={addToQueue}
                  disabled={!prompt.trim()}
                  className="px-10 py-3 bg-gradient-to-r from-[#f59e0b] to-[#ec4899] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-white font-bold text-sm shadow-xl shadow-orange-500/40 transition-all flex items-center gap-3"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Sparkles className="w-5 h-5" />
                  Add to Queue
                </motion.button>
              </div>
            </div>

            {/* Drag Overlay */}
            {isDragging && (
              <div className="absolute inset-0 bg-[#ec4899]/10 border-4 border-dashed border-[#ec4899] rounded-2xl flex items-center justify-center pointer-events-none">
                <div className="bg-[#0a0f1d]/95 backdrop-blur-sm px-8 py-6 rounded-xl border-2 border-[#ec4899]">
                  <Upload className="w-16 h-16 text-[#ec4899] mx-auto mb-3" />
                  <p className="text-white font-bold text-lg text-center" style={{ fontFamily: 'Space Grotesk' }}>
                    Drop Images Here
                  </p>
                  <p className="text-gray-400 text-sm text-center mt-1">
                    Add reference images for image-to-image generation
                  </p>
                </div>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Quick Options */}
          <div className="mt-6 bg-[#0a0f1d] border border-[#161d2f] rounded-xl p-6 hidden">
            {/* Model & Ratio - Always Visible */}
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-sm font-medium">Model:</span>
                <div className="flex gap-2">
                  {(imageModels.length ? imageModels : ["Imagen 3.5", "DALL-E 3", "Midjourney"]).map(m => (
                    <button 
                      key={m}
                      onClick={() => setModel(m)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        model === m
                          ? "bg-[#f59e0b] text-white"
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
                  {(imageAspects.length ? imageAspects : ["1:1", "16:9", "9:16", "4:3"]).map(r => (
                    <button 
                      key={r}
                      onClick={() => setRatio(r)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        ratio === r
                          ? "bg-[#f59e0b] text-white"
                          : "bg-[#161d2f] text-gray-400 hover:text-white hover:bg-[#1a1f30]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-[#f59e0b] hover:text-[#ea580c] font-medium text-sm transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Advanced Settings
            </button>

            {/* Advanced Settings Content */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {/* Resolution */}
                      <div>
                        <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                          Resolution
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[#161d2f] border border-[#1f2937] hover:border-[#374151] rounded-lg text-white text-sm font-mono outline-none transition-all cursor-pointer"
                        >
                          <option value="1K">1K</option>
                          <option value="2K">2K</option>
                          <option value="4K">4K</option>
                          <option value="8K">8K</option>
                        </select>
                      </div>

                      {/* Count */}
                      <div>
                        <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                          Count
                        </label>
                        <select
                          value={count}
                          onChange={(e) => setCount(parseInt(e.target.value))}
                          className="w-full px-4 py-2.5 bg-[#161d2f] border border-[#1f2937] hover:border-[#374151] rounded-lg text-white text-sm font-mono outline-none transition-all cursor-pointer"
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="4">4</option>
                          <option value="8">8</option>
                          <option value="16">16</option>
                          <option value="32">32</option>
                          <option value="64">64</option>
                          <option value="124">124</option>
                        </select>
                      </div>

                      {/* Seed */}
                      <div>
                        <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                          Seed
                        </label>
                        <input
                          type="text"
                          value={seed}
                          onChange={(e) => setSeed(e.target.value)}
                          placeholder="Random"
                          className="w-full px-4 py-2.5 bg-[#161d2f] border border-[#1f2937] hover:border-[#374151] focus:border-[#f59e0b] rounded-lg text-white text-sm font-mono placeholder:text-gray-600 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* CSV Upload - Only show when queue has items */}
                    {queue.length > 0 && (
                      <div>
                        <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">
                          CSV Prompt Mapping
                        </label>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv"
                          onChange={(e) => handleCsvUpload(e.target.files)}
                          className="hidden"
                        />
                        <button
                          onClick={() => csvInputRef.current?.click()}
                          className={`w-full px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2.5 ${
                            csvLoaded 
                              ? 'bg-[#10b981]/10 border border-[#10b981]/30 text-emerald-400' 
                              : 'bg-[#161d2f] hover:bg-[#1f2937] border border-[#1f2937] hover:border-[#374151] text-gray-300 hover:text-white'
                          }`}
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {csvLoaded ? `${Object.keys(promptMapping).length} Prompts Loaded` : 'Upload CSV'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hidden File Input for drag & drop */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Queue Section */}
        {queue.length > 0 && (
          <div className="max-w-7xl mx-auto px-8 pb-12">
            <div className="mb-6">
              <h2 className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk' }}>
                Generation Queue ({queue.length})
              </h2>
            </div>

            {viewMode === "grid" ? (
              <div className="grid grid-cols-4 gap-4">
                <AnimatePresence>
                  {queue.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="group relative"
                    >
                      <div className="bg-[#0a0f1d] border border-[#161d2f] hover:border-[#f59e0b]/50 rounded-xl overflow-hidden transition-all">
                        {/* Image Preview */}
                        <div className="aspect-square bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] flex items-center justify-center relative overflow-hidden">
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
                                  className="p-4 bg-[#f59e0b] hover:bg-[#ea580c] rounded-full transition-all shadow-lg"
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
                              <Loader2 className="w-12 h-12 text-[#f59e0b] animate-spin" />
                              <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#0a0f1d]">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#ec4899]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.progress}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                              <div className="absolute top-2 right-2 px-2 py-1 bg-[#0a0f1d]/90 backdrop-blur-sm rounded text-xs text-white font-mono font-semibold">
                                {Math.round(item.progress || 0)}%
                              </div>
                            </>
                          )}

                          {/* Success State - Show actual image */}
                          {item.status === "success" && item.imageUrl && (
                            <>
                              <img 
                                src={item.imageUrl} 
                                alt={item.prompt}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                                <button 
                                  onClick={() => setSelectedItem(item)}
                                  className="p-3 bg-[#f59e0b] hover:bg-[#ea580c] rounded-lg transition-all"
                                >
                                  <ExternalLink className="w-5 h-5 text-white" />
                                </button>
                                <a 
                                  href={item.imageUrl}
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
                      <div className="bg-[#0a0f1d] border border-[#161d2f] hover:border-[#f59e0b]/50 rounded-xl p-4 transition-all flex items-center gap-4">
                        {/* Thumbnail */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] flex items-center justify-center">
                          {item.status === "pending" && (
                            <Plus className="w-6 h-6 text-gray-600" />
                          )}
                          {item.status === "queued" && (
                            <div className="w-6 h-6 rounded-full border-2 border-gray-600 border-dashed animate-spin" />
                          )}
                          {item.status === "rendering" && (
                            <Loader2 className="w-6 h-6 text-[#f59e0b] animate-spin" />
                          )}
                          {item.status === "success" && item.imageUrl && (
                            <img src={item.imageUrl} alt={item.prompt} className="w-full h-full object-cover" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-mono truncate mb-1">
                            {item.prompt}
                          </p>
                          {item.status === "rendering" && (
                            <div className="h-1 bg-[#161d2f] rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-[#f59e0b] to-[#ec4899]"
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
                                className="p-2 bg-[#f59e0b] hover:bg-[#ea580c] rounded-lg transition-all"
                                title="Generate Now"
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
                            <span className="text-amber-500 font-mono text-xs">{Math.round(item.progress || 0)}%</span>
                          )}
                          {item.status === "success" && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setSelectedItem(item)}
                                className="p-2 bg-[#161d2f] hover:bg-[#1a1f30] rounded-lg transition-all"
                              >
                                <ExternalLink className="w-4 h-4 text-white" />
                              </button>
                              <a 
                                href={item.imageUrl}
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

      {selectedItem && selectedItem.imageUrl && (
        <MediaInspectorModal
          open={true}
          onClose={() => setSelectedItem(null)}
          type="image"
          mediaUrl={selectedItem.imageUrl}
          title="Image"
          subtitle={`${selectedItem.model} • ${selectedItem.ratio}`}
          resolution="720P"
          aspectRatio={selectedItem.ratio}
          format="PNG"
          visionPrompt={selectedItem.prompt}
          onDownload={() => {
            const a = document.createElement("a");
            a.href = selectedItem.imageUrl!;
            a.download = `image-${selectedItem.id}.png`;
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
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                    Generation Settings
                  </h2>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="p-2 hover:bg-[#161d2f] rounded-lg transition-all"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {/* Model Selection */}
                <div className="mb-8">
                  <label className="block text-gray-400 text-sm font-medium mb-3">
                    Model:
                  </label>
                  <div className="flex gap-3">
                    {(imageModels.length ? imageModels : ["Imagen 3.5", "DALL-E 3", "Midjourney"]).map(m => (
                      <button 
                        key={m}
                        onClick={() => setModel(m)}
                        className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                          model === m
                            ? "bg-[#f59e0b] text-white shadow-lg shadow-orange-500/30"
                            : "bg-[#161d2f] text-gray-400 hover:text-white hover:bg-[#1a1f30]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ratio Selection */}
                <div className="mb-8">
                  <label className="block text-gray-400 text-sm font-medium mb-3">
                    Ratio:
                  </label>
                  <div className="flex gap-3">
                    {(imageAspects.length ? imageAspects : ["1:1", "16:9", "9:16", "4:3"]).map(r => (
                      <button 
                        key={r}
                        onClick={() => setRatio(r)}
                        className={`flex-1 px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                          ratio === r
                            ? "bg-[#f59e0b] text-white shadow-lg shadow-orange-500/30"
                            : "bg-[#161d2f] text-gray-400 hover:text-white hover:bg-[#1a1f30]"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#161d2f] my-8" />

                {/* Advanced Settings Header */}
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-[#f59e0b]" />
                  <h3 className="text-[#f59e0b] font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>
                    Advanced Settings
                  </h3>
                </div>

                {/* Advanced Settings Grid */}
                <div className="grid grid-cols-3 gap-6">
                  {/* Resolution */}
                  <div>
                    <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                      Resolution
                    </label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#f59e0b] focus:border-[#f59e0b] rounded-lg text-white text-sm font-mono outline-none transition-all cursor-pointer"
                    >
                      <option value="1K">1K</option>
                      <option value="2K">2K</option>
                      <option value="4K">4K</option>
                      <option value="8K">8K</option>
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
                      className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#f59e0b] focus:border-[#f59e0b] rounded-lg text-white text-sm font-mono outline-none transition-all cursor-pointer"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="4">4</option>
                      <option value="8">8</option>
                      <option value="16">16</option>
                      <option value="32">32</option>
                      <option value="64">64</option>
                      <option value="124">124</option>
                    </select>
                  </div>

                  {/* Seed */}
                  <div>
                    <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                      Seed
                    </label>
                    <input
                      type="text"
                      value={seed}
                      onChange={(e) => setSeed(e.target.value)}
                      placeholder="Random"
                      className="w-full px-4 py-3 bg-[#161d2f] border border-[#1f2937] hover:border-[#f59e0b] focus:border-[#f59e0b] rounded-lg text-white text-sm font-mono placeholder:text-gray-600 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="px-8 py-3 bg-gradient-to-r from-[#f59e0b] to-[#ec4899] hover:opacity-90 rounded-xl text-white font-bold text-sm shadow-lg shadow-orange-500/30 transition-all"
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