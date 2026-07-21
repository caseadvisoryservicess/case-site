/* CASE OS v4.9.3 — In-app section guides.
   Одна кнопка «?» в шапке открывает иллюстрированную инструкцию текущего раздела в модальном
   окне. Заменяет разрозненные многословные описания-подписи внутри разделов (замечание CEO). */
(function(){
  'use strict';
  if(window.ASAAS_GUIDES_V450) return; window.ASAAS_GUIDES_V450=true;
  function lang(){try{return typeof LANG==='string'?LANG:'ru';}catch(e){return 'ru';}}
  function T(ru,uz,en){return lang()==='uz'?(uz||ru):(lang()==='en'?(en||ru):ru);}
  function escp(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  // мини-иллюстрации (inline SVG) — schematic, без внешних картинок (работает офлайн/CSP)
  var ICON={
    map:'<svg viewBox="0 0 120 70" width="120" height="70"><rect width="120" height="70" rx="6" fill="#eef3f0"/><path d="M8 55 L40 12 L74 40 L112 8" fill="none" stroke="#0d7a6f" stroke-width="2.5"/><circle cx="40" cy="12" r="5" fill="#9E0000"/><circle cx="74" cy="40" r="5" fill="#0d7a6f"/><circle cx="30" cy="45" r="4" fill="#2f77b6"/><circle cx="90" cy="25" r="4" fill="#e67e22"/></svg>',
    layers:'<svg viewBox="0 0 120 70" width="120" height="70"><g fill="none" stroke="#7a0000" stroke-width="2"><rect x="18" y="34" width="84" height="20" rx="3" fill="#faf2f2"/><rect x="26" y="24" width="84" height="20" rx="3" fill="#fff"/><rect x="34" y="14" width="84" height="20" rx="3" fill="#fff"/></g><rect x="40" y="19" width="9" height="9" rx="2" fill="#0d7a6f"/></svg>',
    cluster:'<svg viewBox="0 0 120 70" width="120" height="70"><rect width="120" height="70" rx="6" fill="#eef3f0"/><circle cx="42" cy="34" r="15" fill="rgba(158,0,0,.25)"/><circle cx="42" cy="34" r="10" fill="rgba(158,0,0,.8)"/><text x="42" y="38" font-size="9" fill="#fff" text-anchor="middle" font-family="Arial">57</text><circle cx="86" cy="24" r="4" fill="#9E0000"/><circle cx="94" cy="40" r="4" fill="#9E0000"/></svg>',
    slider:'<svg viewBox="0 0 120 70" width="120" height="70"><rect x="10" y="18" width="100" height="6" rx="3" fill="#e3e3e3"/><circle cx="70" cy="21" r="8" fill="#9E0000"/><rect x="10" y="40" width="100" height="6" rx="3" fill="#e3e3e3"/><circle cx="40" cy="43" r="8" fill="#9E0000"/></svg>',
    form:'<svg viewBox="0 0 120 70" width="120" height="70"><rect width="120" height="70" rx="6" fill="#f6f6f7"/><rect x="12" y="12" width="60" height="9" rx="2" fill="#fff" stroke="#ccc"/><rect x="12" y="27" width="96" height="9" rx="2" fill="#fff" stroke="#ccc"/><rect x="12" y="46" width="40" height="13" rx="3" fill="#9E0000"/></svg>',
    table:'<svg viewBox="0 0 120 70" width="120" height="70"><rect width="120" height="70" rx="6" fill="#fff" stroke="#e3e3e3"/><rect x="0" y="0" width="120" height="14" fill="#faf2f2"/><g stroke="#eee"><line x1="0" y1="30" x2="120" y2="30"/><line x1="0" y1="44" x2="120" y2="44"/><line x1="0" y1="58" x2="120" y2="58"/><line x1="40" y1="14" x2="40" y2="70"/><line x1="80" y1="14" x2="80" y2="70"/></g></svg>',
    calc:'<svg viewBox="0 0 120 70" width="120" height="70"><rect x="20" y="6" width="80" height="58" rx="6" fill="#faf2f2" stroke="#9E0000"/><rect x="28" y="12" width="64" height="14" rx="2" fill="#fff"/><g fill="#9E0000"><rect x="28" y="32" width="14" height="10" rx="2"/><rect x="48" y="32" width="14" height="10" rx="2"/><rect x="68" y="32" width="14" height="10" rx="2"/><rect x="28" y="46" width="14" height="10" rx="2"/><rect x="48" y="46" width="14" height="10" rx="2"/><rect x="68" y="46" width="14" height="10" rx="2"/></g></svg>',
    lift:'<svg viewBox="0 0 120 70" width="120" height="70"><rect x="46" y="6" width="28" height="58" rx="3" fill="#eef3f0" stroke="#0d7a6f"/><line x1="60" y1="6" x2="60" y2="64" stroke="#0d7a6f"/><path d="M53 22 l7-7 7 7" fill="none" stroke="#9E0000" stroke-width="2"/><path d="M53 48 l7 7 7-7" fill="none" stroke="#9E0000" stroke-width="2"/></svg>',
    doc:'<svg viewBox="0 0 120 70" width="120" height="70"><rect x="34" y="6" width="52" height="58" rx="4" fill="#fff" stroke="#ccc"/><g stroke="#9E0000" stroke-width="2"><line x1="44" y1="20" x2="76" y2="20"/><line x1="44" y1="30" x2="76" y2="30"/><line x1="44" y1="40" x2="66" y2="40"/></g></svg>',
    chart:'<svg viewBox="0 0 120 70" width="120" height="70"><g fill="#9E0000"><rect x="18" y="38" width="14" height="24"/><rect x="40" y="26" width="14" height="36"/><rect x="62" y="16" width="14" height="46"/><rect x="84" y="30" width="14" height="32"/></g></svg>'
  };
  function step(icon,title,text){return '<div class="gd-step"><div class="gd-illu">'+(ICON[icon]||'')+'</div><div class="gd-txt"><b>'+escp(title)+'</b><span>'+escp(text)+'</span></div></div>';}

  // Гиды по разделам. Ключ = view (S.view). Каждый — заголовок + шаги.
  function GUIDE(v){
    var L=lang();
    var G={
      geoanalytics:{t:T('Геоаналитика','Geoanalitika','Geoanalytics'),s:[
        step('layers',T('Слои по категориям','Kategoriyalar','Layers by category'),T('Слева — единый список слоёв по категориям (Бизнес-центры, HoReCa, Ритейл, Медицина, Досуг, Образование, Жильё, Услуги, Инфраструктура, Границы). Поставьте галочку — слой появится на карте.','Chapda — kategoriyalar boʻyicha qatlamlar roʻyxati. Belgilang — qatlam xaritada koʻrinadi.','On the left — one categorized layer list. Tick a layer to show it on the map.')),
        step('slider',T('Настройки каждого слоя','Har bir qatlam sozlamalari','Per-layer settings'),T('У каждой категории одинаковый набор: цвет, размер точки, прозрачность, подписи и размер подписи. Стрит-ритейл дополнительно делится на товарные подкатегории.','Har bir kategoriyada bir xil sozlamalar: rang, oʻlcham, shaffoflik, yozuvlar.','Every category has the same set: colour, point size, opacity, labels and label size. Street-retail also splits into product sub-categories.')),
        step('cluster',T('Кластеризация','Klasterlash','Clustering'),T('Много точек группируются в кластеры (красные кружки с числом). Приблизьте карту — кластеры распадаются на отдельные точки с подписями.','Koʻp nuqtalar klasterlarga birlashadi. Yaqinlashtiring — alohida nuqtalarga ajraladi.','Many points group into clusters (red circles with a count). Zoom in — clusters split into individual points with labels.')),
        step('map',T('Живая загрузка из OSM','OSM dan yuklash','Live OSM fetch'),T('При включении пустого слоя платформа сама подтягивает реальные объекты с координатами из OpenStreetMap (до 2000 на категорию) в границах карты.','Boʻsh qatlamni yoqsangiz, platforma OpenStreetMap dan haqiqiy obyektlarni yuklaydi.','Enabling an empty layer auto-fetches real geocoded objects from OpenStreetMap (up to 2000/category) within the map view.'))
      ]},
      mep:{t:T('MEP-калькулятор','MEP kalkulyator','MEP calculator'),s:[
        step('form',T('Добавьте помещения','Xonalarni qoʻshing','Add spaces'),T('Выберите тип деятельности и площадь, нажмите «Добавить». Можно добавить несколько помещений — нагрузки суммируются по объекту.','Faoliyat turi va maydonni tanlang, «Qoʻshish». Bir nechta xona qoʻshsa boʻladi.','Pick an activity type and area, click Add. Add several spaces — loads sum up per building.')),
        step('calc',T('Смотрите нагрузки','Yuklamalarni koʻring','See the loads'),T('Плитки показывают: охлаждение, присоединённую эл. мощность, отопление, свежий воздух и воду. Ниже — норма по выбранному типу с источником.','Plitalar: sovutish, elektr quvvati, isitish, havo, suv. Quyida — norma manbasi.','Tiles show cooling, connected power, heating, fresh air and water. Below — the norm for the selected type with source.')),
        step('doc',T('Сформируйте ТЗ','TZ shakllantiring','Generate the brief'),T('Кнопка «Сформировать ТЗ» создаёт черновик технического задания по инженерным сетям для Advisory/лизинга. Экспорт в CSV — рядом.','«TZ shakllantirish» — muhandislik tarmoqlari boʻyicha texnik topshiriq qoralamasi.','“Generate brief” creates a draft MEP technical brief for Advisory/leasing. CSV export is next to it.'))
      ]},
      lift:{t:T('Калькулятор лифтов','Lift kalkulyatori','Lift calculator'),s:[
        step('form',T('Задайте параметры','Parametrlarni kiriting','Set parameters'),T('Тип здания, этажность, число и вместимость кабин, скорость, тип дверей и население (напрямую или из площади).','Bino turi, qavatlar, kabinalar soni/sigʻimi, tezlik, eshik turi, aholi.','Building type, floors, number & capacity of cars, speed, door type and population (direct or from area).')),
        step('lift',T('Читайте результат','Natijani oʻqing','Read the result'),T('Интервал (INT) и провозная способность за 5 минут (%) с вердиктом «отлично / приемлемо / недостаточно» против нормы для типа здания.','Interval va 5 daqiqalik oʻtkazuvchanlik — bino turi normasi bilan taqqoslab.','Interval (INT) and 5-min handling capacity (%) with an “excellent / acceptable / insufficient” verdict against the building-type norm.')),
        step('chart',T('Подбирайте конфигурацию','Konfiguratsiyani tanlang','Tune the config'),T('Меняйте число лифтов, скорость и вместимость — показатели пересчитываются мгновенно. Методика — CIBSE Guide D (up-peak).','Liftlar soni/tezligi/sigʻimini oʻzgartiring — natija darhol qayta hisoblanadi.','Change the number of lifts, speed and capacity — metrics recompute instantly. Method — CIBSE Guide D (up-peak).'))
      ]},
      feasibility:{t:T('Финансовая модель','Moliyaviy model','Financial model'),s:[
        step('calc',T('Инвестиционная оценка','Investitsion baholash','Investment appraisal'),T('Оценка ТЦ, гостиниц, БЦ и mixed-use проектов: доходы, затраты, NOI, доходность.','Savdo markazi, mehmonxona, BM va mixed-use loyihalari baholash.','Appraise malls, hotels, offices and mixed-use: revenue, costs, NOI, returns.')),
        step('doc',T('Сценарии и версии','Ssenariylar','Scenarios & versions'),T('Сохраняйте сценарии по проекту, ведите версии и статусы (черновик/на проверке/утверждено).','Ssenariylarni saqlang, versiya va holatlarni yuriting.','Save scenarios per project, keep versions and statuses (draft/review/approved).'))
      ]},
      registry:{t:T('Реестр (LCR)','Reyestr','Registry'),s:[
        step('table',T('Единый реестр помещений','Yagona reyestr','Unified registry'),T('Все помещения объекта: аренда, статус, брокер, даты. Клик по заголовку — сортировка, поля под заголовками — фильтр.','Barcha xonalar: ijara, holat, broker, sanalar. Sarlavha — saralash, filtr.','All units: rent, status, broker, dates. Click a header to sort, fields under headers to filter.')),
        step('form',T('Редактирование','Tahrirlash','Editing'),T('Откройте карточку помещения для правок; изменения сохраняются в общую базу с учётом прав роли.','Xona kartasini oching; oʻzgarishlar umumiy bazaga saqlanadi.','Open a unit card to edit; changes save to the shared database per role rights.'))
      ]},
      brands:{t:T('Бренды','Brendlar','Brands'),s:[
        step('table',T('База брендов','Brendlar bazasi','Brand database'),T('Каталог ритейлеров: формат, требования, площадь, контакты. Поиск и фильтры сверху.','Riteylerlar katalogi: format, talablar, maydon, kontaktlar.','Retailer catalog: format, requirements, area, contacts. Search and filters on top.')),
        step('doc',T('Профиль ритейлера','Riteyler profili','Retailer profile'),T('Экспорт профиля ритейлера в PPTX; импорт брендов из Excel/CSV.','Riteyler profilini PPTX ga eksport; Excel/CSV dan import.','Export a retailer profile to PPTX; import brands from Excel/CSV.'))
      ]},
      dates:{t:T('Критические даты','Muhim sanalar','Critical dates'),s:[
        step('doc',T('Контроль сроков','Muddatlar nazorati','Deadline control'),T('Ключевые даты договоров и проектов с алертами о приближении и просрочке.','Shartnoma va loyiha sanalari, ogohlantirishlar bilan.','Key contract & project dates with approaching/overdue alerts.'))
      ]},
      plans:{t:T('Планировки','Planirovkalar','Floor plans'),s:[
        step('map',T('Планы этажей','Qavat rejalari','Floor plans'),T('Загрузка чертежей, создание помещений из плана, привязка к реестру.','Chizmalarni yuklash, rejadan xonalar yaratish.','Upload drawings, create units from the plan, link to the registry.'))
      ]},
      docs:{t:T('Документы','Hujjatlar','Documents'),s:[
        step('doc',T('Документы сделок','Bitim hujjatlari','Deal documents'),T('Формирование КП и документов, выгрузка в Word (.doc).','KP va hujjatlarni shakllantirish, Word (.doc) ga eksport.','Generate proposals and documents, export to Word (.doc).'))
      ]},
      kpi:{t:T('KPI и комиссии','KPI','KPI & commissions'),s:[
        step('chart',T('Показатели и комиссии','Koʻrsatkichlar','Metrics & commissions'),T('KPI по агентам и отделу, расчёт комиссий по проектам и сделкам.','Agentlar va boʻlim KPI, komissiyalar.','KPI by agent and department, commission calc per project and deal.'))
      ]},
      map:{t:T('Карта / GIS','Xarita / GIS','Map / GIS'),s:[
        step('map',T('Карта портфеля','Portfel xaritasi','Portfolio map'),T('Объекты портфеля на карте с быстрым скорингом локации по клику.','Portfel obyektlari xaritada.','Portfolio objects on the map with quick location scoring on click.'))
      ]},
      users:{t:T('Пользователи','Foydalanuvchilar','Users'),s:[
        step('form',T('Учётные записи','Hisoblar','Accounts'),T('Создание пользователей, назначение ролей и паролей, права по разделам.','Foydalanuvchilar, rollar, parollar.','Create users, assign roles and passwords, per-section rights.'))
      ]}
    };
    return G[v]||null;
  }

  function css(){
    if(document.getElementById('gdCss'))return;
    var s=document.createElement('style');s.id='gdCss';
    s.textContent='#gdBg{position:fixed;inset:0;background:rgba(20,10,10,.5);z-index:99998;display:none}#gdBg.open{display:block}'
      +'#gdModal{position:fixed;z-index:99999;top:50%;left:50%;transform:translate(-50%,-50%);width:min(680px,92vw);max-height:88vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.35);display:none}#gdModal.open{display:block}'
      +'#gdModal .gd-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;border-radius:14px 14px 0 0}'
      +'#gdModal .gd-h b{font-size:16px;color:#7a0000}#gdModal .gd-h .gd-x{border:none;background:#f2f2f2;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px}'
      +'#gdModal .gd-body{padding:8px 18px 18px}'
      +'.gd-step{display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #f2f2f2}.gd-step:last-child{border-bottom:none}'
      +'.gd-illu{flex:0 0 120px}.gd-illu svg{border-radius:8px;background:#fbfbfb}'
      +'.gd-txt{display:flex;flex-direction:column;gap:3px}.gd-txt b{font-size:13.5px}.gd-txt span{font-size:12.5px;color:#555;line-height:1.5}'
      +'.gd-foot{padding:10px 18px 16px;color:#888;font-size:11.5px}'
      +'body.dark #gdModal{background:#1e1e1e;color:#eee}body.dark #gdModal .gd-h{background:#1e1e1e;border-color:#333}body.dark #gdModal .gd-h .gd-x{background:#333;color:#eee}body.dark .gd-txt span{color:#bbb}body.dark .gd-step{border-color:#2c2c2c}';
    document.head.appendChild(s);
  }
  function ensureDom(){
    if(document.getElementById('gdModal'))return;
    var bg=document.createElement('div');bg.id='gdBg';bg.onclick=closeGuide;document.body.appendChild(bg);
    var m=document.createElement('div');m.id='gdModal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby','gdTitle');m.setAttribute('tabindex','-1');document.body.appendChild(m);
  }
  // Человеко-читаемое имя раздела (для заголовка и когда для view нет своего гида) — из
  // навигации; fallback — общий «Инструкция».
  function viewName(v){
    try{var a=document.querySelector('#nav a[data-v="'+v+'"]');if(a){var t=(a.textContent||'').trim();if(t)return t.replace(/\s+/g,' ');}}catch(e){}
    return null;
  }
  var lastFocus=null;
  function focusable(m){return [].slice.call(m.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(function(el){return !el.disabled&&el.offsetParent!==null;});}
  window.openGuide=function(v){
    css();ensureDom();
    var g=GUIDE(v);
    var titleName=g?g.t:(viewName(v)||T('Инструкция','Yoʻriqnoma','Guide'));
    if(!g){g={t:titleName,s:[step('doc',T('Раздел платформы','Platforma boʻlimi','Platform section'),T('Для этого раздела пошаговая инструкция ещё готовится. Наведите на элементы — у большинства есть всплывающие подсказки.','Bu boʻlim uchun yoʻriqnoma tayyorlanmoqda.','A step-by-step guide for this section is being prepared. Hover elements — most have tooltips.'))]};}
    // заголовок диалога: «<раздел> — инструкция», но без дублирования, если это уже общий «Инструкция»
    var generic=T('Инструкция','Yoʻriqnoma','Guide');
    var heading=(titleName===generic)?generic:(titleName+' — '+T('инструкция','yoʻriqnoma','guide'));
    var m=document.getElementById('gdModal');
    lastFocus=document.activeElement;
    m.innerHTML='<div class="gd-h"><b id="gdTitle">'+escp(heading)+'</b><button class="gd-x" aria-label="'+escp(T('Закрыть','Yopish','Close'))+'" onclick="closeGuide()">✕</button></div>'
      +'<div class="gd-body">'+g.s.join('')+'</div>'
      +'<div class="gd-foot">'+escp(T('Подсказка: у большинства кнопок и полей есть всплывающие подсказки при наведении.','Maslahat: koʻpchilik tugmalarda hover-maslahatlar bor.','Tip: most buttons and fields have hover tooltips.'))+'</div>';
    document.getElementById('gdBg').classList.add('open');m.classList.add('open');
    try{document.body.style.overflow='hidden';}catch(e){}
    // фокус уводим в модаль (на заголовок) — чтобы клавиатура работала внутри диалога, а не на фоне
    setTimeout(function(){try{m.focus();var f=focusable(m);if(f.length)f[0].focus();}catch(e){}},0);
  };
  window.closeGuide=function(){
    var m=document.getElementById('gdModal'),b=document.getElementById('gdBg');
    if(m)m.classList.remove('open');if(b)b.classList.remove('open');
    try{document.body.style.overflow='';}catch(e){}
    try{if(lastFocus&&lastFocus.focus)lastFocus.focus();}catch(e){}
    lastFocus=null;
  };
  function isOpen(){var m=document.getElementById('gdModal');return m&&m.classList.contains('open');}
  document.addEventListener('keydown',function(e){
    if(!isOpen())return;
    if(e.key==='Escape'){closeGuide();return;}
    if(e.key==='Tab'){ // ловушка фокуса внутри диалога
      var m=document.getElementById('gdModal');var f=focusable(m);if(!f.length)return;
      var first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      else if(f.indexOf(document.activeElement)<0){e.preventDefault();first.focus();}
    }
  });
})();
