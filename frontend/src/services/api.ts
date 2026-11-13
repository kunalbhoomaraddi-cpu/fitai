/** Thin API client. All requests go to /api (proxied to FastAPI in dev). No API keys ever live here. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api'
const TOKEN_KEY = 'fitai.token'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* noop */ } },
}

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

/** The browser's IANA time zone (e.g. "Asia/Kolkata"), so "today" on the server matches the user's clock. */
function userTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined } catch { return undefined }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const tz = userTimeZone()
  if (tz) headers['X-Timezone'] = tz
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) })
  } catch {
    throw new ApiError(import.meta.env.DEV
      ? 'Cannot reach the FitAI server. Is the backend running on port 8000?'
      : 'FitAI is waking up after a quiet spell. Please try again in about a minute.', 0)
  }
  if (res.status === 204) return undefined as T
  let data: any = null
  try { data = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized()
    const msg = typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`
    throw new ApiError(msg, res.status)
  }
  return data as T
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  put: <T>(p: string, b?: unknown) => request<T>('PUT', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b ?? {}),
  del: <T>(p: string) => request<T>('DELETE', p),
  upload: <T>(p: string, form: FormData) => request<T>('POST', p, form),
}

/** Fetch a private binary (e.g. a progress photo) with the login token and return an object URL. */
export async function fetchBlobUrl(path: string): Promise<string> {
  const token = tokenStore.get()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const tz = userTimeZone()
  if (tz) headers['X-Timezone'] = tz
  const res = await fetch(`${BASE}${path}`, { headers })
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized()
    throw new ApiError(`Could not load image (${res.status})`, res.status)
  }
  return URL.createObjectURL(await res.blob())
}
