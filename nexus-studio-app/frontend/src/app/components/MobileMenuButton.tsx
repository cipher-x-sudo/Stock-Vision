import { Menu } from "lucide-react";
import { motion } from "motion/react";

interface MobileMenuButtonProps {
  onClick: () => void;
}

export function MobileMenuButton({ onClick }: MobileMenuButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      className="md:hidden fixed top-4 left-4 z-30 p-3 bg-[#0a0f1d] border border-[#161d2f] rounded-lg text-white shadow-lg hover:bg-[#161d2f]/80 transition-colors"
      whileTap={{ scale: 0.95 }}
    >
      <Menu className="w-5 h-5" />
    </motion.button>
  );
}
