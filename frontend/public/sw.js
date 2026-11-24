/* FitAI service worker: makes the app installable and lets it open without a connection.
   It caches only the app itself (pages, scripts, fonts, pictures), never personal data:
   the API lives on another domain and is always fetched live. Bump VERSION to clear old caches. */
const VERSION = 'fitai-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Pages: always try the network first so users get the latest version; offline, show the cached app.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/index.html', copy)); return res })
        .catch(() => caches.match('/index.html')),
    )
    return
  }
  // Build files have a content hash in their name, so a cached copy never goes stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)) }
      return res
    })))
    return
  }
  // Pictures and icons: show the cached copy at once, refresh it in the background.
  if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req)
      const fresh = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res }).catch(() => hit)
      return hit || fresh
    }))
  }
})
