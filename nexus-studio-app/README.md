# Nexus Studio (Standalone App)

Standalone desktop app that combines the **Nexus Studio** UI with a single merged backend from **Stock-Vision** (Gemini, TrackAdobe, market analysis, image/video generation, history) and **Veo4K** (Google Flow, Veo; mounted at `/api/flow/*`).

## Quick start

1. **Install dependencies**
   - Root: `npm install`
   - Frontend: `cd frontend && npm install`
   - Electron: `cd electron && npm install`

2. **Run backend only (dev)**  
   From repo root: `npm run backend`  
   Server runs on **http://localhost:8765**. Set `.env` (copy from Stock-Vision root) with `GEMINI_API_KEYS`, TrackAdobe cookies, etc.

3. **Run frontend (dev)**  
   In another terminal: `npm run dev`  
   Vite proxies `/api` to the backend. Open the URL Vite prints (e.g. http://localhost:5173).

4. **Run full app (Electron)**  
   Build frontend first: `npm run build`  
   Then: `npm start` (or `node run.js`)  
   This starts the merged backend and opens the Nexus Studio window.

## Scripts

| Script     | Description                    |
|-----------|--------------------------------|
| `npm run dev`     | Start frontend (Vite) with proxy to backend |
| `npm run build`   | Build frontend to `frontend/dist` |
| `npm run backend` | Start merged backend on port 8765 |
| `npm run electron`| Run Electron (from `electron/`)   |
| `npm start`       | Kill port 8765, then run Electron (spawns backend) |

## Env

- **Backend:** Use a `.env` in the app root (or in `backend/`) with `GEMINI_API_KEYS` or `GEMINI_API_KEY`, and optionally TrackAdobe vars (`TRACK_ADOBE_COOKIES` or `TRACK_ADOBE_SESSION_TOKEN` + `TRACK_ADOBE_CSRF_TOKEN`). Copy from the main Stock-Vision `.env.example` if needed.
- **Flow (Veo4K):** Optional. If the Flow backend fails to load (e.g. missing Playwright), the server still runs with Stock-Vision routes only. Place `app_config.json` / `project_config.json` in the app root for Flow config.

## Structure

- `frontend/` – Nexus Studio UI (Vite + React). Proxies `/api` to backend.
- `backend/` – Merged Express server: Stock-Vision routes at `/api/*`, Veo4K routes at `/api/flow/*`.
- `backend/flow/` – Copied Veo4K backend (prefixed routes).
- `electron/` – Electron shell; spawns backend and loads the app at http://127.0.0.1:8765.
