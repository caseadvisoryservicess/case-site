/* CASE OS v4.32.7 — LCR persistence, table ergonomics and external-agent safety patch. */
(function(){
  'use strict';
  var PATCH_VERSION='4.32.7';
  var unitQueue=Object.create(null), actualPending=0, batchPending={upserts:Object.create(null),deletes:Object.create(null),timer:0,inflight:false}, brokerPopup=null, observer=null;

  function q(id){return document.getElementById(id);}
  function html(s){try{return typeof esc==='function'?esc(String(s==null?'':s)):String(s==null?'':s).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}catch(_){return String(s||'');}}
  function isExternal(){try{return !!(S&&S.role==='AGX');}catch(_){return false;}}
  function unitById(id){try{return U.find(function(x){return String(x.id)===String(id);});}catch(_){return null;}}
  function clone(x){try{return JSON.parse(JSON.stringify(x));}catch(_){return null;}}
  function changes(before,after){var out={};if(!before||!after)return out;Object.keys(after).forEach(function(k){if(k==='id'||k==='obj')return;try{if(JSON.stringify(before[k])!==JSON.stringify(after[k]))out[k]=after[k];}catch(_){if(before[k]!==after[k])out[k]=after[k];}});return out;}
  function hasKeys(o){for(var k in o)return true;return false;}

  function stopWholeStateSave(){
    try{clearTimeout(_saveT);_savePend=false;}catch(_){}
  }
  function cacheLocalCore(){
    try{
      var b=stateBlob();
      if(typeof BACKEND!=='undefined'&&BACKEND&&typeof _HEAVY_LOCAL_KEYS!=='undefined')_HEAVY_LOCAL_KEYS.forEach(function(k){try{delete b[k];}catch(_){}});
      localStorage.setItem(STORAGE_KEY,JSON.stringify(b));
      try{_localSaveFailed=false;_localReduced=!!BACKEND;updateOfflineBadge();}catch(_){}
    }catch(e){try{_localSaveFailed=true;updateOfflineBadge();}catch(_){}}
  }
  function queueBusy(){
    if(actualPending>0||batchPending.inflight||hasKeys(batchPending.upserts)||hasKeys(batchPending.deletes))return true;
    for(var id in unitQueue){var r=unitQueue[id];if(r&&(r.inflight||hasKeys(r.changes||{})))return true;}
    return false;
  }
  window.CASE_UNIT_PATCH_BUSY=queueBusy;

  function unitPatch(id,delta,immediate){
    if(!delta||!hasKeys(delta))return;
    if(typeof BACKEND==='undefined'||!BACKEND){try{persist();}catch(_){}return;}
    var rec=unitQueue[id]||(unitQueue[id]={changes:{},timer:0,inflight:false});
    Object.assign(rec.changes,clone(delta)||delta);
    cacheLocalCore();
    clearTimeout(rec.timer);
    rec.timer=setTimeout(function(){flushUnit(id);},immediate?20:420);
  }
  async function flushUnit(id){
    var rec=unitQueue[id];if(!rec||rec.inflight||!hasKeys(rec.changes))return;
    var snapshot=rec.changes;rec.changes={};rec.inflight=true;actualPending++;
    try{
      var j=await apiPOST('unit_patch.php',{id:id,changes:snapshot});
      var u=unitById(id),newer=rec.changes;
      if(u&&j&&j.unit){Object.assign(u,j.unit);Object.assign(u,newer);}
      try{if(j&&typeof j.revision!=='undefined')_serverRev=+j.revision||_serverRev;if(j&&j.updated_at)_lastServerUpdate=j.updated_at;_lastSavedAt=new Date();_offlineDirty=false;_saveConflict=false;}catch(_){}
      cacheLocalCore();try{window._case401Toast=0;}catch(_){}
    }catch(e){
      var st=+(e&&e.status)||0;
      if(!rec.cancelled)rec.changes=Object.assign({},snapshot,rec.changes||{});
      if(st===403){ /* v4.44: нет прав — повторять бессмысленно, честно бьём тревогу */
        rec.cancelled=true;rec.changes={};
        try{toast('⛔ Сервер отклонил правку помещения: '+((e&&e.message)||'нет прав')+'. Правка НЕ сохранена — сообщите администратору.',10000);}catch(_){}
      }else if(st===401){ /* v4.44: сессия истекла — правка ждёт повторного входа (дозальётся автоматически) */
        try{if(!window._case401Toast){window._case401Toast=1;toast('⚠ Сеанс истёк. Войдите заново — несохранённые правки будут отправлены автоматически.',9000);}}catch(_){}
      }else{
        try{_offlineDirty=true;updateOfflineBadge();if(!rec.cancelled)toast('⚠ Правка LCR пока не подтверждена сервером (нет связи). Повторим автоматически.');}catch(_){}
        clearTimeout(rec.timer);rec.timer=setTimeout(function(){flushUnit(id);},5000);
      }
    }finally{
      rec.inflight=false;actualPending=Math.max(0,actualPending-1);
      if(!rec.cancelled&&hasKeys(rec.changes)) {clearTimeout(rec.timer);rec.timer=setTimeout(function(){flushUnit(id);},180);}
      else if(!rec.inflight) delete unitQueue[id];
      try{updateOfflineBadge();}catch(_){}
    }
  }
  window.caseUnsyncedCount=function(){var n=0;try{Object.keys(unitQueue).forEach(function(id){var r=unitQueue[id];if(r&&!r.cancelled&&(hasKeys(r.changes)||r.inflight))n++;});n+=Object.keys(batchPending.upserts).length+Object.keys(batchPending.deletes).length;}catch(_){}return n;};
  window.caseFlushUnitsNow=async function(){var ids=Object.keys(unitQueue);for(var i=0;i<ids.length;i++){try{await flushUnit(ids[i]);}catch(_){}}try{await flushUnitBatch();}catch(_){}};
  window.addEventListener('online',function(){Object.keys(unitQueue).forEach(flushUnit);flushUnitBatch();});
  setInterval(function(){if(navigator.onLine!==false){Object.keys(unitQueue).forEach(flushUnit);flushUnitBatch();}},15000);

  function unitMap(){var m=Object.create(null);try{U.forEach(function(u){if(u&&u.id!=null)m[String(u.id)]=clone(u);});}catch(_){}return m;}
  function queueUnitCollection(before,after){
    before=before||{};after=after||{};
    Object.keys(before).forEach(function(id){if(!after[id]){
      var pending=unitQueue[id];if(pending){clearTimeout(pending.timer);pending.cancelled=true;pending.changes={};if(!pending.inflight)delete unitQueue[id];}
      delete batchPending.upserts[id];batchPending.deletes[id]=1;
    }});
    Object.keys(after).forEach(function(id){
      var changed=!before[id];
      if(!changed){try{changed=JSON.stringify(before[id])!==JSON.stringify(after[id]);}catch(_){changed=true;}}
      if(changed){
        var full=clone(after[id])||after[id],pending=unitQueue[id];
        if(pending){Object.assign(full,pending.changes||{});clearTimeout(pending.timer);pending.cancelled=true;pending.changes={};if(!pending.inflight)delete unitQueue[id];}
        batchPending.upserts[id]=full;delete batchPending.deletes[id];
      }
    });
    if(!hasKeys(batchPending.upserts)&&!hasKeys(batchPending.deletes))return;
    cacheLocalCore();clearTimeout(batchPending.timer);batchPending.timer=setTimeout(flushUnitBatch,40);
  }
  async function flushUnitBatch(){
    if(batchPending.inflight||(!hasKeys(batchPending.upserts)&&!hasKeys(batchPending.deletes)))return;
    if(typeof BACKEND==='undefined'||!BACKEND){try{persist();}catch(_){}batchPending.upserts=Object.create(null);batchPending.deletes=Object.create(null);return;}
    var upserts=Object.keys(batchPending.upserts).map(function(id){return batchPending.upserts[id];});
    var deletes=Object.keys(batchPending.deletes);
    batchPending.upserts=Object.create(null);batchPending.deletes=Object.create(null);batchPending.inflight=true;actualPending++;
    try{
      var j=await apiPOST('units_batch.php',{upserts:upserts,deletes:deletes});
      try{if(j&&typeof j.revision!=='undefined')_serverRev=+j.revision||_serverRev;if(j&&j.updated_at)_lastServerUpdate=j.updated_at;_lastSavedAt=new Date();_offlineDirty=false;_saveConflict=false;}catch(_){}
      cacheLocalCore();
    }catch(e){
      var bst=+(e&&e.status)||0;
      upserts.forEach(function(u){if(u&&u.id!=null)batchPending.upserts[String(u.id)]=u;});deletes.forEach(function(id){if(!batchPending.upserts[id])batchPending.deletes[id]=1;});
      if(bst===403){
        batchPending.upserts=Object.create(null);batchPending.deletes=Object.create(null);
        try{toast('⛔ Сервер отклонил структурные изменения LCR: '+((e&&e.message)||'нет прав')+'. Изменения НЕ сохранены — сообщите администратору.',10000);}catch(_){}
      }else if(bst===401){
        try{if(!window._case401Toast){window._case401Toast=1;toast('⚠ Сеанс истёк. Войдите заново — несохранённые правки будут отправлены автоматически.',9000);}}catch(_){}
      }else{
        try{_offlineDirty=true;updateOfflineBadge();toast('⚠ Структурные изменения LCR пока не подтверждены сервером (нет связи). Повторим автоматически.');}catch(_){}
        clearTimeout(batchPending.timer);batchPending.timer=setTimeout(flushUnitBatch,5000);
      }
    }finally{
      batchPending.inflight=false;actualPending=Math.max(0,actualPending-1);
      if(hasKeys(batchPending.upserts)||hasKeys(batchPending.deletes)){clearTimeout(batchPending.timer);batchPending.timer=setTimeout(flushUnitBatch,180);}
      try{updateOfflineBadge();}catch(_){}
    }
  }
  function wrapCollection(name){
    var orig=window[name];if(typeof orig!=='function'||orig._case4322Collection)return;
    var fn=function(){var before=unitMap(),r=orig.apply(this,arguments),after=unitMap();stopWholeStateSave();queueUnitCollection(before,after);return r;};
    fn._case4322Collection=true;fn._original=orig;window[name]=fn;
  }

  function wrapOne(name,idPos,delay){
    var orig=window[name];if(typeof orig!=='function'||orig._case4322)return;
    var fn=function(){var id=arguments[idPos],u=unitById(id),before=clone(u),r=orig.apply(this,arguments),after=unitById(id),d=changes(before,after);stopWholeStateSave();if(hasKeys(d))unitPatch(id,d,!delay);return r;};
    fn._case4322=true;fn._original=orig;window[name]=fn;
  }
  function wrapBulk(name){
    var orig=window[name];if(typeof orig!=='function'||orig._case4322)return;
    var fn=function(){var before={};try{U.forEach(function(u){before[u.id]=clone(u);});}catch(_){}var r=orig.apply(this,arguments);stopWholeStateSave();try{U.forEach(function(u){var d=changes(before[u.id],u);if(hasKeys(d))unitPatch(u.id,d,true);});}catch(_){}return r;};
    fn._case4322=true;fn._original=orig;window[name]=fn;
  }
  function installAtomicWrappers(){
    ['saveCell','saveCellLive','saveVarsLive','regQuickComment','saveUnitDate','editUnitArea','unitSave','addUnitCatV','delUnitCatV','extendOffer','addComment','scrSetSaleStatus','scrSetSalePrice'].forEach(function(n){wrapOne(n,0,n==='saveCellLive'||n==='saveVarsLive');});
    ['bulkStatus','bulkBroker'].forEach(wrapBulk);
    ['addUnit','deleteUnit','bulkDelete','bulkRenumber','bulkMerge','doMerge','doSplit','doCreatePlanUnits','trashRestore','kanDrop'].forEach(wrapCollection);
    try{var oldBusy=window.isUserBusy;if(typeof oldBusy==='function'&&!oldBusy._case4322){var nb=function(){return queueBusy()||oldBusy.apply(this,arguments);};nb._case4322=true;window.isUserBusy=nb;}}catch(_){}
  }

  function closeBrokerPicker(){
    if(brokerPopup){brokerPopup.remove();brokerPopup=null;}
    document.removeEventListener('mousedown',brokerAway,true);document.removeEventListener('keydown',brokerKey,true);
  }
  function brokerAway(e){if(brokerPopup&&!brokerPopup.contains(e.target)&&!e.target.closest('[data-broker-edit]'))closeBrokerPicker();}
  function brokerKey(e){if(e.key==='Escape')closeBrokerPicker();}
  function openBrokerPicker(id,anchor){
    closeBrokerPicker();var u=unitById(id);if(!u||isExternal())return;
    var list=[];try{list=brokerNames().slice();}catch(_){list=[];}
    if(u.broker&&list.indexOf(u.broker)<0)list.unshift(u.broker);
    var p=document.createElement('div');p.className='case-broker-picker';
    p.innerHTML='<div class="cbp-title">Назначить брокера</div><button data-v="">— Не назначен —</button>'+list.map(function(n){return '<button data-v="'+html(n)+'" class="'+(n===u.broker?'on':'')+'">'+html(n)+'</button>';}).join('');
    document.body.appendChild(p);brokerPopup=p;var r=anchor.getBoundingClientRect();p.style.left=Math.max(8,Math.min(r.left,window.innerWidth-p.offsetWidth-8))+'px';p.style.top=Math.min(r.bottom+5,window.innerHeight-p.offsetHeight-8)+'px';
    p.querySelectorAll('button[data-v]').forEach(function(b){b.onclick=function(ev){ev.stopPropagation();var v=b.getAttribute('data-v')||'';closeBrokerPicker();saveCell(id,'broker',v);};});
    setTimeout(function(){document.addEventListener('mousedown',brokerAway,true);document.addEventListener('keydown',brokerKey,true);},0);
  }
  window.caseBrokerPicker=openBrokerPicker;

  function installBrokerBehavior(){
    var orig=window.editCell;if(typeof orig==='function'&&!orig._case4322){var fn=function(id,field,td){if(field==='broker'){openBrokerPicker(id,td);return;}return orig.apply(this,arguments);};fn._case4322=true;fn._original=orig;window.editCell=fn;}
  }
  function normalizeBrokerEditors(){
    document.querySelectorAll('table[data-tblkey="reg_units"] select').forEach(function(sel){
      var oc=sel.getAttribute('onchange')||'';if(oc.indexOf("'broker'")<0||sel.dataset.caseBrokerDone)return;
      var m=oc.match(/saveCellLive\('([^']+)'\s*,\s*'broker'/);if(!m)return;var id=m[1],u=unitById(id),b=document.createElement('button');
      b.type='button';b.className='case-broker-edit';b.dataset.brokerEdit=id;b.innerHTML='<span>'+html((u&&u.broker)||'—')+'</span><i>✎</i>';b.title='Нажмите, чтобы назначить брокера';b.onclick=function(ev){ev.stopPropagation();openBrokerPicker(id,b);};
      sel.dataset.caseBrokerDone='1';sel.replaceWith(b);
    });
  }

  function enforceExternalRole(){
    if(!isExternal())return;
    try{var r=ROLES.AGX||(ROLES.AGX={});Object.assign(r,{label:'Внешний агент',leasing:true,finance:false,edit:false,approve:false,plans:false,admin:false,ownOnly:true,external:true,projectScoped:true,rights:['Добавление новых лидов','Только назначенные проекты','Доступ по согласованию администратора']});}catch(_){}
    try{if(S.user){S.user.title='Внешний агент';S.user.role='AGX';}}catch(_){}
    var wr=q('whoRole');if(wr)wr.textContent='Внешний агент';
    document.querySelectorAll('#nav a[data-v]').forEach(function(a){var v=a.dataset.v,allowed=['dash','brands','v32_investors','work_tasks','work_kanban'];a.style.display=allowed.indexOf(v)>=0?'':'none';});
  }
  function externalShell(title,subtitle,body){
    var main=q('main');if(!main)return;main.innerHTML='<div class="ph"><h1>'+html(title)+'</h1></div><p class="sub">'+html(subtitle)+'</p><div class="card case-ext-submit">'+body+'</div><div class="foot case-ext-foot"><b>CASE OS v4.32.7</b> · Безопасный кабинет внешнего агента. Отправленные записи доступны внутренней команде после проверки.</div>';try{localize();}catch(_){}
  }
  function field(label,id,type,placeholder){return '<label><span>'+html(label)+'</span><input id="'+id+'" type="'+(type||'text')+'" placeholder="'+html(placeholder||'')+'"></label>';}
  function textArea(label,id,placeholder){return '<label class="wide"><span>'+html(label)+'</span><textarea id="'+id+'" rows="4" placeholder="'+html(placeholder||'')+'"></textarea></label>';}
  function renderExternalBrand(){
    externalShell('Новый бренд','Внешний агент может только отправить новый бренд на внутреннюю проверку. База, контакты и экспорт недоступны.',
      '<div class="case-ext-head"><div><b>Добавить бренд</b><small>После отправки запись попадёт администратору на проверку.</small></div></div><div class="case-ext-grid">'+
      field('Название бренда *','ex_brand')+field('Категория','ex_brand_cat')+field('Страна','ex_brand_country','text','Узбекистан')+field('Город','ex_brand_city')+field('Мин. площадь, м²','ex_brand_min','number')+field('Макс. площадь, м²','ex_brand_max','number')+textArea('Комментарий / требования','ex_brand_note')+
      '</div><div class="case-ext-actions"><button class="btn" onclick="caseSubmitExternalBrand()">Отправить на проверку</button></div><div id="ex_brand_msg" class="case-ext-msg"></div>');
  }
  window.caseSubmitExternalBrand=async function(){
    var name=(q('ex_brand')&&q('ex_brand').value||'').trim(),msg=q('ex_brand_msg');if(!name){if(msg)msg.textContent='Укажите название бренда.';return;}
    try{await apiPOST('brand_requests.php',{row:{brand_name:name,category:q('ex_brand_cat').value,country:q('ex_brand_country').value||'Узбекистан',city:q('ex_brand_city').value,area_min:q('ex_brand_min').value,area_max:q('ex_brand_max').value,preferences:q('ex_brand_note').value}});if(msg){msg.className='case-ext-msg ok';msg.textContent='✓ Бренд отправлен администратору на проверку.';}['ex_brand','ex_brand_cat','ex_brand_city','ex_brand_min','ex_brand_max','ex_brand_note'].forEach(function(id){if(q(id))q(id).value='';});}
    catch(e){if(msg){msg.className='case-ext-msg err';msg.textContent='Ошибка: '+(e&&e.message||e);}}
  };
  function renderExternalInvestor(){
    externalShell('Новый инвестор','Внешний агент может только отправить нового инвестора на внутреннюю проверку. Реестр инвесторов недоступен.',
      '<div class="case-ext-head"><div><b>Добавить инвестора</b><small>Контакт будет доступен только внутренней команде после отправки.</small></div></div><div class="case-ext-grid">'+
      field('Имя / компания *','ex_inv_name')+field('Тип актива','ex_inv_type')+field('Страна','ex_inv_country','text','Узбекистан')+field('Город','ex_inv_city')+field('Бюджет от, $','ex_inv_bmin','number')+field('Бюджет до, $','ex_inv_bmax','number')+field('Площадь от, м²','ex_inv_amin','number')+field('Площадь до, м²','ex_inv_amax','number')+field('Целевая доходность / cap rate','ex_inv_cap')+field('Контакт','ex_inv_contact')+textArea('Критерии инвестирования','ex_inv_note')+
      '</div><div class="case-ext-actions"><button class="btn" onclick="caseSubmitExternalInvestor()">Отправить на проверку</button></div><div id="ex_inv_msg" class="case-ext-msg"></div>');
  }
  window.caseSubmitExternalInvestor=async function(){
    var name=(q('ex_inv_name')&&q('ex_inv_name').value||'').trim(),msg=q('ex_inv_msg');if(!name){if(msg)msg.textContent='Укажите имя или компанию инвестора.';return;}
    try{await apiPOST('investor_requests.php',{row:{investor_name:name,asset_type:q('ex_inv_type').value,country:q('ex_inv_country').value||'Узбекистан',city:q('ex_inv_city').value,budget_min:q('ex_inv_bmin').value,budget_max:q('ex_inv_bmax').value,area_min:q('ex_inv_amin').value,area_max:q('ex_inv_amax').value,cap_rate:q('ex_inv_cap').value,contact:q('ex_inv_contact').value,preferences:q('ex_inv_note').value}});if(msg){msg.className='case-ext-msg ok';msg.textContent='✓ Инвестор отправлен администратору на проверку.';}document.querySelectorAll('.case-ext-submit input,.case-ext-submit textarea').forEach(function(e){e.value='';});}
    catch(e){if(msg){msg.className='case-ext-msg err';msg.textContent='Ошибка: '+(e&&e.message||e);}}
  };
  function renderExternalLocked(){externalShell('Доступ по согласованию','LCR и SCR закрыты для внешнего агента. Доступ к конкретному проекту и юниту выдаёт администратор или руководитель отдела аренды.','<div class="case-ext-lock"><b>Доступ пока не назначен</b><p>Запросы на проекты и юниты будут доступны в Центре доступа. Обратитесь к администратору.</p></div>');}

  function installExternalNavigation(){
    var orig=window.go;if(typeof orig!=='function'||orig._case4322External)return;
    var fn=function(v){
      enforceExternalRole();
      if(isExternal()){
        if(v==='brands'||v==='v32_requests'||v==='v32_demand'){S.view='brands';renderExternalBrand();return;}
        if(v==='v32_investors'){S.view='v32_investors';renderExternalInvestor();return;}
        if(v==='registry'||v==='v32_sales'||v==='v326_lease'){S.view=v;renderExternalLocked();return;}
      }
      var r=orig.apply(this,arguments);setTimeout(postRender,0);return r;
    };fn._case4322External=true;fn._original=orig;window.go=fn;
  }

  function filterLabel(table,id){
    try{var th=table&&table.querySelector('th[data-colkey="'+String(id).replace(/"/g,'\"')+'"]');if(th){var n=th.querySelector('.th-name,.case-grid-label,.geo-th-label');return (n?n.textContent:th.textContent).replace(/[↕▲▼▾]+/g,'').trim()||id;}}catch(_){}return id;
  }
  function filterSummary(v){
    if(v==null)return '';if(typeof v!=='object')return String(v);
    var out=[];if(v.op){var m={gt:'>',ge:'≥',lt:'<',le:'≤',eq:'=',between:'между',contains:'содержит',starts:'начинается',ends:'заканчивается',notcontains:'не содержит',neq:'≠',empty:'пусто',notempty:'не пусто'};out.push((m[v.op]||v.op)+(v.a!=null&&v.a!==''?' '+v.a:'')+(v.b!=null&&v.b!==''?' — '+v.b:''));}
    if(Array.isArray(v.vals))out.push(v.vals.length<=2?v.vals.join(', '):(v.vals.slice(0,2).join(', ')+' +'+(v.vals.length-2)));
    return out.join(' · ')||'активен';
  }
  function clearBuiltFilter(key,id){
    try{if(key==='reg_units'){if(S.regColF)delete S.regColF[id];if(typeof saveTblPrefs==='function')saveTblPrefs();renderRegistry();return;}
      if(S.tbl&&S.tbl[key]&&S.tbl[key].filters)delete S.tbl[key].filters[id];if(typeof saveTblPrefs==='function')saveTblPrefs();go(S.view);
    }catch(_){}
  }
  function clearAllBuiltFilters(key){
    try{if(key==='reg_units'){S.regColF={};if(typeof saveTblPrefs==='function')saveTblPrefs();renderRegistry();return;}
      if(S.tbl&&S.tbl[key])S.tbl[key].filters={};if(typeof saveTblPrefs==='function')saveTblPrefs();go(S.view);
    }catch(_){}
  }
  function renderFilterChips(){
    var alive=Object.create(null);
    document.querySelectorAll('table[data-tblkey]').forEach(function(tb){
      var key=tb.getAttribute('data-tblkey'),filters=key==='reg_units'?(S.regColF||{}):(((S.tbl||{})[key]||{}).filters||{}),ids=Object.keys(filters).filter(function(id){var v=filters[id];return v!==''&&v!=null&&(typeof v!=='object'||v.op||Array.isArray(v.vals));});
      alive[key]=1;var wrap=tb.closest('.tbl-scroll')||tb.parentElement;if(!wrap||!wrap.parentElement)return;var parent=wrap.parentElement,bar=parent.querySelector('.case-filter-chipbar[data-filter-owner="'+key+'"]');
      if(!ids.length){if(bar)bar.remove();return;}
      var sig=ids.map(function(id){return id+':'+filterSummary(filters[id]);}).join('|');if(bar&&bar.dataset.sig===sig)return;
      if(!bar){bar=document.createElement('div');bar.className='case-filter-chipbar';bar.dataset.filterOwner=key;parent.insertBefore(bar,wrap);}bar.dataset.sig=sig;
      bar.innerHTML='<span class="cfc-label">Фильтры:</span>'+ids.map(function(id){return '<button type="button" data-id="'+html(id)+'"><b>'+html(filterLabel(tb,id))+'</b><span>'+html(filterSummary(filters[id]))+'</span><i>×</i></button>';}).join('')+'<button type="button" class="cfc-clear">Очистить все</button>';
      bar.querySelectorAll('button[data-id]').forEach(function(b){b.onclick=function(){clearBuiltFilter(key,b.dataset.id);};});bar.querySelector('.cfc-clear').onclick=function(){clearAllBuiltFilters(key);};
    });
    document.querySelectorAll('.case-filter-chipbar[data-filter-owner]').forEach(function(bar){if(!alive[bar.dataset.filterOwner])bar.remove();});
  }

  function styleGeoFrame(){
    var fr=q('geoFrame');if(!fr||fr.dataset.case4322)return;fr.dataset.case4322='1';var apply=function(){try{var d=fr.contentDocument;if(!d||d.getElementById('caseGeoStyle4322'))return;var st=d.createElement('style');st.id='caseGeoStyle4322';st.textContent='.geo-table{font-size:11px!important;width:100%!important}.geo-table th{padding:5px 6px!important;background:#faf8f5!important;color:#625d56!important;white-space:normal!important;line-height:1.15!important}.geo-table td{padding:5px 6px!important;height:32px!important;vertical-align:middle!important}.geo-table tr.geo-tfilter-row{display:none!important}.geo-table-wrap{width:100%!important;max-width:none!important}.geo-data-card,.geo-table-card{border-radius:13px!important;background:#fff!important;box-shadow:0 5px 18px rgba(44,36,28,.06)!important}';d.head.appendChild(st);}catch(_){}};fr.addEventListener('load',apply);apply();
  }
  function actionItems(bar){return Array.prototype.slice.call(bar.querySelectorAll(':scope > .case-action-item'));}
  function adaptiveActions(bar){
    if(!bar)return;var more=bar.querySelector(':scope > .case-action-more'),pop=more&&more.querySelector('.moremenu-pop');if(!more||!pop)return;
    /* v4.43.2: раскладка без «дёрганья». Прежний алгоритм (вернуть всё в бар → измерить →
       вынести лишнее) в связке с ResizeObserver зацикливался: перенос кнопки менял ширину
       контейнера (появлялся/исчезал скроллбар) → пересчёт → перенос обратно, ~650 перестановок
       DOM в секунду. Из-за этого шторма не успевал срабатывать и CASE Data Grid (вечный дебаунс),
       а на LCR оставались «полоски»-резайзеры от прошлых улучшений. Теперь ширины кэшируются,
       состав считается математически, DOM трогаем только при реальном изменении состава,
       возврат из «Ещё» — лишь при запасе места (гистерезис). */
    var HYST=28,GAP=7;
    var inBar=actionItems(bar),inPop=Array.prototype.slice.call(pop.querySelectorAll('.case-action-item'));
    inBar.forEach(function(x){var w=x.getBoundingClientRect().width;if(w>0)x.dataset.caseW=String(Math.ceil(w));});
    var all=inBar.concat(inPop).sort(function(a,b){return (+b.dataset.priority||0)-(+a.dataset.priority||0);});
    var moreW=Math.max(more.getBoundingClientRect().width||0,52)+GAP;
    var avail=bar.clientWidth-moreW;
    var used=0,keep=[],out=[],cut=false;
    all.forEach(function(x){
      if(cut){out.push(x);return;}
      var w=(+x.dataset.caseW||96)+GAP;
      var slack=inPop.indexOf(x)>=0?HYST:0; /* возврат из «Ещё» — только с запасом места */
      if(used+w<=avail-slack){used+=w;keep.push(x);}
      else{cut=true;out.push(x);}
    });
    var sameBar=keep.length===inBar.length&&keep.every(function(x,i){return inBar[i]===x;});
    var samePop=out.length===inPop.length&&out.every(function(x){return inPop.indexOf(x)>=0;});
    if(!(sameBar&&samePop)){
      keep.forEach(function(x){bar.insertBefore(x,more);});
      out.forEach(function(x){pop.appendChild(x);});
    }
    if(out.length)more.classList.add('has-items');else{more.classList.remove('has-items');more.open=false;}
  }
  function installAdaptiveActions(){
    document.querySelectorAll('.case-adaptive-actions').forEach(function(bar){adaptiveActions(bar);if(bar.dataset.caseAdaptive)return;bar.dataset.caseAdaptive='1';if(window.ResizeObserver){var ro=new ResizeObserver(function(en){var w=Math.round((en[0]&&en[0].contentRect&&en[0].contentRect.width)||bar.clientWidth);if(bar._caseLastW===w)return;bar._caseLastW=w;requestAnimationFrame(function(){adaptiveActions(bar);});});ro.observe(bar);bar._caseRO=ro;}});
  }
  var stickyTopRO=null,stickyResizeBound=false,stickyScrollBound=false,stickyRaf=0;
  function pageScroller(){return document.scrollingElement||document.documentElement||document.body;}
  function topbarHeight(){var bar=document.querySelector('.topbar');return bar?Math.max(0,Math.ceil(bar.getBoundingClientRect().height)):0;}
  function hasVerticalRange(el){if(!el)return false;var cs=getComputedStyle(el),oy=cs.overflowY;return (oy==='auto'||oy==='scroll')&&(el.scrollHeight-el.clientHeight>2);}
  function parentVerticalScroller(el){var n=el&&el.parentElement;while(n&&n!==document.body&&n!==document.documentElement){if(hasVerticalRange(n))return n;n=n.parentElement;}return pageScroller();}
  function destroyStickyClone(tb){var l=tb&&tb._caseStickyLayer;if(l){l.remove();tb._caseStickyLayer=null;}if(tb)tb.classList.remove('case-page-sticky-source');}
  function cloneHeaderTable(tb){
    var ct=document.createElement('table');ct.className=String(tb.className||'').replace(/\bcase-page-sticky-source\b/g,'').trim()+' case-sticky-head-table';ct.removeAttribute('data-tblkey');ct.removeAttribute('data-case-grid-key');ct.removeAttribute('data-grid-engine');
    var cg=tb.querySelector('colgroup');if(cg)ct.appendChild(cg.cloneNode(true));ct.appendChild(tb.tHead.cloneNode(true));
    /* v4.44.1: резайзеры в клоне ОСТАЮТСЯ — перетаскивание проксируется исходной таблице (proxyStickyResizerDown) */ct.style.width=Math.ceil(tb.getBoundingClientRect().width)+'px';ct.style.minWidth=ct.style.width;ct.style.maxWidth='none';return ct;
  }
  function proxyStickyClick(e){
    var layer=e.currentTarget,tb=layer._source;if(!tb||!tb.isConnected)return;var grp=e.target.closest('[data-reg-group]');if(grp){e.preventDefault();e.stopPropagation();try{if(typeof regToggleGrp==='function')regToggleGrp(grp.getAttribute('data-reg-group'));}catch(_){}return;}
    var btn=e.target.closest('.tblfnl,.case-grid-filter-btn,.geo-th-fnl');if(btn){e.preventDefault();e.stopPropagation();var th=btn.closest('th'),id=th&&th.getAttribute('data-colkey'),key=tb.getAttribute('data-tblkey')||tb.dataset.caseGridKey;if(id&&typeof tblMenu==='function'&&key==='reg_units'){tblMenu('reg_units',id,btn,'reg');return;}try{if(window.CASE_GRID&&CASE_GRID.openColumnMenu&&id)CASE_GRID.openColumnMenu(key,id,btn);}catch(_){}return;}
  }
  function proxyStickyResizerDown(e){
    /* v4.44.1: перетаскивание ширины из ПРИЛИПШЕЙ шапки — событие пробрасывается настоящему
       резайзеру исходной таблицы; клон подстраивается по ходу перетаскивания */
    var rz=e.target&&e.target.closest&&e.target.closest('.case-grid-resizer');if(!rz)return;
    var layer=e.currentTarget,src=layer&&layer._source;if(!src)return;
    var id=rz.dataset&&rz.dataset.caseColId;if(!id)return;
    var sel='.case-grid-resizer[data-case-col-id="'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'"]';
    var real=src.querySelector(sel);if(!real)return;
    e.preventDefault();e.stopPropagation();
    try{real.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:e.clientX,clientY:e.clientY,bubbles:true,pointerId:e.pointerId||1}));}catch(_){return;}
    var mv=function(){scheduleStickyUpdate();};
    var up=function(){document.removeEventListener('pointermove',mv,true);document.removeEventListener('pointerup',up,true);requestAnimationFrame(updateAllSticky);};
    document.addEventListener('pointermove',mv,true);
    document.addEventListener('pointerup',up,true);
  }
  function ensureStickyClone(tb,wrap){
    var layer=tb._caseStickyLayer;if(!layer){layer=document.createElement('div');layer.className='case-sticky-head-layer';layer._source=tb;layer.addEventListener('click',proxyStickyClick);layer.addEventListener('pointerdown',proxyStickyResizerDown);document.body.appendChild(layer);tb._caseStickyLayer=layer;}
    layer._source=tb;layer.innerHTML='';layer.appendChild(cloneHeaderTable(tb));if(wrap&&wrap.dataset.caseStickyX!=='4327'){wrap.dataset.caseStickyX='4327';wrap.addEventListener('scroll',scheduleStickyUpdate,{passive:true});}
    return layer;
  }
  function updateOneSticky(tb){
    var layer=tb&&tb._caseStickyLayer;if(!layer||!tb.isConnected){if(layer)layer.remove();return;}var wrap=tb.closest('.tbl-scroll,.geo-table-wrap,.geo-obj-tblwrap');if(!wrap){destroyStickyClone(tb);return;}
    var pageTop=topbarHeight(),tr=tb.getBoundingClientRect(),wr=wrap.getBoundingClientRect(),head=layer.firstElementChild,hh=tb.tHead?Math.max(1,Math.ceil(tb.tHead.getBoundingClientRect().height)):1,internal=!!tb._caseStickyInternal;
    var top=internal?Math.max(pageTop,wr.top):pageTop;
    var show=internal?(wrap.scrollTop>1&&wr.bottom>top+Math.max(1,hh)&&wr.top<window.innerHeight):(tr.top<top&&tr.bottom>top+Math.max(1,hh)&&wr.bottom>top);
    show=show&&wr.right>0&&wr.left<window.innerWidth;
    layer.style.display=show?'block':'none';if(!show)return;layer.style.top=top+'px';layer.style.left=Math.max(0,wr.left)+'px';layer.style.width=Math.max(0,Math.min(window.innerWidth,wr.right)-Math.max(0,wr.left))+'px';layer.style.height=hh+'px';head.style.transform='translateX('+(-wrap.scrollLeft)+'px)';head.style.width=Math.ceil(tb.getBoundingClientRect().width)+'px';head.style.minWidth=head.style.width;
  }
  function updateAllSticky(){stickyRaf=0;document.querySelectorAll('.case-sticky-head-layer').forEach(function(l){if(!l._source||!l._source.isConnected)l.remove();});document.querySelectorAll('table.case-page-sticky-source:not(.case-sticky-head-table)').forEach(updateOneSticky);}
  function scheduleStickyUpdate(){if(stickyRaf)return;stickyRaf=requestAnimationFrame(updateAllSticky);}
  function syncOneStickyTable(tb){
    if(!tb||!tb.tHead)return;var wrap=tb.closest('.tbl-scroll,.geo-table-wrap,.geo-obj-tblwrap');var internal=hasVerticalRange(wrap);
    if(tb.classList.contains('reg-grp')&&tb.tHead.rows.length>1){var gr=tb.tHead.rows[0],h=Math.max(1,Math.ceil(gr.getBoundingClientRect().height));tb.style.setProperty('--cg-group-h',h+'px');}
    tb._caseStickyInternal=internal;tb.classList.add('case-page-sticky-source');tb.style.setProperty('--cg-sticky-top','0px');ensureStickyClone(tb,wrap);
  }
  function handoffWheel(e){
    if(e.defaultPrevented||e.ctrlKey||e.metaKey||Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;var sc=e.currentTarget;if(!hasVerticalRange(sc))return;
    var max=Math.max(0,sc.scrollHeight-sc.clientHeight),atTop=sc.scrollTop<=1,atBottom=sc.scrollTop>=max-1;if(!((e.deltaY<0&&atTop)||(e.deltaY>0&&atBottom)))return;
    var parent=parentVerticalScroller(sc),before=parent===pageScroller()?(parent.scrollTop||window.scrollY||0):parent.scrollTop;parent.scrollTop=before+e.deltaY;var after=parent===pageScroller()?(parent.scrollTop||window.scrollY||0):parent.scrollTop;if(after!==before){e.preventDefault();e.stopPropagation();}
  }
  function installScrollHandoff(wrap){if(!wrap||wrap.dataset.caseScrollHandoff==='4327')return;wrap.dataset.caseScrollHandoff='4327';wrap.style.overscrollBehaviorY='auto';wrap.addEventListener('wheel',handoffWheel,{passive:false});}
  function syncStickyTables(){
    var h=topbarHeight();document.documentElement.style.setProperty('--topbar-h',h+'px');
    document.querySelectorAll('table.case-grid:not(.case-sticky-head-table)').forEach(function(tb){syncOneStickyTable(tb);installScrollHandoff(tb.closest('.tbl-scroll,.geo-table-wrap,.geo-obj-tblwrap'));});
    if(!stickyResizeBound){stickyResizeBound=true;window.addEventListener('resize',function(){requestAnimationFrame(syncStickyTables);},{passive:true});document.addEventListener('pointerup',function(){requestAnimationFrame(syncStickyTables);},true);document.addEventListener('mouseup',function(){requestAnimationFrame(syncStickyTables);},true);}
    if(!stickyScrollBound){stickyScrollBound=true;window.addEventListener('scroll',scheduleStickyUpdate,{passive:true});}
    if(!stickyTopRO&&window.ResizeObserver){var bar=document.querySelector('.topbar');if(bar){stickyTopRO=new ResizeObserver(function(){requestAnimationFrame(syncStickyTables);});stickyTopRO.observe(bar);}}
    scheduleStickyUpdate();
  }
  window.CASE_SYNC_STICKY=syncStickyTables;
  function postRender(){
    enforceExternalRole();normalizeBrokerEditors();styleGeoFrame();renderFilterChips();installAdaptiveActions();syncStickyTables();
    document.querySelectorAll('table.case-grid tr.filters,table.case-grid tr.fltrow,table.case-grid tr.geo-tfilter-row').forEach(function(r){r.style.display='none';});
  }
  function injectCss(){
    if(q('casePatchCss4322'))return;var st=document.createElement('style');st.id='casePatchCss4322';st.textContent=`
      .case-broker-picker{position:fixed;z-index:12000;width:230px;max-height:330px;overflow:auto;padding:7px;background:var(--panel,#fff);border:1px solid var(--border);border-radius:12px;box-shadow:0 18px 45px rgba(0,0,0,.22)}
      .case-broker-picker .cbp-title{font-weight:800;font-size:12px;padding:6px 8px;color:var(--muted)}.case-broker-picker button{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:8px;padding:8px 9px;font:600 12px inherit;cursor:pointer;color:var(--ink)}.case-broker-picker button:hover,.case-broker-picker button.on{background:color-mix(in srgb,var(--red-d,#9E0000) 9%,var(--panel,#fff));color:var(--red-d,#9E0000)}
      .case-broker-edit{width:100%;min-height:30px;display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--border);border-radius:7px;background:var(--panel,#fff);padding:6px 8px;font:inherit;color:var(--ink);cursor:pointer}.case-broker-edit i{font-style:normal;color:var(--red-d,#9E0000);opacity:.72}.case-broker-edit:hover{border-color:var(--red-d,#9E0000)}
      .case-sticky-head-layer{position:fixed;display:none;overflow:hidden;z-index:35;background:var(--panel,#fff);border:1px solid var(--border);border-top:0;border-radius:0 0 7px 7px;box-shadow:0 6px 18px rgba(35,28,22,.12);pointer-events:auto}
      .case-sticky-head-layer table{margin:0!important;transform-origin:left top;background:var(--panel,#fff)}.case-sticky-head-layer thead th{position:static!important;top:auto!important}.case-sticky-head-layer .case-grid-resizer{display:block} /* v4.44.1: ширины можно тянуть и в прилипшей шапке */
      table.case-grid.case-page-sticky-source>thead th{position:relative!important;top:auto!important} /* v4.43.2: static отрывал якорь резайзеров — они растягивались во всю высоту таблицы («полоска») */
      table[data-tblkey="reg_units"] tr.fltrow,table[data-tblkey="scr_registry"] tr.filters,.asaas35-table tr.filters,.geo-table tr.geo-tfilter-row{display:none!important}
      .case-filter-chipbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 7px;padding:6px 8px;border:1px solid var(--border);border-radius:10px;background:color-mix(in srgb,var(--panel,#fff) 94%,var(--soft,#f5f2ee) 6%)}.case-filter-chipbar .cfc-label{font-size:10.5px;font-weight:750;color:var(--muted)}.case-filter-chipbar button{display:inline-flex;align-items:center;gap:5px;max-width:290px;border:1px solid color-mix(in srgb,var(--red-d,#9E0000) 22%,var(--border));border-radius:999px;background:var(--panel,#fff);padding:4px 8px;font:500 10.5px inherit;color:var(--ink);cursor:pointer}.case-filter-chipbar button b{font-weight:750}.case-filter-chipbar button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}.case-filter-chipbar button i{font-style:normal;color:var(--red-d,#9E0000);font-size:13px}.case-filter-chipbar button:hover{border-color:var(--red-d,#9E0000)}.case-filter-chipbar .cfc-clear{border-color:transparent;background:transparent;color:var(--red-d,#9E0000);font-weight:700}
      .case-ext-submit{max-width:1050px;padding:22px!important}.case-ext-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.case-ext-head b{font-size:18px}.case-ext-head small{display:block;color:var(--muted);margin-top:4px}.case-ext-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.case-ext-grid label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:750;color:var(--muted)}.case-ext-grid label.wide{grid-column:1/-1}.case-ext-grid input,.case-ext-grid textarea{font:500 13px inherit;color:var(--ink);background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:10px 11px;outline:none}.case-ext-grid input:focus,.case-ext-grid textarea:focus{border-color:var(--red-d,#9E0000);box-shadow:0 0 0 3px rgba(158,0,0,.08)}.case-ext-actions{margin-top:16px}.case-ext-msg{margin-top:10px;font-size:12px}.case-ext-msg.ok{color:#23733b}.case-ext-msg.err{color:var(--red-d,#9E0000)}.case-ext-lock{padding:30px;text-align:center;border:1px dashed var(--border);border-radius:12px}.case-ext-lock b{font-size:18px}.case-ext-lock p{color:var(--muted)}
      @media(max-width:760px){.case-ext-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  function install(){
    injectCss();installAtomicWrappers();installBrokerBehavior();installExternalNavigation();postRender();
    var root=q('main')||document.body;observer=new MutationObserver(function(){clearTimeout(window._case4322PostT);window._case4322PostT=setTimeout(postRender,40);});observer.observe(root,{childList:true,subtree:true});
    setInterval(enforceExternalRole,1500);
    /* метку версии в шапке задаёт index.html (APP_VERSION); PATCH_VERSION — только запасной вариант, чтобы патч не откатывал номер платформы */
    try{var av=q('appVer');if(av){var pv=(typeof APP_VERSION!=='undefined'&&APP_VERSION)?APP_VERSION:PATCH_VERSION;var demo=(typeof BACKEND!=='undefined'&&BACKEND)?'':((typeof DEMO_ALLOWED!=='undefined'&&DEMO_ALLOWED)?'DEMO · ':'');av.textContent=demo+'v'+pv;}}catch(_){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
  window.CASE_PATCH_4322={version:PATCH_VERSION,flush:function(){Object.keys(unitQueue).forEach(flushUnit);flushUnitBatch();},busy:queueBusy,adaptive:installAdaptiveActions};
})();
