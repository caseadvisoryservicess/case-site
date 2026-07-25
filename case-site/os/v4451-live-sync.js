(function(){
'use strict';
var VERSION='4.46.1';
var restoreSeq=0;

function byId(id){return document.getElementById(id);}
function cssEsc(v){try{return CSS.escape(String(v));}catch(e){return String(v).replace(/[^a-zA-Z0-9_-]/g,function(ch){return '\\'+ch;});}}
function currentView(){try{return (typeof S!=='undefined'&&S&&S.view)||'';}catch(e){return '';}}
function currentObject(){try{return (typeof S!=='undefined'&&S&&S.obj)||'';}catch(e){return '';}}

function scrollKey(el,index){
  if(el.id)return 'id:'+el.id;
  var table=el.matches&&el.matches('table')?el:el.querySelector&&el.querySelector('table[data-tblkey],table[data-case-grid-key]');
  if(table){
    var key=table.getAttribute('data-tblkey')||table.getAttribute('data-case-grid-key');
    if(key)return 'table:'+key;
  }
  if(el.classList&&el.classList.contains('asaas35-table-wrap'))return 'brands-table';
  if(el.classList&&el.classList.contains('geo-table-wrap'))return 'geo-table';
  return 'index:'+index;
}
function scrollCandidates(){
  var selectors=['#main','.tbl-scroll','.asaas35-table-wrap','.geo-table-wrap','.case-grid-scroll','.kanban','.tabs-scroll'];
  var seen=new Set(),out=[];
  selectors.forEach(function(sel){document.querySelectorAll(sel).forEach(function(el){if(!seen.has(el)){seen.add(el);out.push(el);}});});
  return out;
}
function findScroll(key,index){
  if(key.indexOf('id:')===0)return byId(key.slice(3));
  if(key.indexOf('table:')===0){
    var k=key.slice(6),table=document.querySelector('table[data-tblkey="'+cssEsc(k)+'"],table[data-case-grid-key="'+cssEsc(k)+'"]');
    return table&&(table.closest('.tbl-scroll,.asaas35-table-wrap,.geo-table-wrap,.case-grid-scroll')||table.parentElement);
  }
  if(key==='brands-table')return document.querySelector('.asaas35-table-wrap');
  if(key==='geo-table')return document.querySelector('.geo-table-wrap');
  return scrollCandidates()[index]||null;
}
function capture(){
  var active=document.activeElement,focus=null;
  if(active&&active!==document.body){
    focus={id:active.id||'',name:active.getAttribute&&active.getAttribute('name')||'',start:null,end:null};
    try{focus.start=active.selectionStart;focus.end=active.selectionEnd;}catch(e){}
  }
  var scrolls=scrollCandidates().map(function(el,i){return {key:scrollKey(el,i),index:i,left:el.scrollLeft||0,top:el.scrollTop||0};});
  var details=[];document.querySelectorAll('details[open]').forEach(function(d,i){details.push(d.id?('id:'+d.id):('index:'+i));});
  return {view:currentView(),obj:currentObject(),winX:window.scrollX||0,winY:window.scrollY||window.pageYOffset||0,scrolls:scrolls,focus:focus,details:details};
}
function restoreOne(snap){
  if(!snap)return;
  snap.scrolls.forEach(function(x){var el=findScroll(x.key,x.index);if(el){el.scrollLeft=x.left;el.scrollTop=x.top;}});
  try{window.scrollTo(snap.winX,snap.winY);}catch(e){}
  if(snap.focus){
    var el=snap.focus.id?byId(snap.focus.id):null;
    if(!el&&snap.focus.name)el=document.querySelector('[name="'+cssEsc(snap.focus.name)+'"]');
    if(el&&document.body.contains(el)&&typeof el.focus==='function'){
      try{el.focus({preventScroll:true});if(snap.focus.start!=null&&el.setSelectionRange)el.setSelectionRange(snap.focus.start,snap.focus.end);}catch(e){}
    }
  }
}
function restore(snap){
  var token=++restoreSeq;
  function run(){if(token!==restoreSeq)return;restoreOne(snap);}
  requestAnimationFrame(function(){run();requestAnimationFrame(run);});
  [40,120,260,520].forEach(function(ms){setTimeout(run,ms);});
}
function withPreservedUi(fn){
  var snap=capture(),result;
  try{
    result=fn&&fn();
    /* v4.46.2: улучшение таблиц в том же кадре — иначе до срабатывания дебаунса
       таблица мигает «сырым» (старым) видом */
    if(window.case432EnhanceNow)window.case432EnhanceNow();
  }finally{restore(snap);}
  return result;
}
function refreshBrands(){
  if(typeof window.asaas35RefreshResults==='function')return window.asaas35RefreshResults();
  if(typeof window.renderBrands==='function')return window.renderBrands();
}
function refreshRegistry(){if(typeof window.renderRegistry==='function')return window.renderRegistry();}
function routeRender(){try{if(typeof window.go==='function')return window.go(currentView());}catch(e){}}
function entitySaved(kind,id){
  var view=currentView();
  try{window.dispatchEvent(new CustomEvent('caseos:entity-saved',{detail:{kind:kind,id:id,view:view,at:Date.now()}}));}catch(e){}
  if(kind==='brand'&&view==='brands')return withPreservedUi(refreshBrands);
  if(kind==='unit'&&view==='registry')return withPreservedUi(refreshRegistry);
  if(kind==='unit'&&(view==='plans'||view==='dash'||view==='map'))return withPreservedUi(routeRender);
  /* v4.46.1: остальные разделы (даты, документы, канбан…) тоже показывают сохранённое сразу;
     встроенные студии (гео/ТЭО) не перезагружаем */
  if(document.querySelector('#main #geoFrame,#main #feasFrame'))return;
  return withPreservedUi(routeRender);
}
var VIEW_KEYS={
  brands:['BRANDS'],
  registry:['U','OBJECTS','BRANDS','CHANGES','REFUSALS'],
  plans:['U','OBJECTS','PLANUP','PLANSVG','PLAN_LABELPOS','PLAN_CODES','PLAN_STRUCT','PLAN_IGNORED_CODES','CASE_LAYOUT_VERSIONS'],
  dash:['U','OBJECTS','BRANDS','CASE_TASKS','CASE_OPPORTUNITIES','OWNER_REPORTS'],
  map:['OBJECTS','U','GEO_DATA','MAPCFG'],
  docs:['DOCREG','DOC_CONTACTS','OBJECTS'],
  kpi:['AGENTS','KPI_TARGETS','U','ACTLOG'],
  dates:['U','CHANGES','OBJECTS'],
  users:['USERS','ROLES','ROLE_WORKSPACES','USER_WORKSPACES'],
  admin_modules:['MODULE_FLAGS','ROLE_WORKSPACES','USER_WORKSPACES'],
  admin_system:['MODULE_FLAGS','ROLE_WORKSPACES','USER_WORKSPACES','USERS','ROLES']
};
function relevant(view,changed){
  if(!changed||!changed.length)return false;
  var keys=VIEW_KEYS[view];if(!keys)return true;
  return changed.some(function(k){return keys.indexOf(k)>=0;});
}
function refreshAfterServer(changed){
  var view=currentView();
  if(!relevant(view,changed))return false;
  if(view==='brands')withPreservedUi(refreshBrands);
  else if(view==='registry')withPreservedUi(refreshRegistry);
  else if(document.querySelector('#main #geoFrame,#main #feasFrame'))return false;
  else withPreservedUi(routeRender);
  return true;
}
window.CASE_LIVE_SYNC={version:VERSION,capture:capture,restore:restore,withPreservedUi:withPreservedUi,entitySaved:entitySaved,refreshAfterServer:refreshAfterServer};
})();

window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['v4451-live-sync']='4.46.4';
