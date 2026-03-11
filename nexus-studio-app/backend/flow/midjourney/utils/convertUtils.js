/**
 * Base64/dataUrl conversion and change params
 */

import { TaskAction } from '../constants.js';

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+)(;charset=([^;]+))?(;(base64))?,(.+)$/);
  if (!match) throw new Error('Invalid data URL format');
  const mimeType = match[1];
  const charset = match[3];
  const isBase64 = match[5] === 'base64';
  const data = match[6];
  return {
    mimeType,
    charset,
    base64: isBase64,
    data: isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data)),
  };
}

function normalizeToDataUrl(base64, defaultMimeType = 'image/png') {
  if (base64.startsWith('data:')) return base64;
  return `data:${defaultMimeType};base64,${base64}`;
}

export function convertBase64Array(base64Array) {
  if (!base64Array || base64Array.length === 0) return [];
  return base64Array.map((base64) => {
    const dataUrl = normalizeToDataUrl(base64);
    return parseDataUrl(dataUrl);
  });
}

export function getPrimaryPrompt(prompt) {
  if (!prompt) return '';
  let result = prompt.replace(/\s+--[a-z]+.*$/i, '');
  const urlRegex = /https?:\/\/[-a-zA-Z0-9+&@#/%?=~_|!:,.;]*[-a-zA-Z0-9+&@#/%=~_|]/g;
  result = result.replace(urlRegex, '<link>');
  result = result.replace(/<<link>>/g, '<link>');
  return result;
}

export function convertChangeParams(content) {
  const parts = content.split(' ').filter((p) => p.length > 0);
  if (parts.length !== 2) return null;
  const action = parts[1].toLowerCase();
  const changeParams = { id: parts[0] };
  if (action.charAt(0) === 'u') {
    changeParams.action = TaskAction.UPSCALE;
  } else if (action.charAt(0) === 'v') {
    changeParams.action = TaskAction.VARIATION;
  } else if (action === 'r') {
    changeParams.action = TaskAction.REROLL;
    return changeParams;
  } else {
    return null;
  }
  try {
    const index = parseInt(action.substring(1, 2), 10);
    if (index < 1 || index > 4) return null;
    changeParams.index = index;
  } catch (e) {
    return null;
  }
  return changeParams;
}

/** Content regex for progress messages: **prompt** - status */
export const CONTENT_REGEX = '.*?\\*\\*(.*)\\*\\*.+<@\\d+> \\((.*?)\\)';

/**
 * Parse content to extract prompt and status (e.g. progress)
 */
export function parseContent(content) {
  return parseContentWithRegex(content, CONTENT_REGEX);
}

/**
 * Parse content with custom regex; returns { prompt, status } or null
 */
export function parseContentWithRegex(content, regex) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) return null;
  try {
    const match = new RegExp(regex).exec(content);
    if (!match || match.length < 3) return null;
    return { prompt: match[1] || '', status: match[2] || '' };
  } catch (e) {
    return null;
  }
}
