import { useState, useRef } from "react";
import { Link, Upload, Check, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PromptTable } from "../PromptTable";
import { api, mapApiPromptsToRows } from "@/services/api";
import { toast } from "sonner";

interface ExtractedImage {
  id: string;
  url: string;
  title?: string;
}

export function DNAExtraction() {
  const [targetUrl, setTargetUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [showPrompts, setShowPrompts] = useState(false);
  const [extractedImages, setExtractedImages] = useState<ExtractedImage[]>([]);
  const [prompts, setPrompts] = useState<Array<{ id: number; scene: string; style: string; lighting: string }>>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleExtractUrl = async () => {
    const url = targetUrl.trim();
    if (!url) return;
    setIsExtracting(true);
    setShowImages(false);
    setShowPrompts(false);
    setSelectedImages([]);
    try {
      const { prompts: p } = await api.generateCloningPrompts({
        images: [{ url, title: "Extracted", id: "1" }],
      });
      setExtractedImages([{ id: "1", url, title: "Extracted" }]);
      setPrompts(mapApiPromptsToRows(p ?? []));
      setShowImages(true);
      setShowPrompts(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extract failed");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result);
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        toast.error("CSV needs a header and at least one row");
        return;
      }
      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const urlCol = header.findIndex((h) => /url|link|image_url|src|href/.test(h));
      if (urlCol === -1) {
        toast.error("CSV must have a column named url, link, or image_url");
        return;
      }
      const images: ExtractedImage[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map((v) => v.trim());
        const u = vals[urlCol];
        if (u && (u.startsWith("http://") || u.startsWith("https://"))) {
          images.push({ id: String(i), url: u, title: `Row ${i}` });
        }
      }
      if (images.length === 0) {
        toast.error("No valid URLs found in CSV");
        return;
      }
      setIsExtracting(true);
      setShowPrompts(false);
      try {
        const { prompts: p } = await api.generateCloningPrompts({ images });
        setExtractedImages(images);
        setPrompts(mapApiPromptsToRows(p ?? []));
        setShowImages(true);
        setShowPrompts(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Cloning failed");
      } finally {
        setIsExtracting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const toggleImageSelection = (idx: number) => {
    setSelectedImages((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleExtractDNA = async () => {
    const toSend = selectedImages.length > 0
      ? extractedImages.filter((_, i) => selectedImages.includes(i))
      : extractedImages;
    if (toSend.length === 0) {
      toast.error("Select images or add URL/CSV first");
      return;
    }
    setIsExtracting(true);
    try {
      const { prompts: p } = await api.generateCloningPrompts({
        images: toSend.map((img) => ({ url: img.url, title: img.title, id: img.id })),
      });
      setPrompts(mapApiPromptsToRows(p ?? []));
      setShowPrompts(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extract DNA failed");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-white font-bold tracking-tight mb-2" style={{ fontSize: '2.5rem', fontFamily: 'Space Grotesk', fontStyle: 'italic' }}>
            DNA Extraction
          </h1>
          <p className="text-gray-400" style={{ fontSize: '1.125rem' }}>
            Reverse engineer competitor portfolios into reusable prompts
          </p>
        </div>

        {/* Input Methods */}
        <div className="grid grid-cols-2 gap-6">
          {/* URL Input */}
          <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-[#0ea5e9]" />
              Extract from URL
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://portfolio.example.com/gallery"
                className="w-full px-4 py-3 bg-[#161d2f]/50 border border-[#161d2f] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ea5e9] focus:shadow-[0_0_20px_rgba(14,165,233,0.2)] transition-all"
              />
              <motion.button
                onClick={handleExtractUrl}
                disabled={!targetUrl.trim()}
                className="w-full px-6 py-3 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all shadow-[0_0_20px_rgba(14,165,233,0.4)]"
                whileHover={targetUrl.trim() ? { scale: 1.02 } : {}}
                whileTap={targetUrl.trim() ? { scale: 0.98 } : {}}
              >
                Extract
              </motion.button>
            </div>
          </div>

          {/* CSV Upload */}
          <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
            <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#f59e0b]" />
              Upload CSV Metadata
            </h2>
            <motion.div
              onClick={() => csvInputRef.current?.click()}
              className="border-2 border-dashed border-[#161d2f] rounded-lg p-12 text-center hover:border-[#f59e0b]/50 transition-colors cursor-pointer group"
              whileHover={{ scale: 1.02 }}
            >
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
              <Upload className="w-12 h-12 mx-auto mb-3 text-gray-600 group-hover:text-[#f59e0b] transition-colors" />
              <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
                Drag & Drop CSV File Here (with url / image_url column)
              </p>
              <p className="text-gray-600 mt-1" style={{ fontSize: '0.875rem' }}>
                or click to browse
              </p>
            </motion.div>
          </div>
        </div>

        {/* Loading State */}
        <AnimatePresence>
          {isExtracting && (
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
                Extracting Assets...
              </h3>
              <p className="text-gray-400">
                Crawling portfolio and analyzing creative DNA
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Extracted Images Grid */}
        <AnimatePresence>
          {showImages && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl">
                <h2 className="text-white font-semibold mb-4" style={{ fontSize: '1.25rem' }}>
                  Extracted Assets ({extractedImages.length})
                </h2>
                <p className="text-gray-400 mb-6" style={{ fontSize: '0.875rem' }}>
                  Select images to reverse engineer their creative DNA
                </p>

                <div className="grid grid-cols-4 gap-4">
                  {extractedImages.map((img, index) => {
                    const isSelected = selectedImages.includes(index);
                    return (
                      <motion.div
                        key={img.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => toggleImageSelection(index)}
                        className={`relative aspect-square bg-gradient-to-br from-[#161d2f] to-[#0a0f1d] rounded-lg cursor-pointer transition-all group overflow-hidden ${
                          isSelected
                            ? "ring-4 ring-[#0ea5e9] shadow-[0_0_20px_rgba(14,165,233,0.5)]"
                            : "hover:ring-2 hover:ring-[#0ea5e9]/50"
                        }`}
                      >
                        {img.url && (img.url.startsWith("http") ? (
                          <img src={img.url} alt={img.title || ""} className="w-full h-full object-cover" />
                        ) : null)}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg flex items-center justify-center">
                          {!isSelected && (
                            <Plus className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute inset-0 bg-[#0ea5e9]/20 rounded-lg flex items-center justify-center"
                          >
                            <div className="w-12 h-12 bg-[#0ea5e9] rounded-full flex items-center justify-center">
                              <Check className="w-8 h-8 text-white" />
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Selection Bar */}
              <AnimatePresence>
                {selectedImages.length > 0 && (
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
                  >
                    <div className="bg-[#0a0f1d] border border-[#0ea5e9] rounded-xl px-8 py-4 shadow-2xl backdrop-blur-xl flex items-center gap-6">
                      <span className="text-white font-bold">
                        {selectedImages.length} Asset{selectedImages.length > 1 ? "s" : ""} Selected
                      </span>
                      <motion.button
                        onClick={handleExtractDNA}
                        className="px-8 py-3 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 rounded-lg text-white font-bold transition-all shadow-[0_0_30px_rgba(245,158,11,0.5)]"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        EXTRACT DNA & REBUILD AS PROMPTS
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {showPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <PromptTable prompts={prompts.length ? prompts : [{ id: 1, scene: "No prompts.", style: "", lighting: "" }]} />
          </motion.div>
        )}
      </div>
    </div>
  );
}