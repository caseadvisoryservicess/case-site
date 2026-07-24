// CASE OS v4.41.1 service worker
const CACHE = 'case-os-v4411';
const ASSETS = ['./', './index.html', './v32-upgrade.js', './v326-commission-engines.js', './v35-stable.js', './v3515-ux.js', './jszip.min.js', './v3518-brands-import.js', './v3520-workspaces.js', './v400-feasibility.js', './feasibility-studio.html', './v420-geoanalytics.js', './v420-geo-studio.js', './geoanalytics-studio.html', './v440-engineering.js', './v450-guides.js', './v490-caseos.js', './v490-workflow.js', './v492-portfolio-proposals.js', './v493-portfolio-suite.js', './leaflet.case.js', './leaflet.case.css', './data/case_portfolio_projects_v4.9.3.json', './data/case_portfolio_projects_v4.9.3.csv', './data/case_portfolio.geojson', './data/case_portfolio.seed.js', './mep-studio.html', './lift-studio.html', './leaflet.markercluster.js', './data/mep_norms.json', './data/bundle_tashkent_realdata.json', './data/mahallas_tashkent.json', './data/case_brands_base.xlsx', './v496-commissions.js', './v410-feature-flags.js', './v417-master-plan.js', './v432-data-grid.js', './v4327-patch.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).catch(() => null));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return;
  // Оффлайн-заглушку (index.html) возвращаем ТОЛЬКО для навигации (открыли/перезагрузили
  // страницу) — иначе неудавшийся запрос скрипта/JSON/картинки без своей копии в кэше получал
  // тело index.html с кодом 200, что ломало парсинг на стороне вызывающего кода без понятной
  // причины (независимый аудит, P2-08). Для остальных типов запросов без сети и без кэша —
  // настоящая ошибка, а не подмена контента.
  const isNavigation = req.mode === 'navigate' || req.destination === 'document';
  event.respondWith(fetch(req, {cache:'no-store'}).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => null);
    return res;
  }).catch(() => caches.match(req).then(r => {
    if (r) return r;
    if (isNavigation) return caches.match('./index.html');
    return new Response('', {status: 504, statusText: 'Offline and not cached'});
  })));
});
