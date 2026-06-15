import { useState } from 'react'
import { SendIcon } from './Icons'

export default function ChatDisplay({ analysis, questions, onGenerate, loading, docLabel = 'CRD' }) {
  const [answers, setAnswers] = useState(Array(questions.length).fill(''))
  const [showAnalysis, setShowAnalysis] = useState(false)

  const allAnswered = answers.every((a) => a.trim().length > 0)

  const handleSubmit = () => {
    const finalAnswers = questions.map((q, i) => ({ question: q, answer: answers[i] }))
    onGenerate(finalAnswers)
  }

  const setAnswer = (i, val) => {
    const updated = [...answers]
    updated[i] = val
    setAnswers(updated)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Phase 2 — Clarifying Questions</h2>
        <p className="text-sm text-gray-500">
          Answer each question to give the AI the context it needs to generate your {docLabel}.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span>Analysis Summary</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${showAnalysis ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        {showAnalysis && (
          <div className="px-4 py-4 border-t border-gray-100 text-sm text-gray-600 bg-gray-50 whitespace-pre-wrap leading-relaxed">
            {analysis}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-medium text-gray-800">{q}</p>
                <textarea
                  value={answers[i]}
                  onChange={(e) => setAnswer(i, e.target.value)}
                  rows={3}
                  placeholder="Your answer..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>{answers.filter((a) => a.trim()).length} of {questions.length} answered</span>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || loading}
        className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Generating {docLabel}...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <SendIcon className="w-4 h-4" />
            Generate {docLabel}
          </span>
        )}
      </button>
    </div>
  )
}
