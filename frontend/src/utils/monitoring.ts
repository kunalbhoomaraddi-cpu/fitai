/** Browser error reports with Sentry. Off unless VITE_SENTRY_DSN is set at build time, and then the
 *  Sentry code is downloaded in the background after the page loads, so it never slows the app down.
 *  Reports carry the error and stack trace only: no user, no typed text, no query strings. */
type Ev = { request?: { url?: string; headers?: unknown; cookies?: unknown; data?: unknown }; user?: unknown; breadcrumbs?: Crumb[] }
type Crumb = { category?: string; message?: string; data?: Record<string, unknown> }

const noQuery = (u: unknown) => (typeof u === 'string' ? u.split('?')[0].split('#')[0] : u)

export function scrubEvent<T extends Ev>(e: T): T {
  if (e.request) { e.request = { url: noQuery(e.request.url) as string | undefined } }
  delete e.user
  return e
}

/** Keep only page changes and API calls (address without the query), drop console output and clicks. */
export function scrubCrumb(c: Crumb): Crumb | null {
  if (c.category === 'navigation') return { category: c.category, data: { from: noQuery(c.data?.from), to: noQuery(c.data?.to) } }
  if (c.category === 'fetch' || c.category === 'xhr') return { category: c.category, data: { method: c.data?.method, url: noQuery(c.data?.url), status_code: c.data?.status_code } }
  return null
}

export function startMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    import('@sentry/browser').then(S => S.init({
      dsn, environment: 'production', sendDefaultPii: false, tracesSampleRate: 0,
      beforeSend: e => scrubEvent(e as Ev) as typeof e,
      beforeBreadcrumb: c => scrubCrumb(c as Crumb) as typeof c,
    })).catch(() => undefined)
  })
}
