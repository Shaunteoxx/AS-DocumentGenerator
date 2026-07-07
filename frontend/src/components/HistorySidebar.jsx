import { useState } from 'react'
import { HistoryIcon, TrashIcon } from './Icons'

const ACCENT_TEXT = {
  blue: 'text-blue-700',
  violet: 'text-violet-700',
  emerald: 'text-emerald-700',
  orange: 'text-orange-700',
}

// Collapsible "Recent documents" sidebar shared by all generator pages.
// entries: [{ id, code, name, date }]
export default function HistorySidebar({ title, docLabel, accent = 'blue', entries, onSelect, onDelete }) {
  const [open, setOpen] = useState(true)
  const codeColor = ACCENT_TEXT[accent] || ACCENT_TEXT.blue

  return (
    <aside className={`${open ? 'w-64' : 'w-10'} border-r border-zinc-200 bg-white flex-shrink-0 flex flex-col overflow-hidden transition-all duration-200`}>
      <div className="px-2 py-3 border-b border-zinc-100 flex items-center justify-between gap-2 min-w-0">
        {open && (
          <div className="flex items-center gap-2 min-w-0">
            <HistoryIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide truncate">{title}</span>
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          className="p-1 text-zinc-400 hover:text-zinc-600 rounded transition-colors duration-150 flex-shrink-0 ml-auto cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={open}
        >
          <svg className={`w-4 h-4 transition-transform duration-200 ${open ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-8 px-4 leading-relaxed">
              No documents yet.<br />Generated {docLabel}s will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {entries.map(entry => (
                <li key={entry.id} className="group relative">
                  <button
                    onClick={() => onSelect(entry.id)}
                    className="w-full text-left px-4 py-3 pr-9 hover:bg-zinc-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:bg-zinc-50"
                  >
                    <span className={`block text-xs font-mono font-semibold ${codeColor} truncate`}>{entry.code}</span>
                    <span className="block text-sm font-medium text-zinc-800 truncate">{entry.name}</span>
                    <span className="block text-xs text-zinc-400 mt-0.5">{entry.date}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
                    className="absolute top-3 right-2 p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-zinc-400 hover:text-red-500 transition-all duration-150 rounded cursor-pointer"
                    aria-label={`Delete ${entry.code}`}
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  )
}
