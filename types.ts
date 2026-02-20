
export interface StockInsight {
  id: string;
  title: string;
  downloads: number | string;
  premium: string;
  creator: string;
  creatorId?: string;
  mediaType: string;
  category?: string;
  contentType?: string;
  dimensions: string;
  uploadDate: string;
  keywords: string[];
  thumbnailUrl: string;
  isAI?: boolean;
}

export interface MarketTrend {
  month: string;
  demand: number;
  saturation: number;
}

export interface CreativeBrief {
  event: string;
  bestSellers: string[];
  shotList: {
    idea: string;
    type: 'Image' | 'Video';
    description: string;
    whyItWorks: string;
  }[];
}

export interface UpcomingEvent {
  name: string;
  date: string;
  daysRemaining: number;
  category: 'Holiday' | 'Seasonal' | 'Global Event';
  icon: string;
  description: string;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}

export interface AnalysisResult {
  brief: CreativeBrief;
  trends: MarketTrend[];
  insights: StockInsight[];
  sources: GroundingSource[];
}

/** Image-only prompt schema for Nano Banana Pro (derived from json_prompt_template, no video fields). */
export interface ImagePrompt {
  scene: string;
  style: string;
  constraints: string[];
  shot: {
    composition: string;
    resolution: string;
    lens: string;
  };
  lighting: {
    primary: string;
    secondary: string;
    accents: string;
  };
  color_palette: {
    background: string;
    ink_primary: string;
    ink_secondary: string;
    text_primary: string;
  };
  visual_rules: {
    prohibited_elements: string[];
    grain: string;
    sharpen: string;
  };
  metadata: {
    series: string;
    task: string;
    scene_number: string;
    tags: string[];
  };
}

export type ContentTypeFilter = 'all' | 'photo' | 'video' | 'vector' | 'illustration';


export type SortOrder = 'relevance' | 'nb_downloads' | 'creation' | 'featured';

export interface ScanConfig {
  minDownloads: number;
  yearFrom: number | null;
  yearTo: number | null;
  aiOnly: boolean;
  contentType: ContentTypeFilter;
  order: SortOrder;
  startPage?: number;
  endPage?: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  query: string;
  analysis: AnalysisResult | null;
  marketData: StockInsight[];
  prompts: ImagePrompt[];
}

export interface StoredImage {
  filename: string;
  url: string;
  timestamp: number;
  size?: number;
}

export interface StoredVideo {
  filename: string;
  url: string;
  timestamp: number;
  size?: number;
}

export interface StoredBatch {
  filename: string;
  url: string;
  timestamp: number;
  size?: number;
  count?: number;
}

export interface Creator {
  id: string;
  name: string;
  avatar?: string;
}

export interface GeneratedImage {
  prompt: ImagePrompt | null;
  analysisStatus: 'idle' | 'analyzing' | 'done' | 'error';
  dataUrl: string | null;
  upscaledUrl: string | null;
  status: 'idle' | 'generating' | 'done' | 'error';
  upscaleStatus: 'idle' | 'upscaling' | 'done' | 'error';
  error?: string;
  videoUrl?: string;
  videoStatus: 'idle' | 'planning' | 'generating' | 'done' | 'error';
  videoPlan?: any;
  imageSize?: string;
}
