/* CASE OS v4.32.6 — company architecture, project portfolio and planned business lines. */
(function(){
  'use strict';
  if(window.CASE_OS_V490) return;
  window.CASE_OS_V490=true;

  var selectedProjects=[];
  var PLACEHOLDERS={
    project_handover:{title:'Передача между отделами',desc:'Сквозная передача проекта между Advisory, Leasing & Sales и Property & Asset Management.',items:['Контроль готовности этапа','Ответственные от каждого направления','Передаваемые документы и данные','Комментарии, решения и история передачи']},
    project_contracts:{title:'Договоры проектов',desc:'Единый реестр договоров CASE с клиентами и графиков оплаты по проектам.',items:['Договор и дополнительные соглашения','Этапы, стоимость и валюта','График счетов и оплат','Ответственный и статус исполнения']},
    advisory_research:{title:'Исследование рынка',desc:'Рабочее пространство Advisory для market research и конкурентного анализа.',items:['Методология исследования','Desk и field research','Конкуренты и рыночные показатели','Источники, QC и история обновлений']},
    advisory_concept:{title:'Концепция',desc:'Разработка коммерческой концепции проекта с участием Advisory и Leasing.',items:['Позиционирование и целевая аудитория','Функциональное зонирование','Категории и tenant mix','Версии концепции и согласования']},
    advisory_area:{title:'Программа площадей',desc:'Единая таблица GBA, GLA, категорий, этажей, блоков и подкатегорий.',items:['Площади по функциям и этажам','Связь с планировками','Связь с финансовой моделью','Формирование исходной структуры LCR']},
    advisory_business_plan:{title:'Бизнес-план',desc:'Формирование полного бизнес-плана на основе исследования, концепции и финансовой модели.',items:['Резюме проекта','Рынок и стратегия','Операционная модель','Финансы, риски и сценарии']},
    leasing_opening:{title:'Opening tracker',desc:'Контроль пути арендатора от подписания договора до фактического открытия.',items:['Дизайн и согласования','Fit-out и MEP требования','Передача помещения','Плановая и фактическая дата открытия']},
    manage_portfolio:{title:'Портфель управляемых объектов',desc:'Будущий единый список объектов под Facility, Property и Asset Management.',items:['Договор управления','Тип и объём услуги','Ответственная команда','Основные KPI объекта']},
    facility_management:{title:'Facility Management',desc:'Первый операционный продукт будущего направления управления объектами.',items:['Эксплуатация и инженерные системы','Клининг, охрана и подрядчики','SLA, заявки и аварии','Коммунальные расходы и отчётность']},
    equipment_registry:{title:'Оборудование и MEP',desc:'Реестр оборудования, технических характеристик, гарантий и обслуживания.',items:['Паспорта оборудования','Графики обслуживания','Гарантии и запасные части','История отказов и ремонтов']},
    maintenance:{title:'Заявки и обслуживание',desc:'Helpdesk, work orders, preventive maintenance и контроль SLA.',items:['Создание и назначение заявки','Приоритет и срок','Фото и акты выполнения','Аналитика времени реакции']},
    tenant_contracts:{title:'Арендаторы и договоры',desc:'Property Management Light: договоры, начисления, обращения и renewals.',items:['Карточка арендатора','Коммерческие условия','Начисления и задолженность','Продление и ротация']},
    asset_management:{title:'Asset Management',desc:'Стратегическое управление доходностью и стоимостью актива.',items:['Стратегия актива','Заполняемость и ставки','NOI, CAPEX и прогноз','Repositioning и owner decisions']},
    property_budget:{title:'Бюджет объекта',desc:'Операционный бюджет управляемого объекта без смешивания с внутренними финансами CASE.',items:['Доходы и OPEX','Service charge','План-факт и forecast','Версии и согласования']},
    noi_performance:{title:'NOI и эффективность',desc:'Коммерческие и финансовые показатели действующего объекта.',items:['NOI и маржинальность','Occupancy и collection rate','Tenant performance','Отклонения и прогноз']},
    capex_management:{title:'CAPEX',desc:'Планирование, согласование и контроль капитальных затрат объекта.',items:['CAPEX requests','Приоритет и бюджет','Согласование собственника','План-факт реализации']},
    owner_reports:{title:'Отчёты собственнику',desc:'Стандартизированная ежемесячная отчётность по управляемому объекту.',items:['Финансовые показатели','Leasing и occupancy','FM KPI и аварии','Риски, решения и план месяца']},
    finance_dashboard:{title:'Финансовый дашборд CASE',desc:'Консолидированный управленческий экран внутренних финансов компании.',items:['Деньги и cash flow','Доходы, расходы и прибыль','Дебиторка и обязательства','Прогноз и кассовые разрывы']},
    finance_income:{title:'Доходы компании',desc:'Доходы CASE по Advisory, Leasing, Management и цифровым продуктам.',items:['Договоры и этапы','Комиссии и management fees','Валюта, НДС и курс','Факт поступления и прогноз']},
    finance_expenses:{title:'Расходы компании',desc:'Расходы по отделам, проектам, категориям и центрам затрат.',items:['Прямые и административные расходы','Проект и бизнес-направление','Согласование платежа','Документы и история']},
    finance_invoices:{title:'Счета и платежи',desc:'Путь от выполненного этапа до счёта клиенту и фактической оплаты.',items:['График выставления счетов','Статусы оплаты','Частичные платежи','Напоминания и документы']},
    finance_receivables:{title:'Дебиторская задолженность',desc:'Контроль неоплаченных счетов клиентов и сроков взыскания.',items:['Срок оплаты и просрочка','Ответственный менеджер','История коммуникаций','Прогноз поступления']},
    finance_payables:{title:'Кредиторская задолженность',desc:'Обязательства CASE перед сотрудниками, подрядчиками и поставщиками.',items:['Срок и приоритет','Проект и центр затрат','Согласование','Статус оплаты']},
    finance_treasury:{title:'Казначейство и cash flow',desc:'Платёжный календарь и прогноз остатков денежных средств.',items:['Сегодня, 7, 30 и 90 дней','Ожидаемые поступления','Обязательные выплаты','Предупреждение кассовых разрывов']},
    finance_payroll:{title:'Зарплаты, бонусы и комиссии',desc:'Расчёт фиксированной оплаты, KPI, проектных бонусов и брокерских комиссий.',items:['Начислено и доступно к выплате','Связь с оплатой клиента','Настраиваемые формулы','История утверждений']},
    finance_project_pnl:{title:'Прибыльность проектов',desc:'Внутренний P&L CASE по каждому клиентскому проекту.',items:['Выручка проекта','Прямые расходы и часы','Распределённые overhead','Маржинальность и forecast']},
    finance_department_pnl:{title:'P&L бизнес-направлений',desc:'Отдельная экономика Advisory, Leasing & Sales и будущего Management.',items:['Внешняя выручка','Внутренний вклад','Прямые и общие расходы','Операционная прибыль направления']},
    finance_budget:{title:'Бюджет и план-факт',desc:'Годовой и месячный бюджет CASE по направлениям, проектам и статьям.',items:['Approved budget','Actual и latest forecast','Сценарии','История версий']},
    market_data:{title:'Рыночные данные',desc:'Редактируемая база ставок, предложения, сделок и показателей недвижимости.',items:['Коммерческая недвижимость','Жилая недвижимость','Источники и период','Дата обновления и QC']},
    macro_data:{title:'Макроэкономика',desc:'Редактируемые показатели стран, городов и регионов внутри центра аналитики.',items:['Население и экономика','Доходы и расходы','Рынок труда и миграция','Сравнение стран и городов']},
    data_quality:{title:'Качество и источники данных',desc:'Управление источниками, проверкой, дублями и актуальностью данных.',items:['Статус проверки','Дата последнего обновления','Confidence и точность','Очередь ручного контроля']},
    data_import_export:{title:'Импорт и экспорт данных',desc:'Единый контролируемый обмен данными по доступным разделам.',items:['CSV, Excel, JSON и GeoJSON','Шаблоны импорта','Предварительная проверка','История операций']},
    product_intelligence:{title:'CASE Intelligence',desc:'Будущий подписной продукт геоаналитики и рыночных данных.',items:['Тарифы и организации','Ограничения по подписке','Сохранённые карты и проекты','Экспорт, API и private layers']},
    product_market:{title:'CASE Market',desc:'Будущая публичная витрина объектов на продажу и в аренду.',items:['Коммерческие и инвестиционные объекты','Публичная карточка и карта','Лиды и назначение брокера','Продвижение и платные объявления']},
    product_living:{title:'CASE Living',desc:'Будущая платформа жилой недвижимости и продаж девелоперов.',items:['Жилые проекты и шахматка','Квартиры, цены и рассрочка','Лиды, бронь и сделки','Кабинет девелопера']},
    product_manage:{title:'CASE Manage',desc:'Будущий цифровой продукт Facility, Property и Asset Management.',items:['Кабинет собственника','Tenant / resident portal','FM и financial operations','Owner reporting']},
    product_subscriptions:{title:'Подписки и биллинг',desc:'Коммерческий контур SaaS-продуктов CASE OS.',items:['Тарифы и пробные периоды','Организации и пользователи','Оплата и лимиты','Продление и отключение доступа']},
    admin_workflows:{title:'Workflow и согласования',desc:'Настраиваемые этапы, RACI, лимиты и маршруты согласования.',items:['Шаблоны по типу проекта','Ответственные и approvers','Финансовые лимиты','История решений']},
    admin_directories:{title:'Справочники и категории',desc:'Централизованное управление типами проектов, категориями, статусами и полями.',items:['Бизнес-направления','Категории недвижимости','Этапы и статусы','Пользовательские поля']},
    admin_integrations:{title:'Интеграции',desc:'Будущие подключения к картам, бухгалтерии, платёжным и внешним системам.',items:['Карты и геоданные','Бухгалтерия и банки','Email и уведомления','API и webhooks']}
  };

  function lang(){try{return typeof LANG==='string'?LANG:'ru';}catch(e){return 'ru';}}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function moduleInfo(v){var a=window.CASE_OS_MODULES||[];for(var i=0;i<a.length;i++)if(a[i].v===v)return a[i];return null;}
  function moduleTitle(v){var m=moduleInfo(v);return m?(m[lang()]||m.ru||v):v;}
  function canEdit(){try{return !!(typeof R==='function'&&(R().edit||R().admin));}catch(e){return false;}}
  function isAdmin(){try{return !!(typeof R==='function'&&R().admin);}catch(e){return false;}}
  function persistNow(action,detail){try{if(typeof audit==='function'&&action)audit(action,detail||'');}catch(e){}try{if(typeof persist==='function')persist();}catch(e){}try{if(typeof apiSaveState==='function')apiSaveState();}catch(e){}}
  function csvCell(v){v=String(v==null?'':v);if(/^[=+\-@]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  function download(name,text,type){var b=new Blob([text],{type:type||'text/plain;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}

  function pageShell(title,sub,body){return '<div class="ph"><div><div class="case-v490-eye">CASE OS · v4.32.6</div><h1>'+h(title)+'</h1></div></div>'+(sub?'<p class="sub">'+h(sub)+'</p>':'')+body+(typeof footNote==='function'?footNote():'');}
  function plannedPage(v){
    var p=PLACEHOLDERS[v]||{title:moduleTitle(v),desc:'Раздел заложен в архитектуру CASE OS и будет активирован после утверждения бизнес-процесса и технического задания.',items:[]};
    var list=(p.items||[]).map(function(x){return '<li>'+h(x)+'</li>';}).join('');
    return pageShell(p.title,p.desc,'<div class="card case-planned"><div class="case-planned-top"><span class="case-status">ЗАПЛАНИРОВАНО</span><span class="mut">Функциональные данные пока не создаются</span></div><div class="case-planned-grid"><div><h3>Раздел подготовлен в меню</h3><p>Страница оставлена без фиктивной информации. После утверждения ТЗ она будет подключена к общей карточке проекта, задачам, правам и финансовому контуру CASE OS.</p></div><div><h3>Планируемый состав</h3><ul>'+list+'</ul></div></div></div>');
  }

  function projectStatus(o){return o.status||'active';}
  function projectLines(o){var a=Array.isArray(o.businessLines)?o.businessLines:[];if(!a.length){a=['Advisory'];if((o.gla||0)>0)a.push('Leasing & Sales');}return a;}
  function renderProjects(){
    var rows=(OBJECTS||[]).map(function(o){var checked=selectedProjects.indexOf(o.id)>=0;return '<tr data-case-project="'+h(o.id)+'"><td><input type="checkbox" '+(checked?'checked':'')+' onchange="caseProjectSelect(\''+h(o.id)+'\',this.checked)"></td><td><button class="case-link" onclick="caseProjectOpen(\''+h(o.id)+'\')"><b>'+h(o.name||o.ru||o.id)+'</b></button><div class="mut" style="font-size:10px">'+h(o.ru&&o.ru!==o.name?o.ru:'')+'</div></td><td>'+h(o.country||'—')+'</td><td>'+h(o.city||'—')+'</td><td>'+h(o.type||'—')+'</td><td>'+h(projectLines(o).join(' · '))+'</td><td>'+h((o.gba||0)?Number(o.gba).toLocaleString('ru-RU'):'—')+'</td><td>'+h((o.gla||0)?Number(o.gla).toLocaleString('ru-RU'):'—')+'</td><td><span class="case-project-status '+h(projectStatus(o))+'">'+h(projectStatus(o)==='archived'?'Архив':'Активный')+'</span></td><td><button class="btn ghost sm" onclick="caseProjectOpen(\''+h(o.id)+'\')">Открыть</button></td></tr>';}).join('');
    var tools='<div class="case-project-tools">'+(isAdmin()?'<button class="btn sm" onclick="addObjectForm()">+ Добавить проект</button><button class="btn ghost sm" onclick="caseProjectEditSelected()">✎ Изменить</button><button class="btn ghost sm" onclick="caseProjectArchiveSelected()">Архивировать</button>':'')+'<button class="btn ghost sm" onclick="caseProjectExport()">⬇ Экспорт</button>'+(isAdmin()?'<button class="btn ghost sm" onclick="caseProjectImport()">⬆ Импорт</button>':'')+'<span class="pill" id="caseProjectSelected">Выбрано: '+selectedProjects.length+'</span></div>';
    var kpis='<div class="case-project-kpis"><div><b>'+OBJECTS.length+'</b><span>всего проектов</span></div><div><b>'+OBJECTS.filter(function(o){return projectStatus(o)!=='archived';}).length+'</b><span>активных</span></div><div><b>'+OBJECTS.filter(function(o){return projectStatus(o)==='archived';}).length+'</b><span>в архиве</span></div><div><b>'+OBJECTS.filter(function(o){return projectLines(o).length>1;}).length+'</b><span>кросс-функциональных</span></div></div>';
    return pageShell('Проекты','Единый реестр проектов CASE: один проект используется всеми участвующими бизнес-направлениями.',kpis+'<div class="card">'+tools+'<div class="tbl-scroll"><table class="case-project-table"><thead><tr><th></th><th>Проект</th><th>Страна</th><th>Город</th><th>Тип</th><th>Бизнес-направления</th><th>GBA</th><th>GLA</th><th>Статус</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div>');
  }

  function analyticsHub(){
    var cards=[
      ['geoanalytics','◉','Геоаналитика','Объекты, категории, слои, фильтры и редактируемая база.','Доступно'],
      ['map','⌖','Карта / GIS','Карта проектов CASE и пространственный обзор портфеля.','Доступно'],
      ['bench','◈','Бенчмаркинг','Сравнение ставок, площадей и рыночных показателей.','Доступно'],
      ['market_data','▥','Рыночные данные','Единая база предложения, ставок и сделок по всем типам недвижимости.','План'],
      ['macro_data','◫','Макроэкономика','Показатели стран, городов и регионов с источниками и версиями.','План'],
      ['data_quality','✓','Качество данных','Проверка, источники, дубли, confidence и дата обновления.','План']
    ];
    var html=cards.filter(function(c){return !window.caseFeatureEnabled||window.caseFeatureEnabled(c[0]);}).map(function(c){var state=window.caseFeatureStatus?window.caseFeatureStatus(c[0]):'active',tag=state==='beta'?'BETA':c[4];return '<button class="case-hub-card" onclick="go(\''+c[0]+'\')"><span class="case-hub-icon">'+c[1]+'</span><span><b>'+h(c[2])+'</b><small>'+h(c[3])+'</small></span><em class="'+(tag==='Доступно'?'live':'')+'">'+tag+'</em></button>';}).join('');
    return pageShell('Центр аналитики','Единая аналитика для Advisory, Leasing, Management и будущих подписчиков CASE Intelligence.','<div class="case-hub-grid">'+html+'</div><div class="card"><h3>Принцип новой аналитики</h3><p style="margin:0;color:var(--muted);font-size:12px">Сравнение стран больше не является отдельным разовым разделом. Оно войдёт в редактируемую макроэкономику. Аналитика будет работать по всем категориям недвижимости и бизнеса, а каждый показатель получит источник, период, дату обновления и статус проверки.</p></div>');
  }

  function renderRoute(v){if(v==='case_projects')return renderProjects();if(v==='analytics_hub')return analyticsHub();return plannedPage(v);}
  function displayRoute(v){
    try{S.view=v;S._focus=null;}catch(e){}
    document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v===v);});
    var side=document.getElementById('side'),scrim=document.getElementById('scrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('open');
    var main=document.getElementById('main');if(main)main.innerHTML=renderRoute(v);
    try{if(typeof localize==='function')localize();}catch(e){}
    try{if(typeof syncTblScroll==='function')syncTblScroll();}catch(e){}
    try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}
  }

  window.caseProjectSelect=function(id,on){var i=selectedProjects.indexOf(id);if(on&&i<0)selectedProjects.push(id);if(!on&&i>=0)selectedProjects.splice(i,1);var e=document.getElementById('caseProjectSelected');if(e)e.textContent='Выбрано: '+selectedProjects.length;};
  window.caseProjectOpen=function(id){var o=(OBJECTS||[]).find(function(x){return x.id===id;});if(!o)return;S.obj=id;try{if(typeof rebuildObjSel==='function')rebuildObjSel();}catch(e){}go('dash');};
  window.caseProjectEditSelected=function(){if(selectedProjects.length!==1){alert('Выберите галочкой один проект.');return;}if(typeof addObjectForm==='function')addObjectForm(selectedProjects[0]);};
  window.caseProjectArchiveSelected=function(){if(!selectedProjects.length){alert('Выберите один или несколько проектов.');return;}var archived=0;selectedProjects.forEach(function(id){var o=OBJECTS.find(function(x){return x.id===id;});if(o){o.status=o.status==='archived'?'active':'archived';archived++;}});persistNow('Статус проектов','изменено: '+archived);selectedProjects=[];displayRoute('case_projects');};
  window.caseProjectExport=function(){var cols=['id','name','ru','country','city','type','gba','gla','status','businessLines'];var lines=[cols.join(',')].concat((OBJECTS||[]).map(function(o){return cols.map(function(k){return csvCell(k==='businessLines'?projectLines(o).join('|'):(o[k]??''));}).join(',');}));download('CASE_OS_projects_'+new Date().toISOString().slice(0,10)+'.csv','\uFEFF'+lines.join('\n'),'text/csv;charset=utf-8');};
  function parseCSV(text){var rows=[],row=[],cell='',q=false;for(var i=0;i<text.length;i++){var ch=text[i];if(q){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(ch!=='\r')cell+=ch;}row.push(cell);if(row.some(function(x){return x!=='';}))rows.push(row);return rows;}
  window.caseProjectImport=function(){var inp=document.createElement('input');inp.type='file';inp.accept='.csv,.json,application/json,text/csv';inp.onchange=function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var incoming=[];if(/\.json$/i.test(f.name)){var j=JSON.parse(r.result);incoming=Array.isArray(j)?j:(Array.isArray(j.OBJECTS)?j.OBJECTS:[]);}else{var rows=parseCSV(String(r.result).replace(/^\uFEFF/,''));var head=(rows.shift()||[]).map(function(x){return x.trim();});incoming=rows.map(function(a){var o={};head.forEach(function(k,i){o[k]=a[i]||'';});return o;});}if(!incoming.length)throw new Error('Нет проектов для импорта');var added=0,updated=0;incoming.forEach(function(x){var name=String(x.name||x.ru||'').trim();if(!name)return;var id=String(x.id||'').trim();var old=(id&&OBJECTS.find(function(o){return o.id===id;}))||OBJECTS.find(function(o){return String(o.name).toLowerCase()===name.toLowerCase();});var target=old||{};['name','ru','country','city','type','status'].forEach(function(k){if(x[k]!==undefined&&x[k]!=='')target[k]=String(x[k]);});['gba','gla'].forEach(function(k){if(x[k]!==undefined&&x[k]!=='')target[k]=+x[k]||0;});if(x.businessLines)target.businessLines=String(x.businessLines).split('|').map(function(s){return s.trim();}).filter(Boolean);if(!old){target.id=id||('p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5));target.plan=target.plan||'Свой объект';target.sc=target.sc||10;target.inc=target.inc||5;target.cur=target.cur||'сумах по курсу ЦБ РУз';target.cond=target.cond||'shell & core';target.levels=target.levels||'single';target.vat=target.vat||'incl';target.vatRate=target.vatRate||12;target.comm=target.comm||{type:'flat',total:8,note:'8% годовой аренды'};OBJECTS.push(target);added++;}else updated++;});persistNow('Импорт проектов','добавлено '+added+', обновлено '+updated);try{if(typeof rebuildObjSel==='function')rebuildObjSel();}catch(e2){}alert('Импорт завершён. Добавлено: '+added+', обновлено: '+updated);displayRoute('case_projects');}catch(ex){alert('Ошибка импорта: '+(ex&&ex.message||ex));}};r.readAsText(f,'utf-8');};inp.click();};

  function patchBrand(){
    document.title='CASE OS — Company & Real Estate Operating System';
    var md=document.querySelector('meta[name="description"]');if(md)md.content='CASE OS — company and real estate operating system for Advisory, Leasing, Analytics, Management and Finance.';
    var ma=document.querySelector('meta[name="apple-mobile-web-app-title"]');if(ma)ma.content='CASE OS';
    var lg=document.querySelector('.lg');if(lg)lg.innerHTML='<span class="c">CASE</span> OS';
    var brand=document.querySelector('.brand');if(brand)brand.innerHTML='<span><span class="c">CASE</span> OS</span><span class="tag">Company & Real Estate Operating System</span>';
  }
  function css(){if(document.getElementById('case490css'))return;var s=document.createElement('style');s.id='case490css';s.textContent=
    '.case-v490-eye{font-size:9px;color:var(--red-d);font-weight:900;letter-spacing:.12em;margin-bottom:3px}.case-planned{border:1px dashed #c9c1b7;background:linear-gradient(135deg,var(--panel),var(--soft))}.case-planned-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px}.case-status{font-size:9px;font-weight:900;letter-spacing:.12em;border:1px solid #d5b163;color:#7c5b10;background:#fff8dc;border-radius:999px;padding:5px 8px}.case-planned-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.case-planned-grid h3{margin:0 0 7px}.case-planned-grid p,.case-planned-grid li{font-size:12px;color:var(--muted);line-height:1.55}.case-planned-grid ul{margin:0;padding-left:18px}.case-project-tools{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.case-project-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 12px}.case-project-kpis>div{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:13px}.case-project-kpis b{display:block;font-size:22px;color:var(--red-d)}.case-project-kpis span{font-size:10px;color:var(--muted)}.case-link{border:0;background:none;padding:0;color:var(--ink);font:inherit;text-align:left;cursor:pointer}.case-link:hover{color:var(--red-d)}.case-project-status{display:inline-block;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:800;background:#e7f4e8;color:#276535}.case-project-status.archived{background:#eee;color:#666}.case-hub-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.case-hub-card{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:start;text-align:left;border:1px solid var(--border);border-radius:13px;background:var(--panel);color:var(--ink);padding:14px;font-family:inherit;cursor:pointer}.case-hub-card:hover{border-color:var(--red);transform:translateY(-1px)}.case-hub-icon{font-size:22px;color:var(--red-d)}.case-hub-card b,.case-hub-card small{display:block}.case-hub-card small{font-size:10px;color:var(--muted);line-height:1.4;margin-top:4px}.case-hub-card em{font-style:normal;font-size:8px;font-weight:900;border:1px solid var(--border);border-radius:999px;padding:4px 6px;color:var(--muted)}.case-hub-card em.live{background:#e7f4e8;color:#276535;border-color:#b9d9bd}@media(max-width:1000px){.case-hub-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.case-project-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.case-planned-grid,.case-hub-grid{grid-template-columns:1fr}.case-project-kpis{grid-template-columns:1fr 1fr}}';document.head.appendChild(s);}

  function install(){
    css();patchBrand();
    var futureIds=Object.keys(PLACEHOLDERS).concat(['case_projects','analytics_hub']);
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._case480){window.go=function(v){if(futureIds.indexOf(v)>=0){if(typeof window.caseWorkspaceCanOpen==='function'&&!window.caseWorkspaceCanOpen(v)){var target=typeof window.asaasWorkspaceFirst==='function'?window.asaasWorkspaceFirst():'dash';return oldGo.call(this,target);}displayRoute(v);return;}return oldGo.call(this,v);};window.go._case480=true;}
    window.renderCaseOSRoute=displayRoute;
    try{if(typeof S!=='undefined'&&futureIds.indexOf(S.view)>=0)displayRoute(S.view);}catch(e){}
    try{if(typeof buildNav==='function')buildNav();}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(install,0);},{once:true});else setTimeout(install,0);
})();
