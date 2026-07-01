/* CASE OS — service worker: офлайн-режим (network-first для приложения, cache-first для статики) */
const CACHE = 'case-os-v22';
const ASSETS = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Бэкенд (вход, данные): НИКОГДА не кэшируем — всегда напрямую в сеть.
  if (url.origin === location.origin && url.pathname.indexOf('/api/') >= 0) return;

  // Навигация (открытие приложения): сначала сеть, офлайн — из кэша.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Прочие GET (шрифты, библиотеки): сначала кэш, затем сеть.
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      try {
        if (resp && resp.status === 200 &&
            (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.host))) {
          const cp = resp.clone();
          caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
        }
      } catch (_) {}
      return resp;
    }).catch(() => cached))
  );
});
