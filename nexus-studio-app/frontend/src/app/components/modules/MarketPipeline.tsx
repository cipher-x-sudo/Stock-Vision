import { useState, useEffect } from "react";
import { Search, Zap, ChevronDown, Download, Sparkles, Image as ImageIcon, Video, Shapes, Pen, Layers, Filter, X, Brain, Dna } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import Masonry from "react-responsive-masonry";
import { PromptTable } from "../PromptTable";
import { useMediaViewer } from "../../contexts/MediaViewerContext";
import { MediaItem } from "../MediaViewer";
import { api, mapApiPromptsToRows, type TrackAdobeImage, type AnalysisResult, type PromptRow } from "../../../services/api";

const EVENT_ICONS: Record<string, string> = {
  "Christmas": "🎄",
  "Halloween": "🎃",
  "Valentine's Day": "💝",
  "New Year": "🎆",
  "Thanksgiving": "🦃",
  "Graduation": "🎓",
  "default": "📅",
};

function trackAdobeToMediaItem(img: TrackAdobeImage): MediaItem {
  const downloads = typeof img.downloads === "string" ? parseInt(img.downloads, 10) : (img.downloads ?? 0);
  return {
    id: img.id,
    title: img.title ?? "",
    downloads: Number.isFinite(downloads) ? downloads : 0,
    premium: img.premium ?? "Standard",
    creator: img.creator ?? "",
    creatorId: img.creatorId ?? "",
    mediaType: img.mediaType ?? "Photo",
    category: img.category ?? "",
    contentType: img.contentType ?? "image/jpeg",
    dimensions: img.dimensions ?? "0 x 0",
    uploadDate: img.uploadDate ?? new Date().toISOString(),
    keywords: Array.isArray(img.keywords) ? img.keywords : [],
    thumbnailUrl: img.thumbnailUrl ?? "",
    isAI: !!img.isAI,
  };
}

function daysUntil(dateStr: string): number {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  } catch {
    return 0;
  }
}

export function MarketPipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [minDemand, setMinDemand] = useState([500]);
  const [scanProgress, setScanProgress] = useState(0);
  const { openMedia } = useMediaViewer();

  const [upcomingEvents, setUpcomingEvents] = useState<Array<{ id: number; icon: string; title: string; daysUntil: number }>>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [evidence, setEvidence] = useState<MediaItem[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [promptRows, setPromptRows] = useState<PromptRow[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [isExpandingPrompts, setIsExpandingPrompts] = useState(false);
  const [promptProgress, setPromptProgress] = useState(0);
  const [isConceptualizing, setIsConceptualizing] = useState(false);
  const [conceptProgress, setConceptProgress] = useState(0);
  const [isExtractingDNA, setIsExtractingDNA] = useState(false);
  const [dnaProgress, setDNAProgress] = useState(0);
  
  const [filterMediaType, setFilterMediaType] = useState<string>("all");
  const [filterAIOnly, setFilterAIOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [sortOrder, setSortOrder] = useState<"relevance" | "most-downloads" | "newest" | "featured">("relevance");
  const [assetType, setAssetType] = useState<"all" | "photo" | "video" | "vector" | "illustration">("all");
  const [pagesFrom, setPagesFrom] = useState(1);
  const [pagesTo, setPagesTo] = useState(3);
  const [minimumDownloads, setMinimumDownloads] = useState(5);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [aiGeneratedOnly, setAiGeneratedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    setApiError(null);
    api.suggestedEvents()
      .then((res) => {
        if (cancelled) return;
        const list = (res.events ?? []).map((e, i) => ({
          id: i + 1,
          icon: EVENT_ICONS[e.name?.split(" ")[0] ?? ""] ?? EVENT_ICONS[e.category ?? ""] ?? e.icon ?? EVENT_ICONS.default,
          title: e.name ?? "",
          daysUntil: daysUntil(e.date ?? ""),
        }));
        setUpcomingEvents(list);
      })
      .catch((err) => {
        if (!cancelled) setApiError(err instanceof Error ? err.message : "Failed to load events");
        setUpcomingEvents([]);
      })
      .finally(() => { if (!cancelled) setEventsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleEventClick = (title: string) => {
    setSearchQuery(title);
  };

  const handleDeepScan = async () => {
    if (!searchQuery.trim()) {
      setApiError("Enter a search query or select an event.");
      return;
    }
    setIsScanning(true);
    setShowBrief(false);
    setShowPrompts(false);
    setAnalysisResult(null);
    setEvidence([]);
    setApiError(null);
    setScanProgress(10);
    const orderMap = { relevance: "relevance", "most-downloads": "most-downloads", newest: "newest", featured: "featured" };
    const contentMap = { all: undefined, photo: "photo", video: "video", vector: "vector", illustration: "illustration" };
    try {
      setScanProgress(30);
      const trackRes = await api.trackAdobe({
        q: searchQuery,
        page: pagesFrom,
        endPage: pagesTo,
        ai_only: aiGeneratedOnly,
        order: orderMap[sortOrder],
        content_type: contentMap[assetType],
      });
      const images = trackRes.images ?? [];
      setScanProgress(60);
      const analysis = await api.analyzeMarket({ eventName: searchQuery, rawData: images });
      setAnalysisResult(analysis);
      setEvidence(images.map(trackAdobeToMediaItem));
      setScanProgress(100);
      setShowBrief(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const handleExpandPrompts = async () => {
    if (!analysisResult?.brief) {
      setApiError("Run a Deep Scan first to get a brief.");
      return;
    }
    setIsExpandingPrompts(true);
    setPromptProgress(10);
    setApiError(null);
    try {
      setPromptProgress(40);
      const res = await api.generatePrompts({ eventName: searchQuery, brief: analysisResult.brief });
      setPromptProgress(80);
      setPromptRows(mapApiPromptsToRows(res.prompts ?? []));
      setShowPrompts(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to generate prompts");
    } finally {
      setIsExpandingPrompts(false);
      setPromptProgress(0);
    }
  };

  const trendData = (analysisResult?.trends ?? []).map((t, i) => ({
    month: t.month,
    volume: t.demand,
    id: `trend-${i}`,
  }));
  const topSellers: string[] = analysisResult?.brief?.bestSellers ?? (analysisResult?.brief?.shotList?.map((s) => s.idea) ?? []) ?? [];

  return (
    <div className="min-h-screen bg-[#050810] p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-white font-bold tracking-tight mb-2" style={{ fontSize: '2.5rem', fontFamily: 'Space Grotesk', fontStyle: 'italic' }}>
            Market Pipeline
          </h1>
          <p className="text-gray-400" style={{ fontSize: '1.125rem' }}>
            Discover data trends and generate optimized creative prompts
          </p>
        </div>

        {/* 90-Day Horizon Calendar */}
        <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
          <h2 className="text-white font-semibold mb-4" style={{ fontSize: '1.25rem', fontFamily: 'Space Grotesk' }}>
            90-Day Horizon Calendar
          </h2>
          {apiError && (
            <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {apiError}
            </div>
          )}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#161d2f] scrollbar-track-transparent">
            {eventsLoading ? (
              <div className="text-gray-500 py-4">Loading events...</div>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-gray-500 py-4">No upcoming events. Run the backend and try again.</div>
            ) : (
            upcomingEvents.map((event) => (
              <motion.button
                key={event.id}
                onClick={() => handleEventClick(event.title)}
                className="flex-shrink-0 w-[200px] bg-[#161d2f]/50 border border-[#161d2f] rounded-lg p-4 hover:border-[#0ea5e9] transition-all group"
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(14,165,233,0.3)" }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">{event.icon}</div>
                  <h3 className="text-white font-medium mb-2">{event.title}</h3>
                  <div className="px-3 py-1 bg-[#0ea5e9]/20 border border-[#0ea5e9] rounded-full inline-block">
                    <span className="text-[#0ea5e9] font-mono" style={{ fontSize: '0.75rem' }}>
                      Incoming in {event.daysUntil} Days
                    </span>
                  </div>
                </div>
              </motion.button>
            ))
            )}
          </div>
        </div>

        {/* Deep Scanner */}
        <div className="space-y-4">
          <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Target a niche or event..."
                  className="w-full pl-12 pr-4 py-4 bg-[#161d2f]/50 border border-[#161d2f] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ea5e9] focus:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all"
                  style={{ fontSize: '1.125rem' }}
                />
              </div>
              <motion.button
                onClick={() => setShowConfig(!showConfig)}
                className="px-6 py-4 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 rounded-lg text-white font-bold transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Zap className="w-5 h-5" />
                <span>DEEP SCAN</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showConfig ? "rotate-180" : ""}`} />
              </motion.button>
            </div>

            {/* Config Panel */}
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-[#161d2f] space-y-4">
                    {/* Sort Order */}
                    <div>
                      <label className="block text-gray-600 text-[0.625rem] font-medium uppercase tracking-wider mb-2">
                        Sort Order
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: "relevance", label: "Relevance", icon: Sparkles },
                          { id: "most-downloads", label: "Most Downloads", icon: Download },
                          { id: "newest", label: "Newest", icon: Zap },
                          { id: "featured", label: "Featured", icon: Sparkles }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setSortOrder(option.id as typeof sortOrder)}
                            className={`px-2.5 py-2 rounded-lg text-[0.6875rem] font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                              sortOrder === option.id
                                ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                                : "bg-[#161d2f]/50 border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                            }`}
                          >
                            <option.icon className="w-3 h-3" />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Asset Type */}
                    <div>
                      <label className="block text-gray-600 text-[0.625rem] font-medium uppercase tracking-wider mb-2">
                        Asset Type
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { id: "all", label: "All", icon: Layers },
                          { id: "photo", label: "Photo", icon: ImageIcon },
                          { id: "video", label: "Video", icon: Video },
                          { id: "vector", label: "Vector", icon: Shapes },
                          { id: "illustration", label: "Illustration", icon: Pen }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setAssetType(option.id as typeof assetType)}
                            className={`px-2.5 py-2 rounded-lg text-[0.6875rem] font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                              assetType === option.id
                                ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                                : "bg-[#161d2f]/50 border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                            }`}
                          >
                            <option.icon className="w-3 h-3" />
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Pages to Scan */}
                    <div>
                      <label className="block text-gray-600 text-[0.625rem] font-medium uppercase tracking-wider mb-2">
                        Pages to Scan
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-gray-600 text-[0.625rem] uppercase tracking-wider mb-1.5">FROM</div>
                          <input
                            type="number"
                            value={pagesFrom}
                            onChange={(e) => setPagesFrom(parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-full px-3 py-2 bg-[#161d2f]/50 border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all"
                          />
                        </div>
                        <div>
                          <div className="text-gray-600 text-[0.625rem] uppercase tracking-wider mb-1.5">TO PAGE</div>
                          <input
                            type="number"
                            value={pagesTo}
                            onChange={(e) => setPagesTo(parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-full px-3 py-2 bg-[#161d2f]/50 border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all"
                          />
                        </div>
                      </div>
                      <p className="text-gray-700 text-[0.625rem] mt-1.5">
                        Adobe Stock pagination (approx. 100 images per page)
                      </p>
                    </div>

                    {/* Minimum Downloads */}
                    <div>
                      <label className="block text-gray-600 text-[0.625rem] font-medium uppercase tracking-wider mb-2">
                        Minimum Downloads
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={minimumDownloads}
                          onChange={(e) => setMinimumDownloads(parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-full px-3 py-2 bg-[#161d2f]/50 border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-700 text-[0.625rem]">
                          downloads minimum
                        </span>
                      </div>
                    </div>

                    {/* Minimum Demand Slider */}
                    <div>
                      <label className="block text-gray-600 text-[0.625rem] font-medium uppercase tracking-wider mb-2">
                        Minimum Demand: <span className="text-[#0ea5e9] font-bold">{minDemand[0]}</span>
                      </label>
                      <Slider.Root
                        value={minDemand}
                        onValueChange={setMinDemand}
                        min={0}
                        max={10000}
                        step={50}
                        className="relative flex items-center w-full h-4"
                      >
                        <Slider.Track className="bg-[#161d2f] relative grow rounded-full h-1.5">
                          <Slider.Range className="absolute bg-gradient-to-r from-[#0ea5e9] to-[#8b5cf6] rounded-full h-full" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-4 h-4 bg-white rounded-full shadow-lg hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]" />
                      </Slider.Root>
                    </div>

                    {/* Year of Publish */}
                    <div>
                      <label className="block text-gray-600 text-[0.625rem] font-medium uppercase tracking-wider mb-2">
                        Year of Publish
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={yearFrom}
                          onChange={(e) => setYearFrom(e.target.value)}
                          placeholder="Any"
                          className="w-full px-3 py-2 bg-[#161d2f]/50 border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all placeholder:text-gray-700"
                        />
                        <input
                          type="text"
                          value={yearTo}
                          onChange={(e) => setYearTo(e.target.value)}
                          placeholder="Any"
                          className="w-full px-3 py-2 bg-[#161d2f]/50 border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-all transition-all placeholder:text-gray-700"
                        />
                      </div>
                    </div>

                    {/* AI Generated Only Toggle */}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[#161d2f]/30 rounded-lg">
                      <div>
                        <p className="text-white font-medium text-[0.8125rem]">AI Generated Only</p>
                        <p className="text-gray-600 text-[0.625rem]">
                          Filter to AI-generated assets only
                        </p>
                      </div>
                      <Switch.Root
                        checked={aiGeneratedOnly}
                        onCheckedChange={setAiGeneratedOnly}
                        className="w-11 h-6 bg-[#161d2f] rounded-full relative transition-colors data-[state=checked]:bg-[#0ea5e9]"
                      >
                        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                      </Switch.Root>
                    </div>

                    {/* Execute Scan Button */}
                    <motion.button
                      onClick={handleDeepScan}
                      className="w-full px-6 py-3 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 rounded-lg text-white font-bold transition-all shadow-[0_0_30px_rgba(14,165,233,0.5)] flex items-center justify-center gap-2 text-sm"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Zap className="w-4 h-4" />
                      Execute Deep Scan
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Creative Brief */}
        <AnimatePresence>
          {showBrief && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Evidence Section */}
              <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white font-semibold" style={{ fontSize: '1.5rem' }}>
                    Evidence
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border flex items-center gap-2 ${
                        showFilters
                          ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                          : "bg-[#161d2f]/50 border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-6"
                    >
                      <div className="pb-6 border-b border-[#161d2f] space-y-4">
                        <div className="grid grid-cols-6 gap-2">
                          {[
                            { id: "all", label: "All", icon: Layers },
                            { id: "Photo", label: "Photos", icon: ImageIcon },
                            { id: "Video", label: "Videos", icon: Video },
                            { id: "Vector", label: "Vectors", icon: Shapes },
                            { id: "Illustration", label: "Illustrations", icon: Pen },
                          ].map((type) => (
                            <button
                              key={type.id}
                              onClick={() => setFilterMediaType(type.id)}
                              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                                filterMediaType === type.id
                                  ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                                  : "bg-[#161d2f]/50 border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                              }`}
                            >
                              <type.icon className="w-3.5 h-3.5" />
                              {type.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[#161d2f]/30 rounded-lg">
                          <div>
                            <p className="text-white font-medium text-sm">AI Generated Only</p>
                            <p className="text-gray-600 text-xs">Show only AI-generated content</p>
                          </div>
                          <Switch.Root
                            checked={filterAIOnly}
                            onCheckedChange={setFilterAIOnly}
                            className="w-11 h-6 bg-[#161d2f] rounded-full relative transition-colors data-[state=checked]:bg-[#0ea5e9]"
                          >
                            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                          </Switch.Root>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Masonry columnsCount={4} gutter="16px">
                  {evidence
                    .filter(item => filterMediaType === "all" || item.mediaType === filterMediaType)
                    .filter(item => !filterAIOnly || item.isAI)
                    .map((media, index) => (
                    <motion.div
                      key={media.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group overflow-hidden rounded-lg cursor-pointer bg-[#161d2f]"
                      onClick={() => openMedia(media)}
                      whileHover={{ scale: 1.02 }}
                    >
                      {/* Thumbnail Image */}
                      <img
                        src={media.thumbnailUrl}
                        alt={media.title}
                        className="w-full aspect-[3/4] object-cover"
                      />
                      
                      {/* Top Badges Row */}
                      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
                        {/* AI Badge */}
                        {media.isAI && (
                          <div className="px-2 py-1 bg-[#8b5cf6]/90 backdrop-blur-sm rounded-full flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-white" />
                            <span className="text-white text-[0.625rem] font-bold">AI</span>
                          </div>
                        )}
                        
                        <div className="ml-auto flex flex-col gap-1.5">
                          {/* Downloads Badge */}
                          <div className="px-2 py-1 bg-[#10b981]/90 backdrop-blur-sm rounded-full flex items-center gap-1">
                            <Download className="w-3 h-3 text-white" />
                            <span className="text-white font-mono text-[0.6875rem] font-bold">
                              {media.downloads >= 1000 
                                ? `${(media.downloads / 1000).toFixed(1)}k` 
                                : media.downloads}
                            </span>
                          </div>
                          
                          {/* Premium Badge */}
                          {media.premium === "Premium" && (
                            <div className="px-2 py-1 bg-[#f59e0b]/90 backdrop-blur-sm rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-white" />
                              <span className="text-white text-[0.625rem] font-bold">PRO</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Bottom Info Card */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                        {/* Title */}
                        <p className="text-white text-xs font-medium line-clamp-2 mb-2">
                          {media.title}
                        </p>
                        
                        {/* Meta Info Grid */}
                        <div className="space-y-1.5">
                          {/* Creator */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600 text-[0.625rem] uppercase tracking-wider">Creator:</span>
                            <span className="text-gray-300 text-[0.625rem] font-medium">{media.creator}</span>
                          </div>
                          
                          {/* Media Type & Category */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600 text-[0.625rem] uppercase tracking-wider">Type:</span>
                            <span className="text-[#0ea5e9] text-[0.625rem] font-semibold">{media.mediaType}</span>
                            <span className="text-gray-600 text-[0.625rem]">•</span>
                            <span className="text-gray-400 text-[0.625rem]">{media.category}</span>
                          </div>
                          
                          {/* Dimensions */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600 text-[0.625rem] uppercase tracking-wider">Size:</span>
                            <span className="text-gray-300 text-[0.625rem] font-mono">{media.dimensions.replace(" x ", "×")}</span>
                          </div>
                          
                          {/* Upload Date */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-600 text-[0.625rem] uppercase tracking-wider">Uploaded:</span>
                            <span className="text-gray-400 text-[0.625rem]">
                              {new Date(media.uploadDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                          
                          {/* Keywords Preview */}
                          {media.keywords && media.keywords.length > 0 && (
                            <div className="pt-1.5 border-t border-gray-800/50">
                              <div className="flex flex-wrap gap-1">
                                {media.keywords.slice(0, 4).map((keyword, i) => (
                                  <span 
                                    key={i} 
                                    className="px-1.5 py-0.5 bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded text-[#0ea5e9] text-[0.5625rem] font-mono"
                                  >
                                    {keyword}
                                  </span>
                                ))}
                                {media.keywords.length > 4 && (
                                  <span className="text-gray-600 text-[0.5625rem]">
                                    +{media.keywords.length - 4}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </Masonry>
              </div>

              {/* Analysis Section */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
                  <h2 className="text-white font-semibold mb-4" style={{ fontSize: '1.25rem' }}>
                    Trend Volume
                  </h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendData.length ? trendData : [{ month: "-", volume: 0, id: "empty" }]}>
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0a0f1d",
                          border: "1px solid #161d2f",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={{ fill: "#0ea5e9", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
                  <h2 className="text-white font-semibold mb-4" style={{ fontSize: '1.25rem' }}>
                    Top Sellers
                  </h2>
                  <ol className="space-y-3">
                    {topSellers.map((seller, index) => (
                      <li key={`seller-${index}`} className="flex gap-3">
                        <span className="text-[#0ea5e9] font-mono font-bold">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-gray-300">{seller}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Action Section */}
              {!showPrompts && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center"
                >
                  <motion.button
                    onClick={handleExpandPrompts}
                    className="px-12 py-6 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 rounded-xl text-white font-bold transition-all shadow-[0_0_40px_rgba(245,158,11,0.5)] relative overflow-hidden group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ fontSize: '1.25rem' }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white"
                      initial={{ scale: 0, opacity: 0.3 }}
                      whileHover={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                    EXPAND INTO 100 PROMPTS
                  </motion.button>
                </motion.div>
              )}

              {/* Prompts Table */}
              {showPrompts && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <PromptTable prompts={promptRows} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scanning Modal */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#0a0f1d] border-2 border-[#0ea5e9] rounded-2xl p-12 max-w-lg w-full mx-4 shadow-[0_0_60px_rgba(14,165,233,0.6)]"
            >
              {/* Animated Icon */}
              <div className="flex justify-center mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] flex items-center justify-center shadow-[0_0_40px_rgba(14,165,233,0.8)]"
                >
                  <Zap className="w-12 h-12 text-white" />
                </motion.div>
              </div>

              {/* Title */}
              <h2 className="text-white text-center font-bold mb-3" style={{ fontSize: '1.75rem', fontFamily: 'Space Grotesk' }}>
                Deep Scanning Market
              </h2>
              <p className="text-gray-400 text-center mb-8">
                Analyzing Adobe Stock data and extracting insights...
              </p>

              {/* Progress Bar */}
              <div className="relative h-3 bg-[#161d2f] rounded-full overflow-hidden mb-4">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0ea5e9] to-[#8b5cf6] rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${scanProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Progress Percentage */}
              <p className="text-[#0ea5e9] text-center font-mono font-bold text-xl">
                {scanProgress}%
              </p>

              {/* Status Messages */}
              <div className="mt-6 space-y-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: scanProgress > 10 ? 1 : 0.3, x: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${scanProgress > 10 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={scanProgress > 10 ? 'text-white' : 'text-gray-600'}>
                    Connecting to Adobe Stock API
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: scanProgress > 30 ? 1 : 0.3, x: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${scanProgress > 30 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={scanProgress > 30 ? 'text-white' : 'text-gray-600'}>
                    Fetching asset metadata
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: scanProgress > 50 ? 1 : 0.3, x: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${scanProgress > 50 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={scanProgress > 50 ? 'text-white' : 'text-gray-600'}>
                    Analyzing download trends
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: scanProgress > 70 ? 1 : 0.3, x: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${scanProgress > 70 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={scanProgress > 70 ? 'text-white' : 'text-gray-600'}>
                    Generating market insights
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: scanProgress > 90 ? 1 : 0.3, x: 0 }}
                  className="flex items-center gap-2 text-sm"
                >
                  <div className={`w-2 h-2 rounded-full ${scanProgress > 90 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={scanProgress > 90 ? 'text-white' : 'text-gray-600'}>
                    Compiling evidence
                  </span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanding Prompts Modal */}
      <AnimatePresence>
        {isExpandingPrompts && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#0a0f1d] border-2 border-[#f59e0b] rounded-2xl p-12 max-w-lg w-full mx-4 shadow-[0_0_60px_rgba(245,158,11,0.6)]"
            >
              <div className="flex justify-center mb-8">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-[#f59e0b] to-[#8b5cf6] flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.8)]"
                >
                  <Sparkles className="w-12 h-12 text-white" />
                </motion.div>
              </div>
              <h2 className="text-white text-center font-bold mb-3" style={{ fontSize: '1.75rem', fontFamily: 'Space Grotesk' }}>
                Generating Prompts
              </h2>
              <p className="text-gray-400 text-center mb-8">
                Expanding evidence into 100 creative prompts...
              </p>
              <div className="relative h-3 bg-[#161d2f] rounded-full overflow-hidden mb-4">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${promptProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[#f59e0b] text-center font-mono font-bold text-xl">
                {promptProgress}%
              </p>
              <div className="mt-6 space-y-2">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: promptProgress > 10 ? 1 : 0.3, x: 0 }} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${promptProgress > 10 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={promptProgress > 10 ? 'text-white' : 'text-gray-600'}>Analyzing evidence patterns</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: promptProgress > 30 ? 1 : 0.3, x: 0 }} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${promptProgress > 30 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={promptProgress > 30 ? 'text-white' : 'text-gray-600'}>Extracting visual themes</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: promptProgress > 50 ? 1 : 0.3, x: 0 }} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${promptProgress > 50 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={promptProgress > 50 ? 'text-white' : 'text-gray-600'}>Generating prompt variations</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: promptProgress > 70 ? 1 : 0.3, x: 0 }} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${promptProgress > 70 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={promptProgress > 70 ? 'text-white' : 'text-gray-600'}>Optimizing for AI engines</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: promptProgress > 90 ? 1 : 0.3, x: 0 }} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${promptProgress > 90 ? 'bg-[#10b981]' : 'bg-gray-600'}`} />
                  <span className={promptProgress > 90 ? 'text-white' : 'text-gray-600'}>Finalizing prompt library</span>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}