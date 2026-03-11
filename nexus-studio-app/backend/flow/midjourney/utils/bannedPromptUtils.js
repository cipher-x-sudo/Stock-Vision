/**
 * Check if prompt contains banned words - optional; no-op if no file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let BANNED_WORDS = [];

function init() {
  const envPath = process.env.BANNED_WORDS_FILE;
  const possiblePaths = envPath
    ? [envPath]
    : [
        path.join(process.cwd(), 'midjourney', 'resources', 'banned-words.txt'),
        path.join(__dirname, '..', 'resources', 'banned-words.txt'),
      ];
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        BANNED_WORDS = content.split('\n').map((l) => l.trim()).filter(Boolean);
        return;
      }
    } catch (e) {
      // ignore
    }
  }
  BANNED_WORDS = [];
}

init();

export function checkBanned(promptEn) {
  if (!promptEn || !BANNED_WORDS.length) return;
  const lower = promptEn.toLowerCase();
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'i');
    if (regex.test(lower)) {
      const err = new Error(word);
      err.name = 'BannedPromptException';
      throw err;
    }
  }
}
