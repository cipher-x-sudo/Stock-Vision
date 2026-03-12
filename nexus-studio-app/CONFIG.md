# Nexus Studio — Config & Run

## Setup

1. Copy env example and add your keys:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env`: set at least `GEMINI_API_KEY` (or `GEMINI_API_KEYS`) for AI features.

## Run

- **Full app (Electron + backend)**: From `nexus-studio-app/` run:
  ```bash
  npm start
  ```
  This kills any process on port 8765, then starts Electron, which spawns the backend and loads the app at http://127.0.0.1:8765.

- **Build frontend then run**: Use `build-and-start.bat` (Windows) or:
  ```bash
  npm run build
  npm start
  ```
  Backend serves the built frontend from `frontend/dist`.

- **Development (backend + frontend dev server)**:
  1. Terminal 1: `npm run backend` (starts backend on 8765).
  2. Terminal 2: `npm run dev` (starts Vite with proxy `/api` → http://localhost:8765).
  Open the Vite URL (e.g. http://localhost:5173).

## Env variables

| Variable | Purpose |
|----------|---------|
| `PORT` | Backend port (default 8765). |
| `GEMINI_API_KEY` / `GEMINI_API_KEYS` | Gemini API key(s) for generation and analysis. |
| `STORAGE_DIR` | Optional; default is `backend/storage`. |
| `TRACK_ADOBE_*` | Optional; for Track Adobe search proxy. |
| `VITE_API_URL` | Optional; frontend backend URL when not same-origin. |
