/* CASE OS v4.49.1 — сворачивание групп «Бюджет»/«Факт» в ЛСР.
   Регресс: кнопка группы сворачивала лишние столбцы (Варианты/Брокер/Комментарий пропадали),
   потому что старое правило убирало ячейки через display:none, а грид дополнительно схлопывал
   их колонки — оставшиеся ячейки съезжали на обнулённые слоты.
   Запуск: node v4491_groups.js /path/to/os */
'use strict';
const { chromium } = require('playwright-core');
const path=require('path'),fs=require('fs'),http=require('http');
const OS_DIR=path.resolve(process.argv[2]||'.');
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,300)}:{})});if(!ok)process.exitCode=1;};
const M={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.geojson':'application/json','.csv':'text/csv','.xlsx':'application/octet-stream'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';if(p.startsWith('/api/')){r.writeHead(404);r.end();return;}const f=path.join(OS_DIR,p);if(!f.startsWith(OS_DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
srv.listen(0,'127.0.0.1',async()=>{
  const base='http://127.0.0.1:'+srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const p=await b.newPage({viewport:{width:1800,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});await p.waitForTimeout(800);
  await p.evaluate(()=>{document.getElementById('luser').value='ASH';doLogin();});await p.waitForTimeout(600);
  await p.evaluate(()=>go('registry'));await p.waitForTimeout(1200);
  const keys=()=>p.evaluate(()=>{const tb=document.querySelector('#main table.case-grid');
    const leaf=tb.tHead.rows[tb.tHead.rows.length-1];
    return [...leaf.cells].filter(c=>c.getBoundingClientRect().width>0.5).map(c=>c.getAttribute('data-colkey')||'?');});
  const TAIL=['vars','broker','comment','status'];
  const base0=await keys();
  rec('исходно: все столбцы видны (22)', base0.length===22, base0.length);

  await p.evaluate(()=>regToggleGrp('fac'));await p.waitForTimeout(1000);
  const fac=await keys();
  rec('«Факт»: свёрнуты только 5 столбцов группы', fac.length===base0.length-5, `${base0.length}→${fac.length}`);
  rec('«Факт»: сводный столбец f_tots остался', fac.includes('f_tots'), fac.filter(k=>/^f_/.test(k)).join(','));
  rec('«Факт»: хвост (Варианты/Брокер/Комментарий/Статус) на месте', TAIL.every(k=>fac.includes(k)), TAIL.filter(k=>!fac.includes(k)).join(',')||'все на месте');
  rec('«Факт»: столбцы Бюджета не тронуты', fac.filter(k=>/^b_/.test(k)).length===6, fac.filter(k=>/^b_/.test(k)).length);

  await p.evaluate(()=>regToggleGrp('fac'));await p.waitForTimeout(900);
  await p.evaluate(()=>regToggleGrp('bud'));await p.waitForTimeout(1000);
  const bud=await keys();
  rec('«Бюджет»: свёрнуты только 5 столбцов группы', bud.length===base0.length-5, `${base0.length}→${bud.length}`);
  rec('«Бюджет»: сводный столбец b_tots остался', bud.includes('b_tots'), bud.filter(k=>/^b_/.test(k)).join(','));
  rec('«Бюджет»: хвост на месте', TAIL.every(k=>bud.includes(k)), TAIL.filter(k=>!bud.includes(k)).join(',')||'все на месте');
  rec('«Бюджет»: столбцы Факта не тронуты', bud.filter(k=>/^f_/.test(k)).length===6, bud.filter(k=>/^f_/.test(k)).length);

  await p.evaluate(()=>regToggleGrp('fac'));await p.waitForTimeout(1000);
  const both=await keys();
  rec('обе группы разом: свёрнуто 10 столбцов', both.length===base0.length-10, `${base0.length}→${both.length}`);
  rec('обе группы: хвост на месте', TAIL.every(k=>both.includes(k)), TAIL.filter(k=>!both.includes(k)).join(',')||'все на месте');
  const hdr=await p.evaluate(()=>{const tb=document.querySelector('#main table.case-grid');
    const g=tb.tHead.rows[0],leaf=tb.tHead.rows[tb.tHead.rows.length-1];
    const sum=[...g.cells].filter(c=>getComputedStyle(c).display!=='none').reduce((n,c)=>n+c.colSpan,0);
    const leafN=[...leaf.cells].filter(c=>getComputedStyle(c).display!=='none').length;
    return {групповойРяд:sum,рядКолонок:leafN};});
  rec('шапка согласована: ширина группового ряда = числу колонок', hdr.групповойРяд===hdr.рядКолонок, JSON.stringify(hdr));

  await p.evaluate(()=>{regToggleGrp('fac');regToggleGrp('bud');});await p.waitForTimeout(1100);
  const back=await keys();
  rec('разворот обратно: снова 22 столбца', back.length===base0.length, `${back.length}`);
  rec('нет JS-ошибок', errs.filter(e=>!/favicon/.test(e)).length===0, errs.slice(0,2).join(' | '));
  console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
  await b.close();srv.close();
});
