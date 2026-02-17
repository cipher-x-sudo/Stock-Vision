import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { HistoryItem, AnalysisResult, StockInsight, ImagePrompt } from '../types';

interface HistoryContextType {
    history: HistoryItem[];
    addToHistory: (query: string, analysis: AnalysisResult | null, marketData: StockInsight[], prompts: ImagePrompt[]) => Promise<string | null>;
    updateHistoryPrompts: (id: string, prompts: ImagePrompt[]) => Promise<void>;
    deleteFromHistory: (id: string) => Promise<void>;
    clearHistory: () => Promise<void>; // Server might not support clear all yet, but we can implement iteration
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
    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const refreshHistory = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Load from Server
    useEffect(() => {
        const fetchHistory = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE}/history`);
                if (!res.ok) throw new Error('Failed to fetch history');
                const data = await res.json();
                setHistory(data.history || []);
            } catch (err: any) {
                console.error("History fetch error:", err);
                setError("Failed to load history from server.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
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
            // Revert optimistic update? Or just warn?
            // For now, warn but keep in local state (it will be lost on reload if save failed)
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
            // Could re-fetch to restore sync
            refreshHistory();
        }
    };

    const clearHistory = async () => {
        // This requires iterating delete or a clearer endpoint. 
        // Implementing client-side iteration as temporary solution since server doesn't have bulk delete yet.
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

    return (
        <HistoryContext.Provider value={{
            history,
            addToHistory,
            updateHistoryPrompts,
            deleteFromHistory,
            clearHistory,
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
