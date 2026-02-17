import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { HistoryItem, AnalysisResult, StockInsight, ImagePrompt, StoredImage, StoredVideo, StoredBatch } from '../types';

interface HistoryContextType {
    history: HistoryItem[];
    images: StoredImage[];
    videos: StoredVideo[];
    batches: StoredBatch[];
    addToHistory: (query: string, analysis: AnalysisResult | null, marketData: StockInsight[], prompts: ImagePrompt[]) => Promise<string | null>;
    updateHistoryPrompts: (id: string, prompts: ImagePrompt[]) => Promise<void>;
    deleteFromHistory: (id: string) => Promise<void>;
    clearHistory: () => Promise<void>;
    deleteImage: (filename: string) => Promise<void>;
    deleteVideo: (filename: string) => Promise<void>;
    deleteBatch: (filename: string) => Promise<void>;
    currentHistoryId: string | null;
    setCurrentHistoryId: (id: string | null) => void;
    isLoading: boolean;
    error: string | null;
    refreshHistory: () => void;
}

// Helper to get API base URL - assuming vite proxy or strict relative path
const API_BASE = '/api';

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export const useHistory = () => {
    const context = useContext(HistoryContext);
    if (!context) {
        throw new Error('useHistory must be used within a HistoryProvider');
    }
    return context;
};

interface HistoryProviderProps {
    children: ReactNode;
}

export const HistoryProvider: React.FC<HistoryProviderProps> = ({ children }) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [images, setImages] = useState<StoredImage[]>([]);
    const [videos, setVideos] = useState<StoredVideo[]>([]);
    const [batches, setBatches] = useState<StoredBatch[]>([]);

    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refreshHistory = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Load from Server
    useEffect(() => {
        const fetchAll = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [histRes, imgRes, vidRes, batchRes] = await Promise.all([
                    fetch(`${API_BASE}/history`),
                    fetch(`${API_BASE}/history/images`),
                    fetch(`${API_BASE}/history/videos`),
                    fetch(`${API_BASE}/history/batches`)
                ]);

                if (!histRes.ok) throw new Error('Failed to fetch history');

                const histData = await histRes.json();
                setHistory(histData.history || []);

                if (imgRes.ok) {
                    const imgData = await imgRes.json();
                    setImages(imgData.images || []);
                }
                if (vidRes.ok) {
                    const vidData = await vidRes.json();
                    setVideos(vidData.videos || []);
                }
                if (batchRes.ok) {
                    const batchData = await batchRes.json();
                    setBatches(batchData.batches || []);
                }

            } catch (err: any) {
                console.error("History fetch error:", err);
                setError("Failed to load data from server.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();
    }, [refreshTrigger]);

    const addToHistory = async (query: string, analysis: AnalysisResult | null, marketData: StockInsight[], prompts: ImagePrompt[]) => {
        const newItem: HistoryItem = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            query,
            analysis,
            marketData,
            prompts,
        };

        // Optimistic update
        setHistory(prev => [newItem, ...prev]);
        setCurrentHistoryId(newItem.id);

        try {
            const res = await fetch(`${API_BASE}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem),
            });
            if (!res.ok) throw new Error('Failed to save to server');
            return newItem.id;
        } catch (err) {
            console.error("Save history failed:", err);
            return null;
        }
    };

    const updateHistoryPrompts = async (id: string, prompts: ImagePrompt[]) => {
        // Optimistic update
        setHistory(prev => prev.map(item =>
            item.id === id ? { ...item, prompts } : item
        ));

        try {
            const res = await fetch(`${API_BASE}/history/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompts }), // Only sending prompts to update
            });
            if (!res.ok) throw new Error('Failed to update prompts on server');
        } catch (err) {
            console.error("Update history failed:", err);
        }
    };

    const deleteFromHistory = async (id: string) => {
        // Optimistic update
        setHistory(prev => prev.filter(item => item.id !== id));
        if (currentHistoryId === id) {
            setCurrentHistoryId(null);
        }

        try {
            const res = await fetch(`${API_BASE}/history/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete from server');
        } catch (err) {
            console.error("Delete history failed:", err);
            refreshHistory();
        }
    };

    const clearHistory = async () => {
        if (history.length === 0) return;

        // Optimistic clear
        const oldHistory = [...history]; // Backup
        setHistory([]);
        setCurrentHistoryId(null);

        try {
            // Delete one by one
            await Promise.all(oldHistory.map(item =>
                fetch(`${API_BASE}/history/${item.id}`, { method: 'DELETE' })
            ));
        } catch (err) {
            console.error("Clear history failed:", err);
            refreshHistory(); // Restore state from server
        }
    };

    const deleteImage = async (filename: string) => {
        setImages(prev => prev.filter(i => i.filename !== filename));
        try {
            await fetch(`${API_BASE}/history/images/${filename}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Failed to delete image", e);
            refreshHistory();
        }
    };

    const deleteVideo = async (filename: string) => {
        setVideos(prev => prev.filter(v => v.filename !== filename));
        try {
            await fetch(`${API_BASE}/history/videos/${filename}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Failed to delete video", e);
            refreshHistory();
        }
    };

    const deleteBatch = async (filename: string) => {
        setBatches(prev => prev.filter(b => b.filename !== filename));
        try {
            await fetch(`${API_BASE}/history/batches/${filename}`, { method: 'DELETE' });
        } catch (e) {
            console.error("Failed to delete batch", e);
            refreshHistory();
        }
    };

    return (
        <HistoryContext.Provider value={{
            history,
            images,
            videos,
            batches,
            addToHistory,
            updateHistoryPrompts,
            deleteFromHistory,
            clearHistory,
            deleteImage,
            deleteVideo,
            deleteBatch,
            currentHistoryId,
            setCurrentHistoryId,
            isLoading,
            error,
            refreshHistory
        }}>
            {children}
        </HistoryContext.Provider>
    );
};
