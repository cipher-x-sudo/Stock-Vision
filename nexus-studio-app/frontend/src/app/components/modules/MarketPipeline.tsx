import { useState } from "react";
import { Search, Zap, ChevronDown, Download, Sparkles, Image as ImageIcon, Video, Shapes, Pen, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import Masonry from "react-responsive-masonry";
import { PromptTable } from "../PromptTable";

const upcomingEvents = [
  { id: 1, icon: "🎄", title: "Christmas", daysUntil: 289 },
  { id: 2, icon: "🎃", title: "Halloween", daysUntil: 234 },
  { id: 3, icon: "💝", title: "Valentine's Day", daysUntil: 340 },
  { id: 4, icon: "🎆", title: "New Year", daysUntil: 296 },
  { id: 5, icon: "🦃", title: "Thanksgiving", daysUntil: 258 },
  { id: 6, icon: "🎓", title: "Graduation Season", daysUntil: 92 },
];

const mockTrendData = [
  { month: "Apr", volume: 2400 },
  { month: "May", volume: 1398 },
  { month: "Jun", volume: 9800 },
  { month: "Jul", volume: 3908 },
  { month: "Aug", volume: 4800 },
  { month: "Sep", volume: 3800 },
  { month: "Oct", volume: 4300 },
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

export function MarketPipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [minDemand, setMinDemand] = useState([500]);
  
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

  const handleStartScan = (config: ScanConfig) => {
    console.log("Starting scan with config:", config);
    // Update the search query with the configured term
    setSearchQuery(config.searchTerm);
    setMinDemand([config.minimumDemand]);
    // Close config and start scanning
    setShowConfig(false);
    handleDeepScan();
  };

  const handleDeepScan = () => {
    setIsScanning(true);
    setShowBrief(false);
    setShowPrompts(false);
    
    setTimeout(() => {
      setIsScanning(false);
      setShowBrief(true);
    }, 2500);
  };

  const handleExpandPrompts = () => {
    setShowPrompts(true);
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
                <h2 className="text-white font-semibold mb-4" style={{ fontSize: '1.5rem' }}>
                  Evidence
                </h2>
                <Masonry columnsCount={4} gutter="16px">
                  {mockImages.map((img, index) => (
                    <motion.div
                      key={img.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative group overflow-hidden rounded-lg bg-[#161d2f]"
                    >
                      <div className="aspect-[3/4] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d]" />
                      <div className="absolute top-2 right-2 px-2 py-1 bg-[#10b981]/90 backdrop-blur-sm rounded-full flex items-center gap-1">
                        <Download className="w-3 h-3 text-white" />
                        <span className="text-white font-mono" style={{ fontSize: '0.75rem' }}>
                          {(img.downloads / 1000).toFixed(1)}k
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
                    <LineChart data={mockTrendData}>
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
                    {mockTopSellers.map((seller, index) => (
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
    </div>
  );
}