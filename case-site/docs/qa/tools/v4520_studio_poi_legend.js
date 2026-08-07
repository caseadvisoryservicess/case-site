/* Гео-студия OS: городские объекты (F&B, образование и прочие) видны в легенде карты,
   в отчёте по точке и в модели зон пригодности. Плюс сама легенда снова принимает мышь.

   Жалобы владельца:
     «когда в легенду не помещается весь список, появляется ползунок, но он не двигается.
      Надо сделать размер легенды регулируемым прям на месте»;
     «обнови и OS … данные по F&B локациям».

   Причина неподвижного ползунка: updateLegend перезаписывал className и стирал служебный
   класс Leaflet `leaflet-control`, а без него pointer-events:none — мышь легенду не видела.

   Данные F&B и образования в OS собирает сам сервер (api/gis_proxy.php → OSM), поэтому
   второй слой не заводим: показываем в легенде и в аналитике то, что OS уже собирает.

   Запуск: node v4520_studio_poi_legend.js [папка os] */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.argv[2] || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failed = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) failed++; };

/* Что «сервер» отдаёт по каждому слою. Координаты — центр Ташкента, чтобы точки
   попали в стартовый экран: легенда считает только видимое. */
const ROWS = {
  restaurants: [
    { name: 'Афсона', lat: 41.3110, lng: 69.2800 },
    { name: 'Чайхана Навруз', lat: 41.3115, lng: 69.2805 },
    { name: 'Sette', lat: 41.3120, lng: 69.2810 }
  ],
  cafes: [
    { name: 'Coffee House', lat: 41.3112, lng: 69.2802 },
    { name: 'Bon', lat: 41.3118, lng: 69.2808 }
  ],
  fast_food: [{ name: 'Evos', lat: 41.3125, lng: 69.2815 }],
  education: [
    { name: 'Школа №110', lat: 41.3105, lng: 69.2795 },
    { name: 'Inha University', lat: 41.3130, lng: 69.2820 }
  ]
};

(async () => {
  const { srv, base } = await createMockServer(OS, {});
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  /* Внешнее рубим (интернета нет), запрос слоёв обслуживаем сами */
  const asked = [];
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (/gis_proxy\.php/.test(u)) {
      const k = (u.match(/category=([a-z_]+)/) || [])[1] || '';
      asked.push(k);
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, rows: (ROWS[k] || []).map(x => Object.assign({ provider: 'OSM' }, x)) }) });
    }
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    return r.abort();
  });

  await pg.goto(base + '/geoanalytics-studio.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);

  const real = errs.filter(e => !/Failed to fetch|net::|NetworkError|Load failed/i.test(e));
  ck('студия открылась без ошибок сценария', real.length === 0, real[0] || 'ошибок нет');
  ck('мост к слоям городских объектов доступен карте',
    await pg.evaluate(() => !!(window.CASE_GEO_POI && typeof window.CASE_GEO_POI.visible === 'function')));

  /* Включаем слои общепита и образования — как это делает пользователь галочками */
  const loaded = await pg.evaluate(async () => {
    for (const k of ['restaurants', 'cafes', 'fast_food', 'education']) {
      const cb = document.getElementById('geoLayer-' + k);
      if (!cb) return { err: 'нет переключателя слоя ' + k };
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
    }
    await new Promise(r => setTimeout(r, 1500));
    return { vis: window.CASE_GEO_POI.visible(), total: window.CASE_GEO_POI.total('restaurants') };
  });
  ck('слои загрузились с сервера', !loaded.err && loaded.total === 3,
    loaded.err || ('ресторанов: ' + loaded.total + ', запрошено слоёв: ' + asked.length));
  ck('счётчик видимого совпадает с данными',
    loaded.vis && loaded.vis.restaurants === 3 && loaded.vis.cafes === 2 && loaded.vis.education === 2,
    JSON.stringify(loaded.vis));

  const lgd = await pg.evaluate(() => {
    const el = document.getElementById('mlgd');
    return { txt: el.innerText.replace(/\s+/g, ' '),
             rows: [...el.querySelectorAll('.li')].filter(x => /lgdTogglePoi/.test(x.getAttribute('onclick') || ''))
               .map(x => x.textContent.trim()) };
  });
  ck('в легенде появился блок HoReCa', /HoReCa · 6/.test(lgd.txt), lgd.txt.slice(0, 200));
  ck('в легенде появился блок «Образование»', /Образование · 2/.test(lgd.txt), lgd.txt.slice(0, 240));
  ck('в легенде видны сами слои с количеством',
    lgd.rows.some(r => /Рестораны3/.test(r.replace(/\s/g, ''))) &&
    lgd.rows.some(r => /Образование2/.test(r.replace(/\s/g, ''))),
    lgd.rows.join(' | '));

  /* Клик по строке легенды убирает слой и не открывает отчёт по точке */
  const clicked = await pg.evaluate(async () => {
    const el = document.getElementById('mlgd');
    const li = [...el.querySelectorAll('.li')].find(x => /lgdTogglePoi\('cafes'\)/.test(x.getAttribute('onclick') || ''));
    li.click();
    await new Promise(r => setTimeout(r, 700));
    return { on: window.CASE_GEO_POI.on('cafes'),
             txt: document.getElementById('mlgd').innerText.replace(/\s+/g, ' '),
             overlays: [...document.querySelectorAll('.cardbg.open')].map(x => x.id) };
  });
  ck('клик по строке легенды выключает слой', clicked.on === false);
  ck('выключенный слой исчез из легенды', !/Кафе и кофейни/.test(clicked.txt), clicked.txt.slice(0, 200));
  ck('клик по легенде не открывает отчёт по точке', clicked.overlays.length === 0, clicked.overlays.join(', ') || 'ничего лишнего');

  await pg.evaluate(async () => {
    const cb = document.getElementById('geoLayer-cafes'); cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 800));
  });

  /* Отчёт по точке: блоки и скоринг */
  const rep = await pg.evaluate(async () => {
    await probeAt(41.3115, 69.2805);
    await new Promise(r => setTimeout(r, 1500));
    const t = (document.getElementById('probe') || {}).innerText || '';
    return { fnb: /F&B \(конкуренция\)/i.test(t), edu: /Образование \(конкуренция\)/i.test(t),
             sFnb: /Потенциал заведения F&B/i.test(t), sEdu: /Потенциал учебного центра/i.test(t),
             vals: (typeof LASTPROBE === 'object' && LASTPROBE) ? { f: LASTPROBE.scoreFnb, e: LASTPROBE.scoreEdu, m: LASTPROBE.scoreMed } : null,
             byType: /В 1 км:/.test(t) };
  });
  ck('в отчёте по точке есть блок F&B', rep.fnb);
  ck('в отчёте по точке есть блок образования', rep.edu);
  ck('в отчёте есть разбивка F&B по категориям', rep.byType);
  ck('в отчёте есть потенциал заведения F&B', rep.sFnb);
  ck('в отчёте есть потенциал учебного центра', rep.sEdu);
  ck('оценки считаются по тем же правилам, что клиника',
    rep.vals && (rep.vals.f === null) === (rep.vals.m === null) && (rep.vals.e === null) === (rep.vals.m === null),
    rep.vals ? `F&B ${rep.vals.f}, образование ${rep.vals.e}, клиника ${rep.vals.m}` : 'нет LASTPROBE');
  await pg.evaluate(() => closeProbe());

  /* Модель зон: конкуренты общепита берутся из слоёв, а не из медицины с БЦ */
  const zone = await pg.evaluate(() => ({
    fnb: zCompCount(41.3115, 69.2805, 1000, 'fnb'),
    direct: window.CASE_GEO_POI.countIn(['restaurants', 'cafes', 'fast_food'], 41.3115, 69.2805, 1),
    edu: zCompCount(41.3115, 69.2805, 1000, 'edu'),
    med: zCompCount(41.3115, 69.2805, 1000, 'med')
  }));
  ck('модель зон считает конкурентами общепит', zone.fnb === zone.direct && zone.fnb === 6,
    `zCompCount ${zone.fnb}, прямой счёт ${zone.direct}`);
  ck('модель зон считает конкурентами образование', zone.edu === 2, 'получено ' + zone.edu);
  ck('медицина считается по-старому', typeof zone.med === 'number');

  /* ===== Механика легенды ===== */
  const mech = await pg.evaluate(() => {
    const el = document.getElementById('mlgd'), bd = el.querySelector('.body');
    const r = bd.getBoundingClientRect();
    return { pe: getComputedStyle(el).pointerEvents, cls: el.className,
             grip: !!el.querySelector('h4 .rsz'), x: r.x, y: r.y, w: r.width, h: r.height,
             over: bd.scrollHeight > bd.clientHeight };
  });
  ck('легенда принимает мышь (не «сквозная»)', mech.pe !== 'none', 'pointer-events: ' + mech.pe);
  ck('служебный класс Leaflet не стёрт', /leaflet-control/.test(mech.cls), mech.cls);
  ck('ручка изменения размера есть', mech.grip);

  const grip = await pg.evaluate(() => {
    const g = document.querySelector('#mlgd h4 .rsz'), r = g.getBoundingClientRect();
    const l = document.getElementById('mlgd').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, h: l.height, w: l.width,
             hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === g };
  });
  ck('ручка доступна мыши', grip.hit);
  await pg.mouse.move(grip.x, grip.y);
  await pg.mouse.down();
  await pg.mouse.move(grip.x + 50, grip.y - 100, { steps: 10 });
  await pg.mouse.up();
  await pg.waitForTimeout(300);
  const sized = await pg.evaluate(() => {
    const el = document.getElementById('mlgd'), r = el.getBoundingClientRect();
    return { h: r.height, w: r.width, saved: localStorage.getItem('caseos_lgdsize') || '',
             bodyMax: parseFloat(el.querySelector('.body').style.maxHeight) || 0 };
  });
  ck('легенда тянется в ширину', sized.w > grip.w + 30,
    `было ${Math.round(grip.w)}, стало ${Math.round(sized.w)}`);
  /* Высота — это потолок для списка. Здесь список короткий и пустоту рисовать незачем,
     поэтому коробка не вырастает; проверяем, что заданный потолок применён.
     Случай «список не помещается и легенда растёт» проверяется на автономной версии,
     где данных на полторы тысячи строк (geo_standalone_legend.js). */
  ck('заданная высота применена к списку', sized.bodyMax > grip.h,
    'потолок списка: ' + sized.bodyMax + ' px');
  ck('размер запомнен', /"w":\d+/.test(sized.saved), sized.saved);

  await pg.evaluate(() => updateLegend());
  await pg.waitForTimeout(200);
  const kept = await pg.evaluate(() => document.getElementById('mlgd').getBoundingClientRect().height);
  ck('размер не слетает при перерисовке', Math.abs(kept - sized.h) < 2, `${Math.round(sized.h)} → ${Math.round(kept)}`);

  ck('ошибок сценария за весь прогон нет',
    errs.filter(e => !/Failed to fetch|net::|NetworkError|Load failed/i.test(e)).length === 0,
    errs[0] || 'ошибок нет');

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
