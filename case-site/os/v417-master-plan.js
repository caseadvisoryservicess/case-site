/* CASE OS v4.33.0 — Мастер-модуль «Планировки и LCR» (#64, ядро аудита).
   Единая точка на уровне проекта: версии ↔ юниты, генерация/обновление LCR с превью и защитой
   коммерческих записей, передача Advisory→Leasing (handover), валидация и история.
   P0-1: каждая версия несёт НЕИЗМЕНЯЕМЫЙ снапшот чертежа (PLAN_CODES + блоки/этажи + SVG-хеши +
   контрольная сумма + автор/дата); генерация LCR читает строго из снапшота выбранной версии,
   а не из глобального PLAN_CODES. Снапшот фиксируется при handover или первой генерации;
   изменившийся чертёж = новая версия, старые снапшоты не переписываются.
   Тяжёлые полноэкранные модули (интерактивный план, реестр помещений, реестр версий) открываются
   по кнопке — они используют ТЕ ЖЕ данные (объект/проект), это не вторая база. */
(function(){
  'use strict';
  if(window.CASE_MASTER_PLAN_417)return;
  window.CASE_MASTER_PLAN_417=true;
  var VIEW='plan_master';
  var TAB='overview'; // overview|versions|blocks|units|validate|lcr|history|handover
  var LCR_VER=''; // P0-1: id версии-источника для валидации/генерации LCR ('' = активная версия проекта)

  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function tr(ru,uz,en){try{return LANG==='uz'?(uz||ru):(LANG==='en'?(en||ru):ru);}catch(e){return ru;}}
  function A(n){try{return typeof fmtA==='function'?fmtA(n):String(Math.round(+n||0));}catch(e){return String(Math.round(+n||0));}}
  function canView(){try{if(typeof window.asaasWorkspaceCanOpen==='function')return !!window.asaasWorkspaceCanOpen(VIEW);}catch(e){}try{return !!(S&&S.user);}catch(e){return false;}}
  function canEdit(){try{var r=R();return !!(r.edit||r.plans||r.admin);}catch(e){return false;}}
  function obj(){try{return (S.obj&&S.obj!=='ALL')?objById(S.obj):null;}catch(e){return null;}}
  function nowISO(){try{return iso(TODAY);}catch(e){return '';}}
  function A_audit(a,d){try{if(typeof audit==='function')audit(a,d||'');}catch(e){}}
  function save(reason){try{persist();}catch(e){}try{if(typeof apiSaveState==='function')apiSaveState();}catch(e){}if(reason&&typeof toast==='function')toast(reason);}

  /* ---- версии проекта (CASE_LAYOUT_VERSIONS) ---- */
  function versionsOf(pid){try{return (Array.isArray(CASE_LAYOUT_VERSIONS)?CASE_LAYOUT_VERSIONS:[]).filter(function(v){return v.projectId===pid&&!v.archived;});}catch(e){return [];}}
  function activeVersion(pid){var vs=versionsOf(pid);return vs.find(function(v){return v.active;})||vs[0]||null;}
  function selectedVersion(pid){var vs=versionsOf(pid);return vs.find(function(v){return v.id===LCR_VER;})||activeVersion(pid);}
  /* ---- P0-1: снапшоты ---- */
  function snapOf(v){return (v&&v.snapshot&&typeof v.snapshot==='object')?v.snapshot:null;}
  function curFp(pid){try{return (typeof planCurrentChecksum==='function')?planCurrentChecksum(pid):'';}catch(e){return '';}}
  function freezeSnapshot(pid,v){ /* фиксирует снапшот ТЕКУЩЕГО чертежа в версию БЕЗ снапшота; существующий снапшот неизменяем */
    if(!v||snapOf(v))return v;
    if(typeof planSnapshotBuild!=='function')return v;
    v.snapshot=planSnapshotBuild(pid);v.snapshotAt=v.snapshot.frozenAt;
    A_audit('Планировки: зафиксирован снапшот версии',((objById(pid)||{}).name||pid)+' · '+(v.version||v.id)+' · #'+v.snapshot.checksum+' · '+v.snapshot.codes+' кодов');
    return v;
  }
  function fmtSnap(v){var sn=snapOf(v);if(!sn)return '';return '#'+String(sn.checksum||'')+' · '+String(sn.codes||0)+' кодов · '+String(sn.frozenAt||'')+(sn.frozenBy?(' · '+sn.frozenBy):'');}
  window.masterSnapshotFreeze=function(pid,vid){
    if(!canEdit()){alert('Недостаточно прав.');return;}
    var v=(CASE_LAYOUT_VERSIONS||[]).find(function(x){return x.id===vid;});if(!v)return;
    if(snapOf(v)){alert('Снапшот уже зафиксирован — версии неизменяемы. Для нового чертежа создайте новую версию.');return;}
    freezeSnapshot(pid,v);save('Снапшот версии зафиксирован');render();
  };
  window.masterVersionFromCurrent=function(pid){
    if(!canEdit()){alert('Недостаточно прав.');return;}
    if(typeof planVersionForCurrent!=='function'){alert('Ядро снапшотов недоступно (обновите страницу).');return;}
    var v=planVersionForCurrent(pid);LCR_VER=v.id;
    save('Версия «'+(v.version||v.id)+'» с зафиксированным чертежом');render();
  };
  /* синтетическая «версия», если реестр версий пуст — чтобы юниты всё равно получили ссылку на источник */
  function ensureVersion(pid){
    var v=activeVersion(pid);
    if(v)return v;
    if(!Array.isArray(window.CASE_LAYOUT_VERSIONS))window.CASE_LAYOUT_VERSIONS=[];
    v={id:'lv_'+pid+'_'+(CASE_LAYOUT_VERSIONS.length+1),projectId:pid,version:'1.0',type:'leasing',status:'working',active:true,source:'Интерактивный план',createdAt:nowISO(),createdBy:(S.user&&S.user.name)||'',handoverStatus:'draft'};
    CASE_LAYOUT_VERSIONS.push(v);
    return v;
  }

  /* ---- коммерческая защита юнита ---- */
  function unitHasCommerce(u){
    try{
      if(!u)return false;
      if(u.offer||( Array.isArray(u.offers)&&u.offers.length))return true;
      if(Array.isArray(u.shortlist)&&u.shortlist.length)return true;
      if(['neg','off','os','cs','cd'].indexOf(u.status)>=0)return true; // переговоры/предложение/подписано/сделка
      var deals=(typeof LEASE_COMMISSION_DEALS!=='undefined'&&Array.isArray(LEASE_COMMISSION_DEALS))?LEASE_COMMISSION_DEALS:[];
      var code=String(u.code||'').trim().toLowerCase();
      if(code&&deals.some(function(d){return String(d.unit||d.unitCode||'').trim().toLowerCase()===code;}))return true;
    }catch(e){}
    return false;
  }
  function commerceLabel(u){
    var t=[];
    if(u.offer||(Array.isArray(u.offers)&&u.offers.length))t.push('КП/оффер');
    if(Array.isArray(u.shortlist)&&u.shortlist.length)t.push('шортлист');
    if(['neg','off','os','cs','cd'].indexOf(u.status)>=0)t.push('статус: '+(typeof stT==='function'?stT(u.status):u.status));
    return t.join(', ')||'связанные данные';
  }

  /* ---- сканирование расхождений план↔LCR (для превью генерации).
     P0-1: если передана версия со снапшотом — источником служит ЕЁ снапшот, а не глобальный PLAN_CODES.
     Без версии (ver==null) — живой чертёж, это используется только для информационных баннеров. ---- */
  function lcrScan(pid,ver){
    var sn=snapOf(ver);
    var src=sn?(sn.planCodes||{}):PLAN_CODES;
    var res={news:[],removed:[],changed:[],plans:0,fromSnapshot:!!sn,checksum:sn?sn.checksum:''};
    try{
      Object.keys(src).forEach(function(k){
        var p=k.split('::');if(p[0]!==pid)return;
        var block='',floor='';if(p.length>=3){block=p[1];floor=p.slice(2).join('::');}else{floor=p.slice(1).join('::');}
        var labels=src[k]||[];if(!labels.length)return;
        res.plans++;
        var d=planDiff(pid,block,floor,labels);
        d.onlyOnPlan.forEach(function(l){res.news.push({code:l.code,area:+l.area||0,block:block,floor:floor});});
        d.onlyInReg.forEach(function(u){res.removed.push({id:u.id,code:u.code,block:block,floor:floor,protected:unitHasCommerce(u),why:commerceLabel(u)});});
        d.areaDiff.forEach(function(a){var u=U.find(function(x){return x.id===a.id;});res.changed.push({id:a.id,code:a.code,plan:a.plan,reg:a.reg,protected:unitHasCommerce(u),why:u?commerceLabel(u):''});});
      });
    }catch(e){}
    return res;
  }

  /* ---- применение генерации LCR (P0-1: строго из снапшота выбранной версии, с защитой) ---- */
  window.masterLcrApply=function(pid,opts){
    if(!canEdit()){alert('Недостаточно прав.');return;}
    opts=opts||{};
    var ver=opts.versionId?(CASE_LAYOUT_VERSIONS||[]).find(function(x){return x.id===opts.versionId;}):selectedVersion(pid);
    if(!ver)ver=ensureVersion(pid);
    /* версия без снапшота (legacy или свежесозданная рабочая) — фиксируем текущий чертёж КАК её снапшот;
       дальше генерация и повторные генерации из этой версии читают только его */
    if(!snapOf(ver))freezeSnapshot(pid,ver);
    var sn=snapOf(ver);
    if(!sn||!sn.plans){alert('У версии нет данных чертежа (снапшот пуст). Загрузите планировку и создайте версию заново.');return;}
    var scan=lcrScan(pid,ver);
    var created=0,updated=0,orphaned=0,skipped=0;
    // 1) новые юниты
    if(opts.createNew!==false){
      scan.news.forEach(function(n){
        try{
          var nu=unit(pid,n.code,n.floor||'1 этаж',+n.area||0,0,'','',0,0,0,'vac','',[],[],'');
          if(n.block)nu.block=n.block;
          nu.total=Math.round((nu.area||0)*(nu.rate||0));
          nu.layoutVersionId=ver.id;nu.snapshotChecksum=sn.checksum;nu.sourceRoomCode=n.code;nu.sourceArea=+n.area||0;nu.genStatus='generated';nu.genAt=nowISO();nu.manualAfterGen=false;
          nu.hist.push([nowISO(),'Создано генерацией LCR из версии '+(ver.version||ver.id)+' (снапшот #'+sn.checksum+') ('+((S.user&&S.user.name)||'')+')']);
          U.push(nu);created++;
        }catch(e){}
      });
    }
    // 2) изменённые площади (защищённые — только с явным разрешением)
    if(opts.updateAreas!==false){
      scan.changed.forEach(function(c){
        var u=U.find(function(x){return x.id===c.id;});if(!u)return;
        if(c.protected&&!opts.overrideProtected){skipped++;return;}
        u.area=+c.plan||u.area;u.total=Math.round((u.area||0)*(u.rate||0));
        u.layoutVersionId=ver.id;u.snapshotChecksum=sn.checksum;u.sourceArea=+c.plan||0;u.genStatus=u.genStatus||'generated';
        u.hist.push([nowISO(),'Площадь обновлена генерацией LCR: '+A(c.reg)+' → '+A(c.plan)+' (версия '+(ver.version||ver.id)+' #'+sn.checksum+') ('+((S.user&&S.user.name)||'')+')']);
        updated++;
      });
    }
    // 3) отсутствующие на плане (removed) — НЕ удаляем; помечаем на ревью (защищённые не трогаем вообще)
    if(opts.flagOrphans!==false){
      scan.removed.forEach(function(rmv){
        var u=U.find(function(x){return x.id===rmv.id;});if(!u)return;
        if(rmv.protected){return;} // защищено — оставляем как есть, только в отчёте
        u.genOrphan=true;u.genOrphanAt=nowISO();orphaned++;
      });
    }
    ver.lcrGenAt=nowISO();ver.lcrGenBy=(S.user&&S.user.name)||'';ver.lcrGenStatus='generated';
    A_audit('LCR: генерация/обновление',(objById(pid)||{}).name+' · версия '+(ver.version||ver.id)+' · снапшот #'+sn.checksum+' · создано '+created+', обновлено '+updated+', на ревью '+orphaned+', пропущено защищённых '+skipped);
    save('LCR обновлён из версии '+(ver.version||ver.id)+': +'+created+' / изм. '+updated+(skipped?' / защищено '+skipped:''));
    TAB='units';render();
  };

  /* ---- handover Advisory → Leasing ---- */
  window.masterHandoverMark=function(pid,vid){
    if(!canEdit()){alert('Недостаточно прав.');return;}
    var v=(CASE_LAYOUT_VERSIONS||[]).find(function(x){return x.id===vid;})||ensureVersion(pid);
    freezeSnapshot(pid,v); /* P0-1: Advisory передаёт зафиксированный чертёж, а не «то, что будет на плане потом» */
    v.handoverStatus='ready_for_leasing';v.handoverMarkedAt=nowISO();v.handoverMarkedBy=(S.user&&S.user.name)||'';
    A_audit('Планировки: версия готова для аренды',(objById(pid)||{}).name+' · '+(v.version||v.id));
    save('Версия помечена «Готова для аренды»');render();
  };
  window.masterHandoverAccept=function(pid,vid){
    var r=R();if(!(r.leasing||r.admin)){alert('Принять может отдел аренды или админ.');return;}
    var v=(CASE_LAYOUT_VERSIONS||[]).find(function(x){return x.id===vid;});if(!v)return;
    v.handoverStatus='accepted';v.handoverAcceptedAt=nowISO();v.handoverAcceptedBy=(S.user&&S.user.name)||'';v.active=true;
    (CASE_LAYOUT_VERSIONS||[]).forEach(function(x){if(x.projectId===pid&&x.id!==v.id)x.active=false;});
    A_audit('Планировки: версия принята арендой',(objById(pid)||{}).name+' · '+(v.version||v.id));
    save('Версия принята — можно генерировать LCR');TAB='lcr';render();
  };

  /* ================= РЕНДЕР ================= */
  window.masterTab=function(t){TAB=t;render();};

  function tabbar(){
    var tabs=[['overview','Обзор'],['versions','Версии'],['blocks','Блоки/этажи'],['units','Юниты'],['validate','Валидация'],['lcr','Генерация LCR'],['handover','Handover'],['history','История']];
    return '<div class="geo-tabbar" style="flex-wrap:wrap">'+tabs.map(function(t){return '<button type="button" class="'+(TAB===t[0]?'on':'')+'" onclick="masterTab(\''+t[0]+'\')">'+h(tr(t[1],t[1],t[1]))+'</button>';}).join('')+'</div>';
  }

  function card(html){return '<div class="card" style="margin-bottom:12px">'+html+'</div>';}
  function link(view,label){return '<button class="btn ghost sm" onclick="go(\''+view+'\')">'+h(label)+' →</button>';}

  function renderOverview(pid){
    var o=objById(pid)||{},vs=versionsOf(pid),av=activeVersion(pid),scan=lcrScan(pid);
    var units=unitsOf(pid),blocks=(typeof blocksOf==='function'?blocksOf(pid):[]);
    var floors=0;try{blocks.forEach(function(b){floors+=floorsOf(pid,b).length;});if(!blocks.length)floors=floorsOf(pid,'').length;}catch(e){}
    var mismatch=scan.news.length+scan.removed.length+scan.changed.length;
    var kpis=[['Версий',vs.length],['Активная',av?(h(av.version||av.id)+(snapOf(av)?' 🔒':'')):'—'],['Блоков',blocks.length||'—'],['Юнитов',units.length],['Расхождений с планом',mismatch]];
    return card('<h3 style="margin:0 0 6px">'+h(o.name||pid)+' — Планировки</h3><p style="font-size:12.5px;color:var(--muted);margin:0 0 10px">Рабочий план отдела аренды: интерактивный план → блоки/этажи → юниты → валидация → генерация LCR. Оригинальная планировка (из Advisory или загруженная в аренду) доступна отдельной кнопкой и не перезаписывается.</p><div style="display:flex;gap:14px;flex-wrap:wrap">'+kpis.map(function(k){return '<div style="min-width:110px"><div style="font-size:22px;font-weight:700">'+h(k[1])+'</div><div style="font-size:11px;color:var(--muted)">'+h(k[0])+'</div></div>';}).join('')+'</div>')
      +card('<b>Быстрые действия</b><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+link('plans','Рабочий интерактивный план')+'<button class="btn ghost sm" onclick="case49OpenOriginal()">Оригинальная планировка</button>'+link('registry','Реестр помещений (LCR)')+link('leasing_layouts','Реестр версий (файлы)')+'<button class="btn sm" onclick="masterTab(\'lcr\')">Генерация LCR</button></div>')
      +(mismatch?('<div class="banner warn" style="margin:0">⚠ План и реестр расходятся: <b>'+scan.news.length+'</b> новых · <b>'+scan.removed.length+'</b> нет на плане · <b>'+scan.changed.length+'</b> с др. площадью. <button class="btn ghost sm" onclick="masterTab(\'lcr\')">Открыть генерацию</button></div>'):'<div class="banner ok" style="margin:0;background:#eef8f0;color:#256433;border-color:#b8d8bf">✓ План и реестр согласованы</div>');
  }

  function renderVersions(pid){
    var vs=versionsOf(pid),fp=curFp(pid);
    var rows=vs.map(function(v){
      var hs=v.handoverStatus||'draft';
      var hlbl=hs==='accepted'?'✓ Принята арендой':hs==='ready_for_leasing'?'→ Готова для аренды':'черновик';
      var sn=snapOf(v);
      var scell=sn?('<span title="Снапшот неизменяем: чертёж, коды и структура зафиксированы">🔒 '+h(fmtSnap(v))+(fp&&sn.checksum===fp?' <span class="pill">= текущий чертёж</span>':'')+'</span>')
        :('<span style="color:var(--muted)">не зафиксирован</span>'+(canEdit()?' <button class="btn ghost sm" onclick="masterSnapshotFreeze(\''+pid+'\',\''+v.id+'\')" title="Заморозить текущий чертёж (PLAN_CODES, блоки/этажи, SVG) как неизменяемый снапшот этой версии">📸 Зафиксировать</button>':''));
      return '<tr><td><b>'+h(v.version||v.id)+'</b>'+(v.active?' <span class="pill">активная</span>':'')+'</td><td>'+h(v.type||'')+'</td><td>'+h(v.source||v.createdBy||'')+'</td><td>'+scell+'</td><td>'+h(hlbl)+'</td><td>'+(canEdit()&&hs==='draft'?'<button class="btn ghost sm" onclick="masterHandoverMark(\''+pid+'\',\''+v.id+'\')">Готово для аренды</button>':'')+(hs==='ready_for_leasing'?'<button class="btn sm" onclick="masterHandoverAccept(\''+pid+'\',\''+v.id+'\')">Принять</button>':'')+'</td></tr>';
    }).join('');
    var newBtn=canEdit()?'<button class="btn ghost sm" onclick="masterVersionFromCurrent(\''+pid+'\')" title="Создать версию с зафиксированным снапшотом текущего чертежа (или переключиться на уже существующую с тем же чертежом)">＋ Версия из текущего чертежа</button>':'';
    return card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap"><b>Версии планировок проекта</b><span style="display:flex;gap:6px">'+newBtn+link('leasing_layouts','Полный реестр версий / загрузка файла')+'</span></div>'+(vs.length?('<div class="tbl-scroll"><table><thead><tr><th>Версия</th><th>Тип</th><th>Источник</th><th>Снапшот чертежа</th><th>Передача</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'):'<p style="color:var(--muted);font-size:12.5px">Версий пока нет. Загрузите первую в реестре версий, либо генерация LCR создаст рабочую версию с зафиксированным чертежом автоматически.</p>')+'<p style="font-size:11.5px;color:var(--muted);margin-top:8px">🔒 Снапшот — неизменяемая копия чертежа (коды+площади, блоки/этажи, SVG, контрольная сумма, автор/дата). Генерация LCR всегда идёт из снапшота выбранной версии; новый чертёж = новая версия.</p>');
  }

  function renderBlocks(pid){
    var blocks=(typeof blocksOf==='function'?blocksOf(pid):[]);
    var body=blocks.length?blocks.map(function(b){var fs=floorsOf(pid,b);return '<div style="margin-bottom:6px"><b>Блок '+h(b)+'</b>: '+fs.map(h).join(' · ')+'</div>';}).join(''):(function(){var fs=floorsOf(pid,'');return '<div>Без блоков · этажи: '+fs.map(h).join(' · ')+'</div>';})();
    return card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Блоки и этажи</b>'+link('plans','Управление блоками/этажами (в плане)')+'</div>'+body+'<p style="font-size:11.5px;color:var(--muted);margin-top:8px">Блоки/этажи — постоянные записи (persist). Добавление/переименование/удаление — во вкладке «Планировки» (кнопки «+ блок / ＋ этаж / ✎ / 🗑»).</p>');
  }

  function renderUnits(pid){
    var units=unitsOf(pid);
    var cols=[
      {k:'code',label:'Код',get:function(u){return u.code;},sortable:true,filter:'text'},
      {k:'block',label:'Блок',get:function(u){return (typeof unitBlock==='function'?unitBlock(u):u.block)||'';},sortable:true,filter:'select'},
      {k:'floor',label:'Этаж',get:function(u){return (typeof floorLabel==='function'?floorLabel(u.floor):u.floor)||'';},sortable:true,filter:'select'},
      {k:'area',label:'м²',get:function(u){return +u.area||0;},num:true,sortable:true,render:function(u){return A(u.area);}},
      {k:'ver',label:'Версия',get:function(u){return u.layoutVersionId||'—';},sortable:true,filter:'select',render:function(u){if(!u.layoutVersionId)return '—';var v=(Array.isArray(CASE_LAYOUT_VERSIONS)?CASE_LAYOUT_VERSIONS:[]).find(function(x){return x.id===u.layoutVersionId;});return h(v?(v.version||v.id):u.layoutVersionId)+(u.snapshotChecksum?' <span style="color:var(--muted);font-size:10.5px">#'+h(u.snapshotChecksum)+'</span>':'');}},
      {k:'gen',label:'Источник',get:function(u){return u.genOrphan?'нет на плане':(u.genStatus==='generated'?'из плана':'вручную');},sortable:true,filter:'select',render:function(u){return u.genOrphan?'<span class="pill" style="background:#fdecea;color:#a30000">нет на плане</span>':(u.genStatus==='generated'?'<span class="pill">из плана</span>':'вручную');}}
    ];
    var tbl=(typeof buildTable==='function')?buildTable('master_units',cols,units,{rowClick:function(u){return "openUnit('"+u.id+"')";}}):'';
    return card('<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Юниты проекта ('+units.length+')</b>'+link('registry','Полный реестр (LCR) с правкой')+'</div>'+tbl+'<p style="font-size:11.5px;color:var(--muted);margin-top:8px">Столбец «Версия» — из какой версии планировки создан/обновлён юнит (трассируемость).</p>');
  }

  function renderValidate(pid){
    var ver=selectedVersion(pid);
    var scan=lcrScan(pid,snapOf(ver)?ver:null);
    if(!scan.plans)return card('<b>Валидация</b><p style="color:var(--muted);font-size:12.5px">Для проекта нет распознанных чертежей. Загрузите SVG во вкладке «Планировки» — коды и площади распознаются автоматически.</p>');
    var src=scan.fromSnapshot?('<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Источник: снапшот версии <b>'+h(ver.version||ver.id)+'</b> #'+h(scan.checksum)+'</div>'):'<div style="font-size:12px;color:var(--muted);margin-bottom:6px">Источник: текущий чертёж (версия без снапшота — зафиксируется при генерации)</div>';
    function tbl(title,arr,cols){if(!arr.length)return '<div style="margin-bottom:8px;color:#256433">✓ '+title+': нет</div>';return '<div style="margin-bottom:10px"><b>'+title+' ('+arr.length+')</b><div class="tbl-scroll"><table><thead><tr>'+cols.map(function(c){return '<th>'+h(c[0])+'</th>';}).join('')+'</tr></thead><tbody>'+arr.map(function(x){return '<tr>'+cols.map(function(c){return '<td>'+h(c[1](x))+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>';}
    return card('<b>Валидация: план ↔ реестр</b>'+src+'<div style="margin-top:8px">'
      +tbl('Новые на плане (нет в реестре)',scan.news,[['Код',function(x){return x.code;}],['Блок',function(x){return x.block;}],['Этаж',function(x){return x.floor;}],['Площадь',function(x){return A(x.area);}]])
      +tbl('В реестре, но нет на плане',scan.removed,[['Код',function(x){return x.code;}],['Блок',function(x){return x.block;}],['Этаж',function(x){return x.floor;}],['Защита',function(x){return x.protected?('🔒 '+x.why):'—';}]])
      +tbl('Расходится площадь',scan.changed,[['Код',function(x){return x.code;}],['План',function(x){return A(x.plan);}],['Реестр',function(x){return A(x.reg);}],['Защита',function(x){return x.protected?('🔒 '+x.why):'—';}]])
      +'</div><button class="btn" onclick="masterTab(\'lcr\')">Перейти к генерации LCR</button>');
  }

  window.masterLcrSelectVer=function(vid){LCR_VER=vid||'';render();};
  function renderLcr(pid){
    var vs=versionsOf(pid),ver=selectedVersion(pid),sn=snapOf(ver),fp=curFp(pid);
    var scan=lcrScan(pid,sn?ver:null); /* превью: снапшот выбранной версии; без снапшота — текущий чертёж (зафиксируется при применении) */
    var prot=scan.removed.filter(function(x){return x.protected;}).length+scan.changed.filter(function(x){return x.protected;}).length;
    if(!scan.plans)return card('<b>Генерация LCR</b><p style="color:var(--muted);font-size:12.5px">'+(sn?'Снапшот выбранной версии пуст (в нём нет распознанных чертежей). Выберите другую версию или создайте новую из текущего чертежа.':'Нет распознанных чертежей для проекта. Сначала загрузите планировки (SVG) во вкладке «Планировки».')+'</p>');
    var head='<b>Генерация / обновление LCR</b><p style="font-size:12.5px;color:var(--muted);margin:6px 0">Предпросмотр изменений перед применением. LCR генерируется <b>строго из зафиксированного снапшота</b> версии-источника. Юниты со связанными коммерческими данными (КП, сделки, шортлист) <b>защищены</b> — их площадь не меняется, из реестра они не убираются.</p>';
    var opts=vs.map(function(v){var s=snapOf(v);return '<option value="'+h(v.id)+'"'+(ver&&v.id===ver.id?' selected':'')+'>'+h(v.version||v.id)+(v.active?' · активная':'')+(s?(' · 🔒 #'+s.checksum):' · без снапшота')+'</option>';}).join('');
    var target='<div style="font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="color:var(--muted)">Версия-источник:</span>'
      +(vs.length?('<select onchange="masterLcrSelectVer(this.value)" style="font-family:inherit;font-size:12.5px;padding:4px 8px;border:1px solid var(--border);border-radius:7px">'+opts+'</select>'):'<b>будет создана рабочая версия с зафиксированным чертежом</b>')
      +(sn?('<span style="color:var(--muted)">снапшот: '+h(fmtSnap(ver))+'</span>'):(ver?'<span class="pill" title="Снапшот текущего чертежа будет зафиксирован в эту версию при применении">снапшот зафиксируется при генерации</span>':''))
      +(ver&&ver.handoverStatus&&ver.handoverStatus!=='accepted'&&ver.handoverStatus!=='draft'?'<span style="color:var(--muted)">· передача: '+h(ver.handoverStatus)+'</span>':'')+'</div>';
    var drift=(sn&&fp&&sn.checksum!==fp)?('<div class="banner warn" style="margin:0 0 8px">⚠ Текущий чертёж во вкладке «Планировки» <b>отличается</b> от снапшота выбранной версии (#'+h(sn.checksum)+' ≠ #'+h(fp)+'). Генерация пойдёт строго по снапшоту. Чтобы применить новый чертёж — создайте новую версию.'+(canEdit()?' <button class="btn ghost sm" onclick="masterVersionFromCurrent(\''+pid+'\')">＋ Версия из текущего чертежа</button>':'')+'</div>'):'';
    var summary='<div style="display:flex;gap:14px;flex-wrap:wrap;margin:8px 0">'
      +'<div><div style="font-size:22px;font-weight:700;color:#256433">+'+scan.news.length+'</div><div style="font-size:11px;color:var(--muted)">создать</div></div>'
      +'<div><div style="font-size:22px;font-weight:700;color:#9a6b00">'+scan.changed.length+'</div><div style="font-size:11px;color:var(--muted)">изменить площадь</div></div>'
      +'<div><div style="font-size:22px;font-weight:700;color:#a30000">'+scan.removed.length+'</div><div style="font-size:11px;color:var(--muted)">нет на плане</div></div>'
      +'<div><div style="font-size:22px;font-weight:700">🔒 '+prot+'</div><div style="font-size:11px;color:var(--muted)">защищено</div></div>'
      +'</div>';
    var actions=canEdit()?('<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><label style="font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" id="lcrOverride"> менять и защищённые площади</label><button class="btn" onclick="masterLcrApply(\''+pid+'\',{versionId:'+(ver?('\''+ver.id+'\''):'null')+',overrideProtected:document.getElementById(\'lcrOverride\').checked})">Применить генерацию LCR</button><button class="btn ghost" onclick="masterTab(\'validate\')">Сначала посмотреть детали</button></div>'):'<p style="color:var(--muted);font-size:12px">Только просмотр (нет прав на правку).</p>';
    return card(head+target+drift+summary+actions);
  }

  function renderHistory(pid){
    var vs=(Array.isArray(CASE_LAYOUT_VERSIONS)?CASE_LAYOUT_VERSIONS:[]).filter(function(v){return v.projectId===pid;});
    var rows=[];
    vs.forEach(function(v){
      if(v.createdAt)rows.push([v.createdAt,'Версия '+(v.version||v.id)+' создана',v.createdBy||'']);
      if(v.snapshotAt)rows.push([v.snapshotAt,'Снапшот версии '+(v.version||v.id)+' зафиксирован #'+((v.snapshot&&v.snapshot.checksum)||''),(v.snapshot&&v.snapshot.frozenBy)||'']);
      if(v.handoverMarkedAt)rows.push([v.handoverMarkedAt,'Версия '+(v.version||v.id)+' → готова для аренды',v.handoverMarkedBy||'']);
      if(v.handoverAcceptedAt)rows.push([v.handoverAcceptedAt,'Версия '+(v.version||v.id)+' принята арендой',v.handoverAcceptedBy||'']);
      if(v.lcrGenAt)rows.push([v.lcrGenAt,'LCR сгенерирован из версии '+(v.version||v.id),v.lcrGenBy||'']);
    });
    rows.sort(function(a,b){return String(b[0]).localeCompare(String(a[0]));});
    return card('<b>История версий и передачи</b>'+(rows.length?('<div class="tbl-scroll"><table><thead><tr><th>Дата</th><th>Событие</th><th>Кто</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+h(r[0])+'</td><td>'+h(r[1])+'</td><td>'+h(r[2])+'</td></tr>';}).join('')+'</tbody></table></div>'):'<p style="color:var(--muted);font-size:12.5px">Событий пока нет.</p>'));
  }

  function renderHandover(pid){
    var vs=versionsOf(pid);
    var ready=vs.filter(function(v){return v.handoverStatus==='ready_for_leasing';});
    var accepted=vs.filter(function(v){return v.handoverStatus==='accepted';});
    var steps='<ol style="font-size:12.5px;color:var(--muted);line-height:1.7;margin:6px 0 10px 18px"><li>Advisory готовит версию и жмёт «Готово для аренды».</li><li>Отдел аренды принимает версию.</li><li>Система показывает превью генерации LCR.</li><li>Аренда подтверждает — LCR создаётся/обновляется, юниты привязываются к версии.</li></ol>';
    var list=vs.map(function(v){var hs=v.handoverStatus||'draft';return '<tr><td><b>'+h(v.version||v.id)+'</b></td><td>'+h(hs==='accepted'?'принята':hs==='ready_for_leasing'?'готова для аренды':'черновик')+'</td><td>'+(canEdit()&&hs==='draft'?'<button class="btn ghost sm" onclick="masterHandoverMark(\''+pid+'\',\''+v.id+'\')">Готово для аренды</button>':'')+((hs==='ready_for_leasing')?'<button class="btn sm" onclick="masterHandoverAccept(\''+pid+'\',\''+v.id+'\')">Принять (аренда)</button>':'')+((hs==='accepted')?'<button class="btn ghost sm" onclick="masterTab(\'lcr\')">Генерация LCR →</button>':'')+'</td></tr>';}).join('');
    return card('<b>Передача Advisory → Leasing</b>'+steps+(vs.length?('<div class="tbl-scroll"><table><thead><tr><th>Версия</th><th>Статус</th><th></th></tr></thead><tbody>'+list+'</tbody></table></div>'):'<p style="color:var(--muted);font-size:12.5px">Версий пока нет — создайте в реестре версий или сгенерируйте LCR (создастся рабочая версия).</p>'));
  }

  function render(){
    var main=document.getElementById('main');if(!main)return;
    main.classList.remove('geo-workspace');
    var pid=S.obj;
    if(!pid||pid==='ALL'){main.innerHTML='<div class="ph"><h1>Планировки и LCR</h1></div>'+card('Выберите конкретный проект в шапке.');return;}
    var body;
    switch(TAB){
      case 'versions':body=renderVersions(pid);break;
      case 'blocks':body=renderBlocks(pid);break;
      case 'units':body=renderUnits(pid);break;
      case 'validate':body=renderValidate(pid);break;
      case 'lcr':body=renderLcr(pid);break;
      case 'history':body=renderHistory(pid);break;
      case 'handover':body=renderHandover(pid);break;
      default:body=renderOverview(pid);
    }
    var lcrTabs='';try{if(typeof regPlanTabs==='function')lcrTabs=regPlanTabs('master');}catch(e){}
    main.innerHTML='<div class="ph"><h1>Планировки и LCR</h1></div>'+lcrTabs+tabbar()+body;
    try{if(typeof localize==='function')localize();}catch(e){}
  }
  window.renderPlanMaster=render;

  function install(){
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._master417){
      window.go=function(v){
        if(v===VIEW){
          if(!canView()){try{return oldGo.call(this,(typeof window.asaasWorkspaceFirst==='function')?window.asaasWorkspaceFirst():'dash');}catch(e){return;}}
          try{S.view=VIEW;}catch(e){}
          try{document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v===VIEW);});}catch(e){}
          try{if(typeof window.caseNavClose==='function')window.caseNavClose();}catch(e){}
          var side=document.getElementById('side'),scrim=document.getElementById('scrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('open');
          render();try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}return;
        }
        return oldGo.apply(this,arguments);
      };
      window.go._master417=true;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
