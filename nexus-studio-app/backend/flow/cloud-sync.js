import fs from 'fs';
import path from 'path';
import { COOKIES_FILE, CLOUD_CREDENTIALS_FILE } from './config.js';

const GIST_API = 'https://api.github.com/gists';
const COOKIES_FILENAME = 'cookies.json';

/** Fallback when no cloud_credentials.json; set via env GITHUB_TOKEN or paste in credentials file. Packaged exe: use config file or env. */
const DEFAULT_GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

/** Hardcoded gist ID for pull; paste the gist ID here so the packaged exe can fetch cookies without cloud_credentials.json. */
const DEFAULT_GIST_ID = '1d43b658af7a0d5bb9c22b37f6058301';

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
});

/**
 * Read cloud credentials from disk. Returns { token, gistId? } or null if missing/invalid.
 * Uses DEFAULT_GITHUB_TOKEN when the credentials file is missing or has no token.
 */
export function getCredentials() {
  let fileToken = null;
  let fileGistId = null;
  if (fs.existsSync(CLOUD_CREDENTIALS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CLOUD_CREDENTIALS_FILE, 'utf8'));
      fileToken = data?.token?.trim() || null;
      fileGistId = data?.gistId?.trim() || null;
    } catch {
      // ignore
    }
  }
  const token = fileToken || DEFAULT_GITHUB_TOKEN?.trim() || null;
  if (!token) return null;
  const gistId = fileGistId || DEFAULT_GIST_ID?.trim() || null;
  return {
    token,
    gistId,
  };
}

/**
 * Save credentials to disk. Overwrites existing file. Exported for routes.
 */
export function setCredentials({ token, gistId }) {
  const dir = path.dirname(CLOUD_CREDENTIALS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    CLOUD_CREDENTIALS_FILE,
    JSON.stringify({ token, gistId: gistId || null }, null, 2),
    'utf8'
  );
}

/**
 * Push local cookies.json to GitHub Gist. If no gistId in credentials, creates a new secret gist
 * and saves the returned id to credentials. Returns { success: true, gistId? } or throws.
 */
export async function pushCookies() {
  const creds = getCredentials();
  if (!creds) throw new Error('Cloud credentials not configured');

  if (!fs.existsSync(COOKIES_FILE)) throw new Error('No local cookies.json to push');
  const content = fs.readFileSync(COOKIES_FILE, 'utf8');

  if (creds.gistId) {
    const res = await fetch(`${GIST_API}/${creds.gistId}`, {
      method: 'PATCH',
      headers: headers(creds.token),
      body: JSON.stringify({
        files: {
          [COOKIES_FILENAME]: { content },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API ${res.status}`);
    }
    return { success: true };
  }

  const res = await fetch(GIST_API, {
    method: 'POST',
    headers: headers(creds.token),
    body: JSON.stringify({
      description: 'Flow automation cookies (secret)',
      public: false,
      files: {
        [COOKIES_FILENAME]: { content },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  const body = await res.json();
  const gistId = body?.id;
  if (!gistId) throw new Error('GitHub did not return gist id');
  setCredentials({ token: creds.token, gistId });
  return { success: true, gistId };
}

/**
 * Pull cookies from GitHub Gist and write to COOKIES_FILE. Throws on error.
 */
export async function pullCookies() {
  const creds = getCredentials();
  if (!creds) throw new Error('Cloud credentials not configured');
  if (!creds.gistId) throw new Error('No Gist ID configured; push first or set Gist ID');

  const res = await fetch(`${GIST_API}/${creds.gistId}`, {
    method: 'GET',
    headers: headers(creds.token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  const body = await res.json();
  const files = body?.files;
  const file = files?.[COOKIES_FILENAME];
  if (!file?.content) throw new Error('Gist has no cookies.json content');

  const dir = path.dirname(COOKIES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(COOKIES_FILE, file.content, 'utf8');
  let cookieCount = 0;
  try {
    const arr = JSON.parse(file.content);
    cookieCount = Array.isArray(arr) ? arr.length : 0;
  } catch (_) {}
  return { success: true, cookieCount, path: COOKIES_FILE };
}
