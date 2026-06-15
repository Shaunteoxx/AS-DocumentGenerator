import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadArea from '../components/UploadArea'
import ChatDisplay from '../components/ChatDisplay'
import CRDReview from '../components/CRDReview'
import CRDOutput from '../components/CRDOutput'
import CRDHistoryModal from '../components/CRDHistoryModal'
import { CheckCircleIcon, HistoryIcon, TrashIcon } from '../components/Icons'
import { extractClientName, authFetch } from '../utils'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../pkce'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const HISTORY_KEY = 'crd_history'

const CORRIDOR_BASE = import.meta.env.VITE_CORRIDOR_BASE_URL || 'https://www.corridor.cloud'
const CORRIDOR_CLIENT_ID = import.meta.env.VITE_CORRIDOR_CLIENT_ID || ''
const CORRIDOR_PROJECT_SLUG = import.meta.env.VITE_CORRIDOR_PROJECT_SLUG || 'crd-generator'
const CORRIDOR_REDIRECT_URI = import.meta.env.VITE_CORRIDOR_REDIRECT_URI || `${window.location.origin}/auth/callback`

const TAB_ROUTES = {
  'Client Requirement': '/crd',
  'Business Requirement': '/brd',
  'Internal Requirement': '/ird',
  'Product Requirement': '/prd',
}

async function redirectToCorridorAuth() {
  sessionStorage.setItem('auth_redirect', '/crd')
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
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

export default function CRDPage() {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [phase, setPhase] = useState(1)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [questions, setQuestions] = useState([])
  const [crd, setCrd] = useState('')
  const [crdId, setCrdId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [crdHistory, setCrdHistory] = useState(loadHistory)
  const [crdHistoryModal, setCrdHistoryModal] = useState(null)
  const [currentCrdHistId, setCurrentCrdHistId] = useState(null)

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
    setCrd(''); setCrdId(''); setError('')
  }

  const handleTabChange = (tab) => navigate(TAB_ROUTES[tab] || '/crd')

  const handleAnalyze = async () => {
    setLoading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      files.forEach(f => formData.append('files', f))
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
    } catch (e) { setError(`Analysis failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleGenerate = async (answers) => {
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

  const handleConfirm = (finalCrd) => {
    setCrd(finalCrd); setPhase(4)
    const entry = {
      id: crypto.randomUUID(), crdId,
      clientName: extractClientName(finalCrd),
      dateGenerated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      crd: finalCrd,
    }
    const updated = [entry, ...crdHistory]
    setCrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); setCurrentCrdHistId(entry.id)
  }

  const handleRename = (newName) => {
    const updated = crdHistory.map(e => e.id === currentCrdHistId ? { ...e, crdId: newName } : e)
    setCrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteEntry = (id) => {
    const updated = crdHistory.filter(e => e.id !== id)
    setCrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    if (crdHistoryModal?.id === id) setCrdHistoryModal(null)
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
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${phase === p ? 'bg-blue-600 text-white' : phase > p ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {phase > p ? <CheckCircleIcon className="w-3.5 h-3.5" /> : p}
                    </div>
                    <span className={`text-xs hidden sm:block ${phase === p ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
                    {i < 3 && <div className="w-6 h-px bg-gray-200" />}
                  </div>
                )
              })}
            </div>
            {phase > 1 && <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">Start over</button>}
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
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">Recent CRDs</span>
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
              {crdHistory.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8 px-4 leading-relaxed">No documents yet.<br />Generated CRDs will appear here.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {crdHistory.map(entry => (
                    <li key={entry.id} className="group relative">
                      <button onClick={() => setCrdHistoryModal(entry)} className="w-full text-left px-4 py-3 pr-9 hover:bg-gray-50 transition-colors">
                        <span className="block text-xs font-mono font-semibold text-blue-700 truncate">{entry.crdId}</span>
                        <span className="block text-sm font-medium text-gray-800 truncate">{entry.clientName}</span>
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
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab="Client Requirement" onTabChange={handleTabChange} />
              </div>
            )}
            {phase > 1 && error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
            {phase === 2 && <ChatDisplay analysis={analysis} questions={questions} onGenerate={handleGenerate} loading={loading} />}
            {phase === 3 && <CRDReview crd={crd} onConfirm={handleConfirm} />}
            {phase === 4 && <CRDOutput crd={crd} crdId={crdId} onRename={handleRename} onBack={() => setPhase(3)} />}
          </div>
        </main>
      </div>

      {crdHistoryModal && <CRDHistoryModal entry={crdHistoryModal} onClose={() => setCrdHistoryModal(null)} />}
    </div>
  )
}
