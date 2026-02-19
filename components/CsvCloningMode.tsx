import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { StockInsight } from '../types';

interface CsvCloningModeProps {
    onClone: (selectedImages: StockInsight[]) => void;
}

const CsvCloningMode: React.FC<CsvCloningModeProps> = ({ onClone }) => {
    const [data, setData] = useState<StockInsight[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedData: StockInsight[] = results.data.map((row: any) => ({
                    id: row['Asset ID'] || '',
                    title: row['Title'] || '',
                    thumbnailUrl: row['Thumbnail URL'] || '',
                    downloads: row['Downloads'] ? parseInt(row['Downloads'], 10) : 0,
                    premium: row['Premium'] || 'Standard',
                    creator: row['Creator'] || 'Unknown',
                    creatorId: row['Creator ID'] || '',
                    mediaType: row['Media Type']?.toLowerCase() || 'photo',
                    contentType: row['Content Type'] || 'image/jpeg',
                    dimensions: row['Dimensions'] || '',
                    uploadDate: row['Creation Date'] || '',
                    keywords: row['Keywords'] ? row['Keywords'].split(',').map((k: string) => k.trim()) : [],
                    isAI: false, // Default to false unless specified
                })).filter(item => item.id && item.thumbnailUrl); // Filter out invalid rows

                setData(parsedData);
            },
        });
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === data.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.map(d => d.id)));
        }
    };

    const handleClone = () => {
        const selectedImages = data.filter(d => selectedIds.has(d.id));
        onClone(selectedImages);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* File Upload Section */}
            <div
                className="border-2 border-dashed border-[#1a2333] hover:border-pink-500/50 rounded-[2rem] p-12 text-center transition-all cursor-pointer bg-[#0d1425] group"
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileUpload}
                />
                <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto bg-[#161d2f] rounded-full flex items-center justify-center border border-white/5 group-hover:scale-110 group-hover:border-pink-500/30 transition-all duration-300">
                        <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 group-hover:text-pink-400 transition-colors" />
                    </div>
                    <div>
                        <p className="text-xl font-black text-slate-200 uppercase tracking-wide">
                            {fileName || "Click to upload CSV"}
                        </p>
                        {!fileName && <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">or drag and drop</p>}
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">
                            Supports Adobe Stock CSV export format
                        </p>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            {data.length > 0 && (
                <div className="bg-[#0d1425] rounded-[2rem] border border-[#1a2333] overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#161d2f]/50">
                        <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 text-xs">
                                <i className="fa-solid fa-table-list" />
                            </span>
                            Loaded {data.length} Assets
                        </h3>
                        <div className="flex items-center space-x-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                <span className="text-pink-400">{selectedIds.size}</span> selected
                            </span>
                            <button
                                onClick={handleClone}
                                disabled={selectedIds.size === 0}
                                className="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-500 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-pink-500/20 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-dna" />
                                Clone Selected
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[600px]">
                        <table className="min-w-full divide-y divide-white/5">
                            <thead className="bg-[#161d2f] sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 text-left w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === data.length && data.length > 0}
                                            onChange={toggleAll}
                                            className="w-4 h-4 rounded border-white/10 bg-[#0d1425] text-pink-500 focus:ring-offset-[#0d1425] focus:ring-pink-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Preview</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">ID</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Title</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Downloads</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-500">Creator</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 bg-transparent">
                                {data.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`group transition-colors cursor-pointer ${selectedIds.has(item.id) ? 'bg-pink-500/10 hover:bg-pink-500/20' : 'hover:bg-white/5'}`}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => toggleSelection(item.id)}
                                                className="w-4 h-4 rounded border-white/10 bg-[#0d1425] text-pink-500 focus:ring-offset-[#0d1425] focus:ring-pink-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="w-16 h-12 rounded-lg overflow-hidden border border-white/10 relative">
                                                <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                                            {item.id}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-200 max-w-xs truncate" title={item.title}>
                                            {item.title}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-emerald-400">
                                            {item.downloads}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-400">
                                            {item.creator}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CsvCloningMode;
