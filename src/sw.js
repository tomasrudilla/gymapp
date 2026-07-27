import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('push', (event) => {
  let payload = { title: 'GYM', body: 'Tenés una nueva alerta' }
  try {
    payload = event.data?.json() ?? payload
  } catch {
    payload.body = event.data?.text() || payload.body
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'GYM', {
      body: payload.body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'gym-alert',
      data: { url: payload.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow(target)
    })
  )
})
