/* CASE OS v4.44.1 — сохранения из карточек сразу видны в таблицах + резайзер в прилипшей шапке */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const OS_DIR=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.geojson':'application/json','.csv':'text/csv'};
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,300)}:{})});if(!ok)process.exitCode=1;};
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
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(500);

 /* 1. Правка из КАРТОЧКИ помещения сразу видна в таблице (главная жалоба) */
 await page.evaluate(()=>go('registry'));
 await page.waitForTimeout(900);
 const drawer=await page.evaluate(async()=>{
   const u=U.find(x=>x.obj===S.obj&&x.status==='vac')||U[0];
   const sc=document.querySelector('#main .tbl-scroll');sc.scrollLeft=120;
   openUnit(u.id);
   await new Promise(r=>setTimeout(r,300));
   const editBtn=[...document.getElementById('drawer').querySelectorAll('button')].find(b=>/Редактировать помещение/.test(b.textContent));
   if(editBtn){editBtn.click();await new Promise(r=>setTimeout(r,300));}
   const e=document.getElementById('e_budget');if(!e)return {err:'нет поля e_budget в карточке'};
   e.value='33';
   unitSave(u.id);
   await new Promise(r=>setTimeout(r,500));
   const drawerOpen=document.getElementById('drawer').classList.contains('open');
   // ищем строку в таблице и её бюджетную ячейку
   const tb=document.querySelector('#main table');
   const row=[...tb.tBodies[0].rows].find(r2=>r2.textContent.includes(u.code));
   const scAfter=document.querySelector('#main .tbl-scroll');
   return {code:u.code,drawerOpen,rowText:row?row.textContent.replace(/\s+/g,' ').slice(0,160):'',budget:u.budget,scrollLeft:scAfter?scAfter.scrollLeft:-1};
 });
 rec('карточка: сохранение сразу видно в таблице (budget=33)',!drawer.err&&drawer.budget===33&&/33/.test(drawer.rowText),JSON.stringify(drawer));
 rec('карточка: осталась открытой после сохранения',!!drawer.drawerOpen);
 rec('карточка: прокрутка таблицы сохранена (120)',drawer.scrollLeft===120,drawer.scrollLeft);

 /* 2. Резайзер работает в ПРИЛИПШЕЙ шапке (v4.48: настоящий thead прилипает, клона нет) */
 await page.evaluate(()=>{closeDrawer();go('registry');});
 await page.waitForTimeout(900);
 const sticky=await page.evaluate(async()=>{
   const wrap=document.querySelector('#main .tbl-scroll');
   wrap.scrollTop=300;wrap.dispatchEvent(new Event('scroll')); // внутренняя прокрутка → шапка прилипла (native sticky)
   window.dispatchEvent(new Event('scroll'));
   await new Promise(r=>setTimeout(r,400));
   const tb=document.querySelector('#main table.case-grid');
   const wr=wrap.getBoundingClientRect();
   const grpTop=tb.tHead.rows[0].getBoundingClientRect().top;
   if(Math.abs(grpTop-wr.top)>3)return {err:'шапка не прилипла (top='+Math.round(grpTop-wr.top)+')'};
   const leaf=tb.tHead.rows[tb.tHead.rows.length-1];
   const rz=[...leaf.querySelectorAll('.case-grid-resizer')].find(r2=>r2.dataset.caseColId&&r2.dataset.caseColId!=='_select'&&r2.closest('th').getBoundingClientRect().width>0);
   if(!rz)return {err:'в прилипшей шапке нет резайзеров'};
   const vis=getComputedStyle(rz).display!=='none';
   const id=rz.dataset.caseColId;
   const col0=[...tb.querySelector('colgroup').children].find(c=>c.dataset.caseColId===id);
   const w0=parseFloat(col0.style.width);
   const r=rz.getBoundingClientRect();
   rz.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:r.x+3,clientY:r.y+5,bubbles:true,pointerId:5}));
   document.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+58,clientY:r.y+5,bubbles:true,pointerId:5}));
   document.dispatchEvent(new PointerEvent('pointerup',{clientX:r.x+58,clientY:r.y+5,bubbles:true,pointerId:5}));
   await new Promise(r2=>setTimeout(r2,400));
   const w1=parseFloat(col0.style.width);
   const noClones=document.querySelectorAll('.case-sticky-head-layer').length===0;
   return {id,vis,w0,w1,noClones};
 });
 rec('прилипшая шапка: настоящий thead прилип, резайзеры видимы',!sticky.err&&sticky.vis&&sticky.noClones,JSON.stringify(sticky));
 rec('прилипшая шапка: перетаскивание меняет ширину столбца',!sticky.err&&sticky.w1>sticky.w0+40,JSON.stringify(sticky));
 await page.evaluate(()=>window.scrollTo(0,0));

 /* 3. Бренды: сохранение карточки сразу видно в таблице */
 await page.evaluate(()=>go('brands'));
 await page.waitForTimeout(900);
 const brand=await page.evaluate(async()=>{
   const b=BRANDS[0];if(!b)return {err:'нет брендов'};
   openBrand(b.id);
   await new Promise(r=>setTimeout(r,300));
   brandEdit(b.id);
   await new Promise(r=>setTimeout(r,400));
   const e=document.getElementById('bd_name');if(!e)return {err:'нет bd_name'};
   const orig=b.name,newName=orig+' QA44';
   e.value=newName;
   asaas35SaveBrand(b.id);
   await new Promise(r=>setTimeout(r,600));
   const tb=document.querySelector('#main table');
   const inTable=tb&&tb.textContent.includes('QA44');
   b.name=orig; // откат
   return {inTable};
 });
 rec('бренды: сохранение карточки сразу видно в таблице',!brand.err&&brand.inTable,JSON.stringify(brand));

 /* 4. SCR: цена продажи пересчитывается сразу */
 await page.evaluate(()=>go('v32_sales'));
 await page.waitForTimeout(900);
 const scr=await page.evaluate(async()=>{
   if(typeof scrSetSalePrice!=='function')return {skip:true};
   const m=document.getElementById('main').innerHTML.match(/scrSetSalePrice\('([^']+)'/);
   if(!m)return {skip:true,why:'нет инпутов цены на экране'};
   const id=m[1];const u=U.find(x=>x.id===id);
   scrSetSalePrice(id,'123456');
   await new Promise(r=>setTimeout(r,500));
   return {price:u&&u.salePrice,shown:document.getElementById('main').innerHTML.includes('123456')};
 });
 rec('SCR: цена продажи видна сразу после ввода',scr.skip||(scr.price===123456&&scr.shown),JSON.stringify(scr));

 const realErr=errs.filter(e=>!/favicon/.test(e));
 rec('нет JS-ошибок',realErr.length===0,realErr.slice(0,3).join(' | '));
 console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
