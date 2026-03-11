import path from 'path';
import { downloadUrl, saveBase64Image } from '../downloads.js';

/**
 * POST /api/download-gallery-item
 * Body: { url: string, outputDir: string, filename: string }
 * Downloads url to outputDir/filename. filename must be a safe basename (no path segments).
 */
export function registerDownload(app) {
  app.post('/api/flow/download-gallery-item', async (req, res) => {
    const { url, outputDir, filename } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ success: false, error: 'url required' });
    }
    if (!outputDir || typeof outputDir !== 'string' || !outputDir.trim()) {
      return res.status(400).json({ success: false, error: 'outputDir required' });
    }
    if (!filename || typeof filename !== 'string' || !filename.trim()) {
      return res.status(400).json({ success: false, error: 'filename required' });
    }
    const safeName = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
    if (!safeName) {
      return res.status(400).json({ success: false, error: 'invalid filename' });
    }
    try {
      const result = await downloadUrl(url.trim(), outputDir.trim(), safeName, null);
      if (result.path) {
        return res.json({ success: true, path: result.path });
      }
      return res.status(500).json({ success: false, error: result.error || 'Download or write failed' });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || 'Download failed' });
    }
  });

  /**
   * POST /api/save-base64-image
   * Body: { base64: string, outputDir: string, filename: string }
   * Writes base64 image to outputDir/filename. Used for gallery image upscale+download.
   */
  app.post('/api/flow/save-base64-image', async (req, res) => {
    const { base64, outputDir, filename } = req.body || {};
    if (!base64 || typeof base64 !== 'string' || !base64.trim()) {
      return res.status(400).json({ success: false, error: 'base64 required' });
    }
    if (!outputDir || typeof outputDir !== 'string' || !outputDir.trim()) {
      return res.status(400).json({ success: false, error: 'outputDir required' });
    }
    if (!filename || typeof filename !== 'string' || !filename.trim()) {
      return res.status(400).json({ success: false, error: 'filename required' });
    }
    const safeName = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
    if (!safeName) {
      return res.status(400).json({ success: false, error: 'invalid filename' });
    }
    try {
      const result = await saveBase64Image(base64.trim(), outputDir.trim(), safeName, null);
      if (result.path) {
        return res.json({ success: true, path: result.path });
      }
      return res.status(500).json({ success: false, error: result.error || 'Save failed' });
    } catch (e) {
      return res.status(500).json({ success: false, error: e?.message || 'Save failed' });
    }
  });
}
