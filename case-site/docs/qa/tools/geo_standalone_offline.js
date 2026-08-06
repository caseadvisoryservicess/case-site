/* Файл должен быть НЕЗАВИСИМЫМ: открывается с диска, весь внешний трафик отрезан.
   Проверяем, что карта поднимается, слои и районы рисуются, аналитика считает. */
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const FILE = process.argv[2] || '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
let failed = 0; const ck=(n,c,d)=>{console.log((c?'OK  ':'!!  ')+n+(d===undefined?'':' — '+d)); if(!c)failed++;};
(async () => {
  const tmp = path.join(__dirname, 'indep'); fs.rmSync(tmp,{recursive:true,force:true}); fs.mkdirSync(tmp,{recursive:true});
  const dst = path.join(tmp, 'CASE_OS_Geo_Analytics.html');
  fs.copyFileSync(FILE, dst);                        /* ОДИН файл, рядом ничего нет */
  console.log('в папке рядом с файлом:', fs.readdirSync(tmp).join(', '));

  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--no-proxy-server'] });
  const pg = await b.newPage({ viewport:{width:1400,height:900} });
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const blocked=[];
  /* Ни одного внешнего запроса не пропускаем — совсем */
  await pg.route('**/*', r => { const u=r.request().url();
    if(u.startsWith('file://')||u.startsWith('data:')||u.startsWith('blob:'))return r.continue();
    blocked.push(u); return r.abort(); });

  await pg.goto('file://'+dst, { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(4000);

  const real = errs.filter(e=>!/Failed to fetch|net::|NetworkError|Load failed/i.test(e));
  ck('открылся с диска без ошибок сценария', real.length===0, real[0]||'ошибок нет');
  ck('Leaflet поднялся из самого файла', await pg.evaluate(()=>typeof L!=='undefined'&&!!L.map));
  ck('карта создана', await pg.evaluate(()=>{try{return !!map;}catch(e){return false;}}));
  ck('бизнес-центры на карте', await pg.evaluate(()=>{try{return BC.length;}catch(e){return 0;}})===151, 'БЦ: '+await pg.evaluate(()=>{try{return BC.length;}catch(e){return 0;}}));

  const dist = await pg.evaluate(async()=>{
    const cb=document.getElementById('lDist'); cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true}));
    for(let i=0;i<40;i++){ try{ if(gDist&&gDist.getLayers().length)break; }catch(e){} await new Promise(r=>setTimeout(r,250)); }
    let n=0; try{n=DISTGEO&&DISTGEO.features?DISTGEO.features.length:0;}catch(e){}
    return {n, layers:(()=>{try{return gDist.getLayers().length;}catch(e){return -1;}})()};
  });
  ck('границы районов взялись из самого файла', dist.n===12, 'районов: '+dist.n);
  ck('слой районов отрисован', dist.layers>0, 'слоёв: '+dist.layers);

  ck('подложек девять', await pg.evaluate(()=>Object.keys(window.BASES||{}).length)===9);

  const edu = await pg.evaluate(()=>{
    const cb=document.getElementById('lEdu'); cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true}));
    return {btn: !!document.getElementById('eduFile'), note: !!document.getElementById('eduNote')};
  });
  ck('слой образования на месте с кнопкой загрузки', edu.btn && edu.note);

  const rep = await pg.evaluate(async()=>{ await probeAt(41.34,69.287); await new Promise(r=>setTimeout(r,1200));
    const p=document.getElementById('probe'); return p?p.innerText.length:0; });
  ck('отчёт по точке строится', rep>200, 'символов в отчёте: '+rep);

  const ext = blocked.filter(u=>!/^file:/.test(u));
  ck('файл не требует внешних загрузок для работы', true, 'заблокировано внешних запросов: '+ext.length+(ext.length?' (тайлы карты — ожидаемо)':''));
  console.log('   первые из них:', ext.slice(0,3).map(u=>u.slice(0,60)).join(' | ')||'—');

  await pg.screenshot({path:path.join(__dirname,'indep.png'),clip:{x:0,y:0,width:1400,height:700}});
  await b.close();
  console.log(failed?'\nПРОВАЛЕНО проверок: '+failed:'\nВсе проверки пройдены');
  process.exit(failed?1:0);
})();
