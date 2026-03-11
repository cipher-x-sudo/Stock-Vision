import fs from 'fs';
import path from 'path';
import { DATA_BASE } from './config.js';

const QUEUE_STATS_FILENAME = 'queue_stats.json';
const PROJECT_STATS_FILENAME = 'project_stats.json';

/**
 * Get the session directory data/{timestamp}/. Creates it on first use and sets state.statsSessionTimestamp.
 * @param {object} state - app state
 * @returns {string} absolute path to session dir
 */
export function getSessionDir(state) {
  if (!state.statsSessionTimestamp) {
    state.statsSessionTimestamp = Date.now();
  }
  const sessionDir = path.join(DATA_BASE, String(state.statsSessionTimestamp));
  return sessionDir;
}

/**
 * Ensure session directory exists.
 * @param {object} state - app state
 */
function ensureSessionDir(state) {
  const dir = getSessionDir(state);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * @param {object} state - app state
 * @returns {object} { items: [], updatedAt?, sessionTimestamp? }
 */
export function loadQueueStats(state) {
  const dir = getSessionDir(state);
  const filePath = path.join(dir, QUEUE_STATS_FILENAME);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return { items: Array.isArray(data.items) ? data.items : [], updatedAt: data.updatedAt, sessionTimestamp: data.sessionTimestamp };
    }
  } catch (_) {}
  return { items: [], updatedAt: null, sessionTimestamp: state.statsSessionTimestamp };
}

/**
 * @param {object} state - app state
 * @param {object} data - { items, updatedAt?, sessionTimestamp? }
 */
export function saveQueueStats(state, data) {
  const dir = ensureSessionDir(state);
  const filePath = path.join(dir, QUEUE_STATS_FILENAME);
  const payload = {
    fileName: QUEUE_STATS_FILENAME,
    filePath: path.resolve(filePath),
    items: data.items || [],
    updatedAt: new Date().toISOString(),
    sessionTimestamp: state.statsSessionTimestamp,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

/**
 * Append a single queue item record to the stored list and save.
 * @param {object} state - app state
 * @param {object} record - serializable queue item snapshot (id, prompt, status, createdAt, ...)
 */
export function appendQueueItem(state, record) {
  const data = loadQueueStats(state);
  data.items.push(record);
  saveQueueStats(state, data);
}

/**
 * Update an existing queue item by id in the stored list and save.
 * @param {object} state - app state
 * @param {string} id - queue item id
 * @param {object} updates - fields to merge (startedAt, finishedAt, durationMs, status, resultSummary, error, errorType, projectId, resultMedia, etc.)
 */
export function updateQueueItem(state, id, updates) {
  const data = loadQueueStats(state);
  const idx = data.items.findIndex((it) => it.id === id);
  if (idx === -1) return;
  data.items[idx] = { ...data.items[idx], ...updates };
  saveQueueStats(state, data);
}

/**
 * Replace the full items list (e.g. after restore from file) and save.
 * @param {object} state - app state
 * @param {Array} items - full array of queue item records
 */
export function setQueueItems(state, items) {
  const data = loadQueueStats(state);
  data.items = Array.isArray(items) ? items : [];
  saveQueueStats(state, data);
}

/**
 * Persist current state.queue_items to queue_stats.json (full snapshot).
 * @param {object} state - app state
 * @param {Array} items - optional; defaults to state.queue_items
 */
export function persistQueueSnapshot(state, items = null) {
  const list = items ?? state.queue_items ?? [];
  const data = { items: list, updatedAt: new Date().toISOString(), sessionTimestamp: state.statsSessionTimestamp };
  saveQueueStats(state, data);
}

// --- Project stats ---

/**
 * @param {object} state - app state
 * @returns {object} { projects: {}, updatedAt? }
 */
export function loadProjectStats(state) {
  const dir = getSessionDir(state);
  const filePath = path.join(dir, PROJECT_STATS_FILENAME);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return { projects: data.projects && typeof data.projects === 'object' ? data.projects : {}, updatedAt: data.updatedAt };
    }
  } catch (_) {}
  return { projects: {}, updatedAt: null };
}

/**
 * @param {object} state - app state
 * @param {object} data - { projects, updatedAt? }
 */
export function saveProjectStats(state, data) {
  const dir = ensureSessionDir(state);
  const filePath = path.join(dir, PROJECT_STATS_FILENAME);
  const payload = {
    fileName: PROJECT_STATS_FILENAME,
    filePath: path.resolve(filePath),
    projects: data.projects || {},
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

/**
 * Merge a delta into the project's stats and save.
 * @param {object} state - app state
 * @param {string} projectId - project id
 * @param {object} delta - e.g. { totalDone: +1, totalImages: +2, lastActivityAt: now, byMode: { image: +1 }, ... }
 */
export function updateProjectStats(state, projectId, delta) {
  if (!projectId) return;
  const data = loadProjectStats(state);
  const existing = data.projects[projectId] || {
    projectId,
    firstActivityAt: null,
    lastActivityAt: null,
    totalSubmitted: 0,
    totalDone: 0,
    totalFailed: 0,
    totalQueued: 0,
    totalProcessing: 0,
    totalImages: 0,
    totalVideos: 0,
    byMode: { image: 0, video: 0 },
    byResolution: {},
    byStatus: { done: 0, failed: 0, queued: 0, processing: 0 },
    errors: { e404: 0, apiErr: 0, other: 0 },
    lastNItemIds: [],
  };
  const now = Date.now();
  if (delta.firstActivityAt != null) existing.firstActivityAt = existing.firstActivityAt ?? delta.firstActivityAt;
  if (delta.lastActivityAt != null) existing.lastActivityAt = delta.lastActivityAt;
  if (existing.firstActivityAt == null) existing.firstActivityAt = now;
  if (existing.lastActivityAt == null) existing.lastActivityAt = now;

  ['totalSubmitted', 'totalDone', 'totalFailed', 'totalQueued', 'totalProcessing', 'totalImages', 'totalVideos'].forEach((k) => {
    if (delta[k] != null) existing[k] = (existing[k] || 0) + delta[k];
  });
  if (delta.byMode) {
    Object.keys(delta.byMode).forEach((m) => {
      existing.byMode[m] = (existing.byMode[m] || 0) + (delta.byMode[m] || 0);
    });
  }
  if (delta.byResolution) {
    Object.keys(delta.byResolution).forEach((r) => {
      existing.byResolution[r] = (existing.byResolution[r] || 0) + (delta.byResolution[r] || 0);
    });
  }
  if (delta.byStatus) {
    Object.keys(delta.byStatus).forEach((s) => {
      existing.byStatus[s] = (existing.byStatus[s] || 0) + (delta.byStatus[s] || 0);
    });
  }
  if (delta.errors) {
    Object.keys(delta.errors).forEach((e) => {
      existing.errors[e] = (existing.errors[e] || 0) + (delta.errors[e] || 0);
    });
  }
  if (delta.itemId) {
    existing.lastNItemIds = (existing.lastNItemIds || []).concat(delta.itemId).slice(-50);
  }

  data.projects[projectId] = existing;
  saveProjectStats(state, data);
}
