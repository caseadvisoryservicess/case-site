/* CASE OS v4.9.3 — configurable company workspaces.
   Roles are templates only. An administrator decides which module each role/user sees.
   No business module is hard-coded to a role. */
(function(){
  'use strict';
  if(window.CASE_WORKSPACES_480) return;
  window.CASE_WORKSPACES_480=true;

  var MODULES=[
    {v:'dash',g:'mywork',icon:'▦',ru:'Главный экран',uz:'Bosh ekran',en:'Home',nav:true},
    {v:'crm_clients',g:'mywork',icon:'◉',ru:'Клиенты',uz:'Mijozlar',en:'Clients',nav:true},
    {v:'case_projects',g:'mywork',icon:'◆',ru:'Все проекты',uz:'Barcha loyihalar',en:'All projects',nav:true},
    {v:'v32_action',g:'mywork',icon:'◎',ru:'Центр действий',uz:'Harakatlar markazi',en:'Action center',nav:true},
    {v:'dates',g:'mywork',icon:'⏰',ru:'Критические даты',uz:'Muhim sanalar',en:'Critical dates',nav:true},
    {v:'work_tasks',g:'mywork',icon:'✓',ru:'Мои задачи',uz:'Mening vazifalarim',en:'My tasks',nav:true},
    {v:'work_kanban',g:'mywork',icon:'▥',ru:'Мой Kanban',uz:'Mening Kanbanim',en:'My Kanban',nav:true},
    {v:'workload',g:'mywork',icon:'◫',ru:'Загрузка команды',uz:'Jamoa yuklamasi',en:'Team workload',nav:true},
    {v:'work_approvals',g:'mywork',icon:'◎',ru:'Мои согласования',uz:'Mening tasdiqlarim',en:'My approvals',nav:true},

    {v:'project_workspace',g:'projects',icon:'▦',ru:'Рабочий стол проекта',uz:'Loyiha ish stoli',en:'Project workspace',nav:false},
    {v:'project_layouts',g:'projects',icon:'▭',ru:'Планировки и версии',uz:'Planirovkalar va versiyalar',en:'Layouts and versions',nav:false},
    {v:'project_handover',g:'projects',icon:'⇄',ru:'Передача между отделами',uz:'Bo‘limlararo topshirish',en:'Department handover',nav:true,future:true},
    {v:'project_contracts',g:'projects',icon:'▣',ru:'Договоры проектов',uz:'Loyiha shartnomalari',en:'Project contracts',nav:true,future:true},
    {v:'docs',g:'projects',icon:'▤',ru:'Документы',uz:'Hujjatlar',en:'Documents',nav:false},

    {v:'advisory_pipeline',g:'advisory',icon:'⇢',ru:'Воронка Advisory',uz:'Advisory voronkasi',en:'Advisory pipeline',nav:true},
    {v:'advisory_proposal_builder',g:'advisory',icon:'✎',ru:'Конструктор КП',uz:'TK konstruktori',en:'Proposal builder',nav:true},
    {v:'advisory_proposals',g:'advisory',icon:'▧',ru:'Реестр КП',uz:'TK reyestri',en:'Commercial proposals',nav:true},
    {v:'advisory_portfolio_map',g:'advisory',icon:'⌖',ru:'Карта проектов Advisory',uz:'Advisory loyihalari xaritasi',en:'Advisory project map',nav:true},
    {v:'advisory_contracts',g:'advisory',icon:'▣',ru:'Договоры Advisory',uz:'Advisory shartnomalari',en:'Advisory contracts',nav:true},
    {v:'advisory_scope',g:'advisory',icon:'☷',ru:'Объём работ (Scope)',uz:'Ish hajmi (Scope)',en:'Scope of Work',nav:true},
    {v:'advisory_delivery',g:'advisory',icon:'✓',ru:'Выполнение проектов',uz:'Loyihalarni bajarish',en:'Project delivery',nav:true},
    {v:'advisory_reports',g:'advisory',icon:'▤',ru:'Отчёты проектов',uz:'Loyiha hisobotlari',en:'Draft and final reports',nav:true},
    {v:'advisory_cross_sell',g:'advisory',icon:'↗',ru:'Следующие услуги',uz:'Keyingi xizmatlar',en:'Next services',nav:true},
    {v:'advisory_research',g:'advisory',icon:'◈',ru:'Исследование рынка',uz:'Bozor tadqiqoti',en:'Market research',nav:true,future:true},
    {v:'advisory_concept',g:'advisory',icon:'✦',ru:'Концепция',uz:'Konsepsiya',en:'Concept development',nav:true,future:true},
    {v:'advisory_area',g:'advisory',icon:'▥',ru:'Программа площадей',uz:'Maydonlar dasturi',en:'Area programme',nav:true,future:true},
    {v:'feasibility',g:'advisory',icon:'∑',ru:'Финансовая модель',uz:'Moliyaviy model',en:'Project financial model',nav:true},
    {v:'advisory_business_plan',g:'advisory',icon:'▧',ru:'Бизнес-план',uz:'Biznes-reja',en:'Business plan',nav:true,future:true},
    {v:'mep',g:'advisory',icon:'⚡',ru:'MEP / техзадание',uz:'MEP / texnik topshiriq',en:'MEP / technical brief',nav:true},
    {v:'lift',g:'advisory',icon:'⇅',ru:'Расчёт лифтов',uz:'Lift hisobi',en:'Lift calculation',nav:true},

    {v:'leasing_portfolio_map',g:'leasing',icon:'⌖',ru:'Карта объектов',uz:'Obyektlar xaritasi',en:'Asset map',nav:true},
    {v:'plans',g:'leasing',icon:'▭',ru:'Планировки',uz:'Planirovkalar',en:'Floor plans',nav:false}, /* v4.37: дубль в меню убран — открывается табом «Планировка» из LCR и из «Версий планировок» */ /* перенесено из Advisory в Leasing по требованию: планировка — функция отдела аренды. Внутри «Контроль аренды (LCR)» тот же план доступен вкладкой. */
    {v:'plan_master',g:'leasing',icon:'▭',ru:'Версии планировок',uz:'Planirovka versiyalari',en:'Layout versions',nav:true}, /* P1-3: ЕДИНСТВЕННЫЙ вход в планировки из меню; project_layouts/leasing_layouts — внутренние экраны, открываются из мастера (реестр файлов) и из рабочих столов */
    {v:'registry',g:'leasing',icon:'▤',ru:'Контроль аренды (LCR)',uz:'Ijara nazorati (LCR)',en:'Lease control (LCR)',nav:true},
    {v:'v32_sales',g:'leasing',icon:'◆',ru:'Контроль продажи (SCR)',uz:'Sotuv nazorati (SCR)',en:'Sales control (SCR)',nav:true},
    {v:'brands',g:'leasing',icon:'✦',ru:'База брендов',uz:'Brendlar bazasi',en:'Brand database',nav:true},
    {v:'v32_demand',g:'leasing',icon:'◈',ru:'Инвесторы и запросы',uz:'Investorlar va so‘rovlar',en:'Investors & requests',nav:true},
    {v:'v32_partners',g:'leasing',icon:'◇',ru:'Партнёры',uz:'Hamkorlar',en:'Partners',nav:true},
    {v:'v326_lease',g:'leasing',icon:'%',ru:'Комиссии аренды',uz:'Ijara komissiyalari',en:'Lease commissions',nav:true},
    {v:'leasing_opening',g:'leasing',icon:'✓',ru:'Контроль открытий',uz:'Ochilish nazorati',en:'Opening tracker',nav:true,future:true},
    {v:'v32_requests',g:'leasing',icon:'✉',ru:'Запросы брендов',uz:'Brend so‘rovlari',en:'Brand requests',nav:false},
    {v:'v32_investors',g:'leasing',icon:'◈',ru:'Инвесторы',uz:'Investorlar',en:'Investors',nav:false},
    {v:'leasing_layouts',g:'leasing',icon:'▭',ru:'Планировки и версии',uz:'Planirovkalar va versiyalar',en:'Layouts and versions',nav:false},

    {v:'manage_portfolio',g:'property',icon:'▦',ru:'Портфель объектов',uz:'Obyektlar portfeli',en:'Managed portfolio',nav:true,future:true},
    {v:'facility_management',g:'property',icon:'⚙',ru:'Эксплуатация (Facility Management)',uz:'Ekspluatatsiya (Facility Management)',en:'Facility Management',nav:true,future:true},
    {v:'equipment_registry',g:'property',icon:'⌘',ru:'Оборудование и MEP',uz:'Uskunalar va MEP',en:'Equipment and MEP',nav:true,future:true},
    {v:'maintenance',g:'property',icon:'🛠',ru:'Заявки и обслуживание',uz:'Arizalar va xizmat',en:'Maintenance and work orders',nav:true,future:true},
    {v:'tenant_contracts',g:'property',icon:'▣',ru:'Арендаторы и договоры',uz:'Ijarachilar va shartnomalar',en:'Tenants and contracts',nav:true,future:true},
    {v:'asset_management',g:'property',icon:'♜',ru:'Управление активами (Asset Management)',uz:'Aktivlarni boshqarish (Asset Management)',en:'Asset Management',nav:true,future:true},
    {v:'property_budget',g:'property',icon:'₿',ru:'Бюджет объекта',uz:'Obyekt byudjeti',en:'Property budget',nav:true,future:true},
    {v:'noi_performance',g:'property',icon:'↗',ru:'NOI и эффективность',uz:'NOI va samaradorlik',en:'NOI and performance',nav:true,future:true},
    {v:'capex_management',g:'property',icon:'▰',ru:'CAPEX',uz:'CAPEX',en:'CAPEX',nav:true,future:true},
    {v:'owner_reports',g:'property',icon:'▧',ru:'Отчёты собственнику',uz:'Mulkdor hisobotlari',en:'Owner reporting',nav:true,future:true},
    {v:'v326_suppliers',g:'property',icon:'✦',ru:'Поставщики',uz:'Yetkazib beruvchilar',en:'Suppliers',nav:true},

    {v:'finance_dashboard',g:'finance',icon:'▦',ru:'Финансовый дашборд CASE',uz:'CASE moliyaviy paneli',en:'CASE finance dashboard',nav:true,future:true},
    {v:'finance_income',g:'finance',icon:'＋',ru:'Доходы компании',uz:'Kompaniya daromadlari',en:'Company income',nav:true,future:true},
    {v:'finance_expenses',g:'finance',icon:'−',ru:'Расходы компании',uz:'Kompaniya xarajatlari',en:'Company expenses',nav:true,future:true},
    {v:'finance_invoices',g:'finance',icon:'▧',ru:'Счета и платежи',uz:'Hisoblar va to‘lovlar',en:'Invoices and payments',nav:true,future:true},
    {v:'finance_receivables',g:'finance',icon:'↘',ru:'Дебиторская задолженность',uz:'Debitor qarzdorlik',en:'Receivables',nav:true,future:true},
    {v:'finance_payables',g:'finance',icon:'↗',ru:'Кредиторская задолженность',uz:'Kreditor qarzdorlik',en:'Payables',nav:true,future:true},
    {v:'finance_treasury',g:'finance',icon:'◉',ru:'Казначейство и денежный поток',uz:'G‘aznachilik va pul oqimi',en:'Treasury and cash flow',nav:true,future:true},
    {v:'finance_payroll',g:'finance',icon:'%',ru:'Зарплаты, бонусы и комиссии',uz:'Maosh, bonus va komissiyalar',en:'Payroll, bonuses and commissions',nav:true,future:true},
    {v:'finance_project_pnl',g:'finance',icon:'∑',ru:'Прибыльность проектов',uz:'Loyihalar rentabelligi',en:'Project profitability',nav:true,future:true},
    {v:'finance_department_pnl',g:'finance',icon:'▥',ru:'P&L бизнес-направлений',uz:'Biznes yo‘nalishlari P&L',en:'Business-line P&L',nav:true,future:true},
    {v:'finance_budget',g:'finance',icon:'▤',ru:'Бюджет и план-факт',uz:'Byudjet va reja-fakt',en:'Budget and plan vs actual',nav:true,future:true},

    {v:'map',g:'data',icon:'⌖',ru:'Гео: наши проекты',uz:'Geo: bizning loyihalar',en:'Geoanalytics — our projects',nav:true},
    {v:'geoanalytics',g:'data',icon:'◉',ru:'Гео: рынок и POI',uz:'Geo: bozor va POI',en:'Geoanalytics — market & POI',nav:true},
    {v:'analytics_hub',g:'data',icon:'◎',ru:'Центр аналитики',uz:'Tahlil markazi',en:'Analytics hub',nav:false},
    {v:'market_data',g:'data',icon:'▥',ru:'Рыночные данные',uz:'Bozor ma’lumotlari',en:'Market data',nav:true,future:true},
    {v:'macro_data',g:'data',icon:'◫',ru:'Макроэкономика',uz:'Makroiqtisodiyot',en:'Macroeconomics',nav:true,future:true},
    {v:'bench',g:'data',icon:'◈',ru:'Бенчмаркинг',uz:'Benchmarking',en:'Benchmarking',nav:true},
    {v:'data_quality',g:'data',icon:'✓',ru:'Качество и источники данных',uz:'Ma’lumot sifati va manbalar',en:'Data quality and sources',nav:true,future:true},
    {v:'data_import_export',g:'data',icon:'⇅',ru:'Импорт и экспорт данных',uz:'Ma’lumot import va eksporti',en:'Data import and export',nav:true,future:true},

    {v:'product_intelligence',g:'products',icon:'◎',ru:'CASE Intelligence',uz:'CASE Intelligence',en:'CASE Intelligence',nav:true,future:true},
    {v:'product_market',g:'products',icon:'⌂',ru:'CASE Market',uz:'CASE Market',en:'CASE Market',nav:true,future:true},
    {v:'product_living',g:'products',icon:'🏠',ru:'CASE Living',uz:'CASE Living',en:'CASE Living',nav:true,future:true},
    {v:'product_manage',g:'products',icon:'⚙',ru:'CASE Manage',uz:'CASE Manage',en:'CASE Manage',nav:true,future:true},
    {v:'product_subscriptions',g:'products',icon:'★',ru:'Подписки и биллинг',uz:'Obuna va billing',en:'Subscriptions and billing',nav:true,future:true},

    {v:'kpi',g:'team',icon:'★',ru:'KPI',uz:'KPI',en:'KPI',nav:true},
    {v:'org',g:'team',icon:'☖',ru:'Оргструктура',uz:'Tashkiliy tuzilma',en:'Organisation',nav:true},
    {v:'study',g:'team',icon:'✎',ru:'Обучение',uz:'Ta’lim',en:'Learning',nav:true},
    {v:'rating',g:'team',icon:'♛',ru:'Рейтинг',uz:'Reyting',en:'Rating',nav:true},

    {v:'users',g:'admin',icon:'◍',ru:'Доступ (пользователи и роли)',uz:'Kirish (foydalanuvchilar va rollar)',en:'Access (users & roles)',nav:true},
    {v:'admin_modules',g:'admin',icon:'✦',ru:'Модули (флаги)',uz:'Modullar (bayroqlar)',en:'Modules (flags)',nav:true},
    {v:'admin_system',g:'admin',icon:'⚙',ru:'Система (журнал, бэкапы, корзина)',uz:'Tizim (jurnal, bekap, savat)',en:'System (log, backups, trash)',nav:true},
    {v:'document_templates',g:'admin',icon:'▧',ru:'Шаблоны КП и договоров',uz:'TK va shartnoma shablonlari',en:'Proposal and contract templates',nav:true},
    {v:'admin_workflows',g:'admin',icon:'⇄',ru:'Процессы и согласования',uz:'Jarayonlar va tasdiqlash',en:'Workflows and approvals',nav:true,future:true},
    {v:'admin_directories',g:'admin',icon:'▤',ru:'Справочники и категории',uz:'Ma’lumotnomalar va toifalar',en:'Directories and categories',nav:true,future:true},
    {v:'admin_integrations',g:'admin',icon:'⌁',ru:'Интеграции',uz:'Integratsiyalar',en:'Integrations',nav:true,future:true}
  ];

  var GROUPS={
    mywork:{ru:'Работа и проекты',uz:'Ish va loyihalar',en:'Work & projects'},
    projects:{ru:'Клиенты и проекты',uz:'Mijozlar va loyihalar',en:'Clients and projects'},
    advisory:{ru:'Консалтинг (Advisory)',uz:'Konsalting (Advisory)',en:'Advisory'},
    leasing:{ru:'Аренда и продажи (Leasing & Sales)',uz:'Ijara va sotuv (Leasing & Sales)',en:'Leasing & Sales'},
    property:{ru:'Управление объектами',uz:'Obyektlarni boshqarish',en:'Property & Asset Management'},
    finance:{ru:'Финансы CASE',uz:'CASE moliyasi',en:'CASE finance'},
    data:{ru:'Данные и аналитика',uz:'Ma’lumot va tahlil',en:'Data & Analytics'},
    products:{ru:'Цифровые продукты',uz:'Raqamli mahsulotlar',en:'Digital products'},
    team:{ru:'Команда',uz:'Jamoa',en:'Team'},
    admin:{ru:'Администрирование',uz:'Boshqaruv',en:'Administration'}
  };
  var GROUP_ORDER=['mywork','projects','advisory','leasing','property','finance','data','products','team','admin'];
  var ALL=MODULES.map(function(m){return m.v;});
  var NAV_ORDER=MODULES.filter(function(m){return m.nav;}).map(function(m){return m.v;});

  var CURRENT_CORE=['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','docs','registry','brands','v32_demand','v32_requests','v32_sales','v32_investors','v32_partners','v326_lease','plans','feasibility','mep','lift','map','geoanalytics','bench','kpi','org','study','rating','users','admin_modules','admin_system'];
  var DEFAULTS={
    ASH:ALL.slice(), CFO:ALL.slice(), ADM:ALL.slice(),
    BA:['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','project_handover','docs','registry','brands','v32_demand','v32_requests','v32_sales','v32_investors','v32_partners','v326_lease','leasing_layouts','plans','leasing_opening','feasibility','mep','map','geoanalytics','bench','kpi','org','study','rating'],
    AG:['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','docs','registry','brands','v32_demand','v32_requests','v32_sales','v32_investors','v326_lease','leasing_layouts','plans','leasing_opening','map','geoanalytics','kpi','org','study','rating'],
    AGX:['dash','work_tasks','work_kanban','brands','v32_investors'],
    HO:['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','docs','registry','brands','v32_demand','v32_requests','v326_lease','leasing_layouts','plans','leasing_opening','kpi','org','study'],
    BSH:['dash','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','project_workspace','project_layouts','plan_master','case_projects','docs','registry','advisory_pipeline','advisory_proposal_builder','advisory_proposals','advisory_portfolio_map','advisory_contracts','advisory_scope','advisory_delivery','advisory_reports','advisory_cross_sell','advisory_concept','advisory_area','plans','mep','lift','map','geoanalytics','org','study'],
    HM:['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','project_workspace','project_layouts','plan_master','case_projects','docs','advisory_pipeline','advisory_proposal_builder','advisory_proposals','advisory_portfolio_map','advisory_contracts','advisory_scope','advisory_delivery','advisory_reports','advisory_cross_sell','advisory_research','advisory_concept','advisory_area','plans','feasibility','advisory_business_plan','mep','lift','map','geoanalytics','market_data','macro_data','bench','data_quality','kpi','org','study','rating'],
    BRJ:['dash','work_tasks','work_kanban','brands','geoanalytics','market_data','macro_data','data_quality','data_import_export']
  };
  var UI={role:'BA',user:''};

  window.CASE_OS_MODULES=MODULES;
  /* P1-5: единый реестр — каталог модулей синхронизирует validViews ядра со своим списком,
     чтобы новый модуль в каталоге не оказывался «невалидным view» после перезагрузки */
  try{if(Array.isArray(window.CASE_VALID_VIEWS))MODULES.forEach(function(m){if(m&&m.v&&window.CASE_VALID_VIEWS.indexOf(m.v)<0)window.CASE_VALID_VIEWS.push(m.v);});}catch(e){}
  window.CASE_OS_GROUPS=GROUPS;
  window.CASE_OS_GROUP_ORDER=GROUP_ORDER;
  /* Заголовок раздела внутри рабочей области должен совпадать с названием в боковой панели.
     Возвращаем метку модуля только для реальных пунктов меню (nav:true) — карточки конкретных
     сущностей (nav:false, напр. рабочий стол проекта) сохраняют свой динамический заголовок. */
  window.CASE_NAV_TITLE=function(v){for(var i=0;i<MODULES.length;i++){if(MODULES[i].v===v&&MODULES[i].nav)return tx(MODULES[i]);}return '';};

  function lang(){try{return typeof LANG==='string'?LANG:'ru';}catch(e){return 'ru';}}
  function h(v){try{return typeof esc==='function'?esc(v):String(v==null?'':v);}catch(e){return String(v==null?'':v);}}
  function tx(o){return o[lang()]||o.ru||'';}
  function roleObj(rk){try{return (typeof ROLES!=='undefined'&&ROLES[rk])||{};}catch(e){return {};}}
  function currentRole(){try{return (S&&S.role)||'';}catch(e){return '';}}
  function currentUserKey(){try{return String((S.user&&(S.user.id||S.user.u||S.user.email))||currentRole());}catch(e){return currentRole();}}
  function mapObj(x){return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}
  function roleStore(){try{ROLE_WORKSPACES=mapObj(ROLE_WORKSPACES);return ROLE_WORKSPACES;}catch(e){return {};}}
  function userStore(){try{USER_WORKSPACES=mapObj(USER_WORKSPACES);return USER_WORKSPACES;}catch(e){return {};}}
  function uniq(a){var out=[];(Array.isArray(a)?a:[]).forEach(function(v){if(ALL.indexOf(v)>=0&&out.indexOf(v)<0)out.push(v);});return out;}
  function hardAllowed(v,rk){rk=rk||currentRole();if(rk==='AGX')return (DEFAULTS.AGX||[]).indexOf(v)>=0;if(rk==='BRJ')return (DEFAULTS.BRJ||[]).indexOf(v)>=0;return true;}
  function locked(rk,v){return v==='dash';}
  function roleViews(rk){
    var configured=roleStore()[rk];
    var base=Array.isArray(configured)?configured:(DEFAULTS[rk]||['dash']);
    var out=uniq(base);
    if(out.indexOf('dash')<0)out.unshift('dash');
    return out;
  }
  function people(){
    try{if(typeof orgPeople==='function')return orgPeople();}catch(e){}
    try{return (USERS||[]).map(function(u){return{id:u.u||u.role,name:u.name,role:u.role,title:u.title,active:u.active!==false};});}catch(e){return[];}
  }
  function personByKey(key){var p=people();for(var i=0;i<p.length;i++)if(String(p[i].id)===String(key))return p[i];return null;}
  function userViews(key,rk){
    var rec=userStore()[String(key)];
    if(rec&&rec.mode==='custom'&&Array.isArray(rec.views)){
      var out=uniq(rec.views);if(out.indexOf('dash')<0)out.unshift('dash');return out;
    }
    return roleViews(rk);
  }
  function effectiveViews(){return userViews(currentUserKey(),currentRole());}
  function isManaged(v){return ALL.indexOf(v)>=0;}
  function canOpen(v){if(v==='chat')return true;if(!isManaged(v))return true;if(!hardAllowed(v,currentRole()))return false;return effectiveViews().indexOf(v)>=0;}
  function firstAllowed(){var a=effectiveViews();for(var i=0;i<NAV_ORDER.length;i++)if(a.indexOf(NAV_ORDER[i])>=0)return NAV_ORDER[i];return 'dash';}
  function canManage(){try{return !!(typeof R==='function'&&R().admin);}catch(e){return false;}}
  function save(action,detail){
    try{if(typeof audit==='function')audit(action,detail||'');}catch(e){}
    try{if(typeof persist==='function')persist();}catch(e){}
    try{buildNav();}catch(e){}
    try{if(!canOpen(S.view)&&typeof go==='function')go(firstAllowed());}catch(e){}
  }

  function buildNav(){
    try{migrateWorkspaceSchema();}catch(e){}
    var nav=document.getElementById('nav');if(!nav)return;
    var allowed=effectiveViews(),out='';
    GROUP_ORDER.forEach(function(g){
      var items=MODULES.filter(function(m){return m.nav&&!m.future&&m.g===g&&allowed.indexOf(m.v)>=0;}); /* v4.39: модули-заглушки (future) убраны из меню — они дорожная карта, а не рабочие разделы; управлять ими можно в админке рабочих пространств */
      /* v4.41.2: жёсткий фильтр «BRJ видит только бренды» УДАЛЁН — он перекрывал настраиваемое рабочее пространство роли (у BRJ по умолчанию есть гео/рынок, и админ может расширять набор). Видимость определяет только workspace. */
      if(!items.length)return;
      var active=items.some(function(m){return S&&S.view===m.v;});
      out+='<div class="nav-group '+(active?'has-active open':'')+'"><button type="button" class="nav-group-btn" aria-haspopup="true" aria-expanded="false" onclick="caseNavToggle(event,this)"><span>'+h(tx(GROUPS[g]))+'</span><span class="chev">▼</span></button><div class="nav-menu">';
      out+=items.map(function(m){var future=m.future?'<em class="case-nav-future">план</em>':'';return '<a data-v="'+m.v+'" class="'+((S&&S.view===m.v)?'active':'')+'" title="'+h(tx(m))+'" onclick="caseNavGo(this,\''+m.v+'\')"><span class="ic">'+m.icon+'</span><span class="case-nav-label">'+h(tx(m))+'</span>'+future+'</a>';}).join('');
      out+='</div></div>';
    });
    nav.innerHTML=out;
    try{if(typeof updateChatBadge==='function')updateChatBadge();}catch(e){}
  }

  window.caseNavClose=function(){/* v4.42: no-op — раньше сворачивал ВСЕ группы; при переходе в разделы с собственным go-обработчиком (Версии планировок) складывалось всё меню */};
  window.caseNavSync=function(){try{var a=document.querySelector('#nav a.active');var g=a&&a.closest('.nav-group');if(g){document.querySelectorAll('#nav .nav-group.has-active').forEach(function(x){if(x!==g)x.classList.remove('has-active');});g.classList.add('has-active');g.classList.add('open');}}catch(e){}};
  window.caseNavGo=function(a,v){try{var g=a&&a.closest('.nav-group');document.querySelectorAll('#nav .nav-group.has-active').forEach(function(x){x.classList.remove('has-active');});if(g){g.classList.add('has-active');g.classList.add('open');}}catch(e){}go(v);}; /* v4.40.1: чужие открытые группы не трогаем */
  window.caseNavToggle=function(e,b){if(e)e.stopPropagation();var g=b&&b.closest('.nav-group');if(!g)return;var now=g.classList.toggle('open');b.setAttribute('aria-expanded',now?'true':'false');}; /* v4.40.1: заголовок сворачивает/раскрывает только свою группу */
  /* v4.37: аккордеон следует за навигацией — при любом go() открыта группа активного экрана (и только она) */
  (function(){var og=window.go;if(typeof og==='function'&&!og._nav437){window.go=function(v){var prev=null;try{prev=S&&S.view;}catch(e){}var r=og.apply(this,arguments);var cur=null;try{cur=S&&S.view;}catch(e){}
    if(cur!==prev){try{window.caseNavSync();}catch(e){}}
    return r;};window.go._nav437=true;}})(); /* v4.40.1: перерендер того же экрана (сортировка/фильтр/сохранение) меню не трогает */
  /* v4.40.1: обработчик «клик вне меню → закрыть группы» удалён — в закреплённом меню он сворачивал группы при любом действии в рабочем окне */

  function roleOptions(sel){return Object.keys(ROLES||{}).map(function(k){return '<option value="'+h(k)+'"'+(sel===k?' selected':'')+'>'+h((roleObj(k).label)||k)+'</option>';}).join('');}
  function userOptions(sel){return people().filter(function(p){return p.active!==false;}).map(function(p){return '<option value="'+h(String(p.id))+'"'+(String(sel)===String(p.id)?' selected':'')+'>'+h(p.name||p.id)+' · '+h((roleObj(p.role).label)||p.role)+'</option>';}).join('');}
  function moduleButtons(mode,key,rk,views){
    return GROUP_ORDER.map(function(g){
      var items=MODULES.filter(function(m){return m.g===g;});if(!items.length)return '';
      return '<div class="ws-group"><div class="ws-group-title">'+h(tx(GROUPS[g]))+'</div><div class="ws-modules">'+items.map(function(m){
        var on=views.indexOf(m.v)>=0,isLock=locked(rk,m.v),cls='ws-module '+(on?'on ':'')+(isLock?'locked ':'')+(m.future?'future ':'');
        var click=isLock?'':' onclick="'+(mode==='role'?'wsToggleRoleView(\''+h(key)+'\',\''+m.v+'\')':'wsToggleUserView(\''+h(key)+'\',\''+m.v+'\')')+'"';
        var title=isLock?'Системный главный экран всегда доступен':(m.future?'Раздел запланирован; видимость можно настроить уже сейчас':'Включить / выключить');
        return '<button type="button" class="'+cls+'"'+click+' title="'+h(title)+'"><span>'+m.icon+'</span><span>'+h(tx(m))+(m.future?' <i>план</i>':'')+'</span><b>'+(on?'✓':'—')+'</b></button>';
      }).join('')+'</div></div>';
    }).join('');
  }
  function rightsBlock(rk,L){
    /* v4.42: отдельная таблица «Права ролей» на странице «Пользователи» объединена с этой карточкой —
       права на действия выбранной роли настраиваются здесь же, тем же toggleRight ядра */
    try{
      if(typeof RIGHTLBL==='undefined'||typeof ROLES==='undefined'||!ROLES[rk])return '';
      var IC={leasing:'🏬',finance:'💰',edit:'✎',approve:'✔',plans:'▤',ownOnly:'👤',external:'🌐',projectScoped:'📁',admin:'⚙'};
      var r0=ROLES[rk];
      return '<div class="ws-group"><div class="ws-group-title">'+h(L.rights)+'</div><div class="ws-modules">'+RIGHTLBL.map(function(rt){
        var on=!!r0[rt[0]],lock=(rt[0]==='admin'&&rk==='ASH');
        return '<button type="button" class="ws-module '+(on?'on ':'')+(lock?'locked':'')+'"'+(lock?' title="Админ-доступ генерального директора защищён от отключения"':' onclick="wsToggleRight(\''+h(rk)+'\',\''+rt[0]+'\')" title="Включить / выключить"')+'><span>'+(IC[rt[0]]||'·')+'</span><span>'+h(rt[1])+'</span><b>'+(on?'✓':'—')+'</b></button>';
      }).join('')+'</div></div>';
    }catch(e){return '';}
  }
  function renderCard(){
    var el=document.getElementById('wsAdminCard');if(!el)return;
    if(!canManage()){el.remove();return;}
    if(!roleObj(UI.role).label)UI.role=Object.keys(ROLES||{})[0]||'ASH';
    var ps=people().filter(function(x){return x.active!==false;});
    if(!UI.user&&ps.length)UI.user=String(ps[0].id);
    if(UI.user&&!personByKey(UI.user)&&ps.length)UI.user=String(ps[0].id);
    var p=personByKey(UI.user),pr=p?(p.role||'AG'):'AG';
    var rec=p?userStore()[String(p.id)]:null,custom=!!(rec&&rec.mode==='custom');
    var rv=roleViews(UI.role),uv=p?userViews(String(p.id),pr):[];
    var L={ru:{title:'Доступ ролей и сотрудников',role:'Шаблон роли',user:'Индивидуально сотруднику',inherit:'Наследует роль',custom:'Индивидуальный набор',reset:'Вернуть рекомендуемый набор',resetUser:'Сбросить индивидуальные настройки',rights:'Права на действия',sections:'Видимые разделы'},uz:{title:'Rollar va xodimlar ruxsatlari',role:'Rol shabloni',user:'Xodim uchun alohida',inherit:'Rolni meros qiladi',custom:'Shaxsiy to‘plam',reset:'Tavsiya etilgan to‘plam',resetUser:'Shaxsiy sozlamani bekor qilish',rights:'Amallar huquqlari',sections:'Ko‘rinadigan bo‘limlar'},en:{title:'Roles & employees access',role:'Role template',user:'Employee override',inherit:'Inherit role',custom:'Custom set',reset:'Restore recommended set',resetUser:'Clear employee override',rights:'Action rights',sections:'Visible modules'}}[lang()]||null;
    el.innerHTML='<div class="ws-head"><div><div class="ws-eye">CASE OS · configurable access</div><h3>'+h(L.title)+'</h3></div><div class="ws-lock">ADMIN CONTROL</div></div>'+ 
      '<div class="ws-columns"><section class="ws-pane"><div class="ws-pane-head"><div><b>'+h(L.role)+'</b><small>'+h((roleObj(UI.role).label)||UI.role)+'</small></div><select onchange="wsSelectRole(this.value)">'+roleOptions(UI.role)+'</select></div>'+rightsBlock(UI.role,L)+'<div class="ws-group-title" style="margin-top:12px">'+h(L.sections)+'</div>'+moduleButtons('role',UI.role,UI.role,rv)+'<button class="btn ghost sm" onclick="wsResetRole(\''+h(UI.role)+'\')">↺ '+h(L.reset)+'</button></section>'+ 
      '<section class="ws-pane"><div class="ws-pane-head"><div><b>'+h(L.user)+'</b><small>'+(p?h((roleObj(pr).label)||pr):'—')+'</small></div><select onchange="wsSelectUser(this.value)">'+userOptions(UI.user)+'</select></div>'+ 
      (p?'<div class="ws-mode"><button class="'+(!custom?'active':'')+'" onclick="wsSetUserMode(\''+h(String(p.id))+'\',\'inherit\')">'+h(L.inherit)+'</button><button class="'+(custom?'active':'')+'" onclick="wsSetUserMode(\''+h(String(p.id))+'\',\'custom\')">'+h(L.custom)+'</button></div>'+moduleButtons('user',String(p.id),pr,uv)+(custom?'<button class="btn ghost sm" onclick="wsResetUser(\''+h(String(p.id))+'\')">↺ '+h(L.resetUser)+'</button>':''):'<div class="ws-empty">—</div>')+'</section></div>';
  }
  function injectCard(){
    if(!canManage())return;
    var main=document.getElementById('main');if(!main||document.getElementById('wsAdminCard'))return;
    var card=document.createElement('div');card.className='card ws-admin';card.id='wsAdminCard';
    var ref=null,children=main.children;
    for(var i=0;i<children.length;i++){if(children[i].classList&&children[i].classList.contains('foot')){ref=children[i];break;}}
    if(ref)main.insertBefore(card,ref);else main.appendChild(card);renderCard();
  }

  function css(){if(document.getElementById('case480wscss'))return;var s=document.createElement('style');s.id='case480wscss';s.textContent=
    '.case-nav-label{min-width:0;overflow:hidden;text-overflow:ellipsis}.case-nav-future{margin-left:auto;font-style:normal;font-size:8px;line-height:1;border:1px solid var(--border);border-radius:999px;padding:3px 5px;color:var(--muted);background:var(--panel)}body:not(.nav-pin) .side:not(:hover):not(.open) .case-nav-future,body:not(.nav-pin) .side:not(:hover):not(.open) .case-nav-label{display:none}.ws-admin{border-top:3px solid var(--red);overflow:hidden}.ws-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:14px}.ws-head h3{font-size:18px;margin:2px 0 4px}.ws-head p{margin:0;color:var(--muted);font-size:12px;max-width:840px}.ws-eye{font-size:9.5px;color:var(--red-d);font-weight:900;letter-spacing:.12em}.ws-lock{border:1px solid rgba(158,0,0,.28);background:#fdeaea;color:var(--red-d);border-radius:999px;padding:6px 10px;font-size:10px;font-weight:900;white-space:nowrap}.ws-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ws-pane{border:1px solid var(--border);border-radius:14px;background:var(--soft);padding:12px;min-width:0;max-height:760px;overflow:auto}.ws-pane-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px;position:sticky;top:-12px;background:var(--soft);padding:8px 0;z-index:2}.ws-pane-head b{display:block;font-size:13px}.ws-pane-head small{display:block;color:var(--muted);font-size:10px;margin-top:2px}.ws-pane-head select{max-width:260px;width:55%;border:1px solid var(--border);background:var(--panel);color:var(--ink);border-radius:8px;padding:7px;font-family:inherit;font-size:11px}.ws-group{margin:10px 0}.ws-group-title{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:800;margin:0 0 5px}.ws-modules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.ws-module{display:grid;grid-template-columns:18px minmax(0,1fr) 16px;align-items:center;gap:6px;text-align:left;border:1px solid var(--border);background:var(--panel);color:var(--muted);border-radius:9px;padding:7px 8px;font-family:inherit;font-size:10.5px;font-weight:700;min-width:0}.ws-module span:first-child{text-align:center}.ws-module span:nth-child(2){overflow:hidden;text-overflow:ellipsis}.ws-module b{text-align:right}.ws-module i{font-style:normal;font-size:8px;border:1px solid var(--border);border-radius:999px;padding:1px 4px}.ws-module.on{border-color:rgba(158,0,0,.34);background:#fff5f5;color:var(--ink)}.ws-module.on b{color:var(--red-d)}.ws-module:not(.locked):hover{border-color:var(--red);transform:translateY(-1px)}.ws-module.locked{cursor:not-allowed;opacity:.7}.ws-module.future{border-style:dashed}.ws-mode{display:flex;gap:5px;margin-bottom:8px}.ws-mode button{flex:1;border:1px solid var(--border);background:var(--panel);color:var(--muted);border-radius:8px;padding:7px;font-family:inherit;font-size:10px;font-weight:800}.ws-mode button.active{background:var(--red);border-color:var(--red);color:#fff}.ws-note{font-size:10.5px;color:var(--muted);margin-top:10px}body.dark .ws-module.on{background:#351d1d}body.dark .ws-lock{background:#351d1d}@media(max-width:1050px){.ws-columns{grid-template-columns:1fr}}@media(max-width:650px){.ws-modules{grid-template-columns:1fr}.ws-head{flex-direction:column}.ws-pane-head{align-items:flex-start;flex-direction:column}.ws-pane-head select{width:100%;max-width:none}}';document.head.appendChild(s);}

  window.asaasWorkspaceCanOpen=canOpen;
  window.asaasWorkspaceViews=effectiveViews;
  window.asaasWorkspaceFirst=firstAllowed;
  window.caseWorkspaceCanOpen=canOpen;
  window.caseWorkspaceViews=effectiveViews;
  window.wsSelectRole=function(rk){UI.role=rk;renderCard();};
  window.wsToggleRight=function(rk,k){if(!canManage())return;try{if(typeof toggleRight==='function')toggleRight(rk,k);}catch(e){}};
  window.wsSelectUser=function(key){UI.user=String(key||'');renderCard();};
  window.wsToggleRoleView=function(rk,v){if(!canManage()||locked(rk,v))return;var st=roleStore(),a=roleViews(rk).slice(),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);st[rk]=uniq(a);save('Рабочая область роли',rk+' · '+v+' → '+(i>=0?'скрыт':'показан'));renderCard();};
  window.wsResetRole=function(rk){if(!canManage())return;delete roleStore()[rk];save('Рабочая область роли',rk+' → рекомендуемый набор');renderCard();};
  window.wsSetUserMode=function(key,mode){if(!canManage())return;var p=personByKey(key);if(!p)return;var st=userStore();if(mode==='custom')st[String(key)]={mode:'custom',views:roleViews(p.role).slice()};else delete st[String(key)];save('Рабочая область пользователя',(p.name||key)+' → '+mode);renderCard();};
  window.wsToggleUserView=function(key,v){if(!canManage()||v==='dash')return;var p=personByKey(key);if(!p)return;var st=userStore(),rec=st[String(key)];if(!rec||rec.mode!=='custom')rec=st[String(key)]={mode:'custom',views:roleViews(p.role).slice()};var a=uniq(rec.views),i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);rec.views=uniq(a);save('Рабочая область пользователя',(p.name||key)+' · '+v+' → '+(i>=0?'скрыт':'показан'));renderCard();};
  window.wsResetUser=function(key){if(!canManage())return;var p=personByKey(key);delete userStore()[String(key)];save('Рабочая область пользователя',(p&&p.name||key)+' → настройки роли');renderCard();};

  function migrateWorkspaceSchema(){
    try{if(typeof S==='undefined'||!S||!S.user)return;}catch(e){return;}
    var st=roleStore();
    if(+st.__caseSchema>=4450)return;
    if(+st.__caseSchema<492){
      ['ASH','CFO','ADM'].forEach(function(rk){
        if(Array.isArray(st[rk])){
          ALL.forEach(function(v){if(st[rk].indexOf(v)<0)st[rk].push(v);});
          st[rk]=uniq(st[rk]);
        }
      });
    }
    /* v4.42–4.42.1: сохранённые в базе шаблоны ролей записывались снимками эпохи узких
       умолчаний (v4.35) и перекрывали исправленные наборы. Это не только прятало пункты меню —
       СЕРВЕР по той же матрице отклонял сохранения разделов (BRJ: гео/бренды; администратор
       аренды: реестр/ЛСР), и правки «пропадали». Одноразово дополняем шаблон КАЖДОЙ роли её
       рекомендуемым набором; администратор после этого волен снова сузить доступ. */
    Object.keys(DEFAULTS).forEach(function(rk){
      if(!Array.isArray(st[rk]))return;
      (DEFAULTS[rk]||[]).forEach(function(v){if(st[rk].indexOf(v)<0)st[rk].push(v);});
      st[rk]=uniq(st[rk]);
    });
    /* v4.45.0: fail-closed role baselines. External agent and junior data admin cannot
       regain hidden LCR/project modules from an old saved workspace snapshot. Architect gets
       the promised read-only registry view; editing remains blocked by specialized checks. */
    if(Array.isArray(st.AGX))st.AGX=uniq(st.AGX.filter(function(v){return (DEFAULTS.AGX||[]).indexOf(v)>=0;}));
    if(Array.isArray(st.BRJ))st.BRJ=uniq(st.BRJ.filter(function(v){return (DEFAULTS.BRJ||[]).indexOf(v)>=0;}));
    if(Array.isArray(st.BSH)&&st.BSH.indexOf('registry')<0)st.BSH.push('registry');
    try{var us=userStore();people().forEach(function(p){var rec=us[String(p.id)];if(!rec||rec.mode!=='custom'||!Array.isArray(rec.views))return;if(p.role==='AGX')rec.views=uniq(rec.views.filter(function(v){return (DEFAULTS.AGX||[]).indexOf(v)>=0;}));if(p.role==='BRJ')rec.views=uniq(rec.views.filter(function(v){return (DEFAULTS.BRJ||[]).indexOf(v)>=0;}));if(p.role==='BSH'&&rec.views.indexOf('registry')<0)rec.views.push('registry');});}catch(e){}
    st.__caseSchema=4450;
    try{if(typeof persist==='function')persist();}catch(e){}
  }

  function install(){
    css();window.buildNav=buildNav;
    var oldGo=window.go;
    if(typeof oldGo==='function'&&!oldGo._casews480){window.go=function(v){if(!canOpen(v)){try{if(typeof toast==='function')toast(lang()==='en'?'This module is not enabled for your workspace.':lang()==='uz'?'Bu bo‘lim sizning ish sohangiz uchun yoqilmagan.':'Этот раздел не включён в вашу рабочую область.');}catch(e){}v=firstAllowed();}return oldGo.call(this,v);};window.go._casews480=true;}
    var oldUsers=window.renderUsers;
    if(typeof oldUsers==='function'&&!oldUsers._casews480){window.renderUsers=function(){var r=oldUsers.apply(this,arguments);setTimeout(injectCard,0);return r;};window.renderUsers._casews480=true;}
    var oldUsersBackend=window.renderUsersBackend;
    if(typeof oldUsersBackend==='function'&&!oldUsersBackend._casews480){window.renderUsersBackend=function(){var r=oldUsersBackend.apply(this,arguments);setTimeout(injectCard,0);return r;};window.renderUsersBackend._casews480=true;}
    try{buildNav();}catch(e){}
    try{if(typeof S!=='undefined'&&S.user&&!canOpen(S.view)&&typeof window.go==='function')window.go(firstAllowed());}catch(e){}
    try{if(typeof S!=='undefined'&&S.view==='users')setTimeout(injectCard,0);}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['v3520-workspaces']='4.46.4';
