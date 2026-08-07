/* Проверяем добавленный проект Samsung BC и что сохранённые правки не съехали:
   правки хранятся ПО НОМЕРУ записи в массиве BC, поэтому вставка не в конец
   молча перевесила бы их на чужие бизнес-центры. */
const { chromium } = require('playwright-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const FILE = '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
/* Leaflet вшит в саму страницу, подменять его не нужно. Заглушки остаются на случай
   запуска против старой сборки, где библиотека грузилась из сети. */
const LJS  = fs.existsSync(path.join(__dirname,'leaflet.js'))  ? fs.readFileSync(path.join(__dirname,'leaflet.js'),'utf8')  : null;
const LCSS = fs.existsSync(path.join(__dirname,'leaflet.css')) ? fs.readFileSync(path.join(__dirname,'leaflet.css'),'utf8') : null;
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
let failed=0; const ck=(n,c,d)=>{console.log((c?'OK  ':'!!  ')+n+(d===undefined?'':' — '+d)); if(!c)failed++;};
(async()=>{
  const html=fs.readFileSync(FILE,'utf8');
  const srv=http.createServer((q,s)=>{s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(html);});
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith(base))return r.continue();
    if(LJS&&/leaflet.*\.js/i.test(u))return r.fulfill({status:200,contentType:'application/javascript',body:LJS});
    if(LCSS&&/leaflet.*\.css/i.test(u))return r.fulfill({status:200,contentType:'text/css',body:LCSS});
    return r.fulfill({status:200,contentType:'image/png',body:TILE});});
  /* «старые» правки пользователя: первый и восьмой БЦ */
  await pg.addInitScript(()=>localStorage.setItem('caseos_bc_edits',JSON.stringify({0:{comment:'МЕТКА-0'},7:{comment:'МЕТКА-7'}})));
  await pg.goto(base+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(4000);
  ck('страница без ошибок сценария',errs.length===0,errs[0]||'ошибок нет');
  const r=await pg.evaluate(()=>{
    const opts=[...document.querySelectorAll('#proj option')].map(o=>o.value);
    const s=BC[BC.length-1];
    return {opts, total:BC.length, last:{n:s.name,la:s.lat,ln:s.lng,d:s.district},
      p:PROJECTS.samsung, e0:eff(BC[0]).comment, e7:eff(BC[7]).comment, n0:BC[0].name, n7:BC[7].name};
  });
  ck('в списке проектов три пункта',r.opts.join(',')==='botanica,taxtapul,samsung',r.opts.join(', '));
  ck('Samsung BC в справочнике проектов',!!r.p&&r.p.name==='Samsung BC',r.p?`${r.p.lat}, ${r.p.lng}, ${r.p.district}`:'нет');
  ck('точка добавлена в конец списка БЦ',r.total===151&&r.last.n==='Samsung BC',`всего ${r.total}, последняя «${r.last.n}»`);
  ck('координаты точные',r.last.la===41.34874282632705&&r.last.ln===69.28821941229232,`${r.last.la}, ${r.last.ln}`);
  ck('район определён',r.last.d==='Yunusabad',r.last.d);
  ck('прежние правки остались на своих БЦ',r.e0==='МЕТКА-0'&&r.e7==='МЕТКА-7',`${r.n0}: ${r.e0} | ${r.n7}: ${r.e7}`);
  /* переключение на новый проект должно перецентрировать анализ */
  const sw=await pg.evaluate(async()=>{
    const s=document.getElementById('proj'); s.value='samsung';
    s.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,1500));
    const p=proj(); const c=map?map.getCenter():null;
    return {name:p.name, lat:p.lat, cLat:c?+c.lat.toFixed(3):null, cLng:c?+c.lng.toFixed(3):null,
            info:(document.getElementById('projInfo')||{}).textContent||''};
  });
  ck('переключение на Samsung работает',sw.name==='Samsung BC',sw.name);
  ck('карта перецентрирована на проект',Math.abs(sw.cLat-41.349)<0.02&&Math.abs(sw.cLng-69.288)<0.02,`центр ${sw.cLat}, ${sw.cLng}`);
  ck('подпись проекта заполнена',/Samsung|Юнус|Yunus/i.test(sw.info)||sw.info.length>0,sw.info.slice(0,80)||'пусто');
  await pg.screenshot({path:__dirname+'/samsung_map.png',clip:{x:0,y:0,width:430,height:700}});
  await b.close(); srv.close();
  console.log(failed?'\nПРОВАЛЕНО проверок: '+failed:'\nВсе проверки пройдены');
  process.exit(failed?1:0);
})();
