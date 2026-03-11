import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import { queueStats } from '../queue-worker.js';
import { appendQueueItem, persistQueueSnapshot } from '../stats-store.js';
import { DATA_BASE } from '../config.js';

export function registerQueue(app) {
  app.post('/api/flow/recaptcha/reset', async (req, res) => {
    const state = req.app.state;
    if (state?.recaptcha?.resetGrecaptcha) {
      await state.recaptcha.resetGrecaptcha();
    }
    res.json({ ok: true });
  });

  app.post('/api/flow/queue/submit', (req, res) => {
    const state = req.app.state;
    if (!state?.image_api) {
      return res.status(503).json({ detail: 'API not initialized' });
    }
    // Don't auto-start queue - user must click Start
    const items = state.queue_items;
    const {
      prompts = [],
      mode = 'image',
      model,
      aspect,
      count = 2,
      res: targetRes,
      seed,
      subMode,
      image_bytes,
      image_bytes_array,
      reference_image_media_ids,
      start_image_media_id,
    } = req.body || {};
    const raw = [];
    for (const s of prompts) {
      const part = typeof s === 'string' ? s.split(/\n/) : [String(s)];
      for (const line of part) {
        const t = String(line).trim();
        if (t) raw.push(t);
      }
    }
    const uniq = [...new Set(raw)];
    const hasImageInput = image_bytes ||
      (image_bytes_array && image_bytes_array.length > 0) ||
      (reference_image_media_ids && reference_image_media_ids.length > 0) ||
      start_image_media_id ||
      req.body?.start_frame_bytes;
    const needsPrompt = !hasImageInput;
    if (needsPrompt && !uniq.length) {
      return res.status(400).json({ detail: 'At least one prompt required' });
    }
    // Allow empty prompt for image input modes
    if (hasImageInput && !uniq.length) {
      uniq.push('');
    }
    const m = mode === 'video' ? 'video' : 'image';
    const c = count != null ? count : (m === 'image' ? 2 : 1);
    const resolution = targetRes || (m === 'image' ? '1K' : '720p');
    const base = {
      mode: m,
      model: model || '',
      aspect: aspect || '',
      count: c,
      res: resolution,
      seed: seed !== undefined ? seed : undefined,
      subMode: subMode || undefined,
      image_bytes: image_bytes || undefined,
      image_bytes_array: image_bytes_array || undefined,
      reference_image_media_ids: reference_image_media_ids || undefined,
      start_image_media_id: start_image_media_id || undefined,
      start_frame_bytes: req.body?.start_frame_bytes || undefined,
    };
    if (hasImageInput) {
      const item = {
        id: randomUUID(),
        prompt: uniq[0] || '',
        status: 'queued',
        result: null,
        error: null,
        progress: 0,
        createdAt: Date.now(),
        ...base,
      };
      items.push(item);
      try { appendQueueItem(state, { id: item.id, prompt: item.prompt, mode: item.mode, model: item.model, aspect: item.aspect, count: item.count, res: item.res, seed: item.seed, createdAt: item.createdAt, status: 'queued' }); } catch (_) { }
      return res.json({ queued: 1 });
    }
    for (const p of uniq) {
      const item = {
        id: randomUUID(),
        prompt: p,
        status: 'queued',
        result: null,
        error: null,
        progress: 0,
        createdAt: Date.now(),
        ...base,
      };
      items.push(item);
      try { appendQueueItem(state, { id: item.id, prompt: item.prompt, mode: item.mode, model: item.model, aspect: item.aspect, count: item.count, res: item.res, seed: item.seed, createdAt: item.createdAt, status: 'queued' }); } catch (_) { }
    }
    res.json({ queued: uniq.length });
  });

  const MAX_BATCH_SIZE = 50;

  app.post('/api/flow/queue/submit-batch', (req, res) => {
    const state = req.app.state;
    if (!state?.image_api) {
      return res.status(503).json({ detail: 'API not initialized' });
    }
    const items = state.queue_items;
    const batch = req.body?.items;
    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({ detail: 'items must be a non-empty array' });
    }
    const toProcess = batch.length > MAX_BATCH_SIZE ? batch.slice(0, MAX_BATCH_SIZE) : batch;
    if (state._log) state._log(`submit-batch: ${toProcess.length} items`);
    const m = (item) => (item?.mode === 'video' ? 'video' : 'image');
    const c = (item) => (item?.count != null ? item.count : (m(item) === 'image' ? 2 : 1));
    const resolution = (item) => item?.res || (m(item) === 'image' ? '1K' : '720p');

    for (const batchItem of toProcess) {
      const hasImageInput = batchItem?.image_bytes ||
        (batchItem?.image_bytes_array && batchItem.image_bytes_array.length > 0) ||
        batchItem?.reference_image_media_ids?.length ||
        batchItem?.start_image_media_id ||
        batchItem?.start_frame_bytes;
      const prompt = Array.isArray(batchItem?.prompts) ? (batchItem.prompts[0] ?? '') : (batchItem?.prompt ?? '');
      const promptStr = typeof prompt === 'string' ? prompt.trim() : '';

      const newItem = {
        id: randomUUID(),
        prompt: hasImageInput ? (promptStr || '') : promptStr,
        status: 'queued',
        result: null,
        error: null,
        progress: 0,
        createdAt: Date.now(),
        mode: m(batchItem),
        model: batchItem?.model || '',
        aspect: batchItem?.aspect || '',
        count: c(batchItem),
        res: resolution(batchItem),
        seed: batchItem?.seed !== undefined ? batchItem.seed : undefined,
        subMode: batchItem?.subMode || undefined,
        image_bytes: batchItem?.image_bytes || undefined,
        image_bytes_array: batchItem?.image_bytes_array || undefined,
        reference_image_media_ids: batchItem?.reference_image_media_ids || undefined,
        start_image_media_id: batchItem?.start_image_media_id || undefined,
        start_frame_bytes: batchItem?.start_frame_bytes || undefined,
        originalFilename: batchItem?.originalFilename || undefined,
      };
      items.push(newItem);
      try { appendQueueItem(state, { id: newItem.id, prompt: newItem.prompt, mode: newItem.mode, model: newItem.model, aspect: newItem.aspect, count: newItem.count, res: newItem.res, seed: newItem.seed, createdAt: newItem.createdAt, status: 'queued' }); } catch (_) {}
    }
    return res.json({
      queued: toProcess.length,
      ...(batch.length > MAX_BATCH_SIZE && { truncated: true }),
    });
  });

  app.get('/api/flow/queue', (req, res) => {
    const state = req.app.state;
    const stats = queueStats(state);
    const items = state?.queue_items || [];
    res.json({ ...stats, items });
  });

  app.get('/api/flow/queue/export', (req, res) => {
    const state = req.app.state;
    const items = state?.queue_items || [];
    res.json({ items, updatedAt: new Date().toISOString() });
  });

  app.post('/api/flow/queue/stop', (req, res) => {
    req.app.state.queue_stop_requested = true;
    req.app.state.queue_paused = false;
    res.json({ ok: true, status: 'stopped' });
  });

  app.post('/api/flow/queue/start', (req, res) => {
    req.app.state.queue_stop_requested = false;
    req.app.state.queue_paused = false;
    req.app.state.auto_retry_count = 0;
    res.json({ ok: true, status: 'running' });
  });

  app.post('/api/flow/queue/pause', (req, res) => {
    req.app.state.queue_paused = true;
    res.json({ ok: true, status: 'paused' });
  });

  app.post('/api/flow/queue/resume', (req, res) => {
    req.app.state.queue_paused = false;
    res.json({ ok: true, status: 'running' });
  });

  app.post('/api/flow/queue/threads', (req, res) => {
    const { count } = req.body || {};
    const threads = Math.max(1, Math.min(5, parseInt(count) || 1));
    req.app.state.queue_threads = threads;
    res.json({ ok: true, threads });
  });

  app.get('/api/flow/queue/status', (req, res) => {
    const state = req.app.state;
    const status = state.queue_stop_requested ? 'stopped' :
      state.queue_paused ? 'paused' : 'running';
    res.json({
      status,
      threads: state.queue_threads || 1,
      paused: !!state.queue_paused,
      stopped: !!state.queue_stop_requested,
    });
  });

  app.post('/api/flow/queue/clear', (req, res) => {
    const state = req.app.state;
    const items = state.queue_items || [];
    const queueOnly = req.query.queue_only !== 'false';
    if (queueOnly) {
      state.queue_items = items.filter((it) => it.status !== 'queued' && it.status !== 'processing' && it.status !== 'polling');
    } else {
      state.queue_items = [];
    }
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) {} });
    res.json({ ok: true });
  });

  app.post('/api/flow/queue/retry', (req, res) => {
    const state = req.app.state;
    const items = state.queue_items || [];
    const failed = items.filter((it) => it.status === 'failed' || it.status === 'recaptcha_failed');
    state.queue_stop_requested = false;
    state.auto_retry_count = 0;
    for (const it of failed) {
      it.status = 'queued';
      it.error = null;
      it.errorType = null;
      it.result = null;
      it.progress = 0;
    }
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) {} });
    res.json({ retried: failed.length });
  });

  const MAX_UPDATE_BATCH_SIZE = 100;

  app.post('/api/flow/queue/update-batch', (req, res) => {
    const state = req.app.state;
    const items = state.queue_items;
    const updates = req.body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ detail: 'updates must be a non-empty array' });
    }
    const toProcess = updates.length > MAX_UPDATE_BATCH_SIZE ? updates.slice(0, MAX_UPDATE_BATCH_SIZE) : updates;
    if (state._log) state._log(`[Sync] Processing batch update: ${toProcess.length} items`);
    let updated = 0;
    for (const update of toProcess) {
      const { id, prompt, res: resolution, count, seed, model } = update;
      if (id == null) continue;
      const item = items.find((it) => it.id === id);
      if (item) {
        if (prompt !== undefined) item.prompt = prompt;
        if (resolution !== undefined) item.res = resolution;
        if (count !== undefined) item.count = count;
        if (seed !== undefined) item.seed = seed;
        if (model !== undefined) item.model = model;
        updated += 1;
      }
    }
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) {} });
    if (state._log) state._log(`[Sync] Batch update complete: ${updated} items updated`);
    res.json({ ok: true, updated });
  });

  // Update queue item (prompt, seed, res, model, etc.)
  app.post('/api/flow/queue/update/:id', (req, res) => {
    const state = req.app.state;
    const { id } = req.params;
    const { prompt, seed, res: resolution, model } = req.body || {};
    const item = state.queue_items.find((it) => it.id === id);
    if (!item) {
      return res.status(404).json({ detail: 'Item not found' });
    }
    if (prompt !== undefined) item.prompt = prompt;
    if (seed !== undefined) item.seed = seed;
    if (resolution !== undefined) item.res = resolution;
    if (model !== undefined) item.model = model;
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) {} });
    res.json({ ok: true, item });
  });

  // Restart (requeue) a single item by id; supports failed and recaptcha_failed
  app.post('/api/flow/queue/restart/:id', (req, res) => {
    const state = req.app.state;
    const { id } = req.params;
    const item = state.queue_items.find((it) => it.id === id);
    if (!item) {
      return res.status(404).json({ detail: 'Item not found' });
    }
    item.status = 'queued';
    item.error = null;
    item.errorType = null;
    item.result = null;
    item.progress = 0;
    item.resultSummary = null;
    item.resultMedia = null;
    item.finishedAt = null;
    item.startedAt = null;
    item.durationMs = null;
    state.queue_stop_requested = false;
    setImmediate(() => { try { persistQueueSnapshot(state); } catch (_) {} });
    res.json({ ok: true });
  });

  // Load / re-import queue from data/{timestamp}/queue_stats.json
  app.post('/api/flow/queue/load', (req, res) => {
    const state = req.app.state;
    const { path: filePath, timestamp, action = 'restore' } = req.body || {};
    let targetPath;
    if (filePath && typeof filePath === 'string') {
      targetPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    } else if (timestamp != null) {
      targetPath = path.join(DATA_BASE, String(timestamp), 'queue_stats.json');
    } else {
      return res.status(400).json({ detail: 'Provide path or timestamp in body' });
    }
    try {
      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ detail: 'File not found', path: targetPath });
      }
      const raw = fs.readFileSync(targetPath, 'utf8');
      const data = JSON.parse(raw);
      const items = Array.isArray(data.items) ? data.items : [];
      if (action === 'resubmit') {
        const toResubmit = items.filter((it) => it.status === 'queued' || it.status === 'failed');
        let count = 0;
        for (const it of toResubmit) {
          state.queue_items.push({
            id: randomUUID(),
            prompt: it.prompt || '',
            status: 'queued',
            result: null,
            error: null,
            progress: 0,
            createdAt: Date.now(),
            mode: it.mode === 'video' ? 'video' : 'image',
            model: it.model || '',
            aspect: it.aspect || '',
            count: it.count ?? (it.mode === 'video' ? 1 : 2),
            res: it.res || (it.mode === 'video' ? '720p' : '1K'),
            seed: it.seed,
            subMode: it.subMode,
            originalFilename: it.originalFilename,
          });
          count += 1;
        }
        return res.json({ ok: true, action: 'resubmit', resubmitted: count, totalInFile: items.length });
      }
      // restore: replace state.queue_items with stored items
      state.queue_items.length = 0;
      for (const it of items) {
        state.queue_items.push({
          id: it.id,
          prompt: it.prompt ?? '',
          status: it.status ?? 'queued',
          result: it.result ?? null,
          error: it.error ?? null,
          progress: it.progress ?? 0,
          createdAt: it.createdAt,
          startedAt: it.startedAt,
          finishedAt: it.finishedAt,
          durationMs: it.durationMs,
          mode: it.mode === 'video' ? 'video' : 'image',
          model: it.model ?? '',
          aspect: it.aspect ?? '',
          count: it.count ?? 2,
          res: it.res ?? '1K',
          seed: it.seed,
          subMode: it.subMode,
          originalFilename: it.originalFilename,
          resultSummary: it.resultSummary,
          errorType: it.errorType,
          projectId: it.projectId,
          resultMedia: it.resultMedia,
          result: it.result,
        });
      }
      return res.json({ ok: true, action: 'restore', restored: items.length });
    } catch (e) {
      return res.status(500).json({ detail: e.message || 'Load failed' });
    }
  });
}
