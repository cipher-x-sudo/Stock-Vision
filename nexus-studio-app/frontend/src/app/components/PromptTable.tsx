import { ArrowRight, Download } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";

interface Prompt {
  id: number;
  scene: string;
  style: string;
  lighting: string;
}

interface PromptTableProps {
  prompts: Prompt[];
  onSendToImageStudio?: (prompts: Prompt[]) => void;
  onSendToVideoStudio?: (prompts: Prompt[]) => void;
}

export function PromptTable({ prompts, onSendToImageStudio, onSendToVideoStudio }: PromptTableProps) {
  const navigate = useNavigate();

  const handleSendToImageStudio = () => {
    if (onSendToImageStudio) {
      onSendToImageStudio(prompts);
    }
    navigate("/image-studio", { state: { prompts } });
  };

  const handleSendToVideoStudio = () => {
    if (onSendToVideoStudio) {
      onSendToVideoStudio(prompts);
    }
    navigate("/video-studio", { state: { prompts } });
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify(prompts, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nexus-prompts.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <motion.button
          onClick={exportJSON}
          className="px-4 py-2 bg-[#161d2f]/50 hover:bg-[#161d2f] border border-[#161d2f] rounded-lg text-gray-300 hover:text-white transition-colors flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Download className="w-4 h-4" />
          <span>Export JSON</span>
        </motion.button>
        
        <motion.button
          onClick={handleSendToImageStudio}
          className="px-6 py-2 bg-gradient-to-r from-[#0ea5e9] to-[#0ea5e9]/80 hover:from-[#0ea5e9]/90 hover:to-[#0ea5e9]/70 rounded-lg text-white font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(14,165,233,0.4)]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowRight className="w-4 h-4" />
          <span>SEND TO IMAGE STUDIO</span>
        </motion.button>

        <motion.button
          onClick={handleSendToVideoStudio}
          className="px-6 py-2 bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6] hover:opacity-90 rounded-lg text-white font-medium transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowRight className="w-4 h-4" />
          <span>SEND TO VIDEO STUDIO</span>
        </motion.button>
      </div>

      {/* Table */}
      <div className="bg-[#0a0f1d] border border-[#161d2f] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#161d2f] bg-[#161d2f]/30">
                <th className="px-4 py-3 text-left text-[#0ea5e9] font-mono" style={{ fontSize: '0.875rem', width: '60px' }}>
                  #
                </th>
                <th className="px-4 py-3 text-left text-[#0ea5e9] font-mono" style={{ fontSize: '0.875rem' }}>
                  Scene Descriptor
                </th>
                <th className="px-4 py-3 text-left text-[#0ea5e9] font-mono" style={{ fontSize: '0.875rem' }}>
                  Style Paradigm
                </th>
                <th className="px-4 py-3 text-left text-[#0ea5e9] font-mono" style={{ fontSize: '0.875rem' }}>
                  Lighting Concept
                </th>
              </tr>
            </thead>
            <tbody>
              {prompts.map((prompt, index) => (
                <motion.tr
                  key={prompt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-[#161d2f]/50 hover:bg-[#161d2f]/20 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-500 font-mono" style={{ fontSize: '0.875rem' }}>
                    {String(prompt.id).padStart(3, "0")}
                  </td>
                  <td className="px-4 py-3 text-gray-300" style={{ fontSize: '0.875rem' }}>
                    {prompt.scene}
                  </td>
                  <td className="px-4 py-3 text-gray-300" style={{ fontSize: '0.875rem' }}>
                    {prompt.style}
                  </td>
                  <td className="px-4 py-3 text-gray-300" style={{ fontSize: '0.875rem' }}>
                    {prompt.lighting}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
