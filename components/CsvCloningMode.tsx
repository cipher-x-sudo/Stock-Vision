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
        <div className="space-y-6">
            {/* File Upload Section */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileUpload}
                />
                <div className="text-gray-600">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-lg font-medium">{fileName || "Click to upload CSV or drag and drop"}</p>
                    <p className="text-sm text-gray-400 mt-2">Supports Adobe Stock CSV export format</p>
                </div>
            </div>

            {/* Data Table */}
            {data.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-800">
                            Loaded {data.length} Assets
                        </h3>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">
                                {selectedIds.size} selected
                            </span>
                            <button
                                onClick={handleClone}
                                disabled={selectedIds.size === 0}
                                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${selectedIds.size > 0
                                        ? 'bg-blue-600 hover:bg-blue-700'
                                        : 'bg-gray-300 cursor-not-allowed'
                                    }`}
                            >
                                Clone Selected
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[600px]">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === data.length && data.length > 0}
                                            onChange={toggleAll}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Downloads</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`hover:bg-gray-50 ${selectedIds.has(item.id) ? 'bg-blue-50' : ''}`}
                                        onClick={() => toggleSelection(item.id)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => toggleSelection(item.id)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <img src={item.thumbnailUrl} alt={item.title} className="h-12 w-16 object-cover rounded" />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item.title}>
                                            {item.title}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.downloads}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
