/* CASE OS v4.43.3 — правка в строке LCR сразу пересчитывает итоги (без перезагрузки) */
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
 const page=await browser.newPage({viewport:{width:1700,height:950}});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(500);
 await page.evaluate(()=>go('registry'));
 await page.waitForTimeout(900);
 await page.evaluate(()=>{const b=[...document.querySelectorAll('#main button,#main .btn')].find(x=>/План \/ бюджет/.test(x.textContent||''));if(b)b.click();});
 await page.waitForTimeout(900);
 await page.evaluate(()=>{const b=[...document.querySelectorAll('#main button,#main .btn')].find(x=>/Правка/.test(x.textContent||''));if(b)b.click();});
 await page.waitForTimeout(1000);

 const r=await page.evaluate(async()=>{
   const tr=document.querySelector('#main tr[data-uid]');
   if(!tr)return {err:'нет строки правки'};
   const id=tr.dataset.uid,u=U.find(x=>x.id===id);
   const inp=tr.querySelector('td[data-colkey="b_base"] input');
   if(!inp)return {err:'нет инпута бюджета'};
   const totBefore=tr.querySelector('td[data-colkey="b_tot"]').textContent.trim();
   const totSBefore=tr.querySelector('td[data-colkey="b_tots"]').textContent.trim();
   inp.focus();inp.value='20';
   inp.dispatchEvent(new Event('change',{bubbles:true}));
   await new Promise(r2=>setTimeout(r2,400));
   const tr2=document.querySelector('#main tr[data-uid="'+id+'"]');
   return {area:u.area,budget:u.budget,
     totBefore,totAfter:tr2.querySelector('td[data-colkey="b_tot"]').textContent.trim(),
     totSBefore,totSAfter:tr2.querySelector('td[data-colkey="b_tots"]').textContent.trim(),
     focusTag:document.activeElement?document.activeElement.tagName:'',
     inputStill:tr2.querySelector('td[data-colkey="b_base"] input')===inp};
 });
 const expTot='$'+Math.round(20*r.area).toLocaleString('en-US');
 rec('бюджетная ставка сохранена (u.budget=20)',r.budget===20,JSON.stringify(r));
 rec('«Итого аренда» пересчиталось сразу, без перезагрузки',r.totAfter!==r.totBefore&&/\$/.test(r.totAfter),r.totBefore+' → '+r.totAfter+' (ожидалось '+expTot+')');
 rec('«Итого вкл. обсл.» пересчиталось',r.totSAfter!==r.totSBefore&&/\$/.test(r.totSAfter),r.totSBefore+' → '+r.totSAfter);
 rec('строка не перерисована целиком (инпут тот же, фокус не украден)',r.inputStill,JSON.stringify({inputStill:r.inputStill,focus:r.focusTag}));
 rec('нет JS-ошибок',errs.length===0,errs.slice(0,3).join('|'));
 console.log(JSON.stringify({summary:{pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length},results},null,1));
 await browser.close();srv.close();
});
