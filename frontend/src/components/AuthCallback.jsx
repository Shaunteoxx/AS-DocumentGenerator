import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function AuthCallback({ onSuccess, onError }) {
  const [status, setStatus] = useState('Completing sign-in…')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error) {
      setStatus(`Sign-in failed: ${error}`)
      onError?.(error)
      return
    }

    const storedState = sessionStorage.getItem('pkce_state')
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier')

    if (!code || !codeVerifier) {
      setStatus('Invalid callback — missing code or verifier.')
      onError?.('missing_code_or_verifier')
      return
    }

    if (state !== storedState) {
      setStatus('Sign-in failed: state mismatch.')
      onError?.('state_mismatch')
      return
    }

    sessionStorage.removeItem('pkce_state')
    sessionStorage.removeItem('pkce_code_verifier')

    fetch(`${API}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, code_verifier: codeVerifier }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Token exchange failed')
        return r.json()
      })
      .then(data => {
        if (data.access_token) {
          sessionStorage.setItem('access_token', data.access_token)
        }
        onSuccess?.()
      })
      .catch(e => {
        setStatus(`Sign-in failed: ${e.message}`)
        onError?.(e.message)
      })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <p className="text-sm text-gray-500">{status}</p>
    </div>
  )
}
