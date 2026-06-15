import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authFetch } from '../utils'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TYPE = {
  crd: { label: 'CRD', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-50 text-blue-700 border-blue-100', stroke: '#93c5fd' },
  ird: { label: 'IRD', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', stroke: '#6ee7b7' },
  brd: { label: 'BRD', bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-50 text-violet-700 border-violet-100', stroke: '#c4b5fd' },
  prd: { label: 'PRD', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-50 text-orange-700 border-orange-100', stroke: '#fdba74' },
}

function NodeCard({ node, highlighted, dimmed, onHover, cardRef }) {
  const cfg = TYPE[node.type] || TYPE.crd
  return (
    <div
      ref={cardRef}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => node.drive_link && window.open(node.drive_link, '_blank')}
      className={`
        px-3 py-3 rounded-xl border cursor-pointer select-none transition-all duration-150 min-h-[52px]
        ${cfg.bg} ${cfg.border}
        ${dimmed ? 'opacity-25' : 'opacity-100'}
        ${highlighted ? 'shadow-md ring-2 ring-offset-1 ring-gray-300' : 'hover:shadow-sm'}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
        <span className="text-xs font-semibold text-gray-800 truncate">{node.title}</span>
      </div>
      {node.docs_id && node.docs_id !== node.title && (
        <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5 pl-[38px]">{node.docs_id}</p>
      )}
      {node.modified && (
        <p className="text-[10px] text-gray-400 mt-0.5 pl-[38px]">{node.modified}</p>
      )}
    </div>
  )
}

function Column({ title, nodes, highlighted, dimmed, onHover, refs }) {
  if (nodes.length === 0) return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      <p className="text-xs text-gray-400 italic">No documents</p>
    </div>
  )
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</p>
      <div className="flex flex-col gap-4">
        {nodes.map(n => (
          <NodeCard
            key={n.id}
            node={n}
            highlighted={highlighted.has(n.id)}
            dimmed={dimmed.size > 0 && !highlighted.has(n.id)}
            onHover={onHover}
            cardRef={el => { refs.current[n.id] = el }}
          />
        ))}
      </div>
    </div>
  )
}

export default function GraphPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hoveredId, setHoveredId] = useState(null)
  const [lines, setLines] = useState([])

  const containerRef = useRef(null)
  const cardRefs = useRef({})

  const fetchGraph = useCallback(async (bust = false) => {
    setLoading(true); setError('')
    try {
      const url = bust ? `${API}/graph?refresh=true` : `${API}/graph`
      const r = await authFetch(url)
      if (!r.ok) throw new Error(await r.text())
      setData(await r.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchGraph() }, [fetchGraph])

  const recalcLines = useCallback(() => {
    if (!containerRef.current || !data) return
    const box = containerRef.current.getBoundingClientRect()
    const newLines = data.edges.map(edge => {
      const srcEl = cardRefs.current[edge.source]
      const tgtEl = cardRefs.current[edge.target]
      if (!srcEl || !tgtEl) return null
      const sr = srcEl.getBoundingClientRect()
      const tr = tgtEl.getBoundingClientRect()
      const x1 = sr.right - box.left
      const y1 = sr.top + sr.height / 2 - box.top
      const x2 = tr.left - box.left
      const y2 = tr.top + tr.height / 2 - box.top
      const cx = (x2 - x1) * 0.45
      return {
        id: `${edge.source}-${edge.target}`,
        d: `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`,
        source: edge.source,
        target: edge.target,
        method: edge.method,
        stroke: TYPE[data.nodes.find(n => n.id === edge.source)?.type]?.stroke || '#d1d5db',
      }
    }).filter(Boolean)
    setLines(newLines)
  }, [data])

  useEffect(() => {
    if (!data) return
    const timer = setTimeout(recalcLines, 50)
    const ro = new ResizeObserver(recalcLines)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => { clearTimeout(timer); ro.disconnect() }
  }, [data, recalcLines])

  const getHighlighted = useCallback((id) => {
    if (!id || !data) return new Set()
    const connected = new Set([id])
    data.edges.forEach(e => {
      if (e.source === id) connected.add(e.target)
      if (e.target === id) connected.add(e.source)
    })
    return connected
  }, [data])

  const highlighted = getHighlighted(hoveredId)
  const dimmed = hoveredId ? new Set(data?.nodes.map(n => n.id).filter(id => !highlighted.has(id))) : new Set()

  const activeLines = hoveredId
    ? lines.filter(l => l.source === hoveredId || l.target === hoveredId)
    : lines

  const crds = data?.nodes.filter(n => n.type === 'crd') || []
  const irds = data?.nodes.filter(n => n.type === 'ird') || []
  const brds = data?.nodes.filter(n => n.type === 'brd') || []
  const prds = data?.nodes.filter(n => n.type === 'prd') || []

  const explicitCount = data?.edges.filter(e => e.method === 'explicit').length || 0
  const inferredCount = data?.edges.filter(e => e.method === 'inferred').length || 0

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-900 bg-zinc-50">
      <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/crd')}>
            <div className="bg-white p-1.5 rounded-lg border border-zinc-100 shadow-sm overflow-hidden flex items-center justify-center">
              <img src="https://firebasestorage.googleapis.com/v0/b/sg-as-price-list.firebasestorage.app/o/Screenshot%202026-02-04%20021131.png?alt=media" alt="Allocate Space Logo" className="h-8 w-auto object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-zinc-900">Allocate Space</span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Document Graph</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {data && (
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{data.nodes.length} documents</span>
                <span>·</span>
                <span className="text-blue-600 font-medium">{explicitCount} explicit</span>
                <span>·</span>
                <span className="text-violet-500 font-medium">{inferredCount} inferred</span>
                {data.cached && <span className="text-amber-500">· cached</span>}
              </div>
            )}
            <button
              onClick={() => fetchGraph(true)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button onClick={() => navigate('/crd')} className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg className="animate-spin w-6 h-6 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-sm text-gray-400">Fetching documents from Drive…</p>
            </div>
          </div>
        )}

        {data && (
          <>
            <div className="mb-4 flex items-center gap-4 text-xs text-gray-400">
              <span>Hover a card to highlight its connections · Click to open in Drive</span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-px bg-blue-300 inline-block" />
                explicit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t border-dashed border-violet-400 inline-block" />
                inferred
              </span>
            </div>

            <div ref={containerRef} className="relative">
              {/* SVG overlay for connection lines */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ zIndex: 0 }}
              >
                {lines.map(l => {
                  const isActive = hoveredId ? (l.source === hoveredId || l.target === hoveredId) : true
                  return (
                    <path
                      key={l.id}
                      d={l.d}
                      fill="none"
                      stroke={l.stroke}
                      strokeWidth={isActive ? 2.5 : 1.5}
                      strokeDasharray={l.method === 'inferred' ? '6,4' : undefined}
                      opacity={hoveredId ? (isActive ? 1 : 0.08) : 0.6}
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>

              {/* 3-column layout */}
              <div className="relative flex gap-32" style={{ zIndex: 1 }}>
                {/* Left: CRD + IRD */}
                <div className="flex-1 min-w-0 flex flex-col gap-10">
                  {crds.length > 0 && (
                    <Column
                      title="Client Requirement Docs"
                      nodes={crds}
                      highlighted={highlighted}
                      dimmed={dimmed}
                      onHover={setHoveredId}
                      refs={cardRefs}
                    />
                  )}
                  {irds.length > 0 && (
                    <Column
                      title="Internal Requirement Docs"
                      nodes={irds}
                      highlighted={highlighted}
                      dimmed={dimmed}
                      onHover={setHoveredId}
                      refs={cardRefs}
                    />
                  )}
                  {crds.length === 0 && irds.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No CRD or IRD documents</p>
                  )}
                </div>

                {/* Middle: BRD */}
                <Column
                  title="Business Requirement Docs"
                  nodes={brds}
                  highlighted={highlighted}
                  dimmed={dimmed}
                  onHover={setHoveredId}
                  refs={cardRefs}
                />

                {/* Right: PRD */}
                <Column
                  title="Product Requirement Docs"
                  nodes={prds}
                  highlighted={highlighted}
                  dimmed={dimmed}
                  onHover={setHoveredId}
                  refs={cardRefs}
                />
              </div>
            </div>

            {data.nodes.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm">
                No documents found in your Drive folders. Generate and export documents first.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
