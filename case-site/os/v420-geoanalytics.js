/* CASE OS v4.17.0 — universal geoanalytics integration.
   Workspace access is configurable by role/user. Data editing is controlled by configurable edit/finance/admin action rights. */
(function(){
  'use strict';
  if(window.ASAAS_GEO_420)return;
  window.ASAAS_GEO_420=true;
  /* Версия для cache-busting iframe студии = текущая версия платформы (раньше была зашита 4.17.0). */
  function geoStudioVer(){try{return (typeof APP_VERSION!=='undefined'&&APP_VERSION)?String(APP_VERSION):'4.17.0';}catch(e){return '4.17.0';}}

  var G={ready:false,project:'',saving:false,geoRevision:0,lastLoadedAt:null,recoveryData:null};
  function role(){try{return String(S&&S.role||'');}catch(e){return '';}}
  function canEdit(){try{var r=typeof R==='function'?R():{};return !!(r.edit||r.finance||r.admin);}catch(e){return false;}}
  function canView(){
    try{if(typeof window.asaasWorkspaceCanOpen==='function')return !!window.asaasWorkspaceCanOpen('geoanalytics');}catch(e){}
    try{return !!(S&&S.user);}catch(e){return false;}
  }
  function tr(ru,uz,en){try{return LANG==='uz'?uz:(LANG==='en'?en:ru);}catch(e){return ru;}}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function frame(){return document.getElementById('geoFrame');}
  function fitFrame(){var fr=frame();if(!fr)return;var top=fr.getBoundingClientRect().top,min=innerWidth<=780?480:420;fr.style.height=Math.max(min,innerHeight-top-6)+'px';}
  function projectRows(){
    try{
      var rows=typeof visibleObjects==='function'?visibleObjects():(OBJECTS||[]);
      rows=rows.map(function(o){return JSON.parse(JSON.stringify(o));});
      var known={};rows.forEach(function(o){known[String(o.id)]=1;});
      var extra=(typeof GEO_DATA!=='undefined'&&GEO_DATA&&Array.isArray(GEO_DATA.projects))?GEO_DATA.projects:[];
      extra.forEach(function(o){if(o&&o.id&&!known[String(o.id)]){rows.push(JSON.parse(JSON.stringify(o)));known[String(o.id)]=1;}});
      var portfolio=(typeof CASE_PORTFOLIO_PROJECTS!=='undefined'&&Array.isArray(CASE_PORTFOLIO_PROJECTS))?CASE_PORTFOLIO_PROJECTS:[];
      portfolio.forEach(function(p){if(!p||!p.id||known[String(p.id)])return;var o=JSON.parse(JSON.stringify(p));o.ru=o.name||o.ru||o.id;o.name=o.name||o.ru;o.portfolio=true;o.address=[o.city,o.country].filter(Boolean).join(', ');rows.push(o);known[String(o.id)]=1;});
      return rows;
    }catch(e){return [];}
  }
  function activeProject(){
    var rows=projectRows(),id=G.project;
    if(!id||id==='all'){try{id=S&&S.obj&&S.obj!=='all'?S.obj:'';}catch(e){id='';}}
    var p=rows.find(function(o){return String(o.id)===String(id);});
    return p||rows[0]||null;
  }
  function projectOptions(){
    var rows=projectRows(),active=activeProject();
    if(active)G.project=String(active.id);
    return rows.map(function(o){var id=String(o.id);return '<option value="'+h(id)+'"'+(id===G.project?' selected':'')+'>'+h(o.ru||o.name||id)+'</option>';}).join('');
  }
  /* v4.17.0 (#63): единый раздел «Геоаналитика» с вкладками.
     «Наши проекты» — только сотрудники (карта наших объектов + координаты + ключ Яндекс).
     «Рынок и POI» — студия геоаналитики (в т.ч. внешние подписчики; наши проекты им не показываются). */
  function isExternal(){try{return !!(typeof R==='function'&&R()&&R().external);}catch(e){return false;}}
  function tabBar(showOurs,active){
    if(!showOurs)return '';
    return '<div class="geo-tabbar">'
      +'<button type="button" class="'+(active==='ours'?'on':'')+'" onclick="geoV42Tab(\'ours\')">'+h(tr('Наши проекты','Bizning loyihalar','Our projects'))+'</button>'
      +'<button type="button" class="'+(active==='market'?'on':'')+'" onclick="geoV42Tab(\'market\')">'+h(tr('Рынок и POI','Bozor va POI','Market & POI'))+'</button>'
      +'</div>';
  }
  function render(){
    var main=document.getElementById('main');if(!main)return;
    var showOurs=!isExternal();
    if(!showOurs){G.tab='market';}
    else if(G.tab!=='ours'&&G.tab!=='market'){G.tab='ours';}
    if(G.tab==='ours'){
      main.classList.remove('geo-workspace');
      main.innerHTML='<div class="ph"><h1>'+h(tr('Геоаналитика — наши проекты','Geoanalitika — bizning loyihalar','Geoanalytics — our projects'))+'</h1></div>'+'<div id="geoOursHost"></div>';
      try{if(typeof window.renderMap==='function')window.renderMap(document.getElementById('geoOursHost'),true);}catch(e){}
      return;
    }
    main.classList.add('geo-workspace');
    /* #92: не пересобирать iframe, если он уже построен — иначе повторный render() (автосейв,
       квиз, переключения) перезагружает студию и стирает открытую панель «Отчёт по точке». */
    if(document.getElementById('geoFrame')){G.ready=true;try{requestAnimationFrame(fitFrame);}catch(e){}return;}
    main.innerHTML='<div class="ph"><h1>'+h(tr('Геоаналитика — рынок и POI','Geoanalitika — bozor va POI','Geoanalytics — market & POI'))+'</h1></div>'
      +'<section class="geo-v42">'
      +'<div class="geo-v42-toolbar"><select id="geoProject" aria-label="'+h(tr('Проект','Loyiha','Project'))+'" onchange="geoV42Project(this.value)">'+projectOptions()+'</select>'
      +'<button class="geo-v42-recover" id="geoRecoverBtn" style="display:none" onclick="geoV42Recover()">'+h(tr('Восстановить локальную копию','Lokal nusxani tiklash','Restore local copy'))+'</button>'
      +(canEdit()?'<button class="geo-v42-reload" aria-label="'+h(tr('История и восстановление','Tarix va tiklash','History & restore'))+'" title="'+h(tr('История сохранений и восстановление','Saqlashlar tarixi va tiklash','Save history & restore'))+'" onclick="geoV42History()">🕘</button>':'')
      +'<button class="geo-v42-reload" aria-label="'+h(tr('Обновить','Yangilash','Reload'))+'" title="'+h(tr('Обновить','Yangilash','Reload'))+'" onclick="geoV42Reload()">↻</button></div>'
      +'<div class="geo-v42-frame"><div class="geo-v42-loader" id="geoLoader">'+h(tr('Загрузка геоаналитики…','Geoanalitika yuklanmoqda…','Loading geoanalytics…'))+'</div><iframe id="geoFrame" title="CASE Universal Geoanalytics" src="geoanalytics-studio.html?embedded=1&amp;v='+geoStudioVer()+'" loading="eager"></iframe></div>'
      +'</section>';
    G.ready=false;requestAnimationFrame(fitFrame);
  }
  window.geoV42Tab=function(t){G.tab=(t==='market')?'market':'ours';render();try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}};
  function context(){
    var fr=frame();if(!fr||!fr.contentWindow||!G.ready)return;
    fr.contentWindow.postMessage({source:'asaas-os-v4',type:'asaas-geo-context',context:{
      lang:(typeof LANG==='string'?LANG:'ru'),theme:(typeof THEME==='string'?THEME:'light'),role:role(),
      editable:canEdit(),adminEdit:(function(){try{var r=typeof R==='function'?R():{};return !!(r.geoEdit||r.admin);}catch(e){return false;}})(),external:isExternal(),user:(S&&S.user)||null,projects:projectRows(),activeProjectId:(activeProject()||{}).id||'',geoData:(typeof GEO_DATA!=='undefined'?GEO_DATA:null),geoRevision:G.geoRevision||0
    }},location.origin);
  }
  function notifyFrame(type,payload){var fr=frame();if(fr&&fr.contentWindow)fr.contentWindow.postMessage(Object.assign({source:'asaas-os-v4',type:type},payload||{}),location.origin);}
  function geoCount(g){try{if(!g||typeof g!=='object')return 0;var n=Array.isArray(g.projects)?g.projects.length:0;var d=g.datasets||{};Object.keys(d).forEach(function(k){if(Array.isArray(d[k]))n+=d[k].length;});return n;}catch(e){return 0;}}
  async function loadGeoFresh(){
    if(!BACKEND||typeof apiGET!=='function')return;
    try{
      var localGeo=null;try{var localState=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(localState&&localState.GEO_DATA)localGeo=localState.GEO_DATA;var pending=JSON.parse(localStorage.getItem('case_os_geo_pending_v1')||'null');if(pending&&typeof pending==='object'){var pt=Date.parse(pending.updatedAt||(pending.meta&&pending.meta.updatedAt)||0)||0,lt=Date.parse((localGeo&&localGeo.updatedAt)||(localGeo&&localGeo.meta&&localGeo.meta.updatedAt)||0)||0;if(pt>=lt)localGeo=pending;}}catch(e){}
      var j=await apiGET('geo_state.php');
      if(j&&j.data&&typeof j.data==='object'){GEO_DATA=j.data;G.geoRevision=+j.geo_revision||0;G.lastLoadedAt=j.updated_at||null;if(typeof _serverRev!=='undefined'&&j.app_revision!=null)_serverRev=+j.app_revision||_serverRev;}
      var serverTime=Date.parse((GEO_DATA&&GEO_DATA.updatedAt)||(GEO_DATA&&GEO_DATA.meta&&GEO_DATA.meta.updatedAt)||j.updated_at||0)||0;
      var localTime=Date.parse((localGeo&&localGeo.updatedAt)||(localGeo&&localGeo.meta&&localGeo.meta.updatedAt)||0)||0;
      /* Показываем «Восстановить локальную копию» не только когда она новее по времени, но и когда
         в локальной копии заметно БОЛЬШЕ данных, чем на сервере — типичный признак потери
         (данные вводились в офлайн/демо-режиме и не дошли до сервера). */
      var localHasMore=canEdit()&&localGeo&&(geoCount(localGeo)>geoCount(GEO_DATA)+3);
      if(canEdit()&&localGeo&&(localTime>serverTime+1000||localHasMore)){G.recoveryData=localGeo;var b=document.getElementById('geoRecoverBtn');if(b)b.style.display='inline-flex';toast(tr('Найдена локальная копия геоданных с несохранёнными правками — нажмите «Восстановить локальную копию»','Saqlanmagan geo tahrirли lokal nusxa topildi','A local geo copy with unsaved edits was found — click “Restore local copy”'));}
    }catch(e){console.warn('Geoanalytics: fresh server state was not loaded',e);}
  }
  async function saveGeo(data,reason){
    if(!canEdit()||G.saving)return;
    var raw='';try{raw=JSON.stringify(data);}catch(e){toast(tr('Ошибка структуры геоданных','Geo maʼlumotlar tuzilmasi xatosi','Invalid geo data structure'));return;}
    if(!data||typeof data!=='object'||Array.isArray(data)||raw.length>31457280){toast(tr('Геоданные не сохранены: неверный или слишком большой пакет','Geo maʼlumotlar saqlanmadi: paket noto‘g‘ri yoki juda katta','Geo data were not saved: invalid or oversized payload'));return;}
    G.saving=true;notifyFrame('asaas-geo-saving',{reason:String(reason||'ручное редактирование')});
    try{localStorage.setItem('case_os_geo_pending_v1',raw);}catch(e){}
    try{
      var clean=JSON.parse(raw),j=null;
      if(BACKEND&&typeof apiPOST==='function')j=await apiPOST('geo_state.php',{data:clean,reason:String(reason||'ручное редактирование'),expected_geo_revision:G.geoRevision||0});
      else{GEO_DATA=clean;if(typeof persist==='function')persist();j={ok:true,data:clean,geo_revision:G.geoRevision||0,updated_at:new Date().toISOString(),updated_by:(S&&S.user&&S.user.name)||''};}
      if(!j||!j.ok)throw new Error('Сервер не подтвердил сохранение'+(j&&j.error?(': '+j.error):(j?(' (ответ без ok: '+JSON.stringify(j).slice(0,160)+')'):' (пустой ответ)')));
      GEO_DATA=(j.data&&typeof j.data==='object')?j.data:clean;G.geoRevision=+j.geo_revision||G.geoRevision||0;G.lastLoadedAt=j.updated_at||new Date().toISOString();
      if(typeof _serverRev!=='undefined'&&j.app_revision!=null)_serverRev=+j.app_revision||_serverRev;
      if(typeof _lastServerUpdate!=='undefined'&&j.updated_at)_lastServerUpdate=j.updated_at;
      try{localStorage.removeItem('case_os_geo_pending_v1');}catch(e){}
      if(typeof audit==='function')audit('Геоаналитика: данные сохранены',String(reason||'ручное редактирование'));
      try{localStorage.setItem(STORAGE_KEY,JSON.stringify(stateBlob()));}catch(e){}
      toast(tr('Геоданные сохранены на сервере','Geo maʼlumotlar serverda saqlandi','Geo data saved on the server'));
      notifyFrame('asaas-geo-saved',{savedAt:j.updated_at||new Date().toISOString(),savedBy:j.updated_by||'',geoRevision:G.geoRevision});
    }catch(e){
      var msg=String(e&&e.message||'Неизвестная ошибка');
      console.error('Geoanalytics save failed',e);
      toast(tr('Геоданные не сохранены: ','Geo maʼlumotlar saqlanmadi: ','Geo data were not saved: ')+msg);
      notifyFrame('asaas-geo-save-failed',{error:msg});
    }finally{G.saving=false;}
  }
  function css(){
    if(document.getElementById('geoV42Css'))return;
    var s=document.createElement('style');s.id='geoV42Css';s.textContent=''
      +'.main.geo-workspace{padding:7px 9px 0}.geo-v42{min-width:0}.geo-v42-toolbar{display:flex;gap:6px;align-items:center;background:var(--panel);border:1px solid var(--border);border-radius:10px 10px 0 0;padding:6px}.geo-v42-toolbar select{flex:1;min-width:0;border:1px solid var(--border);border-radius:7px;background:var(--panel);color:var(--ink);padding:7px 9px;font:600 11.5px inherit}.geo-v42-recover{border:1px solid #d8bd76;border-radius:7px;background:#fff8e8;color:#7a5200;padding:7px 10px;font:800 10.5px inherit;cursor:pointer;white-space:nowrap}.geo-v42-recover:hover{background:#f7e8be}.geo-v42-reload{flex:0 0 34px;width:34px;height:32px;border:1px solid var(--border);border-radius:7px;background:var(--panel);color:var(--ink);font:800 16px inherit}.geo-v42-reload:hover{background:var(--soft);color:var(--red-d)}.geo-v42-frame{position:relative;border:1px solid var(--border);border-top:0;border-radius:0 0 10px 10px;overflow:hidden;background:#f4f3f1;box-shadow:var(--shadow)}.geo-v42-frame iframe{display:block;border:0;width:100%;height:calc(100dvh - 105px);min-height:480px;background:#f4f3f1}.geo-v42-loader{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.86);font-size:12px;font-weight:800;color:var(--red-d)}'
      +'body.dark .geo-v42-toolbar,body.dark .geo-v42-reload{background:var(--panel)}@media(max-width:780px){.main.geo-workspace{padding:6px 5px 0}.geo-v42-frame iframe{height:calc(100dvh - 150px);min-height:520px}}';
    s.textContent+='.geo-tabbar{display:flex;gap:6px;margin:0 0 10px}.geo-tabbar button{font-family:inherit;font-size:13px;font-weight:600;padding:7px 14px;border:1px solid var(--border);background:var(--panel);color:var(--muted);border-radius:9px;cursor:pointer}.geo-tabbar button.on{background:var(--red-d,#a3132a);color:#fff;border-color:var(--red-d,#a3132a)}';
    document.head.appendChild(s);
  }
  function install(){
    css();
    window.addEventListener('resize',fitFrame,{passive:true});
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._geo420){
      window.go=function(v){
        if(v==='geoanalytics'||v==='map'||v==='analytics_hub'){
          if(v==='map'){G.tab=isExternal()?'market':'ours';}
          else{G.tab='market';}/* geoanalytics/analytics_hub → рынок и POI (детальная студия) */
          if(!canView()){try{if(typeof toast==='function')toast(tr('Этот раздел не входит в вашу рабочую область.','Bu bo‘lim sizning ishchi sohangizga kirmaydi.','This module is outside your workspace.'));}catch(e){}return oldGo.call(this,(window.asaasWorkspaceFirst&&window.asaasWorkspaceFirst())||'dash');}
          try{S.view='geoanalytics';}catch(e){}
          var navV=(G.tab==='ours')?'map':'geoanalytics';
          document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v===navV);});
          try{if(typeof window.asaasNavClose==='function')window.asaasNavClose();}catch(e){}
          var side=document.getElementById('side'),scrim=document.getElementById('scrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('open');
          render();try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}return;
        }
        var main=document.getElementById('main');if(main)main.classList.remove('geo-workspace');
        return oldGo.apply(this,arguments);
      };
      window.go._geo420=true;
    }
    var oldTheme=window.toggleTheme;
    if(typeof oldTheme==='function'&&!oldTheme._geo420){window.toggleTheme=function(){var r=oldTheme.apply(this,arguments);setTimeout(context,0);return r;};window.toggleTheme._geo420=true;}
  }
  window.addEventListener('message',function(e){
    if(e.origin!==location.origin||!e.data||e.data.source!=='asaas-geo-v42')return;
    if(e.data.type==='asaas-geo-ready'){G.ready=true;var l=document.getElementById('geoLoader');if(l)l.style.display='none';loadGeoFresh().then(context);}
    else if(e.data.type==='asaas-geo-save')saveGeo(e.data.data,e.data.reason);
  });
  window.geoV42Project=function(id){G.project=String(id||'');context();};
  window.geoV42Recover=function(){if(!G.recoveryData||G.saving)return;var copy=JSON.parse(JSON.stringify(G.recoveryData));G.recoveryData=null;var b=document.getElementById('geoRecoverBtn');if(b)b.style.display='none';saveGeo(copy,'восстановление локальной копии Младшего администратора');};
  /* Серверная история геоданных: последние 50 снимков (таблица geo_state_history). Любой
     редактор может её посмотреть, администратор — откатить к выбранному снимку. Это надёжный
     способ вернуть данные (в отличие от локальной копии, привязанной к браузеру автора). */
  function geoIsAdmin(){try{return !!(typeof R==='function'&&R().admin);}catch(e){return false;}}
  window.geoV42History=async function(){
    if(!canEdit()||typeof apiGET!=='function'){toast(tr('История недоступна','Tarix mavjud emas','History unavailable'));return;}
    var j;try{j=await apiGET('geo_state.php?history');}catch(e){toast(tr('Не удалось загрузить историю: ','Tarixni yuklab bo‘lmadi: ','Failed to load history: ')+(e&&e.message||''));return;}
    var rows=(j&&j.history)||[],admin=geoIsAdmin();
    var list=rows.length?rows.map(function(r){
      return '<tr><td style="padding:5px 8px;white-space:nowrap">'+h(r.created_at||'')+'</td><td style="padding:5px 8px">'+h(r.updated_by||'')+'</td><td style="padding:5px 8px">'+h(r.reason||'')+'</td><td style="padding:5px 8px;text-align:center">'+h('rev '+(r.geo_revision||0))+'</td><td style="padding:5px 8px;text-align:right">'+(admin?'<button class="btn" style="padding:3px 10px" onclick="geoV42Restore('+(+r.id)+')">'+h(tr('Восстановить','Tiklash','Restore'))+'</button>':'<span style="color:#999;font-size:11px">'+h(tr('только админ','faqat admin','admin only'))+'</span>')+'</td></tr>';
    }).join(''):'<tr><td colspan="5" style="text-align:center;color:#888;padding:16px">'+h(tr('Снимков пока нет','Hozircha snapshotlar yo‘q','No snapshots yet'))+'</td></tr>';
    var ov=document.getElementById('geoHistModal');if(ov)ov.remove();
    ov=document.createElement('div');ov.id='geoHistModal';ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML='<div style="background:#fff;border-radius:12px;max-width:860px;width:100%;max-height:82vh;overflow:auto;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.3)">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;font-size:16px">'+h(tr('История сохранений геоданных','Geo saqlashlar tarixi','Geo save history'))+'</h3><button class="btn sec" style="padding:3px 10px" onclick="var m=document.getElementById(\'geoHistModal\');if(m)m.remove();">✕</button></div>'
      +'<p style="color:#666;font-size:12px;margin:0 0 10px">'+h(tr('Последние 50 снимков на сервере. Администратор может откатить геоданные к любому из них (текущее состояние тоже сохранится в истории).','Serverdagi oxirgi 50 snapshot. Administrator geo maʼlumotlarni istalganiga qaytarishi mumkin.','Last 50 server snapshots. An admin can roll geo data back to any of them.'))+'</p>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;border-bottom:1px solid #eee;color:#666"><th style="padding:5px 8px">'+h(tr('Дата','Sana','Date'))+'</th><th style="padding:5px 8px">'+h(tr('Кто','Kim','By'))+'</th><th style="padding:5px 8px">'+h(tr('Причина','Sabab','Reason'))+'</th><th style="padding:5px 8px;text-align:center">Rev</th><th style="padding:5px 8px"></th></tr></thead><tbody>'+list+'</tbody></table></div>';
    ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
    document.body.appendChild(ov);
  };
  window.geoV42Restore=async function(id){
    id=+id;if(!id)return;
    if(!geoIsAdmin()){toast(tr('Восстановление доступно только администратору','Tiklash faqat administrator uchun','Restore is admin-only'));return;}
    if(!confirm(tr('Восстановить геоданные из снимка #','#','Restore geo data from snapshot #')+id+tr('? Текущее состояние будет заменено (оно тоже сохранится в истории).','?','? The current state will be replaced.')))return;
    try{var j=await apiPOST('geo_state.php',{action:'restore',history_id:id,expected_geo_revision:G.geoRevision||0});
      if(j&&j.ok){GEO_DATA=(j.data&&typeof j.data==='object')?j.data:GEO_DATA;G.geoRevision=+j.geo_revision||G.geoRevision;var m=document.getElementById('geoHistModal');if(m)m.remove();toast(tr('Геоданные восстановлены из снимка #','#','Geo data restored from snapshot #')+id);try{context();}catch(e){}try{geoV42Reload();}catch(e){}}
      else throw new Error((j&&j.error)||'нет подтверждения');
    }catch(e){var msg=String(e&&e.message||'');toast(tr('Не удалось восстановить: ','Tiklab bo‘lmadi: ','Restore failed: ')+msg);}
  };
  window.geoV42Reload=function(){var fr=frame();if(fr){G.ready=false;var l=document.getElementById('geoLoader');if(l)l.style.display='flex';fr.src='geoanalytics-studio.html?embedded=1&v='+geoStudioVer()+'&t='+Date.now();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
