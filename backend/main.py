# CRD Generator API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Cookie, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import google.generativeai as genai
from docx import Document
from pptx import Presentation
import fitz
import io
import os
import re
import json
import logging
import datetime
import httpx
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI(title="CRD Generator API")

ALLOWED_ORIGINS = [
    "https://project-xwokx.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONTEXT_DIR = Path(__file__).parent / "crd_context_data"
CREDENTIALS_PATH = Path(__file__).parent / os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
SHEET_ID = "1JOsrTwUMpJ9cKKXgAAdSZRd_mJquhajAAvnIsk6B__I"
SHEET_WORKSHEET = "Feature"
MODEL_NAME = "gemini-2.5-flash"

CORRIDOR_BASE_URL = os.getenv("CORRIDOR_BASE_URL", "https://www.corridor.cloud")
CORRIDOR_CLIENT_ID = os.getenv("CORRIDOR_CLIENT_ID", "")
CORRIDOR_API_KEY = os.getenv("CORRIDOR_CLOUD_API_KEY", "")
CORRIDOR_REDIRECT_URI = os.getenv("CORRIDOR_REDIRECT_URI", "")
DEV_AUTH_BYPASS = os.getenv("DEV_AUTH_BYPASS", "false").lower() == "true"

logger = logging.getLogger(__name__)

_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"{CORRIDOR_BASE_URL}/api/oauth/jwks")
    return _jwks_client


def verify_token(token: str) -> dict:
    client = get_jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, algorithms=["RS256"], options={"verify_aud": False})


async def require_auth(
    request: Request,
    access_token: str | None = Cookie(default=None),
) -> dict:
    if DEV_AUTH_BYPASS:
        return {"sub": "dev"}
    # Prefer Authorization header (Bearer token from sessionStorage)
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip() if auth_header.startswith("Bearer ") else access_token
    if not token:
        logger.warning("require_auth: no token present")
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return verify_token(token)
    except jwt.ExpiredSignatureError:
        logger.warning("require_auth: token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        logger.warning("require_auth: token validation failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid token")


def get_features_from_sheet() -> str:
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://www.googleapis.com/auth/spreadsheets.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
        ]
        creds = Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=scopes)
        gc = gspread.authorize(creds)
        ws = gc.open_by_key(SHEET_ID).worksheet(SHEET_WORKSHEET)
        rows = ws.get_all_records(expected_headers=['ID', 'Domain', 'Feature Name', 'Key User Story', 'Status', 'User Persona', 'Dependencies', 'BrdID'])

        current_statuses = {"Completed", "In Progress"}
        current, future = [], []
        for row in rows:
            status = str(row.get("Status", "")).strip()
            entry = (
                f"  ID: {row.get('ID', '')} | Domain: {row.get('Domain', '')} | "
                f"Feature: {row.get('Feature Name', '')} | "
                f"User Story: {row.get('Key User Story', '')} | "
                f"Status: {status} | Persona: {row.get('User Persona', '')} | "
                f"Dependencies: {row.get('Dependencies', '')} | BRD: {row.get('BrdID', '')}"
            )
            if status in current_statuses:
                current.append(entry)
            else:
                future.append(entry)

        parts = []
        if current:
            parts.append("=== CURRENT FEATURES ===\n" + "\n".join(current))
        if future:
            parts.append("=== FUTURE FEATURES ===\n" + "\n".join(future))
        return "\n\n".join(parts) if parts else "No features found in sheet."

    except Exception as exc:
        logger.warning("Google Sheets fetch failed (%s), falling back to local files.", exc)
        fallback_parts = []
        for name in ("allo8_current.txt", "allo8_future.txt"):
            p = CONTEXT_DIR / name
            if p.exists():
                fallback_parts.append(p.read_text())
        return "\n\n".join(fallback_parts) if fallback_parts else ""


def extract_client_name_from_crd(md: str) -> str:
    match = re.search(r'\|\s*\*{0,2}Client\s+Name\*{0,2}\s*\|\s*([^|\n]+)\|', md, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return ""


def load_context() -> str:
    parts = []
    for f in sorted(CONTEXT_DIR.glob("*")):
        if f.is_file() and f.suffix in {".txt", ".md"}:
            parts.append(f"### {f.name}\n{f.read_text()}")
    return "\n\n".join(parts) if parts else "No corporate context loaded."


def get_model(context: str) -> genai.GenerativeModel:
    system = f"""You are a CRD (Customer Request Document) generator assistant. You help analysts create professional CRDs by analyzing client notes, asking targeted clarifying questions, and producing formatted CRD documents.

Always follow the corporate context and templates below when generating documents.

--- CORPORATE CONTEXT ---
{context}
--- END CORPORATE CONTEXT ---"""
    return genai.GenerativeModel(model_name=MODEL_NAME, system_instruction=system)


SUPPORTED_EXTENSIONS = {".txt", ".md", ".docx", ".pdf", ".pptx"}


def extract_text(ext: str, content: bytes) -> str:
    if ext in {".txt", ".md"}:
        return content.decode("utf-8", errors="replace")
    elif ext == ".docx":
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    elif ext == ".pdf":
        pdf = fitz.open(stream=content, filetype="pdf")
        return "\n".join(page.get_text() for page in pdf)
    elif ext == ".pptx":
        prs = Presentation(io.BytesIO(content))
        parts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    parts.append(shape.text)
        return "\n".join(parts)
    return ""


def _name_to_crd_id(client_name: str, version: int = 1) -> str:
    words = [w for w in client_name.split() if w]
    if len(words) >= 2:
        initials = words[0][0].upper() + words[1][0].upper()
    elif len(words) == 1 and len(words[0]) >= 2:
        initials = words[0][:2].upper()
    elif len(words) == 1:
        initials = (words[0][0] * 2).upper()
    else:
        return f"C-XX-{version}"
    return f"C-{initials}-{version}"


def generate_crd_id(md: str, version: int = 1) -> str:
    match = re.search(r'\|\s*\*{0,2}Client\s+Name\*{0,2}\s*\|\s*([^|\n]+)\|', md, re.IGNORECASE)
    if not match:
        return f"C-XX-{version}"
    return _name_to_crd_id(match.group(1).strip(), version)


def extract_id_from_notes(text: str, version: int = 1) -> str:
    patterns = [
        r'(?:Client|Company|Account|Customer)(?:\s+Name)?\s*[:\-]\s*([^\n,\.]{2,80})',
        r'\|\s*\*{0,2}Client\s+Name\*{0,2}\s*\|\s*([^|\n]+)\|',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip().rstrip('.,')
            if name:
                return _name_to_crd_id(name, version)
    return f"C-XX-{version}"


# ── Auth endpoints ────────────────────────────────────────────────────────────

class TokenExchangeRequest(BaseModel):
    code: str
    code_verifier: str


@app.post("/auth/token")
async def auth_token(req: TokenExchangeRequest, response: Response):
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{CORRIDOR_BASE_URL}/api/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": CORRIDOR_CLIENT_ID,
                "code": req.code,
                "redirect_uri": CORRIDOR_REDIRECT_URI,
                "code_verifier": req.code_verifier,
            },
            headers={"X-API-Key": CORRIDOR_API_KEY},
        )
    if r.status_code != 200:
        logger.error("Corridor token exchange failed: %s %s", r.status_code, r.text)
        raise HTTPException(status_code=400, detail="Token exchange failed")
    data = r.json()
    is_secure = not DEV_AUTH_BYPASS
    cookie_opts = dict(httponly=True, secure=is_secure, samesite="none" if is_secure else "lax")
    response.set_cookie("access_token", data["access_token"], max_age=data.get("expires_in", 3600), **cookie_opts)
    response.set_cookie("refresh_token", data["refresh_token"], max_age=30 * 24 * 3600, **cookie_opts)
    return {"ok": True, "access_token": data["access_token"], "expires_in": data.get("expires_in", 3600)}


@app.post("/auth/refresh")
async def auth_refresh(response: Response, refresh_token: str | None = Cookie(default=None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{CORRIDOR_BASE_URL}/api/oauth/token",
            json={
                "grant_type": "refresh_token",
                "client_id": CORRIDOR_CLIENT_ID,
                "refresh_token": refresh_token,
            },
            headers={"X-API-Key": CORRIDOR_API_KEY},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Token refresh failed")
    data = r.json()
    is_secure = not DEV_AUTH_BYPASS
    cookie_opts = dict(httponly=True, secure=is_secure, samesite="none" if is_secure else "lax")
    response.set_cookie("access_token", data["access_token"], max_age=data.get("expires_in", 3600), **cookie_opts)
    if "refresh_token" in data:
        response.set_cookie("refresh_token", data["refresh_token"], max_age=30 * 24 * 3600, **cookie_opts)
    return {"ok": True}


@app.post("/auth/logout")
async def auth_logout(response: Response):
    response.delete_cookie("access_token", samesite="none", secure=True)
    response.delete_cookie("refresh_token", samesite="none", secure=True)
    return {"ok": True}


@app.get("/auth/me")
async def auth_me(claims: dict = Depends(require_auth)):
    return claims


# ── Existing endpoints (all protected) ───────────────────────────────────────

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    _: dict = Depends(require_auth),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    content = await file.read()
    return {"text": extract_text(ext, content)}


class ClarifyRequest(BaseModel):
    notes: str
    analysis: str
    answers: list[dict] = []


class GenerateRequest(BaseModel):
    notes: str
    analysis: str
    answers: list[dict]
    filename: str = ""




class RegenerateRequest(BaseModel):
    crd: str
    section: str = ""
    instruction: str = ""


class LogToSheetRequest(BaseModel):
    filename: str
    client_name: str
    drive_link: str = ""


@app.post("/analyze")
async def analyze(
    notes: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    _: dict = Depends(require_auth),
):
    file_parts = []
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        text = extract_text(ext, await file.read())
        if text.strip():
            file_parts.append(f"--- {file.filename} ---\n{text}")

    combined = "\n\n".join(filter(None, [notes.strip()] + file_parts))
    if not combined.strip():
        raise HTTPException(status_code=400, detail="No content provided")

    model = get_model(load_context())
    response = model.generate_content(
        f"""Analyze these client notes and extract:
1. Key requirements
2. Stakeholders mentioned
3. Scope and deliverables
4. Any ambiguities or missing information

Client Notes:
{combined}"""
    )
    return {"analysis": response.text, "combined_notes": combined}


@app.post("/clarify")
async def clarify(req: ClarifyRequest, _: dict = Depends(require_auth)):
    model = get_model(load_context())
    answers_text = ""
    if req.answers:
        answers_text = "\n\nPrevious Q&A:\n" + "\n".join(
            f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
        )

    features_text = get_features_from_sheet()
    features_block = (
        f"\n\n--- ALLOCATE SPACE PLATFORM FEATURES (live from product sheet) ---\n{features_text}\n---"
        if features_text else ""
    )

    response = model.generate_content(
        f"""Based on the client notes and analysis below, generate 3–5 targeted clarifying questions needed to complete a CRD. Only ask what is truly necessary. Do not ask about platform features or capabilities — these are already known from the product sheet above.

Client Notes:
{req.notes}

Analysis:
{req.analysis}{answers_text}{features_block}

Respond with ONLY a JSON array of question strings, no other text. Example: ["Question 1?", "Question 2?"]"""
    )

    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        questions = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse questions from model response")

    return {"questions": questions}


@app.post("/generate")
async def generate(req: GenerateRequest, _: dict = Depends(require_auth)):
    model = get_model(load_context())
    answers_text = "\n".join(
        f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
    )

    filename = req.filename.strip()

    if not filename:
        filename = extract_id_from_notes(req.notes + "\n" + req.analysis)

    filename_instruction = (
        f"\n\nThe Docs ID for this document is: {filename}. "
        "Use this exact value in the Docs ID field of the Document Control section. "
        "Do not generate a new ID."
    )

    features_text = get_features_from_sheet()
    features_block = (
        f"\n\n--- ALLOCATE SPACE PLATFORM FEATURES (live from product sheet) ---\n{features_text}\n---"
        if features_text else ""
    )

    response = model.generate_content(
        f"""Generate a complete, professionally formatted CRD document following the corporate template in your context.

Client Notes:
{req.notes}

Analysis:
{req.analysis}

Clarifying Q&A:
{answers_text}{features_block}

Produce the full CRD in Markdown format.{filename_instruction}"""
    )

    crd = response.text
    crd_id = filename

    crd = re.sub(
        r'(\|\s*\*{0,2}Docs\s+ID\*{0,2}\s*\|)([^|\n]*)(\|)',
        lambda m: f"{m.group(1)} {crd_id} {m.group(3)}",
        crd, count=1, flags=re.IGNORECASE,
    )

    return {"crd": crd, "crd_id": crd_id}


@app.post("/regenerate")
async def regenerate_section(req: RegenerateRequest, _: dict = Depends(require_auth)):
    if not req.section.strip():
        raise HTTPException(status_code=400, detail="section is required")
    model = get_model(load_context())
    instruction_line = f"\nAdditional instructions: {req.instruction.strip()}" if req.instruction.strip() else ""
    response = model.generate_content(
        f"""You are given a complete CRD document in Markdown format. Rewrite ONLY the section named below. Do not alter any other section, heading, or content.

Section to regenerate: {req.section.strip()}{instruction_line}

Full CRD:
{req.crd}

Return ONLY the complete updated Markdown document with that section rewritten. No preamble, no explanation."""
    )
    return {"crd": response.text}



@app.post("/log-to-sheet")
async def log_to_sheet(req: LogToSheetRequest, _: dict = Depends(require_auth)):
    date_str = datetime.date.today().strftime("%-d %b %y")
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=scopes)
        gc = gspread.authorize(creds)
        ws = gc.open_by_key(SHEET_ID).worksheet("CR")
        ws.append_row(
            [req.filename, req.client_name, "", req.drive_link, date_str, "", "", ""],
            value_input_option="RAW",
            insert_data_option="INSERT_ROWS",
        )
    except Exception as exc:
        logger.warning("CR sheet write failed in /log-to-sheet (%s)", exc)
        return {"status": "warning", "message": str(exc)}
    return {"status": "ok"}


# ── IRD helpers ───────────────────────────────────────────────────────────────

IRD_CONTEXT_DIR = Path(__file__).parent / "ird_context_data"


def load_ird_context() -> str:
    parts = []
    for f in sorted(IRD_CONTEXT_DIR.glob("*")):
        if f.is_file() and f.suffix in {".txt", ".md"}:
            parts.append(f"### {f.name}\n{f.read_text()}")
    return "\n\n".join(parts) if parts else "No IRD context loaded."


def get_ird_model(context: str) -> genai.GenerativeModel:
    system = f"""You are an IRD (Internal Requirement Document) generator assistant for Allocate Space. You help teams document internal operational requirements by analyzing source documents, asking targeted clarifying questions, and producing formatted IRD documents.

Always follow the corporate context and templates below when generating documents.

--- CORPORATE CONTEXT ---
{context}
--- END CORPORATE CONTEXT ---"""
    return genai.GenerativeModel(model_name=MODEL_NAME, system_instruction=system)


def _name_to_ird_id(name: str, version: int = 1) -> str:
    words = [w for w in name.split() if w]
    if len(words) >= 2:
        initials = words[0][0].upper() + words[1][0].upper()
    elif len(words) == 1 and len(words[0]) >= 2:
        initials = words[0][:2].upper()
    elif len(words) == 1:
        initials = (words[0][0] * 2).upper()
    else:
        return f"I-XX-{version}"
    return f"I-{initials}-{version}"


def extract_ird_id(text: str, version: int = 1) -> str:
    patterns = [
        r'(?:Team|Department|Group|Division)(?:\s+Name)?\s*[:\-]\s*([^\n,\.]{2,80})',
        r'(?:Requestor|Raised By|Submitted By)\s*[:\-]\s*([^\n,\.]{2,80})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip().rstrip('.,')
            if name:
                return _name_to_ird_id(name, version)
    return f"I-XX-{version}"


class IrdRegenerateRequest(BaseModel):
    crd: str
    section: str = ""
    instruction: str = ""


@app.post("/ird/analyze")
async def ird_analyze(
    notes: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    _: dict = Depends(require_auth),
):
    file_parts = []
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        text = extract_text(ext, await file.read())
        if text.strip():
            file_parts.append(f"--- {file.filename} ---\n{text}")

    combined = "\n\n".join(filter(None, [notes.strip()] + file_parts))
    if not combined.strip():
        raise HTTPException(status_code=400, detail="No content provided")

    model = get_ird_model(load_ird_context())
    response = model.generate_content(
        f"""Analyze these internal documents and extract:
1. Key internal requirements
2. Teams or stakeholders mentioned
3. Scope and operational needs
4. Any ambiguities or missing information

Source Documents:
{combined}"""
    )
    return {"analysis": response.text, "combined_notes": combined}


@app.post("/ird/clarify")
async def ird_clarify(req: ClarifyRequest, _: dict = Depends(require_auth)):
    model = get_ird_model(load_ird_context())
    answers_text = ""
    if req.answers:
        answers_text = "\n\nPrevious Q&A:\n" + "\n".join(
            f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
        )

    response = model.generate_content(
        f"""Based on the internal documents and analysis below, generate 3–5 targeted clarifying questions needed to complete an IRD. Only ask what is truly necessary.

Source Documents:
{req.notes}

Analysis:
{req.analysis}{answers_text}

Respond with ONLY a JSON array of question strings, no other text. Example: ["Question 1?", "Question 2?"]"""
    )

    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        questions = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse questions from model response")

    return {"questions": questions}


@app.post("/ird/generate")
async def ird_generate(req: GenerateRequest, _: dict = Depends(require_auth)):
    model = get_ird_model(load_ird_context())
    answers_text = "\n".join(
        f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
    )

    filename = req.filename.strip()
    if not filename:
        filename = extract_ird_id(req.notes + "\n" + req.analysis)

    filename_instruction = (
        f"\n\nThe Docs ID for this document is: {filename}. "
        "Use this exact value in the Docs ID field of the Document Control section. "
        "Do not generate a new ID."
    )

    response = model.generate_content(
        f"""Generate a complete, professionally formatted IRD document following the corporate template in your context.

Source Documents:
{req.notes}

Analysis:
{req.analysis}

Clarifying Q&A:
{answers_text}

Produce the full IRD in Markdown format.{filename_instruction}"""
    )

    ird = response.text
    return {"crd": ird, "crd_id": filename}


@app.post("/ird/regenerate")
async def ird_regenerate(req: IrdRegenerateRequest, _: dict = Depends(require_auth)):
    if not req.section.strip():
        raise HTTPException(status_code=400, detail="section is required")
    model = get_ird_model(load_ird_context())
    instruction_line = f"\nAdditional instructions: {req.instruction.strip()}" if req.instruction.strip() else ""
    response = model.generate_content(
        f"""You are given a complete IRD document in Markdown format. Rewrite ONLY the section named below. Do not alter any other section, heading, or content.

Section to regenerate: {req.section.strip()}{instruction_line}

Full IRD:
{req.crd}

Return ONLY the complete updated Markdown document with that section rewritten. No preamble, no explanation."""
    )
    return {"crd": response.text}


# ── PRD helpers ───────────────────────────────────────────────────────────────

PRD_CONTEXT_DIR = Path(__file__).parent / "prd_context_data"


def load_prd_context() -> str:
    parts = []
    for f in sorted(PRD_CONTEXT_DIR.glob("*")):
        if f.is_file() and f.suffix in {".txt", ".md"}:
            parts.append(f"### {f.name}\n{f.read_text()}")
    return "\n\n".join(parts) if parts else "No PRD context loaded."


def get_prd_model(context: str) -> genai.GenerativeModel:
    system = f"""You are a PRD (Product Requirement Document) generator assistant for Allocate Space. You help product managers create professional PRDs by analyzing source documents, asking targeted clarifying questions, and producing formatted PRD documents.

Always follow the corporate context and templates below when generating documents.

--- CORPORATE CONTEXT ---
{context}
--- END CORPORATE CONTEXT ---"""
    return genai.GenerativeModel(model_name=MODEL_NAME, system_instruction=system)


def _name_to_prd_id(name: str, version: int = 1) -> str:
    words = [w for w in name.split() if w]
    if len(words) >= 2:
        initials = words[0][0].upper() + words[1][0].upper()
    elif len(words) == 1 and len(words[0]) >= 2:
        initials = words[0][:2].upper()
    elif len(words) == 1:
        initials = (words[0][0] * 2).upper()
    else:
        return f"P-XX-{version}"
    return f"P-{initials}-{version}"


def extract_prd_id(text: str, version: int = 1) -> str:
    patterns = [
        r'(?:Product|Feature|Initiative)(?:\s+Name)?\s*[:\-]\s*([^\n,\.]{2,80})',
        r'(?:Owner|PM|Product Manager)\s*[:\-]\s*([^\n,\.]{2,80})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip().rstrip('.,')
            if name:
                return _name_to_prd_id(name, version)
    return f"P-XX-{version}"


class PrdRegenerateRequest(BaseModel):
    crd: str
    section: str = ""
    instruction: str = ""


@app.post("/prd/analyze")
async def prd_analyze(
    notes: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    _: dict = Depends(require_auth),
):
    file_parts = []
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        text = extract_text(ext, await file.read())
        if text.strip():
            file_parts.append(f"--- {file.filename} ---\n{text}")

    combined = "\n\n".join(filter(None, [notes.strip()] + file_parts))
    if not combined.strip():
        raise HTTPException(status_code=400, detail="No content provided")

    model = get_prd_model(load_prd_context())
    response = model.generate_content(
        f"""Analyze these product documents and extract:
1. Key product requirements and user needs
2. Target user personas mentioned
3. Scope and feature boundaries
4. Any ambiguities or missing information

Source Documents:
{combined}"""
    )
    return {"analysis": response.text, "combined_notes": combined}


@app.post("/prd/clarify")
async def prd_clarify(req: ClarifyRequest, _: dict = Depends(require_auth)):
    model = get_prd_model(load_prd_context())
    answers_text = ""
    if req.answers:
        answers_text = "\n\nPrevious Q&A:\n" + "\n".join(
            f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
        )

    response = model.generate_content(
        f"""Based on the source documents and analysis below, generate 3–5 targeted clarifying questions needed to complete a PRD. Only ask what is truly necessary.

Source Documents:
{req.notes}

Analysis:
{req.analysis}{answers_text}

Respond with ONLY a JSON array of question strings, no other text. Example: ["Question 1?", "Question 2?"]"""
    )

    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        questions = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse questions from model response")

    return {"questions": questions}


@app.post("/prd/generate")
async def prd_generate(req: GenerateRequest, _: dict = Depends(require_auth)):
    model = get_prd_model(load_prd_context())
    answers_text = "\n".join(
        f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
    )

    filename = req.filename.strip()
    if not filename:
        filename = extract_prd_id(req.notes + "\n" + req.analysis)

    filename_instruction = (
        f"\n\nThe Docs ID for this document is: {filename}. "
        "Use this exact value in the Docs ID field of the Document Info section. "
        "Do not generate a new ID."
    )

    response = model.generate_content(
        f"""Generate a complete, professionally formatted PRD document following the corporate template in your context.

Source Documents:
{req.notes}

Analysis:
{req.analysis}

Clarifying Q&A:
{answers_text}

Produce the full PRD in Markdown format.{filename_instruction}"""
    )

    prd = response.text
    return {"crd": prd, "crd_id": filename}


@app.post("/prd/regenerate")
async def prd_regenerate(req: PrdRegenerateRequest, _: dict = Depends(require_auth)):
    if not req.section.strip():
        raise HTTPException(status_code=400, detail="section is required")
    model = get_prd_model(load_prd_context())
    instruction_line = f"\nAdditional instructions: {req.instruction.strip()}" if req.instruction.strip() else ""
    response = model.generate_content(
        f"""You are given a complete PRD document in Markdown format. Rewrite ONLY the section named below. Do not alter any other section, heading, or content.

Section to regenerate: {req.section.strip()}{instruction_line}

Full PRD:
{req.crd}

Return ONLY the complete updated Markdown document with that section rewritten. No preamble, no explanation."""
    )
    return {"crd": response.text}


# ── BRD helpers ───────────────────────────────────────────────────────────────

BRD_CONTEXT_DIR = Path(__file__).parent / "brd_context_data"


def load_brd_context() -> str:
    parts = []
    for f in sorted(BRD_CONTEXT_DIR.glob("*")):
        if f.is_file() and f.suffix in {".txt", ".md"}:
            parts.append(f"### {f.name}\n{f.read_text()}")
    return "\n\n".join(parts) if parts else "No BRD context loaded."


def get_brd_model(context: str) -> genai.GenerativeModel:
    system = f"""You are a BRD (Business Requirements Document) generator assistant for Allocate Space. You help analysts create professional BRDs by analyzing source CRD documents, asking targeted clarifying questions, and producing formatted BRD documents.

Always follow the corporate context and templates below when generating documents.

--- CORPORATE CONTEXT ---
{context}
--- END CORPORATE CONTEXT ---"""
    return genai.GenerativeModel(model_name=MODEL_NAME, system_instruction=system)


def extract_brd_title(md: str) -> str:
    match = re.search(r'^#\s+(.+)$', md, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return "Business Requirement"


def generate_brd_filename(md: str) -> str:
    title = extract_brd_title(md)
    today = datetime.date.today()
    date_str = today.strftime("%b") + str(today.day)
    return f"{title} - {date_str} - BRD"


def generate_br_initials(title: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', title)
    words = [w for w in clean.split() if w.isalpha()]
    return ''.join(w[0].upper() for w in words) or "BR"


def extract_brd_objective(md: str) -> str:
    match = re.search(
        r'\*\*Key Solution Objective\*\*\s*[:\-]?\s*[\*_]?([^\n\*_]+)[\*_]?',
        md, re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return ""


def extract_brd_crds(md: str) -> str:
    section = re.search(
        r'##\s*Existing Reference Material\s*\n(.*?)(?=\n##|\Z)',
        md, re.DOTALL | re.IGNORECASE,
    )
    if not section:
        return ""
    crd_ids = re.findall(r'\bC-[A-Z]+-\d+\b', section.group(1))
    return ", ".join(dict.fromkeys(crd_ids))


# ── BRD request models ────────────────────────────────────────────────────────

class BrdRegenerateRequest(BaseModel):
    brd: str
    section: str = ""
    instruction: str = ""


class BrdLogToSheetRequest(BaseModel):
    brd: str
    drive_link: str = ""


# ── BRD Drive folder ──────────────────────────────────────────────────────────

BRD_DRIVE_FOLDER_ID = "1F2_IRbCAwltGPI1i4UaSgpGDtjVxWsfx"


async def fetch_brd_texts_from_drive() -> list[dict]:
    """Return [{name, id, link, text}] for every BRD in the Drive folder."""
    try:
        from google.oauth2.service_account import Credentials
        from google.auth.transport.requests import Request as GoogleAuthRequest

        scopes = ["https://www.googleapis.com/auth/drive.readonly"]
        creds = Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=scopes)
        creds.refresh(GoogleAuthRequest())
        token = creds.token
    except Exception as exc:
        logger.warning("Drive token fetch failed: %s", exc)
        return []

    results = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                "https://www.googleapis.com/drive/v3/files",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "q": f"'{BRD_DRIVE_FOLDER_ID}' in parents and trashed=false",
                    "fields": "files(id,name,webViewLink,mimeType)",
                    "pageSize": 100,
                },
            )
            if not r.is_success:
                logger.warning("Drive file list failed: %s", r.text)
                return []

            for f in r.json().get("files", []):
                file_id = f["id"]
                mime = f.get("mimeType", "")
                name = f.get("name", "")
                link = f.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")
                try:
                    if "google-apps.document" in mime:
                        er = await client.get(
                            f"https://www.googleapis.com/drive/v3/files/{file_id}/export",
                            headers={"Authorization": f"Bearer {token}"},
                            params={"mimeType": "text/plain"},
                            timeout=15,
                        )
                        text = er.text if er.is_success else ""
                    else:
                        dr = await client.get(
                            f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
                            headers={"Authorization": f"Bearer {token}"},
                            timeout=15,
                        )
                        text = extract_text(Path(name).suffix.lower(), dr.content) if dr.is_success else ""

                    if text.strip():
                        results.append({"name": name, "id": file_id, "link": link, "text": text[:10000]})
                except Exception as exc:
                    logger.warning("Failed to fetch BRD '%s': %s", name, exc)
    except Exception as exc:
        logger.warning("Drive folder fetch error: %s", exc)

    return results


# ── BRD endpoints ─────────────────────────────────────────────────────────────

@app.post("/brd/analyze")
async def brd_analyze(
    notes: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    _: dict = Depends(require_auth),
):
    file_parts = []
    for file in files:
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        text = extract_text(ext, await file.read())
        if text.strip():
            file_parts.append(f"--- {file.filename} ---\n{text}")

    combined = "\n\n".join(filter(None, [notes.strip()] + file_parts))
    if not combined.strip():
        raise HTTPException(status_code=400, detail="No content provided")

    existing_brds = await fetch_brd_texts_from_drive()
    brd_blocks = (
        "\n\n".join(
            f"=== {b['name']} ===\nDrive link: {b['link']}\n\n{b['text']}"
            for b in existing_brds
        )
        if existing_brds
        else "No existing BRDs found."
    )

    model = get_brd_model(load_brd_context())
    response = model.generate_content(
        f"""Analyze the uploaded CRD documents and compare each distinct client requirement against the existing BRDs listed below.

EXTRACTION RULES — follow these exactly:
- Extract requirements only from the Business Requirements section of the CRD. This is the section containing numbered items labelled BR-01, BR-02, BR-03, etc.
- Do not extract requirements from the Underlying Problems, Desired Outcome, Trigger Event, Request Summary, or any other section.
- Each numbered BR item in the Business Requirements section is exactly one requirement. Extract precisely those items — no more, no fewer.
- The requirement name must come from the Business Name field of each BR item, not from the description, problem statement, or any other field.
- Capture the BR number (e.g. BR-01, BR-02) for each item as the br_id field. If no BR number can be identified, set br_id to null.
- Do not group, summarise, combine, or infer — extract faithfully from what is written in the Business Requirements section.
- If the CRD does not have a clearly labelled Business Requirements section with numbered BR items, only then fall back to inferring requirements from the document as a whole.

For each extracted requirement, determine one of three match states:
- matched: an existing BRD substantially and comprehensively covers the requirement. Be conservative — only use this if coverage is truly comprehensive.
- partial: an existing BRD covers some aspects but there are clear gaps or new aspects not captured.
- unmatched: no existing BRD covers this requirement at all.

For partial matches, the coverage_note must explain what is already covered AND what is missing or new.

Return ONLY a valid JSON object — no preamble, no explanation, no markdown fences:
{{
  "requirements": [
    {{
      "name": "Short requirement name",
      "description": "One sentence describing this requirement from the CRD.",
      "crd_source": "C-XX-01",
      "br_id": "BR-01",
      "status": "matched",
      "matched_brd": "Exact BRD document name",
      "matched_brd_link": "https://drive.google.com/...",
      "coverage_note": null
    }},
    {{
      "name": "Another requirement",
      "description": "One sentence.",
      "crd_source": "C-XX-01",
      "br_id": "BR-02",
      "status": "partial",
      "matched_brd": "Exact BRD document name",
      "matched_brd_link": "https://drive.google.com/...",
      "coverage_note": "Existing BRD covers X but does not capture Y."
    }},
    {{
      "name": "New requirement",
      "description": "One sentence.",
      "crd_source": "C-XX-01",
      "br_id": "BR-03",
      "status": "unmatched",
      "matched_brd": null,
      "matched_brd_link": null,
      "coverage_note": null
    }}
  ]
}}

UPLOADED CRDs:
{combined}

EXISTING BRDs:
{brd_blocks}"""
    )

    raw = response.text.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    raw = raw.rstrip("`").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Match JSON parse error: %s | raw: %s", exc, raw[:300])
        raise HTTPException(status_code=500, detail="Failed to parse match results from model")

    return {"requirements": data.get("requirements", []), "combined_notes": combined}


class AnalyzeGapRequest(BaseModel):
    matched_brd_link: str
    requirement_name: str
    requirement_description: str
    crd_source: str
    coverage_note: str = ""


@app.post("/brd/analyze-gap")
async def brd_analyze_gap(req: AnalyzeGapRequest, _: dict = Depends(require_auth)):
    m = re.search(r'/d/([a-zA-Z0-9_-]+)', req.matched_brd_link)
    if not m:
        # Fall back: try query param id=
        m = re.search(r'[?&]id=([a-zA-Z0-9_-]+)', req.matched_brd_link)
    if not m:
        raise HTTPException(status_code=400, detail="Cannot parse file ID from Drive link")
    file_id = m.group(1)

    try:
        from google.oauth2.service_account import Credentials
        from google.auth.transport.requests import Request as GoogleAuthRequest

        scopes = ["https://www.googleapis.com/auth/drive.readonly"]
        creds = Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=scopes)
        creds.refresh(GoogleAuthRequest())
        token = creds.token
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Drive auth failed: {exc}")

    async with httpx.AsyncClient(timeout=30) as client:
        er = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{file_id}/export",
            headers={"Authorization": f"Bearer {token}"},
            params={"mimeType": "text/plain"},
        )
        if er.is_success:
            existing_brd_text = er.text
        else:
            dr = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
                headers={"Authorization": f"Bearer {token}"},
            )
            existing_brd_text = dr.text if dr.is_success else ""

    if not existing_brd_text.strip():
        raise HTTPException(status_code=500, detail="Could not retrieve existing BRD content from Drive")

    model = get_brd_model(load_brd_context())
    response = model.generate_content(
        f"""Analyze the gap between an existing BRD and a new client requirement. Identify exactly what needs to change in the existing BRD to cover this new requirement.

New Requirement: {req.requirement_name}
Description: {req.requirement_description}
Source CRD: {req.crd_source}
Known gap: {req.coverage_note}

Existing BRD:
{existing_brd_text[:6000]}

Return ONLY a valid JSON object — no preamble, no explanation, no markdown fences:
{{
  "summary": "One sentence describing the overall gap",
  "sections": [
    {{
      "section": "Exact section name from the BRD",
      "change_type": "add",
      "reason": "Why this section needs to change",
      "draft": "The exact new content to add — ready to paste into the document"
    }}
  ]
}}"""
    )

    raw = response.text.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    raw = raw.rstrip("`").strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Gap JSON parse error: %s | raw: %s", exc, raw[:300])
        raise HTTPException(status_code=500, detail="Failed to parse gap report from model")

    return data


@app.post("/brd/clarify")
async def brd_clarify(req: ClarifyRequest, _: dict = Depends(require_auth)):
    model = get_brd_model(load_brd_context())
    answers_text = ""
    if req.answers:
        answers_text = "\n\nPrevious Q&A:\n" + "\n".join(
            f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
        )

    response = model.generate_content(
        f"""Based on the source documents and analysis below, generate 3–5 targeted clarifying questions needed to define the scope and structure of the BRD.

Focus questions on:
- Scope boundaries (what is explicitly in or out of scope for this BRD)
- Dependencies between requirements across different CRDs or systems
- Ambiguities or contradictions in the source documents
- Priority or sequencing where requirements conflict or overlap

Source Documents:
{req.notes}

Analysis:
{req.analysis}{answers_text}

Respond with ONLY a JSON array of question strings, no other text. Example: ["Question 1?", "Question 2?"]"""
    )

    text = response.text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        questions = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse questions from model response")

    return {"questions": questions}


@app.post("/brd/generate")
async def brd_generate(req: GenerateRequest, _: dict = Depends(require_auth)):
    model = get_brd_model(load_brd_context())
    answers_text = "\n".join(
        f"Q: {a['question']}\nA: {a['answer']}" for a in req.answers
    )

    today = datetime.date.today().isoformat()

    response = model.generate_content(
        f"""Generate a complete, professionally formatted BRD document following the BRD template in your context.

Source Documents:
{req.notes}

Analysis:
{req.analysis}

Clarifying Q&A:
{answers_text}

Use today's date ({today}) for First Created.
Produce the full BRD in Markdown format."""
    )

    brd = response.text
    brd_id = generate_brd_filename(brd)
    return {"brd": brd, "brd_id": brd_id}


@app.post("/brd/regenerate")
async def brd_regenerate(req: BrdRegenerateRequest, _: dict = Depends(require_auth)):
    if not req.section.strip():
        raise HTTPException(status_code=400, detail="section is required")
    model = get_brd_model(load_brd_context())
    instruction_line = f"\nAdditional instructions: {req.instruction.strip()}" if req.instruction.strip() else ""
    response = model.generate_content(
        f"""You are given a complete BRD document in Markdown format. Rewrite ONLY the section named below. Do not alter any other section, heading, or content.

Section to regenerate: {req.section.strip()}{instruction_line}

Full BRD:
{req.brd}

Return ONLY the complete updated Markdown document with that section rewritten. No preamble, no explanation."""
    )
    return {"brd": response.text}


@app.post("/brd/log-to-sheet")
async def brd_log_to_sheet(req: BrdLogToSheetRequest, _: dict = Depends(require_auth)):
    date_str = datetime.date.today().strftime("%-d %b %y")
    title = extract_brd_title(req.brd)
    objective = extract_brd_objective(req.brd)
    crds = extract_brd_crds(req.brd)
    initials = generate_br_initials(title)

    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(str(CREDENTIALS_PATH), scopes=scopes)
        gc = gspread.authorize(creds)
        ws = gc.open_by_key(SHEET_ID).worksheet("BR")

        existing_ids = ws.col_values(1)
        prefix = f"{initials}-"
        nums = []
        for id_val in existing_ids:
            s = str(id_val)
            if s.startswith(prefix):
                try:
                    nums.append(int(s[len(prefix):]))
                except ValueError:
                    pass
        br_id = f"{initials}-{max(nums, default=0) + 1}"

        ws.append_row(
            [br_id, title, objective, crds, date_str, req.drive_link],
            value_input_option="RAW",
            insert_data_option="INSERT_ROWS",
        )
    except Exception as exc:
        logger.warning("BR sheet write failed in /brd/log-to-sheet (%s)", exc)
        return {"status": "warning", "message": str(exc)}
    return {"status": "ok"}
