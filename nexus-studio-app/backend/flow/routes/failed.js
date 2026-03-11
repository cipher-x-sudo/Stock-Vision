import fs from 'fs';
import path from 'path';
import { CONFIG_BASE } from '../config.js';
import { getOutputDir } from '../app-config.js';

const FAILED_FILENAME = 'failed_prompts.json';

function failedPath(state) {
  let out = state?.output_dir || getOutputDir();
  if (!out || !fs.existsSync(out) || !fs.statSync(out).isDirectory()) {
    out = CONFIG_BASE;
  }
  return path.join(out, FAILED_FILENAME);
}

export function registerFailed(app) {
  app.get('/api/flow/failed', (req, res) => {
    const items = req.app.state?.queue_items || [];
    const failed = items
      .filter((it) => it.status === 'failed')
      .map((it) => ({ id: it.id, prompt: it.prompt, error: it.error, mode: it.mode }));
    res.json({ items: failed });
  });

  app.post('/api/flow/failed/save', (req, res) => {
    const state = req.app.state;
    const items = state?.queue_items || [];
    const failed = items
      .filter((it) => it.status === 'failed')
      .map((it) => ({ prompt: it.prompt, error: it.error, mode: it.mode }));
    const outPath = failedPath(state);
    try {
      const dir = path.dirname(outPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify({ failed }, null, 2), 'utf8');
      res.json({ ok: true, path: outPath, count: failed.length });
    } catch (e) {
      res.status(500).json({ detail: String(e.message) });
    }
  });
}
