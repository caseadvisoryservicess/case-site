const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const CHROME=process.env.CHROME_BIN||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const KIT='/home/user/case-site/case-site/docs/leasing-platform/v02-kit';
const SVG='/tmp/claude-0/-home-user-case-site/a578a37a-626a-5957-b525-6fe9d162ea32/scratchpad/osz/os/zarafshan-l2.svg';
(async()=>{
 const files={'/rec.js':[fs.readFileSync(KIT+'/plan-recognizer.js'),'text/javascript'],
              '/plan.svg':[fs.readFileSync(SVG),'image/svg+xml'],
              '/index.html':[Buffer.from('<!doctype html><meta charset=utf-8><script src="/rec.js"></script>'),'text/html; charset=utf-8']};
 const srv=http.createServer((q,r)=>{const f=files[q.url.split('?')[0]]||files['/index.html'];r.writeHead(200,{'Content-Type':f[1]});r.end(f[0]);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+srv.address().port;
 const b=await chromium.launch({executablePath:CHROME,args:['--no-sandbox','--no-proxy-server']});
 const p=await b.newPage();
 p.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await p.goto(base+'/index.html');
 const out=await p.evaluate(async(base)=>{
   const svg=await (await fetch(base+'/plan.svg')).text();
   const plan=PlanRecognizer.readSvg(svg);
   const det=PlanRecognizer.detectUnits(plan);
   const cal=PlanRecognizer.calibrateScale(det);
   return {viewBox:plan.viewBox,texts:plan.texts.length,shapes:plan.shapes.length,
     diag:det.diagnostics, cal:{scale:cal.scale,r2:cal.r2,samples:cal.samples,note:cal.note},
     units:det.units.map(u=>({code:u.code,planArea:u.planArea,hasPoly:!!u.polygon,polyPx:u.polygonAreaPx?Math.round(u.polygonAreaPx):null,src:u.source,conf:u.confidence})),
     orphan:det.orphanAreas.map(o=>o.area)};
 },base);
 console.log(JSON.stringify(out,null,1));
 await b.close(); srv.close();
})();
