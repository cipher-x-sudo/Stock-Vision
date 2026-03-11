import { API_PROJECT_CREATE } from '../config.js';

export class ProjectAPI {
  constructor(client, logCallback = () => {}) {
    this.client = client;
    this._log = logCallback;
  }

  async createProject(title = null) {
    if (!title) {
      const now = new Date();
      title = now.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    this._log(`Creating new project: '${title}'...`);

    const payload = {
      json: { projectTitle: title, toolName: 'PINHOLE' },
    };

    try {
      const result = await this.client.post(API_PROJECT_CREATE, payload);
      if (!result.success) return result;

      const data = result.data || {};
      const inner = data.result?.data?.json?.result || {};
      const projectId = inner.projectId;
      if (!projectId) {
        return { success: false, error: 'API returned success but no projectId found' };
      }
      this._log(`Project created! ID: ${projectId}`);
      return {
        success: true,
        project_id: projectId,
        project_title: inner.projectInfo?.projectTitle || title,
      };
    } catch (e) {
      return { success: false, error: String(e.message) };
    }
  }
}
