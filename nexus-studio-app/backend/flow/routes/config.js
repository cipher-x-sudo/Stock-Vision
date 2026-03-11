import {
  IMAGE_MODELS,
  VIDEO_MODELS,
  IMAGE_ASPECTS,
  VIDEO_ASPECTS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_IMAGE_ASPECT,
  DEFAULT_VIDEO_ASPECT,
  DEFAULT_IMAGE_COUNT,
  APP_CONFIG_FILE,
} from '../config.js';
import { loadAppConfig, updateConfig } from '../app-config.js';

export function registerConfig(app) {
  app.get('/api/flow/config', (req, res) => {
    const cfg = loadAppConfig();
    res.json({
      imageModels: Object.keys(IMAGE_MODELS),
      videoModels: Object.keys(VIDEO_MODELS),
      imageAspects: Object.keys(IMAGE_ASPECTS),
      videoAspects: Object.keys(VIDEO_ASPECTS),
      defaults: {
        imageModel: DEFAULT_IMAGE_MODEL,
        videoModel: DEFAULT_VIDEO_MODEL,
        imageAspect: DEFAULT_IMAGE_ASPECT,
        videoAspect: DEFAULT_VIDEO_ASPECT,
        imageCount: DEFAULT_IMAGE_COUNT,
      },
      outputDir: cfg.outputDir,
      autoDownload: cfg.autoDownload,
      autoDownloadUpscaledOnly: cfg.autoDownloadUpscaledOnly,
      cloudPullOnStartup: cfg.cloudPullOnStartup,
      autoDownloadPrefix: cfg.autoDownloadPrefix ?? '',
      autoDownloadSuffix: cfg.autoDownloadSuffix ?? '',
      maxConcurrentUpscales: cfg.maxConcurrentUpscales ?? 4,
      upscaleStartDelayMs: cfg.upscaleStartDelayMs ?? 3000,
      configFilePath: APP_CONFIG_FILE,
    });
  });

  app.patch('/api/flow/config', (req, res) => {
    const data = updateConfig({
      outputDir: req.body?.outputDir,
      autoDownload: req.body?.autoDownload,
      autoDownloadUpscaledOnly: req.body?.autoDownloadUpscaledOnly,
      cloudPullOnStartup: req.body?.cloudPullOnStartup,
      autoDownloadPrefix: req.body?.autoDownloadPrefix,
      autoDownloadSuffix: req.body?.autoDownloadSuffix,
      maxConcurrentUpscales: req.body?.maxConcurrentUpscales,
      upscaleStartDelayMs: req.body?.upscaleStartDelayMs,
    });
    const state = req.app.state;
    if (state) {
      state.output_dir = data.outputDir;
      state.auto_download = data.autoDownload;
      state.auto_download_upscaled_only = data.autoDownloadUpscaledOnly;
      state.auto_download_prefix = data.autoDownloadPrefix ?? '';
      state.auto_download_suffix = data.autoDownloadSuffix ?? '';
    }
    res.json(data);
  });
}
