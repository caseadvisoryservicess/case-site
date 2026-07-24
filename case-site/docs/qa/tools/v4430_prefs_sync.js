/* CASE OS v4.43.0 — серверное per-user хранение настроек таблиц (api/user_prefs.php мокается) */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const OS_DIR=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.geojson':'application/json','.csv':'text/csv'};
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,250)}:{})});if(!ok)process.exitCode=1;};
const srv=http.createServer((req,rsp)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 if(p.startsWith('/api/')){rsp.writeHead(404);rsp.end('404');return;}
 const f=path.join(OS_DIR,p);
 if(!f.startsWith(OS_DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rsp.writeHead(404);rsp.end('404');return;}
 rsp.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rsp);});
srv.listen(0,'127.0.0.1',async()=>{
 const base='http://127.0.0.1:'+srv.address().port;
 const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1500,height:900}});
 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(500);

 // «сервер» настроек в памяти страницы + стаб api для user_prefs.php
 async function armStubs(seed){
   await page.evaluate((seedData)=>{
     window.__prefsSrv=seedData||{};window.__pushes=[];
     const oG=window.apiGET,oP=window.apiPOST;
     window.apiGET=function(p){if(String(p).indexOf('user_prefs.php')===0)return Promise.resolve({data:window.__prefsSrv});return oG.apply(this,arguments);};
     window.apiPOST=function(p,d){if(String(p).indexOf('user_prefs.php')===0){window.__prefsSrv=d.data;window.__pushes.push(JSON.parse(JSON.stringify(d.data)));return Promise.resolve({ok:true});}
       if(String(p).indexOf('state.php')===0)return Promise.resolve({ok:true,revision:1}); // не шумим в статике
       return oP.apply(this,arguments);};
     BACKEND=true; // включаем серверный путь синхронизации
   },seed);
 }

 // 1) на «сервере» лежат настройки пользователя: ширина code=300 в реестре
 await armStubs({reg_units:{widths:{code:300},_layoutModel:'4322',_pinModel:'4322'}});
 await page.evaluate(()=>go('registry'));
 await page.waitForTimeout(1500);
 const pulled=await page.evaluate(()=>{
   const tb=document.querySelector('#main table.case-grid');
   const col=[...tb.querySelector('colgroup').children].find(c=>c.dataset.caseColId==='code');
   return parseFloat(col.style.width);
 });
 rec('pull: серверная ширина применилась (code=300)',pulled===300,pulled);

 // 2) правка ширины уезжает на «сервер» (debounce 800мс)
 await page.evaluate(async()=>{
   const tb=document.querySelector('#main table.case-grid');
   const rz=[...tb.querySelectorAll('.case-grid-resizer')].find(r=>r.dataset.caseColId==='code');
   const r=rz.getBoundingClientRect();
   rz.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:r.x+3,clientY:r.y+5,bubbles:true,pointerId:9}));
   document.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x-80,clientY:r.y+5,bubbles:true,pointerId:9}));
   document.dispatchEvent(new PointerEvent('pointerup',{clientX:r.x-80,clientY:r.y+5,bubbles:true,pointerId:9}));
 });
 await page.waitForTimeout(1400);
 const pushed=await page.evaluate(()=>{
   const tb=document.querySelector('#main table.case-grid');
   const col=[...tb.querySelector('colgroup').children].find(c=>c.dataset.caseColId==='code');
   return {n:window.__pushes.length,w:window.__prefsSrv&&window.__prefsSrv.reg_units&&window.__prefsSrv.reg_units.widths&&window.__prefsSrv.reg_units.widths.code,actual:parseFloat(col.style.width)};
 });
 rec('push: изменение ширины сохранено на сервере',pushed.n>=1&&pushed.w===pushed.actual&&pushed.w<300,JSON.stringify(pushed));

 // 3) «другое устройство»: чистый localStorage, но сервер отдаёт сохранённое
 const srvSnapshot=await page.evaluate(()=>window.__prefsSrv);
 await page.evaluate(()=>{Object.keys(localStorage).filter(k=>k.includes('caseos_grid_prefs')).forEach(k=>localStorage.removeItem(k));});
 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(400);
 await armStubs(srvSnapshot);
 await page.evaluate(()=>go('registry'));
 await page.waitForTimeout(1500);
 const other=await page.evaluate(()=>{
   const tb=document.querySelector('#main table.case-grid');
   const col=[...tb.querySelector('colgroup').children].find(c=>c.dataset.caseColId==='code');
   return parseFloat(col.style.width);
 });
 const expected=await page.evaluate(()=>null); // ширина берётся из snapshot сервера
 rec('другое устройство: ширина восстановлена с сервера',other===(srvSnapshot.reg_units.widths.code),other+' vs '+srvSnapshot.reg_units.widths.code);

 console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
