/* Прокрутка карточки переживает операцию, после которой карточка перерисовывается целиком.

   Внешний разбор v4.57.1 предупреждал: перевод refreshViewKeepScroll на общий live-sync
   этот прыжок НЕ вылечит, потому что вызывающие места делают два действия подряд -
   сначала обновляют экран, потом openUnit(id) заново собирает innerHTML панели и её
   scrollTop обнуляется. Предупреждение не подтвердилось: restore в live-sync повторяется
   на rAF и через 40/120/260/520 мс, то есть уже ПОСЛЕ перерисовки панели. Тест закрепляет
   именно это поведение - если кто-то уберёт повторные восстановления, здесь станет видно.

   Запуск: node v4590_drawer_scroll.js [папка os] */
const { chromium } = require('playwright-core');
const path = require('path');
const { createMockServer } = require('./mock_backend.js');
(async()=>{
  const {srv,base}=await createMockServer(process.argv[2] || path.join(__dirname,'..','..','..','os'),{initialState:{
    OBJECTS:[{id:'ca',name:'CASE Mall'}],
    U:Array.from({length:8},(_,i)=>({id:'u'+i,code:'L1-'+(i+1),obj:'ca',floor:'1',area:100+i,cat:'Мода',
      status:'neg',rate:20+i,budget:15,vars:['Бренд A','Бренд B'],dates:[['Окончание','2027-01-01']],
      hist:Array.from({length:12},(_,k)=>['2026-0'+(k%9+1)+'-01','Событие '+k]),comments:['раз','два']})),
    BRANDS:[],CHANGES:[],TRASH:[]}});
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1440,height:700}});
  pg.on('dialog',d=>d.accept('тестовый комментарий'));
  await pg.route('**/*',r=>r.request().url().startsWith(base)||/^(data|blob):/.test(r.request().url())?r.continue():r.abort());
  await pg.goto(base+'/index.html',{waitUntil:'networkidle'});
  await pg.waitForSelector('#luser',{state:'attached'});
  await pg.evaluate(()=>{const s=document.getElementById('luser');s.value='ASH';doLogin();});
  await pg.waitForTimeout(2200);
  await pg.evaluate(()=>go('registry')); await pg.waitForTimeout(900);
  const r = await pg.evaluate(async ()=>{
    openUnit('u3'); await new Promise(r=>setTimeout(r,600));
    const d=document.getElementById('drawer');
    if(!d) return {err:'панель не найдена'};
    const max=d.scrollHeight-d.clientHeight;
    d.scrollTop=Math.min(200,max);
    const before=d.scrollTop;
    addComment('u3');                       // идёт через refreshViewKeepScroll(); openUnit(id);
    await new Promise(r=>setTimeout(r,150));
    const rightAfter=document.getElementById('drawer').scrollTop;
    await new Promise(r=>setTimeout(r,900));  // ждём поздние восстановления live-sync (до 520 мс)
    const settled=document.getElementById('drawer').scrollTop;
    return {max,before,rightAfter,settled};
  });
  console.log(JSON.stringify(r));
  const ok = r.before>0 && Math.abs(r.settled-r.before)<=4;
  console.log(ok?'OK  прокрутка карточки пережила перерисовку':'!!  прокрутка карточки сбросилась: было '+r.before+', стало '+r.settled);
  await b.close(); srv.close(); process.exit(ok?0:1);
})();
