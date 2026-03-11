import { queueStats } from '../queue-worker.js';

export function registerStats(app) {
  app.get('/api/flow/stats', (req, res) => {
    const state = req.app.state;
    const st = state?.stats || { images: 0, videos: 0, failed: 0, success: 0, e404: 0, apiErr: 0 };
    const out = { ...st };
    if (state?.queue_items) {
      const q = queueStats(state);
      out.total = q.total;
      out.queue = q.queue;
      out.process = q.process;
      out.remain = q.remain;
    }
    res.json(out);
  });
}
