
import React, { useState, useEffect, useRef } from 'react';
import { ScanConfig, ContentTypeFilter, SortOrder } from '../types';

interface ScanConfigModalProps {
    eventName: string;
    onConfirm: (config: ScanConfig) => void;
    onCancel: () => void;
    initialConfig?: Partial<ScanConfig>;
}

const CONTENT_TYPES: { value: ContentTypeFilter; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'fa-layer-group' },
    { value: 'photo', label: 'Photo', icon: 'fa-camera' },
    { value: 'video', label: 'Video', icon: 'fa-video' },
    { value: 'vector', label: 'Vector', icon: 'fa-bezier-curve' },
    { value: 'illustration', label: 'Illustration', icon: 'fa-paintbrush' },
];

const SORT_OPTIONS: { value: SortOrder; label: string; icon: string }[] = [
    { value: 'relevance', label: 'Relevance', icon: 'fa-bullseye' },
    { value: 'nb_downloads', label: 'Most Downloads', icon: 'fa-download' },
    { value: 'creation', label: 'Newest', icon: 'fa-clock' },
    { value: 'featured', label: 'Featured', icon: 'fa-star' },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2014 }, (_, i) => currentYear - i);

const DEFAULT_CONFIG: ScanConfig = {
    minDownloads: 5,
    yearFrom: null,
    yearTo: null,
    aiOnly: true,
    contentType: 'all',
    order: 'relevance',
    startPage: 1,
    endPage: 3,
};

const ScanConfigModal: React.FC<ScanConfigModalProps> = ({ eventName, onConfirm, onCancel, initialConfig }) => {
    const [config, setConfig] = useState<ScanConfig>({ ...DEFAULT_CONFIG, ...initialConfig });
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onCancel]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === backdropRef.current) onCancel();
    };

    return (
        <div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        >
            <div
                className="w-full max-w-lg rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden"
                style={{ background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(24px)' }}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-sky-400">Scan Configuration</span>
                        <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors text-lg">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight leading-tight truncate">{eventName}</h2>
                </div>

                <div className="px-8 pb-8 space-y-6">
                    {/* Sort Order */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 block">Sort Order</label>
                        <div className="grid grid-cols-2 gap-2">
                            {SORT_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setConfig((c) => ({ ...c, order: opt.value }))}
                                    className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all border ${config.order === opt.value
                                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 shadow-lg shadow-sky-500/10'
                                        : 'bg-slate-800/60 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                                        }`}
                                >
                                    <i className={`fa-solid ${opt.icon} text-[11px]`}></i>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content Type */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 block">Asset Type</label>
                        <div className="flex flex-wrap gap-2">
                            {CONTENT_TYPES.map((ct) => (
                                <button
                                    key={ct.value}
                                    onClick={() => setConfig((c) => ({ ...c, contentType: ct.value }))}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border ${config.contentType === ct.value
                                        ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 shadow-lg shadow-sky-500/10'
                                        : 'bg-slate-800/60 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                                        }`}
                                >
                                    <i className={`fa-solid ${ct.icon} text-[11px]`}></i>
                                    {ct.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Page Range */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 block">Pages to Scan</label>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 gap-3">
                                <span className="text-slate-500 text-xs font-bold uppercase">From</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={config.startPage || 1}
                                    onChange={(e) => setConfig((c) => ({ ...c, startPage: Math.max(1, parseInt(e.target.value) || 1) }))}
                                    className="w-12 bg-transparent text-white text-sm font-black outline-none text-center"
                                />
                            </div>
                            <span className="text-slate-500 text-xs font-bold">to</span>
                            <div className="flex items-center bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 gap-3">
                                <span className="text-slate-500 text-xs font-bold uppercase">Page</span>
                                <input
                                    type="number"
                                    min={config.startPage || 1}
                                    value={config.endPage || 1}
                                    onChange={(e) => setConfig((c) => ({ ...c, endPage: Math.max(config.startPage || 1, parseInt(e.target.value) || 1) }))}
                                    className="w-12 bg-transparent text-white text-sm font-black outline-none text-center"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium">Adobe Stock pagination (approx. 100 images per page)</p>
                    </div>

                    {/* Min Downloads */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 block">Minimum Downloads</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min={0}
                                value={config.minDownloads}
                                onChange={(e) => setConfig((c) => ({ ...c, minDownloads: Math.max(0, parseInt(e.target.value) || 0) }))}
                                className="w-28 bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none focus:border-sky-500/50 transition-colors"
                            />
                            <span className="text-slate-500 text-xs font-medium">downloads minimum</span>
                        </div>
                    </div>

                    {/* Year Range */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3 block">Year of Publish</label>
                        <div className="flex items-center gap-3">
                            <select
                                value={config.yearFrom ?? ''}
                                onChange={(e) => setConfig((c) => ({ ...c, yearFrom: e.target.value ? parseInt(e.target.value) : null }))}
                                className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none focus:border-sky-500/50 transition-colors appearance-none cursor-pointer min-w-[100px]"
                            >
                                <option value="">Any</option>
                                {YEAR_OPTIONS.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <span className="text-slate-500 text-xs font-bold">to</span>
                            <select
                                value={config.yearTo ?? ''}
                                onChange={(e) => setConfig((c) => ({ ...c, yearTo: e.target.value ? parseInt(e.target.value) : null }))}
                                className="bg-slate-800/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none focus:border-sky-500/50 transition-colors appearance-none cursor-pointer min-w-[100px]"
                            >
                                <option value="">Any</option>
                                {YEAR_OPTIONS.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* AI Only Toggle */}
                    <div className="flex items-center justify-between bg-slate-800/40 rounded-xl px-5 py-4 border border-white/5">
                        <div>
                            <p className="text-sm font-bold text-slate-200">AI Generated Only</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Filter to AI-generated assets only</p>
                        </div>
                        <button
                            onClick={() => setConfig((c) => ({ ...c, aiOnly: !c.aiOnly }))}
                            className={`relative w-12 h-7 rounded-full transition-all ${config.aiOnly ? 'bg-sky-500' : 'bg-slate-700'
                                }`}
                        >
                            <span
                                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${config.aiOnly ? 'left-6' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-xs uppercase tracking-widest transition-all border border-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(config)}
                            className="flex-1 px-6 py-3.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-sky-500/30 flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-bolt-lightning"></i>
                            Start Scan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScanConfigModal;
