import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { authFetch } from '../utils'
import { API } from '../constants'

const TYPE_CONFIG = {
  crd: {
    label: 'CRD',
    badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
    count_bg: 'bg-blue-50 text-blue-700',
  },
  brd: {
    label: 'BRD',
    badge: 'bg-violet-50 text-violet-700 ring-1 ring-violet-100',
    border: 'border-l-violet-500',
    dot: 'bg-violet-500',
    count_bg: 'bg-violet-50 text-violet-700',
  },
  ird: {
    label: 'IRD',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    border: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
    count_bg: 'bg-emerald-50 text-emerald-700',
  },
}

function DocIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function ArrowRightIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  )
}

function ExternalLinkIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function CardSkeleton() {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 border-l-4 border-l-zinc-200 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-10 bg-zinc-100 rounded-md" />
        <div className="h-4 w-16 bg-zinc-100 rounded" />
      </div>
      <div className="h-4 bg-zinc-100 rounded mb-2 w-full" />
      <div className="h-4 bg-zinc-100 rounded mb-5 w-3/4" />
      <div className="h-3 bg-zinc-100 rounded w-1/3" />
    </div>
  )
}

export default function DocsPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    authFetch(`${API}/documents`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => setDocs(data.documents || []))
      .catch(e => setError(`Failed to load documents: ${e}`))
      .finally(() => setLoading(false))
  }, [])

  const counts = { crd: 0, brd: 0, ird: 0 }
  docs.forEach(d => { if (counts[d.type] !== undefined) counts[d.type]++ })

  const visible = docs.filter(d => {
    if (filter !== 'All' && d.type !== filter.toLowerCase()) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filterTabs = [
    { key: 'All', label: 'All', count: docs.length },
    { key: 'CRD', label: 'CRD', count: counts.crd },
    { key: 'BRD', label: 'BRD', count: counts.brd },
    { key: 'IRD', label: 'IRD', count: counts.ird },
  ]

  return (
    <div className="min-h-screen flex flex-col font-sans bg-zinc-50 text-zinc-900">
      <AppHeader subtitle="Document Library" onLogoClick={() => navigate('/crd')}>
        <button
          onClick={() => navigate('/crd')}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 transition-colors duration-150 cursor-pointer"
        >
          ← Generator
        </button>
      </AppHeader>

      {/* Page hero */}
      <div className="bg-white border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DocIcon className="w-5 h-5 text-indigo-600" />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Document Library</span>
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 mb-1">All Documents</h1>
              <p className="text-sm text-zinc-500 max-w-lg">
                Browse generated documents. Click any card to review sections and leave AI-powered feedback.
              </p>
            </div>
            {!loading && docs.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {Object.entries(counts).filter(([, n]) => n > 0).map(([type, n]) => {
                  const cfg = TYPE_CONFIG[type]
                  return (
                    <span key={type} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.count_bg}`}>
                      {n} {cfg.label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-7">
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 self-start">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 cursor-pointer ${
                  filter === tab.key
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {tab.label}
                {!loading && (
                  <span className={`text-[10px] font-bold tabular-nums ${filter === tab.key ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-zinc-400 transition-all"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-4">
              <DocIcon className="w-6 h-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-600 mb-1">No documents found</p>
            <p className="text-xs text-zinc-400">
              {search ? `No results for "${search}"` : 'Generate a document to see it here.'}
            </p>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && visible.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(doc => {
              const cfg = TYPE_CONFIG[doc.type] || TYPE_CONFIG.crd
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/docs/${doc.id}?type=${doc.type}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/docs/${doc.id}?type=${doc.type}`) } }}
                  className={`group bg-white border border-zinc-200 border-l-4 ${cfg.border} rounded-xl p-5 cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-all duration-200`}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {doc.modified && (
                      <span className="text-[10px] text-zinc-400 tabular-nums">{doc.modified}</span>
                    )}
                  </div>

                  {/* Doc name */}
                  <p className="text-sm font-semibold text-zinc-800 leading-snug mb-4 line-clamp-2 group-hover:text-indigo-700 transition-colors duration-150">
                    {doc.name}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      Review & edit
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </span>
                    <a
                      href={doc.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors"
                    >
                      Drive
                      <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
