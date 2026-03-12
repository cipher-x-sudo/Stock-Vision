import { useState } from "react";
import { Search, Zap, ChevronDown, Download, Sparkles, Image as ImageIcon, Video, Shapes, Pen, Layers, Filter, X, Brain, Dna } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import Masonry from "react-responsive-masonry";
import { PromptTable } from "../PromptTable";
import { useMediaViewer } from "../../contexts/MediaViewerContext";
import { MediaItem } from "../MediaViewer";

const upcomingEvents = [
  { id: 1, icon: "🎄", title: "Christmas", daysUntil: 289 },
  { id: 2, icon: "🎃", title: "Halloween", daysUntil: 234 },
  { id: 3, icon: "💝", title: "Valentine's Day", daysUntil: 340 },
  { id: 4, icon: "🎆", title: "New Year", daysUntil: 296 },
  { id: 5, icon: "🦃", title: "Thanksgiving", daysUntil: 258 },
  { id: 6, icon: "🎓", title: "Graduation Season", daysUntil: 92 },
];

const mockTrendData = [
  { month: "Apr", volume: 2400, id: "trend-apr" },
  { month: "May", volume: 1398, id: "trend-may" },
  { month: "Jun", volume: 9800, id: "trend-jun" },
  { month: "Jul", volume: 3908, id: "trend-jul" },
  { month: "Aug", volume: 4800, id: "trend-aug" },
  { month: "Sep", volume: 3800, id: "trend-sep" },
  { month: "Oct", volume: 4300, id: "trend-oct" },
];

const mockTopSellers = [
  "Cinematic ocean sunset with dramatic clouds",
  "Minimalist product photography on marble",
  "Neon cyberpunk cityscape at night",
  "Macro photography of water droplets",
  "Abstract geometric patterns in pastel colors",
];

const mockImages = [
  { id: 1, downloads: 12500 },
  { id: 2, downloads: 8900 },
  { id: 3, downloads: 15200 },
  { id: 4, downloads: 6700 },
  { id: 5, downloads: 21300 },
  { id: 6, downloads: 9400 },
  { id: 7, downloads: 11800 },
  { id: 8, downloads: 7200 },
];

// Mock evidence data with real API structure
const mockEvidence: MediaItem[] = [
  {
    id: "1933626801",
    title: "World sleep day illustration with crescent moon and zzz, night sky and trees",
    downloads: 8600,
    premium: "Standard",
    creator: "SHALENA",
    creatorId: "212733487",
    mediaType: "Illustration",
    category: "Culture and Religion",
    contentType: "image/jpeg",
    dimensions: "5632 x 3072",
    uploadDate: "2026-03-03 04:24:49.373885",
    keywords: ["world", "sleep", "day", "illustration", "with", "crescent", "moon", "and", "zzz", "night", "sky", "trees"],
    thumbnailUrl: "https://t3.ftcdn.net/jpg/19/33/62/68/360_F_1933626801_fIDCZ975yvJ42hPUNtEQghv4azboQeLe.jpg",
    isAI: true
  },
  {
    id: "1933626802",
    title: "World sleep day banner with clock and text",
    downloads: 4200,
    premium: "Standard",
    creator: "CreativeAI",
    creatorId: "212733488",
    mediaType: "Illustration",
    category: "Culture and Religion",
    contentType: "image/jpeg",
    dimensions: "5120 x 2880",
    uploadDate: "2026-03-03 05:10:22.373885",
    keywords: ["world", "sleep", "day", "clock", "alarm"],
    thumbnailUrl: "https://t3.ftcdn.net/jpg/19/33/62/68/360_F_1933626801_fIDCZ975yvJ42hPUNtEQghv4azboQeLe.jpg",
    isAI: false
  },
  {
    id: "1933626803",
    title: "Sleeping crescent moon in night sky with stars",
    downloads: 12100,
    premium: "Premium",
    creator: "DreamDesigns",
    creatorId: "212733489",
    mediaType: "Photo",
    category: "Nature",
    contentType: "image/jpeg",
    dimensions: "6000 x 4000",
    uploadDate: "2026-03-02 18:30:15.373885",
    keywords: ["sleep", "moon", "night", "stars"],
    thumbnailUrl: "https://t3.ftcdn.net/jpg/19/33/62/68/360_F_1933626801_fIDCZ975yvJ42hPUNtEQghv4azboQeLe.jpg",
    isAI: false
  },
  {
    id: "1933626804",
    title: "Cartoon illustration world sleep day celebration",
    downloads: 9300,
    premium: "Standard",
    creator: "VectorArt",
    creatorId: "212733490",
    mediaType: "Vector",
    category: "Culture and Religion",
    contentType: "image/svg",
    dimensions: "4096 x 4096",
    uploadDate: "2026-03-01 12:45:00.373885",
    keywords: ["world", "sleep", "day", "cartoon", "celebration"],
    thumbnailUrl: "https://t3.ftcdn.net/jpg/19/33/62/68/360_F_1933626801_fIDCZ975yvJ42hPUNtEQghv4azboQeLe.jpg",
    isAI: true
  },
  {
    id: "1933626805",
    title: "Alarm clock on bedside table vintage style",
    downloads: 15800,
    premium: "Premium",
    creator: "RetroPhotos",
    creatorId: "212733491",
    mediaType: "Photo",
    category: "Lifestyle",
    contentType: "image/jpeg",
    dimensions: "5472 x 3648",
    uploadDate: "2026-02-28 09:22:33.373885",
    keywords: ["alarm", "clock", "sleep", "bedroom", "vintage"],
    thumbnailUrl: "https://t3.ftcdn.net/jpg/19/33/62/68/360_F_1933626801_fIDCZ975yvJ42hPUNtEQghv4azboQeLe.jpg",
    isAI: false
  },
];

export function MarketPipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [minDemand, setMinDemand] = useState([500]);
  const [scanProgress, setScanProgress] = useState(0);
  const { openMedia } = useMediaViewer();
  
  // Loading states for different actions
  const [isExpandingPrompts, setIsExpandingPrompts] = useState(false);
  const [promptProgress, setPromptProgress] = useState(0);
  const [isConceptualizing, setIsConceptualizing] = useState(false);
  const [conceptProgress, setConceptProgress] = useState(0);
  const [isExtractingDNA, setIsExtractingDNA] = useState(false);
  const [dnaProgress, setDNAProgress] = useState(0);
  
  // Evidence filters
  const [filterMediaType, setFilterMediaType] = useState<string>("all");
  const [filterAIOnly, setFilterAIOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Scan configuration state
  const [sortOrder, setSortOrder] = useState<"relevance" | "most-downloads" | "newest" | "featured">("relevance");
  const [assetType, setAssetType] = useState<"all" | "photo" | "video" | "vector" | "illustration">("all");
  const [pagesFrom, setPagesFrom] = useState(1);
  const [pagesTo, setPagesTo] = useState(3);
  const [minimumDownloads, setMinimumDownloads] = useState(5);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [aiGeneratedOnly, setAiGeneratedOnly] = useState(false);

  const handleEventClick = (title: string) => {
    setSearchQuery(title);
  };

  const handleDeepScan = () => {
    setIsScanning(true);
    setShowBrief(false);
    setShowPrompts(false);
    setScanProgress(0);
    
    // Simulate progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    
    setTimeout(() => {
      clearInterval(interval);
      setIsScanning(false);
      setShowBrief(true);
      setScanProgress(0);
    }, 2500);
  };

  const handleExpandPrompts = () => {
    setIsExpandingPrompts(true);
    setPromptProgress(0);
    
    // Simulate progress
    const interval = setInterval(() => {
      setPromptProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    
    setTimeout(() => {
      clearInterval(interval);
      setIsExpandingPrompts(false);
      setShowPrompts(true);
      setPromptProgress(0);
    }, 2500);
  };

  const prompts = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    scene: `Cinematic scene ${i + 1} with dramatic composition`,
    style: i % 3 === 0 ? "Photorealistic" : i % 3 === 1 ? "Artistic" : "Hyperreal",
    lighting: i % 4 === 0 ? "Golden hour" : i % 4 === 1 ? "Studio" : i % 4 === 2 ? "Natural" : "Dramatic",
  }));

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
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[#161d2f] scrollbar-track-transparent">
            {upcomingEvents.map((event) => (
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
                  {mockEvidence
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
                    <LineChart data={mockTrendData}>
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
                    {mockTopSellers.map((seller, index) => (
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
                  <PromptTable prompts={prompts} />
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