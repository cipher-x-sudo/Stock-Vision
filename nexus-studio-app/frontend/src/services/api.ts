/**
 * Nexus Studio API client — talks to merged backend (Stock-Vision + Flow).
 * Base URL: empty in dev (Vite proxy to /api) or VITE_API_URL when set.
 */
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function url(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const full = BASE ? `${BASE}${p}` : p;
  if (!params) return full;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, String(v));
  });
  const q = search.toString();
  return q ? `${full}?${q}` : full;
}

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const res = await fetch(url(path, params));
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { message?: string; error?: string }).message ?? (err as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { message?: string; error?: string }).message ?? (err as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { message?: string; error?: string }).message ?? (err as { error?: string }).error ?? "Request failed");
  }
  return res.json();
}

// ── Types (align with backend) ─────────────────────────────────
export interface SuggestedEvent {
  name: string;
  date: string;
  category: string;
  description: string;
  icon: string;
}

export interface TrackAdobeImage {
  id: string;
  title: string;
  downloads?: string;
  creator?: string;
  creatorId?: string;
  mediaType?: string;
  category?: string;
  contentType?: string;
  dimensions?: string;
  uploadDate?: string;
  keywords?: string[];
  thumbnailUrl?: string;
  isAI?: boolean;
  premium?: string;
}

export interface AnalysisBrief {
  event?: string;
  bestSellers?: string[];
  shotList?: Array<{ idea: string; type: string; description: string; whyItWorks: string }>;
}

export interface TrendPoint {
  month: string;
  demand: number;
  saturation: number;
}

export interface AnalysisResult {
  brief: AnalysisBrief;
  trends: TrendPoint[];
  insights?: unknown[];
  sources?: unknown[];
}

export interface ImagePromptFromApi {
  scene: string;
  style?: string;
  constraints?: string[];
  shot?: { composition?: string; resolution?: string; lens?: string };
  lighting?: { primary?: string; secondary?: string; accents?: string };
  color_palette?: Record<string, string>;
  visual_rules?: { prohibited_elements?: string[]; grain?: string; sharpen?: string };
  metadata?: Record<string, unknown>;
}

/** Prompt shape used by PromptTable (id, scene, style, lighting). */
export interface PromptRow {
  id: number;
  scene: string;
  style: string;
  lighting: string;
}

/** Map API prompt objects to PromptTable shape. */
export function mapApiPromptsToRows(prompts: ImagePromptFromApi[]): PromptRow[] {
  return prompts.map((p, i) => ({
    id: i + 1,
    scene: p.scene ?? "",
    style: p.style ?? "",
    lighting: p.lighting?.primary ?? "",
  }));
}

// ── Flow (Veo4K) types (match backend) ─────────────────────────
/** GET /api/flow/config response. */
export interface FlowConfig {
  imageModels: string[];
  videoModels: string[];
  imageAspects: string[];
  videoAspects: string[];
  defaults: {
    imageModel: string;
    videoModel: string;
    imageAspect: string;
    videoAspect: string;
    imageCount: number;
  };
  outputDir?: string;
  autoDownload?: boolean;
  autoDownloadUpscaledOnly?: boolean;
  cloudPullOnStartup?: boolean;
  autoDownloadPrefix?: string;
  autoDownloadSuffix?: string;
  maxConcurrentUpscales?: number;
  upscaleStartDelayMs?: number;
  configFilePath?: string;
}

/** Item from GET /api/flow/history { items }. */
export interface FlowHistoryItem {
  type: "image" | "video";
  url: string;
  thumbnail_url?: string;
  prompt: string;
  model?: string;
  aspect?: string;
  seed?: number;
  media_generation_id?: string;
  has4K?: boolean;
  upscaled4K?: unknown;
}

// ── API methods ────────────────────────────────────────────────

export const api = {
  /** GET /api/suggested-events */
  async suggestedEvents(): Promise<{ events: SuggestedEvent[] }> {
    return get<{ events: SuggestedEvent[] }>("/api/suggested-events");
  },

  /** GET /api/track-adobe */
  async trackAdobe(params: {
    q: string;
    page?: number;
    endPage?: number;
    ai_only?: boolean;
    content_type?: string;
    order?: string;
  }): Promise<{ images: TrackAdobeImage[]; usage?: unknown }> {
    const qs: Record<string, string | number | boolean | undefined> = {
      q: params.q,
      page: params.page ?? 1,
      ai_only: params.ai_only ? "1" : undefined,
      content_type: params.content_type,
      order: params.order,
    };
    if (params.endPage != null) qs.endPage = params.endPage;
    return get<{ images: TrackAdobeImage[]; usage?: unknown }>("/api/track-adobe", qs);
  },

  /** POST /api/analyze-market */
  async analyzeMarket(body: { eventName: string; rawData: TrackAdobeImage[] }): Promise<AnalysisResult> {
    return post<AnalysisResult>("/api/analyze-market", body);
  },

  /** POST /api/generate-prompts */
  async generatePrompts(body: { eventName: string; brief: AnalysisBrief }): Promise<{ prompts: ImagePromptFromApi[]; url?: string }> {
    return post<{ prompts: ImagePromptFromApi[]; url?: string }>("/api/generate-prompts", body);
  },

  /** POST /api/generate-idea-prompts */
  async generateIdeaPrompts(body: { idea: string; count: number }): Promise<{ prompts: ImagePromptFromApi[] }> {
    return post<{ prompts: ImagePromptFromApi[] }>("/api/generate-idea-prompts", body);
  },

  /** POST /api/generate-cloning-prompts */
  async generateCloningPrompts(body: { images: Array<{ url: string; title?: string; id?: string }> }): Promise<{ prompts: ImagePromptFromApi[] }> {
    return post<{ prompts: ImagePromptFromApi[] }>("/api/generate-cloning-prompts", body);
  },

  /** POST /api/generate-image */
  async generateImage(body: {
    scene: string;
    style?: string;
    shot?: { composition?: string; lens?: string };
    lighting?: { primary?: string };
    aspectRatio?: string;
    imageSize?: string;
    [key: string]: unknown;
  }): Promise<{ image?: string; url?: string }> {
    return post<{ image?: string; url?: string }>("/api/generate-image", body);
  },

  /** POST /api/upscale-image */
  async upscaleImage(body: { image: string }): Promise<{ image?: string; url?: string }> {
    return post<{ image?: string; url?: string }>("/api/upscale-image", body);
  },

  /** POST /api/generate-video-plan */
  async generateVideoPlan(body: { image: string; prompt?: string }): Promise<{ plan: unknown }> {
    return post<{ plan: unknown }>("/api/generate-video-plan", body);
  },

  /** POST /api/generate-video */
  async generateVideo(body: {
    image: string;
    prompt?: string;
    plan?: unknown;
    fast?: boolean;
    videoAspectRatio?: string;
    videoResolution?: string;
  }): Promise<{ videoUrl?: string }> {
    return post<{ videoUrl?: string }>("/api/generate-video", body);
  },

  /** GET /api/history */
  async history(): Promise<{ history: unknown[] }> {
    return get<{ history: unknown[] }>("/api/history");
  },

  /** GET /api/history/images */
  async historyImages(): Promise<{ images: Array<{ filename: string; url: string; timestamp: number; size: number }> }> {
    return get("/api/history/images");
  },

  /** GET /api/history/videos */
  async historyVideos(): Promise<{ videos: Array<{ filename: string; url: string; timestamp: number; size: number }> }> {
    return get("/api/history/videos");
  },

  /** GET /api/history/batches */
  async historyBatches(): Promise<{ batches: Array<{ filename: string; url: string; timestamp: number; size?: number }> }> {
    return get("/api/history/batches");
  },

  /** GET /api/health */
  async health(): Promise<{ ok: boolean }> {
    return get<{ ok: boolean }>("/api/health");
  },

  /** GET /api/favorites/contributors */
  async getFavoriteContributors(): Promise<{ contributors: Array<{ id: string; [key: string]: unknown }> }> {
    return get("/api/favorites/contributors");
  },

  /** POST /api/favorites/contributors — toggle favorite (body = creator with id). */
  async toggleFavoriteContributor(creator: { id: string; [key: string]: unknown }): Promise<{ success: boolean; action: string; contributors: unknown[] }> {
    return post("/api/favorites/contributors", creator);
  },

  /** POST /api/generate-keywords — event keywords for stock search. */
  async generateKeywords(body: { eventName: string }): Promise<{ keywords: string[] }> {
    return post<{ keywords: string[] }>("/api/generate-keywords", body);
  },

  // ── Veo4K Flow (image/video generation) ───────────────────────────────────

  /** GET /api/flow/config — model lists and defaults (matches backend flow config). */
  async flowConfig(): Promise<FlowConfig> {
    try {
      return await get<FlowConfig>("/api/flow/config");
    } catch {
      return {
        imageModels: ["Imagen 4", "Nano Banana", "Nano Banana Pro"],
        videoModels: ["Veo 3.1 - Fast (Audio)", "Veo 3.1 - Fast", "Veo 3.1 - Quality", "Veo 3.1 - I2V Start Image", "Veo 3.1 - Reference Images"],
        imageAspects: ["16:9 Landscape", "9:16 Portrait", "1:1 Square"],
        videoAspects: ["16:9 Landscape", "9:16 Portrait", "1:1 Square"],
        defaults: {
          imageModel: "Nano Banana Pro",
          videoModel: "Veo 3.1 - Fast (Audio)",
          imageAspect: "16:9 Landscape",
          videoAspect: "16:9 Landscape",
          imageCount: 2,
        },
      };
    }
  },

  /** PATCH /api/flow/config — update output dir, auto-download, etc. */
  async flowConfigUpdate(data: Partial<Pick<FlowConfig, "outputDir" | "autoDownload" | "autoDownloadUpscaledOnly" | "cloudPullOnStartup" | "autoDownloadPrefix" | "autoDownloadSuffix" | "maxConcurrentUpscales" | "upscaleStartDelayMs">>): Promise<FlowConfig> {
    return patch<FlowConfig>("/api/flow/config", data);
  },

  /** GET /api/flow/history — Flow-generated items (merged with Flow project workflows). */
  async flowHistory(params?: { type?: "images" | "videos" }): Promise<{ items: FlowHistoryItem[] }> {
    const qs = params?.type ? { type: params.type } : undefined;
    return get<{ items: FlowHistoryItem[] }>("/api/flow/history", qs as Record<string, string>);
  },

  /** GET /api/flow/auth/status — Flow auth ready, projectId, hasToken. */
  async flowAuthStatus(): Promise<{ ready: boolean; projectId: string | null; hasToken: boolean }> {
    return get("/api/flow/auth/status");
  },

  /** POST /api/flow/generate — start image or video generation job. Returns jobId. */
  async flowGenerate(body: {
    prompt: string;
    mode: "image" | "video";
    model?: string;
    aspect?: string;
    count?: number;
    res?: string;
    image_bytes?: string;
    image_bytes_array?: string[];
    start_image_media_id?: string;
    reference_image_media_ids?: string[];
    seed?: number;
    preamble?: string;
  }): Promise<{ jobId: string }> {
    return post<{ jobId: string }>("/api/flow/generate", body);
  },

  /** GET /api/flow/generate/status/:job_id — poll until status is 'done' or 'error'. */
  async flowGenerateStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    result?: { images?: Array<{ url?: string }>; videos?: Array<{ url?: string; video_url?: string; fifeUrl?: string }>; video?: { url?: string; fifeUrl?: string } };
    error?: string;
  }> {
    return get<{ status: string; progress?: number; result?: unknown; error?: string }>(
      `/api/flow/generate/status/${encodeURIComponent(jobId)}`
    );
  },
};

/** Storage base URL for media (e.g. /api/storage/images/foo.png). */
export const STORAGE_BASE = BASE ? `${BASE}/api/storage` : "/api/storage";
