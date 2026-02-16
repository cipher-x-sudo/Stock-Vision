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

export const generateVideoFromImage = async (
    imageDataUrl: string,
    prompt?: string,
    isFast: boolean = false
): Promise<{ videoUrl: string; plan: any; prompt: string }> => {
    const res = await fetch(`${API_BASE}/api/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl, prompt, fast: isFast }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return await res.json();
};
