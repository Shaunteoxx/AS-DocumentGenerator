export function getToken() {
  return sessionStorage.getItem('access_token') || ''
}

export function authFetch(url, options = {}) {
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
