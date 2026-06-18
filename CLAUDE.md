# Requirements Document Generator

A microapp that generates requirements documents (CRD, BRD, PRD, IRD) using AI. Users paste client notes, answer clarifying questions, and get a formatted document following company templates.

## Architecture

**Backend:** FastAPI (Python) — `backend/`
**Frontend:** React — `frontend/`

## Project Structure

```
AS-CRD/
├── CLAUDE.md
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── pages/
│       │   ├── CRDPage.jsx
│       │   ├── BRDPage.jsx
│       │   ├── IRDPage.jsx
│       │   ├── PRDPage.jsx
│       │   ├── GraphPage.jsx       # document relationship graph
│       │   ├── HomePage.jsx
│       │   └── AuthCallbackPage.jsx
│       └── components/
│           ├── UploadArea.jsx      # shared across all doc pages
│           ├── CRDOutput.jsx
│           ├── CRDReview.jsx
│           ├── ChatDisplay.jsx
│           ├── CRDHistoryModal.jsx
│           ├── IRDHistoryModal.jsx
│           ├── PRDHistoryModal.jsx
│           ├── Icons.jsx
│           ├── AuthCallback.jsx
│           └── brd/ ird/ prd/     # doc-type-specific components
└── backend/
    ├── main.py                     # FastAPI app entry point
    ├── crd_context_data/           # ai_prompt_instructions.txt, crd_template.md
    ├── brd_context_data/           # brd_instructions.md, brd_template.md
    ├── prd_context_data/           # prd_instructions.txt, prd_template.md
    └── ird_context_data/           # ird_instructions.txt, ird_template.md
```

## Document Types

Each doc type has its own route and context data folder:

| Type | Route | Context folder |
|------|-------|----------------|
| CRD (Customer Request Doc) | `/crd` | `crd_context_data/` |
| BRD (Business Requirements Doc) | `/brd` | `brd_context_data/` |
| PRD (Product Requirements Doc) | `/prd` | `prd_context_data/` |
| IRD (Integration Requirements Doc) | `/ird` | `ird_context_data/` |

- PRD uses an FR-based structure matching company format
- IRD template matches company format (overhauled)
- Each context folder has an instructions file + template file injected into the system prompt

## Backend

### Context Injection
- Per request, the backend reads all files from the relevant `*_context_data/` folder
- File contents are concatenated and injected into the Gemini system instruction
- Add `.txt` or `.md` files to a context folder to expand that doc type's knowledge

### API
- Built with FastAPI
- Calls the **Google Gemini API** (`gemini-2.5-flash`) for all document generation and AI inference
- Uses Google Drive API (service account) to read/export documents for the graph feature
- Uses Google Sheets (gspread) to log generated documents
- Auth gate on all API routes via Corridor (Bearer token)

### BRD corpus fetch (match phase)
- `/brd/analyze` compares the incoming CRD against every existing BRD in the BRD Drive folder via `fetch_brd_texts_from_drive()`
- The corpus is **cached in-memory for 5 min** (`_brd_corpus_cache` / `BRD_CORPUS_CACHE_TTL`) and downloads run **concurrently** (`asyncio.gather` in `_fetch_one_brd`) — repeat generations skip the Drive round-trips
- Template/config files (name contains "template", `.md`/`.txt`, shortcuts/folders) are filtered out so the AI only matches against real BRDs
- `POST /brd/refresh-corpus` force-refetches the corpus (`refresh=True`), bypassing the cache — exposed in the UI as the **"Refresh BRDs cache from Drive"** button on the BRD upload screen
- Cache is per-process; with multiple uvicorn workers each holds its own cache

### Running the backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Frontend

- React with React Router; default route `/` redirects to `/crd`
- Shared `UploadArea` component used across all doc type pages
- Collapsible "Recent Documents" sidebar
- Auth via Corridor — Bearer token stored in sessionStorage
- Export to Google Docs

### Running the frontend
```bash
cd frontend
npm install
npm run dev
```

## Four-Phase Workflow

All doc types follow the same four-phase flow (shown as a step indicator in the UI):

### Phase 1 — Analyze
- User pastes or uploads raw client notes
- Backend analyzes and extracts key requirements, stakeholders, and scope

### Phase 2 — Clarify
- Backend generates targeted questions based on gaps in the notes
- Questions should be minimal and purposeful — only ask what's needed
- User answers before proceeding

### Phase 3 — Review
- Backend generates the draft document
- User reviews the output section by section before exporting

### Phase 4 — Export
- Final doc is exported to Google Docs
- Output follows the template defined in the relevant `*_context_data/` folder

## Environment Variables

```
GOOGLE_API_KEY=your_gemini_api_key
GOOGLE_CREDENTIALS_PATH=credentials.json   # service account for Drive + Sheets
CORRIDOR_BASE_URL=https://www.corridor.cloud
CORRIDOR_CLIENT_ID=your_client_id
CORRIDOR_CLOUD_API_KEY=your_api_key
CORRIDOR_REDIRECT_URI=your_redirect_uri
CLICKUP_API_KEY=pk_...                     # PRD export to ClickUp
```

> Note: `CLICKUP_API_KEY` is set locally in `backend/.env` but is **not** yet wired into `cloudbuild.yaml` as a Cloud Run secret — PRD ClickUp export will fail in production until it's added to the deploy config.

## Integrations Reference

### Google Drive folders
Each doc type reads/writes its own Drive folder (used for export and, for BRD, the match phase).

| Doc Type | Folder ID |
|----------|-----------|
| CRD | `1MTojq7o5eU6ypCb7JrXhnpo4Q34X8UzF` |
| BRD | `1F2_IRbCAwltGPI1i4UaSgpGDtjVxWsfx` |
| IRD | `10SMxLiD4paaAtP2QFu-XAywsct9L8t-0` |
| PRD | N/A — uses ClickUp instead |

### Google Sheets logging
Generated docs are logged to a spreadsheet (`gspread`, service account).

**Spreadsheet ID:** `1JOsrTwUMpJ9cKKXgAAdSZRd_mJquhajAAvnIsk6B__I`

| Doc Type | Worksheet | Columns |
|----------|-----------|---------|
| CRD | "CR" | filename, client_name, "", drive_link, date, "", "", "" |
| BRD | "BR" | br_id, title, objective, crds, date, drive_link |
| IRD | GID `1456248746` | ID, Internal Request, Key Request Description, Input Folder (empty), IRD Document (HYPERLINK formula) |

The IRD sheet uses `get_worksheet_by_id(1456248746)` because the tab name is unknown.

### ClickUp (PRD export)
PRD does not export to Google Docs — it creates a ClickUp Doc instead.

- **Workspace ID:** `9008246823`
- **PRD Folder ID:** `901814228652` (type 5 = folder) — `https://app.clickup.com/9008246823/v/f/901814228652`
- **API:** ClickUp v3 Docs API
- **Flow:** frontend POSTs `{ prd, filename }` → backend creates ClickUp Doc in the PRD folder → returns `doc_url` → frontend opens it
- **Filename:** extracted from the PRD H1 title after generation (e.g. "FBK1 - Form Block V1.0 PRD")
- **Deletion:** ClickUp v3 Docs API returns 405 on DELETE — docs must be deleted manually from the UI

## Deployment
- **Backend:** redeploys via Cloud Build on push (Cloud Run, `asia-southeast1`). Live at `https://crd-backend-758003905280.asia-southeast1.run.app`. Context-data (`*_context_data/`) and prompt changes only take effect after the backend redeploys.
- **Frontend:** deploys via Vercel.
- `gcloud` CLI needs `gcloud auth login` before reading Cloud Run logs.

## Key Conventions
- Never hardcode API keys; always use environment variables
- Keep `*_context_data/` files focused and accurate — they directly shape output quality
- Maintain phase state on the frontend; the backend is stateless between requests
- Use `authFetch` (not plain `fetch`) for all authenticated API calls
