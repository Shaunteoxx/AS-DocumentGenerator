import { useState, useEffect } from 'react'
import { authFetch } from '../utils'
import { API } from '../constants'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../pkce'

const CORRIDOR_BASE = import.meta.env.VITE_CORRIDOR_BASE_URL || 'https://www.corridor.cloud'
const CORRIDOR_CLIENT_ID = import.meta.env.VITE_CORRIDOR_CLIENT_ID || ''
const CORRIDOR_PROJECT_SLUG = import.meta.env.VITE_CORRIDOR_PROJECT_SLUG || 'crd-generator'
const CORRIDOR_REDIRECT_URI = import.meta.env.VITE_CORRIDOR_REDIRECT_URI || `${window.location.origin}/auth/callback`

export async function redirectToCorridorAuth(redirectPath) {
  sessionStorage.setItem('auth_redirect', redirectPath)
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()
  sessionStorage.setItem('pkce_code_verifier', verifier)
  sessionStorage.setItem('pkce_state', state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CORRIDOR_CLIENT_ID,
    redirect_uri: CORRIDOR_REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    launch_project_slug: CORRIDOR_PROJECT_SLUG,
    scope: 'microapp',
  })
  window.location.href = `${CORRIDOR_BASE}/oauth/authorize?${params}`
}

// Gates a page behind Corridor auth: verifies the session on mount and
// redirects to the OAuth flow if it's missing/expired. When no client ID is
// configured (local dev), the gate is skipped — the backend still enforces auth.
export function useCorridorAuth(redirectPath) {
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!CORRIDOR_CLIENT_ID) { setAuthLoading(false); return }
    authFetch(`${API}/auth/me`)
      .then(r => {
        if (r.ok) {
          setAuthLoading(false)
          const url = new URL(window.location.href)
          if (url.searchParams.has('launch')) {
            url.searchParams.delete('launch')
            url.searchParams.delete('project')
            window.history.replaceState({}, '', url.toString())
          }
        } else {
          redirectToCorridorAuth(redirectPath)
        }
      })
      .catch(() => redirectToCorridorAuth(redirectPath))
  }, [redirectPath])

  return authLoading
}
