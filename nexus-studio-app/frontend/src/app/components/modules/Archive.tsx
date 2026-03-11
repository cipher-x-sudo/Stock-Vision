import { useState } from "react";
import { Search, Film, X, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import Masonry from "react-responsive-masonry";

const mockScans = [
  { id: 1, date: "2026-03-09", event: "Spring Fashion Trends", analyzed: 1247, prompts: 100 },
  { id: 2, date: "2026-03-08", event: "Product Photography Styles", analyzed: 892, prompts: 75 },
  { id: 3, date: "2026-03-07", event: "Christmas Campaign Ideas", analyzed: 2103, prompts: 100 },
  { id: 4, date: "2026-03-06", event: "Tech Product Launches", analyzed: 634, prompts: 50 },
  { id: 5, date: "2026-03-05", event: "Summer Travel Destinations", analyzed: 1876, prompts: 100 },
];

const mockMediaItems = [
  { id: 1, type: "image", prompt: "Cinematic sunset over ocean with dramatic clouds", seed: 842371, date: "2026-03-09" },
  { id: 2, type: "video", prompt: "Smooth camera pan through neon cityscape", seed: 391847, date: "2026-03-09" },
  { id: 3, type: "image", prompt: "Minimalist product photography on marble surface", seed: 627194, date: "2026-03-08" },
  { id: 4, type: "image", prompt: "Abstract geometric patterns in pastel colors", seed: 194827, date: "2026-03-08" },
  { id: 5, type: "video", prompt: "Aerial drone shot descending into forest", seed: 573921, date: "2026-03-07" },
  { id: 6, type: "image", prompt: "Macro photography of water droplets on leaf", seed: 847391, date: "2026-03-07" },
  { id: 7, type: "image", prompt: "Hyperrealistic portrait with studio lighting", seed: 298473, date: "2026-03-06" },
  { id: 8, type: "video", prompt: "Time-lapse of clouds moving over mountains", seed: 647281, date: "2026-03-06" },
  { id: 9, type: "image", prompt: "Cyberpunk street scene with neon signs", seed: 918374, date: "2026-03-05" },
  { id: 10, type: "image", prompt: "Vintage film aesthetic sunset beach scene", seed: 482937, date: "2026-03-05" },
];

export function Archive() {
  const [activeView, setActiveView] = useState<"scans" | "media">("scans");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScan, setSelectedScan] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null);

  const filteredScans = mockScans.filter((scan) =>
    scan.event.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMedia = mockMediaItems.filter((item) =>
    item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050810] p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-white font-bold tracking-tight mb-2" style={{ fontSize: '2.5rem', fontFamily: 'Space Grotesk', fontStyle: 'italic' }}>
            The Archive
          </h1>
          <p className="text-gray-400" style={{ fontSize: '1.125rem' }}>
            Universal repository of all your creative intelligence
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <ToggleGroup.Root
            type="single"
            value={activeView}
            onValueChange={(value) => value && setActiveView(value as "scans" | "media")}
            className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-lg p-1 backdrop-blur-xl"
          >
            <ToggleGroup.Item
              value="scans"
              className={`px-6 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeView === "scans"
                  ? "bg-[#0ea5e9] text-white shadow-[0_0_20px_rgba(14,165,233,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics Scans</span>
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="media"
              className={`px-6 py-2 rounded-lg transition-all flex items-center gap-2 ${
                activeView === "media"
                  ? "bg-[#8b5cf6] text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Media Renders</span>
            </ToggleGroup.Item>
          </ToggleGroup.Root>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === "scans" ? "Search by event..." : "Search by prompt or date..."}
              className="w-full pl-12 pr-4 py-3 bg-[#0a0f1d]/50 border border-[#161d2f] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ea5e9] focus:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all"
            />
          </div>
        </div>

        {/* Analytics Scans View */}
        {activeView === "scans" && (
          <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl overflow-hidden backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#161d2f] bg-[#161d2f]/30">
                    <th className="px-6 py-4 text-left text-[#0ea5e9] font-semibold">Date</th>
                    <th className="px-6 py-4 text-left text-[#0ea5e9] font-semibold">Event Title</th>
                    <th className="px-6 py-4 text-left text-[#0ea5e9] font-semibold">Items Analyzed</th>
                    <th className="px-6 py-4 text-left text-[#0ea5e9] font-semibold">Prompts Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScans.map((scan, index) => (
                    <motion.tr
                      key={scan.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedScan(scan.id)}
                      className="border-b border-[#161d2f]/50 hover:bg-[#161d2f]/20 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 text-gray-400 font-mono">{scan.date}</td>
                      <td className="px-6 py-4 text-white">{scan.event}</td>
                      <td className="px-6 py-4 text-gray-300">{scan.analyzed.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-[#10b981]/20 border border-[#10b981] rounded-full text-[#10b981] font-mono">
                          {scan.prompts}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Media Renders View */}
        {activeView === "media" && (
          <Masonry columnsCount={4} gutter="16px">
            {filteredMedia.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedMedia(item.id)}
                className="bg-[#0a0f1d] border border-[#161d2f] rounded-lg overflow-hidden hover:border-[#0ea5e9] transition-all cursor-pointer group"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] relative">
                  {item.type === "video" && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-[#f59e0b] rounded-full flex items-center gap-1">
                      <Film className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                </div>
                <div className="p-3">
                  <p className="text-gray-300 line-clamp-2 mb-2" style={{ fontSize: '0.875rem' }}>
                    {item.prompt}
                  </p>
                  <div className="flex items-center gap-2 text-gray-500" style={{ fontSize: '0.75rem' }}>
                    <span className="font-mono">{item.date}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </Masonry>
        )}

        {/* Scan Detail Drawer */}
        <AnimatePresence>
          {selectedScan !== null && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedScan(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 bottom-0 w-[600px] bg-[#0a0f1d] border-l border-[#161d2f] shadow-2xl z-50 overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-white font-bold mb-2" style={{ fontSize: '1.5rem' }}>
                        {mockScans.find((s) => s.id === selectedScan)?.event}
                      </h2>
                      <p className="text-gray-400">
                        {mockScans.find((s) => s.id === selectedScan)?.date}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedScan(null)}
                      className="p-2 hover:bg-[#161d2f]/50 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-[#161d2f]/30 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-3">Analysis Summary</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>
                            Items Analyzed
                          </p>
                          <p className="text-white font-bold" style={{ fontSize: '1.5rem' }}>
                            {mockScans.find((s) => s.id === selectedScan)?.analyzed.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>
                            Prompts Generated
                          </p>
                          <p className="text-[#10b981] font-bold" style={{ fontSize: '1.5rem' }}>
                            {mockScans.find((s) => s.id === selectedScan)?.prompts}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-white font-semibold mb-3">Generated Prompts</h3>
                      <div className="space-y-2">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="bg-[#161d2f]/30 rounded-lg p-3">
                            <p className="text-gray-300" style={{ fontSize: '0.875rem' }}>
                              Sample prompt {i + 1} from this scan session
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Media Detail Modal */}
        <AnimatePresence>
          {selectedMedia !== null && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedMedia(null)}
                className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-8"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-6xl bg-[#0a0f1d] border border-[#161d2f] rounded-2xl overflow-hidden flex"
                >
                  {/* Left - Media */}
                  <div className="flex-[7] bg-[#050810] flex items-center justify-center p-8">
                    <div className="w-full aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-lg" />
                  </div>

                  {/* Right - Details */}
                  <div className="flex-[3] p-6 space-y-6">
                    <div className="flex items-start justify-between">
                      <h3 className="text-white font-bold" style={{ fontSize: '1.25rem' }}>
                        {mockMediaItems.find((m) => m.id === selectedMedia)?.type === "video" ? "Video" : "Image"}
                      </h3>
                      <button
                        onClick={() => setSelectedMedia(null)}
                        className="p-2 hover:bg-[#161d2f]/50 rounded-lg transition-colors text-gray-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>
                          Prompt
                        </p>
                        <p className="text-white bg-[#161d2f]/30 rounded-lg p-3">
                          {mockMediaItems.find((m) => m.id === selectedMedia)?.prompt}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>
                          Seed
                        </p>
                        <p className="text-white font-mono bg-[#161d2f]/30 rounded-lg p-3">
                          {mockMediaItems.find((m) => m.id === selectedMedia)?.seed}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>
                          Created
                        </p>
                        <p className="text-white font-mono bg-[#161d2f]/30 rounded-lg p-3">
                          {mockMediaItems.find((m) => m.id === selectedMedia)?.date}
                        </p>
                      </div>

                      <motion.button
                        className="w-full px-6 py-3 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 rounded-lg text-white font-bold transition-all"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Reverse Engineer to Studio
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
}