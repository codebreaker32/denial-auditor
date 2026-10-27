# Denial Auditor UI

Vite + React 19 + TypeScript + Tailwind v4. `npm run dev` serves http://localhost:5173 and proxies `/api` to the FastAPI app on :8600 (`./.venv/bin/uvicorn nebius_nvidia.api:app --port 8600` from the repo root). `npm run build` writes `dist/`.
