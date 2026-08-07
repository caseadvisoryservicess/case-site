/* Легенда автономной геоаналитики: в ней должно быть образование, а не только БЦ и медицина.

   Жалоба владельца: «в легенде не отразилась аналитика образовательного сектора,
   там только БЦ и медицина».

   Проверяем: блок появляется, разбивка по типам совпадает с тем, что нарисовано
   на карте, цвета кружков соответствуют раскраске, клик по строке фильтрует,
   счётчик «на экране» учитывает образование, а при выключенном слое блок пропадает.

   Запуск: node geo_standalone_legend.js [файл.html] */
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');

const FILE = process.argv[2] || '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failed = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) failed++; };

/* Точки кладём в центр Ташкента, чтобы все попали в стартовый экран карты:
   легенда считает только видимое, за краем экрана объект в неё не попадёт. */
const EDU = { src: 'тест', points: [
  { n: 'Школа №110', la: 41.3200, ln: 69.2800, t: 'school', s: 'OSM' },
  { n: 'Школа №64',  la: 41.3210, ln: 69.2810, t: 'school', s: 'OSM' },
  { n: 'Школа №18',  la: 41.3190, ln: 69.2790, t: 'school', s: 'OSM' },
  { n: 'Inha University', la: 41.3450, ln: 69.2870, t: 'university', s: 'OSM' },
  { n: 'Westminster',     la: 41.3460, ln: 69.2880, t: 'university', s: 'OSM' },
  { n: "Najot Ta'lim",    la: 41.3480, ln: 69.2890, t: 'courses', s: 'OSM' },
  { n: 'Автошкола Йўл',   la: 41.3300, ln: 69.2700, t: 'driving', s: 'OSM' }
]};

(async () => {
  const tmp = path.join(__dirname, 'legendtest');
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const dst = path.join(tmp, 'geo.html');
  fs.copyFileSync(FILE, dst);

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  /* Интернета нет — рвём всё внешнее, страница обязана работать автономно */
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith('file://') || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    return r.abort();
  });
  await pg.addInitScript(d => localStorage.setItem('caseos_edu', JSON.stringify(d)), EDU);

  await pg.goto('file://' + dst, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  ck('страница открылась без ошибок сценария', errs.length === 0, errs[0] || 'ошибок нет');

  const lgd = () => pg.evaluate(() => {
    const el = document.getElementById('mlgd');
    return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
  });

  const base = await lgd();
  ck('легенда на экране есть', base.length > 0, base.slice(0, 80));
  ck('до включения слоя образования в легенде нет', !/Образовани/i.test(base), base.slice(0, 80));

  /* Включаем слой */
  const on = await pg.evaluate(async () => {
    const cb = document.getElementById('lEdu');
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));
    renderEdu();
    await new Promise(r => setTimeout(r, 600));
    return { vis: VIS.edu, byType: VIS.eduByType, byT: VIS.eduByT,
             drawn: gEdu.getLayers().length };
  });
  ck('точки образования нарисованы', on.drawn === on.vis && on.vis > 0,
    'на карте ' + on.drawn + ', в счётчике ' + on.vis);

  const withEdu = await lgd();
  ck('блок «Образование» появился в легенде', /Образование/.test(withEdu), withEdu.slice(0, 140));
  ck('в заголовке блока счётчик совпадает с картой',
    new RegExp('Образование · ' + on.vis).test(withEdu), withEdu.slice(0, 140));

  /* Разбивка по типам: то же, что нарисовано */
  const rows = await pg.evaluate(() => {
    const el = document.getElementById('mlgd');
    const all = [...el.querySelectorAll('.li')];
    const start = all.findIndex(x => /снять фильтр типа/.test(x.textContent)) ;
    return all.filter(x => /lgdFilterEdu/.test(x.getAttribute('onclick') || ''))
      .map(x => ({ txt: x.textContent.trim(),
                   col: (x.querySelector('.dot') || {}).style ? x.querySelector('.dot').style.background : '',
                   onclick: x.getAttribute('onclick') }));
  });
  const expect = Object.keys(on.byType).sort((a, b) => on.byType[b] - on.byType[a]);
  ck('строк по типам столько же, сколько типов на карте',
    rows.filter(r => !/снять фильтр/.test(r.txt)).length === expect.length,
    'в легенде ' + rows.length + ', типов ' + expect.length);
  ck('строки отсортированы по убыванию количества',
    rows.length && /Школа3/.test(rows[0].txt.replace(/\s/g, '')),
    rows.map(r => r.txt.replace(/\s+/g, ' ')).join(' | '));
  ck('названия типов человеческие, не коды',
    /Университет/.test(withEdu) && /Автошкола/.test(withEdu) && !/university|driving/.test(withEdu),
    withEdu.slice(0, 200));

  /* Цвет кружка = цвет точки на карте */
  const colOk = await pg.evaluate(() => {
    const el = document.getElementById('mlgd');
    const li = [...el.querySelectorAll('.li')].find(x => /lgdFilterEdu\('university'\)/.test(x.getAttribute('onclick') || ''));
    if (!li) return { err: 'строки «Университет» нет' };
    const dot = li.querySelector('.dot');
    const c = getComputedStyle(dot).backgroundColor;
    const want = EDU_COL.university;
    const hex = '#' + c.match(/\d+/g).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('');
    return { hex, want: want.toLowerCase() };
  });
  ck('цвет кружка в легенде = цвет типа на карте', colOk.hex === colOk.want,
    colOk.err || (colOk.hex + ' vs ' + colOk.want));

  /* Счётчик «на экране» в шапке легенды учитывает образование */
  const head = await pg.evaluate(() => {
    const h = document.querySelector('#mlgd h4');
    const m = (h ? h.textContent : '').match(/([\d\s ]+) объект/);
    return m ? +m[1].replace(/[\s ]/g, '') : -1;
  });
  ck('общий счётчик учитывает образование', head >= on.vis, 'в шапке ' + head + ', образования ' + on.vis);

  /* Клик по строке = фильтр по типу */
  const filtered = await pg.evaluate(async () => {
    const el = document.getElementById('mlgd');
    const li = [...el.querySelectorAll('.li')].find(x => /lgdFilterEdu\('school'\)/.test(x.getAttribute('onclick') || ''));
    li.click();
    await new Promise(r => setTimeout(r, 500));
    return { sel: document.getElementById('eduT').value, vis: VIS.edu,
             txt: document.getElementById('mlgd').innerText.replace(/\s+/g, ' ') };
  });
  ck('клик по строке ставит фильтр по типу', filtered.sel === 'school', 'фильтр: «' + filtered.sel + '»');
  ck('после фильтра на карте только школы', filtered.vis === 3, 'видно ' + filtered.vis);
  ck('в легенде остался один тип', /Образование · 3/.test(filtered.txt) && !/Автошкола/.test(filtered.txt),
    filtered.txt.slice(0, 160));
  ck('появилась строка снятия фильтра', /снять фильтр типа/.test(filtered.txt));

  const reset = await pg.evaluate(async () => {
    const el = document.getElementById('mlgd');
    const li = [...el.querySelectorAll('.li')].find(x => /снять фильтр типа/.test(x.textContent));
    li.click();
    await new Promise(r => setTimeout(r, 500));
    return { sel: document.getElementById('eduT').value, vis: VIS.edu,
             txt: document.getElementById('mlgd').innerText.replace(/\s+/g, ' ') };
  });
  ck('фильтр снимается кликом', reset.sel === '' && reset.vis === on.vis,
    'фильтр «' + reset.sel + '», видно ' + reset.vis);
  ck('вернулись все типы', /Автошкола/.test(reset.txt) && /Университет/.test(reset.txt));

  /* Раскраска «один цвет» — легенда не должна показывать разноцветные кружки */
  const oneCol = await pg.evaluate(async () => {
    document.getElementById('eduColBy').value = 'fix';
    document.getElementById('eduC').value = '#123456';
    renderEdu();
    await new Promise(r => setTimeout(r, 500));
    const el = document.getElementById('mlgd');
    const dots = [...el.querySelectorAll('.li')].filter(x => /lgdFilterEdu/.test(x.getAttribute('onclick') || ''))
      .map(x => getComputedStyle(x.querySelector('.dot')).backgroundColor);
    return { uniq: [...new Set(dots)], n: dots.length };
  });
  ck('при раскраске «один цвет» легенда тоже одноцветная',
    oneCol.uniq.length === 1 && /18, 52, 86/.test(oneCol.uniq[0]),
    oneCol.uniq.join(' | '));

  /* Медицина и БЦ на месте — ничего не сломали */
  const others = await pg.evaluate(async () => {
    document.getElementById('eduColBy').value = 't';
    ['lBC', 'lMed'].forEach(id => { const c = document.getElementById(id); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 1200));
    return document.getElementById('mlgd').innerText.replace(/\s+/g, ' ');
  });
  ck('медицина и БЦ остались в легенде', /Медицина/.test(others) && /Бизнес-центры/.test(others),
    others.slice(0, 180));
  ck('образование соседствует с ними', /Образование/.test(others), others.slice(0, 220));

  /* Выключили слой — блок ушёл */
  const off = await pg.evaluate(async () => {
    const cb = document.getElementById('lEdu');
    cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    return document.getElementById('mlgd').innerText.replace(/\s+/g, ' ');
  });
  ck('при выключенном слое блока образования нет', !/Образование/.test(off), off.slice(0, 140));
  ck('медицина при этом осталась', /Медицина|Бизнес-центры/.test(off), off.slice(0, 140));

  ck('ошибок сценария за весь прогон нет', errs.length === 0, errs[0] || 'ошибок нет');

  await pg.evaluate(() => { const c = document.getElementById('lEdu'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: path.join(tmp, 'legend.png'), clip: { x: 0, y: 420, width: 420, height: 480 } }).catch(() => {});

  await b.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
