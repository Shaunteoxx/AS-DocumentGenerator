const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getToken() {
  return sessionStorage.getItem('access_token') || ''
}

// Dedupe concurrent refreshes: if several requests 401 at once, they all await
// the same refresh call instead of firing one each.
let refreshInFlight = null

function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const r = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' })
        if (!r.ok) return false
        const data = await r.json()
        if (data.access_token) {
          sessionStorage.setItem('access_token', data.access_token)
          return true
        }
        return false
      } catch {
        return false
      }
    })()
    refreshInFlight.finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

export async function authFetch(url, options = {}) {
  const doFetch = () => {
    const token = getToken()
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }

  let res = await doFetch()
  // Access token likely expired — try a silent refresh (using the long-lived
  // refresh-token cookie) and retry the request once.
  if (res.status === 401 && await refreshAccessToken()) {
    res = await doFetch()
  }
  return res
}

// Strip a wrapping ``` / ```markdown fence the model sometimes adds around the
// whole document. Without this, marked.parse turns the entire doc into one code
// block and the exported Google Doc shows raw markdown (#, **, -) as literal text.
export function stripCodeFences(markdown) {
  const s = (markdown || '').trim()
  if (!s.startsWith('```')) return s
  const lines = s.split('\n')
  lines.shift() // opening fence (``` + optional language tag)
  if (lines.length && lines[lines.length - 1].trim().startsWith('```')) lines.pop()
  return lines.join('\n').trim()
}

export function extractClientName(markdown) {
  const labeled = markdown.match(
    /\*?\*?(?:Client|Company|Account|Customer)(?:\s+Name)?\*?\*?\s*[:\|]\s*\**([^\n\|*]+)\**/i
  )
  if (labeled) return labeled[1].trim()

  const table = markdown.match(
    /\|\s*(?:Client|Company|Account|Customer)(?:\s+Name)?\s*\|\s*([^\|]+)\|/i
  )
  if (table) return table[1].trim()

  const h1 = markdown.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()

  return 'Unknown Client'
}
