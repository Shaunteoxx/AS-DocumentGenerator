import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadArea from '../components/UploadArea'
import ChatDisplay from '../components/ChatDisplay'
import CRDReview from '../components/CRDReview'
import CRDOutput from '../components/CRDOutput'
import CRDHistoryModal from '../components/CRDHistoryModal'
import AppHeader, { PhaseStepper, DocsNavButton } from '../components/AppHeader'
import HistorySidebar from '../components/HistorySidebar'
import ErrorBanner from '../components/ErrorBanner'
import { extractClientName, authFetch } from '../utils'
import { API, TAB_ROUTES } from '../constants'
import { useCorridorAuth } from '../hooks/useCorridorAuth'

const HISTORY_KEY = 'crd_history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

export default function CRDPage() {
  const navigate = useNavigate()
  const authLoading = useCorridorAuth('/crd')

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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><p className="text-sm text-zinc-500">Signing in…</p></div>

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
      <AppHeader onLogoClick={reset}>
        <PhaseStepper phase={phase} accent="blue" />
        {phase > 1 && <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-700 underline cursor-pointer">Start over</button>}
        <DocsNavButton />
      </AppHeader>

      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar
          title="Recent CRDs"
          docLabel="CRD"
          accent="blue"
          entries={crdHistory.map(e => ({ id: e.id, code: e.crdId, name: e.clientName, date: e.dateGenerated }))}
          onSelect={(id) => setCrdHistoryModal(crdHistory.find(e => e.id === id))}
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
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab="Client Requirement" onTabChange={handleTabChange} />
              </div>
            )}
            {phase > 1 && <ErrorBanner message={error} className="mb-6" />}
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
