import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Zap, Maximize, Crown, Video, MonitorPlay, CircleOff, Image as ImageIcon, Film, Clock, Navigation } from "lucide-react";

interface CloneSettingsPanelProps {
  expanded: boolean;
  onToggle: () => void;
  // Image
  imageModel: string;
  setImageModel: (value: string) => void;
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  imageResolution: string;
  setImageResolution: (value: string) => void;
  // Video
  videoModel: string;
  setVideoModel: (value: string) => void;
  videoAspectRatio: string;
  setVideoAspectRatio: (value: string) => void;
  videoResolution: string;
  setVideoResolution: (value: string) => void;
  // Global
  autoDownload: boolean;
  setAutoDownload: (value: boolean) => void;
  negativePrompt: string;
  setNegativePrompt: (value: string) => void;
}

export function CloneSettingsPanel({
  expanded,
  onToggle,
  imageModel,
  setImageModel,
  aspectRatio,
  setAspectRatio,
  imageResolution,
  setImageResolution,
  videoModel,
  setVideoModel,
  videoAspectRatio,
  setVideoAspectRatio,
  videoResolution,
  setVideoResolution,
  autoDownload,
  setAutoDownload,
  negativePrompt,
  setNegativePrompt,
}: CloneSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"image" | "video">("image");

  return (
    <motion.div
      className="bg-[#0a0f1d] border border-[#161d2f] rounded-xl overflow-hidden mb-6 flex flex-col"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#161d2f]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-pink-500" />
          <h3
            className="text-white font-bold text-sm uppercase tracking-wide"
            style={{ fontFamily: "Space Grotesk" }}
          >
            Clone Settings
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#161d2f]"
          >
            {/* Tabs */}
            <div className="flex items-center border-b border-[#161d2f]">
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase transition-colors ${
                  activeTab === "image"
                    ? "bg-[#161d2f] text-pink-500 border-b-2 border-pink-500"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#161d2f]/50"
                }`}
                onClick={() => setActiveTab("image")}
              >
                <ImageIcon className="w-4 h-4" />
                Image Clone Settings
              </button>
              <button
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase transition-colors ${
                  activeTab === "video"
                    ? "bg-[#161d2f] text-purple-500 border-b-2 border-purple-500"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#161d2f]/50"
                }`}
                onClick={() => setActiveTab("video")}
              >
                <Film className="w-4 h-4" />
                Video Clone Settings
              </button>
            </div>

            <div className="p-6 space-y-6">
              {activeTab === "image" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    {/* IMAGE MODEL */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-[#ec4899]" />
                        <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                          Image Generation Model
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: "FLUX.1.1 PRO", label: "FLUX.1.1 PRO" },
                          { value: "NANO BANANA PRO", label: "NANO BANANA PRO" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setImageModel(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-left ${
                              imageModel === option.value
                                ? "bg-[#ec4899] text-white border border-[#ec4899]"
                                : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#ec4899]/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* RESOLUTION */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Crown className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                          Resolution
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "1K", label: "1K" },
                          { value: "2K", label: "2K" },
                          { value: "4K", label: "4K UHD" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setImageResolution(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-center ${
                              imageResolution === option.value
                                ? "bg-[#f59e0b] text-white border border-[#f59e0b]"
                                : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#f59e0b]/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ASPECT RATIO */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Maximize className="w-4 h-4 text-[#0ea5e9]" />
                      <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                        Aspect Ratio
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: "9:16", label: "9:16" },
                        { value: "16:9", label: "16:9" },
                        { value: "1:1", label: "1:1" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setAspectRatio(option.value)}
                          className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${
                            aspectRatio === option.value
                              ? "bg-[#0ea5e9] text-white border border-[#0ea5e9]"
                              : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#0ea5e9]/50"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "video" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    {/* VIDEO MODEL */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="w-4 h-4 text-[#8b5cf6]" />
                        <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                          Video Generation Model
                        </span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { value: "VEO 3.1 FAST (DRAFT)", label: "VEO 3.1 FAST (DRAFT)" },
                          { value: "VEO 3.1 HIGH QUALITY", label: "VEO 3.1 HIGH QUALITY" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setVideoModel(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-left ${
                              videoModel === option.value
                                ? "bg-[#8b5cf6] text-white border border-[#8b5cf6]"
                                : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#8b5cf6]/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* VIDEO ASPECT RATIO */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Maximize className="w-4 h-4 text-[#8b5cf6]" />
                        <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                          Video Aspect Ratio
                        </span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { value: "LANDSCAPE (16:9)", label: "LANDSCAPE (16:9)" },
                          { value: "PORTRAIT (9:16)", label: "PORTRAIT (9:16)" },
                          { value: "SQUARE (1:1)", label: "SQUARE (1:1)" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setVideoAspectRatio(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-left ${
                              videoAspectRatio === option.value
                                ? "bg-[#8b5cf6] text-white border border-[#8b5cf6]"
                                : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#8b5cf6]/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* VIDEO RESOLUTION & DURATION */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MonitorPlay className="w-4 h-4 text-[#10b981]" />
                        <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                          Video Resolution
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "720P", label: "720P" },
                          { value: "1080P", label: "1080P" },
                          { value: "4K UHD", label: "4K UHD" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setVideoResolution(option.value)}
                            className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-center ${
                              videoResolution === option.value
                                ? "bg-[#10b981] text-white border border-[#10b981]"
                                : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#10b981]/50"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>


                  </div>
                </div>
              )}

              {/* GLOBAL SETTINGS (Always visible at the bottom) */}
              <div className="pt-6 border-t border-[#161d2f]">
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                      <CircleOff className="w-4 h-4 text-red-500" />
                      <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                        Negative Prompt (Global)
                      </span>
                    </div>
                    <input
                      type="text"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      placeholder="Things to avoid... e.g. blurry, watermark, text, low quality, deformed"
                      className="w-full px-4 py-3 bg-[#161d2f] border border-[#1a1f30] rounded-lg text-white text-sm placeholder:text-gray-600 focus:border-red-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MonitorPlay className="w-4 h-4 text-[#10b981]" />
                      <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                        Auto-Download
                      </span>
                    </div>
                    <button
                      onClick={() => setAutoDownload(!autoDownload)}
                      className={`w-full px-3 py-3 rounded-lg text-sm font-bold uppercase transition-all text-center ${
                        autoDownload
                          ? "bg-[#10b981] text-white border border-[#10b981]"
                          : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#10b981]/50"
                      }`}
                    >
                      {autoDownload ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
