import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, Film, X, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import Masonry from "react-responsive-masonry";
import { api } from "@/services/api";

interface ScanRow {
  id: string;
  date: string;
  event: string;
  analyzed: number;
  prompts: number;
}

interface MediaRow {
  id: string;
  type: "image" | "video";
  prompt: string;
  url: string;
  date: string;
  seed?: number;
}

export function Archive() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"scans" | "media">("scans");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaRow | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.history().then(({ history }) => {
        const list = (history as Array<{ id?: string; timestamp?: number; event?: string; name?: string; analyzed?: number; prompts?: number; promptCount?: number }>) ?? [];
        return list.map((h) => ({
          id: h.id ?? "",
          date: h.timestamp ? new Date(h.timestamp).toISOString().slice(0, 10) : "",
          event: h.event ?? h.name ?? "Scan",
          analyzed: h.analyzed ?? 0,
          prompts: h.prompts ?? h.promptCount ?? 0,
        }));
      }),
      api.historyImages().then(({ images }) =>
        (images ?? []).map((f: { filename: string; url: string; timestamp: number }) => ({
          id: f.url,
          type: "image" as const,
          prompt: f.filename,
          url: f.url.startsWith("http") ? f.url : `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}${f.url}`,
          date: f.timestamp ? new Date(f.timestamp).toISOString().slice(0, 10) : "",
        }))
      ),
      api.historyVideos().then(({ videos }) =>
        (videos ?? []).map((f: { filename: string; url: string; timestamp: number }) => ({
          id: f.url,
          type: "video" as const,
          prompt: f.filename,
          url: f.url.startsWith("http") ? f.url : `${(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "")}${f.url}`,
          date: f.timestamp ? new Date(f.timestamp).toISOString().slice(0, 10) : "",
        }))
      ),
    ])
      .then(([scanList, imgList, vidList]) => {
        setScans(scanList);
        setMediaItems([...imgList, ...vidList]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredScans = scans.filter((scan) =>
    scan.event.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMedia = mediaItems.filter((item) =>
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
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-gray-500 text-center">Loading...</td></tr>
                  ) : filteredScans.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-gray-500 text-center">No scans yet.</td></tr>
                  ) : filteredScans.map((scan, index) => (
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
          loading ? (
            <div className="text-gray-500 py-12 text-center">Loading media...</div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-gray-500 py-12 text-center">No media yet.</div>
          ) : (
          <Masonry columnsCount={4} gutter="16px">
            {filteredMedia.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedMedia(item)}
                className="bg-[#0a0f1d] border border-[#161d2f] rounded-lg overflow-hidden hover:border-[#0ea5e9] transition-all cursor-pointer group"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] relative">
                  {item.type === "video" ? (
                    <video src={item.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                  )}
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
          )
        )}

        {/* Scan Detail Drawer */}
        <AnimatePresence>
          {selectedScan !== null && (() => {
            const scan = scans.find((s) => s.id === selectedScan);
            if (!scan) return null;
            return (
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
                      <h2 className="text-white font-bold mb-2" style={{ fontSize: '1.5rem' }}>{scan.event}</h2>
                      <p className="text-gray-400">{scan.date}</p>
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
                          <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>Items Analyzed</p>
                          <p className="text-white font-bold" style={{ fontSize: '1.5rem' }}>{scan.analyzed.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>Prompts Generated</p>
                          <p className="text-[#10b981] font-bold" style={{ fontSize: '1.5rem' }}>{scan.prompts}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
            );
          })()}
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
                  <div className="flex-[7] bg-[#050810] flex items-center justify-center p-8">
                    {selectedMedia.type === "video" ? (
                      <video src={selectedMedia.url} controls className="w-full max-h-[70vh] rounded-lg" />
                    ) : (
                      <img src={selectedMedia.url} alt={selectedMedia.prompt} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
                    )}
                  </div>
                  <div className="flex-[3] p-6 space-y-6">
                    <div className="flex items-start justify-between">
                      <h3 className="text-white font-bold" style={{ fontSize: '1.25rem' }}>
                        {selectedMedia.type === "video" ? "Video" : "Image"}
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
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>Prompt / Filename</p>
                        <p className="text-white bg-[#161d2f]/30 rounded-lg p-3">{selectedMedia.prompt}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>Created</p>
                        <p className="text-white font-mono bg-[#161d2f]/30 rounded-lg p-3">{selectedMedia.date}</p>
                      </div>
                      <motion.button
                        onClick={() => {
                          setSelectedMedia(null);
                          if (selectedMedia.type === "image") {
                            navigate("/dna", { state: { imageUrl: selectedMedia.url } });
                          } else {
                            navigate("/image-studio", { state: { prompts: [{ scene: selectedMedia.prompt, style: "", lighting: "" }] } });
                          }
                        }}
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