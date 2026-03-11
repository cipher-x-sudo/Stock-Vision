import fs from 'fs';
import { APP_CONFIG_FILE, DEFAULT_OUTPUT_DIR } from './config.js';

function load() {
  if (!fs.existsSync(APP_CONFIG_FILE)) {
    return { outputDir: DEFAULT_OUTPUT_DIR, autoDownload: false, autoDownloadUpscaledOnly: false, cloudPullOnStartup: false, autoDownloadPrefix: '', autoDownloadSuffix: '', maxConcurrentUpscales: 4, upscaleStartDelayMs: 3000 };
  }
  try {
    const data = JSON.parse(fs.readFileSync(APP_CONFIG_FILE, 'utf8'));
    return {
      outputDir: data.outputDir ?? DEFAULT_OUTPUT_DIR,
      autoDownload: Boolean(data.autoDownload),
      autoDownloadUpscaledOnly: Boolean(data.autoDownloadUpscaledOnly),
      cloudPullOnStartup: Boolean(data.cloudPullOnStartup),
      autoDownloadPrefix: data.autoDownloadPrefix != null ? String(data.autoDownloadPrefix).trim() : '',
      autoDownloadSuffix: data.autoDownloadSuffix != null ? String(data.autoDownloadSuffix).trim() : '',
      maxConcurrentUpscales: data.maxConcurrentUpscales != null ? Math.max(1, Math.min(10, Number(data.maxConcurrentUpscales) || 4)) : 4,
      upscaleStartDelayMs: data.upscaleStartDelayMs != null ? Math.max(0, Math.min(30000, Number(data.upscaleStartDelayMs) || 3000)) : 3000,
    };
  } catch {
    return { outputDir: DEFAULT_OUTPUT_DIR, autoDownload: false, autoDownloadUpscaledOnly: false, cloudPullOnStartup: false, autoDownloadPrefix: '', autoDownloadSuffix: '', maxConcurrentUpscales: 4, upscaleStartDelayMs: 3000 };
  }
}

function save(data) {
  try {
    fs.writeFileSync(APP_CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

export function getOutputDir() {
  return load().outputDir;
}

export function getAutoDownload() {
  return load().autoDownload;
}

export function updateConfig({ outputDir, autoDownload, autoDownloadUpscaledOnly, cloudPullOnStartup, autoDownloadPrefix, autoDownloadSuffix, maxConcurrentUpscales, upscaleStartDelayMs }) {
  const data = load();
  if (outputDir != null) data.outputDir = String(outputDir).trim() || DEFAULT_OUTPUT_DIR;
  if (autoDownload != null) data.autoDownload = Boolean(autoDownload);
  if (autoDownloadUpscaledOnly != null) data.autoDownloadUpscaledOnly = Boolean(autoDownloadUpscaledOnly);
  if (cloudPullOnStartup != null) data.cloudPullOnStartup = Boolean(cloudPullOnStartup);
  if (autoDownloadPrefix != null) data.autoDownloadPrefix = String(autoDownloadPrefix).trim();
  if (autoDownloadSuffix != null) data.autoDownloadSuffix = String(autoDownloadSuffix).trim();
  if (maxConcurrentUpscales != null) data.maxConcurrentUpscales = Math.max(1, Math.min(10, Number(maxConcurrentUpscales) || 4));
  if (upscaleStartDelayMs != null) data.upscaleStartDelayMs = Math.max(0, Math.min(30000, Number(upscaleStartDelayMs) || 3000));
  save(data);
  return data;
}

export { load as loadAppConfig };
