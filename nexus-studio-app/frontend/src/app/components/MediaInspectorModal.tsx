import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Film, Wand2, Crown, Download, Archive, X } from "lucide-react";

export interface MediaInspectorModalProps {
  open: boolean;
  onClose: () => void;
  type: "image" | "video";
  mediaUrl: string;
  title?: string;
  subtitle?: string;
  resolution?: string;
  aspectRatio?: string;
  format?: string;
  visionPrompt?: string;
  onDownload?: () => void;
  onSendToArchive?: () => void;
  onUpscaleImage2K?: () => void;
  onUpscaleImage4K?: () => void;
  onUpscaleVideo1080p?: () => void;
  onUpscaleVideo4K?: () => void;
}

export function MediaInspectorModal({
  open,
  onClose,
  type,
  mediaUrl,
  title,
  subtitle,
  resolution = "720P",
  aspectRatio = "16:9",
  format,
  visionPrompt,
  onDownload,
  onSendToArchive,
  onUpscaleImage2K,
  onUpscaleImage4K,
  onUpscaleVideo1080p,
  onUpscaleVideo4K,
}: MediaInspectorModalProps) {
  const displayTitle = title ?? (type === "image" ? "CLONED IMAGE" : "ANIMATED CLONE (VEO)");
  const displaySubtitle = subtitle ?? (type === "image" ? "720P • AI Vision" : "720P • Video Generation");
  const displayFormat = format ?? (type === "image" ? "PNG" : "MP4");
  const showImageUpscale = type === "image" && (onUpscaleImage2K != null || onUpscaleImage4K != null);
  const showVideoUpscale = type === "video" && (onUpscaleVideo1080p != null || onUpscaleVideo4K != null);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0a0f1d] border-2 border-[#161d2f] rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#161d2f] sticky top-0 bg-[#0a0f1d] z-10">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    type === "image"
                      ? "bg-gradient-to-br from-[#ec4899] to-[#8b5cf6]"
                      : "bg-gradient-to-br from-[#8b5cf6] to-[#6366f1]"
                  }`}
                >
                  {type === "image" ? (
                    <Sparkles className="w-5 h-5 text-white" />
                  ) : (
                    <Film className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl" style={{ fontFamily: "Space Grotesk" }}>
                    {displayTitle}
                  </h2>
                  <p className="text-gray-500 text-sm font-mono">{displaySubtitle}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#161d2f] rounded-lg transition-colors">
                <X className="w-6 h-6 text-gray-500 hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="grid grid-cols-3 gap-8">
                {/* Preview */}
                <div className="col-span-2">
                  <div className="aspect-video bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-xl overflow-hidden mb-6">
                    {type === "image" && mediaUrl ? (
                      <img src={mediaUrl} alt="Preview" className="w-full h-full object-contain" />
                    ) : type === "video" && mediaUrl ? (
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        loop
                        playsInline
                      />
                    ) : null}
                  </div>

                  {/* Vision Analysis Prompt */}
                  {visionPrompt != null && visionPrompt.trim() !== "" && (
                    <div className="bg-[#050810] border border-[#161d2f] rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Wand2 className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-[#f59e0b] text-xs font-mono font-bold uppercase tracking-wider">
                          Vision Analysis Prompt
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm font-mono leading-relaxed">{visionPrompt}</p>
                    </div>
                  )}
                </div>

                {/* Actions Panel */}
                <div className="space-y-4">
                  {/* Info Card */}
                  <div className="bg-[#050810] border border-[#161d2f] rounded-xl p-4 space-y-3">
                    <div>
                      <span className="text-gray-600 text-xs font-mono uppercase">Current Resolution</span>
                      <p className="text-white text-sm font-bold">{resolution}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs font-mono uppercase">Aspect Ratio</span>
                      <p className="text-white text-sm font-bold">{aspectRatio}</p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs font-mono uppercase">Format</span>
                      <p className="text-white text-sm font-bold">{displayFormat}</p>
                    </div>
                  </div>

                  {/* Upscale Image */}
                  {showImageUpscale && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="w-4 h-4 text-[#f59e0b]" />
                        <span className="text-[#f59e0b] text-xs font-mono font-bold uppercase tracking-wider">
                          Upscale Image
                        </span>
                      </div>
                      {onUpscaleImage2K != null && (
                        <button
                          onClick={onUpscaleImage2K}
                          className="w-full px-4 py-3 bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#f59e0b]/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Crown className="w-4 h-4" />
                          UPSCALE TO 2K
                        </button>
                      )}
                      {onUpscaleImage4K != null && (
                        <button
                          onClick={onUpscaleImage4K}
                          className="w-full px-4 py-3 bg-gradient-to-r from-[#f59e0b] to-[#ea580c] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#f59e0b]/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Crown className="w-4 h-4" />
                          UPSCALE TO 4K ULTRA HD
                        </button>
                      )}
                    </div>
                  )}

                  {/* Upscale Video */}
                  {showVideoUpscale && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="w-4 h-4 text-[#8b5cf6]" />
                        <span className="text-[#8b5cf6] text-xs font-mono font-bold uppercase tracking-wider">
                          Upscale Video
                        </span>
                      </div>
                      {onUpscaleVideo1080p != null && (
                        <button
                          onClick={onUpscaleVideo1080p}
                          className="w-full px-4 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#8b5cf6]/30 transition-all flex items-center justify-center gap-2"
                        >
                          UPSCALE TO 1080P
                        </button>
                      )}
                      {onUpscaleVideo4K != null && (
                        <button
                          onClick={onUpscaleVideo4K}
                          className="w-full px-4 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#8b5cf6]/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Crown className="w-4 h-4" />
                          UPSCALE TO 4K UHD
                        </button>
                      )}
                    </div>
                  )}

                  {/* Download & Archive */}
                  <div className="space-y-3 pt-4 border-t border-[#161d2f]">
                    <button
                      onClick={() => onDownload?.()}
                      className="w-full px-4 py-3 bg-gradient-to-r from-[#0ea5e9] to-[#06b6d4] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#0ea5e9]/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      DOWNLOAD
                    </button>
                    <button
                      onClick={() => onSendToArchive?.()}
                      className="w-full px-4 py-3 bg-gradient-to-r from-[#10b981] to-[#059669] hover:opacity-90 rounded-lg text-white font-bold text-sm uppercase tracking-wide shadow-lg shadow-[#10b981]/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Archive className="w-4 h-4" />
                      SEND TO ARCHIVE
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
