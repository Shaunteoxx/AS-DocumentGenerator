import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadArea from '../components/UploadArea'
import ChatDisplay from '../components/ChatDisplay'
import IRDReview from '../components/IRDReview'
import IRDOutput from '../components/IRDOutput'
import IRDHistoryModal from '../components/IRDHistoryModal'
import AppHeader, { PhaseStepper, DocsNavButton } from '../components/AppHeader'
import HistorySidebar from '../components/HistorySidebar'
import ErrorBanner from '../components/ErrorBanner'
import { authFetch } from '../utils'
import { API, TAB_ROUTES } from '../constants'
import { useCorridorAuth } from '../hooks/useCorridorAuth'

const HISTORY_KEY = 'ird_history'

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
  const authLoading = useCorridorAuth('/ird')

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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><p className="text-sm text-zinc-500">Signing in…</p></div>

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
      <AppHeader onLogoClick={reset}>
        <PhaseStepper phase={phase} accent="emerald" />
        {phase > 1 && <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-700 underline cursor-pointer">Start over</button>}
        <DocsNavButton />
      </AppHeader>

      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar
          title="Recent IRDs"
          docLabel="IRD"
          accent="emerald"
          entries={irdHistory.map(e => ({ id: e.id, code: e.irdId, name: e.internalName, date: e.dateGenerated }))}
          onSelect={(id) => setHistoryModal(irdHistory.find(e => e.id === id))}
          onDelete={deleteEntry}
        />

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
                <ErrorBanner message={error} className="mb-4" />
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab="Internal Requirement" onTabChange={handleTabChange} />
              </div>
            )}
            {phase > 1 && <ErrorBanner message={error} className="mb-6" />}
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
