import { motion } from "motion/react";
import { Radio } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#050810] flex items-center justify-center z-50">
      <div className="text-center">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative mb-8 mx-auto w-24 h-24"
        >
          <Radio className="w-24 h-24 text-[#0ea5e9]" />
          <div className="absolute inset-0 blur-2xl bg-[#0ea5e9] opacity-50" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white font-bold tracking-tighter mb-4"
          style={{ fontSize: '2.5rem' }}
        >
          <span className="text-white">NEXUS</span>
          <span className="text-[#0ea5e9]"> STUDIO</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400"
        >
          <p>Initializing Creative Intelligence Suite...</p>
        </motion.div>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="mt-8 h-1 bg-gradient-to-r from-[#0ea5e9] via-[#f59e0b] to-[#8b5cf6] rounded-full mx-auto max-w-xs"
        />
      </div>
    </div>
  );
}
