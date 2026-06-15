import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DownloadIcon, PencilIcon, ArrowLeftIcon } from './Icons'
import { authFetch } from '../utils'
import Toast from './Toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function ClickUpIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.338 16.338L5.17 13.56a8.184 8.184 0 0013.66 0l2.832 2.778A11.84 11.84 0 0112 20.16a11.84 11.84 0 01-9.662-3.822z" />
      <path d="M12 3.84L5.574 9.948l2.875 2.726L12 9.312l3.551 3.362 2.875-2.726L12 3.84z" />
    </svg>
  )
}

export default function PRDOutput({ prd, prdId, onRename, onBack }) {
  const content = prd

  const [docId, setDocId] = useState(prdId || 'prd')
  const [idEditing, setIdEditing] = useState(false)
  const [idDraft, setIdDraft] = useState('')

  const saveId = () => {
    const newId = idDraft.trim() || prdId || 'prd'
    setDocId(newId)
    setIdEditing(false)
    onRename?.(newId)
  }

  const cancelId = () => setIdEditing(false)

  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState('')
  const [toast, setToast] = useState(null)

  const exportToClickUp = async () => {
    setExportLoading(true)
    setExportError('')
    try {
      const res = await authFetch(`${API}/prd/export-to-clickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prd: content, filename: docId }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Export failed (${res.status})`)
      }
      const data = await res.json()
      if (data.doc_url) {
        window.open(data.doc_url, '_blank')
        setToast({ message: 'PRD exported to ClickUp folder', link: data.doc_url, linkLabel: 'Open in ClickUp' })
      }
    } catch (e) {
      setExportError(e.message)
    } finally {
      setExportLoading(false)
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Phase 4 — Export PRD</h2>
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
                className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-orange-50 text-orange-700 border border-orange-400 outline-none focus:ring-1 focus:ring-orange-400 focus:ring-offset-0"
              />
            ) : (
              <span
                onClick={() => { setIdDraft(docId); setIdEditing(true) }}
                title="Click to rename"
                className="group inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold bg-orange-50 text-orange-700 border border-orange-200 cursor-pointer hover:border-orange-400 hover:bg-orange-100 transition-colors select-none"
              >
                {docId}
                <PencilIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
              </span>
            )}
            <p className="text-sm text-gray-500">Your document is ready. Download or export to ClickUp.</p>
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
            onClick={exportToClickUp}
            disabled={exportLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-orange-700 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ClickUpIcon className="w-4 h-4" />
            {exportLoading ? 'Exporting…' : 'Export to ClickUp'}
          </button>
        </div>
      </div>

      {exportError && (
        <p className="text-sm text-red-600">{exportError}</p>
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
