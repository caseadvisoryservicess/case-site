(function(){
  'use strict';

  var UX_VERSION='4.9.3';
  var scheduled=false;
  var lastMainSignature='';

  function byId(id){return document.getElementById(id);}
  function currentView(){try{return (typeof S!=='undefined'&&S&&S.view)||'';}catch(e){return '';}}
  function lang(){try{return (typeof LANG!=='undefined'&&LANG)||'ru';}catch(e){return 'ru';}}
  function txt(ru,uz,en){var l=lang();return l==='uz'?(uz||ru):l==='en'?(en||ru):ru;}
  function cssEsc(v){return String(v||'').replace(/[^a-zA-Z0-9_-]/g,function(ch){return '\\'+ch;});}
  function isInput(el){return !!(el&&/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName||''));}
  function setTopOffset(){
    var top=document.querySelector('.topbar');
    var h=top?Math.ceil(top.getBoundingClientRect().height):55;
    document.documentElement.style.setProperty('--ux-top-offset',(h+8)+'px');
  }
  function activeFilterCount(){
    var n=0;
    document.querySelectorAll('.ux-sticky-controls input,.ux-sticky-controls select').forEach(function(el){
      var v=String(el.value||'').trim();
      if(!v)return;
      if(/^(\u0412\u0441\u0435|All|Barcha|50|100)$/.test(v))return;
      n++;
    });
    return n;
  }
  function addFilterBadge(wrap){
    var old=wrap.querySelector('.ux-filter-count');
    var n=activeFilterCount();
    if(!n){if(old)old.remove();return;}
    if(!old){old=document.createElement('span');old.className='ux-filter-count';var host=wrap.querySelector('.ux-collapse-toggle')||wrap.firstElementChild;host.parentNode.insertBefore(old,host);}
    if(old.textContent!==String(n))old.textContent=String(n);
    old.title=txt('\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b','Faol filtrlar','Active filters');
  }
  function storageKey(key){return 'asaas-ux-collapsed-'+key;}
  function readCollapsed(key){try{return localStorage.getItem(storageKey(key))==='1';}catch(e){return false;}}
  function saveCollapsed(key,on){try{localStorage.setItem(storageKey(key),on?'1':'0');}catch(e){}}
  function updateCollapseButton(wrap,key){
    var btn=wrap.querySelector('.ux-collapse-toggle');
    if(!btn)return;
    var on=wrap.classList.contains('ux-collapsed');
    btn.innerHTML=on?'\u25be '+txt('\u0424\u0438\u043b\u044c\u0442\u0440\u044b','Filtrlar','Filters'):'\u25b4 '+txt('\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c','Yig\'ish','Collapse');
    btn.title=on?txt('\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b','Filtrlarni ochish','Expand filters'):txt('\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b','Qo\'shimcha filtrlarni yig\'ish','Collapse extra filters');
    saveCollapsed(key,on);
    measureControls(wrap);
  }
  function addCollapse(wrap,key,host){
    if(wrap.querySelector('.ux-collapse-toggle'))return;
    var btn=document.createElement('button');
    btn.type='button';
    btn.className='btn ghost sm ux-collapse-toggle';
    btn.addEventListener('click',function(){wrap.classList.toggle('ux-collapsed');updateCollapseButton(wrap,key);});
    (host||wrap).appendChild(btn);
    if(readCollapsed(key))wrap.classList.add('ux-collapsed');
    updateCollapseButton(wrap,key);
  }
  function clearInput(input){
    if(!input)return;
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    try{input.focus({preventScroll:true});}catch(e){input.focus();}
  }
  function addClearButton(input){
    if(!input||input.dataset.uxClear==='1')return;
    input.dataset.uxClear='1';
    var parent=input.parentElement;
    var wrap=document.createElement('div');
    wrap.className='ux-search-field';
    parent.insertBefore(wrap,input);
    wrap.appendChild(input);
    var btn=document.createElement('button');
    btn.type='button';
    btn.className='ux-search-clear';
    btn.setAttribute('aria-label',txt('\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043f\u043e\u0438\u0441\u043a','Qidiruvni tozalash','Clear search'));
    btn.title=txt('\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043f\u043e\u0438\u0441\u043a','Qidiruvni tozalash','Clear search');
    btn.textContent='\u00d7';
    btn.addEventListener('click',function(){clearInput(input);});
    wrap.appendChild(btn);
    function sync(){btn.classList.toggle('show',!!String(input.value||'').length);}
    input.addEventListener('input',sync);
    sync();
  }
  function createWrapper(main,after,className){
    var wrap=document.createElement('div');
    wrap.className='ux-sticky-controls '+className;
    if(after&&after.parentNode)after.parentNode.insertBefore(wrap,after.nextSibling);else main.insertBefore(wrap,main.firstChild);
    return wrap;
  }
  function measureControls(wrap){
    if(!wrap)return;
    requestAnimationFrame(function(){
      var h=Math.ceil(wrap.getBoundingClientRect().height);
      wrap.style.setProperty('--ux-self-height',h+'px');
      document.documentElement.style.setProperty('--ux-controls-height',h+'px');
      var vp=Math.max(280,window.innerHeight-(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ux-top-offset'))||63)-h-30);
      document.documentElement.style.setProperty('--ux-table-max',vp+'px');
    });
  }
  function measureBrandHeader(table){
    if(!table)return;
    requestAnimationFrame(function(){
      var first=table.querySelector('.asaas35-table thead tr:first-child');
      var filters=table.querySelector('.asaas35-table thead tr.filters');
      var h=first?Math.ceil(first.getBoundingClientRect().height):38;
      var fh=filters?Math.ceil(filters.getBoundingClientRect().height):42;
      table.style.setProperty('--ux-brand-head-h',h+'px');
      table.style.setProperty('--ux-brand-thead-h',(h+fh)+'px');
    });
  }
  function enhanceBrands(main){
    var head=main.querySelector(':scope > .asaas35-head');
    if(!head)return;
    var wrap=main.querySelector(':scope > .ux-brand-controls');
    if(!wrap)wrap=createWrapper(main,head,'ux-brand-controls');
    ['.asaas35-toolbar','.asaas35-search','.asaas35-chips'].forEach(function(sel){
      var el=main.querySelector(':scope > '+sel);
      if(el)wrap.appendChild(el);
    });
    var toolbar=wrap.querySelector('.asaas35-toolbar');
    var views=wrap.querySelector('.asaas35-views');
    var actions=toolbar&&toolbar.querySelector(':scope > div:first-child');
    if(actions)actions.classList.add('ux-brand-actions');
    if(views)views.classList.add('ux-brand-views');
    if(toolbar){toolbar.classList.add('ux-primary-row');addCollapse(wrap,'brands',views||toolbar);}

    var compact=wrap.querySelector(':scope > .ux-brand-compact-row');
    if(!compact){
      compact=document.createElement('div');
      compact.className='ux-brand-compact-row ux-secondary-control';
      if(toolbar&&toolbar.nextSibling)wrap.insertBefore(compact,toolbar.nextSibling);else wrap.appendChild(compact);
    }
    var sbox=wrap.querySelector(':scope > .asaas35-search')||wrap.querySelector('.asaas35-search');
    var chips=wrap.querySelector(':scope > .asaas35-chips')||wrap.querySelector('.asaas35-chips');
    var pager=(toolbar&&toolbar.querySelector(':scope > .pager'))||compact.querySelector('.pager');
    if(sbox){sbox.classList.add('ux-brand-search');if(sbox.parentElement!==compact)compact.appendChild(sbox);}
    if(chips){chips.classList.add('ux-brand-chips');if(chips.parentElement!==compact)compact.appendChild(chips);}
    if(pager){pager.classList.add('ux-brand-pager');if(pager.parentElement!==compact)compact.appendChild(pager);}

    var search=wrap.querySelector('#bf_q');
    if(search){search.setAttribute('aria-keyshortcuts','/');search.title=txt('\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u043e\u0438\u0441\u043a. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 /','Tez qidiruv. / tugmasini bosing','Quick search. Press /');addClearButton(search);}
    var fit=wrap.querySelector('#bf_fit');if(fit&&fit.parentElement)fit.parentElement.classList.add('ux-fit-control');
    var table=main.querySelector('.asaas35-table-wrap');
    if(table){
      table.classList.add('ux-table-viewport','ux-brand-table-viewport');
      measureBrandHeader(table);
      if(!table.dataset.uxHeaderObserve&&window.ResizeObserver){
        table.dataset.uxHeaderObserve='1';
        var row=table.querySelector('.asaas35-table thead tr:first-child');
        if(row){var ro=new ResizeObserver(function(){measureBrandHeader(table);});ro.observe(row);table._uxHeaderObserver=ro;}
      }
    }
    addFilterBadge(wrap);
    measureControls(wrap);
  }
  function looksLikeRegistryToolbar(el){
    if(!el||el.nodeType!==1)return false;
    if(el.classList.contains('tabs'))return true;
    if(el.classList.contains('card')&&el.querySelector('input[placeholder*="\u041f\u043e\u0438\u0441\u043a"],input[placeholder*="Search"],input[placeholder*="Qidiruv"]'))return true;
    var style=String(el.getAttribute('style')||'').toLowerCase();
    if(style.indexOf('display:flex')>=0&&el.querySelector('button,select'))return true;
    return false;
  }
  function resetRegistry(){
    try{
      S.regFilter={q:'',status:'\u0412\u0441\u0435',cat:'\u0412\u0441\u0435',block:'\u0412\u0441\u0435',floor:'\u0412\u0441\u0435',country:'\u0412\u0441\u0435',city:'\u0412\u0441\u0435'};
      if(typeof renderRegistry==='function')renderRegistry();else if(typeof go==='function')go('registry');
    }catch(e){}
  }
  function enhanceRegistry(main){
    var sub=main.querySelector(':scope > .sub');
    if(!sub)return;
    var wrap=main.querySelector(':scope > .ux-registry-controls');
    if(!wrap){
      var nodes=[],n=sub.nextElementSibling;
      while(n&&looksLikeRegistryToolbar(n)){var next=n.nextElementSibling;nodes.push(n);n=next;}
      if(!nodes.length)return;
      wrap=createWrapper(main,sub,'ux-registry-controls');
      nodes.forEach(function(x){wrap.appendChild(x);});
    }
    var cards=wrap.querySelectorAll('.card');
    cards.forEach(function(c){c.classList.add('ux-filter-card','ux-secondary-control');});
    var search=wrap.querySelector('input[placeholder*="\u041f\u043e\u0438\u0441\u043a"],input[placeholder*="Search"],input[placeholder*="Qidiruv"]');
    if(search)addClearButton(search);
    if(!wrap.querySelector('.ux-reg-reset')){
      var btn=document.createElement('button');btn.type='button';btn.className='btn ghost sm ux-reg-reset';btn.textContent=txt('\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u0444\u0438\u043b\u044c\u0442\u0440\u044b','Filtrlarni tozalash','Reset filters');btn.onclick=resetRegistry;wrap.appendChild(btn);
    }
    addCollapse(wrap,'registry',wrap);
    var table=main.querySelector(':scope > .card .tbl-scroll');
    if(table)table.classList.add('ux-table-viewport','ux-registry-table-viewport');
    addFilterBadge(wrap);
    measureControls(wrap);
  }
  function enhanceV32(main,view){
    var sub=main.querySelector(':scope > .sub');if(!sub)return;
    var wrap=main.querySelector(':scope > .ux-v32-controls');
    if(!wrap)wrap=createWrapper(main,sub,'ux-v32-controls');
    var top=main.querySelector(':scope > .v32-tools');if(top)wrap.appendChild(top);
    var inner=main.querySelector(':scope > .v32-card > .v32-tools');if(inner){inner.classList.add('ux-secondary-control');wrap.appendChild(inner);}
    if(!wrap.children.length){wrap.remove();return;}
    var q=wrap.querySelector('input[type="text"],input:not([type])');if(q)addClearButton(q);
    addCollapse(wrap,view,wrap);
    main.querySelectorAll('.v32-table').forEach(function(t){wrapTable(t,'ux-v32-table-viewport');});
    addFilterBadge(wrap);measureControls(wrap);
  }
  function enhanceV326(main,view){
    var sub=main.querySelector(':scope > .sub');if(!sub)return;
    var wrap=main.querySelector(':scope > .ux-v326-controls');
    if(!wrap)wrap=createWrapper(main,sub,'ux-v326-controls');
    var tools=main.querySelector(':scope > .v326-tools');if(tools)wrap.appendChild(tools);
    if(!wrap.children.length){wrap.remove();return;}
    main.querySelectorAll('.v326-table').forEach(function(t){wrapTable(t,'ux-v326-table-viewport');});
    measureControls(wrap);
  }
  function enhanceGeneric(main,view){
    var supported={plans:1,docs:1,kpi:1,study:1,rating:1,users:1,bench:1};
    if(!supported[view])return;
    var sub=main.querySelector(':scope > .sub');if(!sub)return;
    var wrap=main.querySelector(':scope > .ux-generic-controls');
    if(!wrap){
      var n=sub.nextElementSibling,nodes=[];
      while(n){
        var next=n.nextElementSibling;
        var style=String(n.getAttribute&&n.getAttribute('style')||'').toLowerCase();
        var ok=n.classList&&n.classList.contains('tabs');
        if(!ok&&style.indexOf('display:flex')>=0&&n.querySelector&&n.querySelector('button,select,input'))ok=true;
        if(!ok)break;
        nodes.push(n);n=next;
      }
      if(!nodes.length)return;
      wrap=createWrapper(main,sub,'ux-generic-controls');nodes.forEach(function(x){wrap.appendChild(x);});
    }
    measureControls(wrap);
  }
  function wrapTable(table,extra){
    if(!table||table.closest('.v32-modal,.v326-modal,.drawer'))return;
    var p=table.parentElement;
    if(p&&p.classList.contains('ux-table-viewport')){if(extra)p.classList.add(extra);return;}
    var rows=table.querySelectorAll('tr').length;
    if(rows<10)return;
    var w=document.createElement('div');w.className='ux-table-viewport '+(extra||'');p.insertBefore(w,table);w.appendChild(table);
  }
  function enhanceLongTables(main,view){
    if(view!=='brands'&&view!=='registry'){
      main.querySelectorAll('.tbl-scroll').forEach(function(sc){if(sc.querySelectorAll('tbody tr').length>=12)sc.classList.add('ux-table-viewport');});
    }
    main.querySelectorAll('.ux-table-viewport').forEach(function(x){x.setAttribute('tabindex','0');x.setAttribute('role','region');x.setAttribute('aria-label',txt('\u0422\u0430\u0431\u043b\u0438\u0446\u0430 \u0441 \u043f\u0440\u043e\u043a\u0440\u0443\u0442\u043a\u043e\u0439','Aylantiriladigan jadval','Scrollable data table'));});
  }
  function updateStuck(){
    var top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ux-top-offset'))||63;
    document.querySelectorAll('.ux-sticky-controls').forEach(function(w){w.classList.toggle('is-stuck',w.getBoundingClientRect().top<=top+1&&window.scrollY>4);});
  }
  function updateVersion(){
    try{}catch(e){}
  }
  function enhance(){
    scheduled=false;
    setTopOffset();
    var main=byId('main');if(!main)return;
    var view=currentView();
    if(view==='brands')enhanceBrands(main);
    else if(view==='registry')enhanceRegistry(main);
    else if(/^v32_/.test(view))enhanceV32(main,view);
    else if(/^v326_/.test(view))enhanceV326(main,view);
    else enhanceGeneric(main,view);
    enhanceLongTables(main,view);
    updateVersion();updateStuck();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance);}
  function keyboard(e){
    if(e.defaultPrevented)return;
    if(e.key==='/'&&!isInput(document.activeElement)){
      var q=document.querySelector('.ux-sticky-controls input[placeholder*="\u041f\u043e\u0438\u0441\u043a"],.ux-sticky-controls input[placeholder*="Search"],.ux-sticky-controls input[placeholder*="Qidiruv"]');
      if(q){e.preventDefault();try{q.focus({preventScroll:true});}catch(_){q.focus();}q.select&&q.select();}
    }
    if(e.key==='Escape'&&document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.ux-search-field'))clearInput(document.activeElement);
  }
  function injectCSS(){
    if(byId('asaas3513-ux-css'))return;
    var s=document.createElement('style');s.id='asaas3513-ux-css';s.textContent='\n'+
    ':root{--ux-top-offset:63px;--ux-controls-height:0px;--ux-table-max:520px}'+
    '.ux-sticky-controls{position:sticky;top:var(--ux-top-offset);z-index:32;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--border);border-radius:16px;box-shadow:0 8px 28px rgba(0,0,0,.09);padding:10px;margin:10px 0 14px;transition:box-shadow .16s ease,border-radius .16s ease,padding .16s ease}'+
    '.ux-sticky-controls.is-stuck{box-shadow:0 12px 34px rgba(0,0,0,.16);border-color:color-mix(in srgb,var(--red) 24%,var(--border));border-radius:0 0 14px 14px}'+
    '.ux-sticky-controls>.asaas35-toolbar,.ux-sticky-controls>.asaas35-search,.ux-sticky-controls>.asaas35-chips,.ux-sticky-controls>.v32-tools,.ux-sticky-controls>.v326-tools,.ux-sticky-controls>.tabs,.ux-sticky-controls>.card{margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;padding:6px!important}'+
    '.ux-brand-controls .asaas35-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px!important}'+
    '.ux-brand-controls .asaas35-toolbar>div:first-child{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'+
    '.ux-brand-controls .asaas35-toolbar .pager{grid-column:1/-1;justify-content:flex-start}'+
    '.ux-brand-controls .asaas35-search{grid-template-columns:minmax(240px,1fr) minmax(180px,240px)!important}'+
    '.ux-brand-controls .asaas35-chips{align-items:center}'+
    '.ux-collapse-toggle{white-space:nowrap;margin-left:6px!important}'+
    '.ux-filter-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:999px;background:var(--red);color:#fff;font-size:10px;font-weight:800;padding:0 6px;margin-left:auto}'+
    '.ux-collapsed .ux-secondary-control{display:none!important}'+
    '.ux-collapsed{padding-top:7px;padding-bottom:7px}'+
    '.ux-search-field{position:relative;min-width:0;flex:1}'+
    '.ux-search-field>input{width:100%!important;padding-right:34px!important}'+
    '.ux-search-clear{display:none;position:absolute;right:7px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:19px;line-height:1;padding:0}'+
    '.ux-search-clear.show{display:block}.ux-search-clear:hover{background:var(--soft);color:var(--red-d)}'+
    '.ux-registry-controls{display:flex;gap:6px;align-items:center;flex-wrap:wrap}'+
    '.ux-registry-controls>.tabs{margin:0!important}'+
    '.ux-registry-controls>.card{flex:1 1 100%}'+
    '.ux-registry-controls>.ux-reg-reset{margin-left:auto}'+
    '.ux-v32-controls,.ux-v326-controls{display:flex;flex-direction:column;gap:4px}'+
    '.ux-v32-controls>.v32-tools,.ux-v326-controls>.v326-tools{width:100%}'+
    '.ux-generic-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}'+
    '.ux-table-viewport{max-height:var(--ux-table-max);overflow:auto!important;overscroll-behavior:contain;scrollbar-gutter:stable;border-radius:10px;position:relative}'+
    '.ux-table-viewport table{margin:0}'+
    '.ux-table-viewport thead th,.ux-table-viewport table>tbody:first-child>tr:first-child>th,.ux-table-viewport table>tr:first-child>th{position:sticky!important;top:0!important;z-index:7;background:var(--panel)!important;box-shadow:0 1px 0 var(--border)}'+
    '.ux-brand-table-viewport .asaas35-table thead tr:first-child th{top:0!important;z-index:9}'+
    '.ux-brand-table-viewport .asaas35-table thead tr.filters th{top:31px!important;z-index:8;background:var(--soft)!important}'+
    '.ux-brand-table-viewport .asaas35-table th:nth-child(1),.ux-brand-table-viewport .asaas35-table td:nth-child(1){position:sticky;left:0;z-index:6;background:var(--panel)!important}'+
    '.ux-brand-table-viewport .asaas35-table th:nth-child(2),.ux-brand-table-viewport .asaas35-table td:nth-child(2){position:sticky;left:32px;z-index:6;background:var(--panel)!important;box-shadow:8px 0 12px -12px rgba(0,0,0,.55)}'+
    '.ux-brand-table-viewport .asaas35-table thead th:nth-child(1),.ux-brand-table-viewport .asaas35-table thead th:nth-child(2){z-index:12!important;background:var(--soft)!important}'+
    '.ux-brand-table-viewport .asaas35-table tbody tr:nth-child(even) td:nth-child(1),.ux-brand-table-viewport .asaas35-table tbody tr:nth-child(even) td:nth-child(2){background:color-mix(in srgb,var(--panel) 97%,var(--ink))!important}'+
    '.ux-table-viewport:focus-visible{outline:2px solid var(--red);outline-offset:2px}'+
    '.ux-sticky-controls .btn,.ux-sticky-controls .thbtn{min-height:34px}'+
    'body.dark .ux-sticky-controls{background:color-mix(in srgb,var(--bg) 86%,transparent)}'+
    'body.dark .ux-brand-table-viewport .asaas35-table th:nth-child(1),body.dark .ux-brand-table-viewport .asaas35-table th:nth-child(2){background:#24221d!important}'+
    'body.dark .ux-brand-table-viewport .asaas35-table td:nth-child(1),body.dark .ux-brand-table-viewport .asaas35-table td:nth-child(2){background:var(--panel)!important}'+
    '@media(max-width:1000px){.ux-sticky-controls{top:var(--ux-top-offset);padding:8px}.ux-brand-controls .asaas35-toolbar{grid-template-columns:1fr}.ux-brand-controls .asaas35-views{grid-column:1}.ux-brand-controls .asaas35-search{grid-template-columns:1fr!important}.ux-table-viewport{max-height:calc(100vh - var(--ux-top-offset) - 150px)}.ux-brand-table-viewport .asaas35-table th:nth-child(2),.ux-brand-table-viewport .asaas35-table td:nth-child(2){position:static;box-shadow:none}.ux-registry-controls{align-items:stretch}.ux-registry-controls>.tabs{width:100%;overflow-x:auto;flex-wrap:nowrap}.ux-registry-controls>.card{width:100%}}'+
    '@media(max-width:620px){.ux-sticky-controls{margin-left:-8px;margin-right:-8px;border-radius:12px}.ux-sticky-controls.is-stuck{border-radius:0 0 12px 12px}.ux-brand-controls .asaas35-toolbar>div:first-child{display:grid;grid-template-columns:1fr 1fr;width:100%}.ux-brand-controls .asaas35-toolbar>div:first-child .btn{width:100%;padding-left:8px;padding-right:8px}.ux-brand-controls .asaas35-views{overflow-x:auto;flex-wrap:nowrap}.ux-collapsed .asaas35-toolbar .pager{display:none!important}.ux-table-viewport{max-height:calc(100vh - var(--ux-top-offset) - 115px)}}'+
    '.ux-brand-controls{padding:8px 10px;margin:6px 0 10px;border-radius:14px}'+
    '.ux-brand-controls>.asaas35-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center;gap:6px!important;padding:0!important}'+
    '.ux-brand-actions{display:flex!important;gap:5px!important;flex-wrap:wrap!important;align-items:center!important;min-width:0}'+
    '.ux-brand-views{display:flex!important;gap:4px!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-end!important}'+
    '.ux-brand-compact-row{display:flex;flex-direction:column;gap:6px;margin-top:6px;min-width:0;width:100%}'+
    '.ux-brand-compact-row>.pager{order:1;display:flex!important;gap:5px!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;padding:0!important;white-space:normal;width:100%}'+
    '.ux-brand-compact-row>.asaas35-search{order:2;display:grid!important;grid-template-columns:minmax(260px,1fr) minmax(150px,240px)!important;gap:6px!important;align-items:center!important;padding:0!important;min-width:0;width:100%}'+
    '.ux-brand-compact-row>.asaas35-chips{order:3;display:flex!important;gap:5px!important;flex-wrap:wrap!important;align-items:center!important;padding:0!important;min-width:0;width:100%;overflow:visible!important}'+
    '.ux-fit-control{display:flex!important;align-items:center!important;gap:5px!important;white-space:nowrap!important;font-size:11px!important;color:var(--muted)}'+
    '.ux-fit-control input{width:72px!important;min-width:72px!important}'+
    '.ux-brand-controls .btn,.ux-brand-controls .thbtn{min-height:32px!important;padding:6px 10px!important;font-size:11.5px!important;border-radius:9px!important;line-height:1.15}'+
    '.ux-brand-controls .asaas35-chip{padding:5px 9px!important;font-size:11px!important;line-height:1.15;white-space:nowrap}'+
    '.ux-brand-controls .asaas35-search input{min-height:32px!important;padding-top:6px!important;padding-bottom:6px!important}'+
    '.ux-brand-controls .pager label{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)}'+
    '.ux-brand-controls .pager select{min-height:30px;padding:3px 6px;border-radius:8px}'+
    '.ux-brand-controls .ux-collapse-toggle{margin-left:2px!important}'+
    '.ux-brand-table-viewport{isolation:isolate;scroll-padding-top:var(--ux-brand-thead-h,82px)}'+
    '.ux-brand-table-viewport .asaas35-table thead tr:first-child th{position:sticky!important;top:0!important;z-index:18!important;background:var(--panel)!important;box-shadow:0 1px 0 var(--border)}'+
    '.ux-brand-table-viewport .asaas35-table thead tr.filters th{position:sticky!important;top:var(--ux-brand-head-h,38px)!important;z-index:17!important;background:var(--soft)!important;box-shadow:0 2px 0 var(--border),0 7px 12px -12px rgba(0,0,0,.8)}'+
    '.ux-brand-table-viewport .asaas35-table thead tr.filters th:nth-child(1),.ux-brand-table-viewport .asaas35-table thead tr.filters th:nth-child(2),.ux-brand-table-viewport .asaas35-table thead tr:first-child th:nth-child(1),.ux-brand-table-viewport .asaas35-table thead tr:first-child th:nth-child(2){z-index:24!important}'+
    '.ux-brand-table-viewport .asaas35-table thead input,.ux-brand-table-viewport .asaas35-table thead select{background:var(--panel)!important}'+
    '@media(max-width:1500px){.ux-brand-compact-row>.asaas35-chips{justify-content:flex-start}}'+
    '@media(max-width:1000px){.ux-brand-controls>.asaas35-toolbar{grid-template-columns:1fr!important}.ux-brand-views{justify-content:flex-start!important;overflow-x:auto}.ux-brand-compact-row>.asaas35-search{grid-template-columns:minmax(0,1fr) minmax(130px,210px)!important}.ux-brand-compact-row>.pager{justify-content:flex-start!important}}'+
    '@media(max-width:620px){.ux-brand-controls{padding:7px}.ux-brand-actions{display:grid!important;grid-template-columns:1fr 1fr}.ux-brand-actions .btn{width:100%}.ux-brand-compact-row>.asaas35-search{grid-template-columns:1fr!important}.ux-fit-control{justify-content:space-between}.ux-brand-compact-row>.pager{overflow-x:visible}.ux-brand-controls .asaas35-chip{padding:5px 8px!important}}'+
    '@media(prefers-reduced-motion:reduce){.ux-sticky-controls{transition:none}}';
    document.head.appendChild(s);
  }
  function install(){
    injectCSS();setTopOffset();
    var main=byId('main');if(main){new MutationObserver(function(mutations){for(var i=0;i<mutations.length;i++){if(mutations[i].target===main){schedule();break;}}}).observe(main,{childList:true});}
    window.addEventListener('resize',function(){setTopOffset();schedule();},{passive:true});
    window.addEventListener('scroll',updateStuck,{passive:true});
    document.addEventListener('keydown',keyboard,true);
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
