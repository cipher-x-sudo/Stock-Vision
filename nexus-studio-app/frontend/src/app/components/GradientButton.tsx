import { motion } from "motion/react";
import { ReactNode } from "react";

interface GradientButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  icon?: ReactNode;
}

export function GradientButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  icon,
}: GradientButtonProps) {
  const gradientClass =
    variant === "primary"
      ? "bg-gradient-to-r from-[#f59e0b] to-[#8b5cf6]"
      : "bg-gradient-to-r from-[#0ea5e9] to-[#0ea5e9]/80";

  const shadowClass =
    variant === "primary"
      ? "shadow-[0_0_30px_rgba(245,158,11,0.5)]"
      : "shadow-[0_0_20px_rgba(14,165,233,0.4)]";

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-3 ${gradientClass} hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all ${shadowClass} flex items-center justify-center gap-2 ${className}`}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {icon}
      {children}
    </motion.button>
  );
}
