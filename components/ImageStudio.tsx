import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ImagePrompt } from '../types';
import { generateImageFromPrompt, upscaleImage, generateVideoFromImage, getBatchHistory, loadBatch } from '../services/imageGenService';
import type { GenerationSettings, HistoryBatch } from '../services/imageGenService';

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

interface GeneratedImage {
    prompt: ImagePrompt;
    dataUrl: string | null;
    upscaledUrl: string | null;
    status: 'idle' | 'generating' | 'done' | 'error';
    upscaleStatus: 'idle' | 'upscaling' | 'done' | 'error';
    error?: string;
    videoUrl?: string;
    videoStatus: 'idle' | 'planning' | 'generating' | 'done' | 'error';
    videoPlan?: any;
}

interface ImageStudioProps {
    sessionPrompts: ImagePrompt[];
}

const ImageStudio: React.FC<ImageStudioProps> = ({ sessionPrompts }) => {
    const [items, setItems] = useState<GeneratedImage[]>([]);
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
    const [upscaleBatchRunning, setUpscaleBatchRunning] = useState(false);
    const [upscaleBatchProgress, setUpscaleBatchProgress] = useState({ current: 0, total: 0 });
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyBatches, setHistoryBatches] = useState<HistoryBatch[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef(false);

    // Generation settings
    const [aspectRatio, setAspectRatio] = useState('');
    const [imageSize, setImageSize] = useState('1K');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(true);
    const [manualPrompt, setManualPrompt] = useState('');

    const currentSettings: GenerationSettings = { aspectRatio, imageSize, negativePrompt };

    // Auto-import prompts when they arrive from cloning or scan
    useEffect(() => {
        if (sessionPrompts.length > 0) {
            setItems(sessionPrompts.map(p => ({
                prompt: p,
                dataUrl: null,
                upscaledUrl: null,
                status: 'idle' as const,
                upscaleStatus: 'idle' as const,
                videoStatus: 'idle' as const,
            })));
        }
    }, [sessionPrompts]);

    // Load history
    const openHistory = useCallback(async () => {
        setHistoryOpen(true);
        try {
            const batches = await getBatchHistory();
            setHistoryBatches(batches);
        } catch (err) {
            console.error("Failed to load history", err);
        }
    }, []);

    const loadHistoryBatch = useCallback(async (filename: string) => {
        try {
            const prompts = await loadBatch(filename);
            setItems(prev => [
                ...prev,
                ...prompts.map(p => ({ prompt: p, dataUrl: null, upscaledUrl: null, status: 'idle', upscaleStatus: 'idle', videoStatus: 'idle' } as GeneratedImage))
            ]);
            setHistoryOpen(false);
        } catch (err) {
            console.error("Failed to load batch", err);
        }
    }, []);

    // Add manual prompt
    const addManualPrompt = useCallback(() => {
        const text = manualPrompt.trim();
        if (!text) return;
        const newPrompt: ImagePrompt = {
            scene: text,
            style: '',
            shot: { composition: '', resolution: '', lens: '' },
            lighting: { primary: '', secondary: '', accents: '' },
            color_palette: { background: '', ink_primary: '', ink_secondary: '', text_primary: '' },
            constraints: [],
            visual_rules: { prohibited_elements: [], grain: '', sharpen: '' },
            metadata: { series: '', task: '', scene_number: '', tags: [] },
        };
        setItems(prev => [...prev, { prompt: newPrompt, dataUrl: null, upscaledUrl: null, status: 'idle', upscaleStatus: 'idle', videoStatus: 'idle' }]);
        setManualPrompt('');
    }, [manualPrompt]);

    // Import from current scan session
    const importFromSession = useCallback(() => {
        if (sessionPrompts.length === 0) return;
        setItems(sessionPrompts.map(p => ({ prompt: p, dataUrl: null, upscaledUrl: null, status: 'idle', upscaleStatus: 'idle', videoStatus: 'idle' })));
    }, [sessionPrompts]);

    // Import from JSONL file
    const importFromFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim());
            const prompts: ImagePrompt[] = [];
            for (const line of lines) {
                try {
                    prompts.push(JSON.parse(line));
                } catch { /* skip invalid lines */ }
            }
            if (prompts.length > 0) {
                setItems(prompts.map(p => ({ prompt: p, dataUrl: null, upscaledUrl: null, status: 'idle', upscaleStatus: 'idle', videoStatus: 'idle' })));
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, []);

    // Generate single image
    const generateOne = useCallback(async (index: number) => {
        setItems(prev => prev.map((it, i) =>
            i === index ? { ...it, status: 'generating', error: undefined } : it
        ));
        try {
            const dataUrl = await generateImageFromPrompt(items[index].prompt, currentSettings);
            setItems(prev => prev.map((it, i) =>
                i === index ? { ...it, dataUrl, status: 'done' } : it
            ));
        } catch (err: any) {
            setItems(prev => prev.map((it, i) =>
                i === index ? { ...it, status: 'error', error: err.message } : it
            ));
        }
    }, [items, currentSettings]);

    // Generate all sequentially
    const generateAll = useCallback(async () => {
        abortRef.current = false;
        setBatchRunning(true);
        const total = items.filter(it => it.status !== 'done').length;
        setBatchProgress({ current: 0, total });
        let completed = 0;

        for (let i = 0; i < items.length; i++) {
            if (abortRef.current) break;
            if (items[i].status === 'done') continue;

            setItems(prev => prev.map((it, idx) =>
                idx === i ? { ...it, status: 'generating', error: undefined } : it
            ));

            try {
                const dataUrl = await generateImageFromPrompt(items[i].prompt, currentSettings);
                setItems(prev => prev.map((it, idx) =>
                    idx === i ? { ...it, dataUrl, status: 'done' } : it
                ));
            } catch (err: any) {
                setItems(prev => prev.map((it, idx) =>
                    idx === i ? { ...it, status: 'error', error: err.message } : it
                ));
            }

            completed++;
            setBatchProgress({ current: completed, total });
        }

        setBatchRunning(false);
    }, [items, currentSettings]);

    // Upscale single image to 4K
    const upscaleOne = useCallback(async (index: number) => {
        const item = items[index];
        if (!item.dataUrl) return;

        setItems(prev => prev.map((it, i) =>
            i === index ? { ...it, upscaleStatus: 'upscaling', error: undefined } : it
        ));
        try {
            const upscaledUrl = await upscaleImage(item.dataUrl);
            setItems(prev => prev.map((it, i) =>
                i === index ? { ...it, upscaledUrl, upscaleStatus: 'done' } : it
            ));
        } catch (err: any) {
            setItems(prev => prev.map((it, i) =>
                i === index ? { ...it, upscaleStatus: 'error', error: err.message } : it
            ));
        }
    }, [items]);

    // Upscale all generated images to 4K
    const upscaleAll = useCallback(async () => {
        abortRef.current = false;
        setUpscaleBatchRunning(true);
        const eligible = items.filter(it => it.status === 'done' && it.upscaleStatus !== 'done');
        setUpscaleBatchProgress({ current: 0, total: eligible.length });
        let completed = 0;

        for (let i = 0; i < items.length; i++) {
            if (abortRef.current) break;
            const item = items[i];
            if (item.status !== 'done' || item.upscaleStatus === 'done' || !item.dataUrl) continue;

            setItems(prev => prev.map((it, idx) =>
                idx === i ? { ...it, upscaleStatus: 'upscaling', error: undefined } : it
            ));

            try {
                const upscaledUrl = await upscaleImage(item.dataUrl);
                setItems(prev => prev.map((it, idx) =>
                    idx === i ? { ...it, upscaledUrl, upscaleStatus: 'done' } : it
                ));
            } catch (err: any) {
                setItems(prev => prev.map((it, idx) =>
                    idx === i ? { ...it, upscaleStatus: 'error', error: err.message } : it
                ));
            }

            completed++;
            setUpscaleBatchProgress({ current: completed, total: eligible.length });
        }

        setUpscaleBatchRunning(false);
    }, [items]);

    // Generate Video from Image
    const generateVideo = useCallback(async (index: number, fast: boolean) => {
        const item = items[index];
        const src = item.upscaledUrl || item.dataUrl;
        if (!src) return;

        setItems(prev => prev.map((it, i) =>
            i === index ? { ...it, videoStatus: 'planning', error: undefined } : it
        ));

        try {
            // Note: We use the item's prompt scene as the base, but the backend will generate a new plan
            const result = await generateVideoFromImage(src, item.prompt.scene, fast);

            setItems(prev => prev.map((it, i) =>
                i === index ? { ...it, videoUrl: result.videoUrl, videoPlan: result.plan, videoStatus: 'done' } : it
            ));
        } catch (err: any) {
            setItems(prev => prev.map((it, i) =>
                i === index ? { ...it, videoStatus: 'error', error: err.message } : it
            ));
        }
    }, [items]);

    const stopBatch = useCallback(() => {
        abortRef.current = true;
    }, []);

    // Download single image (use upscaled version if available)
    const downloadImage = useCallback((item: GeneratedImage, index: number) => {
        const src = item.upscaledUrl || item.dataUrl;
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = `nanobananapro-${index + 1}${item.upscaledUrl ? '-4K' : ''}.png`;
        a.click();
    }, []);

    // Download all generated images
    const downloadAll = useCallback(() => {
        items.forEach((item, i) => {
            const src = item.upscaledUrl || item.dataUrl;
            if (src) {
                setTimeout(() => {
                    const a = document.createElement('a');
                    a.href = src;
                    a.download = `nanobananapro-${i + 1}${item.upscaledUrl ? '-4K' : ''}.png`;
                    a.click();
                }, i * 200);
            }
        });
    }, [items]);

    const doneCount = items.filter(it => it.status === 'done').length;
    const upscaledCount = items.filter(it => it.upscaleStatus === 'done').length;
    const upscaleEligible = items.filter(it => it.status === 'done' && it.upscaleStatus !== 'done').length;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="border-b border-white/10 pb-8">
                <h2 className="text-5xl font-black uppercase tracking-tighter italic text-white leading-none mb-3">
                    <i className="fa-solid fa-wand-magic-sparkles text-violet-400 mr-4"></i>
                    Image Studio
                </h2>
                <p className="text-slate-400 text-sm">Generate and upscale images using Nano Banana Pro (Gemini 3 Pro Image)</p>
            </div>

            {/* Import Controls */}
            <div className="bg-[#0d1425] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-300 mb-6">
                    <i className="fa-solid fa-file-import text-sky-400 mr-3"></i>
                    Load Prompts
                </h3>
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={importFromSession}
                        disabled={sessionPrompts.length === 0}
                        className="px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all"
                    >
                        <i className="fa-solid fa-bolt mr-2"></i>
                        Import from Scan ({sessionPrompts.length})
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl font-black text-sm uppercase tracking-widest text-slate-300 transition-all"
                    >
                        <i className="fa-solid fa-upload mr-2"></i>
                        Import JSONL File
                    </button>
                    <button
                        onClick={openHistory}
                        className="px-6 py-3 bg-[#161d2f] hover:bg-[#1a2339] border border-white/10 rounded-xl font-black text-sm uppercase tracking-widest text-slate-300 transition-all"
                    >
                        <i className="fa-solid fa-clock-rotate-left mr-2"></i>
                        History
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jsonl,.json,.txt"
                        onChange={importFromFile}
                        className="hidden"
                    />
                </div>
                {items.length > 0 && (
                    <p className="mt-4 text-sky-400 text-xs font-black uppercase tracking-widest">
                        {items.length} prompts loaded · {doneCount} generated · {upscaledCount} upscaled to 4K
                    </p>
                )}
            </div>

            {/* Manual Prompt Entry */}
            <div className="bg-[#0d1425] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <h3 className="text-lg font-black uppercase tracking-widest text-slate-300 mb-4">
                    <i className="fa-solid fa-pen-fancy text-emerald-400 mr-3"></i>
                    Manual Prompt
                </h3>
                <div className="flex gap-3">
                    <textarea
                        value={manualPrompt}
                        onChange={(e) => setManualPrompt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addManualPrompt(); } }}
                        placeholder="Type your image prompt here... e.g. A photorealistic aerial view of a heart-shaped island surrounded by turquoise water, golden hour lighting"
                        rows={3}
                        className="flex-1 bg-[#161d2f] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 resize-none transition-all"
                    />
                    <button
                        onClick={addManualPrompt}
                        disabled={!manualPrompt.trim()}
                        className="px-6 self-end bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all h-12"
                    >
                        <i className="fa-solid fa-plus mr-2"></i>Add
                    </button>
                </div>
                <p className="mt-2 text-[10px] text-slate-600 uppercase tracking-wider">Press Enter to add · Shift+Enter for new line</p>
            </div>

            {/* ═══ Generation Settings Panel ═══ */}
            <div className="bg-[#0d1425] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className="w-full px-8 py-5 flex items-center justify-between text-left hover:bg-[#111b33] transition-colors"
                >
                    <h3 className="text-lg font-black uppercase tracking-widest text-slate-300">
                        <i className="fa-solid fa-sliders text-violet-400 mr-3"></i>
                        Generation Settings
                    </h3>
                    <div className="flex items-center gap-4">
                        {/* Quick summary when collapsed */}
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
                                            className={`w-full px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border text-left ${imageSize === r.value
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/10'
                                                : 'bg-[#161d2f] border-white/5 text-slate-400 hover:border-amber-500/30 hover:text-slate-300'
                                                }`}
                                        >
                                            {r.value === '4K' && <i className="fa-solid fa-crown text-amber-400 mr-2"></i>}
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Negative Prompt */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                    <i className="fa-solid fa-ban text-red-400 mr-2"></i>
                                    Negative Prompt
                                </label>
                                <textarea
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                    placeholder="Things to avoid... e.g. blurry, watermark, text, low quality, deformed"
                                    rows={5}
                                    className="w-full bg-[#161d2f] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/30 focus:ring-1 focus:ring-red-500/20 resize-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Active Settings Summary */}
                        <div className="mt-6 flex flex-wrap gap-3">
                            <div className="px-4 py-2 bg-[#161d2f] rounded-xl border border-white/5">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider mr-2">Ratio</span>
                                <span className="text-xs text-sky-400 font-bold">{aspectRatio || 'Auto'}</span>
                            </div>
                            <div className="px-4 py-2 bg-[#161d2f] rounded-xl border border-white/5">
                                <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider mr-2">Res</span>
                                <span className="text-xs text-amber-400 font-bold">{imageSize}</span>
                            </div>
                            {negativePrompt && (
                                <div className="px-4 py-2 bg-[#161d2f] rounded-xl border border-red-500/10">
                                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider mr-2">Neg</span>
                                    <span className="text-xs text-red-400 font-bold truncate max-w-[200px] inline-block align-bottom">
                                        {negativePrompt.slice(0, 40)}{negativePrompt.length > 40 ? '…' : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Generation + Upscale Controls */}
            {items.length > 0 && (
                <div className="flex flex-wrap gap-4 items-center">
                    {!batchRunning && !upscaleBatchRunning ? (
                        <>
                            {items.length - doneCount > 0 && (
                                <button
                                    onClick={generateAll}
                                    className="px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all shadow-lg shadow-violet-500/20"
                                >
                                    <i className="fa-solid fa-images mr-2"></i>
                                    Generate All ({items.length - doneCount} remaining)
                                </button>
                            )}
                            {upscaleEligible > 0 && (
                                <button
                                    onClick={upscaleAll}
                                    className="px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all shadow-lg shadow-amber-500/20"
                                >
                                    <i className="fa-solid fa-expand mr-2"></i>
                                    Upscale All 4K ({upscaleEligible})
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <div className="px-8 py-4 bg-violet-500/10 border border-violet-500/30 rounded-2xl">
                                <i className="fa-solid fa-spinner fa-spin text-violet-400 mr-3"></i>
                                <span className="text-violet-300 font-black text-sm uppercase tracking-widest">
                                    {batchRunning
                                        ? `Generating ${batchProgress.current}/${batchProgress.total}`
                                        : `Upscaling 4K ${upscaleBatchProgress.current}/${upscaleBatchProgress.total}`
                                    }
                                </span>
                            </div>
                            <button
                                onClick={stopBatch}
                                className="px-6 py-4 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 rounded-2xl font-black text-sm uppercase tracking-widest text-red-400 transition-all"
                            >
                                <i className="fa-solid fa-stop mr-2"></i> Stop
                            </button>
                        </>
                    )}
                    {doneCount > 0 && (
                        <button
                            onClick={downloadAll}
                            className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-sm uppercase tracking-widest text-white transition-all"
                        >
                            <i className="fa-solid fa-download mr-2"></i>
                            Download All ({doneCount})
                        </button>
                    )}
                </div>
            )}

            {/* Prompt Table with Images */}
            {items.length > 0 && (
                <div className="bg-[#0d1425] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-[#161d2f] text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                    <th className="px-4 py-4 w-12">#</th>
                                    <th className="px-4 py-4 w-24">Image</th>
                                    <th className="px-4 py-4">Scene</th>
                                    <th className="px-4 py-4">Style</th>
                                    <th className="px-4 py-4 w-28">Status</th>
                                    <th className="px-4 py-4 w-24">4K</th>
                                    <th className="px-4 py-4 w-24">Video</th>
                                    <th className="px-4 py-4 w-44">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={i} className="border-t border-white/5 hover:bg-[#161d2f]/50 transition-colors">
                                        <td className="px-4 py-3 text-sky-500 font-black">{i + 1}</td>
                                        <td className="px-4 py-3">
                                            {(item.upscaledUrl || item.dataUrl) ? (
                                                <img
                                                    src={item.upscaledUrl || item.dataUrl!}
                                                    alt={`Generated ${i + 1}`}
                                                    className={`w-16 h-16 rounded-lg object-cover cursor-pointer border transition-all hover:scale-110 ${item.upscaledUrl
                                                        ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                                                        : 'border-white/10 hover:border-sky-500/50'
                                                        }`}
                                                    onClick={() => setZoomedImage(item.upscaledUrl || item.dataUrl)}
                                                />
                                            ) : item.status === 'generating' ? (
                                                <div className="w-16 h-16 rounded-lg bg-[#161d2f] border border-violet-500/30 flex items-center justify-center">
                                                    <i className="fa-solid fa-spinner fa-spin text-violet-400"></i>
                                                </div>
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-[#161d2f] border border-white/5 flex items-center justify-center">
                                                    <i className="fa-solid fa-image text-slate-700"></i>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-200 max-w-[250px] truncate" title={item.prompt.scene}>
                                            {item.prompt.scene || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 max-w-[150px] truncate" title={item.prompt.style}>
                                            {item.prompt.style || "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.status === 'idle' && <span className="text-slate-600 text-xs font-bold uppercase">Pending</span>}
                                            {item.status === 'generating' && (
                                                <span className="text-violet-400 text-xs font-bold uppercase">
                                                    <i className="fa-solid fa-spinner fa-spin mr-1"></i> Working
                                                </span>
                                            )}
                                            {item.status === 'done' && (
                                                <span className="text-emerald-400 text-xs font-bold uppercase">
                                                    <i className="fa-solid fa-check mr-1"></i> Done
                                                </span>
                                            )}
                                            {item.status === 'error' && (
                                                <span className="text-red-400 text-xs font-bold uppercase" title={item.error}>
                                                    <i className="fa-solid fa-xmark mr-1"></i> Error
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.upscaleStatus === 'idle' && item.status === 'done' && (
                                                <span className="text-slate-600 text-xs font-bold uppercase">—</span>
                                            )}
                                            {item.upscaleStatus === 'upscaling' && (
                                                <span className="text-amber-400 text-xs font-bold uppercase">
                                                    <i className="fa-solid fa-spinner fa-spin mr-1"></i> 4K
                                                </span>
                                            )}
                                            {item.upscaleStatus === 'done' && (
                                                <span className="text-amber-400 text-xs font-bold uppercase">
                                                    <i className="fa-solid fa-crown mr-1"></i> 4K
                                                </span>
                                            )}
                                            {item.upscaleStatus === 'error' && (
                                                <span className="text-red-400 text-xs font-bold uppercase" title={item.error}>
                                                    <i className="fa-solid fa-xmark mr-1"></i> Fail
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.videoStatus === 'idle' && <span className="text-slate-600 text-xs font-bold uppercase">—</span>}
                                            {item.videoStatus === 'planning' && <span className="text-sky-400 text-xs font-bold uppercase"><i className="fa-solid fa-brain fa-spin mr-1"></i> Plan</span>}
                                            {item.videoStatus === 'generating' && <span className="text-sky-400 text-xs font-bold uppercase"><i className="fa-solid fa-video fa-spin mr-1"></i> Gen</span>}
                                            {item.videoStatus === 'done' && <span className="text-pink-400 text-xs font-bold uppercase"><i className="fa-solid fa-film mr-1"></i> Ready</span>}
                                            {item.videoStatus === 'error' && <span className="text-red-400 text-xs font-bold uppercase"><i className="fa-solid fa-xmark mr-1"></i> Fail</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 flex-wrap">
                                                {item.status !== 'done' && item.status !== 'generating' && (
                                                    <button
                                                        onClick={() => generateOne(i)}
                                                        disabled={batchRunning || upscaleBatchRunning}
                                                        className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 rounded-lg text-violet-400 text-xs font-bold uppercase transition-all disabled:opacity-30"
                                                    >
                                                        Generate
                                                    </button>
                                                )}
                                                {item.dataUrl && item.upscaleStatus !== 'done' && item.upscaleStatus !== 'upscaling' && (
                                                    <button
                                                        onClick={() => upscaleOne(i)}
                                                        disabled={batchRunning || upscaleBatchRunning}
                                                        className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg text-amber-400 text-xs font-bold uppercase transition-all disabled:opacity-30"
                                                    >
                                                        4K
                                                    </button>
                                                )}
                                                {(item.dataUrl || item.upscaledUrl) && item.videoStatus === 'idle' && (
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => generateVideo(i, false)}
                                                            className="px-3 py-1.5 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 rounded-lg text-sky-400 text-xs font-bold uppercase transition-all"
                                                            title="Generate Video (Veo 3.1)"
                                                        >
                                                            Video
                                                        </button>
                                                        <button
                                                            onClick={() => generateVideo(i, true)}
                                                            className="px-2 py-1.5 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 rounded-lg text-sky-400 text-xs font-bold uppercase transition-all"
                                                            title="Fast Mode"
                                                        >
                                                            <i className="fa-solid fa-bolt"></i>
                                                        </button>
                                                    </div>
                                                )}
                                                {item.videoStatus === 'planning' && (
                                                    <span className="text-sky-400 text-[10px] font-bold uppercase animate-pulse self-center">Planning...</span>
                                                )}
                                                {item.videoStatus === 'generating' && (
                                                    <span className="text-sky-400 text-[10px] font-bold uppercase animate-pulse self-center">Rendering...</span>
                                                )}
                                                {item.videoUrl && (
                                                    <a
                                                        href={item.videoUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-3 py-1.5 bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/20 rounded-lg text-pink-400 text-xs font-bold uppercase transition-all"
                                                    >
                                                        <i className="fa-solid fa-play mr-1"></i> Play
                                                    </a>
                                                )}
                                                {(item.dataUrl || item.upscaledUrl) && (
                                                    <button
                                                        onClick={() => downloadImage(item, i)}
                                                        className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-lg text-emerald-400 text-xs font-bold uppercase transition-all"
                                                    >
                                                        <i className="fa-solid fa-download"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
            }

            {/* Empty State */}
            {
                items.length === 0 && (
                    <div className="text-center py-32">
                        <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                            <i className="fa-solid fa-wand-magic-sparkles text-4xl text-violet-400"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-400 uppercase tracking-wider mb-3">No Prompts Loaded</h3>
                        <p className="text-slate-600 text-sm max-w-md mx-auto">
                            Import prompts from a scan session or load a JSONL file to start generating images.
                        </p>
                    </div>
                )
            }

            {/* Zoom Modal */}
            {
                zoomedImage && (
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8 cursor-pointer"
                        onClick={() => setZoomedImage(null)}
                    >
                        <img
                            src={zoomedImage}
                            alt="Zoomed"
                            className="max-w-full max-h-full rounded-2xl shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setZoomedImage(null)}
                            className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                )
            }

            {/* History Modal */}
            {historyOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-8">
                    <div className="bg-[#0d1425] rounded-[2.5rem] border border-white/5 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-2xl font-black uppercase tracking-widest text-white">
                                <i className="fa-solid fa-clock-rotate-left text-sky-400 mr-3"></i>
                                History
                            </h3>
                            <button
                                onClick={() => setHistoryOpen(false)}
                                className="w-10 h-10 bg-[#161d2f] rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#1e2a4a] transition-all"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-4">
                            {historyBatches.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <i className="fa-solid fa-box-open text-4xl mb-4 opacity-50"></i>
                                    <p>No history found</p>
                                </div>
                            ) : (
                                historyBatches.map(batch => (
                                    <div key={batch.filename} className="bg-[#161d2f] p-6 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-sky-500/30 transition-all">
                                        <div>
                                            <div className="text-sky-400 font-bold text-xs uppercase tracking-widest mb-1">
                                                {new Date(batch.date).toLocaleString()}
                                            </div>
                                            <div className="text-white font-black text-lg">
                                                {batch.count} Prompts
                                            </div>
                                            <div className="text-slate-500 text-xs font-mono mt-1">
                                                {batch.filename}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => loadHistoryBatch(batch.filename)}
                                            className="px-6 py-3 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500 text-sky-400 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all"
                                        >
                                            Load <i className="fa-solid fa-download ml-2"></i>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default ImageStudio;
