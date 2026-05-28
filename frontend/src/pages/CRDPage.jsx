import { useState, useEffect } from 'react'
import UploadArea from '../components/UploadArea'
import ChatDisplay from '../components/ChatDisplay'
import CRDReview from '../components/CRDReview'
import CRDOutput from '../components/CRDOutput'
import CRDHistoryModal from '../components/CRDHistoryModal'
import BRDClarify from '../components/brd/BRDClarify'
import BRDReview from '../components/brd/BRDReview'
import BRDOutput from '../components/brd/BRDOutput'
import BRDHistoryModal from '../components/brd/BRDHistoryModal'
import { CheckCircleIcon, HistoryIcon, TrashIcon } from '../components/Icons'
import { extractClientName, authFetch } from '../utils'
import { extractBrdTitle } from '../brd-utils'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../pkce'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CRD_HISTORY_KEY = 'crd_history'
const BRD_HISTORY_KEY = 'brd_history'

const CORRIDOR_BASE = import.meta.env.VITE_CORRIDOR_BASE_URL || 'https://www.corridor.cloud'
const CORRIDOR_CLIENT_ID = import.meta.env.VITE_CORRIDOR_CLIENT_ID || ''
const CORRIDOR_PROJECT_SLUG = import.meta.env.VITE_CORRIDOR_PROJECT_SLUG || 'crd-generator'
const CORRIDOR_REDIRECT_URI = import.meta.env.VITE_CORRIDOR_REDIRECT_URI || `${window.location.origin}/auth/callback`

const TAB_DOC_TYPE = {
  'Client Requirement': 'crd',
  'Internal Requirement': 'crd',
  'Business Requirement': 'brd',
  'Product Requirement': 'crd',
}

async function redirectToCorridorAuth() {
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

function loadHistory(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

// ── BRD inline components ─────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
    >
      {copied ? (
        <><svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
      ) : (
        <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
      )}
    </button>
  )
}

function StatusBadge({ status }) {
  if (status === 'matched') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Already Covered</span>
  if (status === 'partial') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Partial Match</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">New Requirement</span>
}

function MatchResults({ requirements, checkedIds, onToggleCheck, onGenerateBRD, onGenerateAll, onAnalyzeGap, loading, onUploadAnother }) {
  const matched = requirements.filter(r => r.status === 'matched')
  const partial = requirements.filter(r => r.status === 'partial')
  const unmatched = requirements.filter(r => r.status === 'unmatched')
  const allMatched = requirements.length > 0 && partial.length === 0 && unmatched.length === 0
  const checkedUnmatched = unmatched.filter(r => checkedIds.has(r.name))
  const generateAllTarget = checkedUnmatched.length > 0 ? checkedUnmatched : unmatched
  const borderColor = { matched: 'border-l-green-400', partial: 'border-l-amber-400', unmatched: 'border-l-red-400' }
  const bgColor = { matched: 'bg-green-50/40', partial: 'bg-amber-50/40', unmatched: 'bg-red-50/40' }

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
            <button onClick={onUploadAnother} className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors">Upload Another CRD</button>
          </div>
        )}
      </div>
      <div className="space-y-3">
        {requirements.map((req) => (
          <div key={req.name} className={`border-l-4 ${borderColor[req.status]} ${bgColor[req.status]} bg-white border border-gray-200 rounded-xl p-5 space-y-3`}>
            <div className="flex items-start gap-3">
              {req.status === 'unmatched' && (
                <input type="checkbox" checked={checkedIds.has(req.name)} onChange={() => onToggleCheck(req.name)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 flex-shrink-0 cursor-pointer" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900">{req.name}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-sm text-gray-600">{req.description}</p>
                <p className="text-xs text-gray-400 mt-1">Source: {req.crd_source}{req.br_id ? ` · ${req.br_id}` : ''}</p>
              </div>
            </div>
            {req.matched_brd && (
              <div className="flex items-center gap-1.5 text-sm">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <a href={req.matched_brd_link} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 hover:underline truncate">{req.matched_brd}</a>
              </div>
            )}
            {req.status === 'partial' && req.coverage_note && (
              <p className="text-sm italic text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{req.coverage_note}</p>
            )}
            {req.status === 'partial' && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => onAnalyzeGap(req)} disabled={loading} className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors">Update Existing BRD</button>
                <button onClick={() => onGenerateBRD(req)} disabled={loading} className="px-3 py-1.5 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 disabled:opacity-50 transition-colors">Generate New BRD</button>
              </div>
            )}
            {req.status === 'unmatched' && (
              <button onClick={() => onGenerateBRD(req)} disabled={loading} className="px-3 py-1.5 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 disabled:opacity-50 transition-colors">{loading ? 'Starting…' : 'Generate BRD'}</button>
            )}
          </div>
        ))}
      </div>
      {unmatched.length > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            {checkedUnmatched.length > 0 ? `${checkedUnmatched.length} of ${unmatched.length} new requirements selected` : `${unmatched.length} new requirement${unmatched.length > 1 ? 's' : ''} — select to filter, or generate all at once`}
          </p>
          <button onClick={() => onGenerateAll(generateAllTarget)} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50 transition-colors shadow-sm">
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
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to results
      </button>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Gap Analysis</h2>
        <p className="text-sm text-gray-500">Showing what needs to change in <span className="font-medium text-amber-700">{requirement.matched_brd}</span> to cover <span className="font-medium">{requirement.name}</span>.</p>
      </div>
      {loading && <div className="flex items-center gap-3 py-12 justify-center"><svg className="animate-spin h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg><span className="text-sm text-gray-500">Analyzing gap…</span></div>}
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
      {report && !loading && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><p className="text-sm font-medium text-amber-900">{report.summary}</p></div>
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Existing BRD</p>
              <a href={requirement.matched_brd_link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-600 hover:text-violet-800 hover:underline">{requirement.matched_brd} ↗</a>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-800">Review the suggested changes below and apply them to the existing BRD document.</div>
          <div className="space-y-4">
            {(report.sections || []).map((section, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700">{section.section}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${section.change_type === 'add' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{section.change_type === 'add' ? '+ Add' : '~ Update'}</span>
                  </div>
                  <CopyButton text={section.draft} />
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-xs text-gray-500 italic">{section.reason}</p>
                  <pre className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 whitespace-pre-wrap font-sans leading-relaxed">{section.draft}</pre>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button onClick={onGenerateNew} className="px-4 py-2 text-sm font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 transition-colors">Generate New BRD Instead</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CRDPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

  // Tab / doc-type
  const [activeTab, setActiveTab] = useState('Client Requirement')
  const docType = TAB_DOC_TYPE[activeTab] || 'crd'

  // Shared state
  const [phase, setPhase] = useState(1)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // CRD state
  const [crd, setCrd] = useState('')
  const [crdId, setCrdId] = useState('')
  const [crdHistory, setCrdHistory] = useState(() => loadHistory(CRD_HISTORY_KEY))
  const [crdHistoryModal, setCrdHistoryModal] = useState(null)
  const [currentCrdHistId, setCurrentCrdHistId] = useState(null)

  // BRD state
  const [brd, setBrd] = useState('')
  const [brdId, setBrdId] = useState('')
  const [brdHistory, setBrdHistory] = useState(() => loadHistory(BRD_HISTORY_KEY))
  const [brdHistoryModal, setBrdHistoryModal] = useState(null)
  const [currentBrdHistId, setCurrentBrdHistId] = useState(null)
  const [matchResults, setMatchResults] = useState([])
  const [showMatchPhase, setShowMatchPhase] = useState(false)
  const [checkedReqIds, setCheckedReqIds] = useState(new Set())
  const [activeGapReq, setActiveGapReq] = useState(null)
  const [gapReport, setGapReport] = useState(null)
  const [gapLoading, setGapLoading] = useState(false)
  const [gapError, setGapError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (!CORRIDOR_CLIENT_ID) { setAuthenticated(true); setAuthLoading(false); return }
    authFetch(`${API}/auth/me`)
      .then(r => {
        if (r.ok) {
          setAuthenticated(true); setAuthLoading(false)
          const url = new URL(window.location.href)
          if (url.searchParams.has('launch')) { url.searchParams.delete('launch'); url.searchParams.delete('project'); window.history.replaceState({}, '', url.toString()) }
        } else { redirectToCorridorAuth() }
      })
      .catch(() => redirectToCorridorAuth())
  }, [])

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><p className="text-sm text-gray-500">Signing in…</p></div>

  const reset = () => {
    setPhase(1); setNotes(''); setFiles([]); setAnalysis(''); setQuestions([])
    setCrd(''); setCrdId(''); setBrd(''); setBrdId(''); setError('')
    setMatchResults([]); setShowMatchPhase(false); setCheckedReqIds(new Set())
    setActiveGapReq(null); setGapReport(null); setGapError('')
  }

  const handleTabChange = (tab) => { setActiveTab(tab); reset() }

  // ── Analyze ──────────────────────────────────────────────────────────────────

  const handleAnalyze = async () => {
    setLoading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      files.forEach(f => formData.append('files', f))

      if (docType === 'brd') {
        const res = await authFetch(`${API}/brd/analyze`, { method: 'POST', body: formData })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setMatchResults(data.requirements || [])
        setNotes(data.combined_notes || notes)
        setShowMatchPhase(true)
      } else {
        const res = await authFetch(`${API}/analyze`, { method: 'POST', body: formData })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setAnalysis(data.analysis)
        const combined = data.combined_notes || notes
        setNotes(combined)
        const res2 = await authFetch(`${API}/clarify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: combined, analysis: data.analysis, answers: [] }),
        })
        if (!res2.ok) throw new Error(await res2.text())
        const data2 = await res2.json()
        setQuestions(data2.questions)
        setPhase(2)
      }
    } catch (e) { setError(`Analysis failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  // ── CRD handlers ─────────────────────────────────────────────────────────────

  const handleCrdGenerate = async (answers) => {
    setLoading(true); setError('')
    try {
      const res = await authFetch(`${API}/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, analysis, answers, filename: crdId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setCrd(data.crd); setCrdId(data.crd_id || 'crd'); setPhase(3)
    } catch (e) { setError(`Generation failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleCrdConfirm = (finalCrd) => {
    setCrd(finalCrd); setPhase(4)
    const entry = { id: crypto.randomUUID(), crdId, clientName: extractClientName(finalCrd), dateGenerated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), crd: finalCrd }
    const updated = [entry, ...crdHistory]
    setCrdHistory(updated); localStorage.setItem(CRD_HISTORY_KEY, JSON.stringify(updated)); setCurrentCrdHistId(entry.id)
  }

  const handleCrdRename = (newName) => {
    const updated = crdHistory.map(e => e.id === currentCrdHistId ? { ...e, crdId: newName } : e)
    setCrdHistory(updated); localStorage.setItem(CRD_HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteCrdEntry = (id) => {
    const updated = crdHistory.filter(e => e.id !== id)
    setCrdHistory(updated); localStorage.setItem(CRD_HISTORY_KEY, JSON.stringify(updated))
    if (crdHistoryModal?.id === id) setCrdHistoryModal(null)
  }

  // ── BRD handlers ─────────────────────────────────────────────────────────────

  const handleBrdGenerateForRequirement = async (req) => {
    setLoading(true); setError('')
    try {
      const reqNotes = `Requirement: ${req.name}\nDescription: ${req.description}\nSource CRD: ${req.crd_source}\n\nOriginal source documents:\n${notes}`
      const reqAnalysis = `Generating BRD for: ${req.name}\n${req.description}\nSource: ${req.crd_source}`
      const res = await authFetch(`${API}/brd/clarify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reqNotes, analysis: reqAnalysis, answers: [] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(reqAnalysis); setNotes(reqNotes); setQuestions(data.questions)
      setShowMatchPhase(false); setPhase(2)
    } catch (e) { setError(`Failed to start clarification: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleBrdGenerateAll = async (reqs) => {
    setLoading(true); setError('')
    try {
      const reqList = reqs.map(r => `- ${r.name}: ${r.description} (${r.crd_source})`).join('\n')
      const reqNotes = `Requirements to cover in this BRD:\n${reqList}\n\nOriginal source documents:\n${notes}`
      const reqAnalysis = `Generating a BRD covering ${reqs.length} new requirement${reqs.length !== 1 ? 's' : ''}:\n${reqList}`
      const res = await authFetch(`${API}/brd/clarify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: reqNotes, analysis: reqAnalysis, answers: [] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(reqAnalysis); setNotes(reqNotes); setQuestions(data.questions)
      setShowMatchPhase(false); setPhase(2)
    } catch (e) { setError(`Failed to start clarification: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleBrdAnalyzeGap = async (req) => {
    setActiveGapReq(req); setGapReport(null); setGapError(''); setGapLoading(true)
    try {
      const res = await authFetch(`${API}/brd/analyze-gap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matched_brd_link: req.matched_brd_link, requirement_name: req.name, requirement_description: req.description, crd_source: req.crd_source, coverage_note: req.coverage_note || '' }),
      })
      if (!res.ok) throw new Error(await res.text())
      setGapReport(await res.json())
    } catch (e) { setGapError(`Gap analysis failed: ${e.message}`) }
    finally { setGapLoading(false) }
  }

  const handleBrdGenerate = async (answers) => {
    setLoading(true); setError('')
    try {
      const res = await authFetch(`${API}/brd/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, analysis, answers, filename: brdId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBrd(data.brd); setBrdId(data.brd_id || 'brd'); setPhase(3)
    } catch (e) { setError(`Generation failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleBrdConfirm = (finalBrd) => {
    setBrd(finalBrd); setPhase(4)
    const entry = { id: crypto.randomUUID(), brdId, businessName: extractBrdTitle(finalBrd), dateGenerated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), brd: finalBrd }
    const updated = [entry, ...brdHistory]
    setBrdHistory(updated); localStorage.setItem(BRD_HISTORY_KEY, JSON.stringify(updated)); setCurrentBrdHistId(entry.id)
  }

  const handleBrdRename = (newName) => {
    const updated = brdHistory.map(e => e.id === currentBrdHistId ? { ...e, brdId: newName } : e)
    setBrdHistory(updated); localStorage.setItem(BRD_HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteBrdEntry = (id) => {
    const updated = brdHistory.filter(e => e.id !== id)
    setBrdHistory(updated); localStorage.setItem(BRD_HISTORY_KEY, JSON.stringify(updated))
    if (brdHistoryModal?.id === id) setBrdHistoryModal(null)
  }

  const handleUploadAnother = () => { setNotes(''); setFiles([]); setMatchResults([]); setShowMatchPhase(false); setCheckedReqIds(new Set()); setError('') }
  const toggleCheck = (name) => setCheckedReqIds(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next })

  const isBrd = docType === 'brd'
  const history = isBrd ? brdHistory : crdHistory

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={reset}>
            <div className="bg-white p-1.5 rounded-lg border border-zinc-100 shadow-sm overflow-hidden flex items-center justify-center">
              <img src="https://firebasestorage.googleapis.com/v0/b/sg-as-price-list.firebasestorage.app/o/Screenshot%202026-02-04%20021131.png?alt=media" alt="Allocate Space Logo" className="h-8 w-auto object-contain" />
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
                const activeColor = isBrd ? 'bg-violet-600' : 'bg-blue-600'
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${phase === p ? activeColor + ' text-white' : phase > p ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {phase > p ? <CheckCircleIcon className="w-3.5 h-3.5" /> : p}
                    </div>
                    <span className={`text-xs hidden sm:block ${phase === p ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
                    {i < 3 && <div className="w-6 h-px bg-gray-200" />}
                  </div>
                )
              })}
            </div>
            {(phase > 1 || showMatchPhase) && (
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">Start over</button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-10'} border-r border-gray-200 bg-white flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200`}>
          <div className="px-2 py-3 border-b border-gray-100 flex items-center justify-between gap-2 min-w-0">
            {sidebarOpen && (
              <div className="flex items-center gap-2 min-w-0">
                <HistoryIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">Recent {isBrd ? 'BRDs' : 'CRDs'}</span>
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
              {history.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 px-4 leading-relaxed">No documents yet.<br />Generated {isBrd ? 'BRDs' : 'CRDs'} will appear here.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {history.map(entry => (
                    <li key={entry.id} className="group relative">
                      <button onClick={() => isBrd ? setBrdHistoryModal(entry) : setCrdHistoryModal(entry)} className="w-full text-left px-4 py-3 pr-9 hover:bg-gray-50 transition-colors">
                        <span className={`block text-xs font-mono font-semibold truncate ${isBrd ? 'text-violet-700' : 'text-blue-700'}`}>{isBrd ? entry.brdId : entry.crdId}</span>
                        <span className="block text-sm font-medium text-gray-800 truncate">{isBrd ? entry.businessName : entry.clientName}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{entry.dateGenerated}</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); isBrd ? deleteBrdEntry(entry.id) : deleteCrdEntry(entry.id) }} className="absolute top-3 right-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all rounded" aria-label="Delete">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>

        {/* Main content */}
        <main
          className="flex-1 overflow-y-auto"
          style={phase === 1 ? {
            backgroundColor: '#f8f9fb',
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.055) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          } : {}}
        >
          <div className={phase === 1 ? 'flex flex-col items-center justify-center min-h-full py-12 px-6' : 'max-w-3xl mx-auto px-6 py-8'}>

            {/* Phase 1 — input */}
            {phase === 1 && !showMatchPhase && (
              <div className="w-full max-w-3xl">
                {error && <div className="mb-4 p-4 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-sm">{error}</div>}
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab={activeTab} onTabChange={handleTabChange} />
              </div>
            )}

            {/* BRD match phase */}
            {phase === 1 && showMatchPhase && !activeGapReq && (
              <>
                {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
                <MatchResults requirements={matchResults} checkedIds={checkedReqIds} onToggleCheck={toggleCheck} onGenerateBRD={handleBrdGenerateForRequirement} onGenerateAll={handleBrdGenerateAll} onAnalyzeGap={handleBrdAnalyzeGap} onUploadAnother={handleUploadAnother} loading={loading} />
              </>
            )}
            {phase === 1 && showMatchPhase && activeGapReq && (
              <GapReport requirement={activeGapReq} report={gapReport} loading={gapLoading} error={gapError} onBack={() => { setActiveGapReq(null); setGapReport(null); setGapError('') }} onGenerateNew={() => handleBrdGenerateForRequirement(activeGapReq)} />
            )}

            {/* Phase 2+ error */}
            {phase > 1 && error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

            {/* Phase 2 — clarify */}
            {phase === 2 && !isBrd && <ChatDisplay analysis={analysis} questions={questions} onGenerate={handleCrdGenerate} loading={loading} />}
            {phase === 2 && isBrd && <BRDClarify analysis={analysis} questions={questions} onGenerate={handleBrdGenerate} loading={loading} />}

            {/* Phase 3 — review */}
            {phase === 3 && !isBrd && <CRDReview crd={crd} onConfirm={handleCrdConfirm} />}
            {phase === 3 && isBrd && <BRDReview brd={brd} onConfirm={handleBrdConfirm} />}

            {/* Phase 4 — output */}
            {phase === 4 && !isBrd && <CRDOutput crd={crd} crdId={crdId} onRename={handleCrdRename} onBack={() => setPhase(3)} />}
            {phase === 4 && isBrd && <BRDOutput brd={brd} brdId={brdId} onRename={handleBrdRename} onBack={() => setPhase(3)} />}
          </div>
        </main>
      </div>

      {crdHistoryModal && <CRDHistoryModal entry={crdHistoryModal} onClose={() => setCrdHistoryModal(null)} />}
      {brdHistoryModal && <BRDHistoryModal entry={brdHistoryModal} onClose={() => setBrdHistoryModal(null)} />}
    </div>
  )
}
