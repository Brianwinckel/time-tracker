// ============================================================
// Service Worker — offline shell + push notifications
// ------------------------------------------------------------
// Bump CACHE_NAME every time we ship a meaningful UX change. The
// change triggers the `activate` handler below, which deletes the
// old cache; combined with the client-side `controllerchange`
// listener in index.html, the next page load will be clean.
// ============================================================

const CACHE_NAME = 'timetracker-v3';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first for API, cache first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ---- Client → SW messages ----
//
// When a new service worker installs, it sits in the "waiting" state
// until the old one is freed. `SKIP_WAITING` tells the new SW to take
// over immediately, after which the page's `controllerchange` listener
// reloads the tab with the fresh bundle. This is the plumbing behind
// the Settings → "Refresh app" button and the auto-update flow in
// index.html.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ---- Push Notifications ----

self.addEventListener('push', (event) => {
  let data = { title: 'TimeTracker', body: 'Notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: [],
    tag: data.data?.tag || 'timetracker-notification',
    renotify: true,
  };

  // Add actions based on notification type
  if (data.data?.type === 'idle-warning') {
    options.actions = [
      { action: 'switch', title: 'Switch Task' },
      { action: 'dismiss', title: 'Dismiss' },
    ];
  } else if (data.data?.type === 'email-preview') {
    options.actions = [
      { action: 'open', title: 'Review' },
      { action: 'dismiss', title: 'OK' },
    ];
  }

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open or focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow('/');
    })
  );
});
