/* Uchtepa Park в живом интерфейсе: проект должен появиться на карте проектов Advisory
   и в её таблице, а маркер - встать в Учтепа, а не в центре города.

   Файловые проверки (v4650_uchtepa_park.js) говорят только о том, что запись лежит в
   правильных файлах. Этот прогон отвечает на другой вопрос: доходит ли она до экрана.
   Между файлом и экраном стоят ensureData(), migrate() и фильтр по линии бизнеса -
   любой из трёх может отбросить запись молча.

   Запуск: NODE_PATH=<...>/node_modules node v4650_uchtepa_browser.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.svg': 'image/svg+xml', '.csv': 'text/csv',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream' };

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };

const srv = http.createServer((req, rsp) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
  rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rsp);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e).slice(0, 200)));

  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#luser', { timeout: 20000 });

  /* входим генеральным директором: у него открыты обе карты портфеля */
  /* Воспроизводим состояние РАБОТАЮЩЕЙ установки, а не чистого профиля.

     В core.js:1158 живёт разовая очистка портфеля от v4.11.0: при первом входе, если флаг
     CASE_WORKFLOW_SETTINGS.portfolioClearedV411 не выставлен, весь портфель вычищается -
     тогда по просьбе владельца проекты стали заполнять вручную через интерфейс. Флаг
     выставляется один раз на установку и больше очистка не повторяется.

     На чистом профиле Playwright флага нет, поэтому вход стирает всё, что только что
     положил seed, и проверка «проект виден» провалилась бы по причине, не имеющей
     отношения к самому проекту. Выставляем флаг до входа: именно так выглядит любая
     установка, работающая со времён v4.11.0. */
  await page.evaluate(() => {
    if (typeof CASE_WORKFLOW_SETTINGS !== 'object' || !CASE_WORKFLOW_SETTINGS) CASE_WORKFLOW_SETTINGS = {};
    CASE_WORKFLOW_SETTINGS.portfolioClearedV411 = true;
    persist();
  });
  await page.evaluate(() => { document.getElementById('luser').value = 'ASH'; doLogin(); });
  await page.waitForTimeout(1500);

  const r = await page.evaluate(async () => {
    go('advisory_portfolio_map');
    await new Promise(res => setTimeout(res, 2500));
    const txt = document.getElementById('main').innerText;
    /* именно голая ссылка, а не window.*: в core.js портфель объявлен через let, а let на
       верхнем уровне классического скрипта не становится свойством window. */
    const list = (typeof CASE_PORTFOLIO_PROJECTS !== 'undefined' && CASE_PORTFOLIO_PROJECTS) || [];
    const p = list.find(x => x.id === 'portfolio-096') || null;
    return {
      total: list.length,
      onScreen: txt.indexOf('Uchtepa Park') >= 0,
      rec: p && { lat: p.lat, lng: p.lng, acc: p.coordinateAccuracy, ver: p.verification,
                  lines: p.businessLines, deal: p.dealState, city: p.city },
      advisoryCount: list.filter(x => (x.businessLines || []).indexOf('Advisory') >= 0).length
    };
  });

  ck('портфель загрузился целиком', r.total === 96, r.total + ' проектов');
  ck('запись Uchtepa Park дожила до состояния приложения', !!r.rec, JSON.stringify(r.rec));
  ck('Uchtepa Park виден на экране карты проектов Advisory', r.onScreen);
  ck('проект попал в выборку линии Advisory', r.advisoryCount >= 95, r.advisoryCount + ' проектов Advisory');

  if (r.rec) {
    ck('координата пережила migrate() без замены на центроид города',
       r.rec.lat === 41.29667581538922 && r.rec.lng === 69.17693062226368,
       r.rec.lat + ', ' + r.rec.lng);
    ck('пометка ручной координаты не сброшена миграцией',
       r.rec.acc === 'exact_manual' && r.rec.ver === 'verified', r.rec.acc + ' / ' + r.rec.ver);
    ck('линия бизнеса проставлена', (r.rec.lines || []).length > 0, (r.rec.lines || []).join(', '));
    ck('состояние сделки заполнено миграцией по умолчанию', !!r.rec.deal, r.rec.deal);
  }

  /* поиск по названию - так проект будут искать в реальной работе */
  const found = await page.evaluate(async () => {
    const inp = document.getElementById('case493SearchInput');
    if (!inp) return 'поле поиска не найдено';
    /* поле вызывает case493Search напрямую из oninput, а не через слушателя события,
       поэтому синтетический Event ничего бы не запустил - зовём обработчик как браузер */
    inp.value = 'Uchtepa'; case493Search(inp.value, inp.value.length);
    await new Promise(res => setTimeout(res, 1200));
    return document.getElementById('main').innerText.indexOf('Uchtepa Park') >= 0 ? 'найден' : 'не найден';
  });
  ck('проект находится поиском по названию', found === 'найден', found);

  await page.screenshot({ path: path.join(__dirname, 'uchtepa_park_map.png'), fullPage: false });
  ck('снимок экрана сделан', fs.existsSync(path.join(__dirname, 'uchtepa_park_map.png')));
  ck('в консоли браузера нет ошибок страницы', errors.length === 0, errors.join(' | ') || 'чисто');

  await browser.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nUchtepa Park доходит до экрана и стоит в верной точке');
  process.exit(bad ? 1 : 0);
});
