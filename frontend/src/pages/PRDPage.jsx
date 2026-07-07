import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UploadArea from '../components/UploadArea'
import ChatDisplay from '../components/ChatDisplay'
import PRDReview from '../components/PRDReview'
import PRDOutput from '../components/PRDOutput'
import PRDHistoryModal from '../components/PRDHistoryModal'
import AppHeader, { PhaseStepper, DocsNavButton } from '../components/AppHeader'
import HistorySidebar from '../components/HistorySidebar'
import ErrorBanner from '../components/ErrorBanner'
import { authFetch } from '../utils'
import { API, TAB_ROUTES } from '../constants'
import { useCorridorAuth } from '../hooks/useCorridorAuth'

const HISTORY_KEY = 'prd_history'

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function extractProductName(md) {
  const match = md.match(/\*\*Product\s*\/\s*Feature(?:\s+Name)?\*\*[:\s]+([^\n*]+)/i)
  if (match) return match[1].trim()
  const heading = md.match(/^#\s+(.+)$/m)
  return heading ? heading[1].trim() : 'Product Requirement'
}

export default function PRDPage() {
  const navigate = useNavigate()
  const authLoading = useCorridorAuth('/prd')

  const [phase, setPhase] = useState(1)
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [questions, setQuestions] = useState([])
  const [prd, setPrd] = useState('')
  const [prdId, setPrdId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prdHistory, setPrdHistory] = useState(loadHistory)
  const [historyModal, setHistoryModal] = useState(null)
  const [currentHistoryId, setCurrentHistoryId] = useState(null)

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><p className="text-sm text-zinc-500">Signing in…</p></div>

  const handleTabChange = (tab) => navigate(TAB_ROUTES[tab] || '/prd')

  const reset = () => {
    setPhase(1); setNotes(''); setFiles([]); setAnalysis(''); setQuestions([])
    setPrd(''); setPrdId(''); setError('')
  }

  const handleAnalyze = async () => {
    setLoading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      files.forEach(f => formData.append('files', f))
      const res = await authFetch(`${API}/prd/analyze`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setAnalysis(data.analysis)
      setNotes(data.combined_notes || notes)
      const res2 = await authFetch(`${API}/prd/clarify`, {
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
      const res = await authFetch(`${API}/prd/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, analysis, answers, filename: prdId }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPrd(data.crd); setPrdId(data.crd_id || 'prd'); setPhase(3)
    } catch (e) { setError(`Generation failed: ${e.message}`) }
    finally { setLoading(false) }
  }

  const handleConfirm = (finalPrd) => {
    setPrd(finalPrd); setPhase(4)
    const entry = {
      id: crypto.randomUUID(), prdId,
      productName: extractProductName(finalPrd),
      dateGenerated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      prd: finalPrd,
    }
    const updated = [entry, ...prdHistory]
    setPrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); setCurrentHistoryId(entry.id)
  }

  const handleRename = (newName) => {
    const updated = prdHistory.map(e => e.id === currentHistoryId ? { ...e, prdId: newName } : e)
    setPrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  const deleteEntry = (id) => {
    const updated = prdHistory.filter(e => e.id !== id)
    setPrdHistory(updated); localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    if (historyModal?.id === id) setHistoryModal(null)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-900">
      <AppHeader onLogoClick={reset}>
        <PhaseStepper phase={phase} accent="orange" />
        {phase > 1 && <button onClick={reset} className="text-xs text-zinc-500 hover:text-zinc-700 underline cursor-pointer">Start over</button>}
        <DocsNavButton />
      </AppHeader>

      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar
          title="Recent PRDs"
          docLabel="PRD"
          accent="orange"
          entries={prdHistory.map(e => ({ id: e.id, code: e.prdId, name: e.productName, date: e.dateGenerated }))}
          onSelect={(id) => setHistoryModal(prdHistory.find(e => e.id === id))}
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
                <UploadArea notes={notes} setNotes={setNotes} files={files} setFiles={setFiles} onAnalyze={handleAnalyze} loading={loading} activeTab="Product Requirement" onTabChange={handleTabChange} />
              </div>
            )}
            {phase > 1 && <ErrorBanner message={error} className="mb-6" />}
            {phase === 2 && <ChatDisplay analysis={analysis} questions={questions} onGenerate={handleGenerate} loading={loading} docLabel="PRD" accent="orange" />}
            {phase === 3 && <PRDReview prd={prd} onConfirm={handleConfirm} />}
            {phase === 4 && <PRDOutput prd={prd} prdId={prdId} onRename={handleRename} onBack={() => setPhase(3)} />}
          </div>
        </main>
      </div>

      {historyModal && <PRDHistoryModal entry={historyModal} onClose={() => setHistoryModal(null)} />}
    </div>
  )
}
