import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { PROJECT_URL_TEMPLATE, getFlowSessionId } from './config.js';
import { BrowserManager } from './browser.js';
import { RecaptchaHandler } from './recaptcha.js';
import { createAuthState, BaseAPIClient } from './api/client.js';
import { ImageAPI } from './api/image.js';
import { VideoAPI } from './api/video.js';
import { ProjectAPI } from './api/project.js';
import { loadProjectId, saveProjectId } from './project-manager.js';
import { loadAppConfig } from './app-config.js';
import { COOKIES_FILE } from './config.js';
import { getCredentials, pullCookies } from './cloud-sync.js';
import { append as logBufferAppend } from './log-buffer.js';
import { runWorker } from './queue-worker.js';
import { registerRoutes } from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.APP_ROOT || path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const ASSETS = path.join(DIST, 'assets');
const INDEX_HTML = path.join(DIST, 'index.html');
const PORT = Number(process.env.PORT) || 8765;

/** When true, this module is used by merged Nexus Studio backend; do not listen. */
const MERGED = process.env.NEXUS_STUDIO_MERGED === '1';

export function createLog() {
  return (msg) => {
    const out = `[LOG] ${msg}`;
    console.log(out);
    logBufferAppend(out);
  };
}

export function createFlowState() {
  const rootLog = createLog();
  return {
    _rootLog: rootLog,
    _log: rootLog,
    browser: null,
    auth_state: null,
    api_client: null,
    image_api: null,
    video_api: null,
    recaptcha: null,
    stats: { images: 0, videos: 0, failed: 0, success: 0, e404: 0, apiErr: 0 },
    generated_items: [],
    jobs: {},
    queue_items: [],
    queue_stop_requested: true,
    output_dir: loadAppConfig().outputDir,
    auto_download: loadAppConfig().autoDownload,
    auto_download_upscaled_only: loadAppConfig().autoDownloadUpscaledOnly,
    auto_download_prefix: loadAppConfig().autoDownloadPrefix ?? '',
    auto_download_suffix: loadAppConfig().autoDownloadSuffix ?? '',
  };
}

export { initBackend, registerRoutes };

async function initBackend(state) {
  const log = state._log;
  log('Initializing...');

  const authState = createAuthState();
  const browser = new BrowserManager(log);
  const savedId = loadProjectId();
  const projectUrl = savedId ? `https://labs.google/fx/tools/flow/project/${savedId}` : 'https://labs.google/fx/tools/flow';

  const ok = await browser.initialize(false, projectUrl);
  if (!ok) {
    state.browser = null;
    state.auth_state = authState;
    state.stats = { images: 0, videos: 0, failed: 0, success: 0, e404: 0, apiErr: 0 };
    state.generated_items = [];
    state.jobs = {};
    state.queue_items = [];
    state.queue_stop_requested = true;
    const cfg = loadAppConfig();
    state.output_dir = cfg.outputDir;
    state.auto_download = cfg.autoDownload;
    state.auto_download_upscaled_only = cfg.autoDownloadUpscaledOnly;
    state.auto_download_prefix = cfg.autoDownloadPrefix ?? '';
    state.auto_download_suffix = cfg.autoDownloadSuffix ?? '';
    log('Browser init failed');
    return;
  }

  const auth = await browser.findAuthSession();
  const token = auth?.access_token ?? null;
  const sid = auth?.session_id ?? null;
  authState.bearer_token = token;
  authState.project_id = browser.projectId ?? null;
  authState.session_id = sid || getFlowSessionId();
  log(`[DEBUG] sessionId: ${authState.session_id?.slice(0, 12)}... (Flow format: ;timestamp+random)`);

  const recaptcha = new RecaptchaHandler((code) => browser.executeAsyncScript(code), log);
  const apiClient = new BaseAPIClient(authState, log);
  apiClient.setExecutor(browser);

  state.browser = browser;
  state.auth_state = authState;
  state.recaptcha = recaptcha;
  state.api_client = apiClient;
  state.image_api = new ImageAPI(apiClient, log);
  state.video_api = new VideoAPI(apiClient, log);
  state.stats = { images: 0, videos: 0, failed: 0, success: 0, e404: 0, apiErr: 0 };
  state.generated_items = [];
  state.jobs = {};
  state.queue_items = [];
  state.queue_stop_requested = true;
  const cfg = loadAppConfig();
  state.output_dir = cfg.outputDir;
  state.auto_download = cfg.autoDownload;
  state.auto_download_upscaled_only = cfg.autoDownloadUpscaledOnly;
  state.auto_download_prefix = cfg.autoDownloadPrefix ?? '';
  state.auto_download_suffix = cfg.autoDownloadSuffix ?? '';

  runWorker(state).catch((e) => log(`Queue worker error: ${e.message}`));

  if (token) log('Auth ready');
  else log('No token yet');

  if (!savedId && token) {
    try {
      const projectApi = new ProjectAPI(apiClient, log);
      const result = await projectApi.createProject();
      if (result.success) {
        const pid = result.project_id;
        authState.project_id = pid;
        saveProjectId(pid);
        await browser.goto(PROJECT_URL_TEMPLATE(pid));
        log('Project created');
      }
    } catch (e) {
      log(`Project create: ${e.message}`);
    }
  }
}

const app = express();
app.use(cors({
  origin: ['http://localhost:8765', 'http://127.0.0.1:8765', 'file://'],
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));

const rootLog = createLog();
const state = {
  _rootLog: rootLog,
  _log: rootLog,
  browser: null,
  auth_state: null,
  api_client: null,
  image_api: null,
  video_api: null,
  recaptcha: null,
  stats: { images: 0, videos: 0, failed: 0, success: 0, e404: 0, apiErr: 0 },
  generated_items: [],
  jobs: {},
  queue_items: [],
  queue_stop_requested: true,
  output_dir: loadAppConfig().outputDir,
  auto_download: loadAppConfig().autoDownload,
  auto_download_upscaled_only: loadAppConfig().autoDownloadUpscaledOnly,
  auto_download_prefix: loadAppConfig().autoDownloadPrefix ?? '',
  auto_download_suffix: loadAppConfig().autoDownloadSuffix ?? '',
};
app.state = state;

let server = null;

async function main() {
  if (getCredentials()) {
    try {
      const result = await pullCookies();
      state._log('Cloud cookies pulled on startup');
      state._log(`Cloud cookies written to ${result.path || COOKIES_FILE} (${result.cookieCount ?? '?'} cookies)`);
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      state._log(`Cloud pull on startup: ${e.message}`);
    }
  }
  await initBackend(state);
  registerRoutes(app);

  app.get('/', (req, res) => {
    if (fs.existsSync(INDEX_HTML)) res.sendFile(INDEX_HTML);
    else res.json({ message: 'Flow Generator API', frontend: 'Build frontend and restart.' });
  });

  if (fs.existsSync(ASSETS)) {
    app.use('/assets', express.static(ASSETS));
  }

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/assets')) return next();
    if (fs.existsSync(INDEX_HTML)) return res.sendFile(INDEX_HTML);
    next();
  });

  server = app.listen(PORT, '127.0.0.1', () => {
    state._log(`Backend listening on http://127.0.0.1:${PORT}`);
  });
}

function shutdown() {
  if (state.browser) {
    state.browser.close().catch(() => { });
    state.browser = null;
  }
  if (server) server.close();
}

if (!MERGED) {
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
