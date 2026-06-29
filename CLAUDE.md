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
│       │   ├── DocsPage.jsx        # Document Review Hub — library of Drive docs
│       │   ├── DocViewerPage.jsx   # per-section comment & AI regenerate
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
- Generated/regenerated document content is passed through `strip_code_fences()` before returning — the model sometimes wraps the whole doc in a ` ```markdown ` fence, which would otherwise render as one literal code block (raw `#`/`**`/`-`) in the exported Google Doc. Frontend `stripCodeFences()` (in `utils.js`, used in the export path) is a second guard for already-stored content.
- Uses Google Drive API (service account) to read/export documents for the graph feature and the Document Review Hub
- Uses the Google Docs API (service account) to surgically edit document sections in place (Review Hub write-back)
- Uses Google Sheets (gspread) to log generated documents
- Auth gate on all API routes via Corridor (Bearer token)

### BRD corpus fetch (match phase)
- `/brd/analyze` compares the incoming CRD against every existing BRD in the BRD Drive folder via `fetch_brd_texts_from_drive()`
- The corpus is **cached in-memory for 5 min** (`_brd_corpus_cache` / `BRD_CORPUS_CACHE_TTL`) and downloads run **concurrently** (`asyncio.gather` in `_fetch_one_brd`) — repeat generations skip the Drive round-trips
- Template/config files (name contains "template", `.md`/`.txt`, shortcuts/folders) are filtered out so the AI only matches against real BRDs
- `POST /brd/refresh-corpus` force-refetches the corpus (`refresh=True`), bypassing the cache — exposed in the UI as the **"Refresh BRDs cache from Drive"** button on the BRD upload screen
- Cache is per-process; with multiple uvicorn workers each holds its own cache

### Document Review Hub (`/docs`)
A library + editor for documents already in Drive — browse, then comment on a single section and have the AI rewrite just that section, saving back to the same Drive file.

- `GET /documents` — lists all Google Docs from the CRD/BRD/IRD Drive folders (templates/shortcuts filtered out)
- `GET /documents/{id}/content` — exports the Google Doc as **DOCX** and converts it to Markdown via `_docx_to_markdown()`. DOCX (not HTML) is used because it reliably preserves `Heading 1/2/3` styles and bullet lists across all doc types; HTML export flattens headings to bold text for docs that were originally uploaded as HTML.
- `POST /documents/{id}/regenerate-section` — regenerates one section and returns it as a **preview only** (no Drive write). The model is asked to return **only** the rewritten section; the backend then rebuilds `full_content` by splicing that section into the **original** document (preserving the title and every other section verbatim) — it never trusts the model to echo back the whole doc. Response includes `updated_section`, `full_content`, and `next_heading` for the subsequent save.
- `POST /documents/{id}/save-section` — called once the user **confirms** the previewed change; writes it back **in place** via `_replace_doc_section()` (Google Docs API `batchUpdate`): locates the section by heading text, deletes only that range, and re-inserts the new content with heading styles, bullets, and bold re-applied. Every other section keeps its original formatting. Falls back to a full-document re-upload (`_update_drive_doc`) only if the section can't be located.
- **Data-loss guards (critical):** `_replace_doc_section` returns False (→ safe fallback) instead of deleting to end-of-document when the `next_heading` boundary can't be found; and `save-section` runs `_full_content_is_safe()` before any full re-upload, refusing (HTTP 409) if the incoming `full_content` is less than half the live doc's text length (the signature of a truncated single-section payload). Together these ensure a section regenerate can never overwrite the rest of the document.
- The regenerate prompt directs the model to follow the **template's** heading levels / bullet formatting for the rewritten section.
- **Section splitting** (`_parse_sections`, and `parseSections` in the React review components + DocViewerPage) breaks on **H1, H2 and H3** — each `### BR-0N` requirement becomes its own card.
- **Requires real heading styles:** surgical replace finds section boundaries by matching heading text, so it works best on docs whose section titles are actual `Heading 2/3` styles. Docs where titles are bold-normal text fall back to full re-upload.
- **Write-back auth:** the service account must have **Editor** access on the CRD/BRD/IRD Drive folders (`_get_drive_token(readonly=False)` → `auth/drive` scope, which also authorizes the Docs API). The service account cannot *create* files (no Drive storage quota) — new docs are still created by the frontend via the user's OAuth token.

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
DEV_AUTH_BYPASS=true                       # local dev only — see Auth below. NEVER set in production.
```

### Auth model
Auth is enforced in **two independent layers**:
- **Backend (the real gate):** `require_auth` verifies the Corridor JWT (RS256, JWKS) on every API route. It is bypassed **only** when `DEV_AUTH_BYPASS=true`. This flag lives in local `backend/.env`, which is gitignored and excluded from the Docker image (`backend/.dockerignore`), and is **not** in `cloudbuild.yaml` — so production always enforces auth. Never add `DEV_AUTH_BYPASS` to the deploy config.
- **Frontend (UI gate only):** if `VITE_CORRIDOR_CLIENT_ID` is unset, the login screen is skipped (`setAuthenticated(true)`) for local convenience. This only hides the login UI — it does not authenticate API calls, which the backend still rejects without a valid token. Production Vercel sets `VITE_CORRIDOR_CLIENT_ID`, so the gate is active.


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
| BRD | "BR" | ID (br_id), Business Requirement (title), Business Objective, CRDID (crds), IRDID (blank), Priority (blank), Date Submitted, BRD Document (drive_link) — cols 9–12 (FeatureIDs, Feature Names, Release, End to End) left blank for manual entry |
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
