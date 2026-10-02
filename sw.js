// LALLA, service worker : application installable et page hors connexion.
// Les données (Supabase, /api, Stripe) ne sont jamais mises en cache.
const VERSION = 'lalla-v1';
const COQUILLE = ['/offline.html', '/assets/style.css', '/assets/config.js', '/assets/i18n.js', '/assets/app.js', '/assets/pages.js', '/assets/compte.js', '/assets/visuels.js', '/assets/icones/icone-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // Pages : réseau d'abord, page hors connexion en secours.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // Ressources statiques : réseau d'abord (versions à jour), cache en secours.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(req, copie)); }
      return r;
    }).catch(() => caches.match(req)));
  }
});
