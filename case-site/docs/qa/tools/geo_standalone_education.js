/* Слой «Образование» в геоаналитике: работает и когда данных нет, и когда они появились.
   Данные НЕ зашиты в страницу — их собирает коллектор на сервере. */
const { chromium } = require('playwright-core');
const http = require('http'); const fs = require('fs'); const path = require('path');
const FILE = '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
const LJS = fs.readFileSync(path.join(__dirname,'leaflet.js'),'utf8');
const LCSS = fs.readFileSync(path.join(__dirname,'leaflet.css'),'utf8');
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64');
/* Небольшой правдоподобный набор ТОЛЬКО для теста — в поставку не входит */
const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname,'edu_out.json'),'utf8'));
let failed=0; const ck=(n,c,d)=>{console.log((c?'OK  ':'!!  ')+n+(d===undefined?'':' — '+d)); if(!c)failed++;};
(async()=>{
  const html=fs.readFileSync(FILE,'utf8');
  let serveData = false;
  const srv=http.createServer((q,s)=>{
    if(/tashkent_education\.json/.test(q.url)){
      if(!serveData){s.writeHead(404);return s.end('no');}
      s.writeHead(200,{'Content-Type':'application/json'});return s.end(JSON.stringify(SAMPLE));
    }
    if(/\.json$/.test(q.url)){s.writeHead(404);return s.end('no');}
    s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(html);
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1400,height:900}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith(base))return r.continue();
    if(/leaflet.*\.js/i.test(u))return r.fulfill({status:200,contentType:'application/javascript',body:LJS});
    if(/leaflet.*\.css/i.test(u))return r.fulfill({status:200,contentType:'text/css',body:LCSS});
    return r.fulfill({status:200,contentType:'image/png',body:TILE});});

  await pg.goto(base+'/',{waitUntil:'domcontentloaded'}); await pg.waitForTimeout(3500);
  ck('страница без ошибок сценария',errs.length===0,errs[0]||'ошибок нет');
  ck('переключатель слоя есть',await pg.evaluate(()=>!!document.getElementById('lEdu')));
  ck('фильтр по типу есть',await pg.evaluate(()=>{
    const s=document.getElementById('eduT');return !!s&&s.options.length>=8;}));

  /* 1. Данных нет — слой честно объясняет, как их собрать, и не падает */
  const empty=await pg.evaluate(async()=>{
    const cb=document.getElementById('lEdu'); cb.checked=true;
    cb.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,1500));
    return {note:(document.getElementById('eduNote')||{}).textContent||'',
            layers:(function(){try{return gEdu.getLayers().length;}catch(e){return -1;}})()};
  });
  ck('без данных слой пуст и не падает',empty.layers===0,'слоёв: '+empty.layers);
  ck('подсказка объясняет, как собрать',/geo_collector|соберите/i.test(empty.note),empty.note.slice(0,80));

  /* 2. Файл появился — точки рисуются */
  serveData=true;
  const filled=await pg.evaluate(async()=>{
    EDU_TRIED=false; await loadEdu();
    await new Promise(r=>setTimeout(r,600));
    return {n:EDU.length, layers:gEdu.getLayers().length, note:(document.getElementById('eduNote')||{}).textContent||''};
  });
  ck('данные подхватились из файла',filled.n===8,'точек: '+filled.n);
  ck('точки отрисованы',filled.layers===8,'на карте: '+filled.layers);
  ck('подпись показывает разбивку по типам',/Школа|Курсы|Университет/i.test(filled.note),filled.note.slice(0,110));

  /* 3. Фильтр по типу */
  const filt=await pg.evaluate(async()=>{
    document.getElementById('eduT').value='school';
    document.getElementById('eduT').dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    return gEdu.getLayers().length;
  });
  ck('фильтр «школы» оставляет только школы',filt===1,'на карте: '+filt);


  /* ===== Аналитика: образование должно считаться так же, как БЦ и медицина ===== */
  const anal = await pg.evaluate(async () => {
    /* точка в гуще наших тестовых объектов */
    document.getElementById('eduT').value = '';        /* фильтр сбрасываем: он влияет на счёт */
    const la = 41.3400, ln = 69.2870;
    const cnt1 = eduR(la, ln, 1000), cnt3 = eduR(la, ln, 3000);
    document.getElementById('eduT').value = 'school';
    const onlySchools = eduR(la, ln, 3000);
    document.getElementById('eduT').value = '';
    const bizOpts = [...document.querySelectorAll('#sZBiz option')].map(o => o.value);
    const zc = (typeof zCompCount === 'function') ? zCompCount(la, ln, 1000, 'edu') : -1;
    return { cnt1, cnt3, onlySchools, bizOpts, zc };
  });
  ck('счёт образования в радиусе работает', anal.cnt3 > 0 && anal.cnt3 >= anal.cnt1,
    `1 км: ${anal.cnt1}, 3 км: ${anal.cnt3}`);
  ck('фильтр типа влияет на счёт конкурентов', anal.onlySchools < anal.cnt3,
    `все: ${anal.cnt3}, только школы: ${anal.onlySchools}`);
  ck('образование есть в модели зон пригодности', anal.bizOpts.indexOf('edu') >= 0,
    anal.bizOpts.join(', '));
  ck('модель зон считает образование конкурентами', anal.zc === anal.cnt1,
    `zCompCount: ${anal.zc}, прямой счёт: ${anal.cnt1}`);

  /* Отчёт по клику должен показать блок и потенциал учебного центра */
  const rep = await pg.evaluate(async () => {
    document.getElementById('eduT').value = '';
    await probeAt(41.3400, 69.2870);
    await new Promise(r => setTimeout(r, 1200));
    /* Отчёт рисуется в отдельную панель #probe, а не в общий поток страницы */
    const panel = document.getElementById('probe');
    const t = panel ? panel.innerText : '';
    return {
      hasBlock: /Образование \(конкуренция\)/i.test(t),   /* .grp — uppercase через CSS */
      hasScore: /Потенциал учебного центра/.test(t),
      scoreEdu: (typeof LASTPROBE === 'object' && LASTPROBE) ? LASTPROBE.scoreEdu : undefined,
      scoreMed: (typeof LASTPROBE === 'object' && LASTPROBE) ? LASTPROBE.scoreMed : undefined,
      byType: /В 1 км:/.test(t),
      counts: (t.match(/Образование \(конкуренция\)[\s\S]{0,120}/i) || [''])[0].replace(/\n/g, ' ')
    };
  });
  ck('в отчёте по точке есть блок образования', rep.hasBlock);
  ck('блок показывает счёт по радиусам', /\d/.test(rep.counts), rep.counts.slice(0, 90));
  ck('в отчёте есть разбивка по типам', rep.byType);
  ck('в отчёте есть потенциал учебного центра', rep.hasScore);
  /* Без данных о населении спрос неизвестен, поэтому оценка пустая — и у клиники тоже.
     Проверяем именно это: образование считается по тем же правилам, что медицина. */
  ck('оценка образования ведёт себя как оценка клиники',
    (rep.scoreEdu === null) === (rep.scoreMed === null),
    `учебный центр: ${rep.scoreEdu}, клиника: ${rep.scoreMed}`);

  ck('ошибок за весь прогон нет',errs.length===0,errs[0]||'ошибок нет');
  await pg.screenshot({path:__dirname+'/edu_map.png',clip:{x:0,y:0,width:430,height:760}});
  await b.close(); srv.close();
  console.log(failed?'\nПРОВАЛЕНО проверок: '+failed:'\nВсе проверки пройдены');
  process.exit(failed?1:0);
})();
