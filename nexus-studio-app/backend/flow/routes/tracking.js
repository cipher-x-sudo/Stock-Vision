import {
  recordDownload,
  recordDownloadFromFile,
  getDownloadedIds,
  getAllForProject,
  importForProject,
} from '../download-tracking.js';

export function registerTracking(app) {
  /**
   * GET /api/download-tracking?projectId=
   * Returns { downloadedIds: string[] } for gallery checks.
   */
  app.get('/api/flow/download-tracking', (req, res) => {
    const projectId = (req.query.projectId || '').trim();
    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }
    const ids = [...getDownloadedIds(projectId)];
    res.json({ downloadedIds: ids });
  });

  /**
   * GET /api/download-tracking/export?projectId=
   * Returns full export JSON with entries (including b64 for images).
   */
  app.get('/api/flow/download-tracking/export', (req, res) => {
    const projectId = (req.query.projectId || '').trim();
    if (!projectId) {
      return res.status(400).json({ error: 'projectId required' });
    }
    const entries = getAllForProject(projectId);
    const payload = {
      version: 1,
      projectId,
      exportedAt: new Date().toISOString(),
      entries,
    };
    res.json(payload);
  });

  /**
   * POST /api/download-tracking/import
   * Body: { projectId: string, entries: object, merge: boolean }
   */
  app.post('/api/flow/download-tracking/import', (req, res) => {
    const { projectId, entries, merge } = req.body || {};
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      return res.status(400).json({ error: 'projectId required' });
    }
    if (!entries || typeof entries !== 'object') {
      return res.status(400).json({ error: 'entries object required' });
    }
    try {
      importForProject(projectId.trim(), entries, !!merge);
      return res.json({ success: true, imported: Object.keys(entries).length });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Import failed' });
    }
  });

  /**
   * POST /api/download-tracking/record
   * Body: { projectId, mediaId, type, resolution, outputPath, base64? }
   */
  app.post('/api/flow/download-tracking/record', (req, res) => {
    const { projectId, mediaId, type, resolution, outputPath, base64 } = req.body || {};
    if (!projectId || !mediaId) {
      return res.status(400).json({ error: 'projectId and mediaId required' });
    }
    try {
      recordDownload(projectId, mediaId, {
        type: type || 'image',
        resolution: resolution || '1K',
        outputPath: outputPath || '',
        base64: base64 || undefined,
      });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Record failed' });
    }
  });

  /**
   * POST /api/download-tracking/record-from-file
   * Body: { projectId, mediaId, type, resolution, outputPath }
   * Reads file, base64-encodes, then records.
   */
  app.post('/api/flow/download-tracking/record-from-file', (req, res) => {
    const { projectId, mediaId, type, resolution, outputPath } = req.body || {};
    const result = recordDownloadFromFile(projectId, mediaId, {
      type: type || 'image',
      resolution: resolution || '1K',
      outputPath: outputPath || '',
    });
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    return res.json({ success: true });
  });
}
