import { useState, useEffect } from "react";
import { Search, Film, X, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import Masonry from "react-responsive-masonry";
import { api } from "../../../services/api";

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
  seed?: number;
  date: string;
  url: string;
  thumbnailUrl?: string;
}

export function Archive() {
  const [activeView, setActiveView] = useState<"scans" | "media">("scans");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.historyBatches().then((res) => {
        const batches = res.batches ?? [];
        return batches.map((b) => ({
          id: b.filename,
          date: b.timestamp ? new Date(b.timestamp).toLocaleDateString() : "",
          event: b.filename.replace(/\.json$/i, "").replace(/^batch-/, "") || "Batch",
          analyzed: 0,
          prompts: 0,
        }));
      }),
      (async () => {
        const [flowRes, imgRes, vidRes] = await Promise.all([
          api.flowHistory(),
          api.historyImages().catch(() => ({ images: [] })),
          api.historyVideos().catch(() => ({ videos: [] })),
        ]);
        const items: MediaRow[] = [];
        (flowRes.items ?? []).forEach((item, i) => {
          items.push({
            id: item.media_generation_id ?? `flow-${i}`,
            type: item.type,
            prompt: item.prompt ?? "",
            seed: item.seed,
            date: "Recent",
            url: item.url,
            thumbnailUrl: item.thumbnail_url,
          });
        });
        (imgRes.images ?? []).forEach((img) => {
          items.push({
            id: `img-${img.filename}`,
            type: "image",
            prompt: img.filename,
            date: img.timestamp ? new Date(img.timestamp).toLocaleDateString() : "",
            url: img.url.startsWith("http") ? img.url : `${window.location.origin}${img.url}`,
          });
        });
        (vidRes.videos ?? []).forEach((v) => {
          items.push({
            id: `vid-${v.filename}`,
            type: "video",
            prompt: v.filename,
            date: v.timestamp ? new Date(v.timestamp).toLocaleDateString() : "",
            url: v.url.startsWith("http") ? v.url : `${window.location.origin}${v.url}`,
          });
        });
        return items;
      })(),
    ])
      .then(([scanRows, mediaRows]) => {
        if (!cancelled) {
          setScans(scanRows);
          setMediaItems(mediaRows);
        }
      })
      .catch(() => { if (!cancelled) setScans([]); setMediaItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
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
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                  ) : filteredScans.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No batches yet. Run Market Pipeline scans to see them here.</td></tr>
                  ) : (
                    filteredScans.map((scan, index) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Media Renders View */}
        {activeView === "media" && (
          loading ? (
            <div className="py-12 text-center text-gray-500">Loading media...</div>
          ) : filteredMedia.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No media yet. Generate images or videos in Image Studio / Video Studio.</div>
          ) : (
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
                <div className="aspect-[4/3] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] relative overflow-hidden">
                  {item.type === "video" ? (
                    <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />
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
                        {scans.find((s) => s.id === selectedScan)?.event}
                      </h2>
                      <p className="text-gray-400">
                        {scans.find((s) => s.id === selectedScan)?.date}
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
                            {scans.find((s) => s.id === selectedScan)?.analyzed.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500" style={{ fontSize: '0.875rem' }}>
                            Prompts Generated
                          </p>
                          <p className="text-[#10b981] font-bold" style={{ fontSize: '1.5rem' }}>
                            {scans.find((s) => s.id === selectedScan)?.prompts}
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
                    {(() => {
                      const media = filteredMedia.find((m) => m.id === selectedMedia);
                      if (!media) return <div className="w-full aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-lg" />;
                      return media.type === "video" ? (
                        <video src={media.url} controls className="w-full aspect-video rounded-lg object-contain bg-black" />
                      ) : (
                        <img src={media.thumbnailUrl || media.url} alt={media.prompt} className="w-full max-h-[70vh] object-contain rounded-lg" />
                      );
                    })()}
                  </div>

                  {/* Right - Details */}
                  <div className="flex-[3] p-6 space-y-6">
                    <div className="flex items-start justify-between">
                      <h3 className="text-white font-bold" style={{ fontSize: '1.25rem' }}>
                        {filteredMedia.find((m) => m.id === selectedMedia)?.type === "video" ? "Video" : "Image"}
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
                          {filteredMedia.find((m) => m.id === selectedMedia)?.prompt}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>
                          Seed
                        </p>
                        <p className="text-white font-mono bg-[#161d2f]/30 rounded-lg p-3">
                          {filteredMedia.find((m) => m.id === selectedMedia)?.seed ?? "—"}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '0.875rem' }}>
                          Created
                        </p>
                        <p className="text-white font-mono bg-[#161d2f]/30 rounded-lg p-3">
                          {filteredMedia.find((m) => m.id === selectedMedia)?.date}
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