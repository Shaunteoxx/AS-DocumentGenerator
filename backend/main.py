# CRD Generator API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Cookie, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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
import subprocess
import tempfile
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

CONTEXT_DIR = Path(__file__).parent / "context_data"
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


class ExportRequest(BaseModel):
    crd: str


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
        "Use this exact value in the Docs ID field of the Document Control table. "
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


@app.post("/export/docx")
async def export_docx(req: ExportRequest, _: dict = Depends(require_auth)):
    script = Path(__file__).parent / "md_to_docx.js"
    with tempfile.NamedTemporaryFile(suffix=".md", delete=False, mode="w", encoding="utf-8") as md_f:
        md_f.write(req.crd)
        md_path = md_f.name
    out_path = md_path.replace(".md", ".docx")
    try:
        result = subprocess.run(
            ["node", str(script), md_path, out_path],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(Path(__file__).parent),
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"DOCX generation failed: {result.stderr.strip()}")
        with open(out_path, "rb") as f:
            content = f.read()
    finally:
        Path(md_path).unlink(missing_ok=True)
        Path(out_path).unlink(missing_ok=True)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=crd.docx"},
    )


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
