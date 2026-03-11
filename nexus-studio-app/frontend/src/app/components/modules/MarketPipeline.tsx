import { useState, useEffect } from "react";
import { Search, Zap, ChevronDown, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import Masonry from "react-responsive-masonry";
import { PromptTable } from "../PromptTable";
import { api, mapApiPromptsToRows } from "@/services/api";
import type { SuggestedEvent } from "@/services/api";
import { toast } from "sonner";

interface EventCard {
  id: number;
  icon: string;
  title: string;
  daysUntil: number;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
}

export function MarketPipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [minDemand, setMinDemand] = useState([500]);
  const [strictFiltering, setStrictFiltering] = useState(true);

  const [upcomingEvents, setUpcomingEvents] = useState<EventCard[]>([]);
  const [brief, setBrief] = useState<{ bestSellers?: string[] } | null>(null);
  const [trends, setTrends] = useState<Array<{ month: string; demand: number; saturation: number }>>([]);
  const [evidenceImages, setEvidenceImages] = useState<Array<{ id: string; title?: string; downloads?: string; thumbnailUrl?: string }>>([]);
  const [prompts, setPrompts] = useState<Array<{ id: number; scene: string; style: string; lighting: string }>>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isExpandingPrompts, setIsExpandingPrompts] = useState(false);

  useEffect(() => {
    api.suggestedEvents().then(({ events }) => {
      const cards: EventCard[] = events.map((e: SuggestedEvent, i: number) => ({
        id: i + 1,
        icon: (e.icon && e.icon.startsWith("fa-")) ? "📅" : (e.icon || "📅"),
        title: e.name,
        daysUntil: daysUntil(e.date),
      }));
      setUpcomingEvents(cards);
    }).catch((err) => {
      toast.error(err.message || "Failed to load events");
    }).finally(() => setIsLoadingEvents(false));
  }, []);

  const handleEventClick = (title: string) => {
    setSearchQuery(title);
  };

  const handleDeepScan = async () => {
    const query = searchQuery.trim() || "holiday";
    setIsScanning(true);
    setShowBrief(false);
    setShowPrompts(false);
    try {
      const { images } = await api.trackAdobe({ q: query, page: 1, ai_only: strictFiltering });
      const filtered = minDemand[0] > 0
        ? images.filter((img) => (Number(img.downloads) || 0) >= minDemand[0])
        : images;
      const { brief: b, trends: t, insights } = await api.analyzeMarket({
        eventName: query,
        rawData: filtered,
      });
      setBrief(b ?? null);
      setTrends(t ?? []);
      setEvidenceImages((insights as typeof images) ?? filtered);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deep scan failed");
    } finally {
      setIsScanning(false);
      setShowBrief(true);
    }
  };

  const handleExpandPrompts = async () => {
    if (!brief || !searchQuery.trim()) {
      setShowPrompts(true);
      return;
    }
    setIsExpandingPrompts(true);
    try {
      const { prompts: p } = await api.generatePrompts({
        eventName: searchQuery.trim(),
        brief,
      });
      setPrompts(mapApiPromptsToRows(p ?? []));
      setShowPrompts(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate prompts");
    } finally {
      setIsExpandingPrompts(false);
    }
  };

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
            {isLoadingEvents ? (
              <div className="text-gray-500 py-4">Loading events...</div>
            ) : upcomingEvents.length === 0 ? (
              <div className="text-gray-500 py-4">No upcoming events. Check backend.</div>
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
            )))}
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
                  <div className="mt-6 pt-6 border-t border-[#161d2f] space-y-6">
                    <div>
                      <label className="block text-white mb-3 font-medium">
                        Minimum Demand: <span className="text-[#0ea5e9]">{minDemand[0]}</span>
                      </label>
                      <Slider.Root
                        value={minDemand}
                        onValueChange={setMinDemand}
                        min={0}
                        max={1000}
                        step={50}
                        className="relative flex items-center w-full h-5"
                      >
                        <Slider.Track className="bg-[#161d2f] relative grow rounded-full h-2">
                          <Slider.Range className="absolute bg-gradient-to-r from-[#0ea5e9] to-[#8b5cf6] rounded-full h-full" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-5 h-5 bg-white rounded-full shadow-lg hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]" />
                      </Slider.Root>
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 bg-[#161d2f]/50 rounded-lg">
                      <div>
                        <p className="text-white font-medium">Strict AI Filtering</p>
                        <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>
                          Apply advanced quality filters
                        </p>
                      </div>
                      <Switch.Root
                        checked={strictFiltering}
                        onCheckedChange={setStrictFiltering}
                        className="w-11 h-6 bg-[#161d2f] rounded-full relative transition-colors data-[state=checked]:bg-[#0ea5e9]"
                      >
                        <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                      </Switch.Root>
                    </div>

                    <motion.button
                      onClick={handleDeepScan}
                      className="w-full px-6 py-4 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 rounded-lg text-white font-bold transition-all shadow-[0_0_30px_rgba(14,165,233,0.5)]"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Execute Deep Scan
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Loading State */}
          <AnimatePresence>
            {isScanning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-[#0a0f1d] border border-[#0ea5e9] rounded-xl p-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto mb-4 border-4 border-[#0ea5e9] border-t-transparent rounded-full"
                />
                <h3 className="text-white font-bold mb-2" style={{ fontSize: '1.5rem' }}>
                  Synthesizing Brief...
                </h3>
                <p className="text-gray-400">
                  Analyzing market data and extracting insights
                </p>
              </motion.div>
            )}
          </AnimatePresence>
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
                  {(evidenceImages.length ? evidenceImages : [{ id: "placeholder", downloads: "0" }]).slice(0, 24).map((img, index) => (
                    <motion.div
                      key={img.id || index}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group overflow-hidden rounded-lg bg-[#161d2f]"
                    >
                      {img.thumbnailUrl ? (
                        <img src={img.thumbnailUrl} alt={img.title || ""} className="w-full aspect-[3/4] object-cover" />
                      ) : (
                        <div className="aspect-[3/4] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d]" />
                      )}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-[#10b981]/90 backdrop-blur-sm rounded-full flex items-center gap-1">
                        <Download className="w-3 h-3 text-white" />
                        <span className="text-white font-mono" style={{ fontSize: '0.75rem' }}>
                          {img.downloads ? (Number(img.downloads) / 1000).toFixed(1) + "k" : "—"}
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
                    <LineChart data={trends.map((t) => ({ month: t.month, volume: t.demand }))}>
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
                    {(brief?.bestSellers ?? ["No data"]).slice(0, 8).map((seller, index) => (
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
                    disabled={isExpandingPrompts}
                    className="px-12 py-6 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 rounded-xl text-white font-bold transition-all shadow-[0_0_40px_rgba(245,158,11,0.5)] relative overflow-hidden group disabled:opacity-70"
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
                    {isExpandingPrompts ? "Generating…" : "EXPAND INTO 100 PROMPTS"}
                  </motion.button>
                </motion.div>
              )}

              {/* Prompts Table */}
              {showPrompts && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <PromptTable prompts={prompts.length ? prompts : [{ id: 1, scene: "No prompts yet. Run Expand or run Deep Scan first.", style: "", lighting: "" }]} />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}