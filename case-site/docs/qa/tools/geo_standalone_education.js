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


  /* ===== Загрузка файла вручную: PHP-скрипт, мусор и master-CSV коллектора ===== */
  const picks = await pg.evaluate(async () => {
    const msgs = []; const realAlert = window.alert; window.alert = m => msgs.push(String(m));
    function feed(name, text) {
      const inp = document.getElementById('eduFile');
      const f = new File([text], name, { type: 'text/plain' });
      const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
      return new Promise(res => { eduLoadFile(inp); setTimeout(res, 400); });
    }
    EDU = []; EDU_SRC = '';
    await feed('geo_education_export.php', '<?php\n/* CASE OS */\nexit;');
    const afterPhp = { n: EDU.length, msg: msgs[msgs.length - 1] || '' };
    await feed('readme.txt', 'просто текст, не данные');
    const afterJunk = { n: EDU.length, msg: msgs[msgs.length - 1] || '' };
    /* master-CSV коллектора: две строки образования и одна аптека */
    const csv = 'object_id,canonical_name,main_category,subcategory,canonical_lat,canonical_lng,primary_source\n'
      + 'S1,"Академический лицей при ТУИТ",education,,41.3450,69.2870,2GIS\n'
      + 'S2,"Школа №110, корпус А",education,школа,41.3200,69.2800,OSM\n'
      + 'S3,"Аптека",pharmacy,,41.31,69.26,OSM\n';
    await feed('seed_master.csv', csv);
    const afterCsv = { n: EDU.length, types: EDU.map(x => x.t), names: EDU.map(x => x.n), src: EDU_SRC };
    window.alert = realAlert;
    return { afterPhp, afterJunk, afterCsv };
  });
  ck('PHP-скрипт отвергается с понятным объяснением',
    picks.afterPhp.n === 0 && /скрипт для сервера/i.test(picks.afterPhp.msg),
    picks.afterPhp.msg.split('\n')[0]);
  ck('посторонний файл отвергается', picks.afterJunk.n === 0 && /JSON|CSV/i.test(picks.afterJunk.msg),
    picks.afterJunk.msg.split('\n')[0]);
  ck('master-CSV коллектора читается напрямую', picks.afterCsv.n === 2,
    'объектов: ' + picks.afterCsv.n + ' (' + picks.afterCsv.src + ')');
  ck('аптека из CSV не попала в образование', picks.afterCsv.names.every(n => !/Аптека/.test(n)),
    picks.afterCsv.names.join(' | '));
  ck('лицей определён колледжем, а не школой',
    picks.afterCsv.types[0] === 'college' && picks.afterCsv.types[1] === 'school',
    picks.afterCsv.types.join(', '));
  ck('запятая внутри кавычек не порвала строку', /Школа №110, корпус А/.test(picks.afterCsv.names.join('|')),
    picks.afterCsv.names[1]);


  /* ===== GeoJSON из overpass-turbo: точки, контуры зданий, теги OSM ===== */
  const gj = await pg.evaluate(async () => {
    const realAlert = window.alert; const msgs=[]; window.alert = m => msgs.push(String(m));
    const fc = { type:'FeatureCollection', features:[
      { type:'Feature', properties:{ name:'Школа №110', amenity:'school' },
        geometry:{ type:'Point', coordinates:[69.2800, 41.3200] } },
      { type:'Feature', properties:{ name:'Najot Talim', office:'educational_institution' },
        geometry:{ type:'Point', coordinates:[69.2880, 41.3480] } },
      /* вуз нарисован контуром здания — должен превратиться в точку по центру */
      { type:'Feature', properties:{ name:'Inha University', amenity:'university' },
        geometry:{ type:'Polygon', coordinates:[[[69.2860,41.3440],[69.2880,41.3440],[69.2880,41.3460],[69.2860,41.3460],[69.2860,41.3440]]] } },
      { type:'Feature', properties:{ name:'Автошкола', amenity:'driving_school' },
        geometry:{ type:'Point', coordinates:[69.2700, 41.3000] } },
      { type:'Feature', properties:{ name:'Без геометрии', amenity:'school' }, geometry:null }
    ]};
    const inp = document.getElementById('eduFile');
    const f = new File([JSON.stringify(fc)], 'export.geojson', { type:'application/geo+json' });
    const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
    EDU = []; EDU_SRC = '';
    await new Promise(res => { eduLoadFile(inp); setTimeout(res, 500); });
    window.alert = realAlert;
    const uni = EDU.find(x => /Inha/.test(x.n));
    return { n: EDU.length, src: EDU_SRC, types: EDU.map(x => x.t),
             uniLat: uni ? uni.la : null, uniLng: uni ? uni.ln : null, msgs };
  });
  ck('GeoJSON из overpass читается', gj.n === 4, 'точек: ' + gj.n + ' (' + gj.src + ')');
  ck('объект без геометрии пропущен', gj.n === 4, 'из 5 записей взято ' + gj.n);
  ck('тип берётся из тегов OSM',
    gj.types.indexOf('school') >= 0 && gj.types.indexOf('university') >= 0
    && gj.types.indexOf('courses') >= 0 && gj.types.indexOf('driving') >= 0,
    gj.types.join(', '));
  ck('контур здания превращён в точку по центру',
    Math.abs(gj.uniLat - 41.3450) < 0.001 && Math.abs(gj.uniLng - 69.2870) < 0.001,
    `${gj.uniLat}, ${gj.uniLng}`);
  const q = await pg.evaluate(() => ({ has: typeof EDU_OVERPASS === 'string',
    comm: /educational_institution/.test(EDU_OVERPASS || ''), copy: typeof eduCopyQuery === 'function' }));
  ck('готовый запрос к OpenStreetMap внутри файла', q.has && q.copy);
  ck('запрос охватывает курсы и учебные центры', q.comm);

  ck('ошибок за весь прогон нет',errs.length===0,errs[0]||'ошибок нет');
  await pg.screenshot({path:__dirname+'/edu_map.png',clip:{x:0,y:0,width:430,height:760}});
  await b.close(); srv.close();
  console.log(failed?'\nПРОВАЛЕНО проверок: '+failed:'\nВсе проверки пройдены');
  process.exit(failed?1:0);
})();
