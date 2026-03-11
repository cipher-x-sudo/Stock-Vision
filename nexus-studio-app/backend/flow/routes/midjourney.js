/**
 * Midjourney API routes - standalone server (no MJ_SERVER proxy).
 * All MJ logic runs in backend/midjourney/.
 */

import { registerMidjourney as registerMidjourneyFromModule } from '../midjourney/index.js';

export function registerMidjourney(app) {
  registerMidjourneyFromModule(app);
}
