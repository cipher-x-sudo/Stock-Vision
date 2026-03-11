import fs from 'fs';
import { getCredentials, setCredentials, pushCookies, pullCookies } from '../cloud-sync.js';
import { COOKIES_FILE } from '../config.js';

const GITHUB_USER_API = 'https://api.github.com/user';

async function validateToken(token) {
  const res = await fetch(GITHUB_USER_API, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error('Invalid or expired GitHub token');
}

export function registerCloud(app) {
  app.get('/api/flow/cloud/status', (req, res) => {
    const creds = getCredentials();
    res.json({
      configured: !!creds?.token,
      hasGistId: !!creds?.gistId,
    });
  });

  app.post('/api/flow/cloud/credentials', async (req, res) => {
    const token = req.body?.token?.trim();
    const gistId = req.body?.gistId?.trim() || null;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }
    try {
      await validateToken(token);
      setCredentials({ token, gistId });
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message || 'Invalid token' });
    }
  });

  app.post('/api/flow/cloud/pull', async (req, res) => {
    const state = req.app.state;
    if (state._log) state._log('[Cloud] Pulling cookies from cloud...');
    try {
      const result = await pullCookies();
      if (state._log) state._log(`[Cloud] Pull complete: ${result.cookieCount ?? '?'} cookies loaded`);
      res.json({ success: true });
    } catch (e) {
      if (state._log) state._log(`[Cloud] Pull failed: ${e.message}`);
      res.status(400).json({ error: e.message || 'Pull failed' });
    }
  });

  app.post('/api/flow/cloud/push', async (req, res) => {
    const state = req.app.state;
    if (state._log) state._log('[Cloud] Pushing cookies to cloud...');
    try {
      const result = await pushCookies();
      if (state._log) state._log(`[Cloud] Push complete${result.gistId ? ` (gist: ${result.gistId.slice(0, 8)}...)` : ''}`);
      res.json(result);
    } catch (e) {
      if (state._log) state._log(`[Cloud] Push failed: ${e.message}`);
      res.status(400).json({ error: e.message || 'Push failed' });
    }
  });

  /** Pull cookies from cloud, update cookies file; if content changed, restart browser so it loads new cookies. */
  app.post('/api/flow/cloud/pull-and-reopen', async (req, res) => {
    const state = req.app.state;
    const browser = state?.browser;
    if (state._log) state._log('[Cloud] Pull-and-reopen: fetching cookies...');
    let beforeContent = null;
    if (fs.existsSync(COOKIES_FILE)) {
      try {
        beforeContent = fs.readFileSync(COOKIES_FILE, 'utf8');
      } catch (_) {}
    }
    try {
      await pullCookies();
    } catch (e) {
      if (state._log) state._log(`[Cloud] Pull-and-reopen failed: ${e.message}`);
      return res.status(400).json({ success: false, error: e.message || 'Pull failed' });
    }
    let afterContent = null;
    try {
      afterContent = fs.readFileSync(COOKIES_FILE, 'utf8');
    } catch (_) {}
    const cookiesChanged = beforeContent !== afterContent;
    let reopened = false;
    if (cookiesChanged && browser) {
      try {
        state._log('Cookies changed; restarting browser...');
        await browser.close();
        const projectId = state.auth_state?.project_id;
        const projectUrl = projectId ? `https://labs.google/fx/tools/flow/project/${projectId}` : null;
        const success = await browser.initialize(false, projectUrl);
        if (success) {
          const token = await browser.findBearerToken();
          if (token) {
            state.auth_state.bearer_token = token;
            state.auth_state.project_id = browser.projectId ?? projectId;
          }
          reopened = true;
        }
      } catch (e) {
        state._log(`Pull-and-reopen browser error: ${e.message}`);
      }
    }
    if (state._log) state._log(`[Cloud] Pull-and-reopen complete: cookiesChanged=${cookiesChanged}, reopened=${reopened}`);
    res.json({ success: true, cookiesChanged, reopened });
  });
}
