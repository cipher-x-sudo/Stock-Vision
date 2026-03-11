import { useState } from "react";
import { Zap } from "lucide-react";
import { motion } from "motion/react";
import * as Slider from "@radix-ui/react-slider";
import * as Select from "@radix-ui/react-select";
import { PromptTable } from "../PromptTable";
import { api, mapApiPromptsToRows } from "@/services/api";
import { toast } from "sonner";

const aestheticOptions = [
  "Cinematic",
  "Macro Photography",
  "3D Render",
  "Oil Painting",
  "Minimalist",
  "Cyberpunk",
  "Vintage Film",
  "Abstract",
  "Hyperrealistic",
  "Watercolor",
];

export function Conceptualize() {
  const [concept, setConcept] = useState("");
  const [aiModel, setAiModel] = useState("deep");
  const [volume, setVolume] = useState([50]);
  const [selectedAesthetics, setSelectedAesthetics] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [prompts, setPrompts] = useState<Array<{ id: number; scene: string; style: string; lighting: string }>>([]);

  const toggleAesthetic = (aesthetic: string) => {
    setSelectedAesthetics((prev) =>
      prev.includes(aesthetic)
        ? prev.filter((a) => a !== aesthetic)
        : [...prev, aesthetic]
    );
  };

  const handleConceptualize = async () => {
    setIsGenerating(true);
    setShowPrompts(false);
    try {
      const count = Math.min(Math.max(volume[0], 1), 100);
      const { prompts: p } = await api.generateIdeaPrompts({ idea: concept.trim(), count });
      setPrompts(mapApiPromptsToRows(p ?? []));
      setShowPrompts(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conceptualize failed");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050810] p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-white font-bold tracking-tight mb-2" style={{ fontSize: '2.5rem', fontFamily: 'Space Grotesk', fontStyle: 'italic' }}>
            Conceptualize
          </h1>
          <p className="text-gray-400" style={{ fontSize: '1.125rem' }}>
            Raw text-to-prompts transformation engine
          </p>
        </div>

        {/* Main Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-8 backdrop-blur-xl"
        >
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Describe a vague concept, emotion, or scene..."
            className="w-full h-48 px-6 py-4 bg-[#161d2f]/50 border border-[#161d2f] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ea5e9] focus:shadow-[0_0_30px_rgba(14,165,233,0.3)] transition-all resize-none"
            style={{ fontSize: '1.25rem', lineHeight: '1.8' }}
          />
        </motion.div>

        {/* Parameter Bar */}
        <div className="bg-[#0a0f1d]/50 border border-[#161d2f] rounded-xl p-6 backdrop-blur-xl space-y-6">
          {/* AI Model Selection */}
          <div>
            <label className="block text-white font-medium mb-3">AI Model</label>
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                onClick={() => setAiModel("fast")}
                className={`px-6 py-3 rounded-lg border transition-all ${
                  aiModel === "fast"
                    ? "bg-[#0ea5e9]/20 border-[#0ea5e9] text-[#0ea5e9]"
                    : "bg-[#161d2f]/30 border-[#161d2f] text-gray-400 hover:border-[#0ea5e9]/50"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="font-bold mb-1">Fast Generation</div>
                <div className="text-xs opacity-75">Optimized for speed</div>
              </motion.button>
              
              <motion.button
                onClick={() => setAiModel("deep")}
                className={`px-6 py-3 rounded-lg border transition-all ${
                  aiModel === "deep"
                    ? "bg-[#8b5cf6]/20 border-[#8b5cf6] text-[#8b5cf6]"
                    : "bg-[#161d2f]/30 border-[#161d2f] text-gray-400 hover:border-[#8b5cf6]/50"
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="font-bold mb-1">Deep Detail</div>
                <div className="text-xs opacity-75">Maximum quality</div>
              </motion.button>
            </div>
          </div>

          {/* Volume Slider */}
          <div>
            <label className="block text-white font-medium mb-3">
              Prompt Volume: <span className="text-[#0ea5e9]">{volume[0]}</span>
            </label>
            <Slider.Root
              value={volume}
              onValueChange={setVolume}
              min={10}
              max={100}
              step={5}
              className="relative flex items-center w-full h-5"
            >
              <Slider.Track className="bg-[#161d2f] relative grow rounded-full h-2">
                <Slider.Range className="absolute bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] rounded-full h-full" />
              </Slider.Track>
              <Slider.Thumb className="block w-5 h-5 bg-white rounded-full shadow-lg hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]" />
            </Slider.Root>
            <div className="flex justify-between mt-2 text-gray-500" style={{ fontSize: '0.75rem' }}>
              <span>10</span>
              <span>100</span>
            </div>
          </div>

          {/* Aesthetic Chips */}
          <div>
            <label className="block text-white font-medium mb-3">Aesthetic Tags</label>
            <div className="flex flex-wrap gap-2">
              {aestheticOptions.map((aesthetic) => (
                <motion.button
                  key={aesthetic}
                  onClick={() => toggleAesthetic(aesthetic)}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    selectedAesthetics.includes(aesthetic)
                      ? "bg-[#0ea5e9] border-[#0ea5e9] text-white shadow-[0_0_15px_rgba(14,165,233,0.5)]"
                      : "bg-[#161d2f]/30 border-[#161d2f] text-gray-400 hover:border-[#0ea5e9]/50"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {aesthetic}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Trigger Button */}
        <motion.div className="flex justify-center">
          <motion.button
            onClick={handleConceptualize}
            disabled={!concept.trim()}
            className="px-16 py-6 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-all shadow-[0_0_40px_rgba(245,158,11,0.5)] flex items-center gap-3"
            whileHover={concept.trim() ? { scale: 1.05 } : {}}
            whileTap={concept.trim() ? { scale: 0.98 } : {}}
            style={{ fontSize: '1.25rem' }}
          >
            <Zap className="w-6 h-6" />
            CONCEPTUALIZE
          </motion.button>
        </motion.div>

        {/* Loading State */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0a0f1d] border border-[#8b5cf6] rounded-xl p-12 text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto mb-4 border-4 border-[#8b5cf6] border-t-transparent rounded-full"
            />
            <h3 className="text-white font-bold mb-2" style={{ fontSize: '1.5rem' }}>
              Expanding Concept...
            </h3>
            <p className="text-gray-400">
              Generating {volume[0]} unique variations
            </p>
          </motion.div>
        )}

        {/* Results */}
        {showPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <PromptTable prompts={prompts.length ? prompts : [{ id: 1, scene: "No prompts generated.", style: "", lighting: "" }]} />
          </motion.div>
        )}
      </div>
    </div>
  );
}