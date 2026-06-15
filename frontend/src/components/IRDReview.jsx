import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { SparklesIcon, CheckCircleIcon } from './Icons'
import { authFetch } from '../utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function parseSections(markdown) {
  const parts = markdown.split(/(?=\n## )/)
  return parts.map((part, idx) => {
    const trimmed = part.trim()
    if (!trimmed) return null
    const firstLine = trimmed.split('\n')[0]
    const headingMatch = firstLine.match(/^#{1,3}\s+(.+)/)
    return {
      heading: headingMatch ? headingMatch[1] : (idx === 0 ? 'Document Overview' : 'Section'),
      content: trimmed,
    }
  }).filter(Boolean)
}

export default function IRDReview({ ird, onConfirm }) {
  const [fullIrd, setFullIrd] = useState(ird)
  const [sectionStates, setSectionStates] = useState({})

  const sections = parseSections(fullIrd)

  const getState = (key) => sectionStates[key] || { instruction: '', regenerating: false, error: '', open: false }

  const updateState = (key, updates) => {
    setSectionStates(prev => ({
      ...prev,
      [key]: { ...getState(key), ...updates },
    }))
  }

  const handleRegenerate = async (heading) => {
    const state = getState(heading)
    updateState(heading, { regenerating: true, error: '' })
    try {
      const res = await authFetch(`${API}/ird/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crd: fullIrd, section: heading, instruction: state.instruction }),
      })
      if (!res.ok) throw new Error(`Regeneration failed (${res.status})`)
      const data = await res.json()
      setFullIrd(data.crd)
      updateState(heading, { instruction: '', open: false, error: '', regenerating: false })
    } catch (e) {
      updateState(heading, { error: e.message, regenerating: false })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Phase 3 — Review &amp; Refine</h2>
          <p className="text-sm text-gray-500">
            Review each section. Click "Suggest Changes" to give feedback and regenerate individual sections.
            When you're satisfied, confirm to proceed to export.
          </p>
        </div>
        <button
          onClick={() => onConfirm(fullIrd)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-sm flex-shrink-0"
        >
          <CheckCircleIcon className="w-4 h-4" />
          Confirm All Changes
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const state = getState(section.heading)
          return (
            <div key={section.heading} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{section.heading}</span>
                <button
                  onClick={() => updateState(section.heading, { open: !state.open, error: '' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  {state.open ? 'Close' : 'Suggest Changes'}
                </button>
              </div>

              <div className="px-6 py-5">
                <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-table:text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
              </div>

              {state.open && (
                <div className="px-6 pb-5 pt-3 bg-emerald-50/60 border-t border-emerald-100 space-y-3">
                  <label className="block text-xs font-semibold text-emerald-900">
                    What changes would you like to this section?
                  </label>
                  <textarea
                    value={state.instruction}
                    onChange={(e) => updateState(section.heading, { instruction: e.target.value })}
                    placeholder="e.g. Add more detail to the business requirements, clarify the trigger event…"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-gray-400 resize-none"
                  />
                  {state.error && <p className="text-xs text-red-600">{state.error}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => updateState(section.heading, { open: false, instruction: '', error: '' })}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRegenerate(section.heading)}
                      disabled={state.regenerating}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <SparklesIcon className="w-3.5 h-3.5" />
                      {state.regenerating ? 'Regenerating…' : 'Regenerate Section'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end pt-2 border-t border-gray-200">
        <button
          onClick={() => onConfirm(fullIrd)}
          className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-sm"
        >
          <CheckCircleIcon className="w-4 h-4" />
          Confirm All Changes
        </button>
      </div>
    </div>
  )
}
