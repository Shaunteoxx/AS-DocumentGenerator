import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'
import { useGoogleLogin } from '@react-oauth/google'
import { DownloadIcon, PencilIcon, CloudUploadIcon, ArrowLeftIcon } from './Icons'
import { extractClientName, authFetch } from '../utils'
import Toast from './Toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const GDOCS_TOKEN_KEY = 'google_oauth_token'
const GDOCS_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GDOC_MIME = 'application/vnd.google-apps.document'
const CRD_FOLDER_ID = '1MTojq7o5eU6ypCb7JrXhnpo4Q34X8UzF'
const DEFAULT_LOG_ENDPOINT = '/log-to-sheet'

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

async function doUploadToDrive(token, mdContent, fileName, folderId) {
  const html = `<!DOCTYPE html><html><body>${marked.parse(mdContent)}</body></html>`
  const htmlBlob = new Blob([html], { type: 'text/html' })

  const boundary = `drive_${Date.now()}`
  const metadata = JSON.stringify({ name: fileName, parents: [folderId], mimeType: GDOC_MIME })
  const preamble = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/html',
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
      body: new Blob([preamble, htmlBlob, epilogue]),
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

async function logUploadToSheet(filename, clientName, driveLink, logEndpoint) {
  if (!logEndpoint) return
  try {
    await authFetch(`${API}${logEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, client_name: clientName, drive_link: driveLink }),
    })
  } catch {
    // sheet logging is best-effort; upload already succeeded
  }
}

export default function CRDOutput({ crd, crdId, onRename, onBack, folderId = CRD_FOLDER_ID, docLabel = 'CRD', logEndpoint = DEFAULT_LOG_ENDPOINT }) {
  const content = crd

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
  const [toast, setToast] = useState(null)
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
          folderId,
        )
        const uploadedFilename = pendingDriveFileName.current
        const uploadedClientName = extractClientName(pendingDriveContent.current)
        await logUploadToSheet(uploadedFilename, uploadedClientName, webViewLink, logEndpoint)
        setToast({ message: `${docLabel} uploaded to Google Drive · Row added to Sheets`, link: webViewLink, linkLabel: 'Open Doc' })
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
    const fileName = docId
    const storedToken = getStoredToken()
    if (storedToken) {
      try {
        const webViewLink = await doUploadToDrive(storedToken, content, fileName, folderId)
        await logUploadToSheet(docId, extractClientName(content), webViewLink, logEndpoint)
        setToast({ message: `${docLabel} uploaded to Google Drive · Row added to Sheets`, link: webViewLink, linkLabel: 'Open Doc' })
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Phase 4 — Export {docLabel}</h2>
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
            <p className="text-sm text-gray-500">Your document is ready. Download or upload to Google Drive.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Review
            </button>
          )}
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
            {driveLoading ? 'Uploading…' : 'Export to Google Docs'}
          </button>
        </div>
      </div>

      {driveError && (
        <p className="text-sm text-red-600">{driveError}</p>
      )}

      {toast && (
        <Toast
          message={toast.message}
          link={toast.link}
          linkLabel={toast.linkLabel}
          onDismiss={() => setToast(null)}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-8 max-h-[70vh] overflow-y-auto">
        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-table:text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
