const API_BASE = import.meta.env.VITE_API_URL || "";

import type { ImagePrompt } from "../types";

export interface GenerationSettings {
    aspectRatio: string;
    imageSize: string;
    negativePrompt: string;
}

export const generateImageFromPrompt = async (
    prompt: ImagePrompt,
    settings?: GenerationSettings
): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...prompt,
            ...(settings?.aspectRatio && { aspectRatio: settings.aspectRatio }),
            ...(settings?.imageSize && settings.imageSize !== "1K" && { imageSize: settings.imageSize }),
            ...(settings?.negativePrompt && { negativePrompt: settings.negativePrompt }),
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.image; // data:image/png;base64,...
};

export const upscaleImage = async (imageDataUrl: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/upscale-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.image;
};

export const generateVideoPlanFromImage = async (
    imageDataUrl: string,
    prompt?: string
): Promise<{ plan: any }> => {
    const res = await fetch(`${API_BASE}/api/generate-video-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl, prompt }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
};

export const renderVideoFromPlan = async (
    imageDataUrl: string,
    prompt?: string,
    plan?: any,
    isFast: boolean = false
): Promise<{ videoUrl: string }> => {
    const res = await fetch(`${API_BASE}/api/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl, prompt, plan, fast: isFast }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
};

export interface HistoryBatch {
    filename: string;
    date: string;
    count: number;
    timestamp: number;
}

export const getBatchHistory = async (): Promise<HistoryBatch[]> => {
    const res = await fetch(`${API_BASE}/api/history/batches`);
    if (!res.ok) throw new Error("Failed to load history");
    const data = await res.json();
    return data.batches;
};

export const loadBatch = async (filename: string): Promise<ImagePrompt[]> => {
    const res = await fetch(`${API_BASE}/api/history/batches/${filename}`);
    if (!res.ok) throw new Error("Failed to load batch");
    return await res.json();
};
