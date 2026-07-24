/* CASE OS v4.42.1 — миграция 4421 (все роли) + предупреждение о rejected_keys */
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
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(500);

 /* сеем обрезанные шаблоны BRJ и HO со схемой 4420 (прошлая миграция уже прошла) */
 await page.evaluate(()=>{ROLE_WORKSPACES={__caseSchema:4420,BRJ:['dash','work_tasks'],HO:['dash','crm_clients']};persist();});
 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(500);
 const healed=await page.evaluate(()=>({schema:ROLE_WORKSPACES.__caseSchema,
   brjGeo:(ROLE_WORKSPACES.BRJ||[]).includes('geoanalytics'),brjBrands:(ROLE_WORKSPACES.BRJ||[]).includes('brands'),
   hoReg:(ROLE_WORKSPACES.HO||[]).includes('registry'),hoLay:(ROLE_WORKSPACES.HO||[]).includes('leasing_layouts'),hoPlanM:(ROLE_WORKSPACES.HO||[]).includes('plan_master')}));
 rec('миграция 4421: BRJ снова с гео и брендами',healed.brjGeo&&healed.brjBrands,JSON.stringify(healed));
 rec('миграция 4421: администратор аренды снова с реестром/ЛСР-разделами',healed.hoReg&&healed.hoLay&&healed.hoPlanM);
 rec('миграция 4421: схема поднята',+healed.schema>=4421,healed.schema);

 /* предупреждение о непринятых сервером ключах */
 const warn=await page.evaluate(async()=>{
   _warnRejectedKeys({rejected_keys:['BRANDS','GEO_DATA','U:L2_5']});
   await new Promise(r=>setTimeout(r,150));
   const t1=[...document.querySelectorAll('#toastBox div')].map(x=>x.textContent);
   _warnRejectedKeys({rejected_keys:['BRANDS']}); /* повтор — не должен спамить */
   await new Promise(r=>setTimeout(r,150));
   const t2=[...document.querySelectorAll('#toastBox div')].map(x=>x.textContent);
   return {t1,t2};
 });
 rec('предупреждение: показывает названия разделов',warn.t1.some(t=>/НЕ сохранено:.*База брендов.*Геоаналитика/.test(t)),JSON.stringify(warn.t1));
 rec('предупреждение: отдельное сообщение про свежие правки помещений',warn.t1.some(t=>/Помещения L2_5/.test(t)));
 rec('предупреждение: повтор того же ключа не спамит',warn.t2.length===warn.t1.length,warn.t2.length+' vs '+warn.t1.length);
 rec('нет JS-ошибок',errs.length===0,errs.slice(0,3).join('|'));
 console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
