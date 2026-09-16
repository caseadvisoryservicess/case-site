/* Гео-ассистент: цикл с моделью через родительское окно.

   Сервер без состояния, инструменты исполняются в браузере, ключ есть только у родителя.
   Значит правильность держится на протоколе из трёх частей, и каждая проверяется тут:

     1. Цикл «модель просит инструмент - студия исполняет - модель продолжает». Модель здесь
        подменена сценарием: первый ход просит два инструмента, второй пересказывает число
        ИЗ РЕЗУЛЬТАТА инструмента и заканчивает. Проверяется, что результаты обоих
        инструментов ушли одним сообщением с верными tool_use_id, что участок, проекты и
        язык дошли до сервера, и что число в пересказе совпало с числом факта.
     2. Отказы: нет ключа (needs_key) - ассистент переходит на локальный разбор и говорит об
        этом; HTTP-ошибка - то же; stop_reason=max_tokens без инструментов - цикл кончается,
        а не крутится.
     3. Настоящий мост в v420-geoanalytics.js: студия открыта внутри index.html (демо), и
        ответ на «status» приходит от настоящего родителя. В демо сервера нет, и мост обязан
        честно ответить «без модели», а команды - исполниться.

   Запуск: NODE_PATH=<...>/node_modules node v4720_assistant_bridge.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let bad = 0;
function ck(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail == null ? '' : ' - ' + detail));
  if (!cond) bad++;
}
const SITE = { lat: 41.3485, lon: 69.3166 };

/* Сценарий «модели». mode переключается тестом. */
const server = { mode: 'ok', requests: [] };
function scriptedModel(body) {
  server.requests.push(body);
  if (server.mode === 'nokey') return { ok: false, needs_key: 'anthropic_api_key', message: 'Ассистент с моделью не настроен: добавьте anthropic_api_key в os/api/config.php. Команды на карте работают и без него.' };
  if (server.mode === 'http429') return { __status: 429, error: 'Слишком много запросов к ассистенту' };
  if (server.mode === 'maxtokens') return { ok: true, stop_reason: 'max_tokens', model: 'scripted', usage: {}, content: [{ type: 'text', text: 'Обрыв по длине.' }] };
  const last = body.messages[body.messages.length - 1];
  const hasResults = last && Array.isArray(last.content) && last.content.some(b => b.type === 'tool_result');
  if (!hasResults) {
    return { ok: true, stop_reason: 'tool_use', model: 'scripted', usage: { input: 10, output: 5 }, content: [
      { type: 'text', text: 'Считаю радиус и население.' },
      { type: 'tool_use', id: 't1', name: 'draw_radius', input: { radii_m: [1000] } },
      { type: 'tool_use', id: 't2', name: 'count_population', input: { radius_m: 1000 } },
    ] };
  }
  const popRes = last.content.find(b => b.tool_use_id === 't2');
  let pop = null; try { pop = JSON.parse(popRes.content).population; } catch (e) {}
  return { ok: true, stop_reason: 'end_turn', model: 'scripted', usage: { input: 20, output: 30 },
    content: [{ type: 'text', text: 'В радиусе 1 км живёт около ' + pop + ' человек (расчёт по сетке, не факт).' }] };
}

/* Хост-страница, изображающая родителя: тот же протокол сообщений, что в v420-geoanalytics.js,
   но fetch к assistant.php вместо apiPOST (у теста нет CSRF). */
const HOST_HTML = `<!doctype html><html><body style="margin:0"><iframe id="geoFrame" src="geoanalytics-studio.html?embedded=1" style="width:1400px;height:900px;border:0"></iframe>
<script>
window.__bridgeLog=[];
window.addEventListener('message',async function(e){
  if(!e.data||e.data.source!=='asaas-geo-v42')return;
  var fr=document.getElementById('geoFrame');
  if(e.data.type==='asaas-geo-ready'){
    fr.contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-geo-context',context:{lang:'ru',theme:'light',editable:true,adminEdit:true,external:false,
      projects:[{id:'p1',name:'Тест Плаза',lat:${SITE.lat},lng:${SITE.lon}}],activeProjectId:'p1'}},location.origin);
    return;
  }
  if(e.data.type!=='asaas-geo-assistant')return;
  window.__bridgeLog.push(e.data.action);
  try{
    var j;
    if(e.data.action==='status')j={ok:true,configured:true,model:'scripted'};
    else if(e.data.action==='chat'){var r=await fetch('api/assistant.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e.data.payload)});j=await r.json();if(!r.ok)throw new Error(j.error||('HTTP '+r.status));}
    else throw new Error('неизвестное действие');
    fr.contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-geo-assistant-reply',reqId:e.data.reqId,ok:true,data:j},location.origin);
  }catch(err){fr.contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-geo-assistant-reply',reqId:e.data.reqId,ok:false,error:String(err&&err.message||err)},location.origin);}
});
</script></body></html>`;

const srv = http.createServer((q, r) => {
  const url = new URL(q.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/host.html') { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(HOST_HTML); return; }
  if (p === '/api/assistant.php' && q.method === 'POST') {
    let b = ''; q.on('data', c => b += c); q.on('end', () => {
      let body = {}; try { body = JSON.parse(b || '{}'); } catch (e) {}
      const out = scriptedModel(body);
      r.writeHead(out.__status || 200, { 'Content-Type': 'application/json' }); delete out.__status; r.end(JSON.stringify(out));
    });
    return;
  }
  /* Вход подтверждается только студии (по Referer): index.html в разделе 3 должен остаться в
     демо-режиме без сервера, а студия внутри него - пройти свою проверку доступа. */
  const fromStudio = /geoanalytics-studio/.test(String(q.headers.referer || ''));
  if (p === '/api/auth.php' && fromStudio) { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ auth: true, user: { id: 'u1', name: 'QA', role_key: 'ASH', admin: true, edit: true }, csrf: 't' })); return; }
  if (p === '/api/workspace_access.php' && fromStudio) { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ allowed: true, can_edit: true })); return; }
  if (p.startsWith('/api/')) { r.writeHead(404); r.end('{}'); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (/\.png|tiles?|\/vt\//i.test(u)) return route.fulfill({ status: 200, contentType: 'image/png', body: TILE });
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  console.log('--- 1. Цикл с моделью (сценарий)');
  await page.goto(base + '/host.html', { waitUntil: 'domcontentloaded' });
  const frame = async () => { for (let i = 0; i < 60; i++) { const f = page.frames().find(x => /geoanalytics-studio/.test(x.url())); if (f) { try { /* Возвращать нужно булево: объект карты Leaflet не сериализуется, и evaluate бросал бы исключение. */ if (await f.evaluate(() => !!(window.CASE_GEO_ASSIST && typeof map !== 'undefined' && map))) return f; } catch (e) {} } await page.waitForTimeout(500); } throw new Error('студия не поднялась'); };
  const fr = await frame();
  await page.waitForTimeout(3000);

  const loop = await fr.evaluate(async () => {
    const A = CASE_GEO_ASSIST;
    await A.ask('сколько людей живёт в километре отсюда?');
    const log = document.getElementById('gaLog');
    const ai = [...log.querySelectorAll('.ga-ai')].map(x => x.textContent);
    const num = (log.querySelector('.ga-msg.ga-fact .ga-num') || {}).textContent;
    const facts = log.querySelectorAll('.ga-msg.ga-fact').length;
    let circles = 0; if (A.state.groups.radius) A.state.groups.radius.eachLayer(() => circles++);
    return { ai, num, facts, circles, transcript: A.state.transcript.length, roles: A.state.transcript.map(m => m.role).join(','), configured: A.state.llm.configured };
  });
  ck('статус модели получен от родителя: настроена', loop.configured === true);
  ck('два хода модели: текст первого и пересказ второго', loop.ai.length === 2 && /Считаю/.test(loop.ai[0]) && /живёт около/.test(loop.ai[1]), JSON.stringify(loop.ai));
  ck('оба инструмента исполнены: круг нарисован, факт населения показан', loop.circles === 1 && loop.facts === 2, JSON.stringify({ circles: loop.circles, facts: loop.facts }));
  const numFromFact = (loop.num || '').replace(/\s| /g, '');
  const numFromAi = ((loop.ai[1] || '').match(/около (\d+)/) || [])[1] || '';
  ck('число в пересказе модели равно числу факта (число пришло из инструмента, не из головы)', numFromFact !== '' && numFromFact === numFromAi, `${numFromFact} против ${numFromAi}`);
  ck('транскрипт: user, assistant, user(результаты), assistant', loop.roles === 'user,assistant,user,assistant', loop.roles);

  const req2 = server.requests[1] || {};
  const lastMsg = req2.messages ? req2.messages[req2.messages.length - 1] : null;
  ck('сервер получил два запроса', server.requests.length === 2, String(server.requests.length));
  ck('участок ушёл на сервер', req2.site && Math.abs(req2.site.lat - SITE.lat) < 1e-6, JSON.stringify(req2.site));
  ck('проекты и язык ушли на сервер', Array.isArray(req2.projects) && req2.projects[0].id === 'p1' && req2.lang === 'ru');
  ck('результаты обоих инструментов в ОДНОМ сообщении user с верными id', !!lastMsg && lastMsg.role === 'user' && lastMsg.content.length === 2 && lastMsg.content.map(b => b.tool_use_id).join() === 't1,t2' && lastMsg.content.every(b => b.type === 'tool_result'), JSON.stringify(lastMsg && lastMsg.content.map(b => b.type + ':' + b.tool_use_id)));
  const popResult = lastMsg ? JSON.parse(lastMsg.content[1].content) : {};
  ck('результат инструмента несёт происхождение (уверенность и метод)', popResult.provenance && popResult.provenance.conf === 'modelled' && /долей площади/.test(popResult.provenance.method), JSON.stringify(popResult.provenance || {}).slice(0, 120));
  ck('ассистент ушёл в историю первым сообщением user, а не assistant', req2.messages[0].role === 'user');

  console.log('\n--- 2. Отказы');
  server.mode = 'nokey';
  const nokey = await fr.evaluate(async () => {
    const A = CASE_GEO_ASSIST; A.state.transcript = []; A.state.llm.checked = false; A.state.llm.noted = false;
    const before = document.querySelectorAll('#gaLog .ga-msg').length;
    await A.ask('радиус 500 м');
    const msgs = [...document.querySelectorAll('#gaLog .ga-msg')].slice(before).map(x => x.className.replace('ga-msg ', '') + ':' + x.textContent.slice(0, 60));
    let circles = 0; A.state.groups.radius.eachLayer(() => circles++);
    return { msgs, circles, transcript: A.state.transcript.length };
  });
  ck('без ключа: сказано об этом и команда исполнена локально', nokey.msgs.some(m => /ga-sys:.*anthropic_api_key/.test(m)) && nokey.msgs.some(m => /^ga-fact/.test(m)) && nokey.circles === 1, JSON.stringify(nokey.msgs));
  ck('без ключа транскрипт не растёт (нечего продолжать)', nokey.transcript === 0, String(nokey.transcript));

  server.mode = 'http429';
  const err429 = await fr.evaluate(async () => {
    const A = CASE_GEO_ASSIST; A.state.transcript = []; A.state.llm.checked = false; A.state.llm.configured = false;
    const before = document.querySelectorAll('#gaLog .ga-msg').length;
    await A.ask('население 1 км');
    return [...document.querySelectorAll('#gaLog .ga-msg')].slice(before).map(x => x.className.replace('ga-msg ', '') + ':' + x.textContent.slice(0, 70));
  });
  ck('ошибка HTTP: показана и команда всё равно исполнена локально', err429.some(m => /^ga-err:Модель/.test(m)) && err429.some(m => /^ga-fact/.test(m) && /жителей/.test(m)), JSON.stringify(err429));

  server.mode = 'maxtokens';
  const mt = await fr.evaluate(async () => {
    const A = CASE_GEO_ASSIST; A.state.transcript = []; A.state.llm.checked = false; A.state.llm.configured = false;
    const before = document.querySelectorAll('#gaLog .ga-msg').length;
    await A.ask('что-нибудь');
    return { msgs: [...document.querySelectorAll('#gaLog .ga-msg')].slice(before).map(x => x.className.replace('ga-msg ', '')), t: A.state.transcript.length };
  });
  ck('обрыв по длине без инструментов: один ход, цикл не крутится', mt.msgs.filter(c => c === 'ga-ai').length === 1 && mt.t === 2, JSON.stringify(mt));
  ck('за все сценарии сервер получил не больше пяти запросов', server.requests.length <= 5, String(server.requests.length));

  console.log('\n--- 3. Настоящий мост родителя в демо CASE OS');
  server.mode = 'ok';
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#luser', { timeout: 20000 });
  await page.evaluate(() => { document.getElementById('luser').value = 'ASH'; doLogin(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => go('geoanalytics'));
  const fr2 = await frame();
  await page.waitForTimeout(3500);
  const demo = await fr2.evaluate(async () => {
    const A = CASE_GEO_ASSIST;
    await A.ask('радиус 1 км и население 1 км');
    const log = document.getElementById('gaLog');
    return { sys: [...log.querySelectorAll('.ga-sys')].map(x => x.textContent).join(' | '), facts: log.querySelectorAll('.ga-msg.ga-fact').length,
      configured: A.state.llm.configured, checked: A.state.llm.checked, hasNum: !!log.querySelector('.ga-num') };
  });
  ck('настоящий родитель ответил на status: модель не настроена (демо)', demo.checked === true && demo.configured === false);
  ck('сказано, что это демо и команды идут без модели', /Демо/.test(demo.sys), demo.sys);
  ck('команды исполнены через настоящую студию внутри CASE OS', demo.facts === 2 && demo.hasNum, String(demo.facts));
  const bridgeSrc = fs.readFileSync(path.join(OS_DIR, 'v420-geoanalytics.js'), 'utf8');
  ck('мост родителя ходит в assistant.php через apiPOST (с CSRF), а не голым fetch', /apiPOST\('assistant\.php',payload\)/.test(bridgeSrc) && !/fetch\([^)]*assistant\.php/.test(bridgeSrc));
  ck('мост отвечает на тот же reqId', /reqId:reqId/.test(bridgeSrc));

  ck('ошибок страницы за прогон нет', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close(); srv.close();
  console.log('\n' + (bad ? `ПРОВАЛЕНО проверок: ${bad}\n` : 'Мост и цикл гео-ассистента ведут себя верно\n'));
  process.exit(bad ? 1 : 0);
});
