import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useGoogleLogin } from '@react-oauth/google'
import { DownloadIcon, PencilIcon, SparklesIcon, XIcon, CloudUploadIcon } from './Icons'
import { extractClientName } from '../utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const GDOCS_TOKEN_KEY = 'google_oauth_token'
const GDOCS_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
// Replace with your CRD folder ID from the Google Drive URL (/folders/<ID>)
const CRD_FOLDER_ID = '1MTojq7o5eU6ypCb7JrXhnpo4Q34X8UzF'

function getStoredToken() {
  try {
    const stored = JSON.parse(localStorage.getItem(GDOCS_TOKEN_KEY) || 'null')
    if (stored?.access_token && stored.expires_at > Date.now() + 60_000) {
      return stored.access_token
    }
  } catch {}
  return null
}

function storeToken(tokenResponse) {
  localStorage.setItem(GDOCS_TOKEN_KEY, JSON.stringify({
    access_token: tokenResponse.access_token,
    expires_at: Date.now() + (tokenResponse.expires_in ?? 3600) * 1000,
  }))
}

async function doUploadToDrive(token, mdContent, fileName) {
  const exportRes = await fetch(`${API}/export/docx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ crd: mdContent }),
  })
  if (!exportRes.ok) throw new Error(`DOCX export failed (${exportRes.status})`)
  const docxBlob = await exportRes.blob()

  const boundary = `drive_${Date.now()}`
  const metadata = JSON.stringify({ name: fileName, parents: [CRD_FOLDER_ID] })
  const preamble = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    `Content-Type: ${DOCX_MIME}`,
    '',
    '',
  ].join('\r\n')
  const epilogue = `\r\n--${boundary}--`

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: new Blob([preamble, docxBlob, epilogue]),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(
      new Error(err.error?.message || `Drive upload failed (${res.status})`),
      { status: res.status }
    )
  }
  const data = await res.json()
  const webViewLink = data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
  window.open(webViewLink, '_blank')
  return webViewLink
}

async function logUploadToSheet(filename, clientName, driveLink) {
  try {
    await fetch(`${API}/log-to-sheet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ filename, client_name: clientName, drive_link: driveLink }),
    })
  } catch {
    // sheet logging is best-effort; upload already succeeded
  }
}

export default function CRDOutput({ crd, crdId, onRename }) {
  const [content, setContent] = useState(crd)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const [regenOpen, setRegenOpen] = useState(false)
  const [regenSection, setRegenSection] = useState('')
  const [regenInstruction, setRegenInstruction] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')

  const [docId, setDocId] = useState(crdId || 'crd')
  const [idEditing, setIdEditing] = useState(false)
  const [idDraft, setIdDraft] = useState('')

  const saveId = () => {
    const newId = idDraft.trim() || crdId || 'crd'
    setDocId(newId)
    setIdEditing(false)
    onRename?.(newId)
  }

  const cancelId = () => setIdEditing(false)

  const [driveLoading, setDriveLoading] = useState(false)
  const [driveError, setDriveError] = useState('')
  const pendingDriveContent = useRef(null)
  const pendingDriveFileName = useRef(null)

  const driveLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        storeToken(tokenResponse)
        const webViewLink = await doUploadToDrive(
          tokenResponse.access_token,
          pendingDriveContent.current,
          pendingDriveFileName.current,
        )
        const uploadedFilename = pendingDriveFileName.current.replace('.docx', '')
        const uploadedClientName = extractClientName(pendingDriveContent.current)
        await logUploadToSheet(uploadedFilename, uploadedClientName, webViewLink)
      } catch (e) {
        setDriveError(e.message)
      } finally {
        pendingDriveContent.current = null
        pendingDriveFileName.current = null
        setDriveLoading(false)
      }
    },
    onError: () => {
      setDriveError('Google sign-in failed or was cancelled.')
      pendingDriveContent.current = null
      pendingDriveFileName.current = null
      setDriveLoading(false)
    },
    scope: GDOCS_SCOPE,
  })

  const uploadToDrive = async () => {
    setDriveLoading(true)
    setDriveError('')
    const fileName = `${docId}.docx`
    const storedToken = getStoredToken()
    if (storedToken) {
      try {
        const webViewLink = await doUploadToDrive(storedToken, content, fileName)
        await logUploadToSheet(docId, extractClientName(content), webViewLink)
        setDriveLoading(false)
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          localStorage.removeItem(GDOCS_TOKEN_KEY)
          pendingDriveContent.current = content
          pendingDriveFileName.current = fileName
          driveLogin()
        } else {
          setDriveError(e.message)
          setDriveLoading(false)
        }
      }
    } else {
      pendingDriveContent.current = content
      pendingDriveFileName.current = fileName
      driveLogin()
    }
  }

  const enterEdit = () => {
    setDraft(content)
    setEditing(true)
  }

  const saveEdit = () => {
    setContent(draft)
    setEditing(false)
    closeRegen()
  }

  const cancelEdit = () => {
    setEditing(false)
    closeRegen()
  }

  const openRegen = () => {
    setRegenSection('')
    setRegenInstruction('')
    setRegenError('')
    setRegenOpen(true)
  }

  const closeRegen = () => {
    setRegenOpen(false)
    setRegenSection('')
    setRegenInstruction('')
    setRegenError('')
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    setRegenError('')
    try {
      const res = await fetch(`${API}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crd: draft, section: regenSection, instruction: regenInstruction }),
      })
      if (!res.ok) throw new Error(`Regeneration failed (${res.status})`)
      const data = await res.json()
      setDraft(data.crd)
      closeRegen()
    } catch (e) {
      setRegenError(e.message)
    } finally {
      setRegenerating(false)
    }
  }

  const downloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Phase 3 — Generated CRD</h2>
          <div className="flex items-center gap-2">
            {idEditing ? (
              <input
                autoFocus
                type="text"
                value={idDraft}
                size={Math.max(idDraft.length, 4)}
                onChange={(e) => setIdDraft(e.target.value)}
                onBlur={saveId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveId()
                  if (e.key === 'Escape') cancelId()
                }}
                className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-400 outline-none focus:ring-1 focus:ring-blue-400 focus:ring-offset-0"
              />
            ) : (
              <span
                onClick={() => { setIdDraft(docId); setIdEditing(true) }}
                title="Click to rename"
                className="group inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:border-blue-400 hover:bg-blue-100 transition-colors select-none"
              >
                {docId}
                <PencilIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
              </span>
            )}
            <p className="text-sm text-gray-500">Review your document below, then download in your preferred format.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {editing ? (
            <>
              <button
                onClick={openRegen}
                disabled={regenOpen}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <SparklesIcon className="w-4 h-4" />
                Regenerate Section
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={enterEdit}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={downloadMd}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <DownloadIcon className="w-4 h-4" />
                Download as Markdown (.md)
              </button>
              <button
                onClick={uploadToDrive}
                disabled={driveLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CloudUploadIcon className="w-4 h-4" />
                {driveLoading ? 'Uploading…' : 'Upload to Google Drive'}
              </button>
            </>
          )}
        </div>
      </div>

      {driveError && (
        <p className="text-sm text-red-600">{driveError}</p>
      )}

      {regenOpen && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">Regenerate Section</span>
            </div>
            <button
              onClick={closeRegen}
              className="p-1 text-indigo-400 hover:text-indigo-600 rounded transition-colors"
              aria-label="Close"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-indigo-800 mb-1">
                Section name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={regenSection}
                onChange={(e) => setRegenSection(e.target.value)}
                placeholder="e.g. Normalized Requirements table"
                className="w-full px-3 py-2 text-sm bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-indigo-800 mb-1">
                Additional instructions <span className="text-indigo-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={regenInstruction}
                onChange={(e) => setRegenInstruction(e.target.value)}
                placeholder="e.g. Add a priority column"
                className="w-full px-3 py-2 text-sm bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-gray-400"
              />
            </div>
          </div>
          {regenError && (
            <p className="text-xs text-red-600">{regenError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={closeRegen}
              className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || !regenSection.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full min-h-[70vh] max-h-[70vh] p-8 bg-white border border-gray-200 rounded-xl text-sm font-mono text-gray-800 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          spellCheck={false}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-h-[70vh] overflow-y-auto">
          <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-table:text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
