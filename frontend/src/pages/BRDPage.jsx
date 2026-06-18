import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadArea from '../components/UploadArea'
import BRDClarify from '../components/brd/BRDClarify'
import BRDReview from '../components/brd/BRDReview'
import BRDOutput from '../components/brd/BRDOutput'
import BRDHistoryModal from '../components/brd/BRDHistoryModal'
import { CheckCircleIcon, HistoryIcon, TrashIcon } from '../components/Icons'
import { authFetch } from '../utils'
import { extractBrdTitle } from '../brd-utils'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../pkce'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const HISTORY_KEY = 'brd_history'

const CORRIDOR_BASE = import.meta.env.VITE_CORRIDOR_BASE_URL || 'https://www.corridor.cloud'
const CORRIDOR_CLIENT_ID = import.meta.env.VITE_CORRIDOR_CLIENT_ID || ''
const CORRIDOR_PROJECT_SLUG = import.meta.env.VITE_CORRIDOR_PROJECT_SLUG || 'crd-generator'
const CORRIDOR_REDIRECT_URI = import.meta.env.VITE_CORRIDOR_REDIRECT_URI || `${window.location.origin}/auth/callback`

async function redirectToCorridorAuth() {
  sessionStorage.setItem('auth_redirect', '/brd')
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()
  sessionStorage.setItem('pkce_code_verifier', verifier)
  sessionStorage.setItem('pkce_state', state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CORRIDOR_CLIENT_ID,
    redirect_uri: CORRIDOR_REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    launch_project_slug: CORRIDOR_PROJECT_SLUG,
    scope: 'microapp',
  })
  window.location.href = `${CORRIDOR_BASE}/oauth/authorize?${params}`
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

// ── Helper components ──────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

function StatusBadge({ status }) {
  if (status === 'matched') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      Already Covered
    </span>
  )
  if (status === 'partial') return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      Partial Match
    </span>
  )
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      New Requirement
    </span>
  )
}

function SplitEditor({ onApply, onCancel }) {
  const [rows, setRows] = useState([{ name: '', points: '' }, { name: '', points: '' }])
  const update = (i, field, val) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  const addRow = () => setRows(rs => [...rs, { name: '', points: '' }])
  const removeRow = (i) => setRows(rs => rs.filter((_, idx) => idx !== i))
  const valid = rows.filter(r => r.name.trim())

  return (
    <div className="mt-1 rounded-lg border border-violet-200 bg-violet-50/40 p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-violet-800">Split into multiple BRDs</p>
        <p className="text-xs text-gray-500">Define each BRD's title and the key points it should cover. Each one is generated as its own document.</p>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">BRD {i + 1}</span>
            {rows.length > 2 && (
              <button onClick={() => removeRow(i)} className="ml-auto text-xs text-gray-400 hover:text-red-500">Remove</button>
            )}
          </div>
          <input
            value={row.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            placeholder="BRD title (e.g. User Management)"
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none"
          />
          <textarea
            value={row.points}
            onChange={(e) => update(i, 'points', e.target.value)}
            placeholder="Key points / scope this BRD should cover"
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none resize-y"
          />
        </div>
      ))}
      <div className="flex items-center gap-2">
        <button onClick={addRow} className="text-xs font-medium text-violet-700 hover:text-violet-900">+ Add another BRD</button>
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
          <button
            onClick={() => onApply(valid)}
            disabled={valid.length < 2}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            Apply split ({valid.length})
          </button>
        </div>
      </div>
    </div>
  )
}

function RequirementCard({ req, checkedIds, onToggleCheck, onGenerateBRD, onAnalyzeGap, onApplySplit, onClearSplit, loading }) {
  const [splitOpen, setSplitOpen] = useState(false)
  const borderColor = { matched: 'border-l-green-400', partial: 'border-l-amber-400', unmatched: 'border-l-red-400' }
  const bgColor = { matched: 'bg-green-50/40', partial: 'bg-amber-50/40', unmatched: 'bg-red-50/40' }
  const subBrds = req.subBrds || []
  const hasSplit = subBrds.length > 0
  const generatedCount = subBrds.filter(s => s.generated).length
  const matchedBrds = Array.isArray(req.matched_brds) && req.matched_brds.length > 0
    ? req.matched_brds
    : (req.matched_brd ? [{ name: req.matched_brd, link: req.matched_brd_link }] : [])

  return (
    <div className={`border-l-4 ${borderColor[req.status]} ${bgColor[req.status]} bg-white border border-gray-200 rounded-xl p-5 space-y-3`}>
      <div className="flex items-start gap-3">
        {req.status === 'unmatched' && !hasSplit && (
          <input
            type="checkbox"
            checked={checkedIds.has(req.name)}
            onChange={() => onToggleCheck(req.name)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 flex-shrink-0 cursor-pointer"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-gray-900">{req.name}</span>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-sm text-gray-600">{req.description}</p>
          <p className="text-xs text-gray-400 mt-1">
            Source: {req.crd_source}{req.br_id ? ` · ${req.br_id}` : ''}
          </p>
        </div>
      </div>

      {matchedBrds.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">
            Covered by {matchedBrds.length} existing BRD{matchedBrds.length > 1 ? 's' : ''}:
          </p>
          {matchedBrds.map((b, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <a
                href={b.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 hover:text-violet-800 hover:underline truncate"
              >
                {b.name}
              </a>
            </div>
          ))}
        </div>
      )}

      {req.status === 'partial' && req.coverage_note && (
        <p className="text-sm italic text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {req.coverage_note}
        </p>
      )}

      {hasSplit && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">
              Split into {subBrds.length} BRDs · {generatedCount} of {subBrds.length} generated
            </p>
            <button onClick={() => onClearSplit(req.name)} className="text-xs text-gray-400 hover:text-red-500">Clear split</button>
          </div>
          {subBrds.map((sub, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800">{sub.name}</p>
                  {sub.generated && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Generated
                    </span>
                  )}
                </div>
                {sub.points && <p className="text-xs text-gray-500 whitespace-pre-wrap mt-0.5">{sub.points}</p>}
              </div>
              <button
                onClick={() => onGenerateBRD(req, sub)}
                disabled={loading}
                className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border disabled:opacity-50 transition-colors ${
                  sub.generated
                    ? 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50'
                    : 'text-violet-700 bg-white border-violet-300 hover:bg-violet-50'
                }`}
              >
                {loading ? 'Starting…' : (sub.generated ? 'Regenerate' : 'Generate BRD')}
              </button>
            </div>
          ))}
          {generatedCount === subBrds.length
            ? <p className="text-xs text-green-700">All split BRDs generated.</p>
            : <p className="text-xs text-gray-400">{subBrds.length - generatedCount} remaining — generate each, then use “Back to match results” to return here.</p>}
        </div>
      )}

      {!hasSplit && splitOpen && (
        <SplitEditor
          onApply={(rows) => { onApplySplit(req.name, rows); setSplitOpen(false) }}
          onCancel={() => setSplitOpen(false)}
        />
      )}

      {!hasSplit && !splitOpen && (
        <div className="space-y-2">
          {req.status === 'matched' && (
            <p className="text-xs text-gray-400">
              Covered by an existing BRD. If that coverage is incomplete, you can still generate another BRD or split this requirement.
            </p>
          )}
          <div className="flex gap-2 flex-wrap">
            {req.status === 'partial' && (
              <button
                onClick={() => onAnalyzeGap(req)}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                Update Existing BRD
              </button>
            )}
            <button
              onClick={() => onGenerateBRD(req)}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Starting…' : (req.status === 'unmatched' ? 'Generate BRD' : 'Generate New BRD')}
            </button>
            <button
              onClick={() => setSplitOpen(true)}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Split into multiple BRDs
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchResults({ requirements, checkedIds, onToggleCheck, onGenerateBRD, onGenerateAll, onAnalyzeGap, onApplySplit, onClearSplit, loading, onUploadAnother }) {
  const matched = requirements.filter(r => r.status === 'matched')
  const partial = requirements.filter(r => r.status === 'partial')
  const unmatched = requirements.filter(r => r.status === 'unmatched')
  const allMatched = requirements.length > 0 && partial.length === 0 && unmatched.length === 0

  // Requirements that have been split into sub-BRDs are generated individually,
  // so they're excluded from the "Generate All New" batch.
  const batchable = unmatched.filter(r => !(r.subBrds && r.subBrds.length))
  const checkedUnmatched = batchable.filter(r => checkedIds.has(r.name))
  const generateAllTarget = checkedUnmatched.length > 0 ? checkedUnmatched : batchable

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Requirement Match Results</h2>
        <p className="text-sm text-gray-500">
          {matched.length > 0 && <span className="text-green-700 font-medium">{matched.length} already covered</span>}
          {matched.length > 0 && (partial.length > 0 || unmatched.length > 0) && <span className="text-gray-400"> · </span>}
          {partial.length > 0 && <span className="text-amber-700 font-medium">{partial.length} partial {partial.length === 1 ? 'match' : 'matches'}</span>}
          {partial.length > 0 && unmatched.length > 0 && <span className="text-gray-400"> · </span>}
          {unmatched.length > 0 && <span className="text-red-700 font-medium">{unmatched.length} new {unmatched.length === 1 ? 'requirement' : 'requirements'} found</span>}
          {requirements.length === 0 && <span>No requirements found.</span>}
        </p>
        {allMatched && (
          <div className="mt-3 flex items-center gap-4">
            <p className="text-sm text-green-700">All requirements from this CRD are already covered by existing BRDs.</p>
            <button
              onClick={onUploadAnother}
              className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors"
            >
              Upload Another CRD
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {requirements.map((req) => (
          <RequirementCard
            key={req.name}
            req={req}
            checkedIds={checkedIds}
            onToggleCheck={onToggleCheck}
            onGenerateBRD={onGenerateBRD}
            onAnalyzeGap={onAnalyzeGap}
            onApplySplit={onApplySplit}
            onClearSplit={onClearSplit}
            loading={loading}
          />
        ))}
      </div>

      {batchable.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            {checkedUnmatched.length > 0
              ? `${checkedUnmatched.length} of ${batchable.length} new requirements selected`
              : `${batchable.length} new requirement${batchable.length > 1 ? 's' : ''} — select to filter, or generate all at once`}
          </p>
          <button
            onClick={() => onGenerateAll(generateAllTarget)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Starting…' : `Generate All New (${generateAllTarget.length})`}
          </button>
        </div>
      )}
    </div>
  )
}

function GapReport({ requirement, report, loading, error, onBack, onGenerateNew }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to results
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Gap Analysis</h2>
        <p className="text-sm text-gray-500">
          Showing what needs to change in <span className="font-medium text-amber-700">{requirement.matched_brd}</span> to cover <span className="font-medium">{requirement.name}</span>.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center">
          <svg className="animate-spin h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm text-gray-500">Analyzing gap…</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {report && !loading && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-900">{report.summary}</p>
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Existing BRD</p>
              <a
                href={requirement.matched_brd_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-violet-600 hover:text-violet-800 hover:underline"
              >
                {requirement.matched_brd} ↗
              </a>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-800">
            Review the suggested changes below and apply them to the existing BRD document. Once updated, re-upload the document to keep the match results current.
          </div>

          <div className="space-y-4">
            {(report.sections || []).map((section, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{section.section}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      section.change_type === 'add'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {section.change_type === 'add' ? '+ Add' : '~ Update'}
                    </span>
                  </div>
                  <CopyButton text={section.draft} />
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs text-gray-500 italic">{section.reason}</p>
                  <pre className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 whitespace-pre-wrap font-sans leading-relaxed">
                    {section.draft}
                  </pre>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onGenerateNew}
              className="px-4 py-2 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors"
            >
              Generate New BRD Instead
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const TAB_ROUTES = {
  'Client Requirement': '/crd',
  'Business Requirement': '/brd',
  'Internal Requirement': '/ird',
  'Product Requirement': '/prd',
}

export default function BRDPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [phase, setPhase] = useState(1)
  const [notes, setNotes] = useState('')
  const [sourceNotes, setSourceNotes] = useState('')
  const [files, setFiles] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [questions, setQuestions] = useState([])
  const [brd, setBrd] = useState('')
  const [brdId, setBrdId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [brdHistory, setBrdHistory] = useState(loadHistory)
  const [historyModalEntry, setHistoryModalEntry] = useState(null)
  const [currentHistoryId, setCurrentHistoryId] = useState(null)

  // Match phase state
  const [matchResults, setMatchResults] = useState([])
  const [showMatchPhase, setShowMatchPhase] = useState(false)
  const [checkedReqIds, setCheckedReqIds] = useState(new Set())
  const [activeSplit, setActiveSplit] = useState(null) // { reqName, subName } of the sub-BRD currently being generated
  const [activeGapReq, setActiveGapReq] = useState(null)
  const [gapReport, setGapReport] = useState(null)
  const [gapLoading, setGapLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState('')
  const [gapError, setGapError] = useState('')

  useEffect(() => {
    if (!CORRIDOR_CLIENT_ID) {
      setAuthenticated(true)
      setAuthLoading(false)
      return
    }

    authFetch(`${API}/auth/me`)
      .then(r => {
        if (r.ok) {
          setAuthenticated(true)
          setAuthLoading(false)
          const url = new URL(window.location.href)
          if (url.searchParams.has('launch')) {
            url.searchParams.delete('launch')
            url.searchParams.delete('project')
            window.history.replaceState({}, '', url.toString())
          }
        } else {
          redirectToCorridorAuth()
        }
      })
      .catch(() => redirectToCorridorAuth())
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-gray-500">Signing in…</p>
      </div>
    )
  }

  const handleRefreshCorpus = async () => {
    setRefreshing(true)
    setRefreshMsg('')
    setError('')
    try {
      const res = await authFetch(`${API}/brd/refresh-corpus`, { method: 'POST' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRefreshMsg(`Loaded ${data.count} BRD${data.count === 1 ? '' : 's'} from Drive`)
    } catch (e) {
      setError(`Refresh failed: ${e.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      files.forEach(f => formData.append('files', f))

      const res = await authFetch(`${API}/brd/analyze`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMatchResults(data.requirements || [])
      setNotes(data.combined_notes || notes)
      setSourceNotes(data.combined_notes || notes)
      setShowMatchPhase(true)
    } catch (e) {
      setError(`Analysis failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateForRequirement = async (req, scope = null) => {
    setLoading(true)
    setError('')
    setActiveSplit(scope ? { reqName: req.name, subName: scope.name } : null)
    try {
      const base = sourceNotes || notes
      const reqNotes = scope
        ? `This BRD covers ONLY a focused slice of a larger requirement. Generate a BRD strictly limited to the scope below — other slices are documented in separate BRDs, so do not include them.\n\nBRD Title: ${scope.name}\nIn-scope key points:\n${scope.points}\n\nParent requirement: ${req.name} — ${req.description}\nSource CRD: ${req.crd_source}\n\nOriginal source documents:\n${base}`
        : `Requirement: ${req.name}\nDescription: ${req.description}\nSource CRD: ${req.crd_source}\n\nOriginal source documents:\n${base}`
      const reqAnalysis = scope
        ? `Generating BRD for: ${scope.name} — a focused slice of "${req.name}".\nIn-scope key points:\n${scope.points}\nSource: ${req.crd_source}`
        : `Generating BRD for: ${req.name}\n${req.description}\nSource: ${req.crd_source}`

      const res = await authFetch(`${API}/brd/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reqNotes, analysis: reqAnalysis, answers: [] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(reqAnalysis)
      setNotes(reqNotes)
      setQuestions(data.questions)
      setShowMatchPhase(false)
      setPhase(2)
    } catch (e) {
      setError(`Failed to start clarification: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAll = async (reqs) => {
    setLoading(true)
    setError('')
    try {
      const reqList = reqs.map(r => `- ${r.name}: ${r.description} (${r.crd_source})`).join('\n')
      const reqNotes = `Requirements to cover in this BRD:\n${reqList}\n\nOriginal source documents:\n${sourceNotes || notes}`
      const reqAnalysis = `Generating a BRD covering ${reqs.length} new requirement${reqs.length !== 1 ? 's' : ''}:\n${reqList}`

      const res = await authFetch(`${API}/brd/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reqNotes, analysis: reqAnalysis, answers: [] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(reqAnalysis)
      setNotes(reqNotes)
      setQuestions(data.questions)
      setShowMatchPhase(false)
      setPhase(2)
    } catch (e) {
      setError(`Failed to start clarification: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeGap = async (req) => {
    setActiveGapReq(req)
    setGapReport(null)
    setGapError('')
    setGapLoading(true)
    try {
      const res = await authFetch(`${API}/brd/analyze-gap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matched_brd_link: req.matched_brd_link,
          requirement_name: req.name,
          requirement_description: req.description,
          crd_source: req.crd_source,
          coverage_note: req.coverage_note || '',
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setGapReport(data)
    } catch (e) {
      setGapError(`Gap analysis failed: ${e.message}`)
    } finally {
      setGapLoading(false)
    }
  }

  const handleGenerate = async (answers) => {
    setLoading(true)
    setError('')
    try {
      const res = await authFetch(`${API}/brd/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, analysis, answers, filename: brdId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBrd(data.brd)
      setBrdId(data.brd_id || 'brd')
      setPhase(3)
    } catch (e) {
      setError(`Generation failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmChanges = (finalBrd) => {
    setBrd(finalBrd)
    setPhase(4)

    // Mark the split sub-BRD as generated so progress is tracked when the user
    // returns to the match results to generate the remaining slices.
    if (activeSplit) {
      setMatchResults(prev => prev.map(r =>
        r.name === activeSplit.reqName
          ? { ...r, subBrds: (r.subBrds || []).map(s => s.name === activeSplit.subName ? { ...s, generated: true } : s) }
          : r
      ))
    }

    const entry = {
      id: crypto.randomUUID(),
      brdId,
      businessName: extractBrdTitle(finalBrd),
      dateGenerated: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      brd: finalBrd,
    }
    const updated = [entry, ...brdHistory]
    setBrdHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    setCurrentHistoryId(entry.id)
  }

  const handleRename = (newName) => {
    const updated = brdHistory.map(e =>
      e.id === currentHistoryId ? { ...e, brdId: newName } : e
    )
    setBrdHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteHistoryEntry = (id) => {
    const updated = brdHistory.filter(e => e.id !== id)
    setBrdHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    if (historyModalEntry?.id === id) setHistoryModalEntry(null)
  }

  const handleTabChange = (tab) => navigate(TAB_ROUTES[tab] || '/brd')

  const applySplit = (reqName, subBrds) => {
    setMatchResults(prev => prev.map(r => r.name === reqName ? { ...r, subBrds } : r))
  }

  const clearSplit = (reqName) => {
    setMatchResults(prev => prev.map(r => {
      if (r.name !== reqName) return r
      const { subBrds, ...rest } = r
      return rest
    }))
  }

  const backToMatch = () => {
    setShowMatchPhase(true)
    setPhase(1)
    setActiveGapReq(null)
    setQuestions([])
    setBrd('')
    setError('')
  }

  const reset = () => {
    setPhase(1)
    setNotes('')
    setSourceNotes('')
    setFiles([])
    setAnalysis('')
    setQuestions([])
    setBrd('')
    setBrdId('')
    setError('')
    setMatchResults([])
    setShowMatchPhase(false)
    setCheckedReqIds(new Set())
    setActiveSplit(null)
    setActiveGapReq(null)
    setGapReport(null)
    setGapError('')
  }

  const handleUploadAnother = () => {
    setNotes('')
    setSourceNotes('')
    setFiles([])
    setMatchResults([])
    setShowMatchPhase(false)
    setCheckedReqIds(new Set())
    setError('')
  }

  const toggleCheck = (name) => {
    setCheckedReqIds(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-900 bg-zinc-50/50">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={reset}>
            <div className="bg-white p-1.5 rounded-lg border border-zinc-100 shadow-sm overflow-hidden flex items-center justify-center">
              <img src='https://firebasestorage.googleapis.com/v0/b/sg-as-price-list.firebasestorage.app/o/Screenshot%202026-02-04%20021131.png?alt=media' alt="Allocate Space Logo" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-zinc-900">Allocate Space</span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">AI Assisted Generator</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {['Analyze', 'Clarify', 'Review', 'Export'].map((label, i) => {
                const p = i + 1
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        phase === p
                          ? 'bg-violet-600 text-white'
                          : phase > p
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {phase > p ? <CheckCircleIcon className="w-3.5 h-3.5" /> : p}
                    </div>
                    <span className={`text-xs hidden sm:block ${phase === p ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {label}
                    </span>
                    {i < 3 && <div className="w-6 h-px bg-gray-200" />}
                  </div>
                )
              })}
            </div>
            {(phase > 1 || showMatchPhase) && (
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Start over
              </button>
            )}
            <button onClick={() => navigate('/graph')} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              Graph
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className={`${sidebarOpen ? 'w-64' : 'w-10'} border-r border-gray-200 bg-white flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200`}>
          <div className="px-2 py-3 border-b border-gray-100 flex items-center justify-between gap-2 min-w-0">
            {sidebarOpen && (
              <div className="flex items-center gap-2 min-w-0">
                <HistoryIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">Recent BRDs</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors flex-shrink-0 ml-auto"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <svg className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          {sidebarOpen && (
            <div className="flex-1 overflow-y-auto">
              {brdHistory.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 px-4 leading-relaxed">
                  No documents yet.<br />Generated BRDs will appear here.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {brdHistory.map(entry => (
                    <li key={entry.id} className="group relative">
                      <button
                        onClick={() => setHistoryModalEntry(entry)}
                        className="w-full text-left px-4 py-3 pr-9 hover:bg-gray-50 transition-colors"
                      >
                        <span className="block text-xs font-mono font-semibold text-violet-700 truncate">{entry.brdId}</span>
                        <span className="block text-sm font-medium text-gray-800 truncate">{entry.businessName}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{entry.dateGenerated}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.id) }}
                        className="absolute top-3 right-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all rounded"
                        aria-label="Delete"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>

        <main
          className="flex-1 overflow-y-auto"
          style={phase === 1 && !showMatchPhase ? {
            backgroundColor: '#f8f9fb',
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.055) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          } : {}}
        >
          <div className={phase === 1 && !showMatchPhase ? 'flex flex-col items-center justify-center min-h-full py-12 px-6' : 'max-w-3xl mx-auto px-6 py-8'}>
            {phase === 1 && !showMatchPhase && (
              <div className="w-full max-w-3xl">
                {error && <div className="mb-4 p-4 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-sm">{error}</div>}
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab="Business Requirement" onTabChange={handleTabChange} />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleRefreshCorpus}
                    disabled={refreshing}
                    className="text-xs font-medium text-zinc-500 hover:text-violet-700 disabled:opacity-50 flex items-center gap-1.5"
                    title="Re-read the latest BRDs from Google Drive so the AI matches against the newest documents"
                  >
                    <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {refreshing ? 'Refreshing BRDs…' : 'Refresh BRDs cache from Drive'}
                  </button>
                  {refreshMsg && <span className="text-xs text-emerald-600">{refreshMsg}</span>}
                </div>
              </div>
            )}
            {(phase > 1 || showMatchPhase) && error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}

            {phase === 1 && showMatchPhase && !activeGapReq && (
              <MatchResults
                requirements={matchResults}
                checkedIds={checkedReqIds}
                onToggleCheck={toggleCheck}
                onGenerateBRD={handleGenerateForRequirement}
                onGenerateAll={handleGenerateAll}
                onAnalyzeGap={handleAnalyzeGap}
                onApplySplit={applySplit}
                onClearSplit={clearSplit}
                onUploadAnother={handleUploadAnother}
                loading={loading}
              />
            )}

            {phase === 1 && showMatchPhase && activeGapReq && (
              <GapReport
                requirement={activeGapReq}
                report={gapReport}
                loading={gapLoading}
                error={gapError}
                onBack={() => { setActiveGapReq(null); setGapReport(null); setGapError('') }}
                onGenerateNew={() => handleGenerateForRequirement(activeGapReq)}
              />
            )}

            {(phase === 2 || phase === 3 || phase === 4) && matchResults.length > 0 && (
              <button
                onClick={backToMatch}
                className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to match results
              </button>
            )}
            {phase === 2 && (
              <BRDClarify analysis={analysis} questions={questions} onGenerate={handleGenerate} loading={loading} />
            )}
            {phase === 3 && (
              <BRDReview brd={brd} onConfirm={handleConfirmChanges} />
            )}
            {phase === 4 && (
              <BRDOutput brd={brd} brdId={brdId} onRename={handleRename} onBack={() => setPhase(3)} />
            )}
          </div>
        </main>
      </div>

      {historyModalEntry && (
        <BRDHistoryModal
          entry={historyModalEntry}
          onClose={() => setHistoryModalEntry(null)}
        />
      )}
    </div>
  )
}
