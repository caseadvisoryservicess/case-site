/* CASE OS v4.9.3 — Financial Feasibility integration.
   Keeps the model's existing workspace intact inside a protected CASE OS shell.
   Access is controlled by the configurable CASE OS workspace and endpoint action rights. */
(function(){
  'use strict';
  if(window.ASAAS_FEASIBILITY_V400) return;
  window.ASAAS_FEASIBILITY_V400=true;

  var LS_KEY='asaas-os-v4-feasibility-records';
  var F={records:[],current:null,project:null,status:'draft',loading:false,frameReady:false,versionsOpen:false,focus:false,clientMode:false};

  function role(){try{return String(S&&S.role||'');}catch(e){return '';}}
  function allowed(){try{return typeof window.caseWorkspaceCanOpen!=='function'||!!window.caseWorkspaceCanOpen('feasibility');}catch(e){return true;}}
  function lang(){try{return typeof LANG==='string'?LANG:'ru';}catch(e){return 'ru';}}
  function tr(ru,uz,en){return lang()==='uz'?uz:(lang()==='en'?en:ru);}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function main(){return document.getElementById('main');}
  function frame(){return document.getElementById('feasFrame');}
  function objByKey(id){try{return (OBJECTS||[]).find(function(o){return String(o.id)===String(id);})||null;}catch(e){return null;}}
  function nowIso(){return new Date().toISOString();}
  function uid(){try{return crypto.randomUUID();}catch(e){return 'fm-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);}}
  function isBackend(){try{return !!BACKEND;}catch(e){return false;}}
  function currentTheme(){try{return String(THEME||'light');}catch(e){return 'light';}}
  function currentProjectId(){
    var v=F.project;
    if(v==null){try{v=S&&S.obj;}catch(e){};}
    if(!v||v==='all')v='ALL';
    return String(v);
  }
  function projectLabel(id){
    if(!id||id==='ALL')return tr('Весь портфель','Butun portfel','All portfolio');
    var o=objByKey(id);return o?(o.ru||o.name||id):id;
  }
  function statusLabel(s){
    var m={draft:["Черновик","Qoralama","Draft"],review:["На проверке","Tekshiruvda","In review"],approved:["Утверждено","Tasdiqlangan","Approved"],archived:["Архив","Arxiv","Archived"]};
    var a=m[s]||m.draft;return lang()==='uz'?a[1]:(lang()==='en'?a[2]:a[0]);
  }
  function fmtDate(v){if(!v)return '—';try{return new Date(String(v).replace(' ','T')).toLocaleString(lang()==='uz'?'uz-UZ':(lang()==='en'?'en-GB':'ru-RU'),{dateStyle:'medium',timeStyle:'short'});}catch(e){return String(v);}}
  function roleDenied(){
    var el=main();if(!el)return;
    el.innerHTML='<div class="card" style="max-width:760px;margin:36px auto"><h2 style="margin-top:0">'+h(tr('Финансовая модель','Moliyaviy model','Financial model'))+'</h2><p style="color:var(--muted)">'+h(tr('Раздел не включён в вашу рабочую область. Администратор может открыть его в матрице доступа.','Bo‘lim ish sohangizga kiritilmagan. Administrator uni ruxsatlar matritsasida ochishi mumkin.','This module is not enabled for your workspace. An administrator can enable it in the access matrix.'))+'</p></div>';
  }
  function projectOptions(){
    var selected=currentProjectId();
    var out='<option value="ALL"'+(selected==='ALL'?' selected':'')+'>'+h(tr('Весь портфель','Butun portfel','All portfolio'))+'</option>';
    try{(OBJECTS||[]).forEach(function(o){var id=String(o.id);out+='<option value="'+h(id)+'"'+(id===selected?' selected':'')+'>'+h(o.ru||o.name||id)+'</option>';});}catch(e){}
    return out;
  }
  function visibleRecords(){
    var p=currentProjectId();
    return F.records.filter(function(r){return p==='ALL'?String(r.obj_id||'ALL')==='ALL':String(r.obj_id||'')===p;});
  }
  function scenarioOptions(){
    var rows=visibleRecords();
    var out='<option value="">'+h(tr('— новая модель —','— yangi model —','— new model —'))+'</option>';
    rows.forEach(function(r){
      var label=(r.scenario_name||tr('Без названия','Nomsiz','Untitled'))+' · '+statusLabel(r.status||'draft')+' · r'+(+r.revision||1);
      out+='<option value="'+h(r.id)+'"'+(F.current&&String(F.current.id)===String(r.id)?' selected':'')+'>'+h(label)+'</option>';
    });
    return out;
  }
  function renderShell(){
    if(!allowed()){roleDenied();return;}
    var el=main();if(!el)return;
    if(F.project==null){try{F.project=(S&&S.obj&&S.obj!=='all')?S.obj:'ALL';}catch(e){F.project='ALL';}}
    var rec=F.current;
    el.innerHTML=''
      +'<section class="feas-v4">'
      +'<div class="feas-v4-head">'
      +'<div><div class="feas-v4-kicker">CASE OS v4.9.3</div><h2>'+h(tr('Финансовая модель проекта','Loyiha moliyaviy modeli','Project financial model'))+'</h2><p>'+h(tr('Инвестиционная оценка торговых центров, гостиниц, бизнес-центров и mixed-use проектов.','Savdo markazlari, mehmonxonalar, biznes markazlari va mixed-use loyihalarini investitsion baholash.','Investment appraisal for malls, hotels, business centres and mixed-use projects.'))+'</p></div>'
      +'<div class="feas-v4-access"><b>'+h(tr('НАСТРАИВАЕМЫЙ ДОСТУП','SOZLANADIGAN RUXSAT','CONFIGURABLE ACCESS'))+'</b><span>'+h(tr('права задаёт администратор','ruxsatni administrator belgilaydi','administrator-controlled workspace'))+'</span></div>'
      +'</div>'
      +'<div class="feas-v4-toolbar">'
      +'<label><span>'+h(tr('Проект','Loyiha','Project'))+'</span><select id="feasProject" onchange="feasV4SetProject(this.value)">'+projectOptions()+'</select></label>'
      +'<label class="feas-v4-grow"><span>'+h(tr('Сценарий','Ssenariy','Scenario'))+'</span><select id="feasScenario" onchange="feasV4Select(this.value)">'+scenarioOptions()+'</select></label>'
      +'<label><span>'+h(tr('Статус','Holat','Status'))+'</span><select id="feasStatus" onchange="feasV4Status(this.value)">'
      +['draft','review','approved','archived'].map(function(s){return '<option value="'+s+'"'+(F.status===s?' selected':'')+'>'+h(statusLabel(s))+'</option>';}).join('')+'</select></label>'
      +'<div class="feas-v4-actions">'
      +'<button class="btn ghost sm" id="feasFocusBtn" onclick="feasV4Focus()">⛶ '+h(tr('На весь экран','To‘liq ekran','Full screen'))+'</button>'
      +'<button class="btn ghost sm" onclick="feasV4New()">＋ '+h(tr('Новая','Yangi','New'))+'</button>'
      +'<button class="btn ghost sm" onclick="feasV4LoadSelected()">↻ '+h(tr('Открыть','Ochish','Open'))+'</button>'
      +'<button class="btn ghost sm" onclick="feasV4Versions()"'+(rec?'':' disabled')+'>⟲ '+h(tr('Версии','Versiyalar','Versions'))+'</button>'
      +'<button class="btn ghost sm feas-danger" onclick="feasV4Delete()"'+(rec?'':' disabled')+'>× '+h(tr('Удалить','O‘chirish','Delete'))+'</button>'
      +'</div></div>'
      +'<div class="feas-v4-meta" id="feasMeta">'+metaHtml()+'</div>'
      +'<div class="feas-v4-framewrap"><div class="feas-v4-loader" id="feasLoader">'+h(tr('Загрузка финансовой модели…','Moliyaviy model yuklanmoqda…','Loading financial model…'))+'</div><iframe id="feasFrame" title="CASE Financial Feasibility" src="feasibility-studio.html?embedded=1&amp;lang='+encodeURIComponent(lang())+'&amp;v=4.9.3" loading="eager"></iframe></div>'
      +'<div id="feasVersionsModal" class="feas-v4-modal" aria-hidden="true"></div>'
      +'</section>';
    F.frameReady=false;
  }
  function metaHtml(){
    if(!F.current)return '<span>'+h(tr('Новая несохранённая модель','Yangi saqlanmagan model','New unsaved model'))+'</span><span>'+h(projectLabel(currentProjectId()))+'</span>';
    return '<span><b>'+h(F.current.scenario_name||'—')+'</b></span><span>'+h(projectLabel(F.current.obj_id))+'</span><span>'+h(statusLabel(F.current.status||'draft'))+'</span><span>r'+h(F.current.revision||1)+'</span><span>'+h(tr('Изменено','Yangilangan','Updated'))+': '+h(fmtDate(F.current.updated_at))+(F.current.updated_by_name?' · '+h(F.current.updated_by_name):'')+'</span>';
  }
  function updateControls(){
    var p=document.getElementById('feasProject');if(p)p.value=currentProjectId();
    var s=document.getElementById('feasScenario');if(s)s.innerHTML=scenarioOptions();
    var st=document.getElementById('feasStatus');if(st)st.value=F.status;
    var m=document.getElementById('feasMeta');if(m)m.innerHTML=metaHtml();
  }
  function showLoader(on,msg){var x=document.getElementById('feasLoader');if(!x)return;x.style.display=on?'flex':'none';if(msg)x.textContent=msg;}
  function setFocus(on){
    F.focus=!!on;var s=document.querySelector('.feas-v4');if(s)s.classList.toggle('focus',F.focus);document.body.classList.toggle('feas-focus',F.focus);
    var b=document.getElementById('feasFocusBtn');if(b)b.innerHTML=(F.focus?'↙ ':'⛶ ')+h(F.focus?tr('Вернуться','Qaytish','Exit full screen'):tr('На весь экран','To‘liq ekran','Full screen'));
  }
  function setClientMode(on){
    F.clientMode=!!on;var s=document.querySelector('.feas-v4');if(s)s.classList.toggle('client-mode',F.clientMode);setFocus(F.clientMode);
  }
  function postContext(){
    var fr=frame();if(!fr||!fr.contentWindow||!F.frameReady)return;
    var project=objByKey(currentProjectId());
    fr.contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-feasibility-context',context:{theme:currentTheme(),lang:lang(),project:project,activeRecord:F.current}},location.origin);
  }
  function localRows(){try{var x=JSON.parse(localStorage.getItem(LS_KEY)||'[]');return Array.isArray(x)?x:[];}catch(e){return [];}}
  function saveLocalRows(rows){try{localStorage.setItem(LS_KEY,JSON.stringify(rows));}catch(e){throw new Error(tr('Не удалось сохранить локально','Mahalliy saqlash amalga oshmadi','Could not save locally'));}}
  async function loadList(preferred){
    if(!allowed())return;
    F.loading=true;showLoader(true,tr('Загрузка сценариев…','Ssenariylar yuklanmoqda…','Loading scenarios…'));
    try{
      if(isBackend()){
        var j=await apiGET('feasibility_models.php');F.records=Array.isArray(j&&j.records)?j.records:[];
      }else F.records=localRows();
      if(preferred){var found=F.records.find(function(r){return String(r.id)===String(preferred);});if(found)await loadRecord(found.id,false);}
      updateControls();
    }catch(e){toast(tr('Ошибка финансовой модели: ','Moliyaviy model xatosi: ','Financial model error: ')+(e&&e.message||e));}
    finally{F.loading=false;showLoader(false);}
  }
  async function loadRecord(id,notify){
    if(!id){newModel(false);return;}
    showLoader(true,tr('Открываю сценарий…','Ssenariy ochilmoqda…','Opening scenario…'));
    try{
      var rec;
      if(isBackend()){
        var j=await apiGET('feasibility_models.php?id='+encodeURIComponent(id));rec=j&&j.record;
      }else rec=localRows().find(function(r){return String(r.id)===String(id);});
      if(!rec)throw new Error(tr('Сценарий не найден','Ssenariy topilmadi','Scenario not found'));
      F.current=rec;F.project=rec.obj_id||'ALL';F.status=rec.status||'draft';
      updateControls();
      if(F.frameReady&&frame())frame().contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-feasibility-load',record:rec},location.origin);
      else postContext();
      if(notify!==false)toast(tr('Сценарий открыт','Ssenariy ochildi','Scenario opened'));
    }catch(e){toast((e&&e.message)||String(e));}
    finally{showLoader(false);}
  }
  function newModel(reload){
    F.current=null;F.status='draft';updateControls();
    if(reload!==false){var fr=frame();if(fr){F.frameReady=false;fr.src='feasibility-studio.html?embedded=1&lang='+encodeURIComponent(lang())+'&v=4.9.3&t='+Date.now();showLoader(true);}}
  }
  async function saveRecord(msg){
    if(!allowed())return;
    var model=msg&&msg.state;if(!model||typeof model!=='object')return;
    var name=String((msg&&msg.name)||(model.project&&model.project.name)||tr('Финансовая модель','Moliyaviy model','Financial model')).trim();
    var obj=currentProjectId();
    showLoader(true,tr('Сохраняю сценарий…','Ssenariy saqlanmoqda…','Saving scenario…'));
    try{
      if(isBackend()){
        var out=await apiPOST('feasibility_models.php',{action:'save',id:F.current&&F.current.id||'',expected_revision:F.current&&F.current.revision||0,obj_id:obj,scenario_name:name,status:F.status,model:model});
        await loadList(out.id);
      }else{
        var rows=localRows(),id=F.current&&F.current.id||uid(),i=rows.findIndex(function(r){return String(r.id)===String(id);});
        var old=i>=0?rows[i]:null,rev=old?(+old.revision||1)+1:1,at=nowIso();
        var versions=(old&&Array.isArray(old.versions)?old.versions.slice():[]);
        versions.unshift({revision:rev,status:F.status,model:JSON.parse(JSON.stringify(model)),saved_by_name:(S.user&&S.user.name)||'-',saved_at:at});
        if(versions.length>30)versions.length=30;
        var rec={id:id,obj_id:obj,scenario_name:name,status:F.status,model:model,revision:rev,versions:versions,created_at:old&&old.created_at||at,updated_at:at,created_by_name:old&&old.created_by_name||(S.user&&S.user.name)||'-',updated_by_name:(S.user&&S.user.name)||'-'};
        if(i>=0)rows[i]=rec;else rows.unshift(rec);saveLocalRows(rows);F.records=rows;F.current=rec;updateControls();postContext();
      }
      toast(tr('Финансовая модель сохранена','Moliyaviy model saqlandi','Financial model saved'));
    }catch(e){toast(tr('Не удалось сохранить: ','Saqlab bo‘lmadi: ','Could not save: ')+(e&&e.message||e));}
    finally{showLoader(false);}
  }
  async function deleteCurrent(){
    if(!F.current)return;
    if(!confirm(tr('Удалить финансовую модель «','«','Delete financial model “')+(F.current.scenario_name||'')+tr('»? Все её версии также будут удалены.','» moliyaviy model o‘chirilsinmi? Barcha versiyalar ham o‘chadi.','”? All of its versions will also be deleted.')))return;
    showLoader(true,tr('Удаляю…','O‘chirilmoqda…','Deleting…'));
    try{
      if(isBackend())await apiPOST('feasibility_models.php',{action:'delete',id:F.current.id});
      else{var rows=localRows().filter(function(r){return String(r.id)!==String(F.current.id);});saveLocalRows(rows);}
      F.current=null;F.status='draft';await loadList();newModel(true);toast(tr('Модель удалена','Model o‘chirildi','Model deleted'));
    }catch(e){toast(tr('Не удалось удалить: ','O‘chirib bo‘lmadi: ','Could not delete: ')+(e&&e.message||e));showLoader(false);}
  }
  async function openVersions(){
    if(!F.current)return;
    var rec=F.current;
    if(isBackend()&&(!Array.isArray(rec.versions))){try{var j=await apiGET('feasibility_models.php?id='+encodeURIComponent(rec.id));rec=j.record;F.current=rec;}catch(e){toast(e.message||e);return;}}
    var versions=Array.isArray(rec.versions)?rec.versions:[];
    var modal=document.getElementById('feasVersionsModal');if(!modal)return;
    modal.innerHTML='<div class="feas-v4-dialog"><div class="feas-v4-dialoghead"><div><b>'+h(tr('История версий','Versiyalar tarixi','Version history'))+'</b><small>'+h(rec.scenario_name||'')+'</small></div><button onclick="feasV4CloseVersions()">×</button></div><div class="feas-v4-versionlist">'
      +(versions.length?versions.map(function(v){return '<div class="feas-v4-version"><div><b>r'+h(v.revision)+'</b><span class="feas-status '+h(v.status||'draft')+'">'+h(statusLabel(v.status||'draft'))+'</span><small>'+h(fmtDate(v.saved_at))+(v.saved_by_name?' · '+h(v.saved_by_name):'')+'</small></div><button class="btn ghost sm" onclick="feasV4Restore('+Number(v.revision)+')">'+h(tr('Восстановить','Tiklash','Restore'))+'</button></div>';}).join(''):'<div class="feas-v4-empty">'+h(tr('История пока пуста','Tarix hozircha bo‘sh','No version history yet'))+'</div>')
      +'</div><div class="feas-v4-dialogfoot"><button class="btn ghost sm" onclick="feasV4CloseVersions()">'+h(tr('Закрыть','Yopish','Close'))+'</button></div></div>';
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  }
  function closeVersions(){var m=document.getElementById('feasVersionsModal');if(m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}}
  async function restoreRevision(rev){
    if(!F.current)return;
    if(!confirm(tr('Восстановить версию r','r','Restore revision r')+rev+'?'))return;
    closeVersions();showLoader(true,tr('Восстанавливаю версию…','Versiya tiklanmoqda…','Restoring revision…'));
    try{
      if(isBackend()){
        await apiPOST('feasibility_models.php',{action:'restore',id:F.current.id,revision:rev});await loadRecord(F.current.id,false);await loadList();
      }else{
        var rows=localRows(),i=rows.findIndex(function(r){return String(r.id)===String(F.current.id);}),rec=rows[i];
        var v=rec&&Array.isArray(rec.versions)&&rec.versions.find(function(x){return +x.revision===+rev;});if(!v)throw new Error(tr('Версия не найдена','Versiya topilmadi','Version not found'));
        var at=nowIso(),newRev=(+rec.revision||1)+1;rec.model=JSON.parse(JSON.stringify(v.model));rec.status=v.status||'draft';rec.revision=newRev;rec.updated_at=at;rec.updated_by_name=(S.user&&S.user.name)||'-';rec.versions.unshift({revision:newRev,status:rec.status,model:JSON.parse(JSON.stringify(rec.model)),saved_by_name:rec.updated_by_name,saved_at:at});if(rec.versions.length>30)rec.versions.length=30;saveLocalRows(rows);F.current=rec;F.records=rows;F.status=rec.status;updateControls();frame().contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-feasibility-load',record:rec},location.origin);
      }
      toast(tr('Версия восстановлена как новая ревизия','Versiya yangi reviziya sifatida tiklandi','Version restored as a new revision'));
    }catch(e){toast(tr('Не удалось восстановить: ','Tiklab bo‘lmadi: ','Could not restore: ')+(e&&e.message||e));}
    finally{showLoader(false);}
  }
  function css(){
    if(document.getElementById('feasV4Css'))return;
    var st=document.createElement('style');st.id='feasV4Css';st.textContent=''
      +'.feas-v4{margin:-2px;min-width:0}.feas-v4-head{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:14px}.feas-v4-head h2{margin:3px 0 5px;font-size:24px;letter-spacing:-.5px}.feas-v4-head p{margin:0;color:var(--muted);font-size:12.5px;max-width:820px}.feas-v4-kicker{font-size:9.5px;letter-spacing:1.8px;text-transform:uppercase;font-weight:800;color:var(--red)}.feas-v4-access{display:flex;flex-direction:column;align-items:flex-end;background:#fff;border:1px solid var(--border);border-left:4px solid var(--red);padding:8px 12px;border-radius:9px;white-space:nowrap}.feas-v4-access b{font-size:11px;color:var(--red-d)}.feas-v4-access span{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}.feas-v4-toolbar{display:flex;align-items:flex-end;gap:9px;background:var(--panel);border:1px solid var(--border);border-radius:12px 12px 0 0;padding:10px 12px}.feas-v4-toolbar label{display:flex;flex-direction:column;gap:4px;min-width:150px}.feas-v4-toolbar label>span{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);font-weight:700}.feas-v4-toolbar select{font-family:inherit;font-size:11.5px;font-weight:600;border:1px solid var(--border);border-radius:8px;background:#fff;padding:7px 9px;max-width:260px}.feas-v4-toolbar .feas-v4-grow{flex:1}.feas-v4-toolbar .feas-v4-grow select{max-width:none;width:100%}.feas-v4-actions{display:flex;gap:6px;flex-wrap:wrap}.feas-v4-actions button:disabled{opacity:.38;cursor:not-allowed}.feas-danger{color:var(--red-d)!important;border-color:#e8c4c4!important}.feas-v4-meta{display:flex;gap:12px;flex-wrap:wrap;background:#fff;border-left:1px solid var(--border);border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:7px 12px;font-size:10.5px;color:var(--muted)}.feas-v4-framewrap{position:relative;background:#fff;border:1px solid var(--border);border-top:0;border-radius:0 0 12px 12px;overflow:hidden;box-shadow:var(--shadow)}.feas-v4-framewrap iframe{display:block;width:100%;height:calc(100vh - 215px);min-height:720px;border:0;background:#f7f5f2}.feas-v4-loader{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.82);backdrop-filter:blur(2px);font-size:12px;font-weight:700;color:var(--red-d)}.feas-v4-modal{position:fixed;inset:0;background:rgba(0,0,0,.38);z-index:230;display:none;align-items:center;justify-content:center;padding:20px}.feas-v4-modal.open{display:flex}.feas-v4-dialog{width:min(680px,96vw);max-height:80vh;display:flex;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.3);overflow:hidden}.feas-v4-dialoghead{display:flex;justify-content:space-between;gap:16px;padding:15px 17px;border-bottom:1px solid var(--border)}.feas-v4-dialoghead b{display:block}.feas-v4-dialoghead small{display:block;color:var(--muted);margin-top:2px}.feas-v4-dialoghead button{border:0;background:none;font-size:23px;color:#777}.feas-v4-versionlist{overflow:auto;padding:8px 16px}.feas-v4-version{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid var(--border)}.feas-v4-version>div{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.feas-v4-version small{color:var(--muted)}.feas-status{font-size:9px;font-weight:700;border-radius:12px;padding:2px 7px;background:#eee}.feas-status.review{background:#fff0cf;color:#8a5d00}.feas-status.approved{background:#e4f3e6;color:#2e7d32}.feas-status.archived{background:#eee;color:#666}.feas-v4-dialogfoot{padding:10px 16px;border-top:1px solid var(--border);text-align:right}.feas-v4-empty{padding:30px;text-align:center;color:var(--muted)}.feas-v4.focus{position:fixed;inset:0;z-index:210;margin:0;padding:8px;background:var(--bg);overflow:hidden}.feas-v4.focus .feas-v4-head{display:none}.feas-v4.focus .feas-v4-toolbar{border-radius:12px 12px 0 0}.feas-v4.focus .feas-v4-framewrap iframe{height:calc(100vh - 98px);min-height:0}.feas-v4.focus.client-mode .feas-v4-toolbar,.feas-v4.focus.client-mode .feas-v4-meta{display:none}.feas-v4.focus.client-mode .feas-v4-framewrap{border-top:1px solid var(--border);border-radius:12px}.feas-v4.focus.client-mode .feas-v4-framewrap iframe{height:calc(100vh - 16px)}.feas-focus{overflow:hidden}'
      +'body.dark .feas-v4-access,body.dark .feas-v4-toolbar,body.dark .feas-v4-meta,body.dark .feas-v4-dialog{background:var(--panel)}body.dark .feas-v4-toolbar select{background:var(--soft);color:var(--ink)}body.dark .feas-v4-loader{background:rgba(20,20,20,.78)}'
      +'@media(max-width:1100px){.feas-v4-toolbar{align-items:stretch;flex-wrap:wrap}.feas-v4-toolbar label{min-width:180px;flex:1}.feas-v4-actions{width:100%}.feas-v4-framewrap iframe{height:1000px}}@media(max-width:680px){.feas-v4-head{flex-direction:column}.feas-v4-access{align-items:flex-start}.feas-v4-toolbar{display:grid;grid-template-columns:1fr}.feas-v4-toolbar label{min-width:0}.feas-v4-actions{display:grid;grid-template-columns:1fr 1fr}.feas-v4-framewrap iframe{height:1250px;min-height:900px}}';
    document.head.appendChild(st);
  }

  function render(){renderShell();loadList();}
  function install(){
    css();
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._feas400){
      window.go=function(v){
        if(v==='feasibility'){
          if(!allowed())return oldGo.call(this,'dash');
          try{var prev=S.view;S.view='feasibility';if(prev!==S.view)S._focus=null;}catch(e){}
          document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v==='feasibility');});
          var side=document.getElementById('side'),scrim=document.getElementById('scrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('open');
          render();try{if(typeof localize==='function')localize();}catch(e){}try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}return;
        }
        return oldGo.apply(this,arguments);
      };
      window.go._feas400=true;
    }
    var oldTheme=window.toggleTheme;
    if(typeof oldTheme==='function'&&!oldTheme._feas400){window.toggleTheme=function(){var r=oldTheme.apply(this,arguments);setTimeout(function(){var fr=frame();if(fr&&fr.contentWindow)fr.contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-feasibility-theme',theme:currentTheme()},location.origin);},0);return r;};window.toggleTheme._feas400=true;}
  }

  window.addEventListener('message',function(e){
    if(e.origin!==location.origin||!e.data||e.data.source!=='asaas-feasibility-v4')return;
    if(!allowed())return;
    if(e.data.type==='asaas-feasibility-ready'){F.frameReady=true;showLoader(false);postContext();}
    else if(e.data.type==='asaas-feasibility-save')saveRecord(e.data);
    else if(e.data.type==='asaas-feasibility-delete')deleteCurrent();
    else if(e.data.type==='asaas-feasibility-new'){F.current=null;F.status='draft';updateControls();}
    else if(e.data.type==='asaas-feasibility-focus')setClientMode(!!e.data.enabled);
  });

  window.feasV4SetProject=function(v){F.project=v||'ALL';F.current=null;F.status='draft';updateControls();newModel(true);};
  window.feasV4Select=function(v){if(!v)newModel(true);else loadRecord(v,true);};
  window.feasV4LoadSelected=function(){var el=document.getElementById('feasScenario');if(el&&el.value)loadRecord(el.value,true);else newModel(true);};
  window.feasV4Status=function(v){F.status=['draft','review','approved','archived'].indexOf(v)>=0?v:'draft';};
  window.feasV4New=function(){if(F.current&&!confirm(tr('Создать новую модель? Несохранённые изменения текущей модели будут потеряны.','Yangi model yaratiladimi? Saqlanmagan o‘zgarishlar yo‘qoladi.','Create a new model? Unsaved changes in the current model will be lost.')))return;newModel(true);};
  window.feasV4Delete=deleteCurrent;
  window.feasV4Versions=openVersions;
  window.feasV4CloseVersions=closeVersions;
  window.feasV4Restore=restoreRevision;
  window.feasV4Focus=function(){var next=!F.focus;F.clientMode=false;var s=document.querySelector('.feas-v4');if(s)s.classList.remove('client-mode');setFocus(next);};

  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&F.focus){F.clientMode=false;var s=document.querySelector('.feas-v4');if(s)s.classList.remove('client-mode');setFocus(false);}});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
