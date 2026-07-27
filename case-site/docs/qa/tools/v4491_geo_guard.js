'use strict';
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend');
const path=require('path');
const OS=path.resolve(process.argv[2]);
const results=[];const rec=(n,ok,i)=>{results.push({test:n,status:ok?'PASS':'FAIL',...(i?{info:String(i).slice(0,200)}:{})});if(!ok)process.exitCode=1;};
(async()=>{
  const {srv,base,state}=await createMockServer(OS,{initialState:{OBJECTS:[{id:'ca',name:'CA',floors:2}],U:[]}});
  state.user={id:'u-brj',name:'Asad',role:'BRJ',role_key:'BRJ',admin:false,edit:true,leasing:true,finance:false,csrf:'t'};
  state.rights={leasing:1,finance:0,edit:1,approve:0,plans:0,admin:0,own_only:0,project_scope:0};
  // на сервере 148 БЦ — как в реальной базе пользователя
  state.geo.data={datasets:{bc:Array.from({length:148},(_,i)=>({name:'БЦ '+i,lat:41+i/1000,lng:69+i/1000}))},projects:[]};
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--no-proxy-server']});
  const p=await b.newPage({viewport:{width:1600,height:900}});
  await p.goto(base+'/index.html',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
  await p.evaluate(()=>go('geoanalytics'));await p.waitForTimeout(2500);
  const loaded=await p.evaluate(()=>((GEO_DATA&&GEO_DATA.datasets&&GEO_DATA.datasets.bc)||[]).length);
  rec('на сервере загружено 148 записей', loaded===148, loaded);

  // 1) обвальный пакет (2 записи вместо 148) при отказе пользователя
  const drop=await p.evaluate(async()=>{
    window.confirm=()=>false;                       // сотрудник видит предупреждение и отказывается
    window.postMessage({source:'asaas-geo-v42',type:'asaas-geo-save',
      data:{datasets:{bc:[{name:'A'},{name:'B'}]},projects:[]},reason:'сбой загрузки'},location.origin);
    await new Promise(r=>setTimeout(r,2200));
    return {осталось:((GEO_DATA&&GEO_DATA.datasets&&GEO_DATA.datasets.bc)||[]).length,
            тосты:[...document.querySelectorAll('#toastBox div')].map(x=>x.textContent.slice(0,60))};
  });
  rec('обвал остановлен: 148 записей на месте', drop.осталось===148, JSON.stringify(drop));
  rec('обвал: сотруднику объяснили, что сервер не тронут', drop.тосты.some(t=>/отменено/i.test(t)), JSON.stringify(drop.тосты));

  // 2) обычная правка (149 записей) проходит без вопросов
  const okSave=await p.evaluate(async()=>{
    window.confirm=()=>{throw new Error('не должен спрашивать при обычной правке');};
    const arr=Array.from({length:149},(_,i)=>({name:'БЦ '+i,lat:41,lng:69}));
    window.postMessage({source:'asaas-geo-v42',type:'asaas-geo-save',
      data:{datasets:{bc:arr},projects:[]},reason:'обычная правка'},location.origin);
    await new Promise(r=>setTimeout(r,2400));
    return {стало:((GEO_DATA&&GEO_DATA.datasets&&GEO_DATA.datasets.bc)||[]).length,
            тосты:[...document.querySelectorAll('#toastBox div')].map(x=>x.textContent.slice(0,50))};
  });
  rec('обычная правка (+1 запись) сохраняется без вопросов', okSave.стало===149, JSON.stringify(okSave));
  console.log(JSON.stringify({summary:{pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length},results},null,1));
  await b.close();srv.close();
})().catch(e=>{console.error('FATAL',e);process.exit(2);});
