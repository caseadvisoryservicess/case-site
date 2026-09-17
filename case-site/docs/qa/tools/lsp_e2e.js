/* LSP — browser QA for os/leasing/index.html (Playwright + static server, and file:// too).
   Run: node docs/qa/tools/lsp_e2e.js /path/to/os/leasing [outdir]
   Mirrors the CASE OS convention: {test,status,info} rows, JSON result file. */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const DIR=path.resolve(process.argv[2]||'.');
const OUT=path.resolve(process.argv[3]||path.join(__dirname,'../lsp'));
const CHROME=process.env.CHROME_BIN||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const results=[];
function rec(t,ok,info){results.push({test:t,status:ok?'PASS':'FAIL',...(info?{info:String(info)}:{})});if(!ok)process.exitCode=1;}

(async()=>{
  const srv=http.createServer((req,rsp)=>{
    let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
    const f=path.join(DIR,p);
    if(!f.startsWith(DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rsp.writeHead(404);rsp.end('404');return;}
    rsp.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});
    fs.createReadStream(f).pipe(rsp);
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port;
  const browser=await chromium.launch({executablePath:CHROME,args:['--no-sandbox','--no-proxy-server','--allow-file-access-from-files']});
  const errors=[];
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(String(e.message).slice(0,160)));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,160));});

  // ---------- load & login ----------
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  rec('page loads without JS errors',errors.length===0,errors.join(' | '));
  rec('prototype-auth warning visible',await page.locator('#protobar').isVisible());
  const users=await page.locator('.userbtn').count();
  rec('demo users listed (>=6)',users>=6,'users: '+users);
  await page.locator('.userbtn').first().click();
  await page.keyboard.press('Enter');                      // Enter submits
  await page.waitForTimeout(400);
  rec('Enter key logs in',await page.locator('#app').isVisible());
  await page.evaluate(()=>{S=freshDemo();persist();doLogin(S.users[0].id);});  // deterministic start
  await page.waitForTimeout(300);
  rec('role badge shown',/Founder/.test(await page.locator('#whoami').textContent()));

  // ---------- demo data sanity ----------
  const data=await page.evaluate(()=>({units:S.units.length,deals:S.deals.length,brands:S.brands.length,
    projects:S.projects.length,tasks:S.tasks.length,docs:S.documents.length,contacts:S.contacts.length,
    companies:S.companies.length,plans:S.floorPlans.length,
    demoFlag:S.units.every(u=>u.demoRecord===true),
    multiUnitDeal:S.deals.some(d=>d.unitIds.length>1),
    multiProspect:S.units.some(u=>S.deals.filter(d=>d.unitIds.includes(u.id)&&stageDef(d.type,d.stage).type==='open').length>=3),
    noArea:S.units.filter(u=>u.area.glaM2==null).length}));
  rec('30–50 units in demo',data.units>=30&&data.units<=50,'units: '+data.units);
  rec('20–30 brands',data.brands>=20&&data.brands<=30,'brands: '+data.brands);
  rec('2 projects',data.projects===2);
  rec('every unit flagged demoRecord',data.demoFlag);
  rec('a deal spans several units',data.multiUnitDeal);
  rec('a unit has 3+ prospects',data.multiProspect);
  rec('a unit deliberately has no area',data.noArea>=1,'units without area: '+data.noArea);
  rec('4 floor plans',data.plans===4);

  // ---------- KPI correctness ----------
  const kpi=await page.evaluate(()=>{
    const i=svcInventory();
    // a unit with several prospects must contribute its area exactly once
    const u=S.units.find(x=>S.deals.filter(d=>d.unitIds.includes(x.id)&&stageDef(d.type,d.stage).type==='open').length>=3);
    const bucketsHit=i.buckets.filter(b=>b.gla>0).length;
    return {total:i.totalGLA,sum:i.checkSum,balanced:i.balanced,noArea:i.unitsWithoutArea,
      multiUnit:u?u.area.glaM2:null,bucketsHit,
      leased:i.leasedGLA,avail:i.availableGLA,neg:i.negotiationGLA};
  });
  rec('inventory buckets partition measured GLA',kpi.balanced,'total '+kpi.total+' vs sum '+kpi.sum);
  rec('units without area excluded, not zeroed',kpi.noArea>=1);
  rec('several buckets are populated',kpi.bucketsHit>=4,'buckets with area: '+kpi.bucketsHit);
  const dealArea=await page.evaluate(()=>{
    const d=S.deals.find(x=>x.unitIds.length>1);
    const expect=d.unitIds.reduce((s,id)=>s+(byId(S.units,id).area.glaM2||0),0);
    return {got:svcDealArea(d),expect:Math.round(expect*10)/10};});
  rec('multi-unit deal area sums its units',Math.abs(dealArea.got-dealArea.expect)<0.2,
    'got '+dealArea.got+' expected '+dealArea.expect);

  // ---------- every internal view ----------
  const views=['dash','projects','project','plan','units','mix','leasing','sales','brands','companies',
               'contacts','requirements','tasks','activities','documents','reports','portal','settings','io','ask'];
  for(const v of views){
    errors.length=0;
    await page.evaluate(x=>go(x),v);
    await page.waitForTimeout(220);
    const txt=(await page.locator('#main').textContent()||'').trim();
    const failed=await page.locator('#main .banner.warn b').count().then(async n=>{
      if(!n)return false; const t=await page.locator('#main .banner.warn b').first().textContent();
      return /failed to render/i.test(t||'');});
    rec('view '+v+' renders',txt.length>60&&!failed,'chars '+txt.length+(errors.length?(' errors: '+errors.join('|')):''));
    rec('view '+v+' without JS errors',errors.length===0,errors.join(' | '));
  }

  // ---------- floor plan ----------
  await page.evaluate(()=>go('plan'));
  await page.waitForTimeout(450);
  const poly=await page.locator('#planhost svg [data-unit-id]').count();
  rec('plan has real clickable polygons',poly>=15,'bound polygons: '+poly);
  const before=await page.evaluate(()=>{const e=document.querySelector('#planhost svg [data-unit-id]');
    return {id:e.getAttribute('data-unit-id'),fill:e.style.fill};});
  await page.locator('#planhost svg [data-unit-id]').first().click();
  await page.waitForTimeout(300);
  rec('clicking a unit opens the drawer',await page.locator('#drawer.on').isVisible());
  const drawerUnit=await page.locator('#drawer h1').textContent();
  const expectCode=await page.evaluate(id=>byId(S.units,id).unitNumber,before.id);
  rec('drawer shows the clicked unit',drawerUnit.trim().startsWith(expectCode),'drawer: '+drawerUnit.trim()+' expected '+expectCode);
  // modes
  for(const mode of ['mix','target','manager','avail','status']){
    errors.length=0;
    await page.evaluate(m=>{UI.planMode=m;render();},mode);
    await page.waitForTimeout(300);
    const n=await page.locator('#planhost svg [data-unit-id]').count();
    const leg=await page.locator('#main .legend .li').count();
    rec('plan mode '+mode+' renders with legend',n>=15&&leg>=3,'polys '+n+' legend '+leg+(errors.length?(' err '+errors[0]):''));
  }
  // status change propagates to plan + KPI
  const sync=await page.evaluate(async()=>{
    const u=S.units.find(x=>x.commercialStatus==='available'&&x.area.glaM2!=null);
    const beforeLeased=svcInventory().leasedGLA;
    applyFieldAction('setUnitStatus',u.id,'contract');
    await new Promise(r=>setTimeout(r,200));
    const el=document.querySelector('[data-unit-id="'+u.id+'"]');
    const afterLeased=svcInventory().leasedGLA;
    return {unit:u.unitNumber,area:u.area.glaM2,beforeLeased,afterLeased,
      fill:el?el.style.fill:null,hist:S.statusHistory.filter(h=>h.refId===u.id).length,
      expected:Math.round((beforeLeased+u.area.glaM2)*10)/10};
  });
  rec('status change updates leased GLA correctly',Math.abs(sync.afterLeased-sync.expected)<0.2,
    sync.beforeLeased+' + '+sync.area+' = '+sync.afterLeased+' (expected '+sync.expected+')');
  rec('status change writes status history',sync.hist>=1);
  rec('plan colour follows the new status',!!sync.fill,'fill: '+sync.fill);

  // ---------- pipeline ----------
  await page.evaluate(()=>go('leasing'));
  await page.waitForTimeout(300);
  rec('kanban columns render',await page.locator('.kancol').count()>=6);
  const stageMove=await page.evaluate(async()=>{
    const d=S.deals.find(x=>x.type==='Leasing'&&x.stage==='lead');
    const from=d.stage;
    applyFieldAction('setDealStage',d.id,'qualified');
    await new Promise(r=>setTimeout(r,150));
    return {from,to:d.stage,hist:d.stageHistory.length};});
  rec('deal stage change recorded with history',stageMove.to==='qualified'&&stageMove.hist>=2,
    stageMove.from+' → '+stageMove.to+' history '+stageMove.hist);
  const lostGuard=await page.evaluate(()=>{
    const d=S.deals.find(x=>x.type==='Leasing'&&stageDef(x.type,x.stage).type==='open');
    const before=d.stage;
    const orig=window.prompt; window.prompt=()=>null;       // user cancels the reason
    applyFieldAction('setDealStage',d.id,'lost');
    window.prompt=orig;
    return {before,after:d.stage};});
  rec('Closed Lost without a reason is refused',lostGuard.before===lostGuard.after,
    lostGuard.before+' → '+lostGuard.after);

  // ---------- tools / Ask ----------
  const tool=await page.evaluate(()=>{
    const a=runTool('calculateVacantGLA',{}), b=runTool('nope',{});
    return {ok:a.ok,val:a.result.availableGLA,bad:b.ok,n:Object.keys(TOOLS).length};});
  rec('tool registry answers and refuses unknown tools',tool.ok&&!tool.bad&&tool.n>=18,'tools: '+tool.n);

  // ---------- persistence ----------
  await page.evaluate(()=>{persist();});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForTimeout(600);
  const keep=await page.evaluate(code=>{const u=S.units.find(x=>x.unitNumber===code);return u?u.commercialStatus:null;},sync.unit);
  rec('changes survive a reload',keep==='contract','status after reload: '+keep);
  rec('session survives a reload',await page.locator('#app').isVisible());

  // ---------- client role separation ----------
  await page.evaluate(()=>{const cu=S.users.find(u=>u.role==='client');doLogin(cu.id);});
  await page.waitForTimeout(400);
  const client=await page.evaluate(()=>{
    const cl=byId(S.clients,SESSION.clientId);
    const cv=svcClientView(cl.projectIds[0]);
    const txt=document.body.innerText;
    const otherProject=S.projects.find(p=>!cl.projectIds.includes(p.id));
    return {navItems:document.querySelectorAll('nav.side button').length,
      hasCommissionWord:/commission/i.test(txt),
      hasInternalNote:/Owner expects a monthly report/i.test(txt),
      seesOtherProject:otherProject?txt.includes(otherProject.name):false,
      cvHasCommission:JSON.stringify(cv).toLowerCase().includes('commission'),
      cvKeys:Object.keys(cv),
      visibleProjects:svcVisibleProjects().length,
      searchHidden:document.getElementById('globalSearch').style.display==='none'};});
  rec('client sees only assigned projects',client.visibleProjects===1,'visible: '+client.visibleProjects);
  rec('client view model carries no commission data',!client.cvHasCommission);
  rec('client UI shows no commission wording',!client.hasCommissionWord);
  rec('client cannot see internal notes',!client.hasInternalNote);
  rec('client does not see another client project',!client.seesOtherProject);
  rec('client navigation is reduced',client.navItems<=8,'nav items: '+client.navItems);
  // client plan + comment
  await page.evaluate(()=>go('cplan'));
  await page.waitForTimeout(450);
  const cpoly=await page.locator('#planhost svg [data-unit-id]').count();
  rec('client floor plan renders clickable units',cpoly>=10,'polys: '+cpoly);
  await page.locator('#planhost svg [data-unit-id]').first().click();
  await page.waitForTimeout(250);
  const cdrawer=(await page.locator('#drawer').textContent()||'');
  rec('client unit drawer hides commercial terms',!/Asking rent|Agreed rent|Commission/i.test(cdrawer));
  const before2=await page.evaluate(()=>S.comments.length);
  await page.locator('#clientComment').fill('Test question from the owner about this unit.');
  await page.locator('[data-act="postClientComment"]').click();
  await page.waitForTimeout(300);
  const after2=await page.evaluate(()=>S.comments.length);
  rec('client can post a comment',after2===before2+1);

  // internal user sees the new comment
  await page.evaluate(()=>{doLogin(S.users[0].id);go('portal');});
  await page.waitForTimeout(400);
  rec('client comment appears internally',
    (await page.locator('#main').textContent()).includes('Test question from the owner'));

  // ---------- reports & print ----------
  await page.evaluate(()=>{go('reports');REPORT_KIND='client';render();});
  await page.waitForTimeout(350);
  // the report itself is the card; the tab bar above it is page chrome and is .noprint
  const rep=await page.locator('#main .card').first().textContent();
  rec('client report renders with live figures',/Executive summary/.test(rep)&&/m²/.test(rep));
  // the report ends with a disclaimer that names commissions; exclude that sentence,
  // then assert no commission figure, internal task wording or negotiation detail leaked
  const repBody=rep.replace(/This report excludes[^.]*\./g,'');
  rec('client report excludes commission data',
    !/commission (pending|received|invoice|schedule)|gross commission|manager share/i.test(repBody),
    (repBody.match(/[^.]*commission[^.]*\./i)||[''])[0].slice(0,120));
  rec('client report excludes internal task wording',
    !/issue commission invoice|internal|negotiation notes/i.test(repBody));
  await page.emulateMedia({media:'print'});
  await page.waitForTimeout(200);
  const navHidden=await page.evaluate(()=>getComputedStyle(document.querySelector('nav.side')).display==='none');
  rec('print stylesheet hides navigation',navHidden);
  const pdf=path.join(OUT,'lsp_client_report.pdf');
  await page.pdf({path:pdf,format:'A4',printBackground:true});
  rec('report exports to PDF',fs.existsSync(pdf)&&fs.statSync(pdf).size>8000,
    'bytes: '+(fs.existsSync(pdf)?fs.statSync(pdf).size:0));
  await page.emulateMedia({media:'screen'});

  // ---------- export ----------
  const csv=await page.evaluate(()=>{
    let captured=null;
    const orig=URL.createObjectURL; URL.createObjectURL=b=>{captured=b;return 'blob:x';};
    ACTIONS.exportUnitsCsv(); URL.createObjectURL=orig;
    return captured?captured.size:0;});
  rec('units CSV export produces a file',csv>500,'bytes: '+csv);

  // ---------- responsive ----------
  for(const vp of [[1920,1080],[1440,900],[1366,768],[1024,768],[820,1180],[390,844]]){
    await page.setViewportSize({width:vp[0],height:vp[1]});
    await page.evaluate(()=>go('dash'));
    await page.waitForTimeout(280);
    const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    rec('no horizontal overflow at '+vp[0]+'×'+vp[1],over<=2,'overflow px: '+over);
    await page.screenshot({path:path.join(OUT,'lsp_'+vp[0]+'x'+vp[1]+'.png'),fullPage:false});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>go('plan'));
  await page.waitForTimeout(400);
  await page.screenshot({path:path.join(OUT,'lsp_plan.png')});
  await page.evaluate(()=>go('dash'));
  await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,'lsp_dashboard.png')});

  // ---------- file:// (opens from disk) ----------
  const p2=await browser.newPage();
  const fileErrors=[];
  p2.on('pageerror',e=>fileErrors.push(String(e.message).slice(0,140)));
  await p2.goto('file://'+path.join(DIR,'index.html'),{waitUntil:'domcontentloaded'});
  await p2.waitForTimeout(600);
  const fileOk=await p2.evaluate(()=>{doLogin(S.users[0].id);return S.units.length;});
  await p2.waitForTimeout(400);
  rec('opens from disk (file://) with demo data',fileOk>=30&&fileErrors.length===0,
    'units '+fileOk+' errors '+fileErrors.join('|'));
  const filePoly=await p2.evaluate(()=>{go('plan');return new Promise(r=>setTimeout(()=>r(
    document.querySelectorAll('#planhost svg [data-unit-id]').length),500));});
  rec('floor plan works from disk',filePoly>=15,'polys: '+filePoly);

  await browser.close(); srv.close();
  const pass=results.filter(r=>r.status==='PASS').length;
  fs.writeFileSync(path.join(OUT,'lsp_e2e.json'),JSON.stringify({
    tool:'lsp_e2e.js',at:new Date().toISOString().slice(0,19)+'Z',dir:DIR,
    summary:{total:results.length,pass,fail:results.length-pass},results},null,1));
  console.log(results.map(r=>(r.status==='PASS'?'  ok  ':'  FAIL')+' '+r.test+(r.info?('  ['+r.info+']'):'')).join('\n'));
  console.log('\n'+pass+'/'+results.length+' passed');
})().catch(e=>{console.error('RUNNER ERROR',e);process.exit(1);});
