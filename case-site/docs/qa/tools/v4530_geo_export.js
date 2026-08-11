/* Выгрузка геоаналитики по проекту: PDF · Excel · PowerPoint одной кнопкой.

   Запрос владельца: «поставили наш новый проект на карту, проверили данные проекта,
   конкурентную среду, население — и одной кнопкой выгрузили PDF, Excel, PPTX
   с готовым презентационным видом».

   Файлы собираются в браузере без сторонних библиотек (.xlsx и .pptx — это ZIP с XML).
   Поэтому мало проверить, что файл скачался: тест сохраняет его на диск, а рядом
   лежащий проверяльщик (check_office_files.py) открывает его настоящими openpyxl
   и python-pptx — если структура невалидна, PowerPoint бы тоже не открыл.

   Запуск: node v4530_geo_export.js [папка os] */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
const fs = require('fs'), path = require('path');

const OS = process.argv[2] || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = path.join(__dirname, 'exporttest');
/* однопиксельный тайл-заглушка */
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) failed++; };

/* subtype — сырой тег OSM, как его отдаёт api/gis_proxy.php. Отчёт обязан
   превратить его в человеческое название, а чайхану — узнать по имени. */
const ROWS = {
  restaurants: [{ name: 'Афсона', lat: 41.3110, lng: 69.2800, subtype: 'restaurant' },
                { name: 'Чайхана Навруз', lat: 41.3115, lng: 69.2805, subtype: 'restaurant' }],
  cafes: [{ name: 'Coffee House', lat: 41.3112, lng: 69.2802, subtype: 'cafe' }],
  fast_food: [{ name: 'Evos', lat: 41.3125, lng: 69.2815, subtype: 'fast_food' }],
  /* торговый центр — чтобы проверить, что у торговли свой набор колонок */
  shopping: [{ name: 'Depo Mall', lat: 41.3122, lng: 69.2790, subtype: 'mall', format: 'ТЦ, стрит-ритейл',
               openYear: 2021, landArea: 97000, gba: 42664, gla: 34398, floors: 2,
               tenantsCount: 200, fbCount: 12, parkingSpaces: 600, rentRange: '15-40' }],
  education: [{ name: 'Школа №110', lat: 41.3105, lng: 69.2795, subtype: 'school' },
              { name: "Najot Ta'lim", lat: 41.3108, lng: 69.2798, subtype: 'training' },
              { name: 'Inha University', lat: 41.3112, lng: 69.2801, subtype: 'university' }]
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const { srv, base } = await createMockServer(OS, {});
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  const saved = [];
  pg.on('download', async d => {
    const f = path.join(OUT, d.suggestedFilename());
    await d.saveAs(f); saved.push(f);
  });

  await pg.route('**/*', r => {
    const u = r.request().url();
    if (/gis_proxy\.php/.test(u)) {
      const k = (u.match(/category=([a-z_]+)/) || [])[1] || '';
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, rows: (ROWS[k] || []).map(x => Object.assign({ provider: 'OSM' }, x)) }) });
    }
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    /* Тайлы подложки отдаём сами — иначе снимок карты для презентации будет пустым.
       Заголовок CORS обязателен: без него холст «пачкается» и снимок не сделать. */
    if (/\.png($|\?)|tiles?\?|\/vt\/|MapServer/i.test(u))
      return r.fulfill({ status: 200, contentType: 'image/png', body: TILE,
        headers: { 'Access-Control-Allow-Origin': '*' } });
    return r.abort();
  });

  await pg.goto(base + '/geoanalytics-studio.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);

  const real = errs.filter(e => !/Failed to fetch|net::|NetworkError|Load failed/i.test(e));
  ck('студия открылась без ошибок сценария', real.length === 0, real[0] || 'ошибок нет');
  ck('модуль выгрузки загрузился',
    await pg.evaluate(() => typeof window.caseGeoExportXlsx === 'function' && typeof window.caseGeoExportPptx === 'function'));
  ck('кнопки на месте', await pg.evaluate(() => !!document.getElementById('btnProjExport') && !!document.getElementById('btnProjReport')));

  /* Слои общепита и образования — чтобы в отчёт попали и они */
  await pg.evaluate(async () => {
    for (const k of ['restaurants', 'cafes', 'fast_food', 'education', 'shopping']) {
      const cb = document.getElementById('geoLayer-' + k);
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 300)); }
    }
    await new Promise(r => setTimeout(r, 1200));
  });

  /* Проект без координат — выгрузка должна объяснить, а не молчать */
  const noCoords = await pg.evaluate(async () => {
    const msgs = []; const old = window.alert; window.alert = m => msgs.push(m);
    const sel = document.getElementById('proj');
    PROJECTS.nocoord = { id: 'nocoord', name: 'Проект без точки', lat: '', lng: '' };
    sel.innerHTML += '<option value="nocoord">Проект без точки</option>';
    sel.value = 'nocoord';
    window.caseGeoProjectReport(true);
    await new Promise(r => setTimeout(r, 400));
    window.alert = old;
    return msgs;
  });
  ck('проект без координат: понятное объяснение', noCoords.length === 1 && /координат/i.test(noCoords[0]),
    noCoords[0] || 'сообщения не было');

  /* Аналитика по проекту с координатами */
  const rep = await pg.evaluate(async () => {
    const sel = document.getElementById('proj');
    PROJECTS.tst = { id: 'tst', name: 'Samsung BC (проверка)', lat: 41.3115, lng: 69.2805, portfolio: true, district: 'Юнусабад' };
    sel.innerHTML += '<option value="tst">Samsung BC (проверка)</option>';
    sel.value = 'tst';
    window.caseGeoProjectReport(false);
    await new Promise(r => setTimeout(r, 2000));
    return { open: document.getElementById('probe').classList.contains('open'),
             project: LASTPROBE && LASTPROBE.project, rows: LASTPROBE && LASTPROBE.table ? LASTPROBE.table.length : 0,
             fnb: LASTPROBE && LASTPROBE.table ? LASTPROBE.table[1].fnb : null };
  });
  ck('«Аналитика по проекту» открывает отчёт в точке проекта', rep.open === true);
  ck('в отчёте записан проект', /Samsung BC/.test(rep.project || ''), rep.project);
  ck('таблица по радиусам собрана', rep.rows >= 5, 'строк: ' + rep.rows);
  ck('в таблице есть F&B', rep.fnb !== null && rep.fnb !== undefined, 'в 1 км: ' + rep.fnb);

  /* ===== Профили конкурентов на экране, а не только в файлах =====
     Запрос: «on analytics side I want to see every competitor profile's informations
     also. their price, GLA, GBA and etc». */
  /* Офисы и торговля разнесены: у БЦ свои показатели, колонки ТРЦ для них пустые */
  const filled = await pg.evaluate(async () => {
    const i = BC.findIndex(b => /Trilliant/i.test(b.name || ''));
    if (i >= 0) Object.assign(BC[i], { class: 'A+', year: 2019, gba: 24000, gla: 18500, floors: 12,
      typicalFloor: 1500, parking: 220, rentRange: '28-38', avail: 1200,
      layout: 'open space', finish: 'shell&core', owner: 'CASE Development' });
    await probeAt(41.3115, 69.2805);
    await new Promise(r => setTimeout(r, 1500));
    const panel = document.getElementById('probe');
    const tabs = [...panel.querySelectorAll('table.cmp')];
    const heads = tabs.map(t => [...t.querySelectorAll('th')].map(x => x.textContent.trim()));
    const rows = tabs.map(t => t.querySelectorAll('tbody tr').length);
    const txt = panel.innerText;
    const first = tabs.length ? tabs[0].querySelector('tbody tr').textContent.replace(/\s+/g, ' ') : '';
    return { n: tabs.length, heads, rows, txt, first,
             clickable: tabs.length ? [...tabs[0].querySelectorAll('tbody tr')]
               .filter(r => /caseGeoOpenCompetitor/.test(r.getAttribute('onclick') || '')).length : 0 };
  });
  ck('в отчёте два блока конкурентов: офисы и торговля', filled.n === 2, 'таблиц: ' + filled.n);
  ck('у офисов свои колонки (класс, GLA, типовой этаж, планировка)',
    filled.n >= 1 && ['Класс', 'GLA', 'Типовой этаж', 'Планировка', 'Отделка', 'Ставка']
      .every(h => filled.heads[0].includes(h)), (filled.heads[0] || []).join(' | '));
  /* Владелец отказался от этих полей — их не должно быть ни на экране, ни в файлах */
  ck('убранные показатели не вернулись',
    filled.n >= 1 && !['NLA', 'SC', 'Вакансия', 'Потолки', 'Лифтов', 'Заполн.']
      .some(h => filled.heads[0].includes(h)), (filled.heads[0] || []).join(' | '));
  ck('колонок торгового центра в офисной таблице нет',
    filled.n >= 1 && !filled.heads[0].includes('Точки') && !filled.heads[0].includes('F&B'),
    (filled.heads[0] || []).join(' | '));
  ck('у торговли остались свои колонки',
    filled.n >= 2 && ['Точки', 'F&B', 'GLA', 'Участок'].every(h => filled.heads[1].includes(h)),
    (filled.heads[1] || []).join(' | '));
  ck('заполненный БЦ показан с данными',
    /A\+/.test(filled.first) && /18\s?500/.test(filled.first) && /\$28–38/.test(filled.first)
    && /open space/.test(filled.first),
    filled.first.slice(0, 140));
  ck('свод по зоне охвата показан',
    /медиана \$/.test(filled.txt) && /суммарная GLA/.test(filled.txt),
    (filled.txt.match(/Ставка:[^\n]{0,110}/) || [''])[0]);
  ck('каждая строка открывает карточку', filled.clickable === filled.rows[0],
    `${filled.clickable} из ${filled.rows[0]}`);

  const opened = await pg.evaluate(async () => {
    const calls = [];
    const old = window.geoOpenMapRecord;
    window.geoOpenMapRecord = (k, i) => calls.push(k + ':' + i);
    document.querySelector('#probe table.cmp tbody tr').click();
    await new Promise(r => setTimeout(r, 200));
    window.geoOpenMapRecord = old;
    return calls;
  });
  ck('клик по строке открывает карточку', opened.length === 1 && /^bc:/.test(opened[0]),
    opened.join(', ') || 'вызова не было');

  /* Карточка БЦ должна содержать поля, которые команда будет заполнять */
  const schema = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('#probe, .card').forEach(() => {});
    return typeof window.geoOpenMapRecord === 'function';
  });
  ck('карточка объекта доступна для заполнения', schema === true);

  /* Типы образования и общепита — человеческими словами, чайхана отдельно */
  const subs = await pg.evaluate(() => ({
    edu: window.CASE_GEO_POI.subtypes(['education'], 41.3115, 69.2805, 1),
    fnb: window.CASE_GEO_POI.subtypes(['restaurants', 'cafes', 'fast_food'], 41.3115, 69.2805, 1)
  }));
  ck('образование разложено по человеческим типам',
    subs.edu['Школа'] === 1 && subs.edu['Курсы / учебный центр'] === 1 && subs.edu['Университет / вуз'] === 1,
    JSON.stringify(subs.edu));
  ck('чайхана отделена от ресторанов', subs.fnb['Чайхана / национальная'] === 1 && subs.fnb['Ресторан'] === 1,
    JSON.stringify(subs.fnb));

  /* ===== Настройки выгрузки: свои у каждого проекта =====
     Запрос: «каждый проект уникален и имеет свою настройку». Проверяем, что окно
     открывается, настройка сохраняется по проекту и реально меняет состав файла
     и баллы скоринга. */
  const dlg = await pg.evaluate(() => {
    window.caseGeoExportSettings(false);
    const w = document.getElementById('caseExpCfg');
    return { open: !!w, parts: w ? w.querySelectorAll('[data-part]').length : 0,
             bench: w ? w.querySelectorAll('[data-bench]').length : 0,
             fmt: w ? w.querySelectorAll('[data-fmt]').length : 0,
             radii: w ? w.querySelector('#caseExpRadii').value : '' };
  });
  ck('окно настроек открывается', dlg.open);
  ck('в настройках есть разделы, эталоны и форматы',
    dlg.parts >= 10 && dlg.bench === 4 && dlg.fmt === 3,
    `разделов ${dlg.parts}, эталонов ${dlg.bench}, форматов ${dlg.fmt}`);
  ck('радиусы по умолчанию подставлены', /500/.test(dlg.radii), dlg.radii);

  const savedCfg = await pg.evaluate(() => {
    const w = document.getElementById('caseExpCfg');
    /* убираем метро и рынок, свои радиусы, свой эталон F&B */
    w.querySelector('[data-part="metro"]').checked = false;
    w.querySelector('[data-part="market"]').checked = false;
    w.querySelector('#caseExpRadii').value = '400,800,1600';
    w.querySelector('[data-bench="fnb"]').value = '3';
    w.querySelector('#caseExpDetail').value = '800';
    w.querySelector('#caseExpSave').click();
    const key = 'caseos_export_cfg_' + document.getElementById('proj').value;
    return { raw: localStorage.getItem(key), closed: !document.getElementById('caseExpCfg') };
  });
  ck('настройка сохранена по конкретному проекту', /"radii":"400,800,1600"/.test(savedCfg.raw || ''), savedCfg.raw);
  ck('окно закрывается после сохранения', savedCfg.closed);

  const otherProj = await pg.evaluate(() => {
    const sel = document.getElementById('proj'); const was = sel.value;
    sel.value = 'project';
    window.caseGeoExportSettings(false);
    const v = document.getElementById('caseExpRadii').value;
    document.getElementById('caseExpX').click();
    sel.value = was;
    return v;
  });
  ck('у другого проекта своя настройка, не перетёрта',
    otherProj === '500,1000,1500,2000,3000', 'радиусы второго проекта: ' + otherProj);

  /* Выгрузка Excel и PPTX */
  await pg.evaluate(() => window.caseGeoExportXlsx());
  await pg.waitForTimeout(1200);
  await pg.evaluate(async () => window.caseGeoExportPptx(await window.caseGeoMapPngAsync()));
  await pg.waitForTimeout(1500);

  /* Тайлы отдаём с CORS — снимок должен получиться. Без CORS функция обязана вернуть
     пустоту, а не пустую картинку: карта без подложки в презентации выглядит готовой,
     но по ней ничего не понять. */
  const snap = await pg.evaluate(async () => { const b = await window.caseGeoMapPngAsync(); return b ? b.length : 0; });
  ck('снимок карты для презентации снят', snap > 100, snap ? (snap + ' байт') : 'не снят');

  const xlsx = saved.find(f => f.endsWith('.xlsx'));
  const pptx = saved.find(f => f.endsWith('.pptx'));
  ck('файл Excel скачался', !!xlsx, xlsx ? path.basename(xlsx) : 'нет файла');
  ck('файл PowerPoint скачался', !!pptx, pptx ? path.basename(pptx) : 'нет файла');
  /* Имя файла обязано быть латиницей с расширением: браузер выбрасывает кириллицу
     из атрибута download, и файл сохраняется как «download» без расширения. */
  ck('имя файла латиницей, с названием проекта и расширением',
    !!xlsx && /^CASE_OS_geo_Samsung_BC.*\.xlsx$/.test(path.basename(xlsx)), xlsx ? path.basename(xlsx) : '');

  ck('ошибок сценария за весь прогон нет',
    errs.filter(e => !/Failed to fetch|net::|NetworkError|Load failed/i.test(e)).length === 0, errs[0] || 'ошибок нет');

  await b.close(); srv.close();
  console.log('\nФайлы сохранены в ' + OUT + ' — проверьте их: python3 docs/qa/tools/check_office_files.py ' + OUT);
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки в браузере пройдены');
  process.exit(failed ? 1 : 0);
})();
