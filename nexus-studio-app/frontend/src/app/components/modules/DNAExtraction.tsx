import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Upload, Dna, Sparkles, Loader2, 
  Play, Trash2, Download, Archive, Film, Image as ImageIcon,
  Wand2, X, Copy, ChevronDown, ChevronUp, Zap, ArrowLeft, Search, User, Maximize2,
  Settings, ArrowRight, Crown, Video, MonitorPlay
} from "lucide-react";
import { CloneSettingsPanel } from "./CloneSettingsPanel";

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): CSVAsset[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    
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

  const proceedToNextStep = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const nextStep = session.currentStep + 1;

    if (nextStep === 1) {
      // Step 1: Analyze
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, currentStep: 1 } : s
      ));
    } else if (nextStep === 2) {
      // Step 2: Generate Image
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, currentStep: 2, analyzing: true, progress: 0 } : s
      ));

      // Simulate analyzing
      let progress = 0;
      const analyzeInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(analyzeInterval);
          
          setTimeout(() => {
            setSessions(prev => prev.map(s => 
              s.id === sessionId ? { ...s, analyzing: false, cloning: true, progress: 0 } : s
            ));

            // Simulate cloning
            let cloneProgress = 0;
            const cloneInterval = setInterval(() => {
              cloneProgress += Math.random() * 15;
              if (cloneProgress >= 100) {
                cloneProgress = 100;
                clearInterval(cloneInterval);
                
                setTimeout(() => {
                  const mockImagePrompt = {
                    "model": imageModel,
                    "prompt": "A cinematic composition featuring professional business elements with natural lighting",
                    "negative_prompt": "blurry, watermark, low quality",
                    "aspect_ratio": aspectRatio,
                    "resolution": imageResolution,
                    "style_reference": "stock asset DNA",
                    "keywords_extracted": ["professional", "business", "modern", "clean"]
                  };

                  setSessions(prev => prev.map(s => 
                    s.id === sessionId ? { 
                      ...s, 
                      cloning: false,
                      progress: 100,
                      clonedImageUrl: `https://picsum.photos/seed/${sessionId}/800/450`,
                      imagePrompt: JSON.stringify(mockImagePrompt, null, 2)
                    } : s
                  ));
                }, 300);
              } else {
                setSessions(prev => prev.map(s => 
                  s.id === sessionId ? { ...s, progress: cloneProgress } : s
                ));
              }
            }, 400);
          }, 500);
        } else {
          setSessions(prev => prev.map(s => 
            s.id === sessionId ? { ...s, progress } : s
          ));
        }
      }, 300);
    } else if (nextStep === 3) {
      // Step 3: Generate Video
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, currentStep: 3 } : s
      ));

      // Simulate video generation
      setTimeout(() => {
        const mockVideoPrompt = {
          "model": videoModel,
          "director_mode": "cinematic pan",
          "camera_motion": cameraMotion,
          "duration": videoDuration,
          "aspect_ratio": aspectRatio,
          "resolution": videoResolution,
          "based_on": "cloned image analysis"
        };

        setSessions(prev => prev.map(s => 
          s.id === sessionId ? { 
            ...s, 
            currentStep: 4,
            videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            videoPrompt: JSON.stringify(mockVideoPrompt, null, 2)
          } : s
        ));
      }, 2000);
    }
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
                <div className="flex items-center gap-2 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg">
                  <span className="text-gray-500 font-mono text-xs">THREADS</span>
                  <span className="text-white font-mono font-bold">2</span>
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
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              imageResolution={imageResolution}
              setImageResolution={setImageResolution}
              videoModel={videoModel}
              setVideoModel={setVideoModel}
              videoAspectRatio={videoAspectRatio}
              setVideoAspectRatio={setVideoAspectRatio}
              videoResolution={videoResolution}
              setVideoResolution={setVideoResolution}
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
              {/* Settings Icon */}
              <div className="flex items-center gap-2 px-3 py-2 bg-[#161d2f] rounded-lg">
                <Settings className="w-4 h-4 text-pink-500" />
                <span className="text-gray-400 text-xs font-mono">ACTIONS</span>
              </div>

              {/* Divider */}
              <div className="w-px h-8 bg-[#161d2f]" />

              {/* Step Buttons */}
              <button
                onClick={() => {
                  const idleSessions = sessions.filter(s => s.currentStep === 0);
                  idleSessions.forEach(s => proceedToNextStep(s.id));
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] hover:opacity-90 rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                STEP 1: ANALYZE
              </button>

              <button
                onClick={() => {
                  const step1Sessions = sessions.filter(s => s.currentStep === 1);
                  step1Sessions.forEach(s => proceedToNextStep(s.id));
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-[#f59e0b] to-[#ec4899] hover:opacity-90 rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2"
              >
                <Wand2 className="w-3 h-3" />
                STEP 2: IMAGE
              </button>

              <button
                onClick={() => {
                  const step2Sessions = sessions.filter(s => s.currentStep === 2 && !s.analyzing && !s.cloning && s.clonedImageUrl);
                  step2Sessions.forEach(s => proceedToNextStep(s.id));
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 rounded-lg text-white font-bold text-xs transition-all flex items-center gap-2"
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