/* CASE OS v4.9.3 — Engineering calculators integration (MEP + Lift).
   Рендерит self-contained studio-страницы (mep-studio.html / lift-studio.html) во встроенном
   iframe в #main, по тому же принципу, что и финансовая модель. Доступ — по роли (см.
   v3520-workspaces hardAllowed: leasing/admin, кроме внешних). */
(function(){
  'use strict';
  if(window.ASAAS_ENG_V440) return; window.ASAAS_ENG_V440=true;
  function lang(){try{return typeof LANG==='string'?LANG:'ru';}catch(e){return 'ru';}}
  function tr(ru,uz,en){return lang()==='uz'?uz:(lang()==='en'?en:ru);}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function main(){return document.getElementById('main');}
  function canOpen(v){
    // уважаем матрицу доступа рабочих пространств, если она есть
    try{if(window.WORKSPACES_V3520&&typeof window.WORKSPACES_V3520.canOpen==='function')return window.WORKSPACES_V3520.canOpen(v);}catch(e){}
    try{var r=(typeof R==='function')?R():{};return (!!r.leasing||!!r.admin)&&!r.external;}catch(e){return true;}
  }
  var DEF={
    mep:{title:['MEP-калькулятор нагрузок','MEP kalkulyator','MEP load calculator'],
         desc:['Потребность по электро, охлаждению, отоплению, вентиляции, воде и газу по типам помещений + генерация ТЗ.','Bino turlariga koʻra muhandislik yuklamalari + TZ.','Cooling/power/heating/ventilation/water/gas demand per space type + brief generation.'],
         src:'mep-studio.html'},
    lift:{title:['Калькулятор лифтов','Lift kalkulyatori','Lift traffic calculator'],
         desc:['Провозная способность и интервал группы лифтов (CIBSE up-peak) для разных типов зданий.','Lift guruhi (CIBSE up-peak) — turli bino turlari uchun.','Lift group handling capacity & interval (CIBSE up-peak) for building types.'],
         src:'lift-studio.html'},
  };
  function renderCalc(v){
    var el=main(); if(!el) return; var d=DEF[v]; if(!d) return;
    if(!canOpen(v)){el.innerHTML='<div class="card" style="max-width:720px;margin:36px auto"><h2 style="margin-top:0">'+h(tr(d.title[0],d.title[1],d.title[2]))+'</h2><p style="color:var(--muted)">'+h(tr('Доступ к инженерным калькуляторам — у команды консалтинга/Advisory и лизинга.','Kirish konsalting va ijara jamoasiga.','Access is limited to the consulting/advisory and leasing team.'))+'</p></div>';return;}
    el.innerHTML=''
      +'<section class="eng-v44">'
      +'<div class="eng-v44-head"><div><div class="eng-v44-kicker">CASE OS · '+h(tr('Инженерия','Muhandislik','Engineering'))+'</div>'
      +'<h2>'+h(tr(d.title[0],d.title[1],d.title[2]))+'</h2></div>'
      +'<div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="try{openGuide(\''+v+'\')}catch(e){}">❓ '+h(tr('Инструкция','Yoʻriqnoma','Guide'))+'</button>'
      +'<button class="btn ghost sm" onclick="engV44Full(\''+v+'\')">⛶ '+h(tr('На весь экран','To‘liq ekran','Full screen'))+'</button></div></div>'
      +'<div class="eng-v44-framewrap"><iframe id="engFrame_'+v+'" title="'+h(tr(d.title[0],d.title[1],d.title[2]))+'" src="'+d.src+'?embedded=1&v=4.9.3&lang='+encodeURIComponent(lang())+'" loading="eager"></iframe></div>'
      +'</section>';
  }
  window.engV44Full=function(v){var fr=document.getElementById('engFrame_'+v);if(fr&&fr.requestFullscreen)fr.requestFullscreen().catch(function(){});};
  function css(){
    if(document.getElementById('engV44Css'))return;
    var s=document.createElement('style');s.id='engV44Css';
    s.textContent='.eng-v44{max-width:1180px;margin:0 auto}.eng-v44-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin:6px 0 10px}.eng-v44-kicker{font-size:10px;font-weight:800;color:var(--red-d,#7a0000);text-transform:uppercase;letter-spacing:.05em}.eng-v44-head h2{margin:2px 0}.eng-v44-head p{margin:0;color:var(--muted);font-size:12.5px;max-width:760px}.eng-v44-framewrap{border:1px solid var(--line,#e3e3e3);border-radius:10px;overflow:hidden;background:#fff}.eng-v44-framewrap iframe{width:100%;height:calc(100vh - 190px);min-height:560px;border:0;display:block}';
    document.head.appendChild(s);
  }
  function install(){
    css();
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._eng440){
      window.go=function(v){
        if(v==='mep'||v==='lift'){
          if(!canOpen(v))return oldGo.call(this,'dash');
          try{var prev=S.view;S.view=v;if(prev!==v)S._focus=null;}catch(e){}
          try{document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v===v);});}catch(e){}
          try{var side=document.getElementById('side'),scrim=document.getElementById('scrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('open');}catch(e){}
          renderCalc(v);
          try{if(typeof localize==='function')localize();}catch(e){}
          try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}
          return;
        }
        return oldGo.apply(this,arguments);
      };
      window.go._eng440=true;
    }
  }
  // Устанавливаемся после загрузки основного приложения (go уже определён).
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,0);},{once:true});
  else setTimeout(install,0);
})();
