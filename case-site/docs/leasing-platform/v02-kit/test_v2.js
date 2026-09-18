const fs=require('fs'),http=require('http');const {chromium}=require('playwright-core');
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KIT='/home/user/case-site/case-site/docs/leasing-platform/v02-kit';
const ROWS=[{id:'L2_1',area:282},{id:'L2_2',area:987.7},{id:'L2_3',area:319.5},{id:'L2_4',area:58.4},
 {id:'L2_6',area:93.9},{id:'L2_7',area:280},{id:'L2_9',area:104.8},{id:'L2_10',area:214.5},
 {id:'L2_14',area:47},{id:'L2_17',area:17.1},{id:'L2_99',area:150}];
(async()=>{
 const files={'/rec.js':[fs.readFileSync(KIT+'/plan-recognizer.js'),'text/javascript'],
   '/plan.svg':[fs.readFileSync(__dirname+'/osz/os/zarafshan-l2.svg'),'image/svg+xml'],
   '/index.html':[Buffer.from('<!doctype html><meta charset=utf-8><body><div id=host></div><script src="/rec.js"></script>'),'text/html; charset=utf-8']};
 const srv=http.createServer((q,r)=>{const f=files[q.url.split('?')[0]]||files['/index.html'];r.writeHead(200,{'Content-Type':f[1]});r.end(f[0]);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;
 const b=await chromium.launch({executablePath:CHROME,args:['--no-sandbox','--no-proxy-server']});
 const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto(base+'/index.html');
 const out=await p.evaluate(async([base,rows])=>{
   const svg=await (await fetch(base+'/plan.svg')).text();
   const R={};
   // 1. sanitizer
   const evil='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)<\/script><rect onclick="alert(2)" x="0" y="0" width="5" height="5"/><a href="javascript:alert(3)"><text>hi</text></a></svg>';
   const clean=PlanRecognizer.sanitizeSvg(evil);
   R.sanitize={hasScript:/script/i.test(clean),hasOnclick:/onclick/i.test(clean),hasJsHref:/javascript:/i.test(clean),keptRect:/rect/i.test(clean)};
   R.sanitizeBadInput=PlanRecognizer.sanitizeSvg('<svg><unclosed')===''||PlanRecognizer.sanitizeSvg('not svg at all')==='';
   // 2. static path still matches the fixture
   const r=PlanRecognizer.recognizeSvg(svg,rows);
   R.static={codes:r.detected.diagnostics.codesFound,areas:r.detected.diagnostics.areaLabelsFound,
     withPoly:r.detected.diagnostics.withPolygon,r2:+r.calibration.r2.toFixed(6),
     samples:r.calibration.samples,derived:r.inferred.filled,
     matched:r.match.summary.matched,errors:r.audit.filter(a=>a.level==='error').length};
   // 3. live DOM path
   document.getElementById('host').innerHTML=PlanRecognizer.sanitizeSvg(svg);
   const el=document.querySelector('#host svg');
   const live=PlanRecognizer.readSvgLive(el);
   const ld=PlanRecognizer.detectUnits(live);
   const lc=PlanRecognizer.calibrateScale(ld);
   R.live={texts:live.texts.length,shapes:live.shapes.length,codes:ld.diagnostics.codesFound,
     areas:ld.diagnostics.areaLabelsFound,withPoly:ld.diagnostics.withPolygon,
     scale:lc.scale?lc.scale.toExponential(3):null,r2:lc.r2?+lc.r2.toFixed(4):null,samples:lc.samples};
   return R;
 },[base,ROWS]);
 console.log('SANITIZER      ',JSON.stringify(out.sanitize),' rejects-garbage:',out.sanitizeBadInput);
 console.log('STATIC PARSER  ',JSON.stringify(out.static));
 console.log('LIVE DOM PARSER',JSON.stringify(out.live));
 console.log('page errors:',errs.length?errs:'none');
 await b.close();srv.close();
})();
