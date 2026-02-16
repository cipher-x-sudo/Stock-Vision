import React, { useState, useCallback } from 'react';
import { StockInsight, ImagePrompt } from '../types';
import { searchTrackAdobe } from '../services/trackAdobeService';

interface CloningModeProps {
    onPromptsGenerated: (prompts: ImagePrompt[]) => void;
}

const CloningMode: React.FC<CloningModeProps> = ({ onPromptsGenerated }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<StockInsight[]>([]);
    const [cloning, setCloning] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        setResults([]);
        try {
            // Search 1 page, generic content
            const res = await searchTrackAdobe(query, 1, false, 'all');
            // Sort by downloads desc to find "Viral"
            const sorted = res.images.sort((a, b) => {
                const dA = parseInt(String(a.downloads).replace(/\D/g, '')) || 0;
                const dB = parseInt(String(b.downloads).replace(/\D/g, '')) || 0;
                return dB - dA;
            });
            setResults(sorted);
        } catch (err: any) {
            setError("Search failed: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [query]);

    const handleClone = useCallback(async (imagesToClone: StockInsight[]) => {
        if (imagesToClone.length === 0) return;
        setCloning(true);
        setError(null);
        setStatus(`Analyzing ${imagesToClone.length} images with Vision AI...`);

        try {
            // Map to simplified objects for backend
            const payload = imagesToClone.map(img => ({
                url: img.thumbnailUrl,
                title: img.title,
                id: img.id
            }));

            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/generate-cloning-prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: payload })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || response.statusText);
            }

            const data = await response.json();
            if (data.prompts && Array.isArray(data.prompts)) {
                onPromptsGenerated(data.prompts);
            }
        } catch (err: any) {
            setError("Cloning failed: " + err.message);
        } finally {
            setCloning(false);
            setStatus('');
        }
    }, [onPromptsGenerated]);

    return (
        <div className="space-y-12 animate-in fade-in zoom-in duration-500">
            <div className="text-center space-y-4">
                <h2 className="text-6xl font-black uppercase tracking-tighter italic text-white leading-none">
                    <span className="text-pink-500">Viral</span> Cloning
                </h2>
                <p className="text-slate-400 font-medium text-lg">
                    Find high-performing stock assets and clone their style using Vision AI.
                </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto relative group">
                <div className="absolute inset-0 bg-pink-500/20 blur-3xl group-focus-within:bg-pink-500/40 transition-all rounded-full opacity-50"></div>
                <div className="relative bg-[#0d1425] rounded-[2.5rem] p-2 flex items-center border-2 border-[#1a2333] group-focus-within:border-pink-500/50 transition-all shadow-2xl">
                    <div className="px-8 text-slate-500 group-focus-within:text-pink-400 transition-colors">
                        <i className="fa-solid fa-dna text-2xl"></i>
                    </div>
                    <input
                        type="text"
                        placeholder="Search viral niche (e.g. 'cats', 'business', 'cyberpunk')..."
                        className="flex-1 bg-transparent py-6 text-2xl outline-none font-semibold placeholder:text-slate-700 text-pink-100"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading || cloning}
                        className="bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 px-12 py-5 rounded-[2rem] font-black transition-all text-sm uppercase tracking-widest text-white shadow-lg shadow-pink-500/30 flex items-center space-x-3 active:scale-95"
                    >
                        {loading ? <i className="fa-solid fa-circle-notch fa-spin text-lg"></i> : <span>FIND BEST</span>}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="max-w-3xl mx-auto p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-center font-medium">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                    {error}
                </div>
            )}

            {/* Status Indicator */}
            {status && (
                <div className="text-center">
                    <p className="text-pink-400 font-black text-xs uppercase tracking-[0.5em] animate-pulse">{status}</p>
                </div>
            )}

            {/* Results Grid */}
            {results.length > 0 && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black uppercase tracking-widest text-white">
                            <i className="fa-solid fa-list-ol text-pink-500 mr-3"></i>
                            Top Performers
                        </h3>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => handleClone([results[0]])} // Clone Top 1
                                disabled={cloning}
                                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-amber-500/20 transition-all"
                            >
                                <i className="fa-solid fa-crown mr-2"></i> Clone #1 Best
                            </button>
                            <button
                                onClick={() => handleClone(results.slice(0, 5))} // Clone Top 5
                                disabled={cloning}
                                className="px-6 py-3 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest text-slate-300 transition-all"
                            >
                                <i className="fa-solid fa-layer-group mr-2"></i> Clone Top 5
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {results.map((img, idx) => (
                            <div key={img.id} className={`relative group rounded-[2rem] overflow-hidden border transition-all ${idx === 0 ? 'border-amber-500 shadow-2xl shadow-amber-500/10 scale-105 z-10' : 'border-white/5 hover:border-pink-500/50'}`}>
                                <div className="aspect-square bg-[#0d1425] relative">
                                    <img
                                        src={img.thumbnailUrl}
                                        alt={img.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    {idx === 0 && (
                                        <div className="absolute top-4 left-4 px-3 py-1 bg-amber-500 text-white font-black text-[10px] uppercase rounded-lg shadow-lg">
                                            <i className="fa-solid fa-trophy mr-1"></i> #1 Viral
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-white text-xs font-bold line-clamp-1">{img.title}</p>
                                                <p className="text-slate-400 text-[10px] font-mono">{img.downloads} downloads</p>
                                            </div>
                                            <button
                                                onClick={() => handleClone([img])}
                                                disabled={cloning}
                                                className="w-8 h-8 rounded-full bg-pink-500 hover:bg-pink-400 flex items-center justify-center text-white transition-all shadow-lg"
                                                title="Clone this specific image"
                                            >
                                                <i className="fa-solid fa-dna text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CloningMode;
