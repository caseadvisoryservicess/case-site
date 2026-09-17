/* CASE OS v4.74.0: режим «только геоаналитика».
 *
 * Решение владельца: на хостинге остаётся только геоаналитика, функции других отделов
 * отключаются. Режим приходит с сервера (auth.php -> mode из api/mode.php или config.php),
 * по умолчанию берётся из index.html (window.CASE_PLATFORM_MODE). Что делает модуль в
 * режиме geo:
 *
 *   - меню: группа «Геоаналитика» (рынок и POI, Geo Platform по бизнес-центрам, наши
 *     проекты для сотрудников) и «Администрирование» для админа; остальные разделы не
 *     строятся, а переход в них (сохранённый экран, прямой go) уводит в геоаналитику;
 *   - главный экран платформы = студия геоаналитики;
 *   - шапка без переключателя объектов и глобального поиска (они про аренду), без чата,
 *     квиза и курса валют; подпись бренда «Geo Analytics Platform»;
 *   - страницы «Модули» и «Доступ» показывают только оставшиеся разделы и объясняют,
 *     что остальное отключено на сервере;
 *   - v4.76.0: отдельного экрана «Geo Platform: бизнес-центры» больше нет (решение владельца:
 *     те же данные, что в студии, путали людей); фильтры, список, сравнение, показатели и
 *     тепловая карта ставок живут в студии (v4760-geo-bc.js).
 *
 * Данные других отделов в базе не трогаются: сервер их не отдаёт и не принимает, клиент их
 * не показывает. Возврат к полной платформе: 'full' в api/mode.php или config.php.
 */
(function(){
  'use strict';
  if(window.CASE_GEO_ONLY_4740)return;
  window.CASE_GEO_ONLY_4740=true;
  var VERSION='4.76.0';
  var GEO_VIEWS=['geoanalytics','map'];
  /* v4.76.0: флаг прежнего экрана Geo Platform убираем из памяти браузера, чтобы он не всплывал */
  try{localStorage.removeItem('case_geo_platform_open');}catch(e){}
  var ADMIN_VIEWS=['users','admin_modules','admin_system'];
  var ALLOWED=GEO_VIEWS.concat(ADMIN_VIEWS,['analytics_hub','chat']);
  function mode(){return String(window.CASE_PLATFORM_MODE||'full')==='geo'?'geo':'full';}
  function on(){return mode()==='geo';}
  function role(){try{return typeof R==='function'?(R()||{}):{};}catch(e){return {};}}
  function tr(ru,uz,en){try{return LANG==='uz'?uz:(LANG==='en'?en:ru);}catch(e){return ru;}}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function canOpen(v){try{if(typeof window.asaasWorkspaceCanOpen==='function')return !!window.asaasWorkspaceCanOpen(v);}catch(e){}return true;}
  function moduleLabel(v){
    try{var list=window.CASE_OS_MODULES||[];for(var i=0;i<list.length;i++)if(list[i].v===v)return list[i][LANG]||list[i].ru||v;}catch(e){}
    return v;
  }
  function moduleIcon(v){try{var list=window.CASE_OS_MODULES||[];for(var i=0;i<list.length;i++)if(list[i].v===v)return list[i].icon||'◦';}catch(e){}return '◦';}
  function allowedView(v){return ALLOWED.indexOf(v)>=0;}
  function firstView(){return canOpen('geoanalytics')?'geoanalytics':(canOpen('map')?'map':(role().admin?'users':'geoanalytics'));}

  /* ── меню ──────────────────────────────────────────────────────────────────────── */
  function navLink(v){
    var active=false;try{active=S&&S.view===v;}catch(e){}
    return '<a data-v="'+v+'" class="'+(active?'active':'')+'" title="'+h(moduleLabel(v))+'" onclick="caseNavGo(this,\''+v+'\')"><span class="ic">'+moduleIcon(v)+'</span><span class="case-nav-label">'+h(moduleLabel(v))+'</span></a>';
  }
  function navGroup(title,views){
    if(!views.length)return '';
    var active=false;try{active=views.indexOf(S&&S.view)>=0;}catch(e){}
    return '<div class="nav-group '+(active?'has-active open':'open')+'"><button type="button" class="nav-group-btn" aria-haspopup="true" aria-expanded="true" onclick="caseNavToggle(event,this)"><span>'+h(title)+'</span><span class="chev">▼</span></button><div class="nav-menu">'+views.map(navLink).join('')+'</div></div>';
  }
  function geoNav(){
    var nav=document.getElementById('nav');if(!nav)return;
    var ext=!!role().external;
    var geo=[];
    if(canOpen('geoanalytics'))geo.push('geoanalytics');
    if(!ext&&canOpen('map'))geo.push('map');
    var adm=role().admin?ADMIN_VIEWS.filter(canOpen):[];
    nav.innerHTML=navGroup(tr('Геоаналитика','Geoanalitika','Geoanalytics'),geo)+navGroup(tr('Администрирование','Boshqaruv','Administration'),adm);
  }
  function fullNavExtra(){} /* v4.76.0: в полном режиме отдельного пункта Geo Platform тоже нет */

  /* ── шапка, чат, квиз, страницы администрирования ──────────────────────────────── */
  function css(){
    if(document.getElementById('geoOnlyCss'))return;
    var s=document.createElement('style');s.id='geoOnlyCss';s.textContent=
      'body.case-geo-only #objSel,body.case-geo-only .gsearch,body.case-geo-only #addObjBtn,body.case-geo-only #editObjBtn,body.case-geo-only #chatFab,body.case-geo-only #chatW,body.case-geo-only #chatNotif,body.case-geo-only .quizpop,body.case-geo-only .quizpop-badge,body.case-geo-only #fxRow{display:none!important}'
      +'body.case-geo-only .who{margin-left:auto}'
      +'.geo-only-banner{display:flex;gap:10px;align-items:flex-start;border:1px solid #efdca6;background:#fff8e6;color:#6b4e00;border-radius:10px;padding:9px 12px;font-size:12px;margin:0 0 12px}.geo-only-banner b{white-space:nowrap}body.dark .geo-only-banner{background:#3a2f14;color:#f0d9a0;border-color:#5a4a1d}'
      +'.ff-row.geo-only-off,.ws-module.geo-only-off,.ff-group.geo-only-off,.ws-group.geo-only-off{display:none!important}';
    document.head.appendChild(s);
  }
  function brand(){
    var tag=tr('Geo Analytics Platform','Geo Analytics Platform','Geo Analytics Platform');
    document.querySelectorAll('.brand .tag,.lcard .tag').forEach(function(el){el.textContent=on()?tag:'Company & Real Estate Operating System';});
    try{document.title=on()?'CASE OS · Геоаналитика':'CASE OS - Real Estate Operating System';}catch(e){}
    var fx=document.getElementById('fxRate');if(fx&&fx.parentNode&&fx.parentNode.classList.contains('pm-row'))fx.parentNode.id='fxRow';
  }
  function noops(){
    /* чат, квиз и курс валют: в гео-режиме не запускаем таймеры и запросы */
    ['quizStartTimer','maybeShowQuiz','chatEnsureW','chatNews','loadChatUsers','updateChatBadge','loadFx'].forEach(function(n){
      var f=window[n];if(typeof f!=='function'||f._geoOnly)return;
      var w=function(){if(on())return;return f.apply(this,arguments);};w._geoOnly=true;window[n]=w;
    });
  }
  function matrixModuleId(btn){var s=btn.getAttribute('onclick')||'';var m=s.match(/wsToggle(?:Role|User)View\([^,]+,'([^']+)'\)/);return m&&m[1]||'';}
  function pruneAdmin(){
    if(!on())return;
    document.querySelectorAll('.ff-row[data-v]').forEach(function(r){r.classList.toggle('geo-only-off',!allowedView(r.getAttribute('data-v')));});
    document.querySelectorAll('.ff-group').forEach(function(g){g.classList.toggle('geo-only-off',!g.querySelector('.ff-row[data-v]:not(.geo-only-off)'));});
    document.querySelectorAll('#wsAdminCard .ws-module').forEach(function(b){var v=matrixModuleId(b);if(v)b.classList.toggle('geo-only-off',!allowedView(v));});
    document.querySelectorAll('#wsAdminCard .ws-group').forEach(function(g){g.classList.toggle('geo-only-off',!!g.querySelector('.ws-module')&&!g.querySelector('.ws-module:not(.geo-only-off)'));});
    var v='';try{v=S.view;}catch(e){}
    if((v==='admin_modules'||v==='users')&&!document.getElementById('geoOnlyBanner')){
      var ph=document.querySelector('#main .ph');
      if(ph){var b=document.createElement('div');b.id='geoOnlyBanner';b.className='geo-only-banner';b.innerHTML='<b>'+h(tr('Режим «только геоаналитика»','Faqat geoanalitika rejimi','Geo-only mode'))+'</b><span>'+h(tr('Разделы других отделов отключены на сервере (os/api/mode.php) и здесь не показаны. Их данные в базе сохранены; вернуть всё можно значением full в mode.php или config.php.','Boshqa bo‘limlar serverda o‘chirilgan (os/api/mode.php). Ma’lumotlar bazada saqlanadi.','Other departments are switched off on the server (os/api/mode.php) and hidden here. Their data stays in the database; set full in mode.php or config.php to bring everything back.'))+'</span>';ph.after(b);}
    }
  }

  /* ── установка ─────────────────────────────────────────────────────────────────── */
  function apply(){
    document.body.classList.toggle('case-geo-only',on());
    brand();
    try{if(typeof window.buildNav==='function')window.buildNav();}catch(e){}
  }
  function install(){
    css();noops();brand();
    var oldNav=window.buildNav;
    if(typeof oldNav==='function'&&!oldNav._geoOnly){window.buildNav=function(){if(on()){geoNav();}else{oldNav.apply(this,arguments);fullNavExtra();}try{if(typeof updateChatBadge==='function')updateChatBadge();}catch(e){}};window.buildNav._geoOnly=true;}
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._geoOnly){
      window.go=function(v){
        if(v==='geo_platform')v='geoanalytics'; /* v4.76.0: прежний экран Geo Platform ведёт в студию */
        if(on()&&(!allowedView(v)||v==='dash'))v=firstView();
        return oldGo.call(this,v);
      };
      window.go._geoOnly=true;
    }
    var oldBoot=window.boot;
    if(typeof oldBoot==='function'&&!oldBoot._geoOnly){
      window.boot=function(){
        document.body.classList.toggle('case-geo-only',on());brand();
        return oldBoot.apply(this,arguments);
      };
      window.boot._geoOnly=true;
    }
    var main=document.getElementById('main');
    if(main){try{new MutationObserver(function(){pruneAdmin();}).observe(main,{childList:true,subtree:true});}catch(e){}}
    document.body.classList.toggle('case-geo-only',on());
    /* ядро могло войти и вызвать boot() раньше, чем загрузился этот модуль (ответ auth.php
       приходит между отложенными скриптами): достраиваем меню и уводим с чужого экрана */
    try{
      if(typeof S!=='undefined'&&S&&S.user){
        brand();try{window.buildNav();}catch(e){}
        if(on()&&(!allowedView(S.view)||S.view==='dash'))window.go(firstView());
      }
    }catch(e){}
  }
  window.caseGeoOnly={version:VERSION,mode:mode,on:on,apply:apply,allowed:allowedView,views:function(){return GEO_VIEWS.slice();}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['v4740-geo-only']='4.76.0';
