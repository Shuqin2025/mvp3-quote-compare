# Multi-language Table Generator MVP

A minimal full-stack MVP to generate product tables (Excel/PDF) from a list of product URLs, with optional multi-language headers/description translation.

## Contents
- `frontend/` Vite + React app (page: MultiLangTableMVP)
- `backend/` Node.js + Express API with `/v1/api/tablegen`

## Quick Start (Local)

### 1) Backend
```bash
cd backend
cp .env.example .env   # adjust PORT if needed
npm install
npm run dev            # starts on http://localhost:5174 by default (see .env.example)
```
> The backend serves generated files at `/files/:filename`.

### 2) Frontend
```bash
cd ../frontend
cp .env.example .env   # set VITE_API_BASE=http://localhost:5174
npm install
npm run dev            # http://localhost:5173
```

Open `http://localhost:5173` → **多语言表格制作 MVP** page → paste URLs → choose fields/language/formats → Generate.

## Deploy to Render (Suggested)
- Create a **Web Service** from `backend/` (Node).
- Create a **Static Site** from `frontend/`:
  - Set build command: `npm run build`
  - Publish directory: `dist`
  - Add env `VITE_API_BASE` to your backend public URL.

## Notes
- Crawling is mocked in `backend/services/crawler.js`. Replace with real extractor when ready.
- Translation is stubbed in `backend/services/translate.js`.
- Excel generated via `exceljs`; PDF via `pdfkit`.
