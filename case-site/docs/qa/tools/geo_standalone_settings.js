/* Проверка обновлённой геоаналитики: настройки подписаны, данные не потеряны.

   Главный риск — правки БЦ хранятся в localStorage по ИНДЕКСУ в массиве BC
   (BC.forEach((b,i)=>b.id=i)). Если массив сдвинется, правки молча прилипнут
   к чужим БЦ. Поэтому сначала кладём в хранилище «старые» правки, потом грузим
   новый файл и проверяем, что они на своих местах.

   Запуск: node geo_test.js [файл.html] */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const html = fs.readFileSync(FILE, 'utf8');
  const srv = http.createServer((rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    rs.end(html);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  /* «Старые» данные пользователя: правки двух БЦ и свёрнутые секции */
  await pg.addInitScript(() => {
    localStorage.setItem('caseos_bc_edits', JSON.stringify({
      0: { comment: 'МЕТКА-ПРОВЕРКИ-НОЛЬ', rent: '25' },
      7: { comment: 'МЕТКА-ПРОВЕРКИ-СЕМЬ' }
    }));
    localStorage.setItem('caseos_panel', JSON.stringify({ s0: 0, s1: 1, s2: 0, s3: 1, s4: 1, s5: 1, s6: 1 }));
  });

  await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);

  const real = errs.filter(e => !/leaflet|L is not defined|Failed to fetch|net::/i.test(e));
  check('страница загрузилась без ошибок сценария', real.length === 0, real[0] || 'ошибок нет');

  /* 1. Данные на месте и привязаны к тем же БЦ */
  const data = await pg.evaluate(() => {
    const e0 = eff(BC[0]), e7 = eff(BC[7]);
    return { n0: BC[0].name, c0: e0.comment, r0: e0.rent, n7: BC[7].name, c7: e7.comment,
             saved: localStorage.getItem('caseos_bc_edits') };
  });
  check('правка первого БЦ на месте', data.c0 === 'МЕТКА-ПРОВЕРКИ-НОЛЬ' && data.r0 === '25',
    `${data.n0}: «${data.c0}», ставка ${data.r0}`);
  check('правка восьмого БЦ на месте', data.c7 === 'МЕТКА-ПРОВЕРКИ-СЕМЬ', `${data.n7}: «${data.c7}»`);
  check('хранилище не перезаписано при загрузке', /МЕТКА-ПРОВЕРКИ-НОЛЬ/.test(data.saved || ''));

  /* 2. Состояние свёрнутых секций восстановилось */
  const sect = await pg.evaluate(() => {
    const s = [...document.querySelectorAll('#left .sect, .left .sect, .sect')];
    return { total: s.length, closed: s.map(x => x.classList.contains('closed') ? 0 : 1) };
  });
  check('число секций прежнее (состояние сворачивания хранится по номеру)', sect.total === 7,
    'секций ' + sect.total);
  check('свёрнутость восстановлена из сохранённой', sect.closed[0] === 0 && sect.closed[2] === 0 && sect.closed[1] === 1,
    'по секциям: ' + sect.closed.join(','));

  /* 3. В шапках слоёв не осталось неподписанных контролов */
  const bare = await pg.evaluate(() => {
    const out = [];
    document.querySelectorAll('.lrow').forEach(r => {
      [...r.children].forEach(c => {
        if (c.tagName === 'INPUT' && !(c.type === 'checkbox' && /^l[A-Z]/.test(c.id))) out.push(c.id || c.type);
      });
    });
    return out;
  });
  check('в шапках слоёв нет неподписанных контролов', bare.length === 0, bare.join(', ') || 'ни одного');

  /* 4. Перенесённые контролы доступны и подписаны */
  const moved = ['bcNa', 'bcLab', 'mLab', 'rByLine', 'medC', 'medR', 'phC', 'dLab', 'densC', 'densO', 'heatC', 'heatO'];
  const lbl = await pg.evaluate(ids => ids.map(id => {
    const el = document.getElementById(id);
    if (!el) return { id, err: 'нет элемента' };
    const l = document.querySelector('label[for="' + id + '"]');
    const box = el.closest('.lopts');
    return { id, label: l ? l.textContent.trim() : null, inGear: !!box };
  }), moved);
  const noLabel = lbl.filter(x => !x.label);
  check('у каждого перенесённого контрола есть подпись', noLabel.length === 0,
    noLabel.length ? noLabel.map(x => x.id).join(', ') : lbl.map(x => `${x.id}:«${x.label}»`).slice(0, 4).join(' '));
  const notInGear = lbl.filter(x => !x.inGear);
  check('контролы убраны под шестерёнку слоя', notInGear.length === 0,
    notInGear.length ? notInGear.map(x => x.id).join(', ') : 'все ' + lbl.length);

  /* 5. Шестерёнка открывает панель */
  const gear = await pg.evaluate(() => {
    const bc = document.getElementById('lBC');
    const row = bc.closest('.lrow');
    const g = row.querySelector('.gear');
    if (!g) return { err: 'нет шестерёнки' };
    const box = row.nextElementSibling;
    const before = box.classList.contains('hidden');
    g.click();
    const after = box.classList.contains('hidden');
    return { before, after, has: box.contains(document.getElementById('bcNa')) };
  });
  check('шестерёнка раскрывает настройки слоя', gear.before === true && gear.after === false && gear.has,
    JSON.stringify(gear));

  /* 6. Контролы по-прежнему работают (обработчики привязаны по id) */
  const works = await pg.evaluate(() => {
    const before = document.getElementById('bcNa').value;
    const el = document.getElementById('bcNa');
    el.value = '#123456';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return { before, after: document.getElementById('bcNa').value };
  });
  check('изменение контрола не роняет отрисовку', works.after === '#123456' && errs.filter(e => !/leaflet|L is not defined/i.test(e)).length === 0,
    `цвет ${works.before} → ${works.after}`);

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
