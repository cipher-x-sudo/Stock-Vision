export function registerAuth(app) {
  app.get('/api/flow/auth/status', (req, res) => {
    const auth = req.app.state?.auth_state || {};
    const hasToken = !!auth.bearer_token;
    res.json({
      ready: hasToken && !!auth.project_id,
      projectId: auth.project_id ?? null,
      hasToken,
    });
  });

  app.post('/api/flow/auth/refresh', async (req, res) => {
    const state = req.app.state;
    const browser = state?.browser;
    if (!browser) {
      return res.json({ success: false, ready: false, error: 'Browser not initialized' });
    }
    try {
      const token = await browser.findBearerToken();
      state.auth_state.bearer_token = token;
      if (token) {
        state.auth_state.project_id = browser.projectId ?? state.auth_state.project_id;
      }
      res.json({
        success: true,
        ready: !!(token && state.auth_state.project_id),
        projectId: state.auth_state.project_id ?? null,
        hasToken: !!token,
      });
    } catch (e) {
      res.json({ success: false, ready: false, error: String(e.message) });
    }
  });

  app.post('/api/flow/auth/init', (req, res) => {
    const auth = req.app.state?.auth_state || {};
    const hasToken = !!auth.bearer_token;
    res.json({
      ready: hasToken && !!auth.project_id,
      projectId: auth.project_id ?? null,
      hasToken,
    });
  });

  // Reopen browser with cookies and project
  app.post('/api/flow/browser/reopen', async (req, res) => {
    const state = req.app.state;
    const browser = state?.browser;
    if (!browser) {
      return res.json({ success: false, error: 'Browser manager not available' });
    }
    try {
      state._log('Closing existing browser...');
      await browser.close();

      // Rebuild project URL from state if available
      const projectId = state.auth_state?.project_id;
      const projectUrl = projectId ? `https://labs.google/fx/tools/flow/project/${projectId}` : null;

      state._log(`Reopening browser${projectUrl ? ' with project ' + projectId : ''}...`);
      const success = await browser.initialize(false, projectUrl);

      if (success) {
        // Try to get token from new browser session
        const token = await browser.findBearerToken();
        if (token) {
          state.auth_state.bearer_token = token;
          state.auth_state.project_id = browser.projectId ?? projectId;
        }
      }

      res.json({
        success,
        ready: !!(state.auth_state.bearer_token && state.auth_state.project_id),
        projectId: state.auth_state.project_id ?? null,
      });
    } catch (e) {
      state._log(`Browser reopen error: ${e.message}`);
      res.json({ success: false, error: String(e.message) });
    }
  });

  // Get browser status
  app.get('/api/flow/browser/status', (req, res) => {
    const state = req.app.state;
    const browser = state?.browser;
    const isOpen = !!(browser?.browser && browser?.page);
    res.json({
      isOpen,
      projectId: browser?.projectId ?? null,
      url: browser?.page?.url?.() ?? null,
      visible: browser?.browserVisible ?? false,
    });
  });

  // Show browser window
  app.post('/api/flow/browser/show', async (req, res) => {
    const state = req.app.state;
    const browser = state?.browser;
    if (!browser) {
      return res.json({ success: false, error: 'Browser not initialized' });
    }
    try {
      const success = await browser.showBrowser();
      res.json({ success, visible: browser.browserVisible });
    } catch (e) {
      res.json({ success: false, error: String(e.message) });
    }
  });

  // Hide browser window
  app.post('/api/flow/browser/hide', async (req, res) => {
    const state = req.app.state;
    const browser = state?.browser;
    if (!browser) {
      return res.json({ success: false, error: 'Browser not initialized' });
    }
    try {
      const success = await browser.hideBrowser();
      res.json({ success, visible: browser.browserVisible });
    } catch (e) {
      res.json({ success: false, error: String(e.message) });
    }
  });
}
