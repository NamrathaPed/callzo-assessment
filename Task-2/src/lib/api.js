const API_BASE = import.meta.env.VITE_API_URL || '/api'

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.status = status
    this.body = body
    this.name = 'ApiError'
  }
}

async function request(path, opts = {}) {
  const url = `${API_BASE}${path}`
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...opts, headers, signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.status === 422 || res.status === 400) {
        const body = await res.json().catch(() => ({}))
        throw new ApiError(body.detail || res.statusText, res.status, body)
      }

      if (!res.ok) {
        if (res.status === 500 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
          continue
        }
        const body = await res.json().catch(() => ({}))
        throw new ApiError(body.detail || res.statusText || 'Request failed', res.status, body)
      }

      return await res.json().catch(() => ({}))
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof ApiError) throw err
      lastErr = err
      if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  throw lastErr || new ApiError('Request failed', 0, {})
}

export function getAccounts(params) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  return request(`/accounts?${qs.toString()}`)
}

export function getAccount(id) {
  return request(`/accounts/${encodeURIComponent(id)}`)
}

export function getSummary(params) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  return request(`/accounts/summary?${qs.toString()}`)
}

export function getSettings(id) {
  return request(`/accounts/${encodeURIComponent(id)}/settings`)
}

export function saveStep(id, step, data) {
  return request(`/accounts/${encodeURIComponent(id)}/settings/step/${step}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  })
}

export function submitSettings(id) {
  return request(`/accounts/${encodeURIComponent(id)}/settings/submit`, {
    method: 'POST',
  })
}

export function health() {
  return request('/health')
}
