/* CASE OS v4.42.2 — единые настройки категорий гео-студии:
   в шапках слоёв нет «голых» контролов; у точечных слоёв полный набор
   (цвет/размер/прозр/подписи/размер подписи/кластеры); кластеры мед/аптек работают. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const OS_DIR=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.geojson':'application/json','.csv':'text/csv'};
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,300)}:{})});if(!ok)process.exitCode=1;};
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
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
 await page.goto(base+'/geoanalytics-studio.html',{waitUntil:'networkidle'});
 await page.waitForTimeout(2500);

 /* 1. в шапках слоёв (.lrow) не осталось контролов без подписи */
 const naked=await page.evaluate(()=>{
   const bad=[];
   document.querySelectorAll('.lrow').forEach(row=>{
     row.querySelectorAll('input').forEach(inp=>{
       const inLabel=!!inp.closest('label');
       const isLayerToggle=/^l[A-Z]/.test(inp.id||'')||/^geoLayer-/.test(inp.id||'');
       if(!inLabel&&!isLayerToggle)bad.push((inp.id||inp.type)+' @ '+row.textContent.trim().slice(0,30));
     });
   });
   return bad;
 });
 rec('шапки слоёв: нет контролов без подписи',naked.length===0,naked.join(' | '));

 /* 2. точечные слои: полный единый набор контролов */
 const sets=await page.evaluate(()=>{
   const $=id=>document.getElementById(id);
   const has=ids=>ids.every(i=>!!$(i));
   return {
     bc:has(['bcNa','bcR','bcO','bcLab','bcLS','bcClu','labZ']),
     med:has(['medC','medR','medO','medLab','medLS','medClu','medLabZ']),
     ph:has(['phC','phR','phO','phLab','phLS','phClu']),
     metro:has(['mC','mW','mO','mLab','mByLine']),
     road:has(['rC','rW','rO','rByLine']),
     dist:has(['dC','dW','dF','dO','dLab']),
     dens:has(['densC','densO']),heat:has(['heatC','heatO','heatR','heatB'])
   };
 });
 for(const k of Object.keys(sets))rec('набор контролов: '+k,sets[k]);

 /* 3. подписи-тумблеры подписаны словом (не голые) */
 const labeled=await page.evaluate(()=>{
   const lb=id=>{const e=document.getElementById(id);const l=e&&e.closest('label');return l?l.textContent.trim():'';};
   return {bcLab:lb('bcLab'),medLab:lb('medLab'),phLab:lb('phLab'),mLab:lb('mLab'),mByLine:lb('mByLine'),rByLine:lb('rByLine'),dLab:lb('dLab'),bcBySrc:lb('bcBySrc'),bcByRent:lb('bcByRent')};
 });
 rec('тумблеры с текстом: подписи/цвет по линии/маршруту/районов',
   /подписи/.test(labeled.bcLab)&&/подписи/.test(labeled.medLab)&&/подписи/.test(labeled.phLab)&&/станц/.test(labeled.mLab)&&/лини/.test(labeled.mByLine)&&/маршрут/.test(labeled.rByLine)&&/район/.test(labeled.dLab)&&/источник/.test(labeled.bcBySrc)&&/ставк/.test(labeled.bcByRent),
   JSON.stringify(labeled));

 /* 4. кластеры медицины и аптек включаются/выключаются без ошибок */
 const clu=await page.evaluate(async()=>{
   const $=id=>document.getElementById(id);
   const out={};
   $('lMed').checked=true;$('lMed').dispatchEvent(new Event('change'));
   await new Promise(r=>setTimeout(r,900));
   out.medPts=(typeof MEDPTS!=='undefined')?MEDPTS.length:-1;
   $('medClu').checked=true;$('medClu').dispatchEvent(new Event('input'));
   await new Promise(r=>setTimeout(r,800));
   out.medWith=document.querySelectorAll('.marker-cluster').length;
   $('medClu').checked=false;$('medClu').dispatchEvent(new Event('input'));
   await new Promise(r=>setTimeout(r,600));
   out.medWithout=document.querySelectorAll('.marker-cluster').length;
   $('lMed').checked=false;$('lMed').dispatchEvent(new Event('change'));
   $('lPharm').checked=true;$('lPharm').dispatchEvent(new Event('change'));
   await new Promise(r=>setTimeout(r,900));
   out.phPts=(typeof PHARM!=='undefined')?PHARM.length:-1;
   $('phClu').checked=true;$('phClu').dispatchEvent(new Event('input'));
   await new Promise(r=>setTimeout(r,800));
   out.phWith=document.querySelectorAll('.marker-cluster').length;
   $('phClu').checked=false;$('phClu').dispatchEvent(new Event('input'));
   await new Promise(r=>setTimeout(r,600));
   out.phWithout=document.querySelectorAll('.marker-cluster').length;
   return out;
 });
 rec('медицина: кластеры вкл/выкл',clu.medPts>0&&clu.medWith>0&&clu.medWithout===0,JSON.stringify(clu));
 rec('аптеки: кластеры вкл/выкл',clu.phPts>0&&clu.phWith>0&&clu.phWithout===0,JSON.stringify(clu));

 /* 5. размер подписи аптек управляет собственным стилем phlab */
 const ph=await page.evaluate(async()=>{
   const $=id=>document.getElementById(id);
   $('lPharm').checked=true;$('lPharm').dispatchEvent(new Event('change'));
   $('phLab').checked=true;$('phLS').value='16';$('phLS').dispatchEvent(new Event('input'));
   await new Promise(r=>setTimeout(r,500));
   const st=document.getElementById('phLabStyle');
   return st?st.textContent:'';
 });
 rec('аптеки: свой размер подписи (phlab 16px)',/phlab\{font-size:16(\.0)?px/.test(ph),ph);

 const realErr=errors.filter(e=>!/favicon|404|Failed to load resource|Invalid API key|yandex/i.test(e));
 rec('нет JS-ошибок',realErr.length===0,realErr.slice(0,3).join(' | '));
 console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
