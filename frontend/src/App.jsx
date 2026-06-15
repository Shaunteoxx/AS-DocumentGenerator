import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CRDPage from './pages/CRDPage'
import BRDPage from './pages/BRDPage'
import IRDPage from './pages/IRDPage'
import PRDPage from './pages/PRDPage'
import GraphPage from './pages/GraphPage'
import AuthCallbackPage from './pages/AuthCallbackPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/crd" replace />} />
        <Route path="/crd" element={<CRDPage />} />
        <Route path="/brd" element={<BRDPage />} />
        <Route path="/ird" element={<IRDPage />} />
        <Route path="/prd" element={<PRDPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<Navigate to="/crd" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
