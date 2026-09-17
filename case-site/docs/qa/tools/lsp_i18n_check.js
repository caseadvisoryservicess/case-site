/* LSP — translation coverage check.
   Visits every screen in every language, collects the visible text, and reports any
   string that has a translation in the dictionary but is still rendering in English.
   Run: node docs/qa/tools/lsp_i18n_check.js /path/to/os/leasing [outdir] */
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright-core');
const DIR=path.resolve(process.argv[2]||'.');
const OUT=path.resolve(process.argv[3]||path.join(__dirname,'../lsp'));
const CHROME=process.env.CHROME_BIN||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(OUT,{recursive:true});
const VIEWS=['dash','projects','project','plan','units','mix','leasing','sales','brands','companies',
             'contacts','requirements','tasks','activities','documents','reports','portal','settings','io','ask'];
const CLIENT_VIEWS=['cdash','cplan','cdocs','creport','ccomments'];

(async()=>{
  const srv=http.createServer((req,rsp)=>{
    let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
    const f=path.join(DIR,p);
    if(!f.startsWith(DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rsp.writeHead(404);rsp.end();return;}
    rsp.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});fs.createReadStream(f).pipe(rsp);
  });
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+srv.address().port;
  const browser=await chromium.launch({executablePath:CHROME,args:['--no-sandbox','--no-proxy-server']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e.message).slice(0,140)));
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{S=freshDemo();persist();doLogin(S.users[0].id);});
  await page.waitForTimeout(300);

  // Second, stronger pass: in a non-English interface any Latin word that is not data
  // and not a technical token is a missed translation, including text built by concatenation.
  async function latinLeaks(page,lang){
    return await page.evaluate(()=>{
      const KEEP=new Set(['Ctrl','GLA','GBA','LOI','CSV','JSON','PDF','SVG','USD','UZS','EUR','CASE','OS','LSP',
        'CRM','KPI','ID','OBJECTS','BRANDS','ASH','ADM','DIR','EN','RU','UZ','PROJ','UNIT','DEAL','BRAND',
        'COMP','CONT','TASK','DOC','RPT','SH','AUD','FLOOR','BLDG','REQ','ACT','CMT','SCR','VAT','NOI']);
      // everything the demo dataset can legitimately print in Latin
      const data=new Set();
      const add=v=>{if(typeof v==='string')v.split(/[\s,()\/·—–-]+/).forEach(w=>{if(w)data.add(w);});};
      (S.projects||[]).forEach(p=>{add(p.name);add(p.city);add(p.address);add(p.country);(p.assetTypes||[]).forEach(add);});
      (S.brands||[]).forEach(b=>{add(b.name);add(b.legalName);add(b.countryOfOrigin);
        add(b.classification&&b.classification.subcategory);add(b.classification&&b.classification.format);
        add(b.classification&&b.classification.priceSegment);
        add(b.expansionRequirements&&b.expansionRequirements.openingTimeline);});
      (S.companies||[]).forEach(c=>{add(c.legalName);add(c.tradingName);add(c.industry);add(c.country);});
      (S.contacts||[]).forEach(c=>{add(c.firstName);add(c.lastName);add(c.position);add(c.city);add(c.country);
        (c.emails||[]).forEach(add);add(c.preferredLanguage);});
      (S.users||[]).forEach(u=>{add(u.name);add(u.title);});
      (S.clients||[]).forEach(c=>{add(c.name);add(c.country);});
      (S.units||[]).forEach(u=>{add(u.unitNumber);add(u.label);add(u.actualUse&&u.actualUse.tenantName);
        add(u.targetUse&&u.targetUse.subcategory);add(u.leasingTerms&&u.leasingTerms.rentUnit);
        add(u.leasingTerms&&u.leasingTerms.leaseTerm);add(u.operational&&u.operational.nextAction);});
      (S.tasks||[]).forEach(t=>add(t.title));
      (S.documents||[]).forEach(d=>{add(d.fileName);});
      (S.activities||[]).forEach(a=>add(a.text));
      (S.comments||[]).forEach(c=>add(c.text));
      (S.floors||[]).forEach(f=>add(f.name));
      (S.buildings||[]).forEach(b=>add(b.name));
      (S.requirements||[]).forEach(r=>add(r.text));
      (S.projects||[]).forEach(p=>{((p.notes||{}).internal||[]).forEach(add);((p.notes||{}).clientVisible||[]).forEach(add);
        add(p.commercial&&p.commercial.leasingMandateType);add(p.commercial&&p.commercial.salesMandateType);
        add(p.commercial&&p.commercial.mandateMode);add(p.commercial&&p.commercial.pricingNotes);});
      const out=[];const seen=new Set();
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
      while(n=w.nextNode()){
        const el=n.parentElement;
        if(!el||el.closest('script,style,code'))continue;
        if(!el.offsetParent&&!el.closest('svg'))continue;
        const txt=(n.nodeValue||'').trim();
        if(!txt)continue;
        const words=txt.match(/[A-Za-z][A-Za-z'\u2019-]{2,}/g)||[];
        const bad=words.filter(x=>!KEEP.has(x)&&!KEEP.has(x.toUpperCase())&&!data.has(x)&&
          !/^[A-Z]{2,}$/.test(x)&&!/^[A-Z][a-z]+$/.test(x.slice(0,1)+x.slice(1))===false&&!data.has(x.replace(/[\u2019'].*$/,'')));
        const real=words.filter(x=>!KEEP.has(x)&&!KEEP.has(x.toUpperCase())&&!data.has(x));
        if(real.length&&!seen.has(txt)){seen.add(txt);out.push(txt.slice(0,110)+'   {'+real.slice(0,4).join(' ')+'}');}
      }
      return out;});
  }

  const report={};
  for(const lang of ['ru','uz']){
    await page.evaluate(l=>{UI.lang=l;LANG=l;applyStaticI18n();renderNav();render();},lang);
    await page.waitForTimeout(250);
    const found=new Set();
    const views=VIEWS.slice();
    for(const v of views){
      await page.evaluate(x=>go(x),v);
      await page.waitForTimeout(200);
      // open a drawer and a modal too, they hold many strings
      if(v==='units'||v==='plan'){
        await page.evaluate(()=>{const u=S.units[1];if(u)openUnitDrawer(u.id);});
        await page.waitForTimeout(150);
      }
      if(v==='leasing'){
        await page.evaluate(()=>{const d=S.deals[0];if(d)openDealDrawer(d.id);});
        await page.waitForTimeout(150);
      }
      if(v==='brands'){
        await page.evaluate(()=>{const b=S.brands[0];if(b)openBrandDrawer(b.id);});
        await page.waitForTimeout(150);
      }
      const miss=await page.evaluate(l=>{
        const dict=I18N[l]||{};
        const out=[];
        const seen=new Set();
        // words that are demo DATA, not interface text (a contact whose job title is "Owner")
        const DATA_WORDS=new Set(['Owner','Country Manager','Expansion Manager','Development Director',
          'Franchise Manager','Regional Manager','Tashkent','Uzbekistan','Contract','Report','Brochure',
          'Presentation','Photo','Invoice']);
        const scan=root=>{
          const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
          let n;
          while(n=w.nextNode()){
            const el=n.parentElement;
            if(!el||el.closest('script,style,code'))continue;   // <code> holds identifiers, not interface text
            if(!el.offsetParent&&el.tagName!=='TITLE'&&!el.closest('svg'))continue;
            const txt=(n.nodeValue||'').trim();
            if(!txt||seen.has(txt))continue;
            seen.add(txt);
            if(dict[txt]&&dict[txt]!==txt&&!(DATA_WORDS.has(txt)&&el.closest('td,li')))out.push(txt);
          }
        };
        scan(document.body);
        // attributes that are user-visible
        document.querySelectorAll('[placeholder],[title]').forEach(el=>{
          ['placeholder','title'].forEach(a=>{
            const v=el.getAttribute(a);
            if(v&&dict[v]&&dict[v]!==v&&!seen.has('@'+v)){seen.add('@'+v);out.push(a+': '+v);}
          });
        });
        return out;
      },lang);
      miss.forEach(m=>found.add(v+' :: '+m));
      // Uzbek is written in Latin script, so the English-word scan only makes sense for Russian
      if(lang==='ru')(await latinLeaks(page,lang)).forEach(m=>found.add('LATIN '+v+' :: '+m));
      await page.evaluate(()=>closeDrawer());
    }
    // client role
    await page.evaluate(()=>{const cu=S.users.find(u=>u.role==='client');doLogin(cu.id);});
    await page.evaluate(l=>{UI.lang=l;LANG=l;applyStaticI18n();renderNav();render();},lang);
    for(const v of CLIENT_VIEWS){
      await page.evaluate(x=>go(x),v);
      await page.waitForTimeout(200);
      const miss=await page.evaluate(l=>{
        const dict=I18N[l]||{};const out=[];const seen=new Set();
        const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
        while(n=w.nextNode()){
          const el=n.parentElement;
          if(!el||el.closest('script,style,code')||(!el.offsetParent&&!el.closest('svg')))continue;
          const txt=(n.nodeValue||'').trim();
          if(!txt||seen.has(txt))continue; seen.add(txt);
          if(dict[txt]&&dict[txt]!==txt)out.push(txt);
        }
        return out;},lang);
      miss.forEach(m=>found.add(v+' :: '+m));
    }
    await page.evaluate(()=>{doLogin(S.users[0].id);});
    report[lang]=[...found].sort();
  }
  await browser.close();srv.close();
  const total=report.ru.length+report.uz.length;
  fs.writeFileSync(path.join(OUT,'lsp_i18n_check.json'),JSON.stringify({
    tool:'lsp_i18n_check.js',at:new Date().toISOString().slice(0,19)+'Z',
    summary:{untranslatedRu:report.ru.length,untranslatedUz:report.uz.length,pageErrors:errors.length},
    untranslated:report,pageErrors:errors},null,1));
  console.log('RU still English:',report.ru.length);
  report.ru.slice(0,40).forEach(x=>console.log('   ',x));
  console.log('UZ still English:',report.uz.length);
  report.uz.slice(0,15).forEach(x=>console.log('   ',x));
  if(errors.length)console.log('page errors:',errors.slice(0,5));
  process.exitCode=total?1:0;
})().catch(e=>{console.error('RUNNER ERROR',e);process.exit(1);});
