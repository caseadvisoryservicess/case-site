/* CASE OS v4.76.0: модель доступа на клиенте.
 *
 * Решение владельца: три типа входа (администратор, сотрудники, клиенты с открытым доступом),
 * настройки на каждого пользователя, журнал действий по пользователю, корзина удалённого,
 * подписка со сроком (блокировка входа без удаления данных, предупреждение за 5 дней), вход по
 * логину и паролю, регистрация, демо-вход с ограниченными данными.
 *
 * Сервер (api/auth.php, api/users.php, api/geo_state.php, api/lib.php) решает всё сам; этот модуль
 * только показывает: ссылки «Регистрация» и «Демо-доступ» на экране входа, предупреждение о сроке
 * после входа, карточки «Заявки», «Доступ и подписка», «Корзина геоданных» на странице «Доступ» и
 * передаёт права вошедшего в студию (window.CASE_USER_CAPS, читает v4760-geo-caps.js в iframe).
 */
(function(){
  'use strict';
  if(window.CASE_ACCESS_4760)return;
  window.CASE_ACCESS_4760=true;
  var VERSION='4.76.0';
  function $(id){return document.getElementById(id);}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function tr(ru,uz,en){try{return LANG==='uz'?uz:(LANG==='en'?en:ru);}catch(e){return ru;}}
  function user(){try{return (typeof S!=='undefined'&&S&&S.user)||null;}catch(e){return null;}}
  function isAdmin(){try{return !!(typeof R==='function'&&R().admin);}catch(e){return false;}}
  function fmtDate(d){if(!d)return '';var s=String(d).slice(0,10);var m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'.'+m[2]+'.'+m[1]:s;}
  var TYPES={admin:'администратор',employee:'сотрудник',client:'клиент',demo:'демо'};

  /* ── права вошедшего для студии ─────────────────────────────────────────────────── */
  /* ядро собирает S.user заново из ответа сервера и не знает новых полей: тип, срок, права
     дописываем сами после applyServerUser (и подхватываем, если ядро вошло раньше модуля) */
  var EXTRA=['type','demo','days_left','expires_at','settings','caps'];
  function mergeServerUser(su){var u=user();if(!u||!su)return;EXTRA.forEach(function(k){if(k in su)u[k]=su[k];});window.CASE_SERVER_USER=su;}
  function computeCaps(){
    var u=user();if(!u)return null;
    var caps=u.caps&&typeof u.caps==='object'?Object.assign({},u.caps):{type:u.type||(isAdmin()?'admin':'employee'),demo:!!u.demo,export:true,edit:true,days_left:u.days_left==null?null:u.days_left,expires_at:u.expires_at||null};
    if(caps.export==null)caps.export=true;if(caps.edit==null)caps.edit=true;
    window.CASE_USER_CAPS=caps;return caps;
  }

  /* ── предупреждение о сроке доступа ───────────────────────────────────────────────── */
  function expiryBanner(){
    var u=user();var old=$('subBanner');if(old)old.remove();
    if(!u||u.days_left==null||u.days_left>5)return;
    try{if(sessionStorage.getItem('case_sub_banner_'+String(u.expires_at||'').slice(0,10))==='1')return;}catch(e){}
    var app=$('app'),top=app&&app.querySelector('.topbar');if(!app||!top)return;
    var d=document.createElement('div');d.id='subBanner';d.className='sub-banner';
    var when=fmtDate(u.expires_at);
    var txt=u.days_left<=0?tr('Срок вашего доступа заканчивается сегодня','Kirish muddati bugun tugaydi','Your access ends today'):tr('Срок вашего доступа истекает через '+u.days_left+' дн.','Kirish muddati '+u.days_left+' kundan keyin tugaydi','Your access expires in '+u.days_left+' days');
    d.innerHTML='<span>⏳ <b>'+h(txt)+'</b>'+(when?' ('+h(when)+')':'')+'. '+h(tr('Данные сохранятся; продление у администратора CASE.','Ma’lumotlar saqlanadi; uzaytirish CASE administratorida.','Your data is kept; contact the CASE administrator to extend.'))+'</span><button type="button" class="sub-banner-x" aria-label="Закрыть" title="Скрыть до следующего входа">✕</button>';
    d.querySelector('.sub-banner-x').onclick=function(){d.remove();try{sessionStorage.setItem('case_sub_banner_'+String(u.expires_at||'').slice(0,10),'1');}catch(e){}};
    top.after(d);
  }

  /* ── экран входа: регистрация и демо ─────────────────────────────────────────────── */
  var FLAGS={registration:true,demo:true,backend:null};
  function loginExtras(){
    var card=document.querySelector('#login .lcard'),go=$('l_go');if(!card||!go||$('l_extra'))return;
    var ex=document.createElement('div');ex.className='l-extra';ex.id='l_extra';
    ex.innerHTML='<button type="button" class="l-link" id="l_regBtn">'+h(tr('Регистрация','Ro‘yxatdan o‘tish','Sign up'))+'</button><span class="l-dot">·</span><button type="button" class="l-link" id="l_demoBtn">'+h(tr('Демо-доступ','Demo kirish','Demo access'))+'</button>';
    go.after(ex);
    var f=document.createElement('div');f.id='regForm';f.className='l-reg';f.hidden=true;
    f.innerHTML='<div class="l-reg-h">'+h(tr('Заявка на доступ','Kirish uchun ariza','Access request'))+'</div>'
      +'<p class="l-reg-p">'+h(tr('Администратор CASE проверит заявку и откроет доступ на согласованный срок.','CASE administratori arizani tekshirib, kelishilgan muddatga kirish ochadi.','The CASE administrator reviews the request and opens access for the agreed term.'))+'</p>'
      +'<label for="r_name">'+h(tr('Имя и фамилия','Ism va familiya','Full name'))+'</label><input id="r_name" autocomplete="name">'
      +'<label for="r_company">'+h(tr('Компания','Kompaniya','Company'))+'</label><input id="r_company" autocomplete="organization">'
      +'<label for="r_email">Email</label><input id="r_email" type="email" autocomplete="email">'
      +'<label for="r_phone">'+h(tr('Телефон','Telefon','Phone'))+'</label><input id="r_phone" type="tel" autocomplete="tel">'
      +'<label for="r_pass">'+h(tr('Пароль (минимум 8 символов)','Parol (kamida 8 belgi)','Password (8+ characters)'))+'</label><input id="r_pass" type="password" autocomplete="new-password">'
      +'<button type="button" class="go" id="r_go">'+h(tr('Отправить заявку','Ariza yuborish','Send request'))+'</button>'
      +'<button type="button" class="l-link l-back" id="r_back">'+h(tr('Назад ко входу','Kirishga qaytish','Back to sign in'))+'</button>'
      +'<div class="hint" id="r_hint"></div>';
    card.appendChild(f);
    $('l_regBtn').onclick=function(){openReg(true);};
    $('r_back').onclick=function(){openReg(false);};
    $('r_go').onclick=register;
    $('l_demoBtn').onclick=demoLogin;
    f.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();register();}});
    applyFlags();
  }
  function openReg(on){var card=document.querySelector('#login .lcard');if(!card)return;card.classList.toggle('reg-open',!!on);var f=$('regForm');if(f)f.hidden=!on;if(on){var n=$('r_name');if(n)setTimeout(function(){n.focus();},30);}}
  function applyFlags(){
    var rb=$('l_regBtn'),db=$('l_demoBtn'),ex=$('l_extra');if(!ex)return;
    var backend=FLAGS.backend!==false;
    if(rb)rb.style.display=(backend&&FLAGS.registration)?'':'none';
    if(db)db.style.display=(backend&&FLAGS.demo)?'':'none';
    var dot=ex.querySelector('.l-dot');if(dot)dot.style.display=(backend&&FLAGS.registration&&FLAGS.demo)?'':'none';
    ex.style.display=(backend&&(FLAGS.registration||FLAGS.demo))?'':'none';
  }
  function loadFlags(){
    var p=window._AUTH_INIT_PROMISE||Promise.resolve();
    p.then(function(){},function(){}).then(function(){
      if(typeof BACKEND!=='undefined'&&!BACKEND){FLAGS.backend=false;applyFlags();return;}
      if(typeof apiGET!=='function')return;
      return apiGET('auth.php').then(function(j){if(!j||typeof j.auth!=='boolean'){FLAGS.backend=false;applyFlags();return;}FLAGS.backend=true;FLAGS.registration=j.registration!==false;FLAGS.demo=j.demo_login!==false;applyFlags();
        if(j.auth===false&&j.expired&&typeof loginErr==='function')loginErr(j.message||'Срок доступа истёк.');},function(){});
    });
  }
  function regHint(msg,ok){var e=$('r_hint');if(!e)return;e.textContent=msg||'';e.style.color=ok?'#0d7a6f':(msg?'var(--red,#c0392b)':'');}
  async function register(){
    var name=($('r_name')||{}).value||'',email=(($('r_email')||{}).value||'').trim().toLowerCase(),pass=($('r_pass')||{}).value||'',company=($('r_company')||{}).value||'',phone=($('r_phone')||{}).value||'';
    if(name.trim().length<2){regHint(tr('Укажите имя и фамилию','Ism va familiyani kiriting','Enter your name'));return;}
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){regHint(tr('Укажите корректный email','To‘g‘ri email kiriting','Enter a valid email'));return;}
    if(pass.length<8){regHint(tr('Пароль минимум 8 символов','Parol kamida 8 belgi','Password must be 8+ characters'));return;}
    var b=$('r_go');if(b)b.disabled=true;
    try{var j=await apiPOST('auth.php',{action:'register',name:name.trim(),email:email,password:pass,company:company.trim(),phone:phone.trim()});
      regHint(j&&j.message||tr('Заявка принята.','Ariza qabul qilindi.','Request received.'),true);
      ['r_name','r_company','r_email','r_phone','r_pass'].forEach(function(id){var e=$(id);if(e)e.disabled=true;});
      try{if(typeof audit==='function')audit('Заявка на регистрацию отправлена',email);}catch(e){}
    }catch(e){regHint(e&&e.message||tr('Не удалось отправить заявку','Arizani yuborib bo‘lmadi','Could not send the request'));if(b)b.disabled=false;}
  }
  async function demoLogin(){
    var b=$('l_demoBtn');if(b)b.disabled=true;
    try{if(window._AUTH_INIT_PROMISE){try{await window._AUTH_INIT_PROMISE;}catch(e){}}
      var j=await apiPOST('auth.php',{action:'demo'});
      if(typeof BACKEND!=='undefined')BACKEND=true;
      await enterWithServerUser(j.user,j.rights,j.mode);
    }catch(e){if(typeof loginErr==='function')loginErr(e&&e.message||tr('Демо-доступ недоступен','Demo kirish mavjud emas','Demo access unavailable'));}
    finally{if(b)b.disabled=false;}
  }

  /* ── страница «Доступ»: заявки, подписка, журнал, корзина ───────────────────────── */
  function users(){try{return (typeof SRV_USERS!=='undefined'&&Array.isArray(SRV_USERS))?SRV_USERS:[];}catch(e){return [];}}
  function settingsOf(u){var s=u&&u.settings;if(typeof s==='string'){try{s=JSON.parse(s);}catch(e){s=null;}}return (s&&typeof s==='object')?s:{};}
  function typeOf(u){var rk=u.role_key||'';try{if(typeof ROLES!=='undefined'&&ROLES[rk]&&ROLES[rk].admin)return 'admin';}catch(e){}var t=u.user_type||'';if(t==='client'||t==='demo'||t==='employee')return t;return rk==='CL'?'client':(rk==='DEMO'?'demo':'employee');}
  function daysLeft(u){if(!u.expires_at)return null;var t=Date.parse(String(u.expires_at).slice(0,10)+'T23:59:59');if(isNaN(t))return null;return Math.floor((t-Date.now())/86400000);}
  function statusOf(u){var act=(+u.active===1||u.active===true),s=settingsOf(u),d=daysLeft(u);if(!act&&s.registration_pending)return ['pending','заявка'];if(!act)return ['off','отключён'];if(d!=null&&d<0)return ['expired','срок истёк'];if(d!=null&&d<=5)return ['soon','истекает через '+d+' дн.'];return ['ok',d==null?'бессрочно':'до '+fmtDate(u.expires_at)];}
  function accessCards(){
    var main=$('main'),ph=main&&main.querySelector('.ph');if(!main||!ph||!isAdmin()||$('accessCards'))return;
    var list=users().filter(function(u){return !(+u.archived===1||u.archived===true);});
    var pending=list.filter(function(u){var s=settingsOf(u);return !(+u.active===1||u.active===true)&&s.registration_pending;});
    var h1='';
    if(pending.length){
      h1+='<div class="card" id="regCard"><h3>Заявки на регистрацию <span class="pill">'+pending.length+'</span></h3><div class="mini" style="color:var(--muted);margin-bottom:8px">Заявитель уже задал пароль. Откройте доступ и укажите срок; отклонённая заявка удаляется.</div><div class="tbl-scroll"><table><thead><tr><th>Имя</th><th>Email</th><th>Компания · телефон</th><th>Подана</th><th>Доступ до</th><th>Выгрузка</th><th></th></tr></thead><tbody>'
        +pending.map(function(u){var s=settingsOf(u);return '<tr data-uid="'+h(u.id)+'"><td><b>'+h(u.name)+'</b></td><td>'+h(u.email)+'</td><td>'+h([s.company,s.phone].filter(Boolean).join(' · ')||'-')+'</td><td>'+h(fmtDate(s.registered_at))+'</td><td><input type="date" class="ac-exp" style="font-size:12px;padding:4px 6px"></td><td><input type="checkbox" class="ac-exp-export" title="разрешить выгрузку PDF, Excel, CSV"></td><td style="white-space:nowrap"><button class="btn sm ac-approve">Открыть доступ</button> <button class="btn ghost sm ac-reject">Отклонить</button></td></tr>';}).join('')
        +'</tbody></table></div></div>';
    }
    h1+='<div class="card" id="accessCard"><h3>Доступ, подписка и журнал <span class="mut">'+list.length+'</span></h3>'
      +'<div class="mini" style="color:var(--muted);margin-bottom:8px">Тип доступа: сотрудник видит платформу по своей роли, клиент только студию геоаналитики, демо ничего не сохраняет. Срок: по его окончании вход закрывается, данные и учётная запись остаются; за 5 дней пользователь видит предупреждение. Выгрузка и правки включаются на каждого отдельно.</div>'
      +'<div class="tbl-scroll"><table><thead><tr><th>Пользователь</th><th>Тип</th><th>Доступ до</th><th>Выгрузка</th><th>Правки</th><th>Заметка</th><th>Статус</th><th></th></tr></thead><tbody>'
      +list.map(function(u){var t=typeOf(u),s=settingsOf(u),st=statusOf(u),adm=t==='admin';
        var exp=!!(adm||t==='employee'?(s.can_export==null?true:s.can_export):s.can_export),edit=!!(adm?true:(t==='employee'?(s.can_edit==null?true:s.can_edit):s.can_edit));
        return '<tr data-uid="'+h(u.id)+'"><td><b>'+h(u.name)+'</b><div class="mini" style="color:var(--muted)">'+h(u.email)+' · '+h(u.role_key||'')+'</div></td>'
          +'<td>'+(adm?'<span class="pill">администратор</span>':'<select class="ac-type" style="font-size:12px;padding:4px 6px"><option value="employee"'+(t==='employee'?' selected':'')+'>сотрудник</option><option value="client"'+(t==='client'?' selected':'')+'>клиент</option><option value="demo"'+(t==='demo'?' selected':'')+'>демо</option></select>')+'</td>'
          +'<td><input type="date" class="ac-exp" value="'+h(String(u.expires_at||'').slice(0,10))+'" style="font-size:12px;padding:4px 6px"'+(adm?' disabled':'')+'></td>'
          +'<td><input type="checkbox" class="ac-export"'+(exp?' checked':'')+(adm?' disabled':'')+'></td><td><input type="checkbox" class="ac-edit"'+(edit?' checked':'')+(adm||t==='demo'?' disabled':'')+'></td>'
          +'<td><input type="text" class="ac-note" value="'+h(s.note||'')+'" placeholder="для себя" style="font-size:12px;padding:4px 6px;width:140px"></td>'
          +'<td><span class="ac-st ac-st-'+st[0]+'">'+h(st[1])+'</span></td>'
          +'<td style="white-space:nowrap">'+(adm?'':'<button class="btn sm ac-save">Сохранить</button> ')+'<button class="btn ghost sm ac-log">Журнал</button></td></tr>';}).join('')
      +'</tbody></table></div></div>'
      +'<div class="card" id="trashCard"><h3>🗑 Корзина геоданных <span class="mut" id="trashCount">загрузка…</span></h3><div class="mini" style="color:var(--muted);margin-bottom:8px">Записи, которые сотрудники удалили из наборов геоаналитики: у них они исчезли, здесь их можно вернуть.</div><div id="trashBody">Загрузка…</div></div>';
    var wrap=document.createElement('div');wrap.id='accessCards';wrap.innerHTML=h1;ph.after(wrap);
    wrap.addEventListener('click',onCardsClick);
    loadTrash();
  }
  async function onCardsClick(e){
    var b=e.target.closest('button');if(!b)return;var row=b.closest('tr'),uid=row&&row.getAttribute('data-uid');
    if(b.classList.contains('ac-approve')&&uid){var exp=row.querySelector('.ac-exp').value,canExp=row.querySelector('.ac-exp-export').checked;b.disabled=true;try{await apiPOST('users.php',{action:'approve',id:uid,expires_at:exp,can_export:canExp?1:0});try{audit('Заявка подтверждена',uid);}catch(x){}toast('Доступ открыт'+(exp?' до '+fmtDate(exp):''));await reloadSrvUsers();}catch(err){alert('Ошибка: '+(err&&err.message||err));b.disabled=false;}return;}
    if(b.classList.contains('ac-reject')&&uid){if(!confirm('Отклонить заявку и удалить учётную запись?'))return;try{await apiPOST('users.php',{action:'delete_user',id:uid,confirm:1});try{audit('Заявка отклонена',uid);}catch(x){}toast('Заявка отклонена');await reloadSrvUsers();}catch(err){alert('Ошибка: '+(err&&err.message||err));}return;}
    if(b.classList.contains('ac-save')&&uid){var t=row.querySelector('.ac-type').value,ex2=row.querySelector('.ac-exp').value,s={can_export:row.querySelector('.ac-export').checked,can_edit:row.querySelector('.ac-edit').checked,note:row.querySelector('.ac-note').value};b.disabled=true;try{await apiPOST('users.php',{action:'set_profile',id:uid,user_type:t,expires_at:ex2,settings:s});try{audit('Настройки доступа',uid+' · '+t+' · до '+(ex2||'бессрочно'));}catch(x){}toast('Сохранено');await reloadSrvUsers();}catch(err){alert('Ошибка: '+(err&&err.message||err));b.disabled=false;}return;}
    if(b.classList.contains('ac-log')&&uid){showLog(uid);return;}
    if(b.classList.contains('ac-restore')){var tid=+b.getAttribute('data-tid');b.disabled=true;try{await apiPOST('geo_state.php',{action:'restore_trash',trash_id:tid});try{audit('Корзина геоданных: восстановление','#'+tid);}catch(x){}toast('Запись восстановлена');loadTrash();try{if(typeof window.geoV42Reload==='function')window.geoV42Reload();}catch(x){}}catch(err){alert('Ошибка: '+(err&&err.message||err));b.disabled=false;}return;}
  }
  async function showLog(uid){
    var u=users().filter(function(x){return x.id===uid;})[0]||{name:uid};
    var rows=[];try{var j=await apiPOST('users.php',{action:'log',id:uid,limit:300});rows=j.rows||[];}catch(e){alert('Журнал недоступен: '+(e&&e.message||e));return;}
    var html='<h3 style="margin:0 0 8px">Журнал: '+h(u.name)+' <span class="mut">'+rows.length+'</span></h3><div class="mini" style="color:var(--muted);margin-bottom:8px">Действия на сервере: вход, сохранения, правки доступа. Последние '+rows.length+'.</div>'
      +'<div class="tbl-scroll" style="max-height:60vh;overflow:auto"><table><thead><tr><th>Когда</th><th>Действие</th><th>Подробности</th></tr></thead><tbody>'+(rows.length?rows.map(function(r){return '<tr><td style="white-space:nowrap">'+h(r.at||'')+'</td><td>'+h(r.action||'')+'</td><td>'+h(r.detail||'')+'</td></tr>';}).join(''):'<tr><td colspan="3" class="mut">записей нет</td></tr>')+'</tbody></table></div>'
      +'<div style="margin-top:10px;text-align:right"><button class="btn ghost sm" onclick="document.getElementById(\'rmodal\').remove()">Закрыть</button></div>';
    if(typeof openModal==='function')openModal(html);else alert(rows.map(function(r){return r.at+' '+r.action+' '+(r.detail||'');}).join('\n')||'записей нет');
  }
  async function loadTrash(){
    var body=$('trashBody'),cnt=$('trashCount');if(!body)return;
    try{var j=await apiGET('geo_state.php?trash=1');var rows=j.trash||[];var live=rows.filter(function(r){return !r.restored_at;});
      if(cnt)cnt.textContent=live.length?live.length+' в корзине':'пусто';
      if(!rows.length){body.innerHTML='<div class="mut">Удалённых записей нет.</div>';return;}
      body.innerHTML='<div class="tbl-scroll"><table><thead><tr><th>Набор</th><th>Запись</th><th>Удалил</th><th>Когда</th><th></th></tr></thead><tbody>'+rows.map(function(r){return '<tr><td>'+h(r.dataset)+'</td><td><b>'+h(r.title)+'</b></td><td>'+h(r.deleted_by||'')+'</td><td style="white-space:nowrap">'+h(r.deleted_at||'')+'</td><td>'+(r.restored_at?'<span class="mut">восстановлено '+h(r.restored_at)+(r.restored_by?' · '+h(r.restored_by):'')+'</span>':'<button class="btn sm ac-restore" data-tid="'+r.id+'">Восстановить</button>')+'</td></tr>';}).join('')+'</tbody></table></div>';
    }catch(e){if(cnt)cnt.textContent='';body.innerHTML='<div class="mut">Корзина недоступна: '+h(e&&e.message||e)+'</div>';}
  }

  /* ── оформление ───────────────────────────────────────────────────────────────────── */
  function css(){
    if($('accessCss'))return;
    var s=document.createElement('style');s.id='accessCss';s.textContent=
      '.l-extra{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;font-size:12px;color:var(--muted)}.l-link{border:0;background:none;color:var(--red,#9E0000);font:600 12.5px inherit;cursor:pointer;padding:2px 4px}.l-link:hover{text-decoration:underline}'
      +'.lcard.reg-open>:not(.lg):not(.tag):not(#regForm){display:none!important}.l-reg-h{font-size:16px;font-weight:800;margin:4px 0 2px}.l-reg-p{font-size:11.5px;color:var(--muted);margin:0 0 4px;line-height:1.4}.l-reg .l-back{display:block;margin:10px auto 0}'
      +'.sub-banner{display:flex;align-items:center;gap:10px;padding:8px 14px;background:#fff7e6;border-bottom:1px solid #f0d9a0;color:#6b4e00;font-size:12.5px}.sub-banner b{color:#1b1b1b}.sub-banner-x{margin-left:auto;border:0;background:none;cursor:pointer;font-size:14px;color:#6b4e00}body.dark .sub-banner{background:#3a2f12;color:#f4e3b5}body.dark .sub-banner b{color:#fff}'
      +'.ac-st{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600;background:#eef2ee;color:#0d7a6f}.ac-st-soon{background:#fff3d6;color:#8a5a00}.ac-st-expired,.ac-st-off{background:#fdeaea;color:#9E0000}.ac-st-pending{background:#e9eefc;color:#2b4b9b}';
    document.head.appendChild(s);
  }

  /* ── установка ────────────────────────────────────────────────────────────────────── */
  function install(){
    css();loginExtras();loadFlags();
    var oldApply=window.applyServerUser;
    if(typeof oldApply==='function'&&!oldApply._access){window.applyServerUser=function(su,rights){var r=oldApply.apply(this,arguments);try{mergeServerUser(su);computeCaps();}catch(e){}return r;};window.applyServerUser._access=true;}
    var oldBoot=window.boot;
    if(typeof oldBoot==='function'&&!oldBoot._access){window.boot=function(){computeCaps();var r=oldBoot.apply(this,arguments);try{expiryBanner();}catch(e){}return r;};window.boot._access=true;}
    var oldUsers=window.renderUsersBackend;
    if(typeof oldUsers==='function'&&!oldUsers._access){window.renderUsersBackend=function(){var r=oldUsers.apply(this,arguments);try{accessCards();}catch(e){}return r;};window.renderUsersBackend._access=true;}
    /* сервер закрывает сеанс, когда срок истёк посреди работы: показываем причину на экране входа */
    setInterval(function(){try{if(typeof BACKEND==='undefined'||!BACKEND||!user()||typeof apiGET!=='function')return;apiGET('auth.php').then(function(j){if(j&&j.auth===false&&j.expired){try{sessionExpired();}catch(e){}if(typeof loginErr==='function')loginErr(j.message||'Срок доступа истёк.');}}).catch(function(){});}catch(e){}},5*60*1000);
    /* ядро могло войти раньше загрузки модуля: тогда полей сервера в S.user нет, спрашиваем сами */
    try{if(user()){if(user().type==null&&typeof apiGET==='function'&&typeof BACKEND!=='undefined'&&BACKEND){apiGET('auth.php').then(function(j){if(j&&j.auth&&j.user){mergeServerUser(j.user);computeCaps();expiryBanner();}}).catch(function(){});}else{computeCaps();expiryBanner();}}}catch(e){}
  }
  window.caseAccess={version:VERSION,caps:computeCaps,register:register,demoLogin:demoLogin,openRegistration:openReg,cards:accessCards,loadTrash:loadTrash,showLog:showLog,typeOf:typeOf,statusOf:statusOf};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['v4760-access']='4.76.0';
