/* CASE OS v4.32.6 — global module lifecycle / feature flags.
   A module can be Active, Beta (administrators only) or Hidden.
   Hidden modules keep their data and workspace assignments, but disappear from navigation
   and cannot be opened by a direct route. Future placeholder modules are hidden by default. */
(function(){
  'use strict';
  if(window.CASE_FEATURE_FLAGS_410)return;
  window.CASE_FEATURE_FLAGS_410=true;

  var VALID=['active','beta','hidden','disabled','deprecated'];
  var PROTECTED=['dash','users']; // prevents administrator lockout from Home and module settings
  var UI={q:'',only:'all'};
  var injectTimer=null;

  function modules(){return Array.isArray(window.CASE_OS_MODULES)?window.CASE_OS_MODULES:[];}
  function moduleById(v){var a=modules();for(var i=0;i<a.length;i++)if(a[i].v===v)return a[i];return null;}
  function store(){
    try{if(!MODULE_FLAGS||typeof MODULE_FLAGS!=='object'||Array.isArray(MODULE_FLAGS))MODULE_FLAGS={};return MODULE_FLAGS;}
    catch(e){return {};}
  }
  function currentUserKey(){try{return String((S.user&&(S.user.id||S.user.u||S.user.email))||S.role||'');}catch(e){return '';}}
  function isAdmin(){try{return !!(typeof R==='function'&&R()&&R().admin);}catch(e){return false;}}
  function defaultStatus(v){if(PROTECTED.indexOf(v)>=0)return 'active';var m=moduleById(v);return m&&m.future?'hidden':'active';}
  function status(v){
    if(PROTECTED.indexOf(v)>=0)return 'active';
    var rec=store()[v],s=typeof rec==='string'?rec:(rec&&rec.status);
    return VALID.indexOf(s)>=0?s:defaultStatus(v);
  }
  function enabled(v){var s=status(v);return s==='active'||s==='deprecated'||(s==='beta'&&isAdmin());}
  function label(m){try{var l=typeof LANG==='string'?LANG:'ru';return m[l]||m.ru||m.v;}catch(e){return m.ru||m.v;}}
  function groupLabel(g){try{var x=window.CASE_OS_GROUPS&&window.CASE_OS_GROUPS[g],l=typeof LANG==='string'?LANG:'ru';return x&&(x[l]||x.ru)||g;}catch(e){return g;}}
  function escH(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function firstEnabled(){
    var views=[];try{views=typeof window._caseFeatureBaseViews==='function'?window._caseFeatureBaseViews():(typeof window.asaasWorkspaceViews==='function'?window.asaasWorkspaceViews():[]);}catch(e){}
    for(var i=0;i<views.length;i++)if(enabled(views[i]))return views[i];
    return enabled('dash')?'dash':(modules().find(function(m){return enabled(m.v);})||{v:'dash'}).v;
  }
  function markAudit(action,detail){try{if(typeof audit==='function')audit(action,detail||'');}catch(e){}try{if(typeof persist==='function')persist();}catch(e){}}

  window.caseFeatureStatus=status;
  window.caseFeatureEnabled=enabled;
  window.caseFeatureFirst=firstEnabled;

  function pruneNav(){
    var nav=document.getElementById('nav');if(!nav)return;
    nav.querySelectorAll('a[data-v]').forEach(function(a){
      var v=a.dataset.v;if(!enabled(v)){a.remove();return;}
      var s=status(v);a.classList.toggle('case-feature-beta',s==='beta');
      if(s==='beta'&&!a.querySelector('.case-feature-beta-tag')){var e=document.createElement('em');e.className='case-feature-beta-tag';e.textContent='BETA';a.appendChild(e);}
    });
    nav.querySelectorAll('.nav-group').forEach(function(g){if(!g.querySelector('a[data-v]'))g.remove();});
  }
  function matrixModuleId(btn){
    var s=btn.getAttribute('onclick')||'';
    var m=s.match(/wsToggle(?:Role|User)View\([^,]+,'([^']+)'\)/);return m&&m[1]||'';
  }
  function pruneWorkspaceMatrix(){
    document.querySelectorAll('#wsAdminCard .ws-module').forEach(function(b){var v=matrixModuleId(b);if(v)b.style.display=status(v)==='hidden'?'none':'';});
    document.querySelectorAll('#wsAdminCard .ws-group').forEach(function(g){var shown=[].some.call(g.querySelectorAll('.ws-module'),function(x){return x.style.display!=='none';});g.style.display=shown?'':'none';});
  }
  function refreshShell(){
    try{if(typeof window._caseFeatureBaseBuildNav==='function')window._caseFeatureBaseBuildNav();else if(typeof buildNav==='function')buildNav();}catch(e){}
    pruneNav();pruneWorkspaceMatrix();scheduleInject();
    try{if(S&&S.user&&moduleById(S.view)&&!enabled(S.view))window.go(firstEnabled());}catch(e){}
  }

  function option(s,cur,ru,en,uz){var txt=(typeof LANG==='string'&&LANG==='en')?en:(typeof LANG==='string'&&LANG==='uz')?uz:ru;return '<option value="'+s+'"'+(cur===s?' selected':'')+'>'+txt+'</option>';}
  function statusText(s){var l=typeof LANG==='string'?LANG:'ru';var x={active:{ru:'Активен',uz:'Faol',en:'Active'},beta:{ru:'Beta · только Admin',uz:'Beta · faqat Admin',en:'Beta · admins only'},hidden:{ru:'Скрыт',uz:'Yashirilgan',en:'Hidden'},disabled:{ru:'Отключён',uz:'O‘chirilgan',en:'Disabled'},deprecated:{ru:'Устаревает',uz:'Eskirgan',en:'Deprecated'}};return x[s][l]||x[s].ru;}
  function cardCopy(){var l=typeof LANG==='string'?LANG:'ru';return {
    ru:{title:'Управление модулями',sub:'Глобальный переключатель жизненного цикла функций. Скрытый модуль не отображается в меню и не открывается прямой ссылкой; данные и индивидуальные права сохраняются.',all:'Все',current:'Рабочие',future:'Будущие',search:'Поиск модуля…',hideFuture:'Скрыть все будущие',activateCurrent:'Включить рабочие',reset:'Сбросить настройки',built:'рабочий',planned:'будущий / план',system:'системный'},
    uz:{title:'Modullar boshqaruvi',sub:'Funksiyalar hayot siklining global kaliti. Yashirilgan modul menyuda ko‘rinmaydi va to‘g‘ridan-to‘g‘ri ochilmaydi; ma’lumot va huquqlar saqlanadi.',all:'Barchasi',current:'Ishchi',future:'Kelajak',search:'Modul qidirish…',hideFuture:'Kelajak modullarini yashirish',activateCurrent:'Ishchi modullarni yoqish',reset:'Sozlamalarni tiklash',built:'ishchi',planned:'kelajak / reja',system:'tizimli'},
    en:{title:'Module management',sub:'Global lifecycle switch for platform features. A hidden module disappears from navigation and direct routes while its data and workspace assignments remain intact.',all:'All',current:'Current',future:'Future',search:'Search modules…',hideFuture:'Hide all future modules',activateCurrent:'Activate current modules',reset:'Reset settings',built:'current',planned:'future / planned',system:'system'}
  }[l]||null;}
  function visibleModule(m){var q=(UI.q||'').toLowerCase(),txt=(m.v+' '+label(m)+' '+groupLabel(m.g)).toLowerCase();if(q&&txt.indexOf(q)<0)return false;if(UI.only==='current'&&m.future)return false;if(UI.only==='future'&&!m.future)return false;return true;}
  /* Фаза 6: свёрнутость групп — ЛИЧНАЯ настройка интерфейса (per-user localStorage), не общая корпоративная.
     Раньше <details open> форсился при каждом рендере → состояние сбрасывалось на любом перерендере (поиск/автосинк/смена флага). */
  function ffCollapsedKey(){var k='u';try{k=currentUserKey()||'u';}catch(e){}return 'case_ff_collapsed_'+k;}
  function ffLoadCollapsed(){try{return JSON.parse(localStorage.getItem(ffCollapsedKey())||'{}')||{};}catch(e){return {};}}
  function ffIsCollapsed(g){var c=ffLoadCollapsed();return !!c[g];}
  function ffSaveCollapsed(g,on){try{var c=ffLoadCollapsed();if(on)c[g]=1;else delete c[g];localStorage.setItem(ffCollapsedKey(),JSON.stringify(c));}catch(e){}}
  window.caseFeatureGroupToggle=function(g,isOpen){ffSaveCollapsed(g,!isOpen);};
  window.caseFeatureGroupsAll=function(collapse){try{var c={};if(collapse){(window.CASE_OS_GROUP_ORDER||[]).forEach(function(g){c[g]=1;});}localStorage.setItem(ffCollapsedKey(),JSON.stringify(c));}catch(e){}renderCard();};
  function renderCard(){
    var host=document.getElementById('caseFeatureAdminCard');if(!host)return;var C=cardCopy(),groups=window.CASE_OS_GROUP_ORDER||[];
    var body=groups.map(function(g){var rows=modules().filter(function(m){return m.g===g&&visibleModule(m);});if(!rows.length)return '';
      var col=ffIsCollapsed(g);
      return '<details class="ff-group" id="ffg_'+escH(g)+'"'+(col?'':' open')+' ontoggle="caseFeatureGroupToggle(\''+escH(g)+'\',this.open)"><summary>'+escH(groupLabel(g))+' <span>'+rows.length+'</span></summary><div class="ff-list">'+rows.map(function(m){var s=status(m.v),locked=PROTECTED.indexOf(m.v)>=0;return '<div class="ff-row" data-v="'+escH(m.v)+'"><div class="ff-icon">'+escH(m.icon||'◦')+'</div><div class="ff-name"><b>'+escH(label(m))+'</b><small>'+escH(m.v)+' · '+escH(locked?C.system:(m.future?C.planned:C.built))+'</small></div><select class="ff-status '+s+'" '+(locked?'disabled title="'+escH(C.system)+'"':'onchange="caseFeatureSet(\''+escH(m.v)+'\',this.value)"')+'>'+option('active',s,'Активен','Active','Faol')+option('beta',s,'Beta · только Admin','Beta · admins only','Beta · faqat Admin')+option('hidden',s,'Скрыт','Hidden','Yashirilgan')+option('disabled',s,'Отключён','Disabled','O‘chirilgan')+option('deprecated',s,'Устаревает','Deprecated','Eskirgan')+'</select></div>';}).join('')+'</div></details>';
    }).join('');
    host.innerHTML='<div class="ff-head"><div><div class="ff-eye">CASE OS · FEATURE FLAGS</div><h3>'+escH(C.title)+'</h3><p>'+escH(C.sub)+'</p></div><div class="ff-summary"><b>'+modules().filter(function(m){return enabled(m.v);}).length+'</b><span>/ '+modules().length+'</span></div></div><div class="ff-tools"><input value="'+escH(UI.q)+'" oninput="caseFeatureFilter(this.value)" placeholder="'+escH(C.search)+'"><div class="ff-tabs"><button class="'+(UI.only==='all'?'active':'')+'" onclick="caseFeatureOnly(\'all\')">'+escH(C.all)+'</button><button class="'+(UI.only==='current'?'active':'')+'" onclick="caseFeatureOnly(\'current\')">'+escH(C.current)+'</button><button class="'+(UI.only==='future'?'active':'')+'" onclick="caseFeatureOnly(\'future\')">'+escH(C.future)+'</button></div><button class="btn ghost sm" onclick="caseFeatureHideFuture()">'+escH(C.hideFuture)+'</button><button class="btn ghost sm" onclick="caseFeatureActivateCurrent()">'+escH(C.activateCurrent)+'</button><button class="btn ghost sm" onclick="caseFeatureReset()">↺ '+escH(C.reset)+'</button><button class="btn ghost sm" onclick="caseFeatureGroupsAll(true)" title="Свернуть все группы">▸ '+(cardCopy().collapseAll||'Свернуть всё')+'</button><button class="btn ghost sm" onclick="caseFeatureGroupsAll(false)" title="Развернуть все группы">▾ '+(cardCopy().expandAll||'Развернуть всё')+'</button></div>'+body;
  }
  function injectCard(){
    clearTimeout(injectTimer);injectTimer=null;
    try{if(!isAdmin()||!S||S.view!=='admin_modules')return;}catch(e){return;}
    var main=document.getElementById('main');if(!main)return;var card=document.getElementById('caseFeatureAdminCard');
    if(!card){card=document.createElement('div');card.id='caseFeatureAdminCard';card.className='card ff-admin';var ref=document.getElementById('wsAdminCard')||main.querySelector('.card');if(ref)main.insertBefore(card,ref);else main.appendChild(card);}
    renderCard();pruneWorkspaceMatrix();
  }
  function scheduleInject(){if(injectTimer)return;injectTimer=setTimeout(injectCard,30);}

  window.caseFeatureSet=function(v,s){if(!isAdmin()||PROTECTED.indexOf(v)>=0||VALID.indexOf(s)<0||!moduleById(v))return;store()[v]={status:s,updatedAt:new Date().toISOString(),updatedBy:currentUserKey()};markAudit('Статус модуля',v+' → '+s);refreshShell();renderCard();};
  window.caseFeatureFilter=function(q){UI.q=q||'';renderCard();};
  window.caseFeatureOnly=function(v){UI.only=v||'all';renderCard();};
  window.caseFeatureHideFuture=function(){if(!isAdmin())return;modules().forEach(function(m){if(m.future)store()[m.v]={status:'hidden',updatedAt:new Date().toISOString(),updatedBy:currentUserKey()};});markAudit('Модули','будущие модули скрыты');refreshShell();renderCard();};
  window.caseFeatureActivateCurrent=function(){if(!isAdmin())return;modules().forEach(function(m){if(!m.future)store()[m.v]={status:'active',updatedAt:new Date().toISOString(),updatedBy:currentUserKey()};});markAudit('Модули','рабочие модули активированы');refreshShell();renderCard();};
  window.caseFeatureReset=function(){if(!isAdmin())return;if(typeof confirm==='function'&&!confirm('Сбросить глобальные статусы модулей? Рабочие функции станут активными, будущие — скрытыми.'))return;Object.keys(store()).forEach(function(k){delete store()[k];});markAudit('Модули','сброс к значениям по умолчанию');refreshShell();renderCard();};

  function css(){if(document.getElementById('caseFeature410Css'))return;var s=document.createElement('style');s.id='caseFeature410Css';s.textContent=
    '.case-feature-beta-tag{margin-left:auto;font-style:normal;font-size:8px;font-weight:900;letter-spacing:.06em;border:1px solid #d7ae58;border-radius:999px;padding:3px 5px;color:#79570e;background:#fff6d9}.ff-admin{border-top:3px solid #9E0000}.ff-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.ff-head h3{font-size:18px;margin:2px 0 4px}.ff-head p{margin:0;color:var(--muted);font-size:12px;max-width:880px;line-height:1.5}.ff-eye{font-size:9.5px;color:var(--red-d);font-weight:900;letter-spacing:.12em}.ff-summary{display:flex;align-items:baseline;gap:4px;border:1px solid var(--border);background:var(--soft);border-radius:12px;padding:9px 12px;white-space:nowrap}.ff-summary b{font-size:22px;color:var(--red-d)}.ff-summary span{font-size:11px;color:var(--muted)}.ff-tools{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:14px 0}.ff-tools>input{min-width:240px;flex:1;border:1px solid var(--border);background:var(--panel);color:var(--ink);border-radius:9px;padding:8px 10px;font:inherit;font-size:11px}.ff-tabs{display:flex;border:1px solid var(--border);border-radius:9px;overflow:hidden}.ff-tabs button{border:0;border-right:1px solid var(--border);background:var(--panel);color:var(--muted);padding:8px 10px;font:inherit;font-size:10px;font-weight:800}.ff-tabs button:last-child{border-right:0}.ff-tabs button.active{background:var(--red);color:#fff}.ff-group{border:1px solid var(--border);border-radius:12px;background:var(--soft);margin:8px 0;overflow:hidden}.ff-group summary{cursor:pointer;padding:10px 12px;font-size:11px;font-weight:900;letter-spacing:.02em}.ff-group summary span{color:var(--muted);font-weight:700}.ff-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:0 10px 10px}.ff-row{display:grid;grid-template-columns:24px minmax(0,1fr) 170px;gap:8px;align-items:center;border:1px solid var(--border);border-radius:9px;background:var(--panel);padding:8px}.ff-icon{text-align:center;color:var(--red-d);font-size:16px}.ff-name{min-width:0}.ff-name b,.ff-name small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ff-name b{font-size:10.5px}.ff-name small{font-size:8.5px;color:var(--muted);margin-top:2px}.ff-status{width:100%;border:1px solid var(--border);border-radius:8px;padding:6px;font:inherit;font-size:9.5px;font-weight:800;background:var(--panel);color:var(--ink)}.ff-status.active{border-color:#9cc8a5;color:#256433;background:#eef8f0}.ff-status.beta{border-color:#d7ae58;color:#79570e;background:#fff6d9}.ff-status.hidden{color:#666;background:#eee}@media(max-width:1050px){.ff-list{grid-template-columns:1fr}}@media(max-width:650px){.ff-head{flex-direction:column}.ff-row{grid-template-columns:22px minmax(0,1fr)}.ff-status{grid-column:1/-1}.ff-tools>input{min-width:100%}}body.dark .ff-status.active{background:#17301d;color:#7fd089}body.dark .ff-status.beta{background:#352d18;color:#e6c46c}body.dark .ff-status.hidden{background:#292929;color:#aaa}';document.head.appendChild(s);}

  function install(){
    css();
    window._caseFeatureBaseViews=typeof window.asaasWorkspaceViews==='function'?window.asaasWorkspaceViews:null;
    window._caseFeatureBaseBuildNav=typeof window.buildNav==='function'?window.buildNav:null;
    if(window._caseFeatureBaseViews){window.asaasWorkspaceViews=function(){return window._caseFeatureBaseViews().filter(enabled);};window.caseWorkspaceViews=window.asaasWorkspaceViews;}
    window.asaasWorkspaceFirst=firstEnabled;
    var baseCan=typeof window.asaasWorkspaceCanOpen==='function'?window.asaasWorkspaceCanOpen:function(){return true;};
    window.asaasWorkspaceCanOpen=function(v){return enabled(v)&&baseCan(v);};window.caseWorkspaceCanOpen=window.asaasWorkspaceCanOpen;
    if(window._caseFeatureBaseBuildNav){window.buildNav=function(){window._caseFeatureBaseBuildNav();pruneNav();scheduleInject();};}
    var oldGo=window.go;if(typeof oldGo==='function'&&!oldGo._caseFeature410){window.go=function(v){if(moduleById(v)&&!enabled(v)){try{if(typeof toast==='function')toast((typeof LANG==='string'&&LANG==='en')?'This module is disabled in settings.':(typeof LANG==='string'&&LANG==='uz')?'Bu modul sozlamalarda o‘chirilgan.':'Этот модуль отключён в настройках.');}catch(e){}v=firstEnabled();}var r=oldGo.call(this,v);pruneNav();scheduleInject();return r;};window.go._caseFeature410=true;}
    var main=document.getElementById('main');if(main&&window.MutationObserver)new MutationObserver(function(){pruneNav();scheduleInject();}).observe(main,{childList:true});
    pruneNav();scheduleInject();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,30);},{once:true});else setTimeout(install,30);
})();
