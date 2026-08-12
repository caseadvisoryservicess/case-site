/* CASE OS v4.45.0 - unified UX, accessibility and role-safety layer.
   Loaded last so it can stabilize all legacy and modular screens without rewriting business logic. */
(function(){
'use strict';
var VERSION='4.59.0';
var SAFE_EXTERNAL=['dash','work_tasks','work_kanban','brands','v32_investors'];
var SAFE_BRJ=['dash','work_tasks','work_kanban','brands','geoanalytics','market_data','macro_data','data_quality','data_import_export'];
var READ_ONLY_REGISTRY=['AGX','BSH','BRJ'];
var _enhanceQueued=false,_lastMainSig='';

function roleKey(){try{return String((S&&S.role)||'');}catch(e){return '';}}
function userKey(){try{return String((S&&S.user&&(S.user.id||S.user.u||S.user.email))||roleKey()||'guest');}catch(e){return roleKey()||'guest';}}
function escHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function labelForView(v){try{if(typeof CASE_NAV_TITLE==='function'){var x=CASE_NAV_TITLE(v);if(x)return x;}}catch(e){}return String(v||'');}

function applyRoleInvariants(){
  try{
    if(typeof ROLES==='undefined')return;
    if(ROLES.AGX)Object.assign(ROLES.AGX,{leasing:false,finance:false,edit:false,approve:false,plans:false,admin:false,ownOnly:true,external:true,projectScoped:true,brandsOnly:false});
    if(ROLES.BSH)Object.assign(ROLES.BSH,{finance:false,admin:false,plans:true});
    if(ROLES.BRJ)Object.assign(ROLES.BRJ,{finance:false,admin:false,approve:false,plans:false,brandsOnly:true,geoEdit:true});
  }catch(e){}
}
function hardRoleAllowed(v){
  var rk=roleKey();
  if(v==='chat')return true;
  if(rk==='AGX')return SAFE_EXTERNAL.indexOf(v)>=0;
  if(rk==='BRJ')return SAFE_BRJ.indexOf(v)>=0;
  return true;
}
function strictCanOpen(v){
  applyRoleInvariants();
  if(!hardRoleAllowed(v))return false;
  try{if(typeof window.caseWorkspaceCanOpen==='function')return !!window.caseWorkspaceCanOpen(v);}catch(e){}
  return true;
}
window.caseRoleHardAllowed=hardRoleAllowed;
window.caseStrictCanOpen=strictCanOpen;
window.caseCanEditRegistry=function(){try{return !!(R&&R().edit)&&READ_ONLY_REGISTRY.indexOf(roleKey())<0;}catch(e){return false;}};
window.caseCanOwnerReport=function(){var r=roleKey();return ['ASH','ADM','CFO','BA','HO'].indexOf(r)>=0;};

function accessDenied(v){
  try{
    var main=document.getElementById('main');if(!main)return;main.dataset.caseAccessDenied='1';
    var title=labelForView(v)||v;
    main.innerHTML='<div class="ph"><h1>Доступ ограничен</h1></div><div class="card case-access-denied" role="alert"><div class="case-access-icon" aria-hidden="true">!</div><h2>'+escHtml(title)+'</h2><p>Этот раздел не входит в рабочую область вашей роли. Данные раздела не загружены и не показаны.</p><div class="case-access-actions"><button type="button" class="btn" onclick="go(\'dash\')">На рабочий стол</button><button type="button" class="btn ghost" onclick="try{openGuide(\'users\')}catch(e){}">Как получить доступ</button></div></div>';
    try{if(typeof toast==='function')toast('Раздел недоступен для вашей роли.');}catch(e){}
    enhance(main);
  }catch(e){}
}
function installFinalRouteGuard(){
  if(typeof window.go!=='function'||window.go._case4450)return;
  /* Capture the wrapped function in this closure. A shared mutable base causes
     recursion when late legacy modules wrap go() and this guard is re-applied. */
  var baseGo=window.go;
  var guarded=function(v){
    if(!strictCanOpen(v)){accessDenied(v);return false;}
    applyRoleInvariants();
    try{var m=document.getElementById('main');if(m)delete m.dataset.caseAccessDenied;}catch(_){}
    var r=baseGo.apply(this,arguments);
    queueEnhance();
    return r;
  };
  guarded._case4450=true;guarded._caseBase=baseGo;window.go=guarded;
}

function injectCSS(){if(document.getElementById('case4450-css'))return;var s=document.createElement('style');s.id='case4450-css';s.textContent=`
:root{--case-focus:#0b67c2;--case-touch:36px;--case-radius:10px;--case-shadow:0 1px 2px rgba(20,20,20,.05);--case-content-gap:12px}
html{scroll-behavior:auto}body{font-size:13px}button,input,select,textarea{font:inherit}
/* v4.58.0: было завёрнуто в :where() — нулевая специфичность, и любое правило модуля
   с классом (.case49-search input) или id (#geoColMenu input) молча его перебивало,
   поэтому у части полей фокус не был виден. Обычный список селекторов + !important
   на обводке: правило срабатывает только при клавиатурном фокусе и вида не меняет. */
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible,[role="button"]:focus-visible,tr[tabindex]:focus-visible{outline:3px solid color-mix(in srgb,var(--case-focus) 55%,transparent)!important;outline-offset:2px;box-shadow:0 0 0 1px #fff}
:where(button,[role="button"],summary){touch-action:manipulation}
.btn,.thbtn,.langbtn,.tabs button,.geo-tabbar button{min-height:34px}
.card,.kpi,.miniobj,.opbox{box-shadow:var(--case-shadow);border-radius:var(--case-radius)}
.ph{gap:10px;align-items:center}.ph h1{line-height:1.18}.ph>div{margin-left:auto}
.case-access-denied{max-width:680px;margin:32px auto;padding:32px;text-align:center}.case-access-denied h2{margin:8px 0}.case-access-denied p{color:var(--muted);font-size:14px;line-height:1.55}.case-access-icon{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;margin:auto;background:#fff2f2;color:var(--red-d);font-size:24px;font-weight:900;border:1px solid #efbcbc}.case-access-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}
.case-dashboard-mode{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:9px;padding:2px;background:var(--soft)}.case-dashboard-mode button{border:0;background:transparent;border-radius:7px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;color:var(--muted)}.case-dashboard-mode button.on{background:var(--panel);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
#main.case-dash-summary [data-case-secondary="1"]{display:none!important}
/* ======================================================================
   v4.58.0 — единая визуальная система CASE OS.
   До этого каждый модуль приносил свою форму кнопки, свою высоту поля и свою
   трактовку «активного» состояния. На одном экране реестра получалось семнадцать
   управляющих элементов четырёх разных форм и ДВА чёрных «текущих» таба подряд —
   пользователь не мог понять, где он находится. Ниже — не перекраска, а согласование:
   одна высота у всего кликабельного, одна шкала подписей, одно активное состояние
   на уровень навигации. Материал берём из уже существующей палитры CASE
   (оксблад #9E0000 и тёплая бумага), а не вводим новую.
   ====================================================================== */
:root{--case-h:34px;--case-r:9px;--case-gap:8px}

/* --- один рост у всего, на что нажимают: раньше 30/34/36/38 в разных модулях --- */
#main .btn,#main .thbtn,#main .tabs button,#main select,#main input[type="text"],
#main input[type="search"],#main input[type="date"],#main input[type="number"]{min-height:var(--case-h)}
#main .btn.sm,#main .thbtn.sm{min-height:30px}

/* --- два уровня навигации перестают выглядеть одинаково ---
   Первый ряд .tabs — это где я нахожусь (вид: таблица / планировка / канбан).
   Второй ряд, идущий сразу за ним, — это раздел внутри вида. Раньше оба рисовали
   залитую чёрную «таблетку», и на экране было два текущих места одновременно. */
#main .tabs+.tabs{gap:2px;border-bottom:1px solid var(--border);padding-bottom:0;margin-top:-4px}
#main .tabs+.tabs button{background:transparent;border:0;border-radius:0;color:var(--muted);
  padding:7px 12px 8px;box-shadow:inset 0 -2px 0 transparent;font-weight:700}
#main .tabs+.tabs button:hover{color:var(--ink);background:var(--soft)}
#main .tabs+.tabs button.on{background:transparent;color:var(--red-d,#9E0000);
  box-shadow:inset 0 -2px 0 var(--red-d,#9E0000)}

/* --- показатель: подпись тише, число громче, единица не спорит с числом --- */
#main .kpi .lab{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
#main .kpi .val{font-size:26px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;margin-top:2px}
#main .kpi .val small{font-size:12px;font-weight:700;color:var(--muted);margin-left:2px}
#main .kpi .sub2{font-size:10.5px;color:var(--muted);margin-top:3px}
/* «-» вместо числа — это отсутствие данных, а не маленькое значение: не кричим им */
#main .kpi .val:not(:has(small)){color:var(--ink)}

/* --- заголовок карточки: одна ступень, а не пять разных размеров по модулям --- */
#main .card>h3{font-size:13.5px;font-weight:800;letter-spacing:-.005em;margin:0 0 10px}
#main .card>h3 .mut{font-weight:600;color:var(--muted)}

/* --- пустое состояние: приглашение действовать, а не серая строка --- */
#main .mut:only-child{display:block;padding:14px 0;text-align:center;color:var(--muted)}

/* --- плавающие кнопки стоят в одну колонку и не наезжают друг на друга --- */
#toTop,.quizpop-badge,#chatFab{transition:transform .15s}
#toTop:hover,.quizpop-badge:hover,#chatFab:hover{transform:translateY(-2px)}

/* --- строка таблицы, открывающая карточку, показывает это курсором и подсветкой --- */
#main table tbody tr[onclick]{cursor:pointer}
#main table tbody tr[onclick]:hover{background:var(--soft)}
#main table tbody tr[tabindex]:focus-visible{outline:2px solid var(--case-focus);outline-offset:-2px}

/* --- телефон: ряды «заголовок + кнопки» переносятся, а не сжимаются в столбик из двух букв --- */
@media(max-width:620px){
  #main .card>div[style*="display:flex"],#main .ph,#main .tabs{flex-wrap:wrap}
  #main .card>h3{width:100%}
  #main .kpi .val{font-size:22px}
  /* действие шире пальца: на телефоне кнопка в ряд по двое, а не по четверо */
  #main .ph .btn,#main .ph .thbtn{flex:1 1 auto;justify-content:center}
}
.case-ui-readonly{display:inline-flex;align-items:center;gap:5px;border:1px solid #d8c58c;background:#fff9df;color:#6e5714;border-radius:999px;padding:5px 9px;font-size:10.5px;font-weight:800}
.tbl-scroll{overscroll-behavior-y:auto;scrollbar-gutter:stable}.tbl-scroll-top{scrollbar-gutter:stable}.tbl-scroll-top+.tbl-scroll{margin-top:0}
#main table thead th{line-height:1.25}#main table td,#main table th{font-variant-numeric:tabular-nums}
#main .v32-table thead th,#main .v326-table thead th,#main .case49-table thead th{font-size:10.5px!important}
#main .v32-table td,#main .v326-table td,#main .case49-table td{font-size:12px!important}
.case-topbar-tight .brand .tag,.case-topbar-tight .demo,.case-topbar-tight .who .nm{display:none!important}
.case-topbar-tight .gsearch{min-width:170px!important;flex:1 1 220px!important}
@media (min-width:1200px){.topbar{flex-wrap:nowrap!important}.gsearch{order:0!important;min-width:240px!important;width:min(32vw,440px)!important;flex:1 1 320px}.side:hover,.side.open{width:236px}body.nav-pin .side{width:224px}body.nav-pin .main{margin-left:224px;width:calc(100% - 224px)}}
@media (min-width:821px) and (max-width:1199px){.topbar{flex-wrap:nowrap!important;gap:7px;padding:8px 10px}.gsearch{order:0!important;width:auto!important;min-width:150px!important;flex:1 1 220px!important}.brand .tag,.demo,.who .nm{display:none!important}.tb-obj{max-width:145px}.side,.side.open,body.nav-pin .side{width:64px!important;box-shadow:none}.side:hover{width:232px!important;box-shadow:10px 0 28px rgba(20,20,20,.13)!important}.main,body.nav-pin .main{margin-left:64px!important;width:calc(100% - 64px)!important}.side:not(:hover) .case-nav-label,.side:not(:hover) .case-nav-future,.side:not(:hover) .nav-group-btn span:first-child{display:none!important}.side:not(:hover) .nav-group-btn{visibility:hidden!important;height:7px!important;padding:0!important}.side:hover .nav-group-btn{visibility:visible!important;height:auto!important;padding:7px 9px!important}.btn,.langbtn,.who .out,.tb-obj,.burger{min-height:36px!important}}
@media (max-width:820px){:root{--case-touch:44px}.topbar{gap:6px}.gsearch{order:5!important;width:100%!important;min-width:100%!important}.btn,.btn.sm,.thbtn,.langbtn,.tabs button,.geo-tabbar button{min-height:44px!important}/* v4.48.4: у Базы брендов своё правило 32px с большей специфичностью — на телефоне кнопки выходили меньше пальцевой цели; перечисляем эти селекторы явно */.ux-brand-controls .btn,.ux-brand-controls .thbtn{min-height:44px!important}.ph{align-items:flex-start}.ph>div{margin-left:0;width:100%}.ph>div .btn{flex:1}.case-dashboard-mode{width:100%;display:grid;grid-template-columns:1fr 1fr}.case-dashboard-mode button{min-height:44px}.tbl-scroll-top{position:sticky;top:var(--topbar-h,55px);z-index:16;background:var(--panel);padding-top:2px}.card{border-radius:9px}}
@media (max-width:520px){body{font-size:13px}.main{padding:10px 8px 22px}.card{padding:11px!important}.kpis{gap:7px!important}.kpi{padding:10px!important}.kpi .lab{font-size:10.5px!important}.sub{white-space:normal!important;line-height:1.4}.case-access-denied{padding:22px 14px;margin:18px auto}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
`;document.head.appendChild(s);}

/* v4.58.0: 31 контрол подписан одним значком. inferLabel возвращал сам значок, и
   скринридер читал «крестик» вместо «закрыть» — формально имя есть, толку ноль.
   Словарь на одну точку вместо тридцати одной правки по месту. */
var GLYPH_LABEL={'\u00d7':'Закрыть','\u2715':'Закрыть','\u2716':'Закрыть','\u2717':'Закрыть','\u2718':'Закрыть','\u2573':'Закрыть',
  '\u27a4':'Отправить','\u27a1':'Отправить','\u2192':'Далее','\u2190':'Назад','\u2191':'Вверх','\u2193':'Вниз',
  '\u270e':'Изменить','\u270f':'Изменить','+':'Добавить','\uff0b':'Добавить','\u2212':'Убрать','\u2013':'Убрать',
  '\u2699':'Настройки','\u2630':'Меню','\u2605':'В избранное','\u2606':'В избранное','\u21ba':'Сбросить','\u21bb':'Обновить',
  '\u2913':'Выгрузить','\u2912':'Загрузить','\u25a3':'Аналитика','\u25be':'Развернуть','\u25b8':'Развернуть','\u25c2':'Свернуть',
  '\u2691':'Пометить','\u2261':'Меню','\u22ee':'Ещё','\u2026':'Ещё','?':'Справка','\u2753':'Справка','\u2139':'Справка'};
function glyphLabel(t){
  var core=String(t||'').replace(/[\s\ufe0f\u200d]/g,'');
  if(core.length>2)return '';
  for(var i=0;i<core.length;i++){var g=GLYPH_LABEL[core[i]];if(g)return g;}
  return '';
}
function inferLabel(el){
  var x=(el.getAttribute('aria-label')||el.getAttribute('title')||el.getAttribute('placeholder')||'').trim();if(x)return x;
  x=(el.textContent||'').replace(/\s+/g,' ').trim();
  var g=glyphLabel(x);if(g)return g;
  if(x&&x.length<90)return x;
  var n=el.getAttribute('name')||el.id||'';if(n)return n.replace(/[_-]+/g,' ');
  var cell=el.closest&&el.closest('th,td,.field,.control-group');if(cell){var t=(cell.textContent||'').replace(/\s+/g,' ').trim();if(t&&t.length<90)return t;}
  return 'Элемент управления';
}
function enhanceSemantics(root){
  (root.querySelectorAll?root:document).querySelectorAll('button,input,select,textarea,[role="button"],summary').forEach(function(el){
    if(!el.getAttribute('aria-label')&&!((el.textContent||'').trim())&&el.tagName!=='INPUT')el.setAttribute('aria-label',inferLabel(el));
    if((el.tagName==='INPUT'||el.tagName==='SELECT'||el.tagName==='TEXTAREA')&&!el.getAttribute('aria-label')&&!el.closest('label'))el.setAttribute('aria-label',inferLabel(el));
    if(!el.getAttribute('title')&&el.getAttribute('aria-label'))el.setAttribute('title',el.getAttribute('aria-label'));
  });
  (root.querySelectorAll?root:document).querySelectorAll('img:not([alt])').forEach(function(img){img.alt=img.getAttribute('title')||'Изображение';});
  /* v4.58.0: раньше сюда попадали и <tr>/<td> реестра. На сотню строк это давало ~500
     элементов с role="button" и tabindex=0: таблица переставала быть таблицей для
     скринридера, а Tab упирался в сотни фиктивных остановок. Строку оставляем строкой -
     ей нужен только вход с клавиатуры (Enter), ячейки-заглушки не трогаем вовсе. */
  (root.querySelectorAll?root:document).querySelectorAll('[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(summary):not(td):not(th)').forEach(function(el){
    var isRow=el.tagName==='TR';
    if(!isRow&&!el.hasAttribute('role'))el.setAttribute('role','button');
    if(!el.hasAttribute('tabindex'))el.tabIndex=0;
    if(!isRow&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',inferLabel(el));
  });
  (root.querySelectorAll?root:document).querySelectorAll('.tbl-scroll').forEach(function(el){if(!el.hasAttribute('tabindex'))el.tabIndex=0;if(!el.getAttribute('role'))el.setAttribute('role','region');if(!el.getAttribute('aria-label'))el.setAttribute('aria-label','Таблица с горизонтальной прокруткой');});
}
/* v4.58.0: одно правило ' - ' портило две частые записи. Диапазон «5 000–10 000 м²»
   превращался в «5 000 - 10 000 м²» (для диапазона пробелы неверны), а одиночная
   заглушка '—' в пустой ячейке — в ' - ' с лишними пробелами. Теперь три правила по
   порядку: диапазон между цифрами, одиночное тире, всё остальное. */
function dashFix(s){
  var solo=s.match(/^(\s*)[—–](\s*)$/);
  if(solo)return solo[1]+'-'+solo[2];
  return s.replace(/(\d)\s*[—–]\s*(?=\d)/g,'$1-')
          .replace(/(\S)\s*[—–]\s*(?=\S)/g,'$1 - ')
          .replace(/\s*[—–]\s*/g,'-');
}
function shortDashText(root){
  /* Normalize rendered typography only. Stored data, form values, code, formulas and
     source files remain untouched, so this visual requirement cannot corrupt records. */
  var host=root&&root.nodeType?root:document;
  var walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
    var p=n.parentElement;if(!p||p.closest('script,style,textarea,input,code,pre,[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;
    return /[—–]/.test(n.nodeValue||'')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
  }});
  var nodes=[],n;while((n=walker.nextNode()))nodes.push(n);
  nodes.forEach(function(x){x.nodeValue=dashFix(x.nodeValue);});
  (host.querySelectorAll?host:document).querySelectorAll('[title],[aria-label],[placeholder]').forEach(function(el){
    ['title','aria-label','placeholder'].forEach(function(a){var v=el.getAttribute(a);if(v&&/[—–]/.test(v))el.setAttribute(a,dashFix(v));});
  });
}
function markReadonlyRegistry(root){
  if(roleKey()==='BSH'&&S&&S.view==='registry'){
    var ph=root.querySelector&&root.querySelector('.ph');if(ph&&!ph.querySelector('.case-ui-readonly')){var b=document.createElement('span');b.className='case-ui-readonly';b.textContent='Только просмотр';ph.appendChild(b);}
  }
}
function dashboardMode(){
  var main=document.getElementById('main');if(!main||main.dataset.caseAccessDenied==='1'||!S||S.view!=='dash')return;
  var key='case:dashmode:'+userKey(),saved='';try{saved=localStorage.getItem(key)||'';}catch(e){}
  if(!saved)saved=['ASH','ADM','CFO'].indexOf(roleKey())>=0?'summary':'detail';
  main.classList.toggle('case-dash-summary',saved==='summary');
  var ph=main.querySelector('.ph');if(!ph)return;
  var host=ph.querySelector(':scope>div')||ph;
  if(!ph.querySelector('.case-dashboard-mode')){
    var box=document.createElement('span');box.className='case-dashboard-mode';box.setAttribute('role','group');box.setAttribute('aria-label','Режим рабочего стола');
    box.innerHTML='<button type="button" data-mode="summary">Сводка</button><button type="button" data-mode="detail">Подробно</button>';
    box.addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;var m=b.getAttribute('data-mode');try{localStorage.setItem(key,m);}catch(_){}main.classList.toggle('case-dash-summary',m==='summary');box.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-mode')===m);});});
    host.insertBefore(box,host.firstChild);
  }
  ph.querySelectorAll('.case-dashboard-mode button').forEach(function(x){x.classList.toggle('on',x.getAttribute('data-mode')===saved);});
  var secondaryWords=['Средние показатели','Разбивка по блокам','Разбивка по этажам','План / факт','Потери от вакансий','Прогноз аренды','Статусы','Charts','График'];
  main.querySelectorAll('.card').forEach(function(card){var h=card.querySelector('h3');if(!h)return;var txt=(h.textContent||'').trim();if(secondaryWords.some(function(w){return txt.indexOf(w)>=0;}))card.setAttribute('data-case-secondary','1');});
}
function adaptTopbar(){
  var bar=document.querySelector('.topbar');if(!bar)return;bar.classList.remove('case-topbar-tight');requestAnimationFrame(function(){bar.classList.toggle('case-topbar-tight',bar.scrollWidth>bar.clientWidth+4);try{if(typeof syncNavTop==='function')syncNavTop();}catch(e){}});
}
function patchToast(){
  try{
    if(typeof window.toast!=='function'||window.toast._case4450)return;
    var baseToast=window.toast,last=Object.create(null);
    window.toast=function(message){
      var key=String(message==null?'':message).replace(/\s+/g,' ').trim(),now=Date.now();
      if(key&&last[key]&&now-last[key]<8000)return;
      if(key)last[key]=now;
      var r=baseToast.apply(this,arguments);
      requestAnimationFrame(function(){var box=document.getElementById('toastBox');if(!box)return;var kids=Array.from(box.children);if(kids.length>3)kids.slice(0,kids.length-3).forEach(function(x){x.remove();});});
      return r;
    };
    window.toast._case4450=true;
  }catch(e){}
}
function enhance(root){applyRoleInvariants();injectCSS();enhanceSemantics(root||document);shortDashText(root||document);markReadonlyRegistry(document.getElementById('main')||document);dashboardMode();adaptTopbar();}
function queueEnhance(){if(_enhanceQueued)return;_enhanceQueued=true;requestAnimationFrame(function(){_enhanceQueued=false;enhance(document);});}

function installObservers(){
  /* v4.58.0: наблюдали только за #main, а панель карточки (#drawer) объявлена вне его и
     перерисовывается собственным innerHTML - крестики закрытия и кнопки внутри панели
     оставались без клавиатуры до следующей перерисовки основного экрана */
  var drawer=document.getElementById('drawer');
  if(drawer&&window.MutationObserver)new MutationObserver(function(){enhanceSemantics(drawer);shortDashText(drawer);}).observe(drawer,{childList:true,subtree:true});
  var main=document.getElementById('main');if(main&&window.MutationObserver){new MutationObserver(function(){var sig=(S&&S.view||'')+'|'+main.childElementCount+'|'+main.textContent.length;if(sig!==_lastMainSig){_lastMainSig=sig;queueEnhance();}}).observe(main,{childList:true,subtree:true,characterData:false});}
  if(window.ResizeObserver){try{new ResizeObserver(adaptTopbar).observe(document.querySelector('.topbar'));}catch(e){}}else window.addEventListener('resize',adaptTopbar);
  document.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.matches('[role="button"]:not(button):not(a),tr[tabindex][onclick]')){if(e.target.matches('tr')&&(e.target.querySelector(':focus')||e.key===' '))return;e.preventDefault();e.target.click();}});
}
function patchApplyState(){try{if(typeof window.applyState==='function'&&!window.applyState._case4450){var old=window.applyState;window.applyState=function(){var r=old.apply(this,arguments);applyRoleInvariants();return r;};window.applyState._case4450=true;}}catch(e){}}
function boot(){injectCSS();applyRoleInvariants();patchApplyState();patchToast();installFinalRouteGuard();installObservers();enhance(document);window.CASE_UX_VERSION=VERSION;/* Other legacy modules also wrap go() during DOMContentLoaded. Re-apply once after all installers so this guard is the outermost boundary. */setTimeout(function(){installFinalRouteGuard();applyRoleInvariants();},0);setTimeout(function(){installFinalRouteGuard();applyRoleInvariants();},250);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
/* v4.58.0: регистрация версии переехала внутрь замыкания. Снаружи VERSION не виден
   (var не создаёт свойство window), и запись версии падала бы с ReferenceError. */
window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['v4450-ux-system']=VERSION;
window.CASE_UX_VERSION=VERSION;
})();
