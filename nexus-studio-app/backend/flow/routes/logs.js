import { getLines, append } from '../log-buffer.js';

export function registerLogs(app) {
  app.get('/api/flow/logs', (req, res) => {
    res.json({ lines: getLines() });
  });

  // Allow frontend to append log messages to the system log
  app.post('/api/flow/logs/append', (req, res) => {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }
    // Prefix with [UI] to distinguish frontend logs
    append(`[UI] ${message}`);
    res.json({ ok: true });
  });
}
