import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, Dna, CheckSquare, Square, Sparkles, Loader2, 
  Play, Trash2, Download, Archive, Film, Image as ImageIcon,
  Wand2, X, Copy, Calendar, TrendingUp, ChevronDown, ChevronUp, Crown, Zap, ArrowLeft, Search, User, Maximize2
} from "lucide-react";

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
  status: "analyzing" | "cloning" | "complete";
  progress: number;
  clonedImageUrl?: string;
  videoUrl?: string;
  aspectRatio: string;
  imageResolution?: string;
  videoResolution?: string;
}

export function DNAExtraction() {
  const [assets, setAssets] = useState<CSVAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<CloneSession[]>([]);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [minDownloads, setMinDownloads] = useState(0);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1K");
  const [videoModel, setVideoModel] = useState("VEO 3.1 FAST");
  const [videoAspectRatio, setVideoAspectRatio] = useState("LANDSCAPE");
  const [videoResolution, setVideoResolution] = useState("1080P");
  const [autoDownload, setAutoDownload] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [cloneMode, setCloneMode] = useState<"keyword" | "creator">("keyword");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectorSession, setInspectorSession] = useState<CloneSession | null>(null);
  const [inspectorType, setInspectorType] = useState<"image" | "video" | null>(null);
  const [imageReference, setImageReference] = useState<string | null>(null);
  const imageRefInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): CSVAsset[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
    return lines.slice(1).map((line, index) => {
      // Simple CSV parsing (in production, use a proper CSV library)
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
      const cleaned = values.map(v => v.replace(/^"|"$/g, '').trim());
      
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

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const cloneSelected = () => {
    const selected = assets.filter(a => selectedIds.has(a.id));
    const newSessions: CloneSession[] = selected.map(asset => ({
      id: `session-${Date.now()}-${asset.id}`,
      asset,
      status: "analyzing",
      progress: 0,
      aspectRatio: "16:9",
    }));

    setSessions(prev => [...newSessions, ...prev]);
    setSelectedIds(new Set());

    // Simulate cloning process
    newSessions.forEach((session, index) => {
      setTimeout(() => {
        // Analyzing phase
        let progress = 0;
        const analyzeInterval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 100) {
            progress = 100;
            clearInterval(analyzeInterval);
            
            // Move to cloning
            setTimeout(() => {
              setSessions(prev => prev.map(s => 
                s.id === session.id ? { ...s, status: "cloning", progress: 0 } : s
              ));

              // Cloning progress
              let cloneProgress = 0;
              const cloneInterval = setInterval(() => {
                cloneProgress += Math.random() * 15;
                if (cloneProgress >= 100) {
                  cloneProgress = 100;
                  clearInterval(cloneInterval);
                  
                  // Complete
                  setTimeout(() => {
                    setSessions(prev => prev.map(s => 
                      s.id === session.id ? { 
                        ...s, 
                        status: "complete", 
                        progress: 100,
                        clonedImageUrl: `https://picsum.photos/seed/${session.id}/800/450`,
                        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                      } : s
                    ));
                  }, 500);
                } else {
                  setSessions(prev => prev.map(s => 
                    s.id === session.id ? { ...s, progress: cloneProgress } : s
                  ));
                }
              }, 400);
            }, 800);
          } else {
            setSessions(prev => prev.map(s => 
              s.id === session.id ? { ...s, progress } : s
            ));
          }
        }, 300);
      }, index * 200);
    });
  };

  const generateAll = () => {
    const pending = sessions.filter(s => s.status !== "complete");
    // Trigger generation for pending items
    console.log("Generating all:", pending);
  };

  const removeSession = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const clearSessions = () => {
    setSessions([]);
  };

  const filteredAssets = assets.filter(asset => {
    if (minDownloads > 0 && asset.downloads < minDownloads) return false;
    // Add date filtering logic if needed
    return true;
  });

  const analysingCount = sessions.filter(s => s.status === "analyzing").length;
  const cloningCount = sessions.filter(s => s.status === "cloning").length;
  const completeCount = sessions.filter(s => s.status === "complete").length;

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

        {sessions.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg">
              {analysingCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-pink-400 font-mono text-sm">{analysingCount}</span>
                </div>
              )}
              {cloningCount > 0 && (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                  <span className="text-purple-400 font-mono text-sm">{cloningCount}</span>
                </div>
              )}
              {completeCount > 0 && (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-400 font-mono text-sm">{completeCount}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {assets.length === 0 ? (
          /* Upload State */
          <div className="max-w-4xl mx-auto px-8 py-16">
            {/* Hero Section */}
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
          /* Table View - Redesigned */
          <div className="h-full flex flex-col">
            {/* Header Bar */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#161d2f]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setAssets([]);
                    setSelectedIds(new Set());
                  }}
                  className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors group"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                </button>
                <h2 className="text-white font-bold text-xl uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk' }}>
                  LOADED {filteredAssets.length} ASSETS
                </h2>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-pink-500 font-bold text-sm uppercase tracking-wider">
                  {selectedIds.size} SELECTED
                </span>
                <button
                  onClick={toggleSelectAll}
                  className="px-4 py-2.5 bg-[#0a0f1d] hover:bg-[#161d2f] border border-[#161d2f] rounded-lg text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wide transition-all"
                >
                  {selectedIds.size === filteredAssets.length ? "DESELECT ALL" : "SELECT ALL"}
                </button>
                {selectedIds.size > 0 && (
                  <motion.button
                    onClick={cloneSelected}
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

            {/* Assets List */}
            <div className="flex-1 overflow-y-auto px-8 py-4">
              <div className="grid grid-cols-3 gap-6">
                <AnimatePresence>
                  {filteredAssets.map((asset) => (
                    <motion.div
                      key={asset.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative group cursor-pointer"
                      onClick={() => toggleSelection(asset.id)}
                    >
                      {/* Card Content */}
                      <div className={`bg-[#0a0f1d] rounded-xl overflow-hidden border-2 transition-all ${
                        selectedIds.has(asset.id)
                          ? 'border-[#ec4899] shadow-lg shadow-pink-500/30'
                          : 'border-[#161d2f] hover:border-[#1a1f30]'
                      }`}>
                        {/* Image Preview */}
                        <div className="relative aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] overflow-hidden">
                          <img
                            src={asset.thumbnailUrl}
                            alt={asset.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                            }}
                          />
                          
                          {/* Checkbox Overlay - Top Right */}
                          <div className="absolute top-3 right-3">
                            <motion.div
                              className={`w-7 h-7 rounded-md border-2 flex items-center justify-center backdrop-blur-sm transition-all ${
                                selectedIds.has(asset.id)
                                  ? 'bg-[#ec4899] border-[#ec4899]'
                                  : 'bg-black/30 border-white/30 group-hover:border-white/50'
                              }`}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {selectedIds.has(asset.id) && (
                                <CheckSquare className="w-5 h-5 text-white" strokeWidth={3} />
                              )}
                            </motion.div>
                          </div>

                          {/* Downloads Badge - Top Left */}
                          <div className="absolute top-3 left-3">
                            <div className="px-3 py-1.5 bg-[#0ea5e9] backdrop-blur-sm rounded-lg flex items-center gap-2">
                              <TrendingUp className="w-3 h-3 text-white" />
                              <span className="text-white font-mono font-bold text-sm">
                                {asset.downloads}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Info Section */}
                        <div className="p-4 space-y-3">
                          {/* Title */}
                          <p className="text-white text-xs font-mono leading-relaxed line-clamp-2 min-h-[2.5rem]">
                            {asset.title}
                          </p>

                          {/* Creator */}
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
                </AnimatePresence>
              </div>
            </div>
          </div>
        ) : (
          /* Active Sessions */
          <div className="max-w-[1800px] mx-auto px-8 py-8">
            {/* Session Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={() => {
                      setSessions([]);
                    }}
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
                <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg">
                  <span className="text-gray-500 font-mono text-xs">THREADS</span>
                  <span className="text-white font-mono font-bold">2</span>
                </div>

                {completeCount > 0 && (
                  <>
                    <button className="px-4 py-2.5 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      GENERATE ALL
                    </button>
                    <button className="px-4 py-2.5 bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      UPSCALE ALL 4K
                    </button>
                    <button className="px-4 py-2.5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center gap-2">
                      <Film className="w-4 h-4" />
                      GENERATE ALL VIDEOS
                    </button>
                    <button className="px-4 py-2.5 bg-gradient-to-r from-[#0ea5e9] to-[#06b6d4] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center gap-2">
                      <Archive className="w-4 h-4" />
                      DOWNLOAD ALL (ZIP)
                    </button>
                  </>
                )}

                <button 
                  onClick={clearSessions}
                  className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 font-bold text-sm transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  CLEAR
                </button>
              </div>
            </div>

            {/* Clone Settings Panel */}
            <motion.div 
              className="bg-[#0a0f1d] border border-[#161d2f] rounded-xl overflow-hidden mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#161d2f]/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-pink-500" />
                  <h3 className="text-white font-bold text-sm uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk' }}>
                    Clone Settings
                  </h3>
                </div>
                {settingsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              <AnimatePresence>
                {settingsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[#161d2f]"
                  >
                    <div className="p-6 space-y-6">
                      {/* Image Reference Upload */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <ImageIcon className="w-4 h-4 text-[#ec4899]" />
                          <span className="text-[#ec4899] text-xs font-mono font-bold uppercase tracking-wider">
                            Image Reference (Optional)
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="col-span-1">
                            <input
                              ref={imageRefInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (e) => setImageReference(e.target?.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                            />
                            {imageReference ? (
                              <div className="relative aspect-square bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-xl overflow-hidden border-2 border-[#ec4899]">
                                <img src={imageReference} alt="Reference" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setImageReference(null)}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 rounded-lg transition-colors"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => imageRefInputRef.current?.click()}
                                className="aspect-square w-full border-2 border-dashed border-[#161d2f] hover:border-[#ec4899] rounded-xl bg-[#0d1628] hover:bg-[#161d2f] transition-all flex flex-col items-center justify-center gap-2"
                              >
                                <Upload className="w-6 h-6 text-gray-600" />
                                <span className="text-gray-600 text-[10px] font-mono uppercase">Upload</span>
                              </button>
                            )}
                          </div>
                          <div className="col-span-3">
                            <p className="text-gray-500 text-xs leading-relaxed mb-3">
                              Upload a reference image for image-to-image cloning. The AI will analyze and use this as a style guide alongside the stock asset.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1.5 bg-[#0d1628] rounded-lg text-[#ec4899] text-[10px] font-mono font-bold">IMG2IMG MODE</span>
                              <span className="px-3 py-1.5 bg-[#0d1628] rounded-lg text-gray-500 text-[10px] font-mono">STYLE TRANSFER</span>
                              <span className="px-3 py-1.5 bg-[#0d1628] rounded-lg text-gray-500 text-[10px] font-mono">COMPOSITION GUIDE</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Top Row: Aspect Ratio, Resolution, Video Model */}
                      <div className="grid grid-cols-3 gap-6">
                        {/* Aspect Ratio */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <ImageIcon className="w-4 h-4 text-[#0ea5e9]" />
                            <span className="text-[#0ea5e9] text-xs font-mono font-bold uppercase tracking-wider">
                              Aspect Ratio
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {["AUTO", "1:1 SQUARE", "9:16 TALL", "4:3", "3:4", "2:3", "4:5", "5:4", "21:9 ULTRA WIDE"].map((ar) => (
                              <button
                                key={ar}
                                onClick={() => setAspectRatio(ar)}
                                className={`px-3 py-2.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all ${
                                  aspectRatio === ar
                                    ? "bg-[#0ea5e9] text-white shadow-lg shadow-[#0ea5e9]/30"
                                    : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                                }`}
                              >
                                {ar}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Resolution */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                            <span className="text-[#f59e0b] text-xs font-mono font-bold uppercase tracking-wider">
                              Resolution
                            </span>
                          </div>
                          <div className="space-y-2">
                            <button
                              onClick={() => setResolution("1K")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                                resolution === "1K"
                                  ? "bg-[#f59e0b] text-white shadow-lg shadow-[#f59e0b]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              1K (DEFAULT)
                            </button>
                            <button
                              onClick={() => setResolution("2K")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                                resolution === "2K"
                                  ? "bg-[#f59e0b] text-white shadow-lg shadow-[#f59e0b]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              2K
                            </button>
                            <button
                              onClick={() => setResolution("4K")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                resolution === "4K"
                                  ? "bg-[#f59e0b] text-white shadow-lg shadow-[#f59e0b]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              <Crown className="w-3 h-3" />
                              4K ULTRA HD
                            </button>
                          </div>
                        </div>

                        {/* Video Generation Model */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Film className="w-4 h-4 text-[#8b5cf6]" />
                            <span className="text-[#8b5cf6] text-xs font-mono font-bold uppercase tracking-wider">
                              Video Generation Model
                            </span>
                          </div>
                          <div className="space-y-2">
                            <button
                              onClick={() => setVideoModel("VEO 3.1 FAST")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                videoModel === "VEO 3.1 FAST"
                                  ? "bg-[#8b5cf6] text-white shadow-lg shadow-[#8b5cf6]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              <Zap className="w-3 h-3" />
                              VEO 3.1 FAST (DRAFT)
                            </button>
                            <button
                              onClick={() => setVideoModel("VEO 3.1 HQ")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                videoModel === "VEO 3.1 HQ"
                                  ? "bg-[#8b5cf6] text-white shadow-lg shadow-[#8b5cf6]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              VEO 3.1 HIGH QUALITY
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Video Aspect Ratio, Video Resolution, Auto-Download */}
                      <div className="grid grid-cols-3 gap-6">
                        {/* Video Aspect Ratio */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Film className="w-4 h-4 text-[#8b5cf6]" />
                            <span className="text-[#8b5cf6] text-xs font-mono font-bold uppercase tracking-wider">
                              Video Aspect Ratio
                            </span>
                          </div>
                          <div className="space-y-2">
                            <button
                              onClick={() => setVideoAspectRatio("LANDSCAPE")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                                videoAspectRatio === "LANDSCAPE"
                                  ? "bg-[#8b5cf6] text-white shadow-lg shadow-[#8b5cf6]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              LANDSCAPE (16:9)
                            </button>
                            <button
                              onClick={() => setVideoAspectRatio("PORTRAIT")}
                              className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                                videoAspectRatio === "PORTRAIT"
                                  ? "bg-[#8b5cf6] text-white shadow-lg shadow-[#8b5cf6]/30"
                                  : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                              }`}
                            >
                              PORTRAIT (9:16)
                            </button>
                          </div>
                        </div>

                        {/* Video Resolution */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-4 h-4 text-[#ec4899]" />
                            <span className="text-[#ec4899] text-xs font-mono font-bold uppercase tracking-wider">
                              Video Resolution
                            </span>
                          </div>
                          <div className="space-y-2">
                            {["720P", "1080P", "4K UHD"].map((vres) => (
                              <button
                                key={vres}
                                onClick={() => setVideoResolution(vres)}
                                className={`w-full px-4 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                                  videoResolution === vres
                                    ? "bg-[#ec4899] text-white shadow-lg shadow-[#ec4899]/30"
                                    : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                                }`}
                              >
                                {vres}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Auto-Download */}
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Download className="w-4 h-4 text-[#10b981]" />
                            <span className="text-[#10b981] text-xs font-mono font-bold uppercase tracking-wider">
                              Auto-Download
                            </span>
                          </div>
                          <button
                            onClick={() => setAutoDownload(!autoDownload)}
                            className={`w-full px-4 py-4 rounded-lg text-sm font-mono font-bold uppercase transition-all ${
                              autoDownload
                                ? "bg-[#10b981] text-white shadow-lg shadow-[#10b981]/30"
                                : "bg-[#0d1628] text-gray-500 hover:bg-[#161d2f] hover:text-gray-400"
                            }`}
                          >
                            {autoDownload ? "ON" : "OFF"}
                          </button>
                          <p className="text-gray-600 text-[10px] mt-3 leading-relaxed">
                            Download each image or video when done. For big tasks you get one .zip when batch completes
                          </p>
                        </div>
                      </div>

                      {/* Negative Prompt */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <X className="w-4 h-4 text-red-500" />
                          <span className="text-red-500 text-xs font-mono font-bold uppercase tracking-wider">
                            Negative Prompt
                          </span>
                        </div>
                        <textarea
                          value={negativePrompt}
                          onChange={(e) => setNegativePrompt(e.target.value)}
                          placeholder="Things to avoid... e.g. blurry, watermark, text, low quality, deformed"
                          className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] focus:border-red-500/50 rounded-lg text-white text-sm font-mono leading-relaxed placeholder:text-gray-700 outline-none resize-none transition-colors"
                          rows={3}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Sessions Grid */}
            <div className="space-y-6">
              <AnimatePresence>
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#0a0f1d] border border-[#161d2f] rounded-2xl p-6"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ec4899] to-[#8b5cf6] flex items-center justify-center">
                          <Dna className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>
                            CLONE SETTINGS
                          </h3>
                          <p className="text-gray-500 text-xs font-mono">16:9 • 1K</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeSession(session.id)}
                        className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500 hover:text-red-400" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                      {/* Reference */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <ImageIcon className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-500 text-xs font-mono font-semibold uppercase tracking-wide">
                            Reference
                          </span>
                          <span className="text-gray-700 text-xs font-mono">{session.asset.id}</span>
                        </div>
                        <div className="aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-xl overflow-hidden mb-4">
                          <img
                            src={session.asset.thumbnailUrl}
                            alt={session.asset.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x450?text=Reference';
                            }}
                          />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <span className="text-gray-600 text-xs font-mono uppercase">Creator</span>
                            <p className="text-white text-sm font-medium">{session.asset.creator}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs font-mono uppercase">Downloads</span>
                            <p className="text-[#0ea5e9] text-sm font-mono font-bold">{session.asset.downloads}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs font-mono uppercase">Keywords ({session.asset.keywords.split(',').length})</span>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {session.asset.keywords.split(',').slice(0, 12).map((kw, i) => (
                                <span key={i} className="px-2 py-1 bg-[#161d2f] rounded text-xs text-gray-400 font-mono">
                                  {kw.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cloned Image */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-pink-500" />
                          <span className="text-pink-500 text-xs font-mono font-semibold uppercase tracking-wide">
                            Cloned Image
                          </span>
                          <span className="text-gray-700 text-xs font-mono">AI Vision</span>
                        </div>
                        <div className="aspect-video bg-gradient-to-br from-[#1a0a1d] to-[#0a0f1d] rounded-xl overflow-hidden mb-4 relative flex items-center justify-center border-2 border-[#ec4899]/30">
                          {session.status === "analyzing" && (
                            <div className="flex flex-col items-center gap-4">
                              <div className="w-16 h-16 rounded-full border-4 border-pink-500/30 border-t-pink-500 animate-spin" />
                              <div className="text-center">
                                <p className="text-pink-500 font-bold text-sm mb-1">ANALYZING</p>
                                <p className="text-gray-600 text-xs font-mono">{Math.round(session.progress)}%</p>
                              </div>
                            </div>
                          )}
                          {session.status === "cloning" && (
                            <div className="flex flex-col items-center gap-4">
                              <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
                              <div className="text-center">
                                <p className="text-purple-500 font-bold text-sm mb-1">CLONING</p>
                                <p className="text-gray-600 text-xs font-mono">{Math.round(session.progress)}%</p>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#0a0f1d]">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6]"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${session.progress}%` }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            </div>
                          )}
                          {session.status === "complete" && session.clonedImageUrl && (
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
                              <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500/90 backdrop-blur-sm rounded text-xs text-white font-semibold flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Ready
                              </div>
                              <button
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("image");
                                }}
                                className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors group"
                              >
                                <Maximize2 className="w-4 h-4 text-white" />
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs italic text-center">
                          {session.status === "complete" 
                            ? "Vision analysis prompt will appear here..."
                            : "Analyzing visual patterns and composition..."}
                        </p>
                      </div>

                      {/* Animated Clone (Video) */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Film className="w-4 h-4 text-purple-500" />
                          <span className="text-purple-500 text-xs font-mono font-semibold uppercase tracking-wide">
                            Animated Clone (Veo)
                          </span>
                        </div>
                        <div className="aspect-video bg-gradient-to-br from-[#0a0a1d] to-[#0a0f1d] rounded-xl overflow-hidden mb-4 relative flex items-center justify-center border-2 border-[#8b5cf6]/30">
                          {session.status !== "complete" ? (
                            <div className="flex flex-col items-center gap-3">
                              <Film className="w-12 h-12 text-gray-700" />
                              <p className="text-gray-700 text-xs font-mono uppercase">Waiting for clone...</p>
                            </div>
                          ) : (
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
                              <div className="absolute bottom-3 left-3 px-2 py-1 bg-purple-500/90 backdrop-blur-sm rounded text-xs text-white font-semibold flex items-center gap-1">
                                <Play className="w-3 h-3" />
                                Video Ready
                              </div>
                              <button
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("video");
                                }}
                                className="absolute bottom-3 right-3 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg transition-colors group"
                              >
                                <Maximize2 className="w-4 h-4 text-white" />
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-gray-500 text-xs italic text-center">
                          {session.status === "complete"
                            ? "Director mode planning metadata will appear here..."
                            : "Video generation pending..."}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Bulk Queue Table */}
            {sessions.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-bold text-xl uppercase tracking-wide" style={{ fontFamily: 'Space Grotesk' }}>
                    BULK QUEUE
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm font-mono">{sessions.length} items</span>
                  </div>
                </div>

                <div className="bg-[#0a0f1d] border border-[#161d2f] rounded-xl overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-[40px_40px_60px_80px_100px_100px_1fr_200px_100px_120px_60px_120px] gap-4 px-4 py-3 bg-[#050810] border-b border-[#161d2f]">
                    <div className="flex items-center justify-center">
                      <input type="checkbox" className="w-4 h-4 rounded border-2 border-gray-600 bg-transparent" />
                    </div>
                    <div />
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">#</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Thumb</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Type</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Status</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Prompt</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Model</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Res</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs font-mono uppercase">Progress</span>
                    </div>
                    <div className="text-center">
                      <span className="text-gray-500 text-xs font-mono uppercase">DL</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 text-xs font-mono uppercase">Actions</span>
                    </div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-[#161d2f]">
                    {sessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="grid grid-cols-[40px_40px_60px_80px_100px_100px_1fr_200px_100px_120px_60px_120px] gap-4 px-4 py-3 hover:bg-[#0d1628]/50 transition-colors"
                      >
                        {/* Checkbox */}
                        <div className="flex items-center justify-center">
                          <input type="checkbox" className="w-4 h-4 rounded border-2 border-gray-600 bg-transparent" />
                        </div>

                        {/* Expand Arrow */}
                        <div className="flex items-center justify-center">
                          <button className="text-gray-600 hover:text-gray-400 transition-colors">
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        {/* # */}
                        <div className="flex items-center">
                          <span className="text-gray-400 text-sm font-mono">{index + 1}</span>
                        </div>

                        {/* Thumbnail */}
                        <div className="flex items-center">
                          <div className="w-14 h-14 bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-xl overflow-hidden border border-[#161d2f]">
                            <img
                              src={session.asset.thumbnailUrl}
                              alt={session.asset.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/56x56?text=Ref';
                              }}
                            />
                          </div>
                        </div>

                        {/* Type */}
                        <div className="flex items-center gap-1">
                          <div className="px-2 py-1 bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 rounded flex items-center gap-1">
                            <Film className="w-3 h-3 text-[#8b5cf6]" />
                            <span className="text-[#8b5cf6] text-xs font-mono font-bold uppercase">Video</span>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center">
                          {session.status === "analyzing" && (
                            <div className="px-2 py-1 bg-pink-500/10 border border-pink-500/30 rounded">
                              <span className="text-pink-500 text-xs font-mono font-bold uppercase">Analyzing</span>
                            </div>
                          )}
                          {session.status === "cloning" && (
                            <div className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 rounded">
                              <span className="text-purple-500 text-xs font-mono font-bold uppercase">Cloning</span>
                            </div>
                          )}
                          {session.status === "complete" && (
                            <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded">
                              <span className="text-emerald-500 text-xs font-mono font-bold uppercase">Complete</span>
                            </div>
                          )}
                        </div>

                        {/* Prompt */}
                        <div className="flex items-center">
                          <input
                            type="text"
                            placeholder="Enter prompt..."
                            className="w-full px-3 py-2 bg-[#050810] border border-[#161d2f] rounded-lg text-white text-xs font-mono placeholder:text-gray-700 outline-none focus:border-[#8b5cf6]/50 transition-colors"
                          />
                        </div>

                        {/* Model */}
                        <div className="flex items-center">
                          <select className="w-full px-3 py-2 bg-[#050810] border border-[#161d2f] rounded-lg text-gray-400 text-xs font-mono outline-none focus:border-[#8b5cf6]/50 transition-colors appearance-none cursor-pointer">
                            <option>Veo 3.1 - i2v Start...</option>
                            <option>Veo 3.1 Fast</option>
                            <option>Veo 3.1 HQ</option>
                          </select>
                        </div>

                        {/* Resolution */}
                        <div className="flex items-center">
                          <select className="w-full px-3 py-2 bg-[#050810] border border-[#161d2f] rounded-lg text-gray-400 text-xs font-mono outline-none focus:border-[#8b5cf6]/50 transition-colors appearance-none cursor-pointer">
                            <option>720p</option>
                            <option>1080p</option>
                            <option>4K UHD</option>
                          </select>
                        </div>

                        {/* Progress */}
                        <div className="flex items-center">
                          {session.status !== "complete" ? (
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-500 text-xs font-mono">{Math.round(session.progress)}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-[#161d2f] rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all ${
                                    session.status === "analyzing" 
                                      ? "bg-pink-500" 
                                      : "bg-gradient-to-r from-[#ec4899] to-[#8b5cf6]"
                                  }`}
                                  style={{ width: `${session.progress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500 text-xs font-mono font-bold">100%</span>
                            </div>
                          )}
                        </div>

                        {/* Download */}
                        <div className="flex items-center justify-center">
                          {session.status === "complete" && (
                            <button className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors group">
                              <Download className="w-4 h-4 text-gray-500 group-hover:text-[#0ea5e9]" />
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          {session.status === "complete" && (
                            <>
                              <button
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("image");
                                }}
                                className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors group"
                                title="View Image"
                              >
                                <ImageIcon className="w-4 h-4 text-gray-500 group-hover:text-[#ec4899]" />
                              </button>
                              <button
                                onClick={() => {
                                  setInspectorSession(session);
                                  setInspectorType("video");
                                }}
                                className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors group"
                                title="View Video"
                              >
                                <Play className="w-4 h-4 text-gray-500 group-hover:text-[#8b5cf6]" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => removeSession(session.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-500 group-hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inspector Modal */}
      <AnimatePresence>
        {inspectorSession && inspectorType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-8"
            onClick={() => {
              setInspectorSession(null);
              setInspectorType(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0f1d] border-2 border-[#161d2f] rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-[#161d2f] sticky top-0 bg-[#0a0f1d] z-10">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    inspectorType === "image" 
                      ? "bg-gradient-to-br from-[#ec4899] to-[#8b5cf6]" 
                      : "bg-gradient-to-br from-[#8b5cf6] to-[#6366f1]"
                  }`}>
                    {inspectorType === "image" ? (
                      <Sparkles className="w-5 h-5 text-white" />
                    ) : (
                      <Film className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-xl" style={{ fontFamily: 'Space Grotesk' }}>
                      {inspectorType === "image" ? "CLONED IMAGE" : "ANIMATED CLONE (VEO)"}
                    </h2>
                    <p className="text-gray-500 text-sm font-mono">
                      {inspectorType === "image" ? "720P • AI Vision" : "720P • Video Generation"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setInspectorSession(null);
                    setInspectorType(null);
                  }}
                  className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500 hover:text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="grid grid-cols-3 gap-8">
                  {/* Preview */}
                  <div className="col-span-2">
                    <div className="aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-xl overflow-hidden mb-6">
                      {inspectorType === "image" && inspectorSession.clonedImageUrl ? (
                        <img
                          src={inspectorSession.clonedImageUrl}
                          alt="Cloned"
                          className="w-full h-full object-contain"
                        />
                      ) : inspectorType === "video" && inspectorSession.videoUrl ? (
                        <video
                          src={inspectorSession.videoUrl}
                          className="w-full h-full object-contain"
                          controls
                          autoPlay
                          loop
                        />
                      ) : null}
                    </div>

                    {/* Prompt Preview */}
                    <div className="bg-[#050810] border border-[#161d2f] rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Wand2 className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-[#f59e0b] text-xs font-mono font-bold uppercase tracking-wider">
                          Vision Analysis Prompt
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm font-mono leading-relaxed">
                        A professional scene featuring a person in business attire, shot in a modern office environment with natural lighting. The composition emphasizes clean lines, contemporary architecture, and a sophisticated color palette. Captured with shallow depth of field to create visual depth and professional polish.
                      </p>
                    </div>
                  </div>

                  {/* Actions Panel */}
                  <div className="space-y-4">
                    {/* Info Card */}
                    <div className="bg-[#050810] border border-[#161d2f] rounded-xl p-4 space-y-3">
                      <div>
                        <span className="text-gray-600 text-xs font-mono uppercase">Current Resolution</span>
                        <p className="text-white text-sm font-bold">720P</p>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs font-mono uppercase">Aspect Ratio</span>
                        <p className="text-white text-sm font-bold">{inspectorSession.aspectRatio}</p>
                      </div>
                      <div>
                        <span className="text-gray-600 text-xs font-mono uppercase">Format</span>
                        <p className="text-white text-sm font-bold">{inspectorType === "image" ? "PNG" : "MP4"}</p>
                      </div>
                    </div>

                    {/* Upscale Options */}
                    {inspectorType === "image" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Wand2 className="w-4 h-4 text-[#f59e0b]" />
                          <span className="text-[#f59e0b] text-xs font-mono font-bold uppercase tracking-wider">
                            Upscale Image
                          </span>
                        </div>
                        <button className="w-full px-4 py-3 bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#f59e0b]/30 transition-all flex items-center justify-center gap-2">
                          <Crown className="w-4 h-4" />
                          UPSCALE TO 2K
                        </button>
                        <button className="w-full px-4 py-3 bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#f59e0b]/30 transition-all flex items-center justify-center gap-2">
                          <Crown className="w-4 h-4" />
                          UPSCALE TO 4K ULTRA HD
                        </button>
                      </div>
                    )}

                    {/* Video Options */}
                    {inspectorType === "video" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Wand2 className="w-4 h-4 text-[#8b5cf6]" />
                          <span className="text-[#8b5cf6] text-xs font-mono font-bold uppercase tracking-wider">
                            Upscale Video
                          </span>
                        </div>
                        <button className="w-full px-4 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#8b5cf6]/30 transition-all flex items-center justify-center gap-2">
                          UPSCALE TO 1080P
                        </button>
                        <button className="w-full px-4 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#8b5cf6]/30 transition-all flex items-center justify-center gap-2">
                          <Crown className="w-4 h-4" />
                          UPSCALE TO 4K UHD
                        </button>
                      </div>
                    )}

                    {/* Download Options */}
                    <div className="space-y-3 pt-4 border-t border-[#161d2f]">
                      <button className="w-full px-4 py-3 bg-gradient-to-r from-[#0ea5e9] to-[#06b6d4] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#0ea5e9]/30 transition-all flex items-center justify-center gap-2">
                        <Download className="w-4 h-4" />
                        DOWNLOAD
                      </button>
                      <button className="w-full px-4 py-3 bg-gradient-to-r from-[#10b981] to-[#059669] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#10b981]/30 transition-all flex items-center justify-center gap-2">
                        <Archive className="w-4 h-4" />
                        SEND TO ARCHIVE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}