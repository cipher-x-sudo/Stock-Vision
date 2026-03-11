import { registerAuth } from './auth.js';
import { registerConfig } from './config.js';
import { registerCloud } from './cloud.js';
import { registerProject } from './project.js';
import { registerGenerate } from './generate.js';
import { registerHistory } from './history.js';
import { registerStats } from './stats.js';
import { registerQueue } from './queue.js';
import { registerLogs } from './logs.js';
import { registerFailed } from './failed.js';
import { registerDownload } from './download.js';
import { registerTracking } from './tracking.js';

export function registerRoutes(app) {
  registerAuth(app);
  registerConfig(app);
  registerCloud(app);
  registerProject(app);
  registerGenerate(app);
  registerHistory(app);
  registerStats(app);
  registerQueue(app);
  registerLogs(app);
  registerFailed(app);
  registerDownload(app);
  registerTracking(app);
}
