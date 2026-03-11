import fs from 'fs';
import { PROJECT_CONFIG_FILE } from './config.js';

export function loadProjectId() {
  if (!fs.existsSync(PROJECT_CONFIG_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(PROJECT_CONFIG_FILE, 'utf8'));
    return data.last_project_id || null;
  } catch {
    return null;
  }
}

export function saveProjectId(projectId) {
  if (!projectId) return;
  try {
    fs.writeFileSync(
      PROJECT_CONFIG_FILE,
      JSON.stringify({ last_project_id: projectId }, null, 4),
      'utf8'
    );
  } catch (_) {}
}
