import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.APP_ROOT || path.resolve(__dirname, '..');
const USER_DATA = process.env.USER_DATA || null;
const configBase = USER_DATA || ROOT;

export const BASE_DIR = ROOT;
/** Writable base for config/data (userData when packaged, ROOT otherwise). */
export const CONFIG_BASE = configBase;
export const DATA_BASE = path.join(configBase, 'data');
export const COOKIES_FILE = path.join(configBase, 'cookies.json');
export const PROJECT_CONFIG_FILE = path.join(configBase, 'project_config.json');
export const APP_CONFIG_FILE = path.join(configBase, 'app_config.json');
export const CLOUD_CREDENTIALS_FILE = path.join(configBase, 'cloud_credentials.json');
export const DEFAULT_OUTPUT_DIR = path.join(configBase, 'output');

/** Sanitize projectId for use in filename (strip path-unsafe chars). */
function sanitizeProjectId(projectId) {
  if (!projectId || typeof projectId !== 'string') return 'default';
  return projectId.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64) || 'default';
}

/** Per-project download tracking file path. */
export const getDownloadTrackingPath = (projectId) =>
  path.join(DATA_BASE, `download_tracking_${sanitizeProjectId(projectId)}.json`);

export const PROJECT_URL_TEMPLATE = (id) => `https://labs.google/fx/tools/flow/project/${id}`;
export const LABS_DOMAIN = 'https://labs.google/';

export const RECAPTCHA_SITE_KEY = '6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV';
export const RECAPTCHA_SCRIPT_URL = `https://www.google.com/recaptcha/enterprise.js?render=${RECAPTCHA_SITE_KEY}`;
export const RECAPTCHA_ACTION_IMAGE = 'IMAGE_GENERATION';
export const RECAPTCHA_ACTION_VIDEO = 'VIDEO_GENERATION';
export const RECAPTCHA_ACTION_IMAGE_UPSCALE = 'PINHOLE_UPSCALE_IMAGE';
export const RECAPTCHA_ACTION_VIDEO_UPSCALE = 'PINHOLE_UPSCALE_VIDEO';
export const RECAPTCHA_APPLICATION_TYPE = 'RECAPTCHA_APPLICATION_TYPE_WEB';

/**
 * Flow's session ID format (from _app $5(): lines 71191-71195).
 * Returns ";" + (Date.now() + Math.floor(1000000 * Math.random())).
 */
export function getFlowSessionId() {
  return ';' + String(
    Date.now() + Math.floor(1_000_000 * Math.random())
  );
}

export const API_BASE = 'https://aisandbox-pa.googleapis.com/v1';
export const API_IMAGE_GENERATION = (projectId) => `${API_BASE}/projects/${projectId}/flowMedia:batchGenerateImages`;
export const API_VIDEO_GENERATION = `${API_BASE}/video:batchAsyncGenerateVideoText`;
export const API_VIDEO_STATUS = `${API_BASE}/video:batchCheckAsyncVideoGenerationStatus`;
export const API_IMAGE_UPSCALE = `${API_BASE}/flow/upsampleImage`;
export const API_VIDEO_UPSCALE = `${API_BASE}/video:batchAsyncGenerateVideoUpsampleVideo`;
export const API_IMAGE_UPLOAD = `${API_BASE}:uploadUserImage`;
export const API_VIDEO_START_IMAGE = `${API_BASE}/video:batchAsyncGenerateVideoStartImage`;
export const API_VIDEO_REFERENCE_IMAGES = `${API_BASE}/video:batchAsyncGenerateVideoReferenceImages`;
export const API_PROJECT_CREATE = 'https://labs.google/fx/api/trpc/project.createProject';
export const API_PROJECT_SEARCH_WORKFLOWS = 'https://labs.google/fx/api/trpc/project.searchProjectWorkflows';

export const IMAGE_MODELS = {
  'Imagen 4': { key: 'IMAGEN_3_5', capabilities: ['T2I', 'I2I'] },
  'Nano Banana': { key: 'GEM_PIX', capabilities: ['T2I', 'I2I'] },
  'Nano Banana Pro': { key: 'GEM_PIX_2', capabilities: ['T2I', 'I2I'] },
};

export const VIDEO_MODELS = {
  'Veo 3.1 - Fast (Audio)': { key: 'veo_3_1_t2v_fast_ultra', capabilities: ['T2V'] },
  'Veo 3.1 - Fast': { key: 'veo_3_1_t2v_fast_ultra_relaxed', capabilities: ['T2V'] },
  'Veo 3.1 - Quality': { key: 'veo_3_1_t2v', capabilities: ['T2V'] },
  'Veo 3.1 - I2V Start Image': { key: 'veo_3_1_i2v_s_fast_ultra', capabilities: ['I2V'] },
  'Veo 3.1 - Reference Images': { key: 'veo_3_1_r2v_fast_landscape_ultra', capabilities: ['T2V'] },
};

export const VIDEO_UPSCALER_MODELS = {
  '1080p': 'veo_3_1_upsampler_1080p',
  '4K': 'veo_3_1_upsampler_4k',
};

export const IMAGE_ASPECTS = {
  '16:9 Landscape': 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  '9:16 Portrait': 'IMAGE_ASPECT_RATIO_PORTRAIT',
  '1:1 Square': 'IMAGE_ASPECT_RATIO_SQUARE',
};

export const VIDEO_ASPECTS = {
  '16:9 Landscape': 'VIDEO_ASPECT_RATIO_LANDSCAPE',
  '9:16 Portrait': 'VIDEO_ASPECT_RATIO_PORTRAIT',
  '1:1 Square': 'VIDEO_ASPECT_RATIO_UNSPECIFIED', // Square may not be directly supported, using UNSPECIFIED
};

export const VIDEO_RESOLUTIONS = {
  '720p': 'VIDEO_RESOLUTION_720P',
  '1080p': 'VIDEO_RESOLUTION_1080P',
  '4K': 'VIDEO_RESOLUTION_4K',
};

export const IMAGE_RESOLUTIONS = {
  '1K': 'UPSAMPLE_IMAGE_RESOLUTION_UNSPECIFIED', // 1K is typically the default/unspecified
  '2K': 'UPSAMPLE_IMAGE_RESOLUTION_2K',
  '4K': 'UPSAMPLE_IMAGE_RESOLUTION_4K',
};

export const DEFAULT_IMAGE_MODEL = 'Nano Banana Pro';
export const DEFAULT_VIDEO_MODEL = 'Veo 3.1 - Fast (Audio)';
export const DEFAULT_IMAGE_ASPECT = '16:9 Landscape';
export const DEFAULT_VIDEO_ASPECT = '16:9 Landscape';
export const DEFAULT_IMAGE_COUNT = 2;
export const DEFAULT_VIDEO_RESOLUTION = '720p'; // Default resolution for generated videos
export const DEFAULT_IMAGE_RESOLUTION = '1K'; // Default resolution for generated images

export const VIDEO_POLL_INTERVAL_MS = 5000;
export const VIDEO_POLL_MAX_ATTEMPTS = 120;
export const PAGE_LOAD_DELAY_MS = 5000;
