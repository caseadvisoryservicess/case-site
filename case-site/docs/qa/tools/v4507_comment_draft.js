/* v4.50.7: комментарий в реестре — набор не прерывается и ничего не сохраняется само.

   Жалоба: «невозможно вписывать; сохраняет сам по себе и потом не даёт изменить;
   выкидывает с сохранением надписей, которые успели вписать».

   Механика бага: у поля стоял onblur с сохранением; правка любой ячейки перерисовывала
   таблицу; перерисовка уничтожала поле, уничтожение вызывало blur — и недописанный текст
   улетал в комментарии, а комментарии только добавляются, исправить нельзя.

   Проверяем: (1) перерисовка не съедает набранный текст и не сохраняет его;
   (2) потеря фокуса не сохраняет; (3) Enter сохраняет и чистит; (4) фокус и курсор
   возвращаются после перерисовки.

   Запуск: node v4507_comment_draft.js */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.env.CASE_OS_DIR || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const units = [
    { id: 'L1_1', code: 'L1-1', obj: 'ca', floor: '1', area: 100, cat: 'Мода', status: 'vac',
      rate: 10, budget: 7, vars: [], dates: [], hist: [], comments: [] },
    { id: 'L1_2', code: 'L1-2', obj: 'ca', floor: '1', area: 80, cat: 'F&B', status: 'vac',
      rate: 12, budget: 5, vars: [], dates: [], hist: [], comments: [] }
  ];
  const { srv, base, state } = await createMockServer(OS, {
    initialState: { OBJECTS: [{ id: 'ca', name: 'CASE Mall' }], U: units, CHANGES: [], TRASH: [] }
  });

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => { if (typeof go === 'function') go('registry'); });
  await pg.waitForTimeout(1500);

  check('реестр открылся без ошибок', errs.length === 0, errs[0] || 'ошибок нет');

  const hasField = await pg.evaluate(() => !!document.querySelector('input[data-qc="L1_1"]'));
  check('поле комментария на месте', hasField);

  /* 1. Печатаем БЕЗ Enter и вызываем перерисовку (как делает фоновая синхронизация
        или сохранение соседней ячейки) */
  await pg.focus('input[data-qc="L1_1"]');
  await pg.type('input[data-qc="L1_1"]', 'недописанный комм', { delay: 15 });
  const mid = await pg.evaluate(() => {
    renderRegistry();                                     /* перерисовка ПРЯМО во время набора */
    const el = document.querySelector('input[data-qc="L1_1"]');
    return {
      value: el ? el.value : null,
      focused: document.activeElement === el,
      cursor: el ? el.selectionStart : -1,
      saved: (U.find(x => x.id === 'L1_1').comments || []).length
    };
  });
  check('текст пережил перерисовку', mid.value === 'недописанный комм', `в поле: «${mid.value}»`);
  check('фокус вернулся в поле', mid.focused === true);
  check('курсор в конце текста', mid.cursor === 'недописанный комм'.length, 'позиция ' + mid.cursor);
  check('ничего не сохранилось само', mid.saved === 0, 'комментариев: ' + mid.saved);

  /* 2. Потеря фокуса (клик в другое место) не должна сохранять */
  await pg.evaluate(() => {
    const other = document.querySelector('input[data-qc="L1_2"]');
    if (other) other.focus(); else document.body.focus();
  });
  await pg.waitForTimeout(600);
  const afterBlur = await pg.evaluate(() => ({
    saved: (U.find(x => x.id === 'L1_1').comments || []).length,
    draft: (window.REG_CDRAFT || {})['L1_1'] || ''
  }));
  check('потеря фокуса НЕ сохранила огрызок', afterBlur.saved === 0, 'комментариев: ' + afterBlur.saved);
  check('черновик при этом не потерян', afterBlur.draft === 'недописанный комм', `черновик: «${afterBlur.draft}»`);

  /* 3. Возвращаемся, дописываем, Enter — сохраняет и чистит */
  await pg.focus('input[data-qc="L1_1"]');
  await pg.evaluate(() => { const el = document.querySelector('input[data-qc="L1_1"]');
    el.setSelectionRange(el.value.length, el.value.length); });
  await pg.type('input[data-qc="L1_1"]', 'ентарий готов', { delay: 10 });
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(800);
  const done = await pg.evaluate(() => {
    const u = U.find(x => x.id === 'L1_1');
    const el = document.querySelector('input[data-qc="L1_1"]');
    return {
      n: (u.comments || []).length,
      text: u.comments && u.comments.length ? u.comments[u.comments.length - 1][2] : '',
      field: el ? el.value : null,
      draft: (window.REG_CDRAFT || {})['L1_1'] || ''
    };
  });
  check('Enter сохранил комментарий', done.n === 1 && done.text === 'недописанный комментарий готов',
    `сохранено: «${done.text}»`);
  check('после сохранения поле чистое', done.field === '' && done.draft === '',
    `поле «${done.field}», черновик «${done.draft}»`);

  check('ошибок сценария за весь прогон нет', errs.length === 0, errs[0] || 'ошибок нет');

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
