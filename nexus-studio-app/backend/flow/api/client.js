/**
 * Base API client. Runs fetch in browser via page.evaluate.
 * AuthState + post(url, jsonData) -> { success, data, error, status }.
 */
export function createAuthState() {
  return {
    bearer_token: null,
    project_id: null,
    session_id: null,
  };
}

export class BaseAPIClient {
  constructor(authState, logCallback = () => {}) {
    this.auth_state = authState;
    this._log = logCallback;
    this.browserExecutor = null;
  }

  setExecutor(executor) {
    this.browserExecutor = executor;
  }

  async post(url, jsonData, timeoutMs = 30000) {
    if (!this.browserExecutor) {
      return { success: false, error: 'Browser executor not linked' };
    }
    const bearer = this.auth_state.bearer_token;
    const headers = { 'Content-Type': 'application/json' };
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

    try {
      const result = await this.browserExecutor.executeAsyncScript(
        ({ url, headers, body }) =>
          fetch(url, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' })
            .then(async (res) => {
              const text = await res.text();
              let data;
              try {
                data = JSON.parse(text);
              } catch {
                data = { raw: text };
              }
              return { ok: res.ok, status: res.status, data };
            })
            .catch((err) => ({ ok: false, status: 0, error: err.message })),
        { url, headers, body: jsonData }
      );
      if (result && result.ok) {
        return { success: true, data: result.data, status: result.status };
      }
      
      // Extract detailed error message from API response
      let errorMessage = result?.error || `HTTP ${result?.status}`;
      if (result?.data) {
        if (result.data.error?.message) {
          errorMessage = result.data.error.message;
        } else if (result.data.message) {
          errorMessage = result.data.message;
        } else if (result.data.detail) {
          errorMessage = result.data.detail;
        } else if (typeof result.data === 'string') {
          errorMessage = result.data;
        } else if (result.status === 400) {
          // For 400 errors, try to extract more details
          errorMessage = JSON.stringify(result.data);
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        status: result?.status,
        data: result?.data, // Include full response for debugging
      };
    } catch (e) {
      return { success: false, error: String(e.message) };
    }
  }

  async get(url, timeoutMs = 30000) {
    if (!this.browserExecutor) {
      return { success: false, error: 'Browser executor not linked' };
    }
    const bearer = this.auth_state.bearer_token;
    const headers = {};
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

    try {
      const result = await this.browserExecutor.executeAsyncScript(
        ({ url, headers }) =>
          fetch(url, { method: 'GET', headers, credentials: 'include' })
            .then(async (res) => {
              const text = await res.text();
              let data;
              try {
                data = JSON.parse(text);
              } catch {
                data = { raw: text };
              }
              return { ok: res.ok, status: res.status, data };
            })
            .catch((err) => ({ ok: false, status: 0, error: err.message })),
        { url, headers }
      );
      if (result && result.ok) {
        return { success: true, data: result.data, status: result.status };
      }
      
      let errorMessage = result?.error || `HTTP ${result?.status}`;
      if (result?.data) {
        if (result.data.error?.message) {
          errorMessage = result.data.error.message;
        } else if (result.data.message) {
          errorMessage = result.data.message;
        } else if (result.data.detail) {
          errorMessage = result.data.detail;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        status: result?.status,
        data: result?.data,
      };
    } catch (e) {
      return { success: false, error: String(e.message) };
    }
  }
}
