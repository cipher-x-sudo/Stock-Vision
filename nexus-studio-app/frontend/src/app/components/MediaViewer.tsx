import { motion, AnimatePresence } from "motion/react";
import { X, Download, Archive, Crown, Sparkles } from "lucide-react";

export interface MediaItem {
  id: string;
  title: string;
  downloads: number;
  premium: string;
  creator: string;
  creatorId: string;
  mediaType: string;
  category: string;
  contentType: string;
  dimensions: string;
  uploadDate: string;
  keywords: string[];
  thumbnailUrl: string;
  isAI: boolean;
}

interface MediaViewerProps {
  media: MediaItem | null;
  onClose: () => void;
}

export function MediaViewer({ media, onClose }: MediaViewerProps) {
  if (!media) return null;

  const isVideo = media.mediaType === "Video" || media.contentType.includes("video");
  const [width, height] = media.dimensions.split(" x ").map(d => parseInt(d));
  const aspectRatio = `${width}:${height}`;

  return (
    <AnimatePresence>
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
          className="max-w-7xl w-full flex gap-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Media Preview */}
          <div className="flex-1 flex items-center justify-center">
            {isVideo ? (
              <div className="w-full aspect-video bg-[#0a0f1d] rounded-xl overflow-hidden border border-[#161d2f]">
                <video
                  src={media.thumbnailUrl}
                  controls
                  className="w-full h-full object-contain"
                  autoPlay
                />
              </div>
            ) : (
              <img
                src={media.thumbnailUrl}
                alt={media.title}
                className="max-w-full max-h-[80vh] rounded-xl border border-[#161d2f]"
              />
            )}
          </div>

          {/* Inspector Panel */}
          <div className="w-[340px] bg-[#0a0f1d] border border-[#161d2f] rounded-xl p-6 flex flex-col gap-6">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 bg-[#161d2f] hover:bg-[#1f2937] rounded-lg flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Title */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-white font-bold text-lg">
                  {media.mediaType === "Video" ? "ANIMATED CLONE (VEO)" : "CLONED IMAGE"}
                </h2>
              </div>
              <p className="text-gray-400 text-sm">
                {media.dimensions.replace(" x ", " × ")} • {media.mediaType}
              </p>
            </div>

            {/* Current Details */}
            <div className="space-y-3">
              <div>
                <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Current Resolution</div>
                <div className="text-white font-bold">720P</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Aspect Ratio</div>
                <div className="text-white font-bold">16:9</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs uppercase tracking-wider mb-1">Format</div>
                <div className="text-white font-bold">{isVideo ? "MP4" : "PNG"}</div>
              </div>
            </div>

            {/* Upscale Options */}
            {isVideo ? (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#8b5cf6]" />
                    <span className="text-[#8b5cf6] text-xs font-bold uppercase tracking-wider">Upscale Video</span>
                  </div>
                  <div className="space-y-2">
                    <button className="w-full px-4 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4" />
                      UPSCALE TO 1080P
                    </button>
                    <button className="w-full px-4 py-3 bg-gradient-to-r from-[#7c3aed] to-[#8b5cf6] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4" />
                      UPSCALE TO 4K UHD
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                    <span className="text-[#f59e0b] text-xs font-bold uppercase tracking-wider">Upscale Image</span>
                  </div>
                  <div className="space-y-2">
                    <button className="w-full px-4 py-3 bg-gradient-to-r from-[#f59e0b] to-[#fb923c] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4" />
                      UPSCALE TO 2K
                    </button>
                    <button className="w-full px-4 py-3 bg-gradient-to-r from-[#ea580c] to-[#f59e0b] hover:opacity-90 rounded-lg text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4" />
                      UPSCALE TO 4K ULTRA HD
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="space-y-2 mt-auto">
              <button className="w-full px-4 py-3 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 rounded-lg text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                DOWNLOAD
              </button>
              <button className="w-full px-4 py-3 bg-[#10b981] hover:bg-[#10b981]/90 rounded-lg text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                <Archive className="w-4 h-4" />
                SEND TO ARCHIVE
              </button>
            </div>

            {/* Vision Analysis */}
            <div className="border-t border-[#161d2f] pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#f59e0b]" />
                <span className="text-[#f59e0b] text-xs font-bold uppercase tracking-wider">Vision Analysis Prompt</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed font-mono">
                {media.title}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
