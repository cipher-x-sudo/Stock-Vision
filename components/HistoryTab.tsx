import React, { useState } from 'react';
import { useHistory } from '../contexts/HistoryContext';
import TrendChart from './TrendChart';
import { HistoryItem } from '../types';

const HistoryTab: React.FC = () => {
    const { history, deleteFromHistory, clearHistory } = useHistory();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const selectedItem = history.find(item => item.id === selectedId) || history[0]; // Default to first if none selected

    // Helper functions for export (recreated here for history items)
    const handleExportJSON = (item: HistoryItem) => {
        if (!item.prompts || item.prompts.length === 0) return;
        const slug = (item.analysis?.brief?.event ?? "event").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
        const lines = item.prompts.map(p => JSON.stringify(p)).join("\n");
        const blob = new Blob([lines], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prompts-${slug}-${new Date(item.timestamp).toISOString().slice(0, 10)}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportTXT = (item: HistoryItem) => {
        if (!item.prompts || item.prompts.length === 0) return;
        const slug = (item.analysis?.brief?.event ?? "event").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
        const lines = item.prompts.map((p, i) => [
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
        a.download = `prompts-${slug}-${new Date(item.timestamp).toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };


    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
                <i className="fa-solid fa-clock-rotate-left text-4xl mb-4 text-slate-600"></i>
                <h3 className="text-xl font-bold text-slate-400">No Scan History</h3>
                <p className="text-sm">Run a deep scan to see it here.</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6">
            {/* Sidebar List */}
            <aside className="w-1/4 min-w-[300px] flex flex-col bg-[#161d2f]/50 border border-white/5 rounded-[2rem] overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#161d2f]">
                    <h3 className="text-lg font-black uppercase text-white">Recent Scans</h3>
                    <button
                        onClick={() => { if (window.confirm('Clear all history?')) clearHistory(); }}
                        className="text-xs text-rose-500 hover:text-rose-400 font-bold uppercase transition-colors"
                    >
                        Clear All
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {history.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedId(item.id)}
                            className={`p-4 rounded-xl cursor-pointer border transition-all group relative ${selectedItem?.id === item.id || (selectedItem?.id === undefined && item === history[0])
                                    ? 'bg-sky-500/10 border-sky-500/50 shadow-lg shadow-sky-500/10'
                                    : 'bg-[#0a0f1d] border-white/5 hover:border-white/10'
                                }`}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteFromHistory(item.id); }}
                                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                                title="Delete"
                            >
                                <i className="fa-solid fa-xmark text-xs"></i>
                            </button>

                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {new Date(item.timestamp).toLocaleDateString()}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <h4 className={`font-bold text-sm line-clamp-2 ${selectedItem?.id === item.id ? 'text-sky-400' : 'text-slate-200 group-hover:text-sky-400'
                                }`}>
                                {item.query}
                            </h4>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="px-2 py-1 rounded bg-white/5 text-[10px] text-slate-400 font-bold flex items-center">
                                    <i className="fa-regular fa-image mr-1.5"></i> {item.marketData.length}
                                </span>
                                {item.prompts && item.prompts.length > 0 && (
                                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-[10px] text-emerald-400 font-bold flex items-center">
                                        <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i> {item.prompts.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 bg-[#161d2f]/30 border border-white/5 rounded-[2.5rem] overflow-y-auto p-8 custom-scrollbar">
                {selectedItem && (
                    <div className="space-y-16 animate-in fade-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="border-b border-white/5 pb-8">
                            <h2 className="text-5xl font-black uppercase tracking-tighter italic text-white mb-4">
                                {selectedItem.query}
                            </h2>
                            <div className="flex items-center gap-4 text-slate-400 text-sm">
                                <span><i className="fa-regular fa-calendar mr-2"></i> {new Date(selectedItem.timestamp).toLocaleString()}</span>
                                <span>•</span>
                                <span>ID: {selectedItem.id.slice(0, 8)}</span>
                            </div>
                        </div>

                        {/* Analysis Section */}
                        {selectedItem.analysis && (
                            <div className="space-y-12">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 bg-[#0d1425] p-8 rounded-[2rem] border border-white/5">
                                        <h3 className="text-xl font-black tracking-tight uppercase italic text-white mb-6">Market Gap Analysis</h3>
                                        {/* Pass data to TrendChart - Ensure TrendChart handles data gracefully if empty */}
                                        <TrendChart data={selectedItem.analysis.trends} />
                                    </div>
                                    <div className="bg-[#161d2f] p-8 rounded-[2rem] border border-sky-500/20">
                                        <h3 className="text-xl font-black mb-6 flex items-center italic uppercase text-white">
                                            <i className="fa-solid fa-fire text-amber-400 mr-3"></i> Top Sellers
                                        </h3>
                                        <div className="space-y-3">
                                            {selectedItem.analysis.brief.bestSellers.map((item, i) => (
                                                <div key={i} className="flex items-start space-x-3 p-3 rounded-xl bg-[#0a0f1d] border border-white/5">
                                                    <span className="text-sm font-black text-sky-500/60 mt-0.5">#{i + 1}</span>
                                                    <p className="text-xs font-medium text-slate-200 leading-relaxed">{item}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Shot List */}
                                <div>
                                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white mb-6">
                                        <i className="fa-solid fa-lightbulb text-amber-400 mr-3"></i> Suggested Concepts
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {selectedItem.analysis.brief.shotList.map((item, i) => (
                                            <div key={i} className="bg-[#161d2f] p-6 rounded-[2rem] border border-white/5">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[10px] font-black uppercase px-2 py-1 bg-sky-500/10 text-sky-400 rounded-md tracking-widest">
                                                        {item.type}
                                                    </span>
                                                    <span className="text-slate-600 text-[10px] font-bold">#{i + 1}</span>
                                                </div>
                                                <h4 className="font-bold text-lg text-slate-100 mb-2 leading-tight">{item.idea}</h4>
                                                <p className="text-xs text-slate-400 leading-relaxed mb-3">{item.description}</p>
                                                <div className="flex items-start gap-2 p-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                                                    <i className="fa-solid fa-chart-line text-emerald-400 text-[10px] mt-0.5"></i>
                                                    <p className="text-[10px] text-emerald-300 font-medium leading-relaxed">{item.whyItWorks}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Prompts Section */}
                        {selectedItem.prompts && selectedItem.prompts.length > 0 && (
                            <section className="bg-[#0d1425] p-8 rounded-[2.5rem] border border-sky-500/20">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-black flex items-center italic uppercase text-white">
                                        <i className="fa-solid fa-wand-magic-sparkles text-amber-400 mr-3"></i>
                                        Generated Prompts
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleExportJSON(selectedItem)}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-black text-xs uppercase tracking-widest text-white transition-all"
                                        >
                                            <i className="fa-solid fa-file-code mr-2"></i> JSONL
                                        </button>
                                        <button
                                            onClick={() => handleExportTXT(selectedItem)}
                                            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-black text-xs uppercase tracking-widest text-white transition-all"
                                        >
                                            <i className="fa-solid fa-file-lines mr-2"></i> TXT
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#161d2f]/50">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="bg-[#161d2f] text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                                <th className="px-4 py-3 w-10">#</th>
                                                <th className="px-4 py-3">Scene</th>
                                                <th className="px-4 py-3">Style</th>
                                                <th className="px-4 py-3">Composition</th>
                                                <th className="px-4 py-3">Lens</th>
                                                <th className="px-4 py-3">Lighting</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedItem.prompts.map((p, i) => (
                                                <tr key={i} className="border-t border-white/5 hover:bg-[#161d2f] transition-colors">
                                                    <td className="px-4 py-3 text-sky-500 font-black">{i + 1}</td>
                                                    <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate" title={p.scene}>{p.scene || "—"}</td>
                                                    <td className="px-4 py-3 text-slate-300 max-w-[120px] truncate" title={p.style}>{p.style || "—"}</td>
                                                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate" title={p.shot?.composition}>{p.shot?.composition || "—"}</td>
                                                    <td className="px-4 py-3 text-slate-400 max-w-[80px] truncate" title={p.shot?.lens}>{p.shot?.lens || "—"}</td>
                                                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate" title={p.lighting?.primary}>{p.lighting?.primary || "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}


                        {/* Market Evidence Section */}
                        {selectedItem.marketData && selectedItem.marketData.length > 0 && (
                            <section>
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-6">Market Evidence</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {selectedItem.marketData.map((img, idx) => (
                                        <div key={img.id || idx} className="bg-[#161d2f] rounded-xl overflow-hidden group border border-white/5 hover:border-sky-500/30 transition-all flex flex-col">
                                            <div className="relative aspect-video bg-[#0d1425] overflow-hidden">
                                                <img
                                                    src={img.thumbnailUrl}
                                                    alt={img.title}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                                />
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    {img.isAI && <span className="px-1.5 py-0.5 bg-violet-600 rounded text-[8px] font-black text-white uppercase">AI</span>}
                                                    <span className="px-1.5 py-0.5 bg-emerald-500 rounded text-[8px] font-black text-white">{img.downloads}</span>
                                                </div>
                                            </div>
                                            <div className="p-3">
                                                <h4 className="font-bold text-xs text-slate-200 line-clamp-1 mb-1">{img.title}</h4>
                                                <div className="flex justify-between text-[10px] text-slate-500">
                                                    <span>{img.mediaType}</span>
                                                    <span>{img.dimensions || '—'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
                {!selectedItem && (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Select a scan to view details
                    </div>
                )}
            </main>
        </div>
    );
};

export default HistoryTab;
