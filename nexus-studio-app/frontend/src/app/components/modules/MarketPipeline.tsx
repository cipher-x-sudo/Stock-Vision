import { useState, useEffect } from "react";
import { Search, Zap, ChevronDown, Download, Sparkles, Image as ImageIcon, Video, Shapes, Pen, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import Masonry from "react-responsive-masonry";
import { PromptTable } from "../PromptTable";
import { api, mapApiPromptsToRows, type SuggestedEvent, type TrackAdobeImage, type AnalysisResult, type AnalysisBrief } from "../../../services/api";

type EventCard = { id: string; icon: string; title: string; daysUntil: number };

/** Map Font Awesome class names (from API) to emoji so we don't render "fa-solid fa-clover" as text. */
const FA_TO_EMOJI: Record<string, string> = {
  clover: "🍀",
  seedling: "🌱",
  palette: "🎨",
  egg: "🥚",
  moon: "🌙",
  gift: "🎁",
  tree: "🎄",
  pumpkin: "🎃",
  heart: "💝",
  fire: "🎆",
  turkey: "🦃",
  graduation: "🎓",
  sun: "☀️",
  star: "⭐",
  snowflake: "❄️",
  leaf: "🍂",
  cake: "🎂",
  champagne: "🍾",
  bell: "🔔",
  calendar: "📅",
  mosque: "🕌",
  starandcrescent: "🌙",
  dove: "🕊️",
  compact: "📅",
};

function iconToEmoji(iconClass: string): string {
  if (!iconClass || iconClass.startsWith("http") || !iconClass.includes("fa-")) return iconClass || "📅";
  const match = iconClass.match(/fa-[a-z-]+\s+fa-([a-z0-9-]+)/i) || iconClass.match(/fa-([a-z0-9-]+)/i);
  const key = match ? match[1].toLowerCase() : "";
  return FA_TO_EMOJI[key] ?? "📅";
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
}

function suggestedEventToCard(e: SuggestedEvent, index: number): EventCard {
  return {
    id: `${e.name}-${e.date}-${index}`,
    icon: e.icon || "📅",
    title: e.name,
    daysUntil: daysUntil(e.date),
  };
}

const orderToApi: Record<string, string> = {
  relevance: "relevance",
  "most-downloads": "nb_downloads",
  newest: "creation",
  featured: "featured",
};

interface ScanConfig {
  searchTerm: string;
  minimumDemand: number;
}

export function MarketPipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [minDemand, setMinDemand] = useState([500]);

  const [events, setEvents] = useState<EventCard[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [trackImages, setTrackImages] = useState<TrackAdobeImage[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [promptsFromApi, setPromptsFromApi] = useState<ReturnType<typeof mapApiPromptsToRows>>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsError, setPromptsError] = useState<string | null>(null);

  // Scan configuration state
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
    setEventsError(null);
    api
      .suggestedEvents()
      .then(({ events: list }) => {
        if (!cancelled) setEvents(list.map((e, i) => suggestedEventToCard(e, i)));
      })
      .catch((err) => {
        if (!cancelled) setEventsError(err instanceof Error ? err.message : "Failed to load events");
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleEventClick = (title: string) => {
    setSearchQuery(title);
  };

  const handleStartScan = (config: ScanConfig) => {
    setSearchQuery(config.searchTerm);
    setMinDemand([config.minimumDemand]);
    setShowConfig(false);
    handleDeepScan();
  };

  const handleDeepScan = async () => {
    if (!searchQuery.trim()) return;
    setIsScanning(true);
    setShowBrief(false);
    setShowPrompts(false);
    setScanError(null);
    setTrackImages([]);
    setAnalysisResult(null);
    setPromptsFromApi([]);

    try {
      const from = Math.max(1, pagesFrom);
      const to = Math.max(from, pagesTo);
      const content_type = assetType === "all" ? undefined : assetType;
      const order = orderToApi[sortOrder] ?? "relevance";

      const allImages: TrackAdobeImage[] = [];
      for (let p = from; p <= to; p++) {
        const { images } = await api.trackAdobe({
          q: searchQuery.trim(),
          page: p,
          endPage: to > from ? to : undefined,
          ai_only: aiGeneratedOnly,
          content_type,
          order,
        });
        allImages.push(...images);
      }
      setTrackImages(allImages);

      const eventName = searchQuery.trim();
      const rawData = allImages;
      const result = await api.analyzeMarket({ eventName, rawData });
      setAnalysisResult(result);
      setShowBrief(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  const handleExpandPrompts = async () => {
    const brief: AnalysisBrief | undefined = analysisResult?.brief;
    const eventName = searchQuery.trim();
    if (!brief || !eventName) {
      setPromptsError("Run a scan and analysis first.");
      setShowPrompts(true);
      return;
    }
    setPromptsLoading(true);
    setPromptsError(null);
    try {
      const { prompts: list } = await api.generatePrompts({ eventName, brief });
      setPromptsFromApi(mapApiPromptsToRows(list));
      setShowPrompts(true);
    } catch (err) {
      setPromptsError(err instanceof Error ? err.message : "Failed to generate prompts");
      setShowPrompts(true);
    } finally {
      setPromptsLoading(false);
    }
  };

  const trendData = (analysisResult?.trends ?? []).map((t) => ({
    month: t.month,
    volume: t.demand ?? 0,
  }));
  const topSellers = analysisResult?.brief?.bestSellers ?? [];
  const promptRows = promptsFromApi.length > 0 ? promptsFromApi : [];

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
          {eventsError && (
            <div className="text-amber-400/90 text-sm mb-4">{eventsError}</div>
          )}
          {eventsLoading && (
            <div className="text-gray-400 text-sm">Loading events...</div>
          )}
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#161d2f] scrollbar-track-transparent">
            {events.map((event) => (
              <motion.button
                key={event.id}
                onClick={() => handleEventClick(event.title)}
                className="flex-shrink-0 w-[200px] bg-[#161d2f]/50 border border-[#161d2f] rounded-lg p-4 hover:border-[#0ea5e9] transition-all group"
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(14,165,233,0.3)" }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">{iconToEmoji(event.icon)}</div>
                  <h3 className="text-white font-medium mb-2">{event.title}</h3>
                  <div className="px-3 py-1 bg-[#0ea5e9]/20 border border-[#0ea5e9] rounded-full inline-block">
                    <span className="text-[#0ea5e9] font-mono" style={{ fontSize: '0.75rem' }}>
                      Incoming in {event.daysUntil} Days
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
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
              {scanError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {scanError}
                </div>
              )}
              {/* Evidence Section */}
              <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
                <h2 className="text-white font-semibold mb-4" style={{ fontSize: '1.5rem' }}>
                  Evidence
                </h2>
                <Masonry columnsCount={4} gutter="16px">
                  {trackImages.map((img, index) => (
                    <motion.div
                      key={img.id ?? index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group overflow-hidden rounded-lg bg-[#161d2f]"
                    >
                      {img.thumbnailUrl ? (
                        <img
                          src={img.thumbnailUrl}
                          alt={img.title ?? ""}
                          className="aspect-[3/4] w-full object-cover"
                        />
                      ) : (
                        <div className="aspect-[3/4] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d]" />
                      )}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-[#10b981]/90 backdrop-blur-sm rounded-full flex items-center gap-1">
                        <Download className="w-3 h-3 text-white" />
                        <span className="text-white font-mono" style={{ fontSize: '0.75rem' }}>
                          {img.downloads ? (parseInt(String(img.downloads), 10) / 1000).toFixed(1) + "k" : "—"}
                        </span>
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
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#161d2f" />
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
                      <li key={index} className="flex gap-3">
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
                    disabled={promptsLoading}
                    className="px-12 py-6 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 rounded-xl text-white font-bold transition-all shadow-[0_0_40px_rgba(245,158,11,0.5)] relative overflow-hidden group disabled:opacity-60"
                    whileHover={{ scale: promptsLoading ? 1 : 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    style={{ fontSize: '1.25rem' }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-white"
                      initial={{ scale: 0, opacity: 0.3 }}
                      whileHover={{ scale: 2, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                    {promptsLoading ? "Generating prompts…" : "EXPAND INTO PROMPTS"}
                  </motion.button>
                </motion.div>
              )}

              {promptsError && (
                <div className="text-amber-400/90 text-sm">{promptsError}</div>
              )}

              {/* Prompts Table */}
              {showPrompts && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {promptRows.length > 0 ? (
                    <PromptTable prompts={promptRows} />
                  ) : (
                    <div className="text-gray-400">No prompts yet. Click “EXPAND INTO PROMPTS” to generate.</div>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}