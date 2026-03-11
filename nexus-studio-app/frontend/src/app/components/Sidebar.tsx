import { Link, useLocation } from "react-router";
import { Radio, Lightbulb, Dna, Image, Film, Archive, Settings, Zap, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const modules = [
  { 
    path: "/", 
    icon: Radio, 
    label: "Market Pipeline",
    color: "#0ea5e9",
    gradient: "from-[#0ea5e9] to-[#06b6d4]"
  },
  { 
    path: "/conceptualize", 
    icon: Lightbulb, 
    label: "Conceptualize",
    color: "#f59e0b",
    gradient: "from-[#f59e0b] to-[#fb923c]"
  },
  { 
    path: "/dna-extraction", 
    icon: Dna, 
    label: "DNA Extraction",
    color: "#ec4899",
    gradient: "from-[#ec4899] to-[#8b5cf6]"
  },
  { 
    path: "/image-studio", 
    icon: Image, 
    label: "Image Studio",
    color: "#8b5cf6",
    gradient: "from-[#8b5cf6] to-[#a78bfa]"
  },
  { 
    path: "/video-studio", 
    icon: Film, 
    label: "Video Studio",
    color: "#d946ef",
    gradient: "from-[#d946ef] to-[#e879f9]"
  },
  { 
    path: "/archive", 
    icon: Archive, 
    label: "The Archive",
    color: "#6366f1",
    gradient: "from-[#6366f1] to-[#818cf8]"
  },
];

interface SidebarProps {
  onOpenSettings: () => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export function Sidebar({ onOpenSettings, mobileMenuOpen, onCloseMobileMenu }: SidebarProps) {
  const location = useLocation();
  
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[280px] h-full bg-gradient-to-b from-[#0a0f1d] via-[#050810] to-[#0a0f1d] border-r border-[#161d2f]/50 flex-col relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6]/5 via-transparent to-[#0ea5e9]/5 opacity-50" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Brand Header */}
          <div className="h-20 flex items-center px-6 border-b border-[#161d2f]/50">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] rounded-xl"
                  animate={{ rotate: [0, 180, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-[2px] bg-[#050810] rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#0ea5e9]" />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-white text-sm leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                  NEXUS
                </h1>
                <p className="text-[#0ea5e9] text-xs font-semibold leading-none mt-0.5" style={{ fontFamily: 'Space Grotesk' }}>
                  STUDIO
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Modules */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-2">
              {modules.map((module, index) => {
                const Icon = module.icon;
                const isActive = location.pathname === module.path;
                
                return (
                  <Link key={module.path} to={module.path}>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group"
                    >
                      <div className={`
                        relative px-4 py-3.5 rounded-xl transition-all cursor-pointer overflow-hidden
                        ${isActive 
                          ? 'bg-[#161d2f] shadow-lg' 
                          : 'hover:bg-[#161d2f]/30'
                        }
                      `}>
                        {/* Active gradient border */}
                        {isActive && (
                          <motion.div
                            layoutId="activeBorder"
                            className={`absolute inset-0 rounded-xl bg-gradient-to-r ${module.gradient} opacity-20`}
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        
                        {/* Left accent line */}
                        <motion.div
                          className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b ${module.gradient}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: isActive ? 1 : 0 }}
                          transition={{ duration: 0.3 }}
                        />

                        <div className="relative flex items-center gap-3">
                          {/* Icon with glow */}
                          <div className="relative">
                            <Icon 
                              className={`w-5 h-5 transition-all ${
                                isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'
                              }`} 
                              style={isActive ? { filter: `drop-shadow(0 0 8px ${module.color})` } : {}}
                            />
                          </div>
                          
                          {/* Label */}
                          <span className={`font-semibold text-sm transition-all ${
                            isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'
                          }`}>
                            {module.label}
                          </span>

                          {/* Arrow indicator */}
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="ml-auto"
                            >
                              <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${module.gradient}`} />
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="p-4 border-t border-[#161d2f]/50 space-y-3">
            {/* Status Card */}
            <div className="px-4 py-3 bg-gradient-to-br from-[#161d2f]/50 to-[#161d2f]/20 rounded-xl border border-[#10b981]/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-[#10b981]"
                    animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <span className="text-[#10b981] font-bold text-xs">SYSTEMS ONLINE</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 h-1 bg-[#0a0f1d] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#10b981] to-[#34d399]"
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
                <span className="text-gray-500 font-mono">100%</span>
              </div>
            </div>

            {/* Settings Button */}
            <motion.button
              onClick={onOpenSettings}
              className="w-full px-4 py-3 bg-[#161d2f]/30 hover:bg-[#161d2f]/60 rounded-xl transition-all flex items-center gap-3 text-gray-400 hover:text-white group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-semibold text-sm">Settings</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobileMenu}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
            />

            {/* Sidebar Drawer */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-gradient-to-b from-[#0a0f1d] via-[#050810] to-[#0a0f1d] border-r border-[#161d2f]/50 z-50 flex flex-col md:hidden"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6]/5 via-transparent to-[#0ea5e9]/5 opacity-50" />
              
              {/* Content */}
              <div className="relative z-10 flex flex-col h-full">
                {/* Brand Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-[#161d2f]/50">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#0ea5e9] to-[#8b5cf6] rounded-xl" />
                      <div className="absolute inset-[2px] bg-[#050810] rounded-xl flex items-center justify-center">
                        <Zap className="w-5 h-5 text-[#0ea5e9]" />
                      </div>
                    </div>
                    <div>
                      <h1 className="font-bold text-white text-sm leading-none" style={{ fontFamily: 'Space Grotesk' }}>
                        NEXUS
                      </h1>
                      <p className="text-[#0ea5e9] text-xs font-semibold leading-none mt-0.5" style={{ fontFamily: 'Space Grotesk' }}>
                        STUDIO
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onCloseMobileMenu}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-2">
                    {modules.map((module) => {
                      const Icon = module.icon;
                      const isActive = location.pathname === module.path;
                      
                      return (
                        <Link key={module.path} to={module.path} onClick={onCloseMobileMenu}>
                          <div className={`
                            relative px-4 py-3.5 rounded-xl transition-all cursor-pointer overflow-hidden
                            ${isActive 
                              ? 'bg-[#161d2f] shadow-lg' 
                              : 'hover:bg-[#161d2f]/30'
                            }
                          `}>
                            {isActive && (
                              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${module.gradient} opacity-20`} />
                            )}
                            
                            <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b ${module.gradient} ${
                              isActive ? 'opacity-100' : 'opacity-0'
                            }`} />

                            <div className="relative flex items-center gap-3">
                              <Icon 
                                className={`w-5 h-5 transition-all ${
                                  isActive ? 'text-white' : 'text-gray-500'
                                }`} 
                                style={isActive ? { filter: `drop-shadow(0 0 8px ${module.color})` } : {}}
                              />
                              <span className={`font-semibold text-sm transition-all ${
                                isActive ? 'text-white' : 'text-gray-400'
                              }`}>
                                {module.label}
                              </span>
                              {isActive && (
                                <div className="ml-auto">
                                  <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${module.gradient}`} />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                {/* Bottom Section */}
                <div className="p-4 border-t border-[#161d2f]/50 space-y-3">
                  <div className="px-4 py-3 bg-gradient-to-br from-[#161d2f]/50 to-[#161d2f]/20 rounded-xl border border-[#10b981]/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-[#10b981]" />
                        <div className="absolute inset-0 rounded-full bg-[#10b981] animate-ping opacity-50" />
                      </div>
                      <span className="text-[#10b981] font-bold text-xs">SYSTEMS ONLINE</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex-1 h-1 bg-[#0a0f1d] rounded-full overflow-hidden">
                        <div className="h-full w-full bg-gradient-to-r from-[#10b981] to-[#34d399]" />
                      </div>
                      <span className="text-gray-500 font-mono">100%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onOpenSettings();
                      onCloseMobileMenu();
                    }}
                    className="w-full px-4 py-3 bg-[#161d2f]/30 hover:bg-[#161d2f]/60 rounded-xl transition-all flex items-center gap-3 text-gray-400 hover:text-white"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="font-semibold text-sm">Settings</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}