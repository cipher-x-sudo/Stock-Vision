import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp, Zap, Maximize, Crown, Video, MonitorPlay, CircleOff } from "lucide-react";

interface CloneSettingsPanelProps {
  expanded: boolean;
  onToggle: () => void;
  aspectRatio: string;
  setAspectRatio: (value: string) => void;
  imageResolution: string;
  setImageResolution: (value: string) => void;
  videoModel: string;
  setVideoModel: (value: string) => void;
  videoAspectRatio: string;
  setVideoAspectRatio: (value: string) => void;
  videoResolution: string;
  setVideoResolution: (value: string) => void;
  autoDownload: boolean;
  setAutoDownload: (value: boolean) => void;
  negativePrompt: string;
  setNegativePrompt: (value: string) => void;
}

export function CloneSettingsPanel({
  expanded,
  onToggle,
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
  return (
    <motion.div
      className="bg-[#0a0f1d] border border-[#161d2f] rounded-xl overflow-hidden mb-6"
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
            <div className="p-6 space-y-6">
              {/* ASPECT RATIO */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Maximize className="w-4 h-4 text-[#0ea5e9]" />
                  <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                    Aspect Ratio
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { value: "AUTO", label: "AUTO" },
                    { value: "1:1", label: "1:1 SQUARE" },
                    { value: "16:9", label: "16:9 WIDE" },
                    { value: "9:16", label: "9:16 TALL" },
                    { value: "4:3", label: "4:3" },
                    { value: "3:4", label: "3:4" },
                    { value: "3:2", label: "3:2" },
                    { value: "2:3", label: "2:3" },
                    { value: "4:5", label: "4:5" },
                    { value: "21:9", label: "21:9 ULTRA WIDE" },
                    { value: "5:4", label: "5:4" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAspectRatio(option.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
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

              <div className="grid grid-cols-3 gap-6">
                {/* RESOLUTION */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-[#f59e0b]" />
                    <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                      Resolution
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { value: "1K", label: "1K (DEFAULT)" },
                      { value: "2K", label: "2K" },
                      { value: "4K", label: "4K ULTRA HD" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setImageResolution(option.value)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-left ${
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

                {/* VIDEO GENERATION MODEL */}
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

                {/* AUTO-DOWNLOAD */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MonitorPlay className="w-4 h-4 text-[#10b981]" />
                    <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                      Auto-Download
                    </span>
                  </div>
                  <button
                    onClick={() => setAutoDownload(!autoDownload)}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-left ${
                      autoDownload
                        ? "bg-[#10b981] text-white border border-[#10b981]"
                        : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#10b981]/50"
                    }`}
                  >
                    {autoDownload ? "ON" : "OFF"}
                  </button>
                  <p className="text-gray-600 text-[10px] mt-2 leading-relaxed">
                    Download each image or video when done. For 10+ tasks you get one .ZIP when batch completes
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* VIDEO ASPECT RATIO */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <MonitorPlay className="w-4 h-4 text-[#8b5cf6]" />
                    <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                      Video Aspect Ratio
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { value: "LANDSCAPE (16:9)", label: "LANDSCAPE (16:9)" },
                      { value: "PORTRAIT (9:16)", label: "PORTRAIT (9:16)" },
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

                {/* VIDEO RESOLUTION */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Video className="w-4 h-4 text-[#ec4899]" />
                    <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                      Video Resolution
                    </span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { value: "720P", label: "720P" },
                      { value: "1080P", label: "1080P" },
                      { value: "4K UHD", label: "4K UHD" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setVideoResolution(option.value)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all text-left ${
                          videoResolution === option.value
                            ? "bg-[#ec4899] text-white border border-[#ec4899]"
                            : "bg-[#161d2f] text-gray-400 border border-[#1a1f30] hover:border-[#ec4899]/50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* NEGATIVE PROMPT */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CircleOff className="w-4 h-4 text-red-500" />
                  <span className="text-gray-400 text-xs font-mono uppercase tracking-wide">
                    Negative Prompt
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
