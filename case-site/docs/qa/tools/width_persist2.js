'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const OS_DIR=path.resolve(process.argv[2]||'.');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.geojson':'application/json','.csv':'text/csv'};
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

 async function dragCol(view){
   await page.evaluate(v=>go(v),view);
   await page.waitForTimeout(1200);
   return page.evaluate(async()=>{
     const tb=document.querySelector('#main table.case-grid');
     if(!tb)return {err:'нет таблицы'};
     const key=tb.dataset.caseGridKey||tb.getAttribute('data-tblkey');
     const rzs=[...tb.querySelectorAll('.case-grid-resizer')];
     const rz=rzs.find(r=>r.dataset.caseColId&&r.dataset.caseColId!=='_select')||rzs[0];
     const colId=rz.dataset.caseColId;
     const cg=tb.querySelector('colgroup');
     const col=[...cg.children].find(c=>c.dataset.caseColId===colId);
     const w0=parseFloat(col.style.width);
     const r=rz.getBoundingClientRect();
     rz.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:r.x+3,clientY:r.y+5,bubbles:true,pointerId:7}));
     document.dispatchEvent(new PointerEvent('pointermove',{clientX:r.x+63,clientY:r.y+5,bubbles:true,pointerId:7}));
     document.dispatchEvent(new PointerEvent('pointerup',{clientX:r.x+63,clientY:r.y+5,bubbles:true,pointerId:7}));
     await new Promise(rs=>setTimeout(rs,300));
     const w1=parseFloat(col.style.width);
     let stored=null;
     try{const j=JSON.parse(localStorage.getItem('caseos_grid_prefs_v4322::aziz_shermukhamedov')||'{}');stored=j[key]&&j[key].widths&&j[key].widths[colId];}catch(e){}
     return {view:S.view,key,colId,w0,w1,stored};
   });
 }
 const d1=await dragCol('registry');
 console.log('drag registry:',JSON.stringify(d1));
 const d2=await dragCol('users');
 console.log('drag users:',JSON.stringify(d2));

 async function readCol(view,colId){
   await page.evaluate(v=>go(v),view);
   await page.waitForTimeout(1200);
   return page.evaluate((cid)=>{
     const tb=document.querySelector('#main table.case-grid');
     const cg=tb&&tb.querySelector('colgroup');
     const col=cg&&[...cg.children].find(c=>c.dataset.caseColId===cid);
     return col?parseFloat(col.style.width):null;
   },colId);
 }
 await page.evaluate(()=>go('dash'));await page.waitForTimeout(400);
 console.log('back registry col:',await readCol('registry',d1.colId),'(ожидание',d1.w1,')');
 await page.evaluate(()=>go('dash'));await page.waitForTimeout(400);
 console.log('back users col:',await readCol('users',d2.colId),'(ожидание',d2.w1,')');

 await page.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
 await page.waitForTimeout(500);
 console.log('reload registry col:',await readCol('registry',d1.colId),'(ожидание',d1.w1,')');
 console.log('reload users col:',await readCol('users',d2.colId),'(ожидание',d2.w1,')');
 await browser.close();srv.close();
});
