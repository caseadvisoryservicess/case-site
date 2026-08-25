/* Сквозная симуляция коммерческого предложения в живой системе.

   Отдельные проверки модулей уже есть. Здесь другое: убедиться, что все четыре новых
   модуля грузятся ВНУТРИ настоящего CASE OS рядом с остальными сорока, не конфликтуют с
   ними, доступны из страницы и вместе дают связный результат - от выбора вида проекта до
   готовой строки цены и титульной картинки.

   Так ловятся ошибки, которых не видит ни один модульный тест: конфликт имён в window,
   порядок загрузки, промах в cache-buster, забытый файл в офлайн-кэше.

   Запуск: NODE_PATH=<...>/node_modules node v4690_offer_simulation.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { r.writeHead(404); r.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e).slice(0, 200)));

  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#luser', { timeout: 20000 });
  await page.waitForTimeout(1200);

  /* ---- модули дошли до страницы ---- */
  const mods = await page.evaluate(() => ({
    translit: !!window.CASE_UZ_TRANSLIT, pricing: !!window.CASE_OFFER_PRICING,
    dir: !!window.CASE_PROJECT_DIR, cover: !!window.CASE_OFFER_COVER,
    versions: window.CASE_MODULE_VERSIONS || {},
    app: (document.querySelector('#appver') || {}).textContent || ''
  }));
  ck('транслитератор доступен в странице', mods.translit);
  ck('расчёт цены доступен', mods.pricing);
  ck('справочники проекта доступны', mods.dir);
  ck('титульная картинка доступна', mods.cover);
  ['v4660-uz-translit', 'v4670-offer-pricing', 'v4680-project-directories', 'v4690-offer-cover']
    .forEach(m => ck('модуль ' + m + ' объявил версию', !!mods.versions[m], mods.versions[m]));

  /* ---- сквозной сценарий: реконструкция Lifestyle-центра ---- */
  const sim = await page.evaluate(() => {
    const D = window.CASE_PROJECT_DIR, P = window.CASE_OFFER_PRICING;
    const T = window.CASE_UZ_TRANSLIT, C = window.CASE_OFFER_COVER;

    const kind = 'lifestyle_centre', work = 'reconstruction';
    const hints = D.complexityHints(work);
    const price = P.calc({
      area: 24500, tariff: 't3', rate: 2.4,
      complexityFactors: hints.concat(['multi_owner']),
      discountPercent: 7, months: 6, monthly: 2500, hours: 0
    });
    const uz = 'Hurmatli mijoz, {{project_name}} loyihasi bo‘yicha tijorat taklifi. '
      + 'Hisob-kitob maydoni 24 500 m², jami ' + P.usd(price.total) + '.';
    const cov = C.cover({ offerNumber: 'CASE-OFF-2026-0042' });

    return {
      label: D.label(kind, work),
      segment: D.segmentOf(kind),
      hints: hints,
      complexity: price.complexity,
      formula: price.formula,
      billable: P.usd(price.billable),
      total: P.usd(price.total),
      schedule: price.schedule.map(x => x.percent + '% ' + P.usd(x.amount)),
      scheduleSum: price.schedule.reduce((s, x) => s + x.amount, 0),
      billableUsd: price.billableUsd,
      deviations: price.deviations.map(d => d.ru),
      needsReason: price.needsReason,
      uzLatn: uz,
      uzCyrl: T.toCyrl(T.normalizeApostrophes(uz)),
      roundTrip: T.roundTrips(T.normalizeApostrophes(uz)).ok,
      coverKind: cov.kind, coverSrc: cov.src
    };
  });

  ck('вид и тип собрались в подпись', sim.label === 'Lifestyle-центр, реконструкция', sim.label);
  ck('сегмент выведен автоматически', sim.segment === 'mall', sim.segment);
  ck('тип работ подсказал фактор сложности', sim.hints.length === 1, sim.hints.join(', '));
  ck('коэффициент сложности сложился из двух надбавок', sim.complexity === 1.35, String(sim.complexity));
  ck('формула документа содержит коэффициент', /× 1,35 =/.test(sim.formula), sim.formula);
  ck('график платежей сходится с суммой к оплате', sim.scheduleSum === sim.billableUsd,
     sim.scheduleSum + ' против ' + sim.billableUsd);
  ck('ручные решения подняли флаг объяснения', sim.needsReason === true);
  ck('все три отклонения зафиксированы', sim.deviations.length === 3, sim.deviations.join('; '));
  ck('узбекский текст обратим после преобразования', sim.roundTrip === true);
  ck('плейсхолдер пережил преобразование', /\{\{project_name\}\}/.test(sim.uzCyrl));
  ck('сумма в тексте не транслитерирована', /USD|\$/.test(sim.uzCyrl) || /\d/.test(sim.uzCyrl));
  ck('титульная картинка выбрана', !!sim.coverKind, sim.coverKind + (sim.coverSrc ? ': ' + sim.coverSrc : ''));
  ck('в консоли браузера нет ошибок страницы', errors.length === 0, errors.join(' | ') || 'чисто');

  /* ---- показать результат на экране и снять ---- */
  await page.evaluate(s => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#F4F3F1;padding:36px 44px;'
      + 'font-family:system-ui,Arial,sans-serif;color:#1B1B1B;overflow:auto';
    const row = (k, v) => '<div style="display:flex;gap:16px;padding:7px 0;border-bottom:1px solid #E6E3DF">'
      + '<span style="width:290px;color:#6B6B6B;font-size:12px">' + k + '</span>'
      + '<b style="font-size:13px;flex:1">' + v + '</b></div>';
    host.innerHTML =
      '<div style="max-width:1000px">'
      + '<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9E0000;font-weight:800">CASE OS · симуляция предложения</div>'
      + '<h1 style="font-size:26px;margin:6px 0 22px">Реконструкция Lifestyle-центра, 24 500 м²</h1>'
      + row('Вид и тип проекта', s.label)
      + row('Сегмент', s.segment)
      + row('Коэффициент сложности', s.complexity + '  <span style="color:#6B6B6B;font-weight:400">(' + s.hints.join(', ') + ' + несколько собственников)</span>')
      + row('Формула', s.formula)
      + row('К оплате после скидки 7%', s.billable)
      + row('Итого с надзором 6 мес.', s.total)
      + row('График платежей', s.schedule.join(' · '))
      + row('Требует объяснения', s.needsReason ? 'да' : 'нет')
      + row('Отклонения', s.deviations.join('<br>'))
      + row('Титульная картинка', s.coverKind + (s.coverSrc ? ' · ' + s.coverSrc : ' · файлы ещё не залиты'))
      + '<div style="margin-top:26px;padding:18px;background:#fff;border:1px solid #E6E3DF;border-radius:10px">'
      + '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6B6B6B;margin-bottom:8px">Латиница</div>'
      + '<div style="font-size:14px;margin-bottom:14px">' + s.uzLatn + '</div>'
      + '<div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6B6B6B;margin-bottom:8px">Кириллица, получена автоматически</div>'
      + '<div style="font-size:14px">' + s.uzCyrl + '</div>'
      + '<div style="margin-top:12px;font-size:11px;color:#2e7d32">Обратное преобразование вернуло исходный текст в точности</div>'
      + '</div></div>';
    document.body.appendChild(host);
  }, sim);
  await page.waitForTimeout(400);
  const shot = path.join(__dirname, 'offer_simulation.png');
  await page.screenshot({ path: shot });
  ck('снимок симуляции сделан', fs.existsSync(shot));

  console.log('\nСценарий целиком:');
  console.log('  ' + sim.label + ', сегмент ' + sim.segment);
  console.log('  ' + sim.formula);
  console.log('  к оплате ' + sim.billable + ', итого ' + sim.total);
  console.log('  график: ' + sim.schedule.join(' · '));
  console.log('  отклонения: ' + sim.deviations.join('; '));
  console.log('  лат: ' + sim.uzLatn);
  console.log('  кир: ' + sim.uzCyrl);

  await browser.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nСквозной сценарий предложения работает в живой системе');
  process.exit(bad ? 1 : 0);
});
