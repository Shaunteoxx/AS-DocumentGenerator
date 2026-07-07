import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AppHeader from '../components/AppHeader'
import { authFetch } from '../utils'
import { API } from '../constants'

// Same parseSections used in CRDReview / BRDReview / IRDReview.
// Splits on H1 (#), H2 (##) and H3 (###) boundaries so docs work whether their
// section titles are styled as Heading 1, 2 or 3 (e.g. each BR-0N is an H3).
function parseSections(markdown) {
  const parts = markdown.split(/(?=\n#{1,3} )/)
  return parts.map((part, idx) => {
    const trimmed = part.trim()
    if (!trimmed) return null
    const firstLine = trimmed.split('\n')[0]
    const m = firstLine.match(/^#{1,3}\s+(.+)/)
    return {
      heading: m ? m[1] : (idx === 0 ? 'Document Overview' : 'Section'),
      content: trimmed,
    }
  }).filter(Boolean)
}

const TYPE_CONFIG = {
  crd: { label: 'CRD', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100', accent: 'border-l-blue-500', ring: 'ring-blue-400' },
  brd: { label: 'BRD', badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100', accent: 'border-l-violet-500', ring: 'ring-violet-400' },
  ird: { label: 'IRD', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100', accent: 'border-l-emerald-500', ring: 'ring-emerald-400' },
}

function SparklesIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ExternalLinkIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function Spinner({ className }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SectionSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden animate-pulse">
      <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-100 flex items-center justify-between">
        <div className="h-4 w-32 bg-zinc-200 rounded" />
        <div className="h-7 w-36 bg-zinc-200 rounded-lg" />
      </div>
      <div className="px-6 py-5 space-y-2">
        <div className="h-3 bg-zinc-100 rounded w-full" />
        <div className="h-3 bg-zinc-100 rounded w-5/6" />
        <div className="h-3 bg-zinc-100 rounded w-4/6" />
        <div className="h-3 bg-zinc-100 rounded w-full mt-4" />
        <div className="h-3 bg-zinc-100 rounded w-3/4" />
      </div>
    </div>
  )
}

function SectionCard({ section, docId, docType, fullContent, onContentUpdate }) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewFull, setPreviewFull] = useState('')
  const [previewNext, setPreviewNext] = useState(null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [savedToDrive, setSavedToDrive] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.crd

  const resetPreview = () => {
    setPreview(null)
    setPreviewFull('')
    setPreviewNext(null)
    setShowCurrent(false)
  }

  const handleOpen = () => {
    setOpen(o => !o)
    resetPreview()
    setSavedToDrive(false)
    setError('')
    if (!open) setTimeout(() => textareaRef.current?.focus(), 50)
  }

  // Step 1 — regenerate the section. Returns a preview only; nothing is written
  // to Drive until the user confirms with handleSave.
  const handleRegenerate = async () => {
    if (!instruction.trim()) return
    setRegenerating(true)
    setError('')
    try {
      const res = await authFetch(`${API}/documents/${docId}/regenerate-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_heading: section.heading,
          instruction,
          doc_type: docType,
          full_content: fullContent,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Server error ${res.status}`)
      }
      const data = await res.json()
      setPreview(data.updated_section)
      setPreviewFull(data.full_content)
      setPreviewNext(data.next_heading ?? null)
      setShowCurrent(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setRegenerating(false)
    }
  }

  // Step 2 — user confirmed; persist the previewed section to Drive.
  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setError('')
    try {
      const res = await authFetch(`${API}/documents/${docId}/save-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          section_heading: section.heading,
          next_heading: previewNext,
          section_content: preview.content,
          full_content: previewFull,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Server error ${res.status}`)
      }
      onContentUpdate(previewFull)
      setSavedToDrive(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Strip the heading line from the content before rendering so the card header
  // doesn't duplicate the ## heading inside the prose body
  const stripHeading = (content) => {
    if (!content) return ''
    const lines = content.split('\n')
    if (lines[0] && /^#{1,4}\s/.test(lines[0])) {
      return lines.slice(1).join('\n').trimStart()
    }
    return content
  }

  const rawContent = (savedToDrive && preview) ? preview.content : section.content
  const displayContent = stripHeading(rawContent)

  return (
    <div className={`bg-white border border-zinc-200 border-l-4 ${cfg.accent} rounded-xl overflow-hidden transition-shadow duration-200 ${open ? 'shadow-md' : 'hover:shadow-sm'}`}>
      {/* Section header */}
      <div className="px-6 py-3.5 bg-zinc-50/80 border-b border-zinc-100 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-zinc-700 truncate">{section.heading}</span>
        <button
          onClick={handleOpen}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 flex-shrink-0 cursor-pointer ${
            open
              ? 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
              : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
          }`}
        >
          {open ? (
            <>
              <XIcon className="w-3.5 h-3.5" />
              Close
            </>
          ) : (
            <>
              <SparklesIcon className="w-3.5 h-3.5" />
              Comment & Regenerate
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-table:text-sm prose-th:bg-zinc-50 prose-td:py-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
        </div>

        {savedToDrive && (
          <div className="flex items-center gap-1.5 mt-4 text-xs font-semibold text-emerald-600">
            <span className="inline-flex items-center justify-center w-4 h-4 bg-emerald-100 rounded-full">
              <CheckIcon className="w-2.5 h-2.5" />
            </span>
            Saved to Drive
          </div>
        )}
      </div>

      {/* Comment panel */}
      {open && (
        <div className="border-t border-zinc-100 bg-gradient-to-b from-zinc-50/80 to-white px-6 py-5">
          {savedToDrive && preview ? (
            /* Saved confirmation */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-4 h-4 bg-emerald-100 rounded-full flex-shrink-0">
                  <CheckIcon className="w-2.5 h-2.5 text-emerald-600" />
                </span>
                <p className="text-xs font-semibold text-zinc-700">New version saved to Drive</p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 prose prose-sm max-w-none prose-headings:font-semibold prose-table:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripHeading(preview.content)}</ReactMarkdown>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => { resetPreview(); setSavedToDrive(false); setInstruction('') }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Edit again
                </button>
                <button
                  onClick={() => { setOpen(false); resetPreview(); setSavedToDrive(false); setInstruction('') }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            </div>
          ) : preview ? (
            /* Proposed change — review before it's written to Drive */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-zinc-700">Review the proposed change before saving to Drive</p>
                <button
                  onClick={() => setShowCurrent(s => !s)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex-shrink-0 cursor-pointer"
                >
                  {showCurrent ? 'Hide current' : 'Compare with current'}
                </button>
              </div>

              {showCurrent && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Current</p>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-4 prose prose-sm max-w-none prose-headings:font-semibold prose-table:text-sm opacity-75">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripHeading(section.content)}</ReactMarkdown>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {showCurrent && <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Proposed</p>}
                <div className="bg-white border-2 border-indigo-200 rounded-xl px-5 py-4 prose prose-sm max-w-none prose-headings:font-semibold prose-table:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripHeading(preview.content)}</ReactMarkdown>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => { resetPreview(); setError('') }}
                  disabled={saving}
                  className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  ← Edit comment
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Spinner className="w-3.5 h-3.5" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-3.5 h-3.5" />
                      Confirm & Save to Drive
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Comment input */
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-zinc-700">
                What changes would you like to this section?
              </label>
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder="e.g. Make the timeline more specific, add a priority column to the table, expand the scope section…"
                rows={3}
                className="w-full px-4 py-3 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-zinc-400 resize-none transition-all leading-relaxed"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && instruction.trim()) {
                    handleRegenerate()
                  }
                }}
              />
              {error && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-400">⌘↵ to regenerate</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || !instruction.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    {regenerating ? (
                      <>
                        <Spinner className="w-3.5 h-3.5" />
                        Regenerating…
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-3.5 h-3.5" />
                        Regenerate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DocViewerPage() {
  const { docId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const docType = searchParams.get('type') || 'crd'

  const [doc, setDoc] = useState(null)
  const [fullContent, setFullContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    authFetch(`${API}/documents/${docId}/content?doc_type=${docType}`)
      .then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(t)))
      .then(data => { setDoc(data); setFullContent(data.full_content) })
      .catch(e => setError(`Failed to load document: ${e}`))
      .finally(() => setLoading(false))
  }, [docId, docType])

  const cfg = TYPE_CONFIG[docType] || TYPE_CONFIG.crd

  return (
    <div className="min-h-screen flex flex-col font-sans bg-zinc-50 text-zinc-900">
      <AppHeader subtitle="Document Review" onLogoClick={() => navigate('/crd')}>
        {doc?.drive_link && (
          <a
            href={doc.drive_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors duration-150"
          >
            <ExternalLinkIcon className="w-3.5 h-3.5" />
            Open in Drive
          </a>
        )}
        <button
          onClick={() => navigate('/docs')}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 transition-colors duration-150 cursor-pointer"
        >
          ← Library
        </button>
      </AppHeader>

      {/* Doc title bar */}
      {!loading && doc && (
        <div className="bg-white border-b border-zinc-100">
          <div className="max-w-3xl mx-auto px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  {doc.modified && (
                    <span className="text-xs text-zinc-400">Modified {doc.modified}</span>
                  )}
                </div>
                <h1 className="text-xl font-bold text-zinc-900 truncate">{doc.title}</h1>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Click <span className="font-semibold text-zinc-700">Comment & Regenerate</span> on any section to leave feedback. The AI rewrites that section and shows you the proposed change — nothing is saved to Drive until you confirm.
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-7">
        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="bg-white border border-zinc-100 rounded-xl px-6 py-5 mb-2 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-10 bg-zinc-100 rounded-md" />
                <div className="h-4 w-24 bg-zinc-100 rounded" />
              </div>
              <div className="h-6 w-2/3 bg-zinc-100 rounded mb-2" />
              <div className="h-3 bg-zinc-100 rounded w-full" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => <SectionSkeleton key={i} />)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Sections — split on the frontend exactly like the review phase components */}
        {!loading && !error && doc && (
          <div className="space-y-4">
            {parseSections(fullContent).map((section, i) => (
              <SectionCard
                key={`${section.heading}-${i}`}
                section={section}
                docId={docId}
                docType={docType}
                fullContent={fullContent}
                onContentUpdate={setFullContent}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
