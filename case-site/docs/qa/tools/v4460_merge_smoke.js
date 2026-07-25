/* v4.46.0 — смоук слияния: owner-report кнопки, ux-system активен, fail-closed BRJ/AGX, BSH read-only */
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
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(700);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(700);

 const sys=await page.evaluate(()=>({
   ux:typeof caseStrictCanOpen==='function'&&typeof caseCanEditRegistry==='function',
   ownerFns:typeof caseCanOwnerReport==='function',
   css:!!document.getElementById('case4450-css'),
   ownerKey:Array.isArray(OWNER_REPORTS)}));
 rec('ux-system активен (guard, css, функции)',sys.ux&&sys.css,JSON.stringify(sys));
 rec('owner-report: ключ OWNER_REPORTS и права',sys.ownerKey&&sys.ownerFns);

 // кнопка отчёта владельцу на экране проектов
 await page.evaluate(()=>go('case_projects'));
 await page.waitForTimeout(1200);
 const orBtn=await page.evaluate(()=>{
   const b=[...document.querySelectorAll('#main button,#main .btn')].find(x=>/Отчёт собственнику|Отчёт владельцу|owner/i.test(x.textContent||''));
   return b?b.textContent.trim():null;
 });
 rec('кнопка «Отчёт собственнику» внедрена на экран проектов',!!orBtn,orBtn||'нет');
 let orOpen=null;
 if(orBtn){
   orOpen=await page.evaluate(async()=>{
     const b=[...document.querySelectorAll('#main button,#main .btn')].find(x=>/Отчёт собственнику|Отчёт владельцу/i.test(x.textContent||''));
     b.click();await new Promise(r=>setTimeout(r,900));
     const m=document.getElementById('caseOwnerReport');
     return {open:!!m,text:m?m.textContent.slice(0,120):''};
   });
   rec('отчёт собственнику открывается',!!(orOpen&&orOpen.open),JSON.stringify(orOpen));
   await page.evaluate(()=>{try{caseOwnerReportClose();}catch(e){}});
 }

 // BRJ: fail-closed — реестр недоступен даже через go()
 await page.evaluate(()=>{logout();});
 await page.waitForTimeout(500);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='BRJ';doLogin();});
 await page.waitForTimeout(700);
 const brj=await page.evaluate(async()=>{
   const menu=[...document.querySelectorAll('#nav a[data-v]')].map(a=>a.dataset.v);
   go('registry');await new Promise(r=>setTimeout(r,500));
   const denied=!!document.querySelector('#main .case-access-denied')||S.view!=='registry';
   return {menu,denied,view:S.view};
 });
 rec('BRJ: меню без ЛСР/проектов, с гео и брендами',brj.menu.includes('brands')&&brj.menu.includes('geoanalytics')&&!brj.menu.includes('registry')&&!brj.menu.includes('case_projects'),brj.menu.join(','));
 rec('BRJ: прямой go(registry) закрыт (fail-closed)',brj.denied,JSON.stringify({view:brj.view}));

 // BSH: реестр виден, но read-only
 await page.evaluate(()=>{logout();});
 await page.waitForTimeout(400);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='BSH';doLogin();});
 await page.waitForTimeout(700);
 const bsh=await page.evaluate(async()=>{
   go('registry');await new Promise(r=>setTimeout(r,700));
   return {view:S.view,canEdit:typeof caseCanEditRegistry==='function'?caseCanEditRegistry():null,
     roBadge:!!document.querySelector('#main .case-ui-readonly'),
     editBtn:!![...document.querySelectorAll('#main button')].find(b=>/Правка/.test(b.textContent))};
 });
 rec('BSH: реестр открывается только для просмотра',bsh.view==='registry'&&bsh.canEdit===false,JSON.stringify(bsh));

 const realErr=errs.filter(e=>!/favicon/.test(e));
 rec('нет JS-ошибок',realErr.length===0,realErr.slice(0,3).join(' | '));
 console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
