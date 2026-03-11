import fs from 'fs';
import path from 'path';

/** Sanitize user-provided prefix/suffix for safe filenames: allow [a-zA-Z0-9_-], strip dots/spaces, limit length. */
function sanitizeFilenamePart(part, maxLen = 32) {
  if (part == null || typeof part !== 'string') return '';
  const s = String(part)
    .trim()
    .replace(/[\s.]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, maxLen);
  return s;
}

function safeFilename(prompt, prefix, ext) {
  const s = (prompt || '')
    .slice(0, 40)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'out';
  const uuid = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${s}_${uuid}.${ext}`;
}

export async function downloadUrl(url, destDir, filename = null, logCb = null) {
  if (!url || !destDir) return { error: 'Missing url or output directory' };
  destDir = path.resolve(destDir);
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(60000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) {
      const msg = 'Fetch returned ' + res.status;
      if (logCb) logCb(`Auto-download ${msg}`);
      return { error: msg };
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const ext = ct.includes('video') ? 'mp4' : 'png';
    const name = filename || safeFilename('', 'media', ext);
    const base = path.extname(name) ? name : `${name}.${ext}`;
    const outPath = path.join(destDir, base);
    fs.mkdirSync(destDir, { recursive: true });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buf);
    return { path: outPath };
  } catch (e) {
    const msg = e?.message || String(e);
    if (logCb) logCb(`Auto-download fetch/write failed: ${msg}`);
    return { error: msg };
  }
}

export async function saveGeneratedItem(itemType, url, prompt, outputDir, logCb = null, options = {}) {
  const prefix = itemType === 'image' ? 'img' : 'vid';
  const ext = itemType === 'image' ? 'png' : 'mp4';
  let name = safeFilename(prompt, prefix, ext);
  if (itemType === 'video' && options.resolution === '4K') {
    name = '4k_' + name;
  }
  const userPrefix = sanitizeFilenamePart(options.filenamePrefix);
  const userSuffix = sanitizeFilenamePart(options.filenameSuffix);
  if (userPrefix || userSuffix) {
    const baseName = path.basename(name, path.extname(name));
    name = userPrefix + baseName + userSuffix + '.' + ext;
  }
  const result = await downloadUrl(url, outputDir, name, logCb);
  const outPath = result.path || null;
  if (result.error && logCb) logCb(`Auto-download failed: ${result.error}`);
  if (outPath && logCb) logCb(`Saved to ${outPath}`);
  return outPath;
}

/**
 * Save base64-encoded image data to disk (for gallery image upscale+download).
 */
export async function saveBase64Image(base64, destDir, filename, logCb = null) {
  if (!base64 || !destDir || !filename) return { error: 'Missing base64, destDir or filename' };
  destDir = path.resolve(destDir);
  const safeName = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
  if (!safeName) return { error: 'invalid filename' };
  try {
    const buf = Buffer.from(base64, 'base64');
    const outPath = path.join(destDir, safeName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(outPath, buf);
    if (logCb) logCb(`Saved to ${outPath}`);
    return { path: outPath };
  } catch (e) {
    const msg = e?.message || String(e);
    if (logCb) logCb(`Save base64 failed: ${msg}`);
    return { error: msg };
  }
}
