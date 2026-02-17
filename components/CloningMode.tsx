import React, { useState, useCallback, useMemo } from 'react';
import { StockInsight, ImagePrompt, ScanConfig, ContentTypeFilter } from '../types';
import { searchTrackAdobeMultiplePages } from '../services/trackAdobeService';
import ScanConfigModal from './ScanConfigModal';

interface CloningModeProps {
    onPromptsGenerated: (prompts: ImagePrompt[]) => void;
}

type SortOrder = 'downloads' | 'date' | 'relevance';

// ── Image Detail Modal ────────────────────────────────────────
const ImageDetailModal: React.FC<{
    img: StockInsight;
    onClose: () => void;
    selected: boolean;
    onToggle: () => void;
    onClone: () => void;
    cloning: boolean;
}> = ({ img, onClose, selected, onToggle, onClone, cloning }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div
            className="relative bg-[#0d1425] rounded-[2.5rem] border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
        >
            <button onClick={onClose} className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                <i className="fa-solid fa-xmark text-lg" />
            </button>
            <div className="relative aspect-video bg-black/50 rounded-t-[2.5rem] overflow-hidden">
                <img src={img.thumbnailUrl} alt={img.title} className="w-full h-full object-contain" />
                {img.isAI && (
                    <span className="absolute top-4 left-4 px-3 py-1 bg-violet-600 rounded-lg text-[10px] font-black text-white uppercase">AI Generated</span>
                )}
            </div>
            <div className="p-8 space-y-6">
                <h3 className="text-2xl font-black text-white leading-tight">{img.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    {([
                        ['Downloads', img.downloads],
                        ['Creator', `${img.creator}${img.creatorId ? ` (${img.creatorId})` : ''}`],
                        ['Media Type', img.mediaType],
                        ['Category', img.category || '—'],
                        ['Content Type', img.contentType || '—'],
                        ['Dimensions', img.dimensions || '—'],
                        ['Upload Date', img.uploadDate ? String(img.uploadDate).slice(0, 10) : '—'],
                        ['Premium', img.premium || '—'],
                    ] as [string, string | number][]).map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-1 p-3 bg-[#161d2f] rounded-xl border border-white/5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                            <span className="text-slate-200 font-medium truncate">{value}</span>
                        </div>
                    ))}
                </div>
                {Array.isArray(img.keywords) && img.keywords.length > 0 && (
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                            {img.keywords.map((kw, i) => (
                                <span key={i} className="px-2.5 py-1 bg-[#161d2f] text-slate-300 rounded-lg text-xs border border-white/5">{kw}</span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex gap-3 pt-4 border-t border-white/5">
                    <button
                        onClick={onToggle}
                        className={`flex-1 px-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${selected
                            ? 'bg-pink-500/20 text-pink-400 border-2 border-pink-500'
                            : 'bg-[#161d2f] text-slate-300 border-2 border-white/10 hover:border-pink-500/50'
                            }`}
                    >
                        <i className={`fa-solid ${selected ? 'fa-check-circle' : 'fa-circle'} mr-2`} />
                        {selected ? 'Selected' : 'Select'}
                    </button>
                    <button
                        onClick={onClone}
                        disabled={cloning}
                        className="flex-1 px-6 py-3.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:opacity-50 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-pink-500/20 transition-all"
                    >
                        <i className="fa-solid fa-dna mr-2" />
                        Clone This
                    </button>
                </div>
            </div>
        </div>
    </div>
);


// ── Main Component ────────────────────────────────────────────
const CloningMode: React.FC<CloningModeProps> = ({ onPromptsGenerated }) => {
    // Search state
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<StockInsight[]>([]);
    const [searchInfo, setSearchInfo] = useState('');
    const [searchedOnce, setSearchedOnce] = useState(false);

    // Config modal state
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [lastConfig, setLastConfig] = useState<ScanConfig | null>(null);

    // Sort state (sort is client-side on already-fetched results)
    const [sortOrder, setSortOrder] = useState<SortOrder>('downloads');

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Cloning state
    const [cloning, setCloning] = useState(false);
    const [cloningProgress, setCloningProgress] = useState({ current: 0, total: 0 });
    const [status, setStatus] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState('');

    // Modal state
    const [detailImage, setDetailImage] = useState<StockInsight | null>(null);

    // ── Open config modal before searching ─────────────────────
    const handleSearchClick = useCallback(() => {
        if (!query.trim()) return;
        setShowConfigModal(true);
    }, [query]);

    // ── Execute search with config ────────────────────────────
    const executeSearch = useCallback(async (config: ScanConfig) => {
        setShowConfigModal(false);
        setLastConfig(config);
        setLoading(true);
        setError(null);
        setSuccessMsg('');
        setResults([]);
        setSelectedIds(new Set());
        setSearchedOnce(false);

        const startPage = config.startPage || 1;
        const endPage = config.endPage || 3;

        try {
            setStatus(`Scanning pages ${startPage}–${endPage}...`);
            const res = await searchTrackAdobeMultiplePages(
                query, startPage, endPage,
                config.aiOnly, config.contentType
            );

            let images = res.images;

            // Apply min downloads filter
            if (config.minDownloads > 0) {
                images = images.filter(img => {
                    const dl = typeof img.downloads === 'number'
                        ? img.downloads
                        : parseInt(String(img.downloads).replace(/\D/g, ''), 10) || 0;
                    return dl >= config.minDownloads;
                });
            }

            // Apply year range filter
            if (config.yearFrom || config.yearTo) {
                images = images.filter(img => {
                    if (!img.uploadDate) return false;
                    const year = new Date(img.uploadDate).getFullYear();
                    if (isNaN(year)) return false;
                    if (config.yearFrom && year < config.yearFrom) return false;
                    if (config.yearTo && year > config.yearTo) return false;
                    return true;
                });
            }

            setResults(images);
            const pageRange = startPage === endPage ? `page ${startPage}` : `pages ${startPage}–${endPage}`;
            setSearchInfo(`${images.length} results from ${pageRange} · ${config.aiOnly ? 'AI only' : 'All'} · ${config.contentType} · ≥${config.minDownloads} DLs`);
        } catch (err: any) {
            setError("Search failed: " + err.message);
        } finally {
            setLoading(false);
            setStatus('');
            setSearchedOnce(true);
        }
    }, [query]);

    // ── Sort ──────────────────────────────────────────────────
    const sortedResults = useMemo(() => {
        const copy = [...results];
        switch (sortOrder) {
            case 'downloads':
                return copy.sort((a, b) => {
                    const dA = parseInt(String(a.downloads).replace(/\D/g, '')) || 0;
                    const dB = parseInt(String(b.downloads).replace(/\D/g, '')) || 0;
                    return dB - dA;
                });
            case 'date':
                return copy.sort((a, b) => {
                    const dA = new Date(a.uploadDate || 0).getTime();
                    const dB = new Date(b.uploadDate || 0).getTime();
                    return dB - dA;
                });
            case 'relevance':
            default:
                return copy;
        }
    }, [results, sortOrder]);

    // ── Selection ─────────────────────────────────────────────
    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(sortedResults.map(r => r.id)));
    }, [sortedResults]);

    const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

    const selectedImages = useMemo(() =>
        sortedResults.filter(r => selectedIds.has(r.id)),
        [sortedResults, selectedIds]
    );

    // ── Clone ─────────────────────────────────────────────────
    const handleClone = useCallback(async (imagesToClone: StockInsight[]) => {
        if (imagesToClone.length === 0) return;
        const cloneSlice = imagesToClone.slice(0, 5);
        setCloning(true);
        setError(null);
        setSuccessMsg('');
        setCloningProgress({ current: 0, total: cloneSlice.length });
        setStatus(`Analyzing ${cloneSlice.length} image${cloneSlice.length > 1 ? 's' : ''} with Vision AI...`);

        try {
            const payload = cloneSlice.map(img => ({
                url: img.thumbnailUrl,
                title: img.title,
                id: img.id
            }));

            let progressIdx = 0;
            const progressInterval = setInterval(() => {
                progressIdx = Math.min(progressIdx + 1, cloneSlice.length);
                setCloningProgress({ current: progressIdx, total: cloneSlice.length });
                setStatus(`Analyzing image ${progressIdx} of ${cloneSlice.length}...`);
            }, 3000);

            const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/generate-cloning-prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: payload })
            });

            clearInterval(progressInterval);
            setCloningProgress({ current: cloneSlice.length, total: cloneSlice.length });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || response.statusText);
            }

            const data = await response.json();
            if (data.prompts && Array.isArray(data.prompts)) {
                onPromptsGenerated(data.prompts);
                setSuccessMsg(`✓ ${data.prompts.length} prompt${data.prompts.length > 1 ? 's' : ''} generated & sent to Image Studio!`);
            }
        } catch (err: any) {
            setError("Cloning failed: " + err.message);
        } finally {
            setCloning(false);
            setStatus('');
            setCloningProgress({ current: 0, total: 0 });
        }
    }, [onPromptsGenerated]);

    const progressPercent = cloningProgress.total > 0
        ? Math.round((cloningProgress.current / cloningProgress.total) * 100)
        : 0;

    return (
        <div className="space-y-10 animate-in fade-in zoom-in duration-500 pb-32">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="text-center space-y-4">
                <h2 className="text-6xl font-black uppercase tracking-tighter italic text-white leading-none">
                    <span className="text-pink-500">Viral</span> Cloning
                </h2>
                <p className="text-slate-400 font-medium text-lg">
                    Find high-performing stock assets and clone their style using Vision AI.
                </p>
            </div>

            {/* ── Search Bar ─────────────────────────────────── */}
            <div className="max-w-3xl mx-auto relative group">
                <div className="absolute inset-0 bg-pink-500/20 blur-3xl group-focus-within:bg-pink-500/40 transition-all rounded-full opacity-50" />
                <div className="relative bg-[#0d1425] rounded-[2.5rem] p-2 flex items-center border-2 border-[#1a2333] group-focus-within:border-pink-500/50 transition-all shadow-2xl">
                    <div className="px-8 text-slate-500 group-focus-within:text-pink-400 transition-colors">
                        <i className="fa-solid fa-dna text-2xl" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search viral niche (e.g. 'cats', 'business', 'cyberpunk')..."
                        className="flex-1 bg-transparent py-6 text-2xl outline-none font-semibold placeholder:text-slate-700 text-pink-100"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
                    />
                    <button
                        onClick={handleSearchClick}
                        disabled={loading || cloning || !query.trim()}
                        className="bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 px-12 py-5 rounded-[2rem] font-black transition-all text-sm uppercase tracking-widest text-white shadow-lg shadow-pink-500/30 flex items-center space-x-3 active:scale-95"
                    >
                        {loading ? <i className="fa-solid fa-circle-notch fa-spin text-lg" /> : <span>FIND BEST</span>}
                    </button>
                </div>
            </div>

            {/* ── Last Config Info Badge ──────────────────────── */}
            {lastConfig && !loading && results.length > 0 && (
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500">
                        <i className="fa-solid fa-sliders mr-2 text-pink-500/60" />
                        {searchInfo}
                    </p>
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="text-xs font-black uppercase tracking-widest text-pink-400 hover:text-pink-300 transition-colors"
                    >
                        <i className="fa-solid fa-gear mr-1" /> Re-configure
                    </button>
                </div>
            )}

            {/* ── No Results State ────────────────────────────── */}
            {searchedOnce && !loading && results.length === 0 && !error && (
                <div className="max-w-xl mx-auto text-center space-y-5 py-10 animate-in fade-in duration-300">
                    <div className="w-20 h-20 rounded-full bg-[#161d2f] flex items-center justify-center mx-auto border border-white/5">
                        <i className="fa-solid fa-ghost text-3xl text-slate-600" />
                    </div>
                    <h3 className="text-xl font-black text-white">No Results Found</h3>
                    <p className="text-slate-500 text-sm font-medium">
                        Try broadening your search: disable "AI Only", increase the page range, lower the minimum downloads, or use a different keyword.
                    </p>
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="px-6 py-3 bg-pink-600 hover:bg-pink-500 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-pink-500/20 transition-all"
                        >
                            <i className="fa-solid fa-gear mr-2" /> Re-configure & Retry
                        </button>
                    </div>
                </div>
            )}

            {/* ── Toolbar (Sort + Selection) ──────────────────── */}
            {sortedResults.length > 0 && (
                <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-4 px-2">
                    {/* Sort Order */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sort</span>
                        <select
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as SortOrder)}
                            className="bg-[#161d2f] text-slate-200 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider outline-none focus:border-pink-500/50 transition-all cursor-pointer appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '32px' }}
                        >
                            <option value="downloads">Downloads ↓</option>
                            <option value="date">Date (Newest)</option>
                            <option value="relevance">Relevance</option>
                        </select>
                    </div>

                    <div className="flex-1" />

                    {/* Selection Controls */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={selectedIds.size === sortedResults.length ? deselectAll : selectAll}
                            className="px-4 py-2 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-slate-300 transition-all"
                        >
                            <i className={`fa-solid ${selectedIds.size === sortedResults.length ? 'fa-square-minus' : 'fa-square-check'} mr-2`} />
                            {selectedIds.size === sortedResults.length ? 'Deselect All' : 'Select All'}
                        </button>
                        {selectedIds.size > 0 && (
                            <span className="px-3 py-1.5 bg-pink-500/20 text-pink-400 rounded-lg text-xs font-black">
                                {selectedIds.size} selected
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* ── Error Message ───────────────────────────────── */}
            {error && (
                <div className="max-w-3xl mx-auto p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-center font-medium">
                    <i className="fa-solid fa-triangle-exclamation mr-2" />
                    {error}
                </div>
            )}

            {/* ── Success Message ─────────────────────────────── */}
            {successMsg && (
                <div className="max-w-3xl mx-auto p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-200 text-center font-medium animate-in fade-in zoom-in duration-300">
                    <i className="fa-solid fa-check-circle mr-2" />
                    {successMsg}
                </div>
            )}

            {/* ── Loading / Cloning Progress ──────────────────── */}
            {(loading || cloning) && (
                <div className="max-w-xl mx-auto space-y-3 animate-in fade-in duration-300">
                    <p className="text-pink-400 font-black text-xs uppercase tracking-[0.5em] animate-pulse text-center">{status}</p>
                    <div className="w-full h-2.5 bg-[#161d2f] rounded-full overflow-hidden">
                        {cloning ? (
                            <div
                                className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${Math.max(progressPercent, 10)}%` }}
                            />
                        ) : (
                            <div className="h-full bg-pink-500 w-1/3 absolute animate-[progress_1.5s_infinite] rounded-full" />
                        )}
                    </div>
                    {cloning && (
                        <p className="text-center text-slate-500 text-xs font-bold">{cloningProgress.current} / {cloningProgress.total} images</p>
                    )}
                </div>
            )}

            {/* ── Results Grid ────────────────────────────────── */}
            {sortedResults.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black uppercase tracking-widest text-white">
                            <i className="fa-solid fa-list-ol text-pink-500 mr-3" />
                            Top Performers
                        </h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleClone([sortedResults[0]])}
                                disabled={cloning || sortedResults.length === 0}
                                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-amber-500/20 transition-all"
                            >
                                <i className="fa-solid fa-crown mr-1.5" /> Clone #1
                            </button>
                            <button
                                onClick={() => handleClone(sortedResults.slice(0, 3))}
                                disabled={cloning || sortedResults.length < 2}
                                className="px-5 py-2.5 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-300 transition-all"
                            >
                                <i className="fa-solid fa-layer-group mr-1.5" /> Top 3
                            </button>
                            <button
                                onClick={() => handleClone(sortedResults.slice(0, 5))}
                                disabled={cloning || sortedResults.length < 3}
                                className="px-5 py-2.5 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-300 transition-all"
                            >
                                <i className="fa-solid fa-layer-group mr-1.5" /> Top 5
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {sortedResults.map((img, idx) => {
                            const isSelected = selectedIds.has(img.id);
                            const isTop = idx === 0;
                            return (
                                <div
                                    key={img.id}
                                    className={`relative group rounded-[2rem] overflow-hidden border-2 transition-all duration-300 cursor-pointer
                                        ${isSelected
                                            ? 'border-pink-500 shadow-xl shadow-pink-500/15 scale-[1.02]'
                                            : isTop
                                                ? 'border-amber-500/60 shadow-2xl shadow-amber-500/10'
                                                : 'border-white/5 hover:border-pink-500/40'
                                        }`}
                                >
                                    <div
                                        className="aspect-square bg-[#0d1425] relative overflow-hidden"
                                        onClick={() => setDetailImage(img)}
                                    >
                                        <img
                                            src={img.thumbnailUrl}
                                            alt={img.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        {isTop && (
                                            <div className="absolute top-3 left-3 px-3 py-1 bg-amber-500 text-white font-black text-[10px] uppercase rounded-lg shadow-lg">
                                                <i className="fa-solid fa-trophy mr-1" /> #1 Viral
                                            </div>
                                        )}
                                        {img.isAI && (
                                            <span className="absolute top-3 right-3 px-2 py-1 bg-violet-600 rounded-lg text-[10px] font-black text-white uppercase">AI</span>
                                        )}
                                        {idx > 0 && idx < 5 && (
                                            <div className="absolute top-3 left-3 w-7 h-7 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center text-white font-black text-xs border border-white/10">
                                                {idx + 1}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                <i className="fa-solid fa-expand text-white text-lg" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-[#0d1425]">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-xs font-bold line-clamp-1">{img.title}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-emerald-400 text-[10px] font-black">
                                                        <i className="fa-solid fa-download mr-1" />{img.downloads}
                                                    </span>
                                                    {img.creator && (
                                                        <span className="text-slate-500 text-[10px] truncate">
                                                            <i className="fa-solid fa-user mr-1" />{img.creator}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5 shrink-0">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleSelect(img.id); }}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isSelected
                                                        ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/30'
                                                        : 'bg-[#161d2f] text-slate-500 hover:text-pink-400 border border-white/10'
                                                        }`}
                                                    title={isSelected ? 'Deselect' : 'Select'}
                                                >
                                                    <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'} text-xs`} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleClone([img]); }}
                                                    disabled={cloning}
                                                    className="w-9 h-9 rounded-xl bg-pink-500/20 hover:bg-pink-500 text-pink-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-40"
                                                    title="Clone this image"
                                                >
                                                    <i className="fa-solid fa-dna text-xs" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-3 right-3 w-7 h-7 bg-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-pink-500/40 z-10 pointer-events-none">
                                            <i className="fa-solid fa-check text-white text-xs" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Sticky Bottom Action Bar ────────────────────── */}
            {selectedIds.size > 0 && !cloning && (
                <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="max-w-5xl mx-auto px-6 pb-6">
                        <div className="bg-[#0d1425]/95 backdrop-blur-xl border-2 border-pink-500/30 rounded-[2rem] p-4 flex items-center gap-4 shadow-2xl shadow-pink-500/10">
                            <div className="flex -space-x-2 shrink-0">
                                {selectedImages.slice(0, 5).map(img => (
                                    <div key={img.id} className="w-10 h-10 rounded-xl overflow-hidden border-2 border-[#0d1425] shadow-lg">
                                        <img src={img.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                                {selectedIds.size > 5 && (
                                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 border-2 border-[#0d1425] flex items-center justify-center text-pink-400 text-[10px] font-black">
                                        +{selectedIds.size - 5}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-black text-sm">
                                    {selectedIds.size} image{selectedIds.size > 1 ? 's' : ''} selected
                                </p>
                                <p className="text-slate-500 text-[10px] font-bold">
                                    {selectedIds.size > 5 ? 'Only first 5 will be processed (API limit)' : 'Ready to clone'}
                                </p>
                            </div>
                            <button
                                onClick={deselectAll}
                                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase text-slate-400 transition-all"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => handleClone(selectedImages)}
                                className="px-8 py-3.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 rounded-[1.5rem] font-black text-sm uppercase tracking-widest text-white shadow-lg shadow-pink-500/30 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <i className="fa-solid fa-dna" />
                                Clone {Math.min(selectedIds.size, 5)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ScanConfig Modal ────────────────────────────── */}
            {showConfigModal && (
                <ScanConfigModal
                    eventName={query}
                    onConfirm={executeSearch}
                    onCancel={() => setShowConfigModal(false)}
                    initialConfig={{ aiOnly: false }}
                />
            )}

            {/* ── Detail Modal ────────────────────────────────── */}
            {detailImage && (
                <ImageDetailModal
                    img={detailImage}
                    onClose={() => setDetailImage(null)}
                    selected={selectedIds.has(detailImage.id)}
                    onToggle={() => toggleSelect(detailImage.id)}
                    onClone={() => { setDetailImage(null); handleClone([detailImage]); }}
                    cloning={cloning}
                />
            )}
        </div>
    );
};

export default CloningMode;
