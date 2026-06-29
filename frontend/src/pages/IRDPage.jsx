import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadArea from '../components/UploadArea'
import ChatDisplay from '../components/ChatDisplay'
import IRDReview from '../components/IRDReview'
import IRDOutput from '../components/IRDOutput'
import IRDHistoryModal from '../components/IRDHistoryModal'
import { CheckCircleIcon, HistoryIcon, TrashIcon } from '../components/Icons'
import { authFetch } from '../utils'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../pkce'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const HISTORY_KEY = 'ird_history'

const CORRIDOR_BASE = import.meta.env.VITE_CORRIDOR_BASE_URL || 'https://www.corridor.cloud'
const CORRIDOR_CLIENT_ID = import.meta.env.VITE_CORRIDOR_CLIENT_ID || ''
const CORRIDOR_PROJECT_SLUG = import.meta.env.VITE_CORRIDOR_PROJECT_SLUG || 'crd-generator'
const CORRIDOR_REDIRECT_URI = import.meta.env.VITE_CORRIDOR_REDIRECT_URI || `${window.location.origin}/auth/callback`

async function redirectToCorridorAuth() {
  sessionStorage.setItem('auth_redirect', '/ird')
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

const TAB_ROUTES = {
  'Client Requirement': '/crd',
  'Business Requirement': '/brd',
  'Internal Requirement': '/ird',
  'Product Requirement': '/prd',
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function extractInternalName(md) {
  const match = md.match(/\*\*(?:Initiative\s+Name|Team\s*\/\s*Department)\*\*[:\s]+([^\n*]+)/i)
  if (match) return match[1].trim()
  const heading = md.match(/^#\s+(.+)$/m)
  return heading ? heading[1].trim() : 'Internal Requirement'
}

export default function IRDPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [phase, setPhase] = useState(1)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [questions, setQuestions] = useState([])
  const [ird, setIrd] = useState('')
  const [irdId, setIrdId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [irdHistory, setIrdHistory] = useState(loadHistory)
  const [historyModal, setHistoryModal] = useState(null)
  const [currentHistoryId, setCurrentHistoryId] = useState(null)

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

  const handleTabChange = (tab) => navigate(TAB_ROUTES[tab] || '/ird')

  const reset = () => {
    setPhase(1); setNotes(''); setFiles([]); setAnalysis(''); setQuestions([])
    setIrd(''); setIrdId(''); setError('')
  }

  const handleAnalyze = async () => {
    setLoading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      files.forEach(f => formData.append('files', f))
      const res = await authFetch(`${API}/ird/analyze`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(data.analysis)
      setNotes(data.combined_notes || notes)
      const res2 = await authFetch(`${API}/ird/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: data.combined_notes || notes, analysis: data.analysis, answers: [] }),
      })
      if (!res2.ok) throw new Error(await res2.text())
      const data2 = await res2.json()
      setQuestions(data2.questions)
      setPhase(2)
    } catch (e) { setError(`Analysis failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleGenerate = async (answers) => {
    setLoading(true); setError('')
    try {
      const res = await authFetch(`${API}/ird/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, analysis, answers, filename: irdId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setIrd(data.crd); setIrdId(data.crd_id || 'ird'); setPhase(3)
    } catch (e) { setError(`Generation failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleConfirm = (finalIrd) => {
    setIrd(finalIrd); setPhase(4)
    const entry = {
      id: crypto.randomUUID(), irdId,
      internalName: extractInternalName(finalIrd),
      dateGenerated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      ird: finalIrd,
    }
    const updated = [entry, ...irdHistory]
    setIrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); setCurrentHistoryId(entry.id)
  }

  const handleRename = (newName) => {
    const updated = irdHistory.map(e => e.id === currentHistoryId ? { ...e, irdId: newName } : e)
    setIrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteEntry = (id) => {
    const updated = irdHistory.filter(e => e.id !== id)
    setIrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    if (historyModal?.id === id) setHistoryModal(null)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-900">
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
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${phase === p ? 'bg-emerald-600 text-white' : phase > p ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {phase > p ? <CheckCircleIcon className="w-3.5 h-3.5" /> : p}
                    </div>
                    <span className={`text-xs hidden sm:block ${phase === p ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
                    {i < 3 && <div className="w-6 h-px bg-gray-200" />}
                  </div>
                )
              })}
            </div>
            {phase > 1 && <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">Start over</button>}
            <button onClick={() => navigate('/docs')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 hover:border-zinc-400 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Docs
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
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">Recent IRDs</span>
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
              {irdHistory.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 px-4 leading-relaxed">No documents yet.<br />Generated IRDs will appear here.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {irdHistory.map(entry => (
                    <li key={entry.id} className="group relative">
                      <button onClick={() => setHistoryModal(entry)} className="w-full text-left px-4 py-3 pr-9 hover:bg-gray-50 transition-colors">
                        <span className="block text-xs font-mono font-semibold text-emerald-700 truncate">{entry.irdId}</span>
                        <span className="block text-sm font-medium text-gray-800 truncate">{entry.internalName}</span>
                        <span className="block text-xs text-gray-400 mt-0.5">{entry.dateGenerated}</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id) }} className="absolute top-3 right-2 p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all rounded" aria-label="Delete">
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
          style={phase === 1 ? {
            backgroundColor: '#f8f9fb',
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.055) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          } : {}}
        >
          <div className={phase === 1 ? 'flex flex-col items-center justify-center min-h-full py-12 px-6' : 'max-w-3xl mx-auto px-6 py-8'}>
            {phase === 1 && (
              <div className="w-full max-w-3xl">
                {error && <div className="mb-4 p-4 bg-red-900/40 border border-red-500/40 rounded-lg text-red-300 text-sm">{error}</div>}
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab="Internal Requirement" onTabChange={handleTabChange} />
              </div>
            )}
            {phase > 1 && error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            {phase === 2 && <ChatDisplay analysis={analysis} questions={questions} onGenerate={handleGenerate} loading={loading} docLabel="IRD" accent="emerald" />}
            {phase === 3 && <IRDReview ird={ird} onConfirm={handleConfirm} />}
            {phase === 4 && <IRDOutput ird={ird} irdId={irdId} onRename={handleRename} onBack={() => setPhase(3)} />}
          </div>
        </main>
      </div>

      {historyModal && <IRDHistoryModal entry={historyModal} onClose={() => setHistoryModal(null)} />}
    </div>
  )
}
