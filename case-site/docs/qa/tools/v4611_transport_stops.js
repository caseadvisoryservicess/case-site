/* Клик по остановке показывает номера маршрутов; отказ прокси называет причину.
   Каждый случай - своя загрузка страницы: слой кэшируется в замыкании модуля и
   очистить его снаружи нельзя, а подменять внутренности модуля из теста нечестно. */
const { chromium } = require('playwright-core');
const path = require('path');
const { createMockServer } = require('./mock_backend.js');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };

const REPLY = {
  fail: { status: 400, type: 'application/json', body: JSON.stringify({ error: 'Unknown category' }) },
  html: { status: 500, type: 'text/html', body: '<html>500 Internal Server Error</html>' },
  ok:   { status: 200, type: 'application/json', body: JSON.stringify({ ok: true, count: 1, total: 1,
          withRoutes: 1, routesFound: 3, rows: [{ name: 'Автобусная остановка - ул. Амира Темура',
          lat: 41.3111, lng: 69.2797, subtype: 'bus_stop', hubType: 'Автобусная остановка',
          routes: 'автобус: 2, 9, 10 · маршрутка: 5', routesCount: 4, address: 'ул. Амира Темура',
          district: '', provider: 'OSM', _verification: 'online' }] }) }
};

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base } = await createMockServer(OS, { initialState: {} });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    args: ['--no-sandbox', '--no-proxy-server'] });
  async function run(mode) {
    const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [], alerts = [];
    pg.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    pg.on('dialog', d => { alerts.push(d.message()); d.accept(); });
    const r = REPLY[mode];
    /* Общий перехват регистрируем ПЕРВЫМ. Playwright пробует обработчики в обратном
       порядке добавления: если добавить общий последним, он перехватит и запрос к прокси
       и отдаст его настоящему mock-серверу - подмена ответа молча не сработает. */
    await pg.route('**/*', rt => {
      const u = rt.request().url();
      return (u.startsWith(base) || /^(data|blob):/.test(u)) ? rt.continue() : rt.abort();
    });
    await pg.route('**/api/gis_proxy.php**', rt => rt.fulfill({ status: r.status, contentType: r.type, body: r.body }));
    await pg.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(6000);
    await pg.check('#geoLayer-transport_hubs');
    await pg.waitForTimeout(2000);
    return { pg, errs, alerts };
  }

  /* 1. отказ в форме fail(): {"error": ...} - раньше причина выбрасывалась */
  let r = await run('fail');
  ck('отказ прокси объяснён, а не спрятан',
     r.alerts.some(a => /gis_proxy|перезалейте|целиком/i.test(a)), r.alerts[0] || 'сообщения нет');
  ck('бессодержательное «Не удалось загрузить слой из OSM» больше не показывается',
     !r.alerts.some(a => a === 'Не удалось загрузить слой из OSM.'), r.alerts.join(' | ').slice(0, 90));
  await r.pg.close();

  /* 2. сервер ответил страницей ошибки вместо JSON */
  r = await run('html');
  ck('HTML вместо JSON назван прямо', r.alerts.some(a => /не JSON|ответ сервера 500/i.test(a)),
     r.alerts.join(' | ').slice(0, 120));
  await r.pg.close();

  /* 3. успех: номера маршрутов значками в карточке точки */
  r = await run('ok');
  const n = await r.pg.evaluate(() => (window.CASE_GEO_POI ? CASE_GEO_POI.total('transport_hubs') : -1));
  ck('остановка загрузилась', n === 1, n + ' шт');
  await r.pg.evaluate(() => {
    const m = document.querySelector('path.leaflet-interactive') || document.querySelector('.leaflet-marker-icon');
    if (m) m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await r.pg.waitForTimeout(900);
  const pop = await r.pg.evaluate(() => {
    const p = document.querySelector('.geo-map-popup'); if (!p) return null;
    return { badges: [...p.querySelectorAll('.geo-routes b')].map(x => x.textContent),
             modes: [...p.querySelectorAll('.geo-routes-mode')].map(x => x.textContent) };
  });
  ck('в карточке остановки номера маршрутов значками', pop && pop.badges.join(',') === '2,9,10,5',
     pop ? pop.badges.join(',') : 'карточка не открылась');
  ck('виды транспорта подписаны', pop && pop.modes.join(',') === 'автобус,маршрутка', pop ? pop.modes.join(',') : '');
  ck('ошибок сценария нет', r.errs.length === 0, r.errs[0] || 'нет');
  await r.pg.close();

  await b.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nОстановки и сообщения об отказах работают');
  process.exit(bad ? 1 : 0);
})();
