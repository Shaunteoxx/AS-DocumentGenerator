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
```

## Key Conventions
- Never hardcode API keys; always use environment variables
- Keep `*_context_data/` files focused and accurate — they directly shape output quality
- Maintain phase state on the frontend; the backend is stateless between requests
- Use `authFetch` (not plain `fetch`) for all authenticated API calls
