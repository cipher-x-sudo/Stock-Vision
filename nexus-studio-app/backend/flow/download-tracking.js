import fs from 'fs';
import path from 'path';
import { getDownloadTrackingPath, DATA_BASE } from './config.js';

const VERSION = 1;
const LEGACY_FILE = path.join(DATA_BASE, 'download_tracking.json');

function ensureDataDir() {
  fs.mkdirSync(DATA_BASE, { recursive: true });
}

/** Migrate legacy single-file format to per-project files. Run once on module load. */
function migrateLegacyTracking() {
  try {
    if (!fs.existsSync(LEGACY_FILE)) return;
    const raw = fs.readFileSync(LEGACY_FILE, 'utf8');
    const data = JSON.parse(raw);
    const projects = data?.projects;
    if (!projects || typeof projects !== 'object') return;
    ensureDataDir();
    for (const [projectId, entries] of Object.entries(projects)) {
      if (!projectId || !entries) continue;
      const filePath = getDownloadTrackingPath(projectId);
      const payload = { version: VERSION, projectId, entries: { ...entries } };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    }
    fs.unlinkSync(LEGACY_FILE);
  } catch {
    /* ignore migration errors */
  }
}
migrateLegacyTracking();

/**
 * Load tracking data for a project from disk.
 * @param {string} projectId
 * @returns {{ version: number, projectId: string, entries: Record<string, object> }}
 */
function loadTrackingForProject(projectId) {
  if (!projectId) return { version: VERSION, projectId: '', entries: {} };
  ensureDataDir();
  const filePath = getDownloadTrackingPath(projectId);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const entries = data?.entries;
    return {
      version: data.version ?? VERSION,
      projectId: data.projectId ?? projectId,
      entries: entries && typeof entries === 'object' ? entries : {},
    };
  } catch {
    return { version: VERSION, projectId, entries: {} };
  }
}

/**
 * Save tracking data for a project to disk.
 * @param {string} projectId
 * @param {{ version: number, projectId: string, entries: Record<string, object> }} data
 */
function saveTrackingForProject(projectId, data) {
  if (!projectId) return;
  ensureDataDir();
  const filePath = getDownloadTrackingPath(projectId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Record a download for a project.
 * @param {string} projectId
 * @param {string} mediaId
 * @param {{ type: string, resolution: string, outputPath: string, base64?: string }} record
 */
export function recordDownload(projectId, mediaId, record) {
  if (!projectId || !mediaId) return;
  const data = loadTrackingForProject(projectId);
  const entry = {
    type: record.type || 'image',
    resolution: record.resolution || '1K',
    outputPath: record.outputPath || '',
    downloadedAt: Date.now(),
  };
  if (record.base64) entry.base64 = record.base64;
  data.entries[mediaId] = entry;
  saveTrackingForProject(projectId, data);
}

/**
 * Get set of downloaded media IDs for a project.
 * @param {string} projectId
 * @returns {Set<string>}
 */
export function getDownloadedIds(projectId) {
  if (!projectId) return new Set();
  const data = loadTrackingForProject(projectId);
  return new Set(Object.keys(data.entries));
}

/**
 * Get all entries for a project (for export).
 * @param {string} projectId
 * @returns {Record<string, object>}
 */
export function getAllForProject(projectId) {
  if (!projectId) return {};
  const data = loadTrackingForProject(projectId);
  return { ...data.entries };
}

/**
 * Import entries for a project.
 * @param {string} projectId
 * @param {Record<string, object>} entries
 * @param {boolean} merge - if true, merge with existing; if false, replace
 */
export function importForProject(projectId, entries, merge) {
  if (!projectId || !entries || typeof entries !== 'object') return;
  const data = loadTrackingForProject(projectId);
  if (merge) {
    for (const [mediaId, entry] of Object.entries(entries)) {
      if (mediaId && entry) data.entries[mediaId] = { ...entry };
    }
  } else {
    data.entries = { ...entries };
  }
  saveTrackingForProject(projectId, data);
}

/**
 * Record a download by reading file and base64-encoding (for URL-downloaded images).
 * @param {string} projectId
 * @param {string} mediaId
 * @param {{ type: string, resolution: string, outputPath: string }} record
 * @returns {{ success: boolean, error?: string }}
 */
export function recordDownloadFromFile(projectId, mediaId, record) {
  if (!projectId || !mediaId || !record?.outputPath) {
    return { success: false, error: 'projectId, mediaId and outputPath required' };
  }
  try {
    const buf = fs.readFileSync(record.outputPath);
    const base64 = buf.toString('base64');
    recordDownload(projectId, mediaId, { ...record, base64 });
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || 'Failed to read file' };
  }
}
