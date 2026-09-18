const fs=require('fs'),http=require('http');const {chromium}=require('playwright-core');
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KIT='/home/user/case-site/case-site/docs/leasing-platform/v02-kit';
(async()=>{
 const files={'/s.js':[fs.readFileSync(KIT+'/state-store.js'),'text/javascript'],
   '/index.html':[Buffer.from('<!doctype html><meta charset=utf-8><script src="/s.js"></script>'),'text/html; charset=utf-8']};
 const srv=http.createServer((q,r)=>{const f=files[q.url.split('?')[0]]||files['/index.html'];r.writeHead(200,{'Content-Type':f[1]});r.end(f[0]);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;
 const b=await chromium.launch({executablePath:CHROME,args:['--no-sandbox','--no-proxy-server']});
 const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(base+'/index.html');
 const r1=await p.evaluate(async()=>{
   const log=[];
   const SEED={units:[{id:'B1_001',status:'Вакант',area:422.3,broker:''},{id:'B1_002',status:'Вакант',area:650.8,broker:''}]};
   const st=CaseStore.create({key:'t1',version:2,initial:SEED});
   let syncHits=0, fieldHits=0;
   st.on('data:changed',()=>syncHits++);
   st.on('units:status',e=>{fieldHits++;log.push('status event '+e.id+' '+e.from+'->'+e.to);});
   const r=st.edit('units','B1_001',{status:'Переговоры',broker:'Нодир'},{by:'Нодир'});
   log.push('edit ok='+r.ok+' fields='+JSON.stringify(r.fields));
   const row=st.find('units','B1_001');
   log.push('history len='+row.history.length+' updatedBy='+row.updatedBy);
   log.push('noop='+JSON.stringify(st.edit('units','B1_001',{status:'Переговоры'})));
   st.undo();
   log.push('after undo status='+st.find('units','B1_001').status);
   st.save();
   const csv=st.toCsv(st.collection('units'),[{key:'id',label:'Unit'},{key:'area',label:'GLA'},{key:'status',label:'Status'}]);
   log.push('csv BOM='+(csv.charCodeAt(0)===0xFEFF)+' sep=;'+(csv.split('\n')[0].includes(';')));
   const exp=st.exportJson();
   const bad=st.importJson('{"nope":1}');
   log.push('import bad='+JSON.stringify(bad));
   const needs=st.importJson(exp);
   log.push('import needsConfirm='+!!needs.needsConfirm+' preview='+JSON.stringify(needs.preview));
   log.push('import confirmed='+JSON.stringify(st.importJson(exp,{confirmed:true})));
   log.push('syncEvents='+syncHits+' fieldEvents='+fieldHits);
   return {log,keys:st._keys,raw:localStorage.getItem(st._keys.main)?'present':'MISSING'};
 });
 r1.log.forEach(l=>console.log('  '+l));
 console.log('  storage keys:',JSON.stringify(r1.keys),'main=',r1.raw);
 // reload -> persistence
 await p.reload();
 const r2=await p.evaluate(()=>{
   const st=CaseStore.create({key:'t1',version:2,initial:{units:[]}});
   const u=st.find('units','B1_001');
   return {status:u&&u.status, broker:u&&u.broker, hist:u&&u.history?u.history.length:0, count:st.collection('units').length};
 });
 console.log('  AFTER RELOAD:',JSON.stringify(r2));
 // corruption recovery
 const r3=await p.evaluate(()=>{
   localStorage.setItem('t1_v2','{{{broken');
   const ev=[]; const st=CaseStore.create({key:'t1',version:2,initial:{units:[]}});
   st.on('*',(p,e)=>ev.push(e));
   return {units:st.collection('units').length, backupStillThere:!!localStorage.getItem('t1_backup_v2')};
 });
 console.log('  CORRUPT RECOVERY:',JSON.stringify(r3));
 console.log('  page errors:',errs.length?errs:'none');
 await b.close();srv.close();
})();
