import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HistoryItem, AnalysisResult, StockInsight, ImagePrompt } from '../types';

interface HistoryContextType {
    history: HistoryItem[];
    addToHistory: (query: string, analysis: AnalysisResult | null, marketData: StockInsight[], prompts: ImagePrompt[]) => void;
    updateHistoryPrompts: (id: string, prompts: ImagePrompt[]) => void;
    deleteFromHistory: (id: string) => void;
    clearHistory: () => void;
    currentHistoryId: string | null;
    setCurrentHistoryId: (id: string | null) => void;
}

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

    // Load from localStorage on mount
    useEffect(() => {
        const savedHistory = localStorage.getItem('stockVisionHistory');
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory));
            } catch (e) {
                console.error("Failed to parse history from localStorage", e);
            }
        }
    }, []);

    // Save to localStorage whenever history changes
    useEffect(() => {
        localStorage.setItem('stockVisionHistory', JSON.stringify(history));
    }, [history]);

    const addToHistory = (query: string, analysis: AnalysisResult | null, marketData: StockInsight[], prompts: ImagePrompt[]) => {
        const newItem: HistoryItem = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            query,
            analysis,
            marketData,
            prompts,
        };

        setHistory(prev => [newItem, ...prev]);
        setCurrentHistoryId(newItem.id);
        return newItem.id;
    };

    const updateHistoryPrompts = (id: string, prompts: ImagePrompt[]) => {
        setHistory(prev => prev.map(item =>
            item.id === id ? { ...item, prompts } : item
        ));
    };

    const deleteFromHistory = (id: string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
        if (currentHistoryId === id) {
            setCurrentHistoryId(null);
        }
    };

    const clearHistory = () => {
        setHistory([]);
        setCurrentHistoryId(null);
    };

    return (
        <HistoryContext.Provider value={{
            history,
            addToHistory,
            updateHistoryPrompts,
            deleteFromHistory,
            clearHistory,
            currentHistoryId,
            setCurrentHistoryId
        }}>
            {children}
        </HistoryContext.Provider>
    );
};
