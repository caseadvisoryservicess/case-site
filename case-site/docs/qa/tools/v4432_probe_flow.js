/* CASE OS v4.43.1 — автo-отчёт по точке проекта при переходе «Аналитика» + PDF-выгрузка */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const OS_DIR=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.geojson':'application/json','.csv':'text/csv'};
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,250)}:{})});if(!ok)process.exitCode=1;};
const srv=http.createServer((req,rsp)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 if(p==='/api/auth.php'){rsp.writeHead(200,{'Content-Type':'application/json'});rsp.end(JSON.stringify({auth:true,user:{id:'u1',name:'QA',role_key:'ASH',admin:true,edit:true},csrf:'t'}));return;}
 if(p==='/api/workspace_access.php'){rsp.writeHead(200,{'Content-Type':'application/json'});rsp.end(JSON.stringify({allowed:true,can_edit:true}));return;}
 if(p.startsWith('/api/')){rsp.writeHead(404);rsp.end('404');return;}
 const f=path.join(OS_DIR,p);
 if(!f.startsWith(OS_DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rsp.writeHead(404);rsp.end('404');return;}
 rsp.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rsp);});
srv.listen(0,'127.0.0.1',async()=>{
 const base='http://127.0.0.1:'+srv.address().port;
 const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1500,height:900}});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(base+'/geoanalytics-studio.html?embedded=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(2500);

 // родитель прислал контекст с probeProjectId (переход «Аналитика» из Карты объектов)
 await page.evaluate(()=>{
   window.postMessage({source:'asaas-os-v4',type:'asaas-geo-context',context:{
     lang:'ru',theme:'light',editable:true,adminEdit:true,external:false,
     projects:[{id:'p1',name:'Тест Плаза',lat:41.315,lng:69.28}],
     activeProjectId:'p1',probeProjectId:'p1'
   }},location.origin);
 });
 await page.waitForTimeout(3500);
 const auto=await page.evaluate(()=>{
   const p=document.getElementById('probe');
   return {open:p&&p.classList.contains('open'),
     hasTitle:p&&/Отчёт по точке/.test(p.textContent),
     hasCoords:p&&/41\.315/.test(p.textContent),
     hasPdfBtn:p&&/Скачать PDF/.test(p.innerHTML),
     hasPop:p&&/Население/.test(p.textContent),
     hasScoring:p&&/Быстрый скоринг/.test(p.textContent)};
 });
 rec('авто-отчёт: панель открылась сама по координатам проекта',auto.open&&auto.hasTitle&&auto.hasCoords,JSON.stringify(auto));
 rec('авто-отчёт: полный состав (население, скоринг)',auto.hasPop&&auto.hasScoring);
 rec('кнопка «Скачать PDF» на месте',auto.hasPdfBtn);

 // PDF: перехватываем window.open и проверяем содержимое печатной версии
 const pdf=await page.evaluate(()=>{
   let html='',printed=false;
   const orig=window.open;
   window.open=function(){return {document:{write:h=>{html+=h;},close:()=>{}},focus:()=>{},print:()=>{printed=true;}};};
   try{exportProbePdf();}finally{window.open=orig;}
   return new Promise(r=>setTimeout(()=>r({len:html.length,
     head:/ASE OS · Геоаналитика локации/.test(html),
     proj:/Тест Плаза/.test(html),
     pop:/Население/.test(html),score:/Быстрый скоринг/.test(html),
     med:/Медицина/.test(html),bc:/Бизнес-центры/.test(html),printed}),700));
 });
 rec('PDF: печатная версия содержит полный отчёт',pdf.head&&pdf.proj&&pdf.pop&&pdf.score&&pdf.med&&pdf.bc,JSON.stringify(pdf));
 rec('PDF: вызван диалог печати (Сохранить как PDF)',pdf.printed);

 // v4.43.2: карта перелетела к проекту
 const center=await page.evaluate(()=>({c:map.getCenter(),z:map.getZoom()}));
 rec('карта перелетела к проекту (центр ~41.315,69.28, зум ≥15)',
   Math.abs(center.c.lat-41.315)<0.01&&Math.abs(center.c.lng-69.28)<0.01&&center.z>=15,JSON.stringify(center));

 // v4.43.2: после закрытия отчёт переоткрывается кнопкой в попапе объекта
 const reopen=await page.evaluate(async()=>{
   closeProbe();
   const closed=!document.getElementById('probe').classList.contains('open');
   geoObjProbe('p1');
   await new Promise(r=>setTimeout(r,900));
   const p=document.getElementById('probe');
   return {closed,reopened:p.classList.contains('open')&&/Отчёт по точке/.test(p.textContent),
     popupHasBtn:/geoObjProbe/.test((typeof geoObjPopup==='function')?'':'')||true};
 });
 rec('отчёт переоткрывается по кнопке «Отчёт по точке» у объекта',reopen.closed&&reopen.reopened,JSON.stringify(reopen));
 const popupBtn=await page.evaluate(()=>{
   const m=(window.geoMarkers&&geoMarkers())||{};const k=Object.keys(m)[0];
   if(!k)return 'нет маркера';
   const html=m[k].getPopup?String(m[k].getPopup().getContent()):'';
   return /Отчёт по точке/.test(html)?'ok':html.slice(0,80);
 });
 rec('в попапе маркера проекта есть кнопка «🎯 Отчёт по точке»',popupBtn==='ok',popupBtn);

 // дедуп: повторный контекст с тем же probeProjectId не открывает панель заново
 await page.evaluate(()=>{closeProbe();window.postMessage({source:'asaas-os-v4',type:'asaas-geo-context',context:{
   lang:'ru',theme:'light',editable:true,adminEdit:true,external:false,
   projects:[{id:'p1',name:'Тест Плаза',lat:41.315,lng:69.28}],activeProjectId:'p1',probeProjectId:'p1'}},location.origin);});
 await page.waitForTimeout(1200);
 const dedup=await page.evaluate(()=>document.getElementById('probe').classList.contains('open'));
 rec('дедуп: повторный контекст не переоткрывает отчёт',!dedup);

 const realErr=errs.filter(e=>!/Invalid API key|yandex/i.test(e));
 rec('нет JS-ошибок',realErr.length===0,realErr.slice(0,3).join('|'));
 console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
