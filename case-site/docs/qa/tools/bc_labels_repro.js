'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const OS_DIR=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.geojson':'application/json','.csv':'text/csv'};
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
 await page.goto(base+'/geoanalytics-studio.html',{waitUntil:'networkidle'});
 await page.waitForTimeout(2500);
 const r=await page.evaluate(async()=>{
   const $=id=>document.getElementById(id);
   map.setView([41.31,69.25],14); // Ташкент, z14 (как на скриншоте пользователя)
   await new Promise(r=>setTimeout(r,900));
   const out={z:map.getZoom(),labZ:+$('labZ').value,bcLabChecked:$('bcLab').checked,bcOnScreen:0};
   $('bcLab').checked=true;$('bcLab').dispatchEvent(new Event('input'));
   await new Promise(r=>setTimeout(r,700));
   out.bcOnScreen=(typeof VIS!=='undefined'&&VIS.bc)||0;
   out.tooltips=document.querySelectorAll('.leaflet-tooltip.bclab').length;
   out.labStyle=(document.getElementById('labStyle')||{}).textContent||'';
   // и как у медицины для сравнения
   $('lMed').checked=true;$('lMed').dispatchEvent(new Event('change'));
   await new Promise(r=>setTimeout(r,900));
   out.medTooltips=document.querySelectorAll('.leaflet-tooltip.medlab').length;
   return out;
 });
 console.log(JSON.stringify({r,errs:errs.slice(0,4)},null,1));
 await browser.close();srv.close();
});
