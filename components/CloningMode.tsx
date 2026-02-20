import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { StockInsight, ImagePrompt, ScanConfig, ContentTypeFilter, Creator, GeneratedImage } from '../types';
import {
    searchTrackAdobeMultiplePages,
    searchTrackAdobeMultiplePages as searchTrackAdobe, // Alias for legacy
    searchTrackContributorMultiplePages,
    getFavoriteContributors,
    toggleFavoriteContributor
} from '../services/trackAdobeService';
import { generateImageFromPrompt, upscaleImage, generateVideoPlanFromImage, renderVideoFromPlan } from '../services/imageGenService';
import type { GenerationSettings } from '../services/imageGenService';
import ScanConfigModal from './ScanConfigModal';
import Portal from './Portal';
import CsvCloningMode from './CsvCloningMode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface CloningModeProps {
    onPromptsGenerated: (prompts: ImagePrompt[]) => void;
}

interface CloningSession {
    id: string;
    original: StockInsight;
    generated: GeneratedImage;
}

const ASPECT_RATIOS = [
    { value: '', label: 'Auto' },
    { value: '1:1', label: '1:1 Square' },
    { value: '16:9', label: '16:9 Wide' },
    { value: '9:16', label: '9:16 Tall' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
    { value: '3:2', label: '3:2' },
    { value: '2:3', label: '2:3' },
    { value: '4:5', label: '4:5' },
    { value: '5:4', label: '5:4' },
    { value: '21:9', label: '21:9 Ultra Wide' },
];

const RESOLUTIONS = [
    { value: '1K', label: '1K (Default)' },
    { value: '2K', label: '2K' },
    { value: '4K', label: '4K Ultra HD' },
];

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
    <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <div
                className="relative bg-[#0d1425] rounded-[2.5rem] border border-white/10 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Close button – always visible */}
                <button onClick={onClose} className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-white/20 flex items-center justify-center text-white transition-all border border-white/20">
                    <i className="fa-solid fa-xmark text-lg" />
                </button>

                {/* Image – capped height */}
                <div className="relative bg-black/50 rounded-t-[2.5rem] overflow-hidden shrink-0" style={{ maxHeight: '40vh' }}>
                    <img src={img.thumbnailUrl} alt={img.title} className="w-full h-full object-contain" />
                    {img.isAI && (
                        <span className="absolute top-4 left-4 px-3 py-1 bg-violet-600 rounded-lg text-[10px] font-black text-white uppercase">AI Generated</span>
                    )}
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto min-h-0 p-8 space-y-5">
                    <h3 className="text-xl font-black text-white leading-tight">{img.title}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
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
                </div>

                {/* Action buttons – always pinned at bottom */}
                <div className="shrink-0 px-8 pb-8 pt-4 border-t border-white/5 bg-[#0d1425] rounded-b-[2.5rem] flex gap-3">
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
    </Portal>
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

    // Creator Cloning & Favorites & CSV
    const [cloningType, setCloningType] = useState<'keyword' | 'creator'>('keyword');
    const [favCreators, setFavCreators] = useState<Creator[]>([]);

    // In-place Cloning State
    const [cloningSessions, setCloningSessions] = useState<CloningSession[]>([]);
    const [threadCount, setThreadCount] = useState(2);
    const [generating, setGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
    const abortRef = useRef(false);

    // Generation settings
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [imageSize, setImageSize] = useState('1K');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [videoFastMode, setVideoFastMode] = useState<boolean>(true);
    const [videoAspectRatio, setVideoAspectRatio] = useState<string>('16:9');
    const [videoResolution, setVideoResolution] = useState<string>('1080p');
    const [settingsOpen, setSettingsOpen] = useState(false);

    const currentSettings: GenerationSettings = { aspectRatio, imageSize, negativePrompt };

    useEffect(() => {
        getFavoriteContributors().then(setFavCreators);
    }, []);

    const toggleFav = useCallback(async (creator: Creator) => {
        const next = await toggleFavoriteContributor(creator);
        setFavCreators(next);
    }, []);

    // ── Threaded Vision Analysis ──────────────────────────────
    const analyzeSession = useCallback(async (sessionId: string, img: StockInsight) => {
        setCloningSessions(prev => prev.map(s =>
            s.id === sessionId ? { ...s, generated: { ...s.generated, analysisStatus: 'analyzing', error: undefined } } : s
        ));

        try {
            const payload = [{ url: img.thumbnailUrl, title: img.title, id: img.id }];
            const response = await fetch(`${(import.meta as any).env?.VITE_API_URL || ''}/api/generate-cloning-prompts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images: payload })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || response.statusText);
            }

            const data = await response.json();
            if (data.prompts && data.prompts.length > 0) {
                setCloningSessions(prev => prev.map(s =>
                    s.id === sessionId ? { ...s, generated: { ...s.generated, analysisStatus: 'done', prompt: data.prompts[0] } } : s
                ));
            } else {
                throw new Error("No prompts returned from Vision AI.");
            }
        } catch (err: any) {
            setCloningSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, generated: { ...s.generated, analysisStatus: 'error', error: err.message } } : s
            ));
        }
    }, []);

    useEffect(() => {
        const analyzingCount = cloningSessions.filter(s => s.generated.analysisStatus === 'analyzing').length;
        const idleCount = cloningSessions.filter(s => s.generated.analysisStatus === 'idle').length;

        if (analyzingCount < threadCount && idleCount > 0) {
            // Find the first idle session to analyze
            const nextSession = cloningSessions.find(s => s.generated.analysisStatus === 'idle');
            if (nextSession) {
                analyzeSession(nextSession.id, nextSession.original);
            }
        }
    }, [cloningSessions, threadCount, analyzeSession]);

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
            // Only keyword search uses the live API now
            const res = await searchTrackAdobeMultiplePages(
                query, startPage, endPage,
                config.aiOnly, config.contentType, config.order
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
            const sortLabel = config.order === 'nb_downloads' ? 'Downloads' : config.order === 'creation' ? 'Newest' : config.order === 'featured' ? 'Featured' : 'Relevance';
            setSearchInfo(`${images.length} results from ${pageRange} · ${sortLabel} · ${config.aiOnly ? 'AI only' : 'All'} · ${config.contentType} · ≥${config.minDownloads} DLs`);
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
    // ── Clone ─────────────────────────────────────────────────
    const handleClone = useCallback(async (imagesToClone: StockInsight[]) => {
        if (imagesToClone.length === 0) return;
        setSuccessMsg('');
        setError(null);

        // Create initial sessions marked as 'idle' for analysis
        const newSessions: CloningSession[] = imagesToClone.map(img => ({
            id: crypto.randomUUID(),
            original: img,
            generated: {
                prompt: null,
                analysisStatus: 'idle',
                dataUrl: null,
                upscaledUrl: null,
                status: 'idle',
                upscaleStatus: 'idle',
                videoStatus: 'idle'
            }
        }));

        setCloningSessions(prev => [...prev, ...newSessions]);
        setSuccessMsg(`✓ Added ${imagesToClone.length} images to queue.`);
    }, []);

    // ── Generation Logic ──────────────────────────────────────
    const generateOneSession = useCallback(async (index: number) => {
        const session = cloningSessions[index];
        if (!session.generated.prompt) return;

        setCloningSessions(prev => prev.map((s, i) =>
            i === index ? { ...s, generated: { ...s.generated, status: 'generating', error: undefined } } : s
        ));
        try {
            const dataUrl = await generateImageFromPrompt(session.generated.prompt, currentSettings);
            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, dataUrl, status: 'done' } } : s
            ));
        } catch (err: any) {
            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, status: 'error', error: err.message } } : s
            ));
        }
    }, [cloningSessions]);

    const generateAllSessions = useCallback(async () => {
        abortRef.current = false;
        setGenerating(true);
        const total = cloningSessions.length;
        setGenerationProgress({ current: 0, total });
        let completed = 0;

        // Process in chunks defined by threadCount
        const sessionsToProcess = cloningSessions
            .map((s, index) => ({ session: s, index }))
            .filter(item => {
                if (item.session.generated.status === 'done' || item.session.generated.analysisStatus !== 'done' || !item.session.generated.prompt) {
                    if (item.session.generated.status === 'done') {
                        completed++;
                        setGenerationProgress({ current: completed, total });
                    }
                    return false;
                }
                return true;
            });

        for (let i = 0; i < sessionsToProcess.length; i += threadCount) {
            if (abortRef.current) break;
            const chunk = sessionsToProcess.slice(i, i + threadCount);

            // Set status to generating for this chunk
            setCloningSessions(prev => prev.map((s, idx) =>
                chunk.some(c => c.index === idx) ? { ...s, generated: { ...s.generated, status: 'generating', error: undefined } } : s
            ));

            await Promise.allSettled(chunk.map(async ({ session, index }) => {
                try {
                    const dataUrl = await generateImageFromPrompt(session.generated.prompt!, currentSettings);
                    setCloningSessions(prev => prev.map((s, idx) =>
                        idx === index ? { ...s, generated: { ...s.generated, dataUrl, status: 'done' } } : s
                    ));
                } catch (err: any) {
                    setCloningSessions(prev => prev.map((s, idx) =>
                        idx === index ? { ...s, generated: { ...s.generated, status: 'error', error: err.message } } : s
                    ));
                }
                completed++;
                setGenerationProgress({ current: completed, total });
            }));
        }
        setGenerating(false);
    }, [cloningSessions]);

    const stopGeneration = useCallback(() => {
        abortRef.current = true;
        setGenerating(false);
    }, []);

    const upscaleSession = useCallback(async (index: number) => {
        const session = cloningSessions[index];
        if (!session.generated.dataUrl) return;

        setCloningSessions(prev => prev.map((s, i) =>
            i === index ? { ...s, generated: { ...s.generated, upscaleStatus: 'upscaling', error: undefined } } : s
        ));
        try {
            const upscaledUrl = await upscaleImage(session.generated.dataUrl);
            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, upscaledUrl, upscaleStatus: 'done' } } : s
            ));
        } catch (err: any) {
            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, upscaleStatus: 'error', error: err.message } } : s
            ));
        }
    }, [cloningSessions]);

    const downloadSession = useCallback((index: number) => {
        const session = cloningSessions[index];
        const src = session.generated.upscaledUrl || session.generated.dataUrl;
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = `cloned-${session.id}${session.generated.upscaledUrl ? '-4K' : ''}.png`;
        a.click();
    }, [cloningSessions]);

    const removeSession = useCallback((index: number) => {
        setCloningSessions(prev => prev.filter((_, i) => i !== index));
    }, []);

    const clearWorkspace = useCallback(() => {
        setCloningSessions([]);
        setGenerating(false);
        abortRef.current = true;
    }, []);

    const upscaleAllSessions = useCallback(async () => {
        const upscalable = cloningSessions
            .map((s, i) => ({ session: s, index: i }))
            .filter(item => item.session.generated.dataUrl && item.session.generated.upscaleStatus !== 'done');

        if (upscalable.length === 0) return;

        // Process in chunks defined by threadCount
        for (let i = 0; i < upscalable.length; i += threadCount) {
            if (abortRef.current) break;
            const chunk = upscalable.slice(i, i + threadCount);
            await Promise.allSettled(chunk.map(({ index }) => upscaleSession(index)));
        }
    }, [cloningSessions, upscaleSession, threadCount]);

    const generateVideo = useCallback(async (index: number) => {
        const session = cloningSessions[index];
        const src = session.generated.upscaledUrl || session.generated.dataUrl;
        if (!src || !session.generated.prompt) return;

        setCloningSessions(prev => prev.map((s, i) =>
            i === index ? { ...s, generated: { ...s.generated, videoStatus: 'planning', error: undefined } } : s
        ));

        let plan = session.generated.videoPlan;

        try {
            if (!plan) {
                const planResult = await generateVideoPlanFromImage(src, session.generated.prompt.scene);
                plan = planResult.plan;
                setCloningSessions(prev => prev.map((s, i) =>
                    i === index ? { ...s, generated: { ...s.generated, videoPlan: plan } } : s
                ));
            }

            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, videoStatus: 'generating' } } : s
            ));

            const result = await renderVideoFromPlan(src, session.generated.prompt.scene, plan, videoFastMode, videoAspectRatio, videoResolution);

            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, videoUrl: result.videoUrl, videoStatus: 'done' } } : s
            ));
        } catch (err: any) {
            setCloningSessions(prev => prev.map((s, i) =>
                i === index ? { ...s, generated: { ...s.generated, videoStatus: 'error', error: err.message } } : s
            ));
        }
    }, [cloningSessions, videoFastMode, videoAspectRatio, videoResolution]);

    const generateAllVideos = useCallback(async () => {
        const videoable = cloningSessions
            .map((s, i) => ({ session: s, index: i }))
            .filter(item => (item.session.generated.dataUrl || item.session.generated.upscaledUrl) && item.session.generated.videoStatus !== 'done');

        if (videoable.length === 0) return;

        // Process in chunks defined by threadCount
        for (let i = 0; i < videoable.length; i += threadCount) {
            if (abortRef.current) break;
            const chunk = videoable.slice(i, i + threadCount);
            await Promise.allSettled(chunk.map(({ index }) => generateVideo(index)));
        }
    }, [cloningSessions, generateVideo, threadCount]);

    const retryAllFailed = useCallback(async () => {
        // 1. Reset analysis errors to idle so the useEffect picks them up
        setCloningSessions(prev => prev.map(s => {
            let next = { ...s };
            if (next.generated.analysisStatus === 'error') {
                next.generated.analysisStatus = 'idle';
                next.generated.error = undefined;
            }
            return next;
        }));

        // 2. Retry image generation for those with status 'error'
        const failedImages = cloningSessions
            .map((s, i) => ({ session: s, index: i }))
            .filter(item => item.session.generated.status === 'error');

        for (let i = 0; i < failedImages.length; i += threadCount) {
            if (abortRef.current) break;
            const chunk = failedImages.slice(i, i + threadCount);
            setCloningSessions(prev => prev.map((s, idx) =>
                chunk.some(c => c.index === idx) ? { ...s, generated: { ...s.generated, status: 'generating', error: undefined } } : s
            ));
            await Promise.allSettled(chunk.map(async ({ session, index }) => {
                try {
                    const dataUrl = await generateImageFromPrompt(session.generated.prompt!, currentSettings);
                    setCloningSessions(prev => prev.map((s, idx) =>
                        idx === index ? { ...s, generated: { ...s.generated, dataUrl, status: 'done' } } : s
                    ));
                } catch (err: any) {
                    setCloningSessions(prev => prev.map((s, idx) =>
                        idx === index ? { ...s, generated: { ...s.generated, status: 'error', error: err.message } } : s
                    ));
                }
            }));
        }

        // 3. Retry video generation for those with videoStatus 'error'
        const failedVideos = cloningSessions
            .map((s, i) => ({ session: s, index: i }))
            .filter(item => item.session.generated.videoStatus === 'error');

        for (let i = 0; i < failedVideos.length; i += threadCount) {
            if (abortRef.current) break;
            const chunk = failedVideos.slice(i, i + threadCount);
            await Promise.allSettled(chunk.map(({ index }) => generateVideo(index)));
        }

        // 4. Retry upscale for those with upscaleStatus 'error'
        const failedUpscales = cloningSessions
            .map((s, i) => ({ session: s, index: i }))
            .filter(item => item.session.generated.upscaleStatus === 'error');

        for (let i = 0; i < failedUpscales.length; i += threadCount) {
            if (abortRef.current) break;
            const chunk = failedUpscales.slice(i, i + threadCount);
            await Promise.allSettled(chunk.map(({ index }) => upscaleSession(index)));
        }
    }, [cloningSessions, threadCount, generateVideo, upscaleSession, currentSettings]);

    const [isZipping, setIsZipping] = useState(false);
    const downloadAllAsZip = useCallback(async () => {
        const completedSessions = cloningSessions.filter(s => s.generated.dataUrl || s.generated.upscaledUrl);
        if (completedSessions.length === 0) return;

        setIsZipping(true);
        try {
            const zip = new JSZip();

            const base64ToBlob = async (base64Url: string) => {
                const res = await fetch(base64Url);
                return await res.blob();
            };

            const fetchVideoBlob = async (videoUrl: string) => {
                const res = await fetch(videoUrl);
                return await res.blob();
            };

            for (let i = 0; i < completedSessions.length; i++) {
                const session = completedSessions[i];
                const src = session.generated.upscaledUrl || session.generated.dataUrl;
                if (!src) continue;

                const imgBlob = await base64ToBlob(src);
                const is4K = !!session.generated.upscaledUrl;
                const baseName = `cloned_asset_${session.original.id}_${i + 1}`;

                zip.file(`${baseName}${is4K ? '_4K' : ''}.png`, imgBlob);

                if (session.generated.videoUrl) {
                    try {
                        const vidBlob = await fetchVideoBlob(session.generated.videoUrl);
                        zip.file(`${baseName}_animated.mp4`, vidBlob);
                    } catch (e) {
                        console.error("Failed to fetch video for ZIP", e);
                    }
                }
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `viral_clones_with_video_${new Date().toISOString().split('T')[0]}.zip`);
        } catch (error) {
            console.error("Failed to zip images:", error);
        } finally {
            setIsZipping(false);
        }
    }, [cloningSessions]);

    const progressPercent = cloningProgress.total > 0
        ? Math.round((cloningProgress.current / cloningProgress.total) * 100)
        : 0;

    return (
        <div className="space-y-10 animate-in fade-in zoom-in duration-500 pb-32">
            <style>
                {`
                    @keyframes heartbeat {
                        0% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(236, 72, 153, 0.5)); border-color: rgba(236, 72, 153, 0.3); }
                        14% { transform: scale(1.02); filter: drop-shadow(0 0 15px rgba(236, 72, 153, 0.8)); border-color: rgba(236, 72, 153, 0.6); }
                        28% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(236, 72, 153, 0.5)); border-color: rgba(236, 72, 153, 0.3); }
                        42% { transform: scale(1.02); filter: drop-shadow(0 0 15px rgba(236, 72, 153, 0.8)); border-color: rgba(236, 72, 153, 0.6); }
                        70% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(236, 72, 153, 0.5)); border-color: rgba(236, 72, 153, 0.3); }
                    }
                    .animate-heartbeat {
                        animation: heartbeat 1.5s ease-in-out infinite;
                    }
                `}
            </style>
            {cloningSessions.length > 0 ? (
                // ── CLONING WORKSPACE ─────────────────────────────
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/10">
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter italic text-white leading-none">
                                <span className="text-pink-500">Active</span> Sessions
                            </h2>
                            <p className="text-slate-400 font-medium text-sm mt-2">
                                {cloningSessions.length} active cloning session{cloningSessions.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap justify-end">
                            <div className="flex items-center gap-2 bg-[#161d2f] px-3 py-1.5 rounded-xl border border-white/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Threads</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={threadCount}
                                    onChange={(e) => setThreadCount(Number(e.target.value) || 2)}
                                    className="w-12 bg-transparent text-white font-bold text-center outline-none border-b border-transparent focus:border-pink-500 transition-colors"
                                />
                            </div>

                            {!generating ? (
                                <button
                                    onClick={generateAllSessions}
                                    className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-pink-500/30 transition-all"
                                >
                                    <i className="fa-solid fa-play mr-2"></i> Generate All
                                </button>
                            ) : (
                                <button
                                    onClick={stopGeneration}
                                    className="px-6 py-3 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 rounded-xl font-black text-xs uppercase tracking-widest text-rose-400 transition-all"
                                >
                                    <i className="fa-solid fa-stop mr-2"></i> Stop ({generationProgress.current}/{generationProgress.total})
                                </button>
                            )}

                            <button
                                onClick={upscaleAllSessions}
                                className="px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-xl font-black text-xs uppercase tracking-widest text-amber-300 shadow-lg shadow-amber-500/10 transition-all"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Upscale All 4K
                            </button>

                            <button
                                onClick={generateAllVideos}
                                className="px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 rounded-xl font-black text-xs uppercase tracking-widest text-violet-300 shadow-lg shadow-violet-500/10 transition-all"
                            >
                                <i className="fa-solid fa-video mr-2"></i> Generate All Videos
                            </button>

                            <button
                                onClick={downloadAllAsZip}
                                disabled={isZipping}
                                className="px-6 py-3 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black text-xs uppercase tracking-widest text-sky-300 shadow-lg shadow-sky-500/10 transition-all"
                            >
                                {isZipping ? (
                                    <><i className="fa-solid fa-spinner fa-spin mr-2"></i> Zipping...</>
                                ) : (
                                    <><i className="fa-solid fa-file-zipper mr-2"></i> Download All (ZIP)</>
                                )}
                            </button>

                            <button
                                onClick={retryAllFailed}
                                className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl font-black text-xs uppercase tracking-widest text-red-300 shadow-lg shadow-red-500/10 transition-all"
                            >
                                <i className="fa-solid fa-rotate-right mr-2"></i> Retry Failed
                            </button>

                            <button
                                onClick={clearWorkspace}
                                className="px-6 py-3 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 transition-all"
                            >
                                <i className="fa-solid fa-trash mr-2"></i> Clear
                            </button>
                        </div>
                    </div>

                    {/* ═══ Generation Settings Panel ═══ */}
                    <div className="bg-[#0d1425] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden mb-8">
                        <button
                            onClick={() => setSettingsOpen(!settingsOpen)}
                            className="w-full px-8 py-5 flex items-center justify-between text-left hover:bg-[#111b33] transition-colors"
                        >
                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-300">
                                <i className="fa-solid fa-sliders text-pink-400 mr-3"></i>
                                Clone Settings
                            </h3>
                            <div className="flex items-center gap-4">
                                {!settingsOpen && (
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                        {aspectRatio || 'Auto'} · {imageSize}
                                        {negativePrompt && ' · Neg'}
                                    </span>
                                )}
                                <i className={`fa-solid fa-chevron-${settingsOpen ? 'up' : 'down'} text-slate-500 text-sm transition-transform`}></i>
                            </div>
                        </button>

                        {settingsOpen && (
                            <div className="px-8 pb-8 pt-2 border-t border-white/5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Aspect Ratio */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                            <i className="fa-solid fa-crop text-sky-400 mr-2"></i>
                                            Aspect Ratio
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {ASPECT_RATIOS.map(ar => (
                                                <button
                                                    key={ar.value}
                                                    onClick={() => setAspectRatio(ar.value)}
                                                    className={`px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${aspectRatio === ar.value
                                                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 shadow-lg shadow-sky-500/10'
                                                        : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-sky-500/30 hover:text-slate-300'
                                                        }`}
                                                >
                                                    {ar.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Resolution */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                            <i className="fa-solid fa-expand text-amber-400 mr-2"></i>
                                            Resolution
                                        </label>
                                        <div className="space-y-2">
                                            {RESOLUTIONS.map(r => (
                                                <button
                                                    key={r.value}
                                                    onClick={() => setImageSize(r.value)}
                                                    className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border text-left flex justify-between items-center ${imageSize === r.value
                                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10'
                                                        : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-amber-500/30 hover:text-slate-300'
                                                        }`}
                                                >
                                                    <span className="flex items-center">
                                                        {r.value === '4K' && <i className="fa-solid fa-crown text-amber-400 mr-2"></i>}
                                                        {r.label}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Video Speed */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                            <i className="fa-solid fa-video text-violet-400 mr-2"></i>
                                            Video Generation Model
                                        </label>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setVideoFastMode(true)}
                                                className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border text-left flex justify-between items-center ${videoFastMode
                                                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-lg shadow-violet-500/10'
                                                    : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-violet-500/30 hover:text-slate-300'
                                                    }`}
                                            >
                                                <span className="flex items-center"><i className="fa-solid fa-bolt text-violet-400 mr-2"></i> Veo 3.1 Fast (Draft)</span>
                                            </button>
                                            <button
                                                onClick={() => setVideoFastMode(false)}
                                                className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border text-left flex justify-between items-center ${!videoFastMode
                                                    ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-lg shadow-violet-500/10'
                                                    : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-violet-500/30 hover:text-slate-300'
                                                    }`}
                                            >
                                                <span className="flex items-center"><i className="fa-solid fa-gem text-violet-400 mr-2"></i> Veo 3.1 High Quality</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Video Aspect Ratio */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                            <i className="fa-solid fa-crop-simple text-violet-400 mr-2"></i>
                                            Video Aspect Ratio
                                        </label>
                                        <div className="space-y-2">
                                            {[
                                                { value: '16:9', label: 'Landscape (16:9)' },
                                                { value: '9:16', label: 'Portrait (9:16)' }
                                            ].map(r => (
                                                <button
                                                    key={r.value}
                                                    onClick={() => setVideoAspectRatio(r.value)}
                                                    className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border text-left flex justify-between items-center ${videoAspectRatio === r.value
                                                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-lg shadow-violet-500/10'
                                                        : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-violet-500/30 hover:text-slate-300'
                                                        }`}
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Video Resolution */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                            <i className="fa-solid fa-expand text-pink-400 mr-2"></i>
                                            Video Resolution
                                        </label>
                                        <div className="space-y-2">
                                            {[
                                                { value: '720p', label: '720p' },
                                                { value: '1080p', label: '1080p' },
                                                { value: '4k', label: '4k UHD' }
                                            ].map(r => (
                                                <button
                                                    key={r.value}
                                                    onClick={() => setVideoResolution(r.value)}
                                                    className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border text-left flex justify-between items-center ${videoResolution === r.value
                                                        ? 'bg-pink-500/20 border-pink-500/50 text-pink-300 shadow-lg shadow-pink-500/10'
                                                        : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-pink-500/30 hover:text-slate-300'
                                                        }`}
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Negative Prompt */}
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                            <i className="fa-solid fa-ban text-red-400 mr-2"></i>
                                            Negative Prompt
                                        </label>
                                        <textarea
                                            value={negativePrompt}
                                            onChange={(e) => setNegativePrompt(e.target.value)}
                                            placeholder="Things to avoid... e.g. blurry, watermark, text, low quality, deformed"
                                            rows={3}
                                            className="w-full bg-[#161d2f] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/30 focus:ring-1 focus:ring-red-500/20 resize-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {cloningSessions.map((session, i) => (
                            <div key={session.id} className="bg-[#0d1425] p-6 rounded-[2rem] border border-white/5 flex flex-col lg:flex-row gap-8 shadow-xl">
                                {/* Left: Original */}
                                <div className="flex-1 space-y-3 flex flex-col">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reference</span>
                                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{session.original.id}</span>
                                    </div>
                                    <div className="aspect-video bg-black/50 rounded-2xl overflow-hidden border border-white/5 relative group shrink-0">
                                        <img src={session.original.thumbnailUrl} alt="Original" className="w-full h-full object-contain" />
                                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white font-bold backdrop-blur-sm">{session.original.title}</div>
                                    </div>

                                    {/* Reference Details */}
                                    <div className="bg-[#161d2f] p-4 rounded-xl border border-white/5 flex flex-col flex-1 gap-4 min-h-[150px]">
                                        <div className="grid grid-cols-2 gap-4 shrink-0">
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Creator</span>
                                                <span className="text-xs text-slate-300 truncate block" title={session.original.creator}>{session.original.creator}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Downloads</span>
                                                <span className="text-xs text-emerald-400 font-mono">{session.original.downloads?.toLocaleString() || '0'}</span>
                                            </div>
                                            {session.original.dimensions && (
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Resolution</span>
                                                    <span className="text-xs text-slate-300">{session.original.dimensions}</span>
                                                </div>
                                            )}
                                            {session.original.uploadDate && (
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Upload Date</span>
                                                    <span className="text-xs text-slate-300">{new Date(session.original.uploadDate).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                        {session.original.keywords && session.original.keywords.length > 0 && (
                                            <div className="pt-3 border-t border-white/5 flex-1 flex flex-col min-h-0">
                                                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-2 shrink-0">Keywords ({session.original.keywords.length})</span>
                                                <div className="flex flex-wrap content-start gap-1 overflow-y-auto pr-2 custom-scrollbar max-h-40">
                                                    {session.original.keywords.map(kw => (
                                                        <span key={kw} className="px-2 py-1 bg-white/5 text-slate-400 text-[10px] rounded-md border border-white/10 hover:border-pink-500/30 hover:text-pink-300 transition-colors whitespace-nowrap">
                                                            {kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Center: Arrow */}
                                <div className="hidden lg:flex flex-col items-center justify-center text-slate-700 shrink-0 mx-2">
                                    <div className="w-8 h-8 rounded-full bg-[#161d2f] border border-white/5 flex items-center justify-center shadow-lg">
                                        <i className="fa-solid fa-arrow-right text-slate-500 text-sm"></i>
                                    </div>
                                </div>

                                {/* Center: Generated Image */}
                                <div className="flex-1 space-y-3 flex flex-col min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-pink-500">Cloned Image</span>
                                        <div className="flex gap-2">
                                            {session.generated.analysisStatus === 'analyzing' && <span className="text-pink-400 text-[10px] font-bold uppercase animate-pulse"><i className="fa-solid fa-spinner fa-spin mr-1"></i> Vision</span>}
                                            {session.generated.analysisStatus === 'done' && session.generated.status === 'generating' && <span className="text-pink-400 text-[10px] font-bold uppercase animate-pulse"><i className="fa-solid fa-spinner fa-spin mr-1"></i> Drawing</span>}
                                            {session.generated.status === 'done' && <span className="text-emerald-400 text-[10px] font-bold uppercase"><i className="fa-solid fa-check mr-1"></i> Done</span>}
                                        </div>
                                    </div>

                                    <div className={`aspect-video bg-[#161d2f] rounded-2xl overflow-hidden border relative flex items-center justify-center group shrink-0 transition-all duration-300
                                        ${(session.generated.analysisStatus === 'analyzing' || session.generated.status === 'generating') ? 'animate-heartbeat border-pink-500' : 'border-white/5 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]'}
                                    `}>
                                        {session.generated.dataUrl || session.generated.upscaledUrl ? (
                                            <>
                                                <img src={session.generated.upscaledUrl || session.generated.dataUrl!} alt="Generated" className="w-full h-full object-contain" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm flex items-center justify-center gap-4">
                                                    {(session.generated.dataUrl || session.generated.upscaledUrl) && (
                                                        <div className="flex flex-col gap-2">
                                                            {session.generated.upscaleStatus !== 'done' && session.generated.upscaleStatus !== 'upscaling' && (
                                                                <button
                                                                    onClick={() => upscaleSession(i)}
                                                                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 rounded-xl text-amber-300 font-bold text-xs uppercase transition-all shadow-lg"
                                                                >
                                                                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i> Upscale 4K
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => downloadSession(i)}
                                                                className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/40 border border-sky-500/50 rounded-xl text-sky-300 font-bold text-xs uppercase transition-all shadow-lg"
                                                            >
                                                                <i className="fa-solid fa-download mr-2"></i> Download Image
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {session.generated.upscaleStatus === 'upscaling' && (
                                                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 border border-amber-500/30 rounded text-[10px] text-amber-400 font-bold backdrop-blur-md shadow-lg shadow-amber-500/20 flex items-center animate-pulse">
                                                        <i className="fa-solid fa-spinner fa-spin mr-1.5 "></i> Upscaling 4K...
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-slate-600 text-center p-4">
                                                {session.generated.analysisStatus === 'error' ? (
                                                    <div className="flex flex-col items-center">
                                                        <i className="fa-solid fa-triangle-exclamation text-2xl text-rose-500 mb-2 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]"></i>
                                                        <p className="text-xs text-rose-400 font-bold mb-4">{session.generated.error || "Vision Analysis Failed"}</p>
                                                        <button
                                                            onClick={() => analyzeSession(session.id, session.original)}
                                                            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 rounded-xl text-rose-300 font-bold text-[10px] uppercase transition-all shadow-lg flex items-center"
                                                        >
                                                            <i className="fa-solid fa-rotate-right mr-2"></i> Retry Analysis
                                                        </button>
                                                    </div>
                                                ) : session.generated.status === 'error' ? (
                                                    <>
                                                        <i className="fa-solid fa-triangle-exclamation text-2xl text-rose-500 mb-2 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]"></i>
                                                        <p className="text-xs text-rose-400 font-bold">{session.generated.error}</p>
                                                    </>
                                                ) : session.generated.analysisStatus === 'analyzing' ? (
                                                    <>
                                                        <i className="fa-solid fa-eye text-3xl mb-3 text-pink-400 filter drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]"></i>
                                                        <p className="text-[12px] font-black uppercase tracking-[0.2em] text-pink-400 drop-shadow-[0_0_5px_rgba(236,72,153,0.5)]">Analyzing</p>
                                                        <div className="w-16 h-1 bg-white/10 rounded-full mt-3 overflow-hidden mx-auto">
                                                            <div className="w-1/2 h-full bg-pink-500 rounded-full animate-[progress_1s_ease-in-out_infinite]"></div>
                                                        </div>
                                                    </>
                                                ) : session.generated.status === 'generating' ? (
                                                    <>
                                                        <i className="fa-solid fa-palette text-3xl mb-3 text-violet-400 filter drop-shadow-[0_0_8px_rgba(167,139,250,0.8)]"></i>
                                                        <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-400 drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]">Drawing</p>
                                                        <div className="w-16 h-1 bg-white/10 rounded-full mt-3 overflow-hidden mx-auto">
                                                            <div className="w-1/2 h-full bg-violet-500 rounded-full animate-[progress_1s_ease-in-out_infinite]"></div>
                                                        </div>
                                                    </>
                                                ) : session.generated.analysisStatus === 'done' ? (
                                                    <>
                                                        <i className="fa-solid fa-dna text-2xl mb-2 opacity-30 mix-blend-screen text-amber-100"></i>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Ready to Clone</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fa-solid fa-hourglass-start text-2xl mb-2 opacity-20"></i>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Queued</p>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-[#161d2f] p-4 rounded-xl border border-white/5 flex-1 min-h-[50px] overflow-hidden group hover:border-pink-500/30 transition-colors flex flex-col justify-start">
                                        {session.generated.prompt ? (
                                            <div className="text-[11px] text-slate-300 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 overflow-y-auto custom-scrollbar h-full whitespace-pre-wrap">
                                                <div className="mb-2"><span className="text-pink-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Scene</span> {session.generated.prompt.scene}</div>
                                                <div className="mb-2"><span className="text-pink-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Style</span> {session.generated.prompt.style}</div>
                                                {session.generated.prompt.shot && (
                                                    <div className="mb-2"><span className="text-pink-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Shot</span> {session.generated.prompt.shot.composition} - {session.generated.prompt.shot.lens}</div>
                                                )}
                                                {session.generated.prompt.lighting && (
                                                    <div><span className="text-pink-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Lighting</span> {session.generated.prompt.lighting.primary}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 italic">Vision analysis prompt will appear here...</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center gap-2 mt-2">
                                        <button
                                            onClick={() => generateOneSession(i)}
                                            disabled={generating || session.generated.status === 'generating' || session.generated.analysisStatus !== 'done'}
                                            className="px-4 py-2 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all disabled:opacity-50 flex-1"
                                        >
                                            <i className="fa-solid fa-rotate mr-1"></i> Re-Gen Image
                                        </button>
                                        <button
                                            onClick={() => removeSession(i)}
                                            className="w-10 h-10 flex items-center justify-center bg-[#161d2f] hover:bg-rose-500/20 text-rose-500/50 hover:text-rose-500 rounded-xl border border-white/10 hover:border-rose-500/30 transition-all"
                                            title="Remove Session"
                                        >
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Video */}
                                <div className="hidden lg:flex flex-col items-center justify-center text-slate-700 shrink-0 mx-2">
                                    <div className="w-8 h-8 rounded-full bg-[#161d2f] border border-white/5 flex items-center justify-center shadow-lg">
                                        <i className="fa-solid fa-arrow-right text-slate-500 text-sm"></i>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-3 flex flex-col min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">Animated Clone (Veo)</span>
                                        <div className="flex gap-2">
                                            {session.generated.videoStatus === 'planning' && <span className="text-violet-400 text-[10px] font-bold uppercase animate-pulse"><i className="fa-solid fa-brain fa-spin mr-1"></i> Brainstorming</span>}
                                            {session.generated.videoStatus === 'generating' && <span className="text-violet-400 text-[10px] font-bold uppercase animate-pulse"><i className="fa-solid fa-video fa-spin mr-1"></i> Rendering</span>}
                                            {session.generated.videoStatus === 'done' && <span className="text-pink-400 text-[10px] font-bold uppercase"><i className="fa-solid fa-film mr-1"></i> Video Ready</span>}
                                            {session.generated.videoStatus === 'error' && <span className="text-red-400 text-[10px] font-bold uppercase"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Error</span>}
                                        </div>
                                    </div>

                                    <div className={`aspect-video bg-[#161d2f] rounded-2xl overflow-hidden border relative flex items-center justify-center group shrink-0 transition-all duration-300
                                        ${(session.generated.videoStatus === 'planning' || session.generated.videoStatus === 'generating') ? 'animate-heartbeat border-violet-500' : 'border-white/5 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]'}
                                    `}>
                                        {session.generated.videoUrl ? (
                                            <>
                                                <video src={session.generated.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm flex items-center justify-center gap-4">
                                                    <a
                                                        href={session.generated.videoUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-4 py-2 bg-pink-500/20 hover:bg-pink-500/40 border border-pink-500/50 rounded-xl text-pink-300 font-bold text-xs uppercase transition-all shadow-lg flex items-center"
                                                    >
                                                        <i className="fa-solid fa-play mr-2"></i> Play Fullscreen
                                                    </a>
                                                    <a
                                                        href={session.generated.videoUrl}
                                                        download={`animated_clone_${session.original.id}.mp4`}
                                                        className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-500/50 rounded-xl text-emerald-300 font-bold text-xs uppercase transition-all shadow-lg flex items-center"
                                                    >
                                                        <i className="fa-solid fa-download mr-2"></i> Save Video
                                                    </a>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-slate-600 text-center p-4">
                                                {session.generated.videoStatus === 'error' ? (
                                                    <div className="flex flex-col items-center">
                                                        <i className="fa-solid fa-triangle-exclamation text-2xl text-rose-500 mb-2 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]"></i>
                                                        <p className="text-[10px] text-rose-400 font-bold text-center px-4 mb-4 line-clamp-2">{session.generated.error}</p>
                                                        <button
                                                            onClick={() => generateVideo(i)}
                                                            className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 rounded-xl text-rose-300 font-bold text-[10px] uppercase transition-all shadow-lg flex items-center"
                                                        >
                                                            <i className="fa-solid fa-rotate-right mr-2"></i> Retry Video
                                                        </button>
                                                    </div>
                                                ) : session.generated.videoStatus === 'planning' || session.generated.videoStatus === 'generating' ? (
                                                    <>
                                                        <i className="fa-solid fa-video text-3xl mb-3 text-violet-400 filter drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]"></i>
                                                        <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-400 drop-shadow-[0_0_5px_rgba(139,92,246,0.5)]">
                                                            {session.generated.videoStatus === 'planning' ? 'Planning...' : 'Rendering...'}
                                                        </p>
                                                        <div className="w-16 h-1 bg-white/10 rounded-full mt-3 overflow-hidden mx-auto">
                                                            <div className="w-1/2 h-full bg-violet-500 rounded-full animate-[progress_1s_ease-in-out_infinite]"></div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {(session.generated.dataUrl || session.generated.upscaledUrl) && session.generated.status === 'done' ? (
                                                            <div className="flex flex-col items-center">
                                                                <i className="fa-solid fa-film text-3xl mb-4 text-violet-400 opacity-50"></i>
                                                                <button
                                                                    onClick={() => generateVideo(i)}
                                                                    className="px-6 py-3 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 rounded-xl font-black text-xs uppercase tracking-widest text-violet-300 shadow-lg shadow-violet-500/10 transition-all flex items-center"
                                                                >
                                                                    <i className="fa-solid fa-play mr-2"></i> Animate Clone
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <i className="fa-solid fa-lock text-2xl mb-2 opacity-20"></i>
                                                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-6">Generate image clone first to unlock video capabilities</p>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-[#161d2f] p-4 rounded-xl border border-white/5 flex-1 min-h-[50px] overflow-hidden group hover:border-violet-500/30 transition-colors flex flex-col justify-start">
                                        {session.generated.videoPlan ? (() => {
                                            try {
                                                const plan = typeof session.generated.videoPlan === 'string'
                                                    ? JSON.parse(session.generated.videoPlan)
                                                    : session.generated.videoPlan as any;

                                                return (
                                                    <div className="text-[11px] text-slate-300 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 overflow-y-auto custom-scrollbar h-full whitespace-pre-wrap">
                                                        <div className="mb-2"><span className="text-violet-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Concept</span> {plan.concept || "AI Directed Scene"}</div>
                                                        <div className="mb-2"><span className="text-violet-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Camera Movement</span> {plan.camera_movement || 'Static'}</div>
                                                        <div className="mb-2"><span className="text-violet-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Subject Action</span> {plan.subject_action || 'Ambient motion'}</div>
                                                        <div className="mb-2"><span className="text-violet-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Visual Style & Effects</span> {plan.visual_style_and_effects || plan.style || 'Cinematic'}</div>
                                                        <div><span className="text-violet-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Pacing</span> {plan.pacing || 'Natural'}</div>
                                                    </div>
                                                );
                                            } catch (e) {
                                                // Fallback for raw text/malformed JSON
                                                return (
                                                    <p className="text-[10px] sm:text-xs text-slate-300 line-clamp-4 leading-relaxed font-medium group-hover:text-slate-200">
                                                        <i className="fa-solid fa-scroll text-violet-400 mr-2"></i>
                                                        <span className="text-violet-300 font-bold">Raw Plan: </span>
                                                        {typeof session.generated.videoPlan === 'string'
                                                            ? session.generated.videoPlan
                                                            : JSON.stringify(session.generated.videoPlan, null, 2)}
                                                    </p>
                                                );
                                            }
                                        })() : <span className="text-slate-600 italic">Director mode planning metadata will appear here...</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* ── Header ─────────────────────────────────────── */}
                    <div className="text-center space-y-4">
                        <h2 className="text-6xl font-black uppercase tracking-tighter italic text-white leading-none">
                            <span className="text-pink-500">Viral</span> Cloning
                        </h2>
                        <p className="text-slate-400 font-medium text-lg">
                            Find high-performing stock assets and clone their style using Vision AI.
                        </p>
                    </div>

                    {/* ── Mode Toggle ────────────────────────────────── */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-[#0d1425] p-1.5 rounded-2xl border-2 border-[#1a2333] flex gap-1">
                            <button
                                onClick={() => setCloningType('keyword')}
                                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${cloningType === 'keyword'
                                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <i className="fa-solid fa-magnifying-glass mr-2" />
                                Keyword Cloning
                            </button>
                            <button
                                onClick={() => setCloningType('creator')}
                                className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${cloningType === 'creator'
                                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <i className="fa-solid fa-file-csv mr-2" />
                                Creator Cloning
                            </button>
                        </div>
                    </div>

                    {/* ── Content Switcher ───────────────────────────── */}
                    {
                        cloningType === 'creator' ? (
                            <div className="max-w-7xl mx-auto px-4 mb-10">
                                <CsvCloningMode onClone={handleClone} />
                            </div>
                        ) : (
                            <>
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
                                {
                                    lastConfig && !loading && results.length > 0 && (
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
                                    )
                                }

                                {/* ── No Results State ────────────────────────────── */}
                                {
                                    searchedOnce && !loading && results.length === 0 && !error && (
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
                                    )
                                }

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
                            </>
                        )
                    }

                    {/* ── Error Message ───────────────────────────────── */}
                    {
                        error && (
                            <div className="max-w-3xl mx-auto p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-200 text-center font-medium">
                                <i className="fa-solid fa-triangle-exclamation mr-2" />
                                {error}
                            </div>
                        )
                    }

                    {/* ── Success Message ─────────────────────────────── */}
                    {
                        successMsg && (
                            <div className="max-w-3xl mx-auto p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-200 text-center font-medium animate-in fade-in zoom-in duration-300">
                                <i className="fa-solid fa-check-circle mr-2" />
                                {successMsg}
                            </div>
                        )
                    }

                    {/* ── Loading / Cloning Progress ──────────────────── */}
                    {
                        (loading || cloning) && (
                            <div className="max-w-xl mx-auto space-y-3 animate-in fade-in duration-300">
                                <p className="text-pink-400 font-black text-xs uppercase tracking-[0.5em] animate-pulse text-center">{status}</p>
                                <div className="w-full h-2.5 bg-[#161d2f] rounded-full overflow-hidden relative">
                                    {cloning ? (
                                        <div
                                            className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-700 ease-out"
                                            style={{ width: `${Math.max(progressPercent, 10)}%` }}
                                        />
                                    ) : (
                                        <div className="h-full bg-pink-500 w-1/3 rounded-full" style={{ animation: 'progress 1.5s ease-in-out infinite' }} />
                                    )}
                                </div>
                                {cloning && (
                                    <p className="text-center text-slate-500 text-xs font-bold">{cloningProgress.current} / {cloningProgress.total} images</p>
                                )}
                            </div>
                        )
                    }

                    {
                        cloningType === 'keyword' && (
                            <>
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
                                                <button
                                                    onClick={() => handleClone(sortedResults)}
                                                    disabled={cloning || sortedResults.length < 2}
                                                    className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:opacity-40 rounded-xl font-black text-[10px] uppercase tracking-widest text-white shadow-lg shadow-pink-500/20 transition-all"
                                                >
                                                    <i className="fa-solid fa-clone mr-1.5" /> Clone All ({sortedResults.length})
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
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    toggleFav({ id: img.creatorId || img.creator, name: img.creator });
                                                                                }}
                                                                                className={`flex items-center gap-1 text-[10px] font-bold transition-all ${favCreators.some(f => f.id === (img.creatorId || img.creator))
                                                                                    ? 'text-pink-500'
                                                                                    : 'text-slate-500 hover:text-pink-400'
                                                                                    }`}
                                                                            >
                                                                                <i className={`fa-solid ${favCreators.some(f => f.id === (img.creatorId || img.creator)) ? 'fa-heart' : 'fa-user'} mr-1`} />
                                                                                {img.creator}
                                                                            </button>
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
                                                        Ready to clone
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
                                                    Clone {selectedIds.size}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )
                    }
                </>
            )}

            {/* ── ScanConfig Modal ────────────────────────────── */}
            {
                showConfigModal && (
                    <ScanConfigModal
                        eventName={query}
                        onConfirm={executeSearch}
                        onCancel={() => setShowConfigModal(false)}
                        initialConfig={{ aiOnly: false }}
                    />
                )
            }

            {/* ── Detail Modal ────────────────────────────────── */}
            {
                detailImage && (
                    <ImageDetailModal
                        img={detailImage}
                        onClose={() => setDetailImage(null)}
                        selected={selectedIds.has(detailImage.id)}
                        onToggle={() => toggleSelect(detailImage.id)}
                        onClone={() => { setDetailImage(null); handleClone([detailImage]); }}
                        cloning={cloning}
                    />
                )
            }
        </div >
    );
};

export default CloningMode;
