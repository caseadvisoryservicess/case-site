/* CASE OS v4.77.0: публичная оферта, личный кабинет, обратная связь.
 *
 * Решение владельца: нужен публичный документ об условиях (данные ориентировочные и без
 * юридической силы, только как рекомендация, правила пользования, запрет распространения),
 * который принимают при регистрации галочкой и могут открыть внутри системы; у каждого
 * пользователя свой кабинет с настройками, доступом и данными; пользователи пишут нам через
 * бот и из платформы с предложениями и проблемами.
 *
 * Здесь: окно согласия для тех, кто ещё не принял текущую версию оферты (сервер помнит версию
 * и время), пункты «Личный кабинет», «Обратная связь», «Оферта» в меню профиля, экран кабинета
 * (профиль, пароль, доступ, оферта, обращения, последние входы), форма обращения, карточка
 * «Обращения» для администратора на странице «Доступ» и счётчик новых в меню.
 * Сервер: api/auth.php (accept_offer, update_profile, change_password, my_log), api/feedback.php.
 */
(function(){
  'use strict';
  if(window.CASE_CABINET_4770)return;
  window.CASE_CABINET_4770=true;
  var VERSION='4.78.0', OFFER_URL='offer.html';
  var KINDS={idea:'Предложение',problem:'Проблема',question:'Вопрос'}, STATUSES={new:'новое',seen:'просмотрено',done:'решено'};
  var PROFILES={'':'по типу доступа',office:'Ищу офис',developer:'Девелопер',asset:'Управляющая компания',consulting:'Консалтинг',leasing:'Лизинг и продажи',full:'Все панели'};
  function $(id){return document.getElementById(id);}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function user(){try{return (typeof S!=='undefined'&&S&&S.user)||null;}catch(e){return null;}}
  function isAdmin(){try{return !!(typeof R==='function'&&R().admin);}catch(e){return false;}}
  function caps(){var u=user();return (u&&u.caps)||window.CASE_USER_CAPS||{};}
  function fmtDate(d){if(!d)return '';var s=String(d);var m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'.'+m[2]+'.'+m[1]+s.slice(10,16):s;}
  function offerVersion(){return String(caps().offer_version||window.CASE_OFFER_VERSION||'1.0');}
  function toastMsg(m){try{if(typeof toast==='function'){toast(m);return;}}catch(e){}alert(m);}

  /* ── окно согласия с офертой ───────────────────────────────────────────────────── */
  function needsOffer(){
    var u=user();if(!u)return false;
    var c=caps();if(c.type==='admin')return false;
    if(c.demo){try{return sessionStorage.getItem('case_offer_demo_'+offerVersion())!=='1';}catch(e){return true;}}
    return c.offer_accepted===false;
  }
  function offerGate(){
    if($('offerGate'))return;
    if(!needsOffer())return;
    var d=document.createElement('div');d.id='offerGate';d.className='offer-gate';
    d.innerHTML='<div class="offer-box"><div class="offer-head"><b>Публичная оферта</b><span class="mut">версия '+h(offerVersion())+'</span></div>'
      +'<iframe class="offer-frame" src="'+OFFER_URL+'?v='+encodeURIComponent(offerVersion())+'" title="Публичная оферта"></iframe>'
      +'<label class="offer-ck"><input type="checkbox" id="offerCk"> Я прочитал(а) публичную оферту и принимаю её условия: данные ориентировочные, носят рекомендательный характер, распространять их без разрешения CASE нельзя</label>'
      +'<div class="offer-btns"><button class="btn" id="offerAccept" disabled>Принимаю</button><button class="btn ghost" id="offerDecline">Выйти</button><a class="offer-open" href="'+OFFER_URL+'" target="_blank" rel="noopener">открыть отдельно</a></div></div>';
    document.body.appendChild(d);
    $('offerCk').onchange=function(){$('offerAccept').disabled=!this.checked;};
    $('offerAccept').onclick=async function(){this.disabled=true;
      try{if(caps().demo){try{sessionStorage.setItem('case_offer_demo_'+offerVersion(),'1');}catch(e){}}
        else{var j=await apiPOST('auth.php',{action:'accept_offer'});var u=user();if(u){u.caps=Object.assign({},u.caps||{},{offer_accepted:true});u.settings=Object.assign({},u.settings||{},{offer_accepted:{version:j&&j.version||offerVersion(),at:j&&j.at||''}});}try{if(window.caseAccess&&window.caseAccess.caps)window.caseAccess.caps();}catch(e){}}
        d.remove();toastMsg('Спасибо, условия приняты');
      }catch(e){this.disabled=false;alert('Не удалось сохранить согласие: '+(e&&e.message||e));}
    };
    $('offerDecline').onclick=function(){d.remove();try{logout();}catch(e){}};
  }

  /* ── меню профиля ─────────────────────────────────────────────────────────────── */
  function menuItems(){
    var out=$('b_out');if(!out||$('pm_cabinet'))return;
    var mk=function(id,txt,fn){var b=document.createElement('button');b.type='button';b.className='pm-item';b.id=id;b.textContent=txt;b.onclick=function(e){e.preventDefault();try{var m=$('profileMenu');if(m)m.classList.remove('open');}catch(x){}fn();};return b;};
    out.before(mk('pm_cabinet','Личный кабинет',function(){go('profile');}));
    out.before(mk('pm_feedback','Обратная связь',function(){feedbackModal();}));
    out.before(mk('pm_offer','Публичная оферта',function(){window.open(OFFER_URL,'_blank','noopener');}));
    if(isAdmin())out.before(mk('pm_inbox','Обращения',function(){go('users');setTimeout(function(){var c=$('feedbackCard');if(c)c.scrollIntoView({behavior:'smooth'});},600);}));
    refreshBadge();
  }
  var badgeT=null;
  function refreshBadge(){
    if(!isAdmin()||typeof apiGET!=='function'||typeof BACKEND==='undefined'||!BACKEND)return;
    apiGET('feedback.php?count=1').then(function(j){var n=j&&+j['new']||0;var b=$('pm_inbox');if(b)b.textContent='Обращения'+(n?' ('+n+')':'');var av=$('avatar');if(av){av.classList.toggle('has-inbox',n>0);av.title=n?'Новых обращений: '+n:'';}}).catch(function(){});
    clearTimeout(badgeT);badgeT=setTimeout(refreshBadge,5*60*1000);
  }

  /* ── обратная связь ────────────────────────────────────────────────────────────── */
  function feedbackModal(){
    var html='<h3 style="margin:0 0 6px">Обратная связь</h3><p class="mut" style="font-size:12px;margin:0 0 10px">Предложение, проблема или вопрос уйдут команде CASE; ответ появится в вашем личном кабинете.</p>'
      +'<label style="font-size:12px;font-weight:600">Тип</label><select id="fbKind" style="width:100%;padding:7px 9px;border:1px solid var(--border);border-radius:8px;margin:4px 0 10px">'+Object.keys(KINDS).map(function(k){return '<option value="'+k+'">'+h(KINDS[k])+'</option>';}).join('')+'</select>'
      +'<label style="font-size:12px;font-weight:600">Сообщение</label><textarea id="fbText" rows="5" style="width:100%;box-sizing:border-box;padding:8px 9px;border:1px solid var(--border);border-radius:8px;margin-top:4px;font:inherit" placeholder="Что предлагаете или что не работает; где именно (экран, объект)"></textarea>'
      +'<div id="fbHint" class="mut" style="font-size:12px;margin-top:6px"></div>'
      +'<div style="margin-top:12px;display:flex;gap:8px"><button class="btn" id="fbSend">Отправить</button><button class="btn ghost" onclick="document.getElementById(\'rmodal\').remove()">Отмена</button></div>';
    openModal(html);
    $('fbSend').onclick=async function(){var t=($('fbText').value||'').trim();if(t.length<3){$('fbHint').textContent='Напишите сообщение';return;}this.disabled=true;
      try{await apiPOST('feedback.php',{action:'send',kind:$('fbKind').value,text:t,page:(typeof S!=='undefined'&&S.view)||''});var m=$('rmodal');if(m)m.remove();toastMsg('Отправлено. Ответ появится в личном кабинете');if(S&&S.view==='profile')renderCabinet();}
      catch(e){this.disabled=false;$('fbHint').textContent='Не удалось отправить: '+(e&&e.message||e);}
    };
    setTimeout(function(){var t=$('fbText');if(t)t.focus();},50);
  }

  /* ── личный кабинет ────────────────────────────────────────────────────────────── */
  var TYPE_LBL={admin:'администратор',employee:'сотрудник',client:'клиент',demo:'демо'};
  function renderCabinet(){
    var main=$('main'),u=user();if(!main||!u)return;
    try{S.view='profile';}catch(e){}
    document.querySelectorAll('#nav a').forEach(function(a){a.classList.remove('active');});
    main.classList.remove('geo-workspace');
    var c=caps(),st=u.settings||{},oa=st.offer_accepted||null,demo=!!c.demo;
    var days=u.days_left,expires=u.expires_at?fmtDate(u.expires_at).slice(0,10):'';
    main.innerHTML='<div class="ph"><h1>Личный кабинет</h1></div>'
      +'<div class="cab-grid">'
      +'<div class="card" id="cabProfile"><h3>Профиль</h3>'+(demo?'<div class="mut" style="font-size:12px">Демо-доступ общий для всех: профиль и пароль не меняются. Полный доступ открывает CASE после заявки на регистрацию.</div>':'')
        +'<div class="form" style="max-width:520px"><div class="row2"><div><label>Имя и фамилия</label><input id="cabName" value="'+h(u.name)+'"'+(demo?' disabled':'')+'></div><div><label>Email (логин)</label><input value="'+h(u.email||'')+'" disabled></div></div>'
        +'<div class="row2"><div><label>Компания</label><input id="cabCompany" value="'+h(st.company||'')+'"'+(demo?' disabled':'')+'></div><div><label>Телефон</label><input id="cabPhone" value="'+h(st.phone||'')+'"'+(demo?' disabled':'')+'></div></div>'
        +'<div><label>Профиль панелей в студии</label><select id="cabProfileSel"'+(demo?' disabled':'')+'>'+Object.keys(PROFILES).map(function(k){return '<option value="'+k+'"'+((c.profile||'')===k?' selected':'')+'>'+h(PROFILES[k])+'</option>';}).join('')+'</select><div class="mini" style="color:var(--muted)">Какие панели показывать в студии: ищущему офис нужны удобства вокруг и бизнес-центры, девелоперу спрос и зоны охвата, управляющей компании сравнение и ставки.</div></div>'
        +(demo?'':'<div style="margin-top:10px"><button class="btn" id="cabSave">Сохранить</button> <span class="mut" id="cabHint" style="font-size:12px"></span></div>')+'</div></div>'
      +'<div class="card" id="cabAccess"><h3>Доступ</h3><table class="cab-kv"><tr><td>Тип доступа</td><td><b>'+h(TYPE_LBL[c.type]||c.type||'')+'</b> · роль '+h(u.role||'')+'</td></tr>'
        +'<tr><td>Срок</td><td>'+(expires?'<b>до '+h(expires)+'</b>'+(days!=null?' · '+(days<0?'истёк':days===0?'последний день':'осталось '+days+' дн.'):''):'бессрочно')+'</td></tr>'
        +(c.type==='client'?'<tr><td>Уровень</td><td>'+(c.tier==='free'||c.limited?'<b>бесплатный «Ищу офис»</b>: 40 бизнес-центров ближе к центру, без выгрузки и правок':'полный')+'</td></tr>':'')
        +'<tr><td>Выгрузка</td><td>'+(c.export?'разрешена':'отключена')+'</td></tr><tr><td>Правки</td><td>'+(c.edit?'разрешены':'отключены')+'</td></tr></table>'
        +'<div class="mini" style="color:var(--muted);margin-top:6px">Продление срока и права меняет администратор CASE: напишите через обратную связь.</div></div>'
      +'<div class="card" id="cabOffer"><h3>Публичная оферта</h3><div style="font-size:12.5px">'+(oa&&oa.version?'Принята: версия <b>'+h(oa.version)+'</b>'+(oa.at?' от '+h(fmtDate(oa.at)):''):(demo?'Демо-доступ: согласие действует на этот сеанс.':'Текущая версия не принята.'))+'</div>'
        +'<div style="margin-top:8px"><a class="btn ghost sm" href="'+OFFER_URL+'" target="_blank" rel="noopener">Открыть оферту (версия '+h(offerVersion())+')</a></div></div>'
      +(demo?'':'<div class="card" id="cabPass"><h3>Пароль</h3><div class="form" style="max-width:420px"><div><label>Текущий пароль</label><input id="cabOld" type="password" autocomplete="current-password"></div><div><label>Новый пароль (минимум 8 символов)</label><input id="cabNew" type="password" autocomplete="new-password"></div><div><label>Повторите новый пароль</label><input id="cabNew2" type="password" autocomplete="new-password"></div><div style="margin-top:10px"><button class="btn" id="cabPassBtn">Сменить пароль</button> <span class="mut" id="cabPassHint" style="font-size:12px"></span></div></div></div>')
      +'<div class="card" id="cabFeedback"><h3>Мои обращения <button class="btn sm" id="cabFbNew" style="margin-left:8px">Написать</button></h3><div id="cabFbList" class="mut" style="font-size:12px">Загрузка…</div></div>'
      +'<div class="card" id="cabLog"><h3>Последние входы и действия</h3><div id="cabLogList" class="mut" style="font-size:12px">Загрузка…</div></div>'
      /* v4.78.0: данные пользователя: что он сохранил в студии в этом браузере, обращения, действия; выгрузка и очистка */
      +'<div class="card" id="cabData"><h3>Мои данные <button class="btn ghost sm" id="cabDataDl" style="margin-left:8px">Скачать JSON</button> <button class="btn ghost sm" id="cabDataClear">Очистить данные студии</button></h3><div class="mini" style="color:var(--muted);margin-bottom:6px">Что вы сохранили в студии геоаналитики в этом браузере (правки, заметки, кольца, население и границы махаллей, профиль панелей) и что хранится на сервере под вашей учётной записью.</div><div id="cabDataList" class="mut" style="font-size:12px"></div></div>'
      +'</div>';
    if($('cabSave'))$('cabSave').onclick=saveProfile;
    if($('cabPassBtn'))$('cabPassBtn').onclick=changePassword;
    $('cabFbNew').onclick=feedbackModal;
    $('cabDataDl').onclick=downloadMyData;$('cabDataClear').onclick=clearStudioData;renderMyData();
    loadMyFeedback();loadMyLog();
  }
  /* ── мои данные ────────────────────────────────────────────────────────────────── */
  var DATA_KEYS=[['caseos_bc_edits','Правки бизнес-центров (в этом браузере)','obj'],['caseos_geo_notes_v1','Заметки на карте','arr'],['caseos_rings_v2','Кольца охвата: радиусы и цвета','arr'],['caseos_mahalla_pop_v1','Население махаллей, введённое вручную','obj'],['caseos_mahalla_bounds_v1','Границы махаллей (локально, без права правок)','obj'],['caseos_geo_profile','Профиль панелей студии (выбран в студии)','str'],['caseos_bc_filters_v1','Фильтры бизнес-центров','val'],['caseos_roadside_type','Тип проекта для стороны дороги','str'],['caseos_amen_r','Радиус блока «Что рядом»','str'],['caseos_panel','Настройки левой панели','val'],['caseos_export_cfg','Настройки выгрузки','val']];
  var myCounts={feedback:null,log:null};
  function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function myDataItems(){
    return DATA_KEYS.map(function(d){var raw=lsGet(d[0]),v=null,n=null;if(raw!=null){try{v=JSON.parse(raw);}catch(e){v=raw;}}
      if(v==null)n='нет';else if(d[2]==='obj'&&v&&typeof v==='object')n=Object.keys(v).length+' зап.';else if(d[2]==='arr'&&Array.isArray(v))n=v.length+' зап.';else if(d[2]==='str')n=String(v);else n='есть';
      return {key:d[0],label:d[1],count:n,value:v};});
  }
  function renderMyData(){
    var box=$('cabDataList');if(!box)return;var u=user()||{};var items=myDataItems();
    box.innerHTML='<table class="cab-kv">'+items.map(function(i){return '<tr><td>'+h(i.label)+'</td><td>'+h(i.count)+'</td></tr>';}).join('')
      +'<tr><td>Обращения на сервере</td><td>'+(myCounts.feedback==null?'см. карточку «Мои обращения»':myCounts.feedback)+'</td></tr><tr><td>Действия в журнале</td><td>'+(myCounts.log==null?'см. карточку «Последние входы и действия»':myCounts.log)+'</td></tr>'
      +'<tr><td>Учётная запись</td><td>'+h(u.email||'')+' · '+h(u.name||'')+'</td></tr></table>';
  }
  function downloadMyData(){
    var u=user()||{},c=caps(),out={exported_at:new Date().toISOString(),account:{id:u.id,email:u.email,name:u.name,type:c.type,tier:c.tier||'',profile:c.profile||'',expires_at:u.expires_at||null,settings:u.settings||{}},studio:{}};
    myDataItems().forEach(function(i){if(i.value!=null)out.studio[i.key]={label:i.label,value:i.value};});
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='CASE_OS_my_data_'+String(u.email||'user').replace(/[^a-z0-9]/gi,'_')+'.json';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
    try{if(typeof audit==='function')audit('Мои данные выгружены','кабинет');}catch(e){}
  }
  function clearStudioData(){
    if(!confirm('Удалить данные студии, сохранённые в этом браузере (правки, заметки, кольца, население и границы махаллей, профиль)? На сервере ничего не удаляется.'))return;
    DATA_KEYS.forEach(function(d){try{localStorage.removeItem(d[0]);}catch(e){}});renderMyData();
    try{var fr=document.querySelector('iframe[src*="geoanalytics-studio"]');if(fr&&fr.contentWindow)fr.contentWindow.location.reload();}catch(e){}
    try{if(typeof audit==='function')audit('Данные студии очищены','кабинет');}catch(e){}
    toastMsg('Локальные данные студии удалены');
  }
  async function saveProfile(){
    var b=$('cabSave');b.disabled=true;var hint=$('cabHint');
    try{var j=await apiPOST('auth.php',{action:'update_profile',name:$('cabName').value.trim(),company:$('cabCompany').value.trim(),phone:$('cabPhone').value.trim(),profile:$('cabProfileSel').value});
      var u=user();if(u){u.name=j&&j.name||u.name;u.settings=Object.assign({},u.settings||{},(j&&j.settings)||{});u.caps=Object.assign({},u.caps||{},{profile:$('cabProfileSel').value});}
      try{if(window.caseAccess&&window.caseAccess.caps)window.caseAccess.caps();}catch(e){}
      /* профиль панелей выбран в кабинете: студия берёт его из прав учётной записи, локальный выбор в студии сбрасывается */
      try{localStorage.removeItem('caseos_geo_profile');}catch(e){}
      try{var fr=document.querySelector('iframe[src*="geoanalytics-studio"]');if(fr&&fr.contentWindow&&fr.contentWindow.CASE_GEO_PROFILES)fr.contentWindow.CASE_GEO_PROFILES.set($('cabProfileSel').value,true);}catch(e){}
      try{var wn=$('whoName');if(wn&&wn.firstChild)wn.firstChild.textContent=(typeof nameDisplay==='function'?nameDisplay(u.name):u.name);var av=$('avatar');if(av)av.textContent=(u.name||'C')[0];}catch(e){}
      try{if(typeof audit==='function')audit('Профиль изменён','кабинет');}catch(e){}
      if(hint)hint.textContent='Сохранено';
    }catch(e){if(hint)hint.textContent='Ошибка: '+(e&&e.message||e);}
    finally{b.disabled=false;}
  }
  async function changePassword(){
    var hint=$('cabPassHint'),o=$('cabOld').value,n=$('cabNew').value,n2=$('cabNew2').value;
    if(n.length<8){hint.textContent='Новый пароль минимум 8 символов';return;}
    if(n!==n2){hint.textContent='Пароли не совпадают';return;}
    var b=$('cabPassBtn');b.disabled=true;
    try{await apiPOST('auth.php',{action:'change_password',old_password:o,password:n});hint.textContent='Пароль изменён';$('cabOld').value='';$('cabNew').value='';$('cabNew2').value='';}
    catch(e){hint.textContent='Ошибка: '+(e&&e.message||e);}
    finally{b.disabled=false;}
  }
  async function loadMyFeedback(){
    var box=$('cabFbList');if(!box)return;
    try{var j=await apiGET('feedback.php?mine=1');var rows=(j&&j.rows)||[];myCounts.feedback=rows.length;renderMyData();
      box.innerHTML=rows.length?'<div class="tbl-scroll"><table><thead><tr><th>Когда</th><th>Тип</th><th>Сообщение</th><th>Статус</th><th>Ответ CASE</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td style="white-space:nowrap">'+h(fmtDate(r.created_at))+'</td><td>'+h(KINDS[r.kind]||r.kind)+'</td><td>'+h(r.text)+'</td><td><span class="fb-st fb-st-'+h(r.status)+'">'+h(STATUSES[r.status]||r.status)+'</span></td><td>'+(r.reply?h(r.reply):'<span class="mut">пока нет</span>')+'</td></tr>';}).join('')+'</tbody></table></div>':'Обращений пока нет. Напишите нам, если что-то не работает или есть идея.';
    }catch(e){box.textContent='Не удалось загрузить: '+(e&&e.message||e);}
  }
  async function loadMyLog(){
    var box=$('cabLogList');if(!box)return;
    try{var j=await apiPOST('auth.php',{action:'my_log',limit:30});var rows=(j&&j.rows)||[];myCounts.log=rows.length;renderMyData();
      box.innerHTML=rows.length?'<div class="tbl-scroll" style="max-height:320px;overflow:auto"><table><thead><tr><th>Когда</th><th>Действие</th><th>Подробности</th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td style="white-space:nowrap">'+h(r.at||'')+'</td><td>'+h(r.action||'')+'</td><td>'+h(r.detail||'')+'</td></tr>';}).join('')+'</tbody></table></div>':'Записей пока нет.';
    }catch(e){box.textContent='Журнал недоступен: '+(e&&e.message||e);}
  }

  /* ── администратор: очередь обращений на странице «Доступ» ─────────────────────── */
  async function feedbackCard(){
    var main=$('main');if(!main||!isAdmin()||$('feedbackCard'))return;
    var anchor=$('accessCards')||main.querySelector('.ph');if(!anchor)return;
    var card=document.createElement('div');card.className='card';card.id='feedbackCard';card.innerHTML='<h3>Обращения пользователей <span class="mut" id="fbCount">загрузка…</span></h3><div class="mini" style="color:var(--muted);margin-bottom:8px">Предложения, проблемы и вопросы из платформы и из Telegram-бота. Ответ виден пользователю в личном кабинете.</div><div id="fbBody">Загрузка…</div>';
    anchor.after(card);
    card.addEventListener('click',onFeedbackClick);
    loadFeedbackAdmin();
  }
  async function loadFeedbackAdmin(){
    var body=$('fbBody'),cnt=$('fbCount');if(!body)return;
    try{var j=await apiGET('feedback.php?limit=300');var rows=(j&&j.rows)||[];var fresh=rows.filter(function(r){return r.status==='new';}).length;
      if(cnt)cnt.textContent=rows.length?(fresh?fresh+' новых из '+rows.length:rows.length+' всего'):'пусто';
      body.innerHTML=rows.length?'<div class="tbl-scroll"><table><thead><tr><th>Когда</th><th>Кто</th><th>Тип</th><th>Сообщение</th><th>Статус</th><th>Ответ</th><th></th></tr></thead><tbody>'+rows.map(function(r){return '<tr data-fid="'+r.id+'"><td style="white-space:nowrap">'+h(fmtDate(r.created_at))+'</td><td><b>'+h(r.user_name||'')+'</b><div class="mini" style="color:var(--muted)">'+h(r.user_email||'')+(r.channel&&r.channel!=='app'?' · '+h(r.channel):'')+(r.page?' · '+h(r.page):'')+'</div></td><td>'+h(KINDS[r.kind]||r.kind)+'</td><td style="max-width:360px">'+h(r.text)+'</td><td><span class="fb-st fb-st-'+h(r.status)+'">'+h(STATUSES[r.status]||r.status)+'</span></td><td style="max-width:240px">'+(r.reply?h(r.reply)+(r.replied_by?'<div class="mini" style="color:var(--muted)">'+h(r.replied_by)+'</div>':''):'<span class="mut">нет</span>')+'</td><td style="white-space:nowrap">'+(r.status==='new'?'<button class="btn ghost sm fb-seen">Просмотрено</button> ':'')+'<button class="btn sm fb-reply">Ответить</button>'+(r.status!=='done'?' <button class="btn ghost sm fb-done">Готово</button>':'')+'</td></tr>';}).join('')+'</tbody></table></div>':'<div class="mut">Обращений нет.</div>';
    }catch(e){if(cnt)cnt.textContent='';body.innerHTML='<div class="mut">Не удалось загрузить: '+h(e&&e.message||e)+'</div>';}
  }
  async function onFeedbackClick(e){
    var b=e.target.closest('button');if(!b)return;var row=b.closest('tr'),id=row&&+row.getAttribute('data-fid');if(!id)return;
    try{
      if(b.classList.contains('fb-seen')){await apiPOST('feedback.php',{action:'status',id:id,status:'seen'});}
      else if(b.classList.contains('fb-done')){await apiPOST('feedback.php',{action:'status',id:id,status:'done'});}
      else if(b.classList.contains('fb-reply')){var txt=prompt('Ответ пользователю (он увидит его в личном кабинете):','');if(txt==null)return;await apiPOST('feedback.php',{action:'status',id:id,status:'done',reply:txt});}
      else return;
      try{if(typeof audit==='function')audit('Обращение обработано','#'+id);}catch(x){}
      await loadFeedbackAdmin();refreshBadge();
    }catch(err){alert('Ошибка: '+(err&&err.message||err));}
  }

  /* ── оформление ────────────────────────────────────────────────────────────────── */
  function css(){
    if($('cabinetCss'))return;
    var s=document.createElement('style');s.id='cabinetCss';s.textContent=
      '.offer-gate{position:fixed;inset:0;z-index:5000;background:rgba(20,16,12,.62);display:flex;align-items:center;justify-content:center;padding:16px}'
      +'.offer-box{background:#fff;border-radius:16px;width:min(860px,100%);max-height:94vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.4);overflow:hidden}'
      +'.offer-head{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#1b1b1b;color:#fff;font-size:14px}.offer-head .mut{color:#c9c1b4;font-size:12px}'
      +'.offer-frame{flex:1;min-height:320px;border:0;width:100%;background:#faf8f5}'
      +'.offer-ck{display:flex;gap:10px;align-items:flex-start;padding:12px 16px;font-size:12.5px;line-height:1.4;border-top:1px solid var(--border,#e3dcd1)}.offer-ck input{margin-top:3px}'
      +'.offer-btns{display:flex;gap:8px;align-items:center;padding:0 16px 14px}.offer-open{margin-left:auto;font-size:12px;color:var(--red,#9E0000)}'
      +'.cab-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cab-grid .card{margin:0}@media(max-width:900px){.cab-grid{grid-template-columns:1fr}}'
      +'.cab-kv{border-collapse:collapse;font-size:12.5px}.cab-kv td{padding:4px 10px 4px 0;vertical-align:top}.cab-kv td:first-child{color:var(--muted);white-space:nowrap}'
      +'.fb-st{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;background:#e9eefc;color:#2b4b9b}.fb-st-seen{background:#fff3d6;color:#8a5a00}.fb-st-done{background:#eef2ee;color:#0d7a6f}'
      +'#avatar.has-inbox{box-shadow:0 0 0 2px #fff,0 0 0 4px #9E0000}';
    document.head.appendChild(s);
  }

  /* ── установка ─────────────────────────────────────────────────────────────────── */
  function install(){
    css();
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._cabinet){window.go=function(v){if(v==='profile'){renderCabinet();try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}return;}return oldGo.apply(this,arguments);};window.go._cabinet=true;}
    var oldBoot=window.boot;
    if(typeof oldBoot==='function'&&!oldBoot._cabinet){window.boot=function(){var r=oldBoot.apply(this,arguments);try{menuItems();offerGate();}catch(e){}return r;};window.boot._cabinet=true;}
    var oldUsers=window.renderUsersBackend;
    if(typeof oldUsers==='function'&&!oldUsers._cabinet){window.renderUsersBackend=function(){var r=oldUsers.apply(this,arguments);try{feedbackCard();}catch(e){}return r;};window.renderUsersBackend._cabinet=true;}
    try{if(user()){menuItems();offerGate();}}catch(e){}
  }
  window.caseCabinet={version:VERSION,render:renderCabinet,feedback:feedbackModal,offerGate:offerGate,needsOffer:needsOffer,refreshBadge:refreshBadge,profiles:PROFILES};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['v4770-cabinet']='4.78.0';
