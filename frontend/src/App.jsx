import { useState, useEffect } from 'react'
import UploadArea from './components/UploadArea'
import ChatDisplay from './components/ChatDisplay'
import CRDOutput from './components/CRDOutput'
import CRDHistoryModal from './components/CRDHistoryModal'
import AuthCallback from './components/AuthCallback'
import { CheckCircleIcon, HistoryIcon, TrashIcon } from './components/Icons'
import { extractClientName, authFetch } from './utils'
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const HISTORY_KEY = 'crd_history'

const CORRIDOR_BASE = import.meta.env.VITE_CORRIDOR_BASE_URL || 'https://www.corridor.cloud'
const CORRIDOR_CLIENT_ID = import.meta.env.VITE_CORRIDOR_CLIENT_ID || ''
const CORRIDOR_PROJECT_SLUG = import.meta.env.VITE_CORRIDOR_PROJECT_SLUG || 'crd-generator'
const CORRIDOR_REDIRECT_URI = import.meta.env.VITE_CORRIDOR_REDIRECT_URI || `${window.location.origin}/auth/callback`

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

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)

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
  const [historyModalEntry, setHistoryModalEntry] = useState(null)
  const [currentHistoryId, setCurrentHistoryId] = useState(null)

  useEffect(() => {
    if (window.location.pathname === '/auth/callback') return

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

  // Callback route
  if (window.location.pathname === '/auth/callback') {
    return (
      <AuthCallback
        onSuccess={() => {
          setAuthenticated(true)
          setAuthLoading(false)
          window.history.replaceState({}, '', '/')
        }}
        onError={() => setAuthLoading(false)}
      />
    )
  }

  // Auth loading / redirecting to Corridor
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-sm text-gray-500">Signing in…</p>
      </div>
    )
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      files.forEach(f => formData.append('files', f))

      const res = await authFetch(`${API}/analyze`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(data.analysis)
      const combinedNotes = data.combined_notes || notes
      setNotes(combinedNotes)

      const res2 = await authFetch(`${API}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: combinedNotes, analysis: data.analysis, answers: [] }),
      })
      if (!res2.ok) throw new Error(await res2.text())
      const data2 = await res2.json()
      setQuestions(data2.questions)
      setPhase(2)
    } catch (e) {
      setError(`Analysis failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (answers) => {
    setLoading(true)
    setError('')
    try {
      const res = await authFetch(`${API}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, analysis, answers, filename: crdId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const newCrd = data.crd
      const newCrdId = data.crd_id || 'crd'
      setCrd(newCrd)
      setCrdId(newCrdId)
      setPhase(3)

      const entry = {
        id: crypto.randomUUID(),
        crdId: newCrdId,
        clientName: extractClientName(newCrd),
        dateGenerated: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        crd: newCrd,
      }
      const updated = [entry, ...crdHistory]
      setCrdHistory(updated)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
      setCurrentHistoryId(entry.id)
    } catch (e) {
      setError(`Generation failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRename = (newName) => {
    const updated = crdHistory.map(e =>
      e.id === currentHistoryId ? { ...e, crdId: newName } : e
    )
    setCrdHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteHistoryEntry = (id) => {
    const updated = crdHistory.filter(e => e.id !== id)
    setCrdHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    if (historyModalEntry?.id === id) setHistoryModalEntry(null)
  }

  const reset = () => {
    setPhase(1)
    setNotes('')
    setFiles([])
    setAnalysis('')
    setQuestions([])
    setCrd('')
    setCrdId('')
    setError('')
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-main bg-zinc-50/50">
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
              {['Analyze', 'Clarify', 'Generate'].map((label, i) => {
                const p = i + 1
                return (
                  <div key={p} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        phase === p
                          ? 'bg-blue-600 text-white'
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
                    {i < 2 && <div className="w-6 h-px bg-gray-200" />}
                  </div>
                )
              })}
            </div>
            {phase > 1 && (
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Start over
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Recent Documents sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-white flex-shrink-0 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent Documents</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {crdHistory.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8 px-4 leading-relaxed">
                No documents yet.<br />Generated CRDs will appear here.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {crdHistory.map(entry => (
                  <li key={entry.id} className="group relative">
                    <button
                      onClick={() => setHistoryModalEntry(entry)}
                      className="w-full text-left px-4 py-3 pr-9 hover:bg-gray-50 transition-colors"
                    >
                      <span className="block text-xs font-mono font-semibold text-blue-700">{entry.crdId}</span>
                      <span className="block text-sm font-medium text-gray-800 truncate">{entry.clientName}</span>
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
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            {phase === 1 && (
              <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} />
            )}
            {phase === 2 && (
              <ChatDisplay analysis={analysis} questions={questions} onGenerate={handleGenerate} loading={loading} />
            )}
            {phase === 3 && <CRDOutput crd={crd} crdId={crdId} onRename={handleRename} />}
          </div>
        </main>
      </div>

      {historyModalEntry && (
        <CRDHistoryModal
          entry={historyModalEntry}
          onClose={() => setHistoryModalEntry(null)}
        />
      )}
    </div>
  )
}
