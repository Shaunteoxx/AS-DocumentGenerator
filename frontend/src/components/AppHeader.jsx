import { useNavigate } from 'react-router-dom'
import { CheckCircleIcon } from './Icons'
import { LOGO_URL } from '../constants'

const PHASES = ['Analyze', 'Clarify', 'Review', 'Export']

const ACCENT_BG = {
  blue: 'bg-blue-600',
  violet: 'bg-violet-600',
  emerald: 'bg-emerald-600',
  orange: 'bg-orange-500',
}

export function PhaseStepper({ phase, accent = 'blue' }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Workflow progress">
      {PHASES.map((label, i) => {
        const p = i + 1
        const isCurrent = phase === p
        const isDone = phase > p
        return (
          <li key={label} className="flex items-center gap-2" aria-current={isCurrent ? 'step' : undefined}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200 ${
                isCurrent ? `${ACCENT_BG[accent] || ACCENT_BG.blue} text-white`
                : isDone ? 'bg-emerald-500 text-white'
                : 'bg-zinc-100 text-zinc-400'
              }`}
            >
              {isDone ? <CheckCircleIcon className="w-3.5 h-3.5" /> : p}
            </div>
            <span className={`text-xs hidden sm:block ${isCurrent ? 'text-zinc-900 font-semibold' : isDone ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {label}
            </span>
            {i < PHASES.length - 1 && (
              <div className={`w-6 h-px ${isDone ? 'bg-emerald-300' : 'bg-zinc-200'}`} aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function DocsNavButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/docs')}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-300 rounded-lg hover:bg-zinc-50 hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 transition-colors duration-150 cursor-pointer"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Docs
    </button>
  )
}

export default function AppHeader({ subtitle = 'AI Assisted Generator', onLogoClick, children }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200">
      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-3 text-left rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
        >
          <div className="bg-white p-1.5 rounded-lg border border-zinc-100 shadow-sm overflow-hidden flex items-center justify-center">
            <img src={LOGO_URL} alt="Allocate Space logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-zinc-900">Allocate Space</span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">{subtitle}</span>
          </div>
        </button>
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </header>
  )
}
