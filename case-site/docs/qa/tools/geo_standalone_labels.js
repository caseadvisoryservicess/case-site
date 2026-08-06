/* Подписи: размер как у БЦ + перетаскивание любой подписи мышью, со стойкостью к
   сдвигу карты, зуму и перезагрузке. */
const { chromium } = require('playwright-core');
const fs=require('fs'), path=require('path');
const FILE = process.argv[2] || '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
let failed=0; const ck=(n,c,d)=>{console.log((c?'OK  ':'!!  ')+n+(d===undefined?'':' — '+d)); if(!c)failed++;};
const EDU={src:'тест',points:[
 {n:'Школа №110',la:41.3200,ln:69.2800,t:'school',s:'OSM'},
 {n:'Inha University',la:41.3450,ln:69.2870,t:'university',s:'OSM'},
 {n:"Najot Ta'lim",la:41.3480,ln:69.2880,t:'courses',s:'OSM'}]};
(async()=>{
  const tmp=path.join(__dirname,'labtest'); fs.rmSync(tmp,{recursive:true,force:true}); fs.mkdirSync(tmp,{recursive:true});
  const dst=path.join(tmp,'geo.html'); fs.copyFileSync(FILE,dst);
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith('file://')||u.startsWith('data:')||u.startsWith('blob:'))return r.continue(); return r.abort();});
  await pg.addInitScript(d=>localStorage.setItem('caseos_edu',JSON.stringify(d)),EDU);
  await pg.goto('file://'+dst,{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3500);
  ck('страница без ошибок сценария',errs.length===0,errs[0]||'ошибок нет');

  /* включаем образование с подписями */
  const shown=await pg.evaluate(async()=>{
    document.getElementById('lEdu').checked=true;
    document.getElementById('lEdu').dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('eduLab').checked=true;
    await new Promise(r=>setTimeout(r,1500));
    renderEdu(); await new Promise(r=>setTimeout(r,800));
    const tips=[...document.querySelectorAll('.leaflet-tooltip')];
    const edu=tips.filter(t=>/Школа №110|Inha|Najot/.test(t.textContent));
    return {n:edu.length, cls:edu[0]?edu[0].className:'', txt:edu[0]?edu[0].textContent.trim():'',
            fs:edu[0]?getComputedStyle(edu[0]).fontSize:''};
  });
  ck('подписи образования появились',shown.n>=3,'подписей: '+shown.n);
  ck('класс подписи такой же, как у БЦ',/bclab/.test(shown.cls)&&!/dlab/.test(shown.cls),shown.cls);
  ck('в подписи только название, без типа и источника',
    !/Школа$|Университет|OSM/.test(shown.txt),'«'+shown.txt+'»');
  /* размер сравниваем с подписью БЦ */
  const bcFs=await pg.evaluate(async()=>{
    document.getElementById('lBC').checked=true;
    document.getElementById('lBC').dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('bcLab').checked=true; renderBC();
    await new Promise(r=>setTimeout(r,800));
    const t=[...document.querySelectorAll('.leaflet-tooltip.bclab')].find(x=>/Botanica|Samsung|Taxtapul/.test(x.textContent));
    return t?getComputedStyle(t).fontSize:'';
  });
  ck('размер шрифта совпадает с подписями БЦ',shown.fs===bcFs,'образование '+shown.fs+', БЦ '+bcFs);

  /* перетаскивание */
  const drag=await pg.evaluate(async()=>{
    const el=[...document.querySelectorAll('.leaflet-tooltip')].find(t=>/Inha/.test(t.textContent));
    if(!el)return {err:'подпись не найдена'};
    const before=el.getBoundingClientRect();
    const fire=(type,x,y)=>{const ev=new MouseEvent(type,{clientX:x,clientY:y,bubbles:true,cancelable:true});
      (type==='mousedown'?el:document).dispatchEvent(ev);};
    fire('mousedown',before.left+5,before.top+5);
    fire('mousemove',before.left+65,before.top+45);
    fire('mouseup',before.left+65,before.top+45);
    await new Promise(r=>setTimeout(r,200));
    const after=el.getBoundingClientRect();
    return {dx:Math.round(after.left-before.left), dy:Math.round(after.top-before.top),
            ml:parseFloat(el.style.marginLeft)||0, mt:parseFloat(el.style.marginTop)||0,
            key:el.dataset.labkey||'', saved:localStorage.getItem('caseos_laboff')||''};
  });
  /* Проверяем именно смещение, которое ставим сами. Рамка элемента может уехать
     на пару пикселей больше: у подписи при сдвиге меняется сторона привязки. */
  ck('подпись сдвигается мышью на заданное расстояние',drag.ml===60&&drag.mt===40,
    `смещение ${drag.ml}/${drag.mt}, на экране сдвинулась на ${drag.dx}/${drag.dy}`);
  ck('сдвиг записан в память',/\-?\d+/.test(drag.saved)&&drag.saved.length>5,drag.saved.slice(0,60));

  /* сдвиг должен пережить панораму и зум — Leaflet переписывает transform, а мы храним margin */
  const after=await pg.evaluate(async()=>{
    map.panBy([120,80]); await new Promise(r=>setTimeout(r,600));
    map.setZoom(map.getZoom()-1); await new Promise(r=>setTimeout(r,900));
    const el=[...document.querySelectorAll('.leaflet-tooltip')].find(t=>/Inha/.test(t.textContent));
    return el?{ml:el.style.marginLeft,mt:el.style.marginTop}:{ml:'',mt:''};
  });
  ck('сдвиг пережил перемещение и зум карты',parseFloat(after.ml)>50&&parseFloat(after.mt)>30,
    `осталось ${after.ml} / ${after.mt}`);

  /* и перезагрузку */
  await pg.reload({waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3000);
  const persist=await pg.evaluate(async()=>{
    document.getElementById('lEdu').checked=true;
    document.getElementById('lEdu').dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('eduLab').checked=true;
    await new Promise(r=>setTimeout(r,1500)); renderEdu(); await new Promise(r=>setTimeout(r,800));
    const el=[...document.querySelectorAll('.leaflet-tooltip')].find(t=>/Inha/.test(t.textContent));
    return el?{ml:el.style.marginLeft,mt:el.style.marginTop}:{ml:'',mt:''};
  });
  ck('сдвиг пережил перезагрузку',parseFloat(persist.ml)>50&&parseFloat(persist.mt)>30,
    `восстановлено ${persist.ml} / ${persist.mt}`);

  const reset=await pg.evaluate(async()=>{
    window.confirm=()=>true; labReset(); await new Promise(r=>setTimeout(r,200));
    const el=[...document.querySelectorAll('.leaflet-tooltip')].find(t=>/Inha/.test(t.textContent));
    return {ml:el?el.style.marginLeft:'x',saved:localStorage.getItem('caseos_laboff')};
  });
  ck('сброс возвращает подписи на место',reset.ml===''&&reset.saved==='{}',`margin «${reset.ml}», память ${reset.saved}`);

  /* ===== Двигаться должны подписи ЛЮБОЙ категории, включая наши проекты ===== */
  const cats = await pg.evaluate(async () => {
    /* включаем всё, у чего есть постоянные подписи */
    const on = id => { const e=document.getElementById(id); if(e&&!e.checked){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}));} };
    on('lBC'); on('lDist'); on('lMed'); on('lEdu');
    const lab = id => { const e=document.getElementById(id); if(e&&!e.checked){e.checked=true;e.dispatchEvent(new Event('input',{bubbles:true}));} };
    lab('bcLab'); lab('dLab'); lab('eduLab');
    await new Promise(r=>setTimeout(r,2500));
    try{ renderBC(); renderDist(); renderEdu(); }catch(e){}
    await new Promise(r=>setTimeout(r,1200));
    const tips=[...document.querySelectorAll('.leaflet-tooltip')];
    const grab = t => t.classList.contains('lab-draggable') && !!t.dataset.labkey;
    const find = re => tips.find(t => re.test(t.textContent));
    const bc = find(/Botanica|Samsung|Taxtapul/);        /* наш проект */
    const edu = find(/Inha|Школа №110|Najot/);
    const dist = tips.find(t => /Yunusabad|Mirzo|Chilanzar|чел/.test(t.textContent) && t.classList.contains('dlab'));
    return {
      total: tips.length,
      draggable: tips.filter(grab).length,
      bc: bc ? grab(bc) : null, bcText: bc ? bc.textContent.trim().slice(0,24) : '-',
      edu: edu ? grab(edu) : null,
      dist: dist ? grab(dist) : null, distText: dist ? dist.textContent.trim().slice(0,24) : '-'
    };
  });
  ck('подписи нашего проекта (БЦ) перетаскиваются', cats.bc === true, 'проверено на «'+cats.bcText+'»');
  ck('подписи образования перетаскиваются', cats.edu === true);
  ck('подписи районов перетаскиваются', cats.dist === true, 'проверено на «'+cats.distText+'»');
  ck('перетаскиваемыми стали все постоянные подписи', cats.draggable === cats.total && cats.total > 3,
    cats.draggable + ' из ' + cats.total);

  ck('ошибок за весь прогон нет',errs.length===0,errs[0]||'ошибок нет');
  await pg.screenshot({path:path.join(__dirname,'labels.png'),clip:{x:300,y:0,width:1100,height:700}});
  await b.close();
  console.log(failed?'\nПРОВАЛЕНО проверок: '+failed:'\nВсе проверки пройдены');
  process.exit(failed?1:0);
})();
