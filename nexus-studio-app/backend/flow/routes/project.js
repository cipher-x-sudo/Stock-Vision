import { PROJECT_URL_TEMPLATE } from '../config.js';
import { ProjectAPI } from '../api/project.js';
import { saveProjectId, loadProjectId } from '../project-manager.js';

export function registerProject(app) {
  // Get current project ID
  app.get('/api/flow/project/current', async (req, res) => {
    const state = req.app.state;
    const projectId = state?.auth_state?.project_id || loadProjectId() || null;
    res.json({ success: true, projectId });
  });

  // Change project ID
  app.post('/api/flow/project/change', async (req, res) => {
    const state = req.app.state;
    const { projectId } = req.body;

    if (!projectId || typeof projectId !== 'string') {
      return res.json({ success: false, error: 'Invalid project ID' });
    }

    try {
      // Update auth state
      if (state.auth_state) {
        state.auth_state.project_id = projectId;
      }

      // Save to config file
      saveProjectId(projectId);

      // Navigate browser to new project if available
      if (state.browser?.driver) {
        await state.browser.driver.get(PROJECT_URL_TEMPLATE(projectId));
        state._log(`Navigated to project: ${projectId}`);
      }

      state._log(`Project changed to: ${projectId}`);
      res.json({ success: true, projectId });
    } catch (e) {
      res.json({ success: false, error: String(e.message) });
    }
  });

  app.post('/api/flow/project/create', async (req, res) => {
    const state = req.app.state;
    const apiClient = state?.api_client;
    if (!apiClient) {
      return res.json({ success: false, error: 'API client not initialized' });
    }
    try {
      const projectApi = new ProjectAPI(apiClient, state._log);
      const result = await projectApi.createProject();
      if (result.success) {
        const pid = result.project_id;
        state.auth_state.project_id = pid;
        saveProjectId(pid);
        if (state.browser?.driver) {
          await state.browser.driver.get(PROJECT_URL_TEMPLATE(pid));
        }
        return res.json({ success: true, projectId: pid });
      }
      res.json({ success: false, error: result.error || 'Unknown error' });
    } catch (e) {
      res.json({ success: false, error: String(e.message) });
    }
  });
}
