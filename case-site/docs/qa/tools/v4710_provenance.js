/* Происхождение чисел: поведение в настоящем браузере.

   Что здесь проверяется и почему именно это.

   1. Правило «уверенности не смешиваются». Сводное число из подтверждённых и запрошенных
      значений обязано показываться как запрошенное, а не как подтверждённое. Это единственное
      правило модуля, ослабление которого не заметит ни один прогон по внешнему виду: плашка
      просто станет зелёной, и все будут довольны. Поэтому оно проверяется первым и на данных.

   2. Границы устаревания: 89/90/91 и 179/180/181 дней. Спор «устарела ли цифра» не должен
      быть спором про off-by-one.

   3. Три цепочки различимы БЕЗ цвета: у плашек разный значок, разный стиль рамки и разное
      слово. Материалы CASE печатаются, часто чёрно-белыми. Проверяются вычисленные стили,
      а не имена классов: класс ничего не говорит о том, как элемент выглядит.

   4. Подтверждение ставит сегодняшнюю дату и имя текущего пользователя, что бы ни лежало
      в записи до этого. Задним числом подтвердить нельзя.

   5. Плашки действительно появляются там, где обещано: в карточке помещения у площади и
      ставки, на дашборде у средней ставки и заполняемости. И раздел «Качество и источники
      данных» перестал быть заглушкой: в нём есть доля подтверждённых и очередь
      перепроверки.

   6. Роль без права finance не видит плашку у ставки и не может открыть её в диалоге.

   Запуск: NODE_PATH=<...>/node_modules node v4710_provenance.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };

let bad = 0;
function ck(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail == null ? '' : ' - ' + detail));
  if (!cond) bad++;
}

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { r.writeHead(404); r.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return iso(d); };

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));

  async function login(code) {
    await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#luser', { timeout: 20000 });
    await page.evaluate(c => { document.getElementById('luser').value = c; doLogin(); }, code);
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !!window.CASE_PROV, null, { timeout: 10000 });
  }

  await login('ASH');
  ck('модуль загружен и зарегистрирован', await page.evaluate(() =>
    !!window.CASE_PROV && (window.CASE_MODULE_VERSIONS || {})['v4710-provenance'] === CASE_PROV.version));

  console.log('\n--- 1. Уверенности не смешиваются');
  const agg = await page.evaluate(() => {
    const P = CASE_PROV, t = new Date().toISOString().slice(0, 10);
    const V = { conf: 'verified', at: t }, A = { conf: 'asking', at: t }, M = { conf: 'modelled', at: t };
    return {
      allV: P.weakest([V, V, V]),
      vPlusA: P.weakest([V, V, A]),
      vPlusM: P.weakest([V, M]),
      aPlusM: P.weakest([A, M]),
      withMissing: P.weakest([V, V, null]),
      empty: P.weakest([]),
      blended: P.aggregate([V, A]).blended,
      notBlended: P.aggregate([V, V]).blended,
      mix: P.aggregate([V, V, A, M, null]).mix,
    };
  });
  ck('три подтверждённых -> подтверждено', agg.allV === 'verified', agg.allV);
  ck('два подтверждённых + одно запрошенное -> ЗАПРОШЕНО, не подтверждено', agg.vPlusA === 'asking', agg.vPlusA);
  ck('подтверждённое + расчётное -> расчёт', agg.vPlusM === 'modelled', agg.vPlusM);
  ck('запрошенное + расчётное -> расчёт (расчёт слабее запроса)', agg.aPlusM === 'modelled', agg.aPlusM);
  ck('число без происхождения делает сводную величину «без источника»', agg.withMissing === null, String(agg.withMissing));
  ck('пустой набор -> нет уверенности', agg.empty === null);
  ck('смешанный набор помечается как смешанный', agg.blended === true);
  ck('однородный набор не помечается как смешанный', agg.notBlended === false);
  ck('состав считается верно', JSON.stringify(agg.mix) === JSON.stringify({ verified: 2, asking: 1, modelled: 1, none: 1 }), JSON.stringify(agg.mix));

  /* Возраст сводной величины: самая старая запись, а не средняя. */
  const aggAge = await page.evaluate(({ old, fresh }) => {
    const P = CASE_PROV;
    return P.aggregate([{ conf: 'verified', at: fresh }, { conf: 'verified', at: fresh }, { conf: 'verified', at: old }]).stale;
  }, { old: daysAgo(200), fresh: daysAgo(3) });
  ck('одна старая запись среди свежих делает сводную величину красной', aggAge === 'red', aggAge);

  console.log('\n--- 2. Границы устаревания');
  const bounds = await page.evaluate(days => days.map(n => CASE_PROV.staleOf(n)), [0, 89, 90, 91, 179, 180, 181, null]);
  ck('0 дней - свежее',      bounds[0] === 'fresh', bounds[0]);
  ck('89 дней - свежее',     bounds[1] === 'fresh', bounds[1]);
  ck('90 дней - жёлтое',     bounds[2] === 'amber', bounds[2]);
  ck('91 день - жёлтое',     bounds[3] === 'amber', bounds[3]);
  ck('179 дней - жёлтое',    bounds[4] === 'amber', bounds[4]);
  ck('180 дней - красное',   bounds[5] === 'red', bounds[5]);
  ck('181 день - красное',   bounds[6] === 'red', bounds[6]);
  ck('нет даты - неизвестно', bounds[7] === 'unknown', bounds[7]);
  const dsince = await page.evaluate(d => CASE_PROV.daysSince(d), daysAgo(90));
  ck('daysSince считает по календарным дням, без сдвига часового пояса', dsince === 90, String(dsince));

  console.log('\n--- 3. Три цепочки различимы без цвета');
  const looks = await page.evaluate(() => {
    const t = new Date().toISOString().slice(0, 10);
    const box = document.createElement('div');
    box.innerHTML = CASE_PROV.chipFor({ conf: 'verified', at: t }) + CASE_PROV.chipFor({ conf: 'asking', at: t })
      + CASE_PROV.chipFor({ conf: 'modelled', at: t }) + CASE_PROV.chipFor(null);
    document.body.appendChild(box);
    const out = [...box.querySelectorAll('.prov')].map(el => {
      const cs = getComputedStyle(el);
      return { mark: el.querySelector('i').textContent, word: el.querySelector('span') ? el.querySelector('span').textContent : '',
        border: cs.borderTopStyle, bg: cs.backgroundColor, title: el.getAttribute('title') || '' };
    });
    box.remove();
    return out;
  });
  const marks = new Set(looks.map(x => x.mark)), borders = new Set(looks.map(x => x.border)), words = new Set(looks.map(x => x.word));
  ck('четыре разных значка', marks.size === 4, [...marks].join(' '));
  ck('стили рамки различаются (сплошная / штрих / точки)', borders.size >= 3, [...borders].join(', '));
  ck('слова различаются', words.size === 4, [...words].join(' | '));
  ck('у каждой плашки есть подсказка с полной цепочкой', looks.every(x => x.title.length > 20));
  ck('подсказка «без источника» говорит об этом прямо', /не указано/.test(looks[3].title), looks[3].title.slice(0, 60));

  /* Устаревание накладывается на вид, а не заменяет его. */
  const oldLook = await page.evaluate(d => {
    const box = document.createElement('div');
    box.innerHTML = CASE_PROV.chipFor({ conf: 'verified', at: d });
    document.body.appendChild(box);
    const el = box.querySelector('.prov');
    const r = { cls: el.className, word: el.querySelector('span').textContent, shadow: getComputedStyle(el).boxShadow };
    box.remove(); return r;
  }, daysAgo(200));
  ck('старая подтверждённая запись остаётся подтверждённой по виду', /prov-verified/.test(oldLook.cls), oldLook.cls);
  ck('и одновременно помечена как красная', /prov-dead/.test(oldLook.cls) && oldLook.shadow !== 'none', oldLook.shadow);
  ck('и возраст написан словами в самой плашке', /назад/.test(oldLook.word), oldLook.word);

  console.log('\n--- 4. Подтверждение: сегодня и вашим именем');
  const conf = await page.evaluate(oldDate => {
    const u = U[0];
    CASE_PROV.set('unit', u.id, 'area', { conf: 'asking', src: 'broker', name: 'некто', at: oldDate, by: 'Чужой' });
    const before = Object.assign({}, CASE_PROV.get('unit', u.id, 'area'));
    const after = CASE_PROV.confirm('unit', u.id, 'area', 'document', 'БТИ');
    return { before, after, me: S.user && (S.user.name || S.user.role), today: new Date().toISOString().slice(0, 10) };
  }, daysAgo(400));
  ck('до подтверждения: запрошено, старая дата, чужое имя', conf.before.conf === 'asking' && conf.before.by === 'Чужой');
  ck('после: подтверждено', conf.after.conf === 'verified');
  ck('дата подтверждения - сегодня, а не прежняя', conf.after.at === conf.today, conf.after.at);
  ck('автор - текущий пользователь, а не прежний', conf.after.by === conf.me && conf.after.by !== 'Чужой', conf.after.by);
  ck('способ проверки записан', conf.after.how === 'document');
  ck('источник заменён на указанный', conf.after.name === 'БТИ');

  console.log('\n--- 5. Плашки на своих местах');
  const spots = await page.evaluate(() => {
    const u = U[0];
    CASE_PROV.set('unit', u.id, 'rate', { conf: 'asking', src: 'listing', name: 'olx' });
    openUnit(u.id);
    const d = document.getElementById('drawer');
    const kvs = [...d.querySelectorAll('.kv')];
    const areaKv = kvs.find(k => /Площадь/.test(k.textContent)), rateKv = kvs.find(k => /Ставка/.test(k.textContent));
    return {
      areaChip: !!(areaKv && areaKv.querySelector('.prov-verified')),
      rateChip: !!(rateKv && rateKv.querySelector('.prov-asking')),
      button: !!d.querySelector('button[onclick^="provDialog"]'),
    };
  });
  ck('в карточке у площади плашка «подтверждено»', spots.areaChip);
  ck('в карточке у ставки плашка «запрос»', spots.rateChip);
  ck('в карточке есть кнопка «Источник данных…»', spots.button);

  const dash = await page.evaluate(() => {
    S.obj = 'ALL';
    go('dash');
    const m = document.getElementById('main');
    const kpis = [...m.querySelectorAll('.kpi')];
    const rate = kpis.find(k => /Ср\. ставка|Average rate/i.test(k.textContent));
    const occ = kpis.find(k => /Заполняемость|Occupancy/i.test(k.textContent));
    return { rate: !!(rate && rate.querySelector('.prov')), occ: !!(occ && occ.querySelector('.prov')),
      rateTitle: rate && rate.querySelector('.prov') ? rate.querySelector('.prov').getAttribute('title') : '' };
  });
  ck('на дашборде у средней ставки есть сводная плашка', dash.rate);
  ck('на дашборде у заполняемости есть сводная плашка', dash.occ);
  ck('подсказка сводной плашки объясняет правило «самая слабая»', /слабую/.test(dash.rateTitle), dash.rateTitle.slice(0, 80));

  /* Диалог источника открывается и содержит поля по каждой величине. */
  const dlg = await page.evaluate(() => {
    const u = U[0];
    provDialog('unit', u.id);
    const m = document.getElementById('rmodal');
    const rows = m ? [...m.querySelectorAll('.prov-row')].map(r => r.getAttribute('data-f')) : [];
    const hasVerifiedOption = m ? [...m.querySelectorAll('select[data-k="conf"] option')].some(o => o.value === 'verified') : null;
    const confirmButtons = m ? m.querySelectorAll('button[onclick*="_confirm"]').length : 0;
    if (m) m.remove();
    return { rows, hasVerifiedOption, confirmButtons };
  });
  ck('диалог открывается с полями площадь, ставка, статус', ['area', 'rate', 'status'].every(f => dlg.rows.includes(f)), dlg.rows.join(','));
  ck('в списке уверенности НЕТ пункта «подтверждено»: подтверждение только кнопкой', dlg.hasVerifiedOption === false);
  ck('кнопки подтверждения называют способ', dlg.confirmButtons >= 4, String(dlg.confirmButtons));

  console.log('\n--- 6. Раздел «Качество и источники данных» стал настоящим');
  const dq = await page.evaluate(oldDate => {
    const u = U[1] || U[0];
    CASE_PROV.set('unit', u.id, 'status', { conf: 'verified', src: 'field', at: oldDate, by: 'Давний', how: 'visit' });
    go('data_quality');
    const m = document.getElementById('main');
    return {
      hasPh: !!m.querySelector('.ph h1'),
      title: (m.querySelector('.ph h1') || {}).textContent || '',
      kpis: m.querySelectorAll('.kpi').length,
      staleRows: m.querySelectorAll('#provStale tbody tr').length,
      placeholder: /в разработке|планируется|скоро/i.test(m.textContent) && !m.querySelector('#provStale'),
      legend: m.querySelectorAll('.prov-legend .prov').length,
    };
  }, daysAgo(200));
  ck('раздел имеет заголовок системы', dq.hasPh && /Качество/.test(dq.title), dq.title);
  ck('показаны плитки доли подтверждённых по полям', dq.kpis >= 3, String(dq.kpis));
  ck('очередь перепроверки содержит устаревшую запись', dq.staleRows >= 1, String(dq.staleRows));
  ck('это не заглушка', dq.placeholder === false);
  ck('легенда показывает все четыре вида', dq.legend === 4, String(dq.legend));

  console.log('\n--- 7. Роль без finance');
  await login('AG');
  const ag = await page.evaluate(() => {
    const u = U[0];
    openUnit(u.id);
    const d = document.getElementById('drawer');
    const kvs = [...d.querySelectorAll('.kv')];
    const rateKv = kvs.find(k => /Ставка/.test(k.textContent));
    provDialog('unit', u.id);
    const m = document.getElementById('rmodal');
    const rows = m ? [...m.querySelectorAll('.prov-row')].map(r => r.getAttribute('data-f')) : [];
    if (m) m.remove();
    return { rateChip: !!(rateKv && rateKv.querySelector('.prov')), rows, canEdit: !!(R().edit || R().admin) };
  });
  ck('агент с правом edit, но без finance', ag.canEdit === true);
  ck('у ставки плашки нет', ag.rateChip === false);
  ck('в диалоге нет строки ставки', !ag.rows.includes('rate') && ag.rows.includes('area'), ag.rows.join(','));

  ck('ошибок страницы за прогон нет', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close(); srv.close();
  console.log('\n' + (bad ? `ПРОВАЛЕНО проверок: ${bad}\n` : 'Происхождение чисел ведёт себя верно\n'));
  process.exit(bad ? 1 : 0);
});
