import { useState, useEffect } from "react";
import { Search, Film, X, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import Masonry from "react-responsive-masonry";
import { api } from "../../../services/api";
import { MediaInspectorModal } from "../MediaInspectorModal";

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

const baseUrl = ((import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "").replace(/\/$/, "");

export function Archive() {
  const [activeView, setActiveView] = useState<"scans" | "media">("scans");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
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
          url: f.url.startsWith("http") ? f.url : `${baseUrl}${f.url}`,
          date: f.timestamp ? new Date(f.timestamp).toISOString().slice(0, 10) : "",
        }))
      ),
      api.historyVideos().then(({ videos }) =>
        (videos ?? []).map((f: { filename: string; url: string; timestamp: number }) => ({
          id: f.url,
          type: "video" as const,
          prompt: f.filename,
          url: f.url.startsWith("http") ? f.url : `${baseUrl}${f.url}`,
          date: f.timestamp ? new Date(f.timestamp).toISOString().slice(0, 10) : "",
        }))
      ),
      api.flowHistory().then(({ items }) =>
        (items ?? []).map((item) => ({
          id: item.media_generation_id ?? item.url,
          type: item.type,
          prompt: item.prompt || "Flow",
          url: item.url.startsWith("http") ? item.url : `${baseUrl}${item.url}`,
          date: "",
        }))
      ).catch(() => [] as MediaRow[]),
    ])
      .then(([scanList, imgList, vidList, flowItems]) => {
        setScans(scanList);
        setMediaItems([...imgList, ...vidList, ...flowItems]);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load archive");
        setScans([]);
        setMediaItems([]);
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

        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-gray-400 text-center py-12">Loading archive...</div>
        )}

        {!loading && !error && (
        <>

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
                      onClick={() => setSelectedScan(String(scan.id))}
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
                onClick={() => setSelectedMedia(String(item.id))}
                className="bg-[#0a0f1d] border border-[#161d2f] rounded-lg overflow-hidden hover:border-[#0ea5e9] transition-all cursor-pointer group"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] relative overflow-hidden">
                  {item.type === "video" ? (
                    item.url ? (
                      <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Film className="w-10 h-10 text-gray-600" />
                      </div>
                    )
                  ) : item.url ? (
                    <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-10 h-10 text-gray-600" />
                    </div>
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

        {selectedMedia !== null && (() => {
          const media = mediaItems.find((m) => m.id === selectedMedia);
          return media ? (
            <MediaInspectorModal
              open={true}
              onClose={() => setSelectedMedia(null)}
              type={media.type}
              mediaUrl={media.url}
              title={media.type === "video" ? "Video" : "Image"}
              subtitle="Archive"
              resolution="720P"
              aspectRatio="16:9"
              format={media.type === "image" ? "PNG" : "MP4"}
              visionPrompt={media.prompt}
              onDownload={() => {
                const a = document.createElement("a");
                a.href = media.url;
                a.download = media.url.split("/").pop() ?? "media";
                a.rel = "noopener";
                a.click();
              }}
              onSendToArchive={undefined}
            />
          ) : null;
        })()}

        </>)}
      </div>
    </div>
  );
}