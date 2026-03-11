/**
 * Parse customId to TaskAction type
 */

import { TaskAction } from '../constants.js';

export function parseActionFromCustomId(customId) {
  if (!customId || typeof customId !== 'string') return TaskAction.VARIATION;
  const normalized = customId.toLowerCase().trim();
  if (normalized.includes('upsample') || normalized.includes('upscale')) return TaskAction.UPSCALE;
  if (normalized.includes('variation') || normalized.includes('high_variation') || normalized.includes('low_variation')) return TaskAction.VARIATION;
  if (normalized.includes('pan_') || normalized.includes('outpaint') || normalized.includes('customzoom') || normalized.includes('inpaint') || normalized.includes('bookmark') || normalized.includes('animate')) return TaskAction.VARIATION;
  return TaskAction.VARIATION;
}
