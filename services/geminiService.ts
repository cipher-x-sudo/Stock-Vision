/**
 * Gemini service — all calls proxied through Express backend.
 * No API key is exposed to the frontend.
 */
import { AnalysisResult, StockInsight, GroundingSource, CreativeBrief, ImagePrompt } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";

/** Short, search-friendly keywords for TrackAdobe. */
export const generateVarietyKeywords = async (eventName: string): Promise<string[]> => {
  const res = await fetch(`${API_BASE}/api/generate-keywords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.keywords;
};

export const analyzeMarketData = async (eventName: string, rawData: StockInsight[]): Promise<AnalysisResult> => {
  const res = await fetch(`${API_BASE}/api/analyze-market`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, rawData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return await res.json();
};

export const getSuggestedEvents = async (): Promise<any[]> => {
  const res = await fetch(`${API_BASE}/api/suggested-events`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.events;
};

export const generateImagePrompts = async (
  eventName: string,
  brief: CreativeBrief,
  _assetSummary?: string
): Promise<ImagePrompt[]> => {
  const res = await fetch(`${API_BASE}/api/generate-prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, brief }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.prompts;
};
