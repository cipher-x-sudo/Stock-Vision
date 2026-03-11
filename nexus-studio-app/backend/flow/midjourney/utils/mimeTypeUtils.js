/**
 * Guess file suffix from MIME type
 */

const MIME_MAP = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
};

export function guessFileSuffix(mimeType) {
  if (!mimeType || !mimeType.trim()) return null;
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType][0];
  const lower = mimeType.toLowerCase();
  for (const [key, suffixes] of Object.entries(MIME_MAP)) {
    if (lower.startsWith(key)) return suffixes[0];
  }
  return null;
}
