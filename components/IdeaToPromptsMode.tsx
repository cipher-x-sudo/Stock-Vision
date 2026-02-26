import React, { useState } from 'react';
import { ImagePrompt } from '../types';
import { generateIdeaPrompts } from '../services/geminiService';

interface IdeaToPromptsModeProps {
    onPromptsGenerated: (prompts: ImagePrompt[]) => void;
}

const IdeaToPromptsMode: React.FC<IdeaToPromptsModeProps> = ({ onPromptsGenerated }) => {
    const [idea, setIdea] = useState<string>('');
    const [count, setCount] = useState<number>(10);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [prompts, setPrompts] = useState<ImagePrompt[]>([]);

    const handleGenerate = async () => {
        if (!idea.trim()) {
            setError("Please provide an idea first.");
            return;
        }
        if (count < 1 || count > 100) {
            setError("Please pick a number of prompts between 1 and 100.");
            return;
        }

        setLoading(true);
        setError(null);
        setPrompts([]);

        try {
            const result = await generateIdeaPrompts(idea, count);
            setPrompts(result);
        } catch (err: any) {
            setError(`Failed to generate prompts: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExportJSON = () => {
        if (prompts.length === 0) return;
        const slug = "idea-prompts";
        const lines = prompts.map(p => JSON.stringify(p)).join("\n");
        const blob = new Blob([lines], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prompts-${slug}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportTXT = () => {
        if (prompts.length === 0) return;
        const slug = "idea-prompts";
        const lines = prompts.map((p, i) => [
            `--- Prompt #${i + 1} ---`,
            `Scene: ${p.scene}`,
            `Style: ${p.style}`,
            `Composition: ${p.shot?.composition || "-"}`,
            `Resolution: ${p.shot?.resolution || "-"}`,
            `Lens: ${p.shot?.lens || "-"}`,
            `Lighting: ${p.lighting?.primary || "-"} / ${p.lighting?.secondary || "-"}`,
            `Colors: bg=${p.color_palette?.background || "-"}, ink=${p.color_palette?.ink_primary || "-"}`,
            `Tags: ${p.metadata?.tags?.join(", ") || "-"}`,
            ""
        ].join("\n")).join("\n");
        const blob = new Blob([lines], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prompts-${slug}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-500">

            {/* Header section */}
            <div className="text-center space-y-6">
                <h2 className="text-6xl font-black italic uppercase tracking-tighter text-white flex items-center justify-center gap-4">
                    <i className="fa-solid fa-lightbulb text-amber-400"></i>
                    Idea<span className="text-sky-400">Generator</span>
                </h2>
                <p className="text-slate-400 font-medium text-lg max-w-2xl mx-auto leading-relaxed">
                    Instantly transform any creative concept into highly detailed, studio-ready prompts. No market research, just pure imagination translated to Nano Banana Pro parameters.
                </p>
            </div>

            {/* Input container */}
            <div className="bg-[#0d1425] p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8">
                {error && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-300">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <label className="text-sm font-black text-sky-400 uppercase tracking-widest px-2">Core Concept</label>
                    <textarea
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="Describe your vision... e.g. 'A cyberpunk market bustling with android merchants, ultra high detail, neon lighting'"
                        className="w-full h-40 bg-[#161d2f] text-slate-100 placeholder-slate-600 rounded-3xl p-6 border border-white/5 focus:border-sky-500/50 outline-none resize-none transition-all text-lg leading-relaxed shadow-inner"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-6 items-end">
                    <div className="space-y-4 w-full sm:w-64">
                        <label className="text-sm font-black text-emerald-400 uppercase tracking-widest px-2">Yield Target</label>
                        <div className="relative">
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={count}
                                onChange={(e) => setCount(Number(e.target.value))}
                                className="w-full bg-[#161d2f] text-white rounded-2xl py-4 pl-6 pr-12 border border-white/5 focus:border-emerald-500/50 outline-none text-xl font-bold"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold uppercase">Prompts</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !idea.trim()}
                        className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl shadow-sky-500/20 active:scale-95 flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <><i className="fa-solid fa-circle-notch fa-spin"></i> Synthesizing Vision...</>
                        ) : (
                            <><i className="fa-solid fa-bolt"></i> Generate Prompts</>
                        )}
                    </button>
                </div>
            </div>

            {/* Results grid */}
            {prompts.length > 0 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-sky-500/20 text-sky-400 rounded-lg text-xs font-black tracking-widest uppercase">
                                {prompts.length} Generated
                            </span>
                            <h3 className="text-2xl font-black italic text-white uppercase tracking-tight">Prompt Arsenal</h3>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleExportJSON}
                                className="px-4 py-2 bg-[#161d2f] hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-file-code"></i> JSONL
                            </button>
                            <button
                                onClick={handleExportTXT}
                                className="px-4 py-2 bg-[#161d2f] hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-file-lines"></i> TXT
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-white/5 bg-[#0d1425] shadow-2xl">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-[#161d2f] text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                    <th className="px-6 py-4 w-12">#</th>
                                    <th className="px-6 py-4">Scene</th>
                                    <th className="px-6 py-4">Style</th>
                                    <th className="px-6 py-4">Composition</th>
                                    <th className="px-6 py-4">Lighting</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {prompts.map((p, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4 text-sky-500 font-black text-xs">{i + 1}</td>
                                        <td className="px-6 py-4 text-slate-200">
                                            <p className="line-clamp-2 leading-relaxed" title={p.scene}>{p.scene || "—"}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400">
                                            <p className="line-clamp-2 text-xs" title={p.style}>{p.style || "—"}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                            {p.shot?.composition || "—"} <br />
                                            <span className="text-[10px] uppercase opacity-50">{p.shot?.lens}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                            {p.lighting?.primary || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={() => onPromptsGenerated(prompts)}
                            className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-violet-500/20 transition-all flex items-center gap-3 active:scale-95"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                            Send to Image Studio ({prompts.length})
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default IdeaToPromptsMode;
