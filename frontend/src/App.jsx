import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Route-level code splitting: each page (and its markdown/graph dependencies)
// loads on demand instead of shipping one monolithic bundle.
const CRDPage = lazy(() => import('./pages/CRDPage'))
const BRDPage = lazy(() => import('./pages/BRDPage'))
const IRDPage = lazy(() => import('./pages/IRDPage'))
const PRDPage = lazy(() => import('./pages/PRDPage'))
const GraphPage = lazy(() => import('./pages/GraphPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const DocViewerPage = lazy(() => import('./pages/DocViewerPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <p className="text-sm text-zinc-500">Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/crd" replace />} />
          <Route path="/crd" element={<CRDPage />} />
          <Route path="/brd" element={<BRDPage />} />
          <Route path="/ird" element={<IRDPage />} />
          <Route path="/prd" element={<PRDPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/docs/:docId" element={<DocViewerPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="*" element={<Navigate to="/crd" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
