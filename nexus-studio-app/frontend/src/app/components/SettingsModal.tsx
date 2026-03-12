import { X, Server, Key, Upload } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as Switch from "@radix-ui/react-switch";
import { useState, useEffect } from "react";
import { api } from "../../services/api";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"engine" | "keys">("engine");
  const [autoRouting, setAutoRouting] = useState(true);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [flowAuth, setFlowAuth] = useState<{ ready: boolean; projectId: string | null; hasToken: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    api.health()
      .then((res) => setBackendOk(res?.ok ?? false))
      .catch(() => setBackendOk(false));
    api.flowAuthStatus()
      .then((res) => setFlowAuth({ ready: res.ready, projectId: res.projectId ?? null, hasToken: res.hasToken ?? false }))
      .catch(() => setFlowAuth(null));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            onClick={onClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl h-[600px] bg-[#0a0f1d]/95 backdrop-blur-xl border border-[#161d2f] rounded-2xl shadow-2xl flex overflow-hidden"
            >
              {/* Left Navigation */}
              <div className="w-[200px] bg-[#161d2f]/30 border-r border-[#161d2f] p-4">
                <button
                  onClick={() => setActiveTab("engine")}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-colors flex items-center gap-3 mb-2 ${
                    activeTab === "engine"
                      ? "bg-[#0ea5e9]/20 text-[#0ea5e9]"
                      : "text-gray-400 hover:bg-[#161d2f]/50 hover:text-white"
                  }`}
                >
                  <Server className="w-4 h-4" />
                  <span>Engine Router</span>
                </button>
                <button
                  onClick={() => setActiveTab("keys")}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-colors flex items-center gap-3 ${
                    activeTab === "keys"
                      ? "bg-[#0ea5e9]/20 text-[#0ea5e9]"
                      : "text-gray-400 hover:bg-[#161d2f]/50 hover:text-white"
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>Secure Keys</span>
                </button>
              </div>

              {/* Right Content */}
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#161d2f]">
                  <h2 className="text-white font-semibold" style={{ fontSize: '1.25rem' }}>
                    {activeTab === "engine" ? "Engine Router" : "Secure Keys"}
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-[#161d2f]/50 rounded-lg transition-colors text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeTab === "engine" && (
                    <div className="space-y-6">
                      {/* Backend & Flow status */}
                      <div className="flex flex-wrap gap-4">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${backendOk === true ? "bg-[#10b981]/10 border border-[#10b981]/30" : backendOk === false ? "bg-red-500/10 border border-red-500/30" : "bg-[#161d2f]/50 border border-[#161d2f]"}`}>
                          <div className={`w-2.5 h-2.5 rounded-full ${backendOk === true ? "bg-[#10b981]" : backendOk === false ? "bg-red-500" : "bg-gray-500 animate-pulse"}`} />
                          <span className={backendOk === true ? "text-[#10b981]" : backendOk === false ? "text-red-400" : "text-gray-400"} style={{ fontSize: "0.875rem" }}>
                            {backendOk === true ? "Backend connected" : backendOk === false ? "Backend offline" : "Checking…"}
                          </span>
                        </div>
                        {flowAuth !== null && (
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${flowAuth.ready ? "bg-[#10b981]/10 border border-[#10b981]/30" : "bg-[#f59e0b]/10 border border-[#f59e0b]/30"}`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${flowAuth.ready ? "bg-[#10b981]" : "bg-[#f59e0b]"}`} />
                            <span className={flowAuth.ready ? "text-[#10b981]" : "text-[#f59e0b]"} style={{ fontSize: "0.875rem" }}>
                              Flow: {flowAuth.ready ? (flowAuth.projectId ? `Project ${flowAuth.projectId.slice(0, 8)}…` : "Ready") : "Not ready"}
                              {flowAuth.hasToken && " • Token"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Primary Engine */}
                      <div className="bg-[#161d2f]/50 rounded-xl p-6 border border-[#0ea5e9]/20">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="p-3 bg-[#0ea5e9]/20 rounded-lg">
                            <Server className="w-8 h-8 text-[#0ea5e9]" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium mb-1">Primary Engine</h3>
                            <p className="text-gray-400" style={{ fontSize: '0.875rem' }}>
                              Main processing node for all generation tasks
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-gray-300 mb-2" style={{ fontSize: '0.875rem' }}>
                              Authentication Cookies
                            </label>
                            <div className="flex gap-2">
                              <button className="flex-1 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg text-gray-400 hover:text-white hover:border-[#0ea5e9]/50 transition-colors flex items-center justify-center gap-2">
                                <Upload className="w-4 h-4" />
                                <span style={{ fontSize: '0.875rem' }}>Upload Cookie File</span>
                              </button>
                            </div>
                          </div>

                          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${backendOk === true ? "bg-[#10b981]/10 border border-[#10b981]/30" : "bg-[#161d2f]/50 border border-[#161d2f]"}`}>
                            <div className={`w-3 h-3 rounded-full ${backendOk === true ? "bg-[#10b981] animate-pulse" : "bg-gray-500"}`} />
                            <span className={backendOk === true ? "text-[#10b981] font-medium" : "text-gray-400"} style={{ fontSize: '0.875rem' }}>
                              {backendOk === true ? "Backend connected" : backendOk === false ? "Backend offline" : "Checking backend…"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fallback Engine */}
                      <div className="bg-[#161d2f]/50 rounded-xl p-6 border border-[#f59e0b]/20">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="p-3 bg-[#f59e0b]/20 rounded-lg">
                            <Server className="w-8 h-8 text-[#f59e0b]" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-medium mb-1">Fallback Engine</h3>
                            <p className="text-gray-400" style={{ fontSize: '0.875rem' }}>
                              Backup node activated on primary timeout
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between px-4 py-3 bg-[#0a0f1d] border border-[#161d2f] rounded-lg">
                          <div>
                            <p className="text-white font-medium" style={{ fontSize: '0.875rem' }}>
                              Enable Auto-Routing
                            </p>
                            <p className="text-gray-500" style={{ fontSize: '0.75rem' }}>
                              Automatically switch to fallback on timeout
                            </p>
                          </div>
                          <Switch.Root
                            checked={autoRouting}
                            onCheckedChange={setAutoRouting}
                            className="w-11 h-6 bg-[#161d2f] rounded-full relative transition-colors data-[state=checked]:bg-[#0ea5e9]"
                          >
                            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[22px]" />
                          </Switch.Root>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "keys" && (
                    <div className="space-y-4">
                      <p className="text-gray-400" style={{ fontSize: '0.875rem' }}>
                        Connect external API keys to enhance generation capabilities
                      </p>

                      {["OpenAI", "Anthropic", "Stability AI", "Replicate"].map((service) => (
                        <div key={service} className="bg-[#161d2f]/50 rounded-xl p-4 border border-[#161d2f]">
                          <label className="block text-white mb-2 font-medium">
                            {service} API Key
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              placeholder="••••••••••••••••••••••••"
                              className="flex-1 px-4 py-2 bg-[#0a0f1d] border border-[#161d2f] rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ea5e9]/50"
                            />
                            <button className="px-4 py-2 bg-[#0ea5e9]/20 text-[#0ea5e9] rounded-lg hover:bg-[#0ea5e9]/30 transition-colors">
                              Test
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
