import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Zap, Layers, Image as ImageIcon, Video, 
  Shapes, Pen, Download, Sparkles 
} from "lucide-react";

interface ScanConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchTerm?: string;
  onStartScan?: (config: ScanConfig) => void;
}

export interface ScanConfig {
  searchTerm: string;
  sortOrder: "relevance" | "most-downloads" | "newest" | "featured";
  assetType: "all" | "photo" | "video" | "vector" | "illustration";
  pagesFrom: number;
  pagesTo: number;
  minimumDownloads: number;
  yearFrom: string;
  yearTo: string;
  aiGeneratedOnly: boolean;
  minimumDemand: number;
  strictAIFiltering: boolean;
}

export function ScanConfigModal({ isOpen, onClose, searchTerm = "", onStartScan }: ScanConfigModalProps) {
  const [config, setConfig] = useState<ScanConfig>({
    searchTerm,
    sortOrder: "relevance",
    assetType: "all",
    pagesFrom: 1,
    pagesTo: 3,
    minimumDownloads: 5,
    yearFrom: "",
    yearTo: "",
    aiGeneratedOnly: false,
    minimumDemand: 500,
    strictAIFiltering: true,
  });

  const handleStartScan = () => {
    onStartScan?.(config);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0a0f1d] border border-[#161d2f] rounded-2xl p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 text-[#0ea5e9] text-xs font-semibold uppercase tracking-wider mb-2">
                    <Zap className="w-3.5 h-3.5" />
                    Scan Configuration
                  </div>
                  <h2 className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>
                    {config.searchTerm || "New Scan"}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[#161d2f] rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Search Term */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Search Term
                </label>
                <input
                  type="text"
                  value={config.searchTerm}
                  onChange={(e) => setConfig({ ...config, searchTerm: e.target.value })}
                  placeholder="Enter search keywords..."
                  className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm placeholder:text-gray-700 outline-none transition-all"
                />
              </div>

              {/* Sort Order */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Sort Order
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "relevance", label: "Relevance", icon: Sparkles },
                    { id: "most-downloads", label: "Most Downloads", icon: Download },
                    { id: "newest", label: "Newest", icon: Zap },
                    { id: "featured", label: "Featured", icon: Sparkles }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setConfig({ ...config, sortOrder: option.id as typeof config.sortOrder })}
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${
                        config.sortOrder === option.id
                          ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                          : "bg-[#050810] border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                      }`}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset Type */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Asset Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "all", label: "All", icon: Layers },
                    { id: "photo", label: "Photo", icon: ImageIcon },
                    { id: "video", label: "Video", icon: Video },
                    { id: "vector", label: "Vector", icon: Shapes },
                    { id: "illustration", label: "Illustration", icon: Pen }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setConfig({ ...config, assetType: option.id as typeof config.assetType })}
                      className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all border flex items-center justify-center gap-2 ${
                        config.assetType === option.id
                          ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                          : "bg-[#050810] border-[#161d2f] text-gray-400 hover:text-white hover:border-[#374151]"
                      }`}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pages to Scan */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Pages to Scan
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-gray-600 text-xs mb-2">FROM</div>
                    <input
                      type="number"
                      value={config.pagesFrom}
                      onChange={(e) => setConfig({ ...config, pagesFrom: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all"
                    />
                  </div>
                  <div>
                    <div className="text-gray-600 text-xs mb-2">TO PAGE</div>
                    <input
                      type="number"
                      value={config.pagesTo}
                      onChange={(e) => setConfig({ ...config, pagesTo: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all"
                    />
                  </div>
                </div>
                <p className="text-gray-600 text-xs mt-2">
                  Adobe Stock pagination (approx. 100 images per page)
                </p>
              </div>

              {/* Minimum Downloads */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Minimum Downloads
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={config.minimumDownloads}
                    onChange={(e) => setConfig({ ...config, minimumDownloads: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs">
                    downloads minimum
                  </span>
                </div>
              </div>

              {/* Minimum Demand Slider */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Minimum Demand: <span className="text-[#0ea5e9] font-bold">{config.minimumDemand}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="50"
                  value={config.minimumDemand}
                  onChange={(e) => setConfig({ ...config, minimumDemand: parseInt(e.target.value) })}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #0ea5e9 0%, #8b5cf6 ${(config.minimumDemand / 10000) * 100}%, #1f2937 ${(config.minimumDemand / 10000) * 100}%, #1f2937 100%)`
                  }}
                />
              </div>

              {/* Year of Publish */}
              <div className="mb-8">
                <label className="block text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">
                  Year of Publish
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={config.yearFrom}
                    onChange={(e) => setConfig({ ...config, yearFrom: e.target.value })}
                    placeholder="Any"
                    className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all placeholder:text-gray-700"
                  />
                  <input
                    type="text"
                    value={config.yearTo}
                    onChange={(e) => setConfig({ ...config, yearTo: e.target.value })}
                    placeholder="Any"
                    className="w-full px-4 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#0ea5e9] focus:border-[#0ea5e9] rounded-lg text-white text-sm font-mono outline-none transition-all placeholder:text-gray-700"
                  />
                </div>
              </div>

              {/* AI Generated Only Toggle */}
              <div className="mb-8">
                <div className="flex items-center justify-between p-4 bg-[#050810] border border-[#161d2f] rounded-xl">
                  <div>
                    <div className="text-white font-semibold text-sm mb-1">
                      AI Generated Only
                    </div>
                    <div className="text-gray-600 text-xs">
                      Filter to AI-generated assets only
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, aiGeneratedOnly: !config.aiGeneratedOnly })}
                    className={`relative w-14 h-7 rounded-full transition-all ${
                      config.aiGeneratedOnly ? "bg-[#0ea5e9]" : "bg-[#374151]"
                    }`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg"
                      animate={{ x: config.aiGeneratedOnly ? 28 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* Strict AI Filtering Toggle */}
              <div className="mb-8">
                <div className="flex items-center justify-between p-4 bg-[#050810] border border-[#161d2f] rounded-xl">
                  <div>
                    <div className="text-white font-semibold text-sm mb-1">
                      Strict AI Filtering
                    </div>
                    <div className="text-gray-600 text-xs">
                      Apply advanced quality filters
                    </div>
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, strictAIFiltering: !config.strictAIFiltering })}
                    className={`relative w-14 h-7 rounded-full transition-all ${
                      config.strictAIFiltering ? "bg-[#0ea5e9]" : "bg-[#374151]"
                    }`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg"
                      animate={{ x: config.strictAIFiltering ? 28 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-[#050810] border border-[#161d2f] hover:border-[#374151] rounded-xl text-gray-400 hover:text-white font-bold text-sm transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleStartScan}
                  className="px-6 py-3 bg-gradient-to-r from-[#0ea5e9] to-[#06b6d4] hover:opacity-90 rounded-xl text-white font-bold text-sm shadow-lg shadow-cyan-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  START SCAN
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
