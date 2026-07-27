'use strict';
const { chromium } = require('playwright-core');
const path=require('path'),fs=require('fs'),http=require('http');
const OS=path.resolve(process.argv[2]);
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,200)}:{})});if(!ok)process.exitCode=1;};
const M={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.geojson':'application/json','.csv':'text/csv','.xlsx':'application/octet-stream'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';if(p.startsWith('/api/')){r.writeHead(404);r.end();return;}const f=path.join(OS,p);if(!f.startsWith(OS)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
srv.listen(0,'127.0.0.1',async()=>{
  const base='http://127.0.0.1:'+srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const p=await b.newPage({viewport:{width:1600,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'/index.html?demo=1',{waitUntil:'networkidle'});await p.waitForTimeout(800);
  await p.evaluate(()=>{document.getElementById('luser').value='ASH';doLogin();});await p.waitForTimeout(600);
  await p.evaluate(()=>go('registry'));await p.waitForTimeout(900);
  const prep=await p.evaluate(()=>{const u=U.find(x=>x.obj===S.obj)||U[0];
    u.vars=['Pottery Barn','Black Door','Podushechnaya','English Home','Lemana Pro'];return {id:u.id,n:u.vars.length};});
  rec('подготовка: у помещения 5 вариантов', prep.n===5, prep.n);

  // 1) выбор подсказки заменил всё одним брендом → сотрудник соглашается ДОБАВИТЬ
  const add=await p.evaluate(async id=>{window.confirm=()=>true;
    saveVarsLive(id,'Zara'); await new Promise(r=>setTimeout(r,400));
    const u=U.find(x=>x.id===id);return {n:u.vars.length,список:u.vars.join(', ')};},prep.id);
  rec('подбор не стирает список: 5 прежних + новый = 6', add.n===6&&/Pottery Barn/.test(add.список)&&/Zara/.test(add.список), JSON.stringify(add));

  // 2) сотрудник осознанно заменяет список
  const repl=await p.evaluate(async id=>{window.confirm=()=>false;
    saveVarsLive(id,'Zara'); await new Promise(r=>setTimeout(r,400));
    const u=U.find(x=>x.id===id);return {n:u.vars.length,список:u.vars.join(', ')};},prep.id);
  rec('осознанная замена работает (остался 1)', repl.n===1&&repl.список==='Zara', JSON.stringify(repl));

  // 3) обычные правки без вопросов: добавление и удаление одного
  const quiet=await p.evaluate(async id=>{const u=U.find(x=>x.id===id);u.vars=['A','B','C'];
    window.confirm=()=>{throw new Error('не должен спрашивать');};
    saveVarsLive(id,'A, B, C, D'); await new Promise(r=>setTimeout(r,300));
    const n1=u.vars.length;
    saveVarsLive(id,'A, B, C'); await new Promise(r=>setTimeout(r,300));
    return {послеДобавления:n1,послеУдаленияОдного:u.vars.length};},prep.id);
  rec('добавление одного — без вопросов', quiet.послеДобавления===4, JSON.stringify(quiet));
  rec('удаление одного — без вопросов', quiet.послеУдаленияОдного===3, JSON.stringify(quiet));
  rec('нет JS-ошибок', errs.filter(e=>!/favicon/.test(e)).length===0, errs.slice(0,2).join(' | '));
  console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
  await b.close();srv.close();
});
