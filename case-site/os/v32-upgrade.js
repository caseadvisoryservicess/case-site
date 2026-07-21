/* CASE OS v4.9.3 — UX/localization/validation + tenant demand + investor leads + sales + partner portal layer. */
(function(){
  'use strict';
  if(window.CASE_OS_V32) return;
  window.CASE_OS_V32 = true;
  var V32_VER = '3.4.0';
  var DATA_KEYS = ['BRAND_REQUESTS','INVESTOR_REQUESTS','SALES_ASSETS','SALES_BUYERS','CASE_PARTNERS','PARTNER_REFERRALS','V32_NOTES'];

  function h(s){
    try { if(typeof esc === 'function') return esc(s); } catch(e) {}
    return String(s==null?'':s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function id(){ return 'v32_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
  function todayISO(){ try { return iso(TODAY); } catch(e) { return new Date().toISOString().slice(0,10); } }
  function addDays(days){ var d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
  function money(n){ try { return fmt(n||0); } catch(e) { return '$'+Math.round(+n||0).toLocaleString('en-US'); } }
  function role(){ try { return (S&&S.role)||''; } catch(e){ return ''; } }
  function userName(){ try { return (S.user&&S.user.name)||''; } catch(e){ return ''; } }
  function brokerName(){ try { return (S.user&&S.user.broker_name)||S.user.name||''; } catch(e){ return ''; } }
  function rights(){ try { return R()||{}; } catch(e) { return {}; } }
  function canManage(){ var x=rights(); return !!(x.admin||x.finance||x.approve); }
  function canEdit(){ return !!(rights().edit||rights().admin||rights().finance); }
  function lang(){ return (typeof LANG==='string'?LANG:'ru'); }

  var T = {
    ru:{
      action:'Центр действий', requests:'Запросы брендов', investorLeads:'Инвесторские заявки', sales:'Продажи объектов', partners:'Партнёры', partnerPortal:'Портал партнёров',
      requestsSub:'Входящие запросы брендов: город, страна, площадь, формат, бюджет и предпочтения. Это отдельный источник сделок и комиссии.',
      investorLeadsSub:'Запросы инвесторов на покупку помещений или объектов под инвестицию: страна, город, бюджет, площадь, доходность, предпочтения и следующий шаг.',
      salesSub:'Объекты на продажу: инвесторы, NDA, due diligence, оферта, SPA, закрытие и комиссия.',
      partnersSub:'Внешние агенты и партнёры: доступ, рефералы, объекты, приватность и контроль.',
      addRequest:'Добавить запрос', addInvestorLead:'Добавить инвесторский лид', addAsset:'Добавить объект продажи', addBuyer:'Добавить покупателя', addPartner:'Добавить партнёра', salesPlan:'Планировка продаж',
      brand:'Бренд', country:'Страна', city:'Город', category:'Категория', areaMin:'Мин. м²', areaMax:'Макс. м²', budget:'Бюджет', preferences:'Предпочтения', nextAction:'Следующее действие', due:'Дедлайн', broker:'Ответственный', stage:'Стадия', fee:'Потенц. комиссия', actions:'Действия',
      match:'Подбор', edit:'Редактировать', save:'Сохранить', cancel:'Отмена', delete:'Удалить', createDeal:'Создать сделку', shortlist:'В шорт-лист', noRows:'Нет записей', search:'Поиск', filters:'Фильтры',
      myBonus:'Мой бонус', teamBonus:'Комиссии команды', pipeline:'Pipeline', weighted:'Weighted forecast', lost:'Упущено', earned:'Накоплено', coming:'Придёт при закрытии',
      property:'Объект', seller:'Продавец', price:'Цена', commission:'Комиссия', investor:'Инвестор', buyer:'Покупатель', nda:'NDA', dd:'DD', spa:'SPA', closed:'Закрыто', lead:'Лид', offer:'Оферта', lostStage:'Упущено',
      source:'Источник', phone:'Телефон', email:'Email', contact:'Контакт', assetType:'Тип актива', budgetMin:'Мин. бюджет', budgetMax:'Макс. бюджет', capRate:'Доходность / cap rate', proofFunds:'Подтв. средств', investmentCriteria:'Критерии покупки', matchAssets:'Подобрать объекты', convertBuyer:'Создать покупателя', access:'Доступ', scope:'Зона доступа', public:'Публично партнёрам', private:'Внутренне', referral:'Реферал',
      localization:'Локализация', validation:'Валидация', dark:'Тёмная тема', ready:'Готовность документа', required:'Обязательное поле', addBrand:'Добавить бренд', fix:'Исправить', openList:'Открыть список',
      qaAbbr:'КД', offerAbbr:'КП', ddAbbr:'ДД', loiAbbr:'LOI', crm:'CRM',
      best1:'Портфель', best2:'Сделки', best3:'Подбор арендаторов', best4:'Карта и планы', best5:'Качество данных', best6:'Мотивация',
      needBrand:'Выберите бренд из базы или начните вводить название.', brandNotFound:'Бренда нет в базе. Добавьте его, чтобы у всех была единая история.',
      needUnit:'Выберите помещение или впишите код вручную.', needArea:'Укажите площадь больше нуля.', needRate:'Укажите ставку больше нуля.', needDate:'Укажите дату.', needSubject:'Укажите тему.',
      inlineTop:'Заполните поля ниже — система не сформирует документ, пока обязательные данные не готовы.',
      jump:'Перейти', tasksToday:'Задачи сегодня', roleFocus:'Фокус по роли', inbound:'Входящий спрос', investmentDemand:'Инвест. спрос', salePipeline:'Воронка продаж', partnerDeals:'Партнёрские сделки',
      abbreviations:'Аббревиатуры по языку', routeHint:'Карточки и кнопки теперь ведут в рабочие разделы, а не являются декоративными.', limitedPartner:'Вы видите только доступные вам объекты и заявки. Комиссии других партнёров скрыты.'
    },
    uz:{
      action:'Harakatlar markazi', requests:'Brend soʻrovlari', investorLeads:'Investor soʻrovlari', sales:'Obyektlar savdosi', partners:'Hamkorlar', partnerPortal:'Hamkorlar portali',
      requestsSub:'Brendlardan kiruvchi soʻrovlar: shahar, mamlakat, maydon, format, budjet va talablar. Bu alohida bitim va komissiya manbai.',
      investorLeadsSub:'Investorlarning sotib olish soʻrovlari: mamlakat, shahar, budjet, maydon, daromadlilik, talablar va keyingi qadam.',
      salesSub:'Sotiladigan obyektlar: investorlar, NDA, DD, oferta, SPA, yopilish va komissiya.',
      partnersSub:'Tashqi agentlar va hamkorlar: kirish huquqi, referral, obyektlar, maxfiylik va nazorat.',
      addRequest:'Soʻrov qoʻshish', addInvestorLead:'Investor lid qoʻshish', addAsset:'Savdo obyekti qoʻshish', addBuyer:'Xaridor qoʻshish', addPartner:'Hamkor qoʻshish', salesPlan:'Sotuv planirovkasi',
      brand:'Brend', country:'Mamlakat', city:'Shahar', category:'Kategoriya', areaMin:'Min m²', areaMax:'Maks m²', budget:'Budjet', preferences:'Talablar', nextAction:'Keyingi qadam', due:'Muddat', broker:'Masʼul', stage:'Bosqich', fee:'Potensial komissiya', actions:'Amallar',
      match:'Tanlash', edit:'Tahrirlash', save:'Saqlash', cancel:'Bekor', delete:'Oʻchirish', createDeal:'Bitim yaratish', shortlist:'Short-listga', noRows:'Yozuvlar yoʻq', search:'Qidiruv', filters:'Filtrlar',
      myBonus:'Mening bonusim', teamBonus:'Jamoa komissiyalari', pipeline:'Pipeline', weighted:'Weighted prognoz', lost:'Yoʻqotilgan', earned:'Yigʻilgan', coming:'Yopilganda keladi',
      property:'Obyekt', seller:'Sotuvchi', price:'Narx', commission:'Komissiya', investor:'Investor', buyer:'Xaridor', nda:'NDA', dd:'DD', spa:'SPA', closed:'Yopildi', lead:'Lid', offer:'Oferta', lostStage:'Yoʻqotildi',
      source:'Manba', phone:'Telefon', email:'Email', contact:'Kontakt', assetType:'Aktiv turi', budgetMin:'Min budjet', budgetMax:'Maks budjet', capRate:'Daromadlilik / cap rate', proofFunds:'Mablagʻ tasdiqi', investmentCriteria:'Sotib olish mezonlari', matchAssets:'Obyekt tanlash', convertBuyer:'Xaridor yaratish', access:'Kirish', scope:'Ruxsat zonasi', public:'Hamkorlarga ochiq', private:'Ichki', referral:'Referral',
      localization:'Lokalizatsiya', validation:'Validatsiya', dark:'Qorongʻi tema', ready:'Hujjat tayyorligi', required:'Majburiy maydon', addBrand:'Brend qoʻshish', fix:'Toʻldirish', openList:'Roʻyxatni ochish',
      qaAbbr:'MS', offerAbbr:'TT', ddAbbr:'Tekshiruv', loiAbbr:'LOI', crm:'CRM',
      best1:'Portfel', best2:'Bitimlar', best3:'Ijarachi tanlash', best4:'Xarita va planlar', best5:'Maʼlumot sifati', best6:'Motivatsiya',
      needBrand:'Brendni bazadan tanlang yoki nomini kiriting.', brandNotFound:'Brend bazada yoʻq. Uni qoʻshing, shunda yagona tarix saqlanadi.',
      needUnit:'Joyni tanlang yoki kodni qoʻlda kiriting.', needArea:'Maydonni noldan katta qilib kiriting.', needRate:'Stavkani noldan katta qilib kiriting.', needDate:'Sanani kiriting.', needSubject:'Mavzuni kiriting.',
      inlineTop:'Quyidagi maydonlarni toʻldiring — majburiy maʼlumotlar tayyor boʻlmaguncha hujjat shakllanmaydi.',
      jump:'Oʻtish', tasksToday:'Bugungi vazifalar', roleFocus:'Rol boʻyicha fokus', inbound:'Kiruvchi talab', investmentDemand:'Invest. talab', salePipeline:'Savdo voronkasi', partnerDeals:'Hamkor bitimlari',
      abbreviations:'Tilga mos qisqartmalar', routeHint:'Kartalar va tugmalar endi ishchi boʻlimlarga olib boradi.', limitedPartner:'Siz faqat sizga ochiq obyektlar va soʻrovlarni koʻrasiz. Boshqa hamkorlar komissiyalari yashirilgan.'
    },
    en:{
      action:'Action Center', requests:'Brand Requests', investorLeads:'Investor Requests', sales:'Property Sales', partners:'Partners', partnerPortal:'Partner Portal',
      requestsSub:'Inbound brand requirements: country, city, area, format, budget and preferences. This is a separate deal and fee source.',
      investorLeadsSub:'Investor purchase requests: country, city, budget, area, yield, preferences and next action for acquisition work.',
      salesSub:'Properties for sale: investors, NDA, due diligence, offer, SPA, closing and commissions.',
      partnersSub:'External agents and partners: access, referrals, assets, privacy and control.',
      addRequest:'Add request', addInvestorLead:'Add investor lead', addAsset:'Add sale asset', addBuyer:'Add buyer', addPartner:'Add partner', salesPlan:'Sales floor plan',
      brand:'Brand', country:'Country', city:'City', category:'Category', areaMin:'Min m²', areaMax:'Max m²', budget:'Budget', preferences:'Preferences', nextAction:'Next action', due:'Due', broker:'Owner', stage:'Stage', fee:'Potential fee', actions:'Actions',
      match:'Match', edit:'Edit', save:'Save', cancel:'Cancel', delete:'Delete', createDeal:'Create deal', shortlist:'Shortlist', noRows:'No records', search:'Search', filters:'Filters',
      myBonus:'My bonus', teamBonus:'Team commissions', pipeline:'Pipeline', weighted:'Weighted forecast', lost:'Lost', earned:'Earned', coming:'Expected on close',
      property:'Property', seller:'Seller', price:'Price', commission:'Commission', investor:'Investor', buyer:'Buyer', nda:'NDA', dd:'DD', spa:'SPA', closed:'Closed', lead:'Lead', offer:'Offer', lostStage:'Lost',
      source:'Source', phone:'Phone', email:'Email', contact:'Contact', assetType:'Asset type', budgetMin:'Min budget', budgetMax:'Max budget', capRate:'Yield / cap rate', proofFunds:'Proof of funds', investmentCriteria:'Investment criteria', matchAssets:'Match assets', convertBuyer:'Create buyer', access:'Access', scope:'Access scope', public:'Public to partners', private:'Internal', referral:'Referral',
      localization:'Localization', validation:'Validation', dark:'Dark mode', ready:'Document readiness', required:'Required field', addBrand:'Add brand', fix:'Fix', openList:'Open list',
      qaAbbr:'QA', offerAbbr:'Offer', ddAbbr:'DD', loiAbbr:'LOI', crm:'CRM',
      best1:'Portfolio', best2:'Transactions', best3:'Tenant matching', best4:'Map and plans', best5:'Data quality', best6:'Motivation',
      needBrand:'Select a brand from the database or start typing its name.', brandNotFound:'Brand is not in the database. Add it so the team keeps one shared history.',
      needUnit:'Select a unit or type the unit code manually.', needArea:'Enter an area greater than zero.', needRate:'Enter a rate greater than zero.', needDate:'Enter a date.', needSubject:'Enter a subject.',
      inlineTop:'Complete the fields below — the system will not generate a document until required data is ready.',
      jump:'Go', tasksToday:'Today tasks', roleFocus:'Role focus', inbound:'Inbound demand', investmentDemand:'Investment demand', salePipeline:'Sales pipeline', partnerDeals:'Partner deals',
      abbreviations:'Language-specific abbreviations', routeHint:'Cards and buttons now route to working sections, not decorative blocks.', limitedPartner:'You see only assets and requests available to you. Other partners’ commissions are hidden.'
    }
  };
  function tr(k){ var L=lang(); return (T[L]&&T[L][k])||(T.ru&&T.ru[k])||k; }

  var EXACT = {
    en:{
      'Дашборд':'Dashboard','Реестр':'Registry','Бренды':'Brands','Документы':'Documents','Планировки':'Floor plans','Карта':'Map','Пользователи':'Users','Команда':'Team','Администрирование':'Administration',
      'Качество данных':'Data quality','Контроль базы брендов':'Brand database QA','Контроль документов':'Document QA','Контроль планировок':'Floor-plan QA','Контроль карты':'Map QA',
      'Открыть список':'Open list','Сформировать':'Generate','Скачать Word':'Download Word','Печать / PDF':'Print / PDF','Язык документа:':'Document language:',
      'Тексты и контакты':'Texts and contacts','Контактное лицо для документов':'Document contact person','Вступительный текст':'Intro text','Благодарность':'Thank-you note',
      'Арендатор / бренд':'Tenant / brand','Арендатор':'Tenant','Объект':'Property','Помещение':'Unit','Площадь':'Area','Ставка':'Rate','Тип LOI':'LOI type','Дата события':'Event date',
      'Комиссии и бонусы':'Commissions and bonuses','Инвесторские заявки':'Investor Requests','Добавить инвесторский лид':'Add investor lead','Инвестор':'Investor','Тип актива':'Asset type','Критерии покупки':'Investment criteria','Подобрать объекты':'Match assets','Создать покупателя':'Create buyer','Моя мотивация':'My motivation','Бонусы команды':'Team bonuses','Накоплено':'Earned','Придёт при закрытии':'Expected on close','Упущено':'Lost',
      'Заполните и нажмите «Сформировать»':'Complete the form and click “Generate”','База брендов':'Brand database','Подбор арендаторов':'Tenant matching','Сделки и next action':'Transactions and next action','Поиск: помещение, бренд, КП...':'Search: unit, brand, offer...','начните вводить название бренда…':'start typing brand name...','или впишите вручную через запятую':'or type manually separated by commas','вступительный текст (можно изменить)':'intro text (editable)','благодарность (можно изменить)':'thank-you text (editable)'
    },
    uz:{
      'Дашборд':'Boshqaruv paneli','Реестр':'Reyestr','Бренды':'Brendlar','Документы':'Hujjatlar','Планировки':'Planlar','Карта':'Xarita','Пользователи':'Foydalanuvchilar','Команда':'Jamoa','Администрирование':'Administratsiya',
      'Качество данных':'Maʼlumot sifati','Контроль базы брендов':'Brendlar bazasi nazorati','Контроль документов':'Hujjatlar nazorati','Контроль планировок':'Planlar nazorati','Контроль карты':'Xarita nazorati',
      'Открыть список':'Roʻyxatni ochish','Сформировать':'Shakllantirish','Скачать Word':'Word yuklash','Печать / PDF':'Chop etish / PDF','Язык документа:':'Hujjat tili:',
      'Тексты и контакты':'Matnlar va kontaktlar','Контактное лицо для документов':'Hujjatlar uchun kontakt shaxs','Вступительный текст':'Kirish matni','Благодарность':'Minnatdorchilik',
      'Арендатор / бренд':'Ijarachi / brend','Арендатор':'Ijarachi','Объект':'Obyekt','Помещение':'Joy','Площадь':'Maydon','Ставка':'Stavka','Тип LOI':'LOI turi','Дата события':'Sana',
      'Комиссии и бонусы':'Komissiya va bonuslar','Инвесторские заявки':'Investor soʻrovlari','Добавить инвесторский лид':'Investor lid qoʻshish','Инвестор':'Investor','Тип актива':'Aktiv turi','Критерии покупки':'Sotib olish mezonlari','Подобрать объекты':'Obyekt tanlash','Создать покупателя':'Xaridor yaratish','Моя мотивация':'Mening motivatsiyam','Бонусы команды':'Jamoa bonuslari','Накоплено':'Yigʻilgan','Придёт при закрытии':'Yopilganda keladi','Упущено':'Yoʻqotilgan',
      'Заполните и нажмите «Сформировать»':'Toʻldiring va “Shakllantirish”ni bosing','База брендов':'Brendlar bazasi','Подбор арендаторов':'Ijarachi tanlash','Сделки и next action':'Bitimlar va keyingi qadam','Поиск: помещение, бренд, КП...':'Qidiruv: joy, brend, TT...','начните вводить название бренда…':'brend nomini yozishni boshlang...','или впишите вручную через запятую':'yoki vergul bilan qoʻlda kiriting','вступительный текст (можно изменить)':'kirish matni (tahrirlash mumkin)','благодарность (можно изменить)':'minnatdorchilik matni (tahrirlash mumkin)'
    }
  };

  function ensureData(){
    DATA_KEYS.forEach(function(k){ if(!Array.isArray(window[k])) window[k]=[]; });
    if(!window.BRAND_REQUESTS.length){
      window.BRAND_REQUESTS.push(
        {id:id(),brand:'Coffee Boom',country:'Узбекистан',city:'Ташкент',category:'Кофейня',areaMin:80,areaMax:160,budgetMax:35,preferences:'1 этаж, фасад, высокий трафик, желательно терраса',stage:'new',source:'inbound',broker:brokerName()||'Нодир',nextAction:'Подобрать 5 подходящих локаций',due:addDays(3),potentialFee:2500,createdAt:todayISO()},
        {id:id(),brand:'Sport Retailer',country:'Узбекистан',city:'Бухара',category:'Спорт / fashion',areaMin:180,areaMax:350,budgetMax:22,preferences:'ТЦ или mixed-use, витрина, парковка',stage:'matching',source:'partner',broker:'Хилола',nextAction:'Отправить shortlist инвестору',due:addDays(7),potentialFee:4200,createdAt:todayISO()}
      );
    }
    if(!window.SALES_ASSETS.length){
      window.SALES_ASSETS.push(
        {id:id(),name:'Street retail asset',country:'Узбекистан',city:'Ташкент',type:'Street retail',area:520,price:1250000,currency:'USD',seller:'Private owner',stage:'lead',broker:brokerName()||'Азиз',partner:'',visibility:'internal',commissionRate:2,expectedCommission:25000,nextAction:'Подготовить investment memo',due:addDays(5),notes:'Продажа объекта, логика отличается от аренды',createdAt:todayISO()},
        {id:id(),name:'Regional mall minority stake',country:'Узбекистан',city:'Бухара',type:'Investment',area:9200,price:4800000,currency:'USD',seller:'Developer',stage:'nda',broker:'Азиз',partner:'Внешний партнёр',visibility:'partners',commissionRate:1.5,expectedCommission:72000,nextAction:'Согласовать NDA и список документов DD',due:addDays(10),notes:'Можно показывать ограниченному кругу партнёров',createdAt:todayISO()}
      );
    }
    if(!window.SALES_BUYERS.length){
      window.SALES_BUYERS.push(
        {id:id(),name:'Family office',country:'ОАЭ',city:'Dubai',assetType:'Income-producing retail',areaMin:300,areaMax:12000,budgetMin:500000,budgetMax:7000000,capRate:'10%+',contact:'investment@buyer.example',broker:'Азиз',stage:'active',notes:'Ищет доходные объекты в Центральной Азии',createdAt:todayISO()},
        {id:id(),name:'Local investor group',country:'Узбекистан',city:'Ташкент',assetType:'Street retail / office',areaMin:100,areaMax:1000,budgetMin:200000,budgetMax:1500000,capRate:'12%+',contact:'+998 xx xxx xx xx',broker:'Нодир',stage:'active',notes:'Быстро принимает решение при чистых документах',createdAt:todayISO()}
      );
    }
    if(!window.INVESTOR_REQUESTS.length){
      window.INVESTOR_REQUESTS.push(
        {id:id(),investor:'Private investor',country:'Узбекистан',city:'Ташкент',assetType:'Street retail / leased unit',areaMin:50,areaMax:300,budgetMin:100000,budgetMax:750000,capRate:'11%+',proofFunds:'pending',preferences:'Доходное помещение с арендатором, договор аренды 3+ года, чистые документы',stage:'new',source:'inbound',broker:brokerName()||'Азиз',nextAction:'Подобрать 3 доходных помещения и запросить документы',due:addDays(4),potentialFee:12000,contact:'+998 / WhatsApp',createdAt:todayISO()},
        {id:id(),investor:'Regional investment group',country:'Узбекистан',city:'Самарканд',assetType:'Income-producing retail / mini mall',areaMin:250,areaMax:2500,budgetMin:400000,budgetMax:2500000,capRate:'10%+',proofFunds:'confirmed',preferences:'Готовы купить объект с арендным потоком или вакантное помещение с понятным upside',stage:'matching',source:'partner',broker:'Нодир',nextAction:'Сопоставить с объектами продажи и отправить teaser',due:addDays(6),potentialFee:30000,contact:'investor@example.com',createdAt:todayISO()}
      );
    }
    if(!window.CASE_PARTNERS.length){
      window.CASE_PARTNERS.push(
        {id:id(),name:'External Partner A',type:'External agent',country:'Узбекистан',city:'Ташкент',email:'partner@example.com',phone:'+998',access:'sales_only',scope:'partners_visible_assets',status:'active',owner:brokerName()||'Азиз',notes:'Видит только public/partner sales assets; комиссии приватны',createdAt:todayISO()},
        {id:id(),name:'Regional Broker B',type:'Partner',country:'Узбекистан',city:'Бухара',email:'regional@example.com',phone:'+998',access:'requests_and_sales',scope:'assigned_city',status:'pending',owner:'Хилола',notes:'Может присылать запросы брендов и покупателей',createdAt:todayISO()}
      );
    }
  }

  function installCSS(){
    if(document.getElementById('case-v32-style')) return;
    var css = ''+
      '.v32-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;margin:12px 0;box-shadow:var(--shadow)}'+
      '.v32-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.v32-head h2,.v32-head h3{margin:0;color:var(--ink)}.v32-head p{margin:6px 0 0;color:var(--muted);font-size:13px}.v32-eyebrow{font-size:10px;font-weight:800;color:var(--red-d);letter-spacing:.09em;text-transform:uppercase}'+
      '.v32-grid{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px}.v32-grid.three{grid-template-columns:repeat(3,minmax(180px,1fr))}.v32-mini{border:1px solid var(--border);border-radius:13px;background:var(--soft);padding:12px;cursor:pointer;transition:.15s}.v32-mini:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.08)}.v32-mini b{display:block;color:var(--ink);font-size:14px}.v32-mini span{display:block;color:var(--muted);font-size:11.5px;margin-top:5px;line-height:1.35}.v32-mini small{font-size:10px;color:var(--red-d);font-weight:800;text-transform:uppercase;letter-spacing:.06em}'+
      '.v32-kpis{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:9px}.v32-kpi{border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--soft)}.v32-kpi small{display:block;color:var(--muted);font-size:11px}.v32-kpi b{display:block;color:var(--ink);font-size:20px;margin-top:3px}.v32-kpi.warn b{color:#b56b00}.v32-kpi.bad b{color:var(--red-d)}'+
      '.v32-table{width:100%;border-collapse:separate;border-spacing:0;margin-top:10px;font-size:12px}.v32-table th,.v32-table td{border-bottom:1px solid var(--border);padding:9px 8px;text-align:left;vertical-align:top;color:var(--ink)}.v32-table th{position:sticky;top:0;background:var(--card);z-index:1;color:var(--muted);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}.v32-table .mut{font-size:11px;color:var(--muted)}.v32-tools{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}.v32-tools input,.v32-form input,.v32-form select,.v32-form textarea{background:var(--card);color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:8px 9px;font-family:inherit;font-size:12.5px}.v32-form label{display:block;font-size:11px;font-weight:700;color:var(--muted);margin:8px 0 4px}.v32-form textarea{min-height:70px;resize:vertical}.v32-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v32-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.v32-pill{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--border);border-radius:999px;padding:4px 8px;background:var(--soft);font-size:11px;color:var(--muted);margin:2px}.v32-pill.good{color:var(--green)}.v32-pill.bad{color:var(--red-d)}'+
      '.v32-modal{position:fixed;inset:0;background:rgba(0,0,0,.48);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px}.v32-modal-box{background:var(--card);color:var(--ink);border:1px solid var(--border);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.32);max-width:720px;width:100%;max-height:88vh;overflow:auto;padding:18px;position:relative}.v32-modal-close{position:absolute;top:10px;right:12px;border:0;background:transparent;color:var(--muted);font-size:20px;cursor:pointer}'+
      '.v32-toastbox{position:fixed;right:18px;bottom:18px;z-index:10001;display:flex;flex-direction:column;gap:8px}.v32-toast{max-width:420px;background:var(--card);color:var(--ink);border:1px solid var(--border);border-left:5px solid var(--red);box-shadow:0 10px 30px rgba(0,0,0,.18);border-radius:12px;padding:11px 13px;font-size:13px;white-space:pre-wrap}.v32-toast.warn{border-left-color:#d9a406}.v32-toast.good{border-left-color:var(--green)}'+
      '.case-invalid{border-color:#d33!important;box-shadow:0 0 0 3px rgba(211,51,51,.14)!important}.case-field-error{margin:5px 0 8px;color:#a40000;background:rgba(164,0,0,.07);border:1px solid rgba(164,0,0,.22);border-radius:9px;padding:7px 9px;font-size:11.5px;line-height:1.35}.case-field-error button{margin-left:8px}.v32-doc-errors{border:1px solid rgba(164,0,0,.25);background:rgba(164,0,0,.06);border-radius:12px;padding:10px;margin:0 0 10px;color:var(--ink)}.v32-doc-errors b{color:var(--red-d)}.v32-doc-errors a{display:inline-block;margin:4px 8px 0 0;color:var(--red-d);font-weight:700;cursor:pointer;text-decoration:none}.v32-checklist{border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--soft);margin:10px 0}.v32-checklist h4{margin:0 0 8px;color:var(--ink)}.v32-check{display:flex;justify-content:space-between;gap:10px;border-top:1px dashed var(--border);padding:6px 0;font-size:12px;color:var(--muted)}.v32-check:first-of-type{border-top:0}.v32-check.ok b{color:var(--green)}.v32-check.bad b{color:var(--red-d)}'+
      '.v32-nav-extra{border-top:1px solid var(--border);margin-top:8px;padding-top:8px}.v32-nav-extra a{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;color:var(--ink);text-decoration:none;cursor:pointer}.v32-nav-extra a:hover,.v32-nav-extra a.active{background:var(--soft);color:var(--red-d)}'+
      '.v32-clickable{cursor:pointer}.v32-split{display:grid;grid-template-columns:1.1fr .9fr;gap:12px}.v32-empty{padding:24px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:14px;background:var(--soft)}'+
      'body.dark .case-field-error{color:#ffd1d1;background:rgba(255,80,80,.10);border-color:rgba(255,120,120,.28)}body.dark .v32-toast{background:#26241f;color:#f6efe6;border-color:#4a4438}body.dark .v32-mini,body.dark .v32-kpi,body.dark .v32-checklist{background:#28261f}body.dark .v32-table th{background:#211f1b}body.dark .v32-form input,body.dark .v32-form select,body.dark .v32-form textarea{background:#1f1d19;color:#f6efe6;border-color:#4a4438}body.dark .v32-modal-box{background:#211f1b;color:#f6efe6}body.dark .v32-mini small{color:#ff9d94}'+
      '@media(max-width:1100px){.v32-grid,.v32-grid.three{grid-template-columns:repeat(2,1fr)}.v32-kpis{grid-template-columns:repeat(2,1fr)}.v32-split{grid-template-columns:1fr}}@media(max-width:640px){.v32-grid,.v32-grid.three,.v32-kpis,.v32-row2,.v32-row3{grid-template-columns:1fr}.v32-table{font-size:11px}.v32-head{display:block}.v32-tools{display:block}.v32-tools>*{margin:4px 0;width:100%}}';
    var st=document.createElement('style'); st.id='case-v32-style'; st.textContent=css; document.head.appendChild(st);
  }

  function toast(msg,kind){
    var box=document.querySelector('.v32-toastbox');
    if(!box){ box=document.createElement('div'); box.className='v32-toastbox'; document.body.appendChild(box); }
    var el=document.createElement('div'); el.className='v32-toast '+(kind||''); el.textContent=String(msg||''); box.appendChild(el);
    setTimeout(function(){ el.style.opacity='0'; el.style.transform='translateY(6px)'; }, kind==='modal'?8000:4800);
    setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, kind==='modal'?9000:5600);
  }
  function modal(title,body,actions){
    var m=document.createElement('div'); m.className='v32-modal';
    m.innerHTML='<div class="v32-modal-box"><button class="v32-modal-close" type="button">×</button><div class="v32-eyebrow">CASE OS v4.9.3</div><h3 style="margin:4px 0 8px;color:var(--ink)">'+h(title||'')+'</h3><div>'+body+'</div>'+(actions?'<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">'+actions+'</div>':'')+'</div>';
    m.querySelector('.v32-modal-close').onclick=function(){ m.remove(); };
    m.addEventListener('click',function(e){ if(e.target===m) m.remove(); });
    document.body.appendChild(m); return m;
  }
  window.v32CloseModal=function(){ var m=document.querySelector('.v32-modal'); if(m) m.remove(); };

  function wrapState(){
    if(window.stateBlob && !window.stateBlob._v32){
      var old=window.stateBlob;
      window.stateBlob=function(){ var b=old.apply(this,arguments)||{}; ensureData(); DATA_KEYS.forEach(function(k){ b[k]=window[k]; }); return b; };
      window.stateBlob._v32=true;
    }
    if(window.applyState && !window.applyState._v32){
      var oldA=window.applyState;
      window.applyState=function(d){ var r=oldA.apply(this,arguments); try{ ensureData(); if(d&&typeof d==='object'){ DATA_KEYS.forEach(function(k){ if(Array.isArray(d[k])){ window[k].splice(0,window[k].length); Array.prototype.push.apply(window[k],d[k]); } }); } }catch(e){} return r; };
      window.applyState._v32=true;
    }
  }
  function persistV32(){ try{ if(typeof persist==='function') persist(); }catch(e){} }

  function installAlertLayer(){
    if(window._caseNativeAlert) return;
    window._caseNativeAlert = window.alert ? window.alert.bind(window) : function(){};
    window.alert = function(msg){ modal(tr('validation'), '<div style="white-space:pre-wrap;font-size:13px;line-height:1.45;color:var(--ink)">'+h(msg)+'</div>', '<button class="btn" onclick="v32CloseModal()">OK</button>'); };
  }

  function applyTranslation(root){
    if(lang()==='ru') return;
    var map=EXACT[lang()]||{};
    root=root||document.getElementById('main')||document.body;
    try{
      var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(node){
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p=node.parentNode; if(!p) return NodeFilter.FILTER_REJECT;
        if(['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].indexOf(p.nodeName)>=0) return NodeFilter.FILTER_REJECT;
        if(node.nodeValue.trim().length>80) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }});
      var n, list=[]; while((n=walker.nextNode())) list.push(n);
      list.forEach(function(n){ var s=n.nodeValue.trim(); if(map[s]) n.nodeValue=n.nodeValue.replace(s,map[s]); });
      root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function(el){
        ['placeholder','title','aria-label'].forEach(function(a){ var v=el.getAttribute(a); if(v&&map[v]) el.setAttribute(a,map[v]); });
      });
    }catch(e){}
  }
  function wrapRender(name,after){
    var old=window[name]; if(typeof old!=='function'||old._v32) return;
    window[name]=function(){ var r=old.apply(this,arguments); try{ after&&after(); applyTranslation(); localizePracticeCards(); }catch(e){ console.warn('v32 render hook',name,e); } return r; };
    window[name]._v32=true;
  }

  function issues(){
    var arr=[]; try{ arr=Array.isArray(U)?U:[]; }catch(e){}
    var my=arr.filter(function(u){ if(canManage()) return true; var b=brokerName(); return !b || u.broker===b; });
    var active=my.filter(function(u){ return ['neg','off','os','cs','res'].indexOf(u.status)>=0; });
    var noNext=active.filter(function(u){ return !(u.nextAction||u.next_action) && !(u.dates&&u.dates.length); });
    var overdue=active.filter(function(u){ var d=(u.dates&&u.dates[0]&&u.dates[0][1])||u.nextActionDate||u.next_action_date; return d && d<todayISO(); });
    var noBroker=active.filter(function(u){ return !u.broker; });
    var below=active.filter(function(u){ return (+u.rate||0) < (+u.budget||+u.rate||0); });
    return {active:active,noNext:noNext,overdue:overdue,noBroker:noBroker,below:below};
  }
  function allBonusRows(){
    ensureData();
    var rows=[];
    (window.BRAND_REQUESTS||[]).forEach(function(r){ rows.push({kind:tr('requests'),broker:r.broker||'',name:r.brand,stage:r.stage,earned:0,pipeline:+r.potentialFee||0,weighted:(+r.potentialFee||0)*(r.stage==='won'?1:r.stage==='matching'?0.45:r.stage==='offer'?0.65:0.25),lost:r.stage==='lost'?(+r.potentialFee||0):0}); });
    (window.INVESTOR_REQUESTS||[]).forEach(function(r){ var c=+r.potentialFee||0; var prob={new:.2,matching:.4,nda:.5,dd:.6,offer:.7,spa:.85,won:1,closed:1,lost:0}[r.stage]||.25; rows.push({kind:tr('investorLeads'),broker:r.broker||'',name:r.investor,stage:r.stage,earned:(r.stage==='won'||r.stage==='closed')?c:0,pipeline:(r.stage==='won'||r.stage==='closed')?0:c,weighted:c*prob,lost:r.stage==='lost'?c:0}); });
    (window.SALES_ASSETS||[]).forEach(function(a){ var c=(+a.expectedCommission)||((+a.price||0)*(+a.commissionRate||0)/100); var prob={lead:.2,nda:.35,dd:.55,offer:.7,spa:.85,closed:1,lost:0}[a.stage]||.25; rows.push({kind:tr('sales'),broker:a.broker||'',name:a.name,stage:a.stage,earned:a.stage==='closed'?c:0,pipeline:a.stage==='closed'?0:c,weighted:c*prob,lost:a.stage==='lost'?c:0}); });
    if(!canManage()){ var b=brokerName(); rows=rows.filter(function(r){ return !r.broker || r.broker===b || r.broker===userName(); }); }
    return rows;
  }
  function sum(rows,key){ return rows.reduce(function(s,r){ return s+(+r[key]||0); },0); }

  function hubHTML(){
    ensureData(); var is=issues(), rows=allBonusRows();
    var cards=[
      ['action',tr('action'),tr('roleFocus'),"go('v32_action')"],
      ['requests',tr('requests'),tr('inbound')+': '+window.BRAND_REQUESTS.length,"go('v32_requests')"],
      ['investors',tr('investorLeads'),tr('investmentDemand')+': '+window.INVESTOR_REQUESTS.length,"go('v32_investors')"],
      ['sales',tr('sales'),tr('salePipeline')+': '+window.SALES_ASSETS.length,"go('v32_sales')"],
      ['partners',tr('partners'),tr('partnerDeals')+': '+window.CASE_PARTNERS.length,"go('v32_partners')"]
    ];
    return '<div class="v32-card v32-hub"><div class="v32-head"><div><div class="v32-eyebrow">CASE OS v4.9.3</div><h2>'+h(tr('action'))+'</h2><p>'+h(tr('routeHint'))+'</p></div><div><span class="v32-pill">'+h(tr('qaAbbr'))+'</span><span class="v32-pill">'+h(tr('offerAbbr'))+'</span><span class="v32-pill">'+h(tr('ddAbbr'))+'</span></div></div>'+
      '<div class="v32-kpis"><div class="v32-kpi '+(is.overdue.length?'bad':'')+'"><small>'+h(tr('tasksToday'))+'</small><b>'+is.overdue.length+'</b></div><div class="v32-kpi"><small>'+h(tr('requests'))+'</small><b>'+window.BRAND_REQUESTS.length+'</b></div><div class="v32-kpi"><small>'+h(tr('investorLeads'))+'</small><b>'+window.INVESTOR_REQUESTS.length+'</b></div><div class="v32-kpi"><small>'+h(tr('sales'))+'</small><b>'+window.SALES_ASSETS.length+'</b></div><div class="v32-kpi"><small>'+h(tr('coming'))+'</small><b>'+money(sum(rows,'pipeline'))+'</b></div><div class="v32-kpi"><small>'+h(tr('weighted'))+'</small><b>'+money(sum(rows,'weighted'))+'</b></div></div>'+
      '<div class="v32-grid" style="margin-top:12px">'+cards.map(function(c){ return '<div class="v32-mini" onclick="'+c[3]+'"><small>'+h(c[0])+'</small><b>'+h(c[1])+'</b><span>'+h(c[2])+'</span></div>'; }).join('')+'</div></div>';
  }
  function injectDashboard(){ var main=document.getElementById('main'); if(!main||main.querySelector('.v32-hub')){ localizePracticeCards(); return; } var after=main.querySelector('.v31-practice-card')||main.querySelector('.v3-cockpit')||main.querySelector('.ph'); if(after) after.insertAdjacentHTML('afterend',hubHTML()); else main.insertAdjacentHTML('afterbegin',hubHTML()); localizePracticeCards(); }


  function localizePracticeCards(){
    try{
      var L=lang();
      var labels={
        ru:['ПОРТФЕЛЬ','СДЕЛКИ','ПОДБОР','КАРТА / ПЛАН','КД','МОТИВАЦИЯ'],
        uz:['PORTFEL','BITIM','MATCHING','XARITA / PLAN','MS','MOTIVATSIYA'],
        en:['PORTFOLIO QA','DEAL MGT','TENANT MATCH','LOCATION INTEL','QA','MOTIVATION']
      }[L]||[];
      document.querySelectorAll('.v31-practice-card').forEach(function(card){
        var h2=card.querySelector('h2'); if(h2) h2.textContent=L==='ru'?'Операционный слой best-practice':(L==='uz'?'Best-practice operatsion qatlami':'Best-practice operating layer');
        var eye=card.querySelector('.v3-eyebrow'); if(eye) eye.textContent=L==='ru'?'ПРАКТИКА JLL / CBRE / C&W':(L==='uz'?'JLL / CBRE / C&W AMALIYOTI':'JLL / CBRE / C&W PRACTICE');
        card.querySelectorAll('.v31-practice-item small').forEach(function(sm,i){ if(labels[i]) sm.textContent=labels[i]; });
      });
    }catch(e){}
  }

  function installNav(){
    var old=window.buildNav; if(typeof old!=='function'||old._v32) return;
    window.buildNav=function(){ var r=old.apply(this,arguments); try{ appendNav(); }catch(e){} return r; };
    window.buildNav._v32=true;
  }
  function appendNav(){
    var nav=document.getElementById('nav'); if(!nav||nav.querySelector('.v32-nav-extra')) return;
    var links=[['v32_action','◎',tr('action')],['v32_requests','✉',tr('requests')],['v32_investors','◈',tr('investorLeads')],['v32_sales','◆',tr('sales')],['v32_partners','◇',tr('partners')]];
    if(typeof window.caseWorkspaceCanOpen==='function') links=links.filter(function(x){return window.caseWorkspaceCanOpen(x[0]);});
    var html='<div class="v32-nav-extra"><div class="sep">CASE OS 4.9.3</div>'+links.map(function(x){return '<a data-v="'+x[0]+'" class="'+((window.S&&S.view===x[0])?'active':'')+'" onclick="go(\''+x[0]+'\')"><span class="ic">'+x[1]+'</span> '+h(x[2])+'</a>';}).join('')+'</div>';
    nav.insertAdjacentHTML('beforeend',html);
  }
  function installGo(){
    var old=window.go; if(typeof old!=='function'||old._v32) return;
    window.go=function(v){
      if(['v32_action','v32_requests','v32_investors','v32_demand','v32_sales','v32_partners'].indexOf(v)>=0){ renderV32(v); return; }
      return old.apply(this,arguments);
    };
    window.go._v32=true;
  }
  function renderV32(v){
    ensureData(); try{ S.view=v; }catch(e){}
    var side=document.getElementById('side'), scrim=document.getElementById('scrim'); if(side)side.classList.remove('open'); if(scrim)scrim.classList.remove('open');
    document.querySelectorAll('#nav a').forEach(function(a){ a.classList.toggle('active',a.dataset.v===v); });
    var main=document.getElementById('main'); if(!main) return;
    if(v==='v32_action') main.innerHTML=renderAction();
    if(v==='v32_requests') main.innerHTML=renderRequests();
    if(v==='v32_investors') main.innerHTML=renderInvestors();
    if(v==='v32_demand') main.innerHTML=renderDemand();
    if(v==='v32_sales') main.innerHTML=renderSales();
    if(v==='v32_partners') main.innerHTML=renderPartners();
    applyTranslation(main);
    try{ saveUiPrefs(); }catch(e){}
  }

  function renderDemand(){ ensureData(); var tab=(window.V32_DEMAND_TAB==='rent')?'rent':'buy';
    function tb(k,label){ return '<button onclick="window.V32_DEMAND_TAB=\''+k+'\';go(\'v32_demand\')" style="font-family:inherit;font-size:13px;font-weight:600;padding:7px 14px;border:1px solid var(--border);border-radius:9px;cursor:pointer;margin-right:6px;'+(tab===k?'background:var(--red-d,#a3132a);color:#fff;border-color:var(--red-d,#a3132a)':'background:var(--panel,#fff);color:var(--muted)')+'">'+h(label)+'</button>'; }
    var tabs='<div style="margin:0 0 8px;display:flex;flex-wrap:wrap;gap:4px">'+tb('buy','Покупка · инвесторы')+tb('rent','Аренда · запросы брендов')+'</div>';
    return tabs+(tab==='rent'?renderRequests():renderInvestors()); }
  function pageHead(title,sub,btns){ return '<div class="ph"><h1>'+h(title)+'</h1></div><p class="sub">'+h(sub||'')+'</p>'+(btns?'<div class="v32-tools" style="margin:8px 0 10px"><div></div><div>'+btns+'</div></div>':''); }
  function visibleRows(rows){ if(canManage()) return rows; var b=brokerName(), u=userName(); return rows.filter(function(r){ return !r.broker || r.broker===b || r.broker===u || r.owner===b || r.owner===u || r.visibility==='partners'; }); }
  function actionRowsHTML(){ var is=issues(), rows=allBonusRows(); var tasks=[]; is.overdue.slice(0,8).forEach(function(u){ tasks.push([tr('tasksToday'),u.code,(u.dates&&u.dates[0]&&u.dates[0][0])||tr('nextAction'),u.broker||'-']); }); window.BRAND_REQUESTS.filter(function(r){return r.due&&r.due<=addDays(7);}).slice(0,8).forEach(function(r){tasks.push([tr('requests'),r.brand,r.nextAction||'-',r.broker||'-']);}); window.INVESTOR_REQUESTS.filter(function(r){return r.due&&r.due<=addDays(7);}).slice(0,8).forEach(function(r){tasks.push([tr('investorLeads'),r.investor,r.nextAction||'-',r.broker||'-']);}); window.SALES_ASSETS.filter(function(a){return a.due&&a.due<=addDays(7);}).slice(0,8).forEach(function(a){tasks.push([tr('sales'),a.name,a.nextAction||'-',a.broker||'-']);});
    return '<div class="v32-split"><div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">ACTION</div><h3>'+h(tr('tasksToday'))+'</h3></div></div>'+(tasks.length?'<table class="v32-table"><tr><th>'+h(tr('source'))+'</th><th>'+h(tr('property'))+' / '+h(tr('brand'))+'</th><th>'+h(tr('nextAction'))+'</th><th>'+h(tr('broker'))+'</th></tr>'+tasks.map(function(t){return '<tr><td>'+h(t[0])+'</td><td><b>'+h(t[1])+'</b></td><td>'+h(t[2])+'</td><td>'+h(t[3])+'</td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div><div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">BONUS</div><h3>'+(canManage()?h(tr('teamBonus')):h(tr('myBonus')))+'</h3></div></div><div class="v32-kpis" style="grid-template-columns:1fr 1fr"><div class="v32-kpi"><small>'+h(tr('earned'))+'</small><b>'+money(sum(rows,'earned'))+'</b></div><div class="v32-kpi"><small>'+h(tr('coming'))+'</small><b>'+money(sum(rows,'pipeline'))+'</b></div><div class="v32-kpi"><small>'+h(tr('weighted'))+'</small><b>'+money(sum(rows,'weighted'))+'</b></div><div class="v32-kpi bad"><small>'+h(tr('lost'))+'</small><b>'+money(sum(rows,'lost'))+'</b></div></div></div></div>'; }
  function renderAction(){
    ensureData();
    return pageHead(tr('action'),'CASE OS v4.9.3 · '+tr('roleFocus'))+hubHTML()+actionRowsHTML()+footSafe();
  }

  function stageLabel(s){ var m={new:'New',matching:'Matching',offer:'Offer',won:'Won',lost:'Lost',lead:'Lead',nda:'NDA',dd:'DD',spa:'SPA',closed:'Closed',active:'Active'}; return m[s]||s||'-'; }
  function filterText(rows,key){ var q=(key==='v32ReqQ'?window.V32_REQ_Q:(key==='v32InvQ'?window.V32_INV_Q:(document.getElementById(key)||{}).value)); q=String(q||'').toLowerCase().trim(); if(!q) return rows; return rows.filter(function(r){ return JSON.stringify(r).toLowerCase().indexOf(q)>=0; }); }

  function renderInvestors(){
    ensureData(); var rows=visibleRows(window.INVESTOR_REQUESTS); rows=filterText(rows,'v32InvQ'); var bonus=allBonusRows().filter(function(r){return r.kind===tr('investorLeads');});
    return pageHead(tr('investorLeads'),tr('investorLeadsSub'),'<button class="btn" onclick="v32InvestorForm()">+ '+h(tr('addInvestorLead'))+'</button> <button class="btn ghost" onclick="go(\'v32_sales\')">'+h(tr('sales'))+'</button>')+
      '<div class="v32-card"><div class="v32-tools"><input id="v32InvQ" value="'+h(window.V32_INV_Q||'')+'" placeholder="'+h(tr('search'))+'" oninput="window.V32_INV_Q=this.value;go(\'v32_investors\')"><div><span class="v32-pill">'+h(tr('budgetMin'))+' / '+h(tr('budgetMax'))+'</span><span class="v32-pill">'+h(tr('weighted'))+': '+money(sum(bonus,'weighted'))+'</span><span class="v32-pill">'+h(tr('fee'))+': '+money(sum(rows,'potentialFee'))+'</span></div></div>'+ 
      (rows.length?'<table class="v32-table"><tr><th>'+h(tr('investor'))+'</th><th>'+h(tr('country'))+' / '+h(tr('city'))+'</th><th>'+h(tr('assetType'))+'</th><th>'+h(tr('budget'))+'</th><th>'+h(tr('areaMin'))+'-'+h(tr('areaMax'))+'</th><th>'+h(tr('capRate'))+'</th><th>'+h(tr('stage'))+'</th><th>'+h(tr('nextAction'))+'</th><th>'+h(tr('broker'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+rows.map(function(r){return '<tr><td><b>'+h(r.investor)+'</b><div class="mut">'+h(r.source||'')+' · '+h(r.contact||'')+'</div></td><td>'+h(r.country||'-')+'<br><span class="mut">'+h(r.city||'-')+'</span></td><td>'+h(r.assetType||'-')+'</td><td>'+money(r.budgetMin||0)+' - '+money(r.budgetMax||0)+'<div class="mut">'+h(tr('fee'))+': '+money(r.potentialFee||0)+'</div></td><td>'+h(r.areaMin||'-')+' - '+h(r.areaMax||'-')+'</td><td>'+h(r.capRate||'-')+'<div class="mut">'+h(tr('proofFunds'))+': '+h(r.proofFunds||'-')+'</div></td><td>'+h(stageLabel(r.stage))+'</td><td>'+h(r.nextAction||'-')+'<div class="mut">'+h(r.due||'')+'</div></td><td>'+h(r.broker||'-')+'</td><td><button class="btn ghost sm" onclick="v32MatchInvestor(\''+r.id+'\')">'+h(tr('matchAssets'))+'</button> <button class="btn ghost sm" onclick="v32InvestorToBuyer(\''+r.id+'\')">'+h(tr('convertBuyer'))+'</button> <button class="btn ghost sm" onclick="v32InvestorForm(\''+r.id+'\')">'+h(tr('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'+footSafe();
  }

  function renderRequests(){
    ensureData(); var rows=visibleRows(window.BRAND_REQUESTS); rows=filterText(rows,'v32ReqQ');
    return pageHead(tr('requests'),tr('requestsSub'),'<button class="btn" onclick="v32RequestForm()">+ '+h(tr('addRequest'))+'</button>')+
      '<div class="v32-card"><div class="v32-tools"><input id="v32ReqQ" value="'+h(window.V32_REQ_Q||'')+'" placeholder="'+h(tr('search'))+'" oninput="window.V32_REQ_Q=this.value;go(\'v32_requests\')"><div><span class="v32-pill">'+h(tr('areaMin'))+' / '+h(tr('areaMax'))+'</span><span class="v32-pill">'+h(tr('fee'))+': '+money(sum(rows,'potentialFee'))+'</span></div></div>'+
      (rows.length?'<table class="v32-table"><tr><th>'+h(tr('brand'))+'</th><th>'+h(tr('country'))+' / '+h(tr('city'))+'</th><th>'+h(tr('category'))+'</th><th>'+h(tr('areaMin'))+'</th><th>'+h(tr('areaMax'))+'</th><th>'+h(tr('budget'))+'</th><th>'+h(tr('stage'))+'</th><th>'+h(tr('nextAction'))+'</th><th>'+h(tr('broker'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+rows.map(function(r){return '<tr><td><b>'+h(r.brand)+'</b><div class="mut">'+h(r.source||'')+'</div></td><td>'+h(r.country||'-')+'<br><span class="mut">'+h(r.city||'-')+'</span></td><td>'+h(r.category||'-')+'</td><td>'+h(r.areaMin||'-')+'</td><td>'+h(r.areaMax||'-')+'</td><td>'+h(r.budgetMax?('$'+r.budgetMax+'/m²'):'-')+'<div class="mut">'+h(tr('fee'))+': '+money(r.potentialFee||0)+'</div></td><td>'+h(stageLabel(r.stage))+'</td><td>'+h(r.nextAction||'-')+'<div class="mut">'+h(r.due||'')+'</div></td><td>'+h(r.broker||'-')+'</td><td><button class="btn ghost sm" onclick="v32MatchRequest(\''+r.id+'\')">'+h(tr('match'))+'</button> <button class="btn ghost sm" onclick="v32RequestForm(\''+r.id+'\')">'+h(tr('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'+footSafe();
  }
  /* ── SCR = структура как LCR: поюнитный реестр продаж (те же юниты U) + план продаж + инвест-объекты ── */
  var SCRL={
   ru:{reg:'Реестр продаж',plan:'Планировка продаж',assets:'Инвест-объекты (целиком)',price:'Цена $/м²',sum:'Сумма продажи',sstatus:'Статус продажи',avg:'Ср. цена $/м²',portfolio:'Портфель продаж, $',units:'Юнитов',code:'Код',block:'Блок',floor:'Этаж',cat:'Категория',area:'Площадь м²',broker:'Брокер',selObj:'Выберите конкретный объект в шапке, чтобы вести поюнитный реестр продаж.',noUnits:'В объекте пока нет помещений. Реестр общий с «Контроль аренды (LCR)» — добавьте помещения там или сгенерируйте с плана.',openPlan:'Открыть план продаж →',assetsHint:'Продажа объектов целиком (инвесторам): NDA, due diligence, оферта, SPA, закрытие.'},
   uz:{reg:'Sotuv reestri',plan:'Sotuv planirovkasi',assets:'Invest-obyektlar (butun)',price:'Narx $/m²',sum:'Sotuv summasi',sstatus:'Sotuv holati',avg:'Oʻrt. narx $/m²',portfolio:'Sotuv portfeli, $',units:'Yunitlar',code:'Kod',block:'Blok',floor:'Qavat',cat:'Toifa',area:'Maydon m²',broker:'Broker',selObj:'Poyunit sotuv reestri uchun tepada aniq obyekt tanlang.',noUnits:'Obyektda hozircha xonalar yoʻq. Reestr «Ijara nazorati (LCR)» bilan umumiy.',openPlan:'Sotuv planini ochish →',assetsHint:'Obyektlarni butunligicha sotish (investorlarga): NDA, DD, oferta, SPA.'},
   en:{reg:'Sales register',plan:'Sales floor plan',assets:'Investment assets (whole)',price:'Price $/m²',sum:'Sale total',sstatus:'Sale status',avg:'Avg price $/m²',portfolio:'Sales portfolio, $',units:'Units',code:'Code',block:'Block',floor:'Floor',cat:'Category',area:'Area m²',broker:'Broker',selObj:'Pick a specific property in the header to run the per-unit sales register.',noUnits:'No units yet. The register is shared with Lease Control (LCR).',openPlan:'Open sales plan →',assetsHint:'Selling whole assets to investors: NDA, due diligence, offer, SPA, closing.'}
  };
  function scrT(k){var L=lang();return (SCRL[L]&&SCRL[L][k])||SCRL.ru[k]||k;}
  function scrCanEdit(){try{var r=rights();return !!(r.edit||r.admin);}catch(e){return false;}}
  function scrUnits(){try{var oid=(typeof S==='object'&&S.obj)?S.obj:'ALL';var all=(typeof U!=='undefined'&&Array.isArray(U))?U:[];return oid==='ALL'?all.slice():all.filter(function(u){return u.obj===oid;});}catch(e){return [];}}
  function scrSaleOf(u){try{return (typeof saleOf==='function')?saleOf(u):(u.saleStatus||'savail');}catch(e){return u.saleStatus||'savail';}}
  function scrSaleLabel(s){try{return (typeof ssT==='function')?ssT(s):s;}catch(e){return s;}}
  function scrFloor(u){try{return (typeof floorLabel==='function')?floorLabel(u.floor):(u.floor||'');}catch(e){return u.floor||'';}}
  function scrBlock(u){try{return (typeof unitBlock==='function')?unitBlock(u):(u.block||'');}catch(e){return u.block||'';}}
  var SCR_SALE_STS=[['savail','Свободно'],['sresv','Бронь'],['sdeal','Договор/задаток'],['ssold','Продано']];
  function scrRegistry(){
    var oid=(typeof S==='object'&&S.obj)?S.obj:'ALL';
    if(oid==='ALL')return '<div class="v32-card"><div class="v32-empty">'+h(scrT('selObj'))+'</div></div>';
    var units=scrUnits(), canEdit=scrCanEdit();
    var sold=0,resv=0,deal=0,avail=0,portfolio=0,priceSum=0,priceN=0;
    units.forEach(function(u){var st=scrSaleOf(u);if(st==='ssold')sold++;else if(st==='sresv')resv++;else if(st==='sdeal')deal++;else avail++;var pr=+u.salePrice||0,ar=+u.area||0;if(pr>0){portfolio+=pr*ar;priceSum+=pr;priceN++;}});
    var avg=priceN?Math.round(priceSum/priceN):0;
    var kpis='<div class="v32-card"><div class="v32-kpis">'
      +'<div class="v32-kpi"><small>'+h(scrT('units'))+'</small><b>'+units.length+'</b></div>'
      +'<div class="v32-kpi"><small>Свободно</small><b>'+avail+'</b></div>'
      +'<div class="v32-kpi"><small>Бронь</small><b>'+resv+'</b></div>'
      +'<div class="v32-kpi"><small>Договор</small><b>'+deal+'</b></div>'
      +'<div class="v32-kpi"><small>Продано</small><b>'+sold+'</b></div>'
      +'<div class="v32-kpi"><small>'+h(scrT('avg'))+'</small><b>'+money(avg)+'</b></div>'
      +'<div class="v32-kpi"><small>'+h(scrT('portfolio'))+'</small><b>'+money(Math.round(portfolio))+'</b></div>'
      +'</div></div>';
    if(!units.length)return kpis+'<div class="v32-card"><div class="v32-empty">'+h(scrT('noUnits'))+'</div></div>';
    var rows=units.map(function(u){
      var st=scrSaleOf(u),pr=+u.salePrice||0,ar=+u.area||0,total=Math.round(pr*ar);
      var stCell=canEdit
        ?'<select onchange="scrSetSaleStatus(\''+u.id+'\',this.value)" style="font-family:inherit;font-size:11px;font-weight:700;padding:4px 6px;border:1px solid var(--border,#ccc);border-radius:7px">'+SCR_SALE_STS.map(function(o){return '<option value="'+o[0]+'"'+(st===o[0]?' selected':'')+'>'+h(o[1])+'</option>';}).join('')+'</select>'
        :h(scrSaleLabel(st));
      var prCell=canEdit
        ?'<input type="number" min="0" step="1" value="'+(pr||'')+'" onchange="scrSetSalePrice(\''+u.id+'\',this.value)" style="width:92px;font-family:inherit;font-size:12px;padding:5px 7px;border:1px solid var(--border,#ccc);border-radius:7px" placeholder="—">'
        :(pr?money(pr):'—');
      return '<tr><td><b>'+h(u.code||'')+'</b></td><td>'+h(scrBlock(u)||'-')+'</td><td>'+h(scrFloor(u)||'-')+'</td><td>'+h(u.cat||'-')+'</td><td>'+h(ar||'-')+'</td><td>'+prCell+'</td><td><b>'+(total?money(total):'—')+'</b></td><td>'+stCell+'</td><td>'+h(u.broker||'-')+'</td></tr>';
    }).join('');
    return kpis+'<div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">SALES REGISTER (SCR)</div><h3>'+h((typeof objById==='function'?((objById(oid)||{}).name||oid):oid))+'</h3></div><div><button class="btn ghost sm" onclick="try{S.planMode=\'sale\';}catch(e){}go(\'plans\')">▭ '+h(scrT('plan'))+'</button></div></div><div class="tbl-scroll"><table class="v32-table"><tr><th>'+h(scrT('code'))+'</th><th>'+h(scrT('block'))+'</th><th>'+h(scrT('floor'))+'</th><th>'+h(scrT('cat'))+'</th><th>'+h(scrT('area'))+'</th><th>'+h(scrT('price'))+'</th><th>'+h(scrT('sum'))+'</th><th>'+h(scrT('sstatus'))+'</th><th>'+h(scrT('broker'))+'</th></tr>'+rows+'</table></div></div>';
  }
  function renderSaleAssets(){
    var assets=visibleRows(window.SALES_ASSETS), buyers=visibleRows(window.SALES_BUYERS), bonus=allBonusRows().filter(function(r){return r.kind===tr('sales');});
    var tools='<div class="v32-tools" style="margin:0 0 10px"><div class="mut" style="font-size:12px;color:var(--muted)">'+h(scrT('assetsHint'))+'</div><div><button class="btn" onclick="v32AssetForm()">+ '+h(tr('addAsset'))+'</button> <button class="btn ghost" onclick="v32BuyerForm()">+ '+h(tr('addBuyer'))+'</button> <button class="btn ghost" onclick="go(\'v32_investors\')">'+h(tr('investorLeads'))+'</button></div></div>';
    return tools+
      '<div class="v32-card"><div class="v32-kpis"><div class="v32-kpi"><small>'+h(tr('property'))+'</small><b>'+assets.length+'</b></div><div class="v32-kpi"><small>'+h(tr('investorLeads'))+'</small><b>'+window.INVESTOR_REQUESTS.length+'</b></div><div class="v32-kpi"><small>'+h(tr('buyer'))+'</small><b>'+buyers.length+'</b></div><div class="v32-kpi"><small>'+h(tr('commission'))+'</small><b>'+money(sum(assets,'expectedCommission'))+'</b></div><div class="v32-kpi"><small>'+h(tr('weighted'))+'</small><b>'+money(sum(bonus,'weighted'))+'</b></div><div class="v32-kpi bad"><small>'+h(tr('lost'))+'</small><b>'+money(sum(bonus,'lost'))+'</b></div></div></div>'+
      '<div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">SALE ASSETS</div><h3>'+h(tr('property'))+'</h3></div></div>'+(assets.length?'<table class="v32-table"><tr><th>'+h(tr('property'))+'</th><th>'+h(tr('city'))+'</th><th>'+h(tr('areaMin'))+'</th><th>'+h(tr('price'))+'</th><th>'+h(tr('stage'))+'</th><th>'+h(tr('nextAction'))+'</th><th>'+h(tr('broker'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+assets.map(function(a){return '<tr><td><b>'+h(a.name)+'</b><div class="mut">'+h(a.type||'')+' · '+h(a.visibility||'')+'</div></td><td>'+h(a.country||'')+'<br><span class="mut">'+h(a.city||'')+'</span></td><td>'+h(a.area||'-')+'</td><td>'+money(a.price||0)+'<div class="mut">'+h(tr('commission'))+': '+money(a.expectedCommission||((+a.price||0)*(+a.commissionRate||0)/100))+'</div></td><td>'+h(stageLabel(a.stage))+'</td><td>'+h(a.nextAction||'-')+'<div class="mut">'+h(a.due||'')+'</div></td><td>'+h(a.broker||'-')+'</td><td><button class="btn ghost sm" onclick="v32MatchBuyers(\''+a.id+'\')">'+h(tr('match'))+'</button> <button class="btn ghost sm" onclick="v32AssetForm(\''+a.id+'\')">'+h(tr('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'+
      '<div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">BUYERS</div><h3>'+h(tr('buyer'))+'</h3></div></div>'+(buyers.length?'<table class="v32-table"><tr><th>'+h(tr('buyer'))+'</th><th>'+h(tr('country'))+' / '+h(tr('city'))+'</th><th>'+h(tr('budget'))+'</th><th>'+h(tr('areaMin'))+'-'+h(tr('areaMax'))+'</th><th>'+h(tr('broker'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+buyers.map(function(b){return '<tr><td><b>'+h(b.name)+'</b><div class="mut">'+h(b.assetType||'')+'</div></td><td>'+h(b.country||'')+'<br><span class="mut">'+h(b.city||'')+'</span></td><td>'+money(b.budgetMin||0)+' - '+money(b.budgetMax||0)+'</td><td>'+h(b.areaMin||'-')+' - '+h(b.areaMax||'-')+'</td><td>'+h(b.broker||'-')+'</td><td><button class="btn ghost sm" onclick="v32BuyerForm(\''+b.id+'\')">'+h(tr('edit'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>';
  }
  function renderSales(){
    ensureData();
    var tab=window.SCR_TAB||'reg';
    var tb=function(k,ic,lbl){return '<button class="'+(tab===k?'on':'')+'" onclick="scrTab(\''+k+'\')">'+ic+' '+h(lbl)+'</button>';};
    var tabbar='<div class="tabs" style="margin-bottom:10px">'+tb('reg','▤',scrT('reg'))+tb('plan','▭',scrT('plan'))+tb('assets','◆',scrT('assets'))+'</div>';
    var head=pageHead(tr('sales'),tr('salesSub'),'');
    if(tab==='assets')return head+tabbar+renderSaleAssets()+footSafe();
    if(tab==='plan')return head+tabbar+'<div class="v32-card"><h3>'+h(scrT('plan'))+'</h3><p class="sub" style="margin:6px 0 12px">Интерактивный план объекта, раскрашенный по статусу продажи юнитов (свободно / бронь / договор / продано). Тот же движок, что в LCR.</p><button class="btn" onclick="try{S.planMode=\'sale\';}catch(e){}go(\'plans\')">'+h(scrT('openPlan'))+'</button></div>'+footSafe();
    return head+tabbar+scrRegistry()+footSafe();
  }
  window.scrTab=function(t){window.SCR_TAB=t;try{go('v32_sales');}catch(e){}};
  window.scrSetSaleStatus=function(id,v){try{var u=(Array.isArray(U)?U:[]).find(function(x){return x.id===id;});if(!u)return;u.saleStatus=v;if(typeof persist==='function')persist();else persistV32();try{if(typeof audit==='function')audit('SCR: статус продажи',(u.code||'')+' → '+v);}catch(e){}go('v32_sales');}catch(e){}};
  window.scrSetSalePrice=function(id,v){try{var u=(Array.isArray(U)?U:[]).find(function(x){return x.id===id;});if(!u)return;var p=Math.max(0,+String(v).replace(',','.')||0);u.salePrice=p;if(typeof persist==='function')persist();else persistV32();}catch(e){}};
  function renderPartners(){
    ensureData(); var rows=canManage()?window.CASE_PARTNERS:visibleRows(window.CASE_PARTNERS);
    return pageHead(tr('partners'),tr('partnersSub'),canManage()?'<button class="btn" onclick="v32PartnerForm()">+ '+h(tr('addPartner'))+'</button>':'')+
      '<div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">PARTNER PORTAL</div><h3>'+h(tr('partnerPortal'))+'</h3><p>'+h(canManage()?tr('partnersSub'):tr('limitedPartner'))+'</p></div></div>'+(rows.length?'<table class="v32-table"><tr><th>'+h(tr('partners'))+'</th><th>'+h(tr('country'))+' / '+h(tr('city'))+'</th><th>'+h(tr('access'))+'</th><th>'+h(tr('scope'))+'</th><th>'+h(tr('broker'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+rows.map(function(p){return '<tr><td><b>'+h(p.name)+'</b><div class="mut">'+h(p.type||'')+' · '+h(p.status||'')+'</div></td><td>'+h(p.country||'')+'<br><span class="mut">'+h(p.city||'')+'</span></td><td>'+h(p.access||'')+'</td><td>'+h(p.scope||'')+'</td><td>'+h(p.owner||'-')+'</td><td>'+(canManage()?'<button class="btn ghost sm" onclick="v32PartnerForm(\''+p.id+'\')">'+h(tr('edit'))+'</button>':'<span class="v32-pill">'+h(tr('private'))+'</span>')+'</td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'+footSafe();
  }
  function footSafe(){ try { return footNote(); } catch(e) { return '<div class="foot">CASE OS v4.9.3</div>'; } }

  function formInput(label,idv,value,type){ return '<label>'+h(label)+'</label><input id="'+idv+'" type="'+(type||'text')+'" value="'+h(value||'')+'">'; }
  function formText(label,idv,value){ return '<label>'+h(label)+'</label><textarea id="'+idv+'">'+h(value||'')+'</textarea>'; }
  function formSelect(label,idv,value,opts){ return '<label>'+h(label)+'</label><select id="'+idv+'">'+opts.map(function(o){ var v=Array.isArray(o)?o[0]:o, l=Array.isArray(o)?o[1]:o; return '<option value="'+h(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+h(l)+'</option>'; }).join('')+'</select>'; }
  function gv(idv){ var e=document.getElementById(idv); return e?e.value:''; }
  function num(idv){ return +String(gv(idv)).replace(',','.')||0; }

  window.v32RequestForm=function(rid){ ensureData(); var r=window.BRAND_REQUESTS.find(function(x){return x.id===rid;})||{}; var html='<div class="v32-form"><div class="v32-row2">'+formInput(tr('brand'),'rq_brand',r.brand)+formInput(tr('source'),'rq_source',r.source||'inbound')+'</div><div class="v32-row3">'+formInput(tr('country'),'rq_country',r.country||'Узбекистан')+formInput(tr('city'),'rq_city',r.city||'')+formInput(tr('category'),'rq_cat',r.category||'')+'</div><div class="v32-row3">'+formInput(tr('areaMin'),'rq_amin',r.areaMin,'number')+formInput(tr('areaMax'),'rq_amax',r.areaMax,'number')+formInput(tr('budget'),'rq_budget',r.budgetMax,'number')+'</div><div class="v32-row3">'+formSelect(tr('stage'),'rq_stage',r.stage||'new',[['new','New'],['matching','Matching'],['offer','Offer'],['won','Won'],['lost','Lost']])+formInput(tr('broker'),'rq_broker',r.broker||brokerName())+formInput(tr('fee'),'rq_fee',r.potentialFee,'number')+'</div>'+formInput(tr('nextAction'),'rq_next',r.nextAction||'')+formInput(tr('due'),'rq_due',r.due||addDays(3),'date')+formText(tr('preferences'),'rq_pref',r.preferences||'')+'</div>'; modal(rid?tr('edit'):tr('addRequest'),html,'<button class="btn ghost" onclick="v32CloseModal()">'+h(tr('cancel'))+'</button><button class="btn" onclick="v32SaveRequest(\''+(rid||'')+'\')">'+h(tr('save'))+'</button>'); };
  window.v32SaveRequest=function(rid){ ensureData(); var row={id:rid||id(),brand:gv('rq_brand').trim(),source:gv('rq_source').trim(),country:gv('rq_country').trim(),city:gv('rq_city').trim(),category:gv('rq_cat').trim(),areaMin:num('rq_amin'),areaMax:num('rq_amax'),budgetMax:num('rq_budget'),stage:gv('rq_stage'),broker:gv('rq_broker').trim(),potentialFee:num('rq_fee'),nextAction:gv('rq_next').trim(),due:gv('rq_due'),preferences:gv('rq_pref').trim(),createdAt:todayISO()}; if(!row.brand){toast(tr('needBrand'),'warn');return;} var i=window.BRAND_REQUESTS.findIndex(function(x){return x.id===row.id;}); if(i>=0) window.BRAND_REQUESTS[i]=Object.assign(window.BRAND_REQUESTS[i],row); else window.BRAND_REQUESTS.unshift(row); persistV32(); v32CloseModal(); go('v32_requests'); };
  window.v32MatchRequest=function(rid){ ensureData(); var r=window.BRAND_REQUESTS.find(function(x){return x.id===rid;}); if(!r)return; var units=[]; try{ units=(Array.isArray(U)?U:[]).filter(function(u){ var o=typeof objById==='function'?objById(u.obj):null; var cityOk=!r.city || !o || String(o.city||'').toLowerCase().indexOf(String(r.city).toLowerCase())>=0; var area=+u.area||0; var areaOk=(!r.areaMin||area>=r.areaMin)&&(!r.areaMax||area<=r.areaMax); var open=['vac','neg','off','res'].indexOf(u.status)>=0; return cityOk&&areaOk&&open; }).slice(0,20); }catch(e){}
    var html='<div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">MATCH</div><h3>'+h(r.brand)+'</h3><p>'+h(r.city||'-')+' · '+h(r.areaMin||0)+'-'+h(r.areaMax||0)+' m² · '+h(r.preferences||'')+'</p></div></div>'+(units.length?'<table class="v32-table"><tr><th>'+h(tr('property'))+'</th><th>'+h(tr('areaMin'))+'</th><th>'+h(tr('stage'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+units.map(function(u){ var o=typeof objById==='function'?objById(u.obj):{}; return '<tr><td><b>'+h((o&&o.name)||u.obj)+'</b><div class="mut">'+h(u.code)+' · '+h(u.floor||'')+'</div></td><td>'+h(u.area||'-')+'</td><td>'+h(u.status||'')+'</td><td><button class="btn ghost sm" onclick="v32RequestToUnit(\''+rid+'\',\''+u.id+'\')">'+h(tr('shortlist'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'; modal(tr('match'),html,'<button class="btn" onclick="v32CloseModal()">OK</button>'); };
  window.v32RequestToUnit=function(rid,uid){ var r=window.BRAND_REQUESTS.find(function(x){return x.id===rid;}), u=(Array.isArray(U)?U:[]).find(function(x){return x.id===uid;}); if(!r||!u)return; u.shortlist=u.shortlist||[]; if(u.shortlist.indexOf(r.brand)<0)u.shortlist.push(r.brand); u.vars=u.vars||[]; if(u.vars.indexOf(r.brand)<0)u.vars.push(r.brand); if(u.status==='vac')u.status='neg'; u.dates=u.dates||[]; if(r.due)u.dates.unshift([tr('requests')+': '+r.brand,r.due]); u.hist=u.hist||[]; u.hist.push([todayISO(),tr('requests')+': '+r.brand+' → '+tr('shortlist')+' ('+userName()+')']); r.stage='matching'; persistV32(); toast(tr('shortlist')+': '+r.brand,'good'); v32CloseModal(); };

  window.v32InvestorForm=function(iid){ ensureData(); var r=window.INVESTOR_REQUESTS.find(function(x){return x.id===iid;})||{}; var html='<div class="v32-form"><div class="v32-row2">'+formInput(tr('investor'),'ir_investor',r.investor)+formInput(tr('source'),'ir_source',r.source||'inbound')+'</div><div class="v32-row3">'+formInput(tr('country'),'ir_country',r.country||'Узбекистан')+formInput(tr('city'),'ir_city',r.city||'')+formInput(tr('assetType'),'ir_type',r.assetType||'Street retail / leased unit')+'</div><div class="v32-row2">'+formInput(tr('budgetMin'),'ir_bmin',r.budgetMin,'number')+formInput(tr('budgetMax'),'ir_bmax',r.budgetMax,'number')+'</div><div class="v32-row2">'+formInput(tr('areaMin'),'ir_amin',r.areaMin,'number')+formInput(tr('areaMax'),'ir_amax',r.areaMax,'number')+'</div><div class="v32-row3">'+formInput(tr('capRate'),'ir_cap',r.capRate||'')+formSelect(tr('proofFunds'),'ir_pof',r.proofFunds||'pending',[['pending','Pending'],['confirmed','Confirmed'],['not_required','Not required']])+formInput(tr('contact'),'ir_contact',r.contact||'')+'</div><div class="v32-row3">'+formSelect(tr('stage'),'ir_stage',r.stage||'new',[['new','New'],['matching','Matching'],['nda','NDA'],['dd','DD'],['offer','Offer'],['spa','SPA'],['won','Won'],['lost','Lost']])+formInput(tr('broker'),'ir_broker',r.broker||brokerName())+formInput(tr('fee'),'ir_fee',r.potentialFee,'number')+'</div>'+formInput(tr('nextAction'),'ir_next',r.nextAction||'')+formInput(tr('due'),'ir_due',r.due||addDays(4),'date')+formText(tr('investmentCriteria'),'ir_pref',r.preferences||'')+'</div>'; modal(iid?tr('edit'):tr('addInvestorLead'),html,'<button class="btn ghost" onclick="v32CloseModal()">'+h(tr('cancel'))+'</button><button class="btn" onclick="v32SaveInvestor(\''+(iid||'')+'\')">'+h(tr('save'))+'</button>'); };
  window.v32SaveInvestor=function(iid){ ensureData(); var row={id:iid||id(),investor:gv('ir_investor').trim(),source:gv('ir_source').trim(),country:gv('ir_country').trim(),city:gv('ir_city').trim(),assetType:gv('ir_type').trim(),budgetMin:num('ir_bmin'),budgetMax:num('ir_bmax'),areaMin:num('ir_amin'),areaMax:num('ir_amax'),capRate:gv('ir_cap').trim(),proofFunds:gv('ir_pof'),contact:gv('ir_contact').trim(),stage:gv('ir_stage'),broker:gv('ir_broker').trim(),potentialFee:num('ir_fee'),nextAction:gv('ir_next').trim(),due:gv('ir_due'),preferences:gv('ir_pref').trim(),createdAt:todayISO()}; if(!row.investor){toast(tr('investor')+' — '+tr('required'),'warn');return;} var i=window.INVESTOR_REQUESTS.findIndex(function(x){return x.id===row.id;}); if(i>=0) window.INVESTOR_REQUESTS[i]=Object.assign(window.INVESTOR_REQUESTS[i],row); else window.INVESTOR_REQUESTS.unshift(row); persistV32(); v32CloseModal(); go('v32_investors'); };
  window.v32MatchInvestor=function(iid){ ensureData(); var r=window.INVESTOR_REQUESTS.find(function(x){return x.id===iid;}); if(!r)return; var assets=window.SALES_ASSETS.filter(function(a){ var price=+a.price||0, area=+a.area||0; var budgetOk=(!r.budgetMin||price>=r.budgetMin)&&(!r.budgetMax||price<=r.budgetMax); var areaOk=(!r.areaMin||area>=r.areaMin)&&(!r.areaMax||area<=r.areaMax); var cityOk=!r.city||!a.city||String(a.city).toLowerCase().indexOf(String(r.city).toLowerCase())>=0; var typeOk=!r.assetType||!a.type||String(a.type).toLowerCase().indexOf(String(r.assetType).toLowerCase().split('/')[0].trim())>=0||String(r.assetType).toLowerCase().indexOf(String(a.type).toLowerCase().split('/')[0].trim())>=0; return budgetOk&&areaOk&&cityOk&&typeOk; }).slice(0,20); var html='<div class="v32-card"><div class="v32-head"><div><div class="v32-eyebrow">INVESTMENT MATCH</div><h3>'+h(r.investor)+'</h3><p>'+h(r.city||'-')+' · '+money(r.budgetMin||0)+' - '+money(r.budgetMax||0)+' · '+h(r.capRate||'')+'</p></div></div>'+(assets.length?'<table class="v32-table"><tr><th>'+h(tr('property'))+'</th><th>'+h(tr('assetType'))+'</th><th>'+h(tr('areaMin'))+'</th><th>'+h(tr('price'))+'</th><th>'+h(tr('stage'))+'</th><th>'+h(tr('actions'))+'</th></tr>'+assets.map(function(a){return '<tr><td><b>'+h(a.name)+'</b><div class="mut">'+h(a.country||'')+' · '+h(a.city||'')+'</div></td><td>'+h(a.type||'-')+'</td><td>'+h(a.area||'-')+'</td><td>'+money(a.price||0)+'</td><td>'+h(stageLabel(a.stage))+'</td><td><button class="btn ghost sm" onclick="v32InvestorToAsset(\''+iid+'\',\''+a.id+'\')">'+h(tr('shortlist'))+'</button></td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'; modal(tr('matchAssets'),html,'<button class="btn" onclick="v32CloseModal()">OK</button>'); };
  window.v32InvestorToAsset=function(iid,aid){ var r=window.INVESTOR_REQUESTS.find(function(x){return x.id===iid;}), a=window.SALES_ASSETS.find(function(x){return x.id===aid;}); if(!r||!a)return; r.stage='matching'; r.assetIds=r.assetIds||[]; if(r.assetIds.indexOf(aid)<0)r.assetIds.push(aid); a.nextAction=a.nextAction||('Investor lead: '+r.investor); a.notes=(a.notes?String(a.notes)+'\n':'')+'Investor request: '+r.investor+' — '+(r.preferences||''); persistV32(); toast(tr('shortlist')+': '+r.investor+' → '+a.name,'good'); v32CloseModal(); };
  window.v32InvestorToBuyer=function(iid){ ensureData(); var r=window.INVESTOR_REQUESTS.find(function(x){return x.id===iid;}); if(!r)return; var exists=window.SALES_BUYERS.some(function(b){return String(b.name||'').trim().toLowerCase()===String(r.investor||'').trim().toLowerCase();}); if(!exists){ window.SALES_BUYERS.unshift({id:id(),name:r.investor,country:r.country,city:r.city,assetType:r.assetType,areaMin:r.areaMin,areaMax:r.areaMax,budgetMin:r.budgetMin,budgetMax:r.budgetMax,capRate:r.capRate,contact:r.contact,broker:r.broker,stage:'active',notes:'Created from investor request. '+(r.preferences||''),createdAt:todayISO()}); } r.stage=r.stage==='new'?'matching':r.stage; persistV32(); toast(tr('convertBuyer')+': '+r.investor,'good'); go('v32_sales'); };

  window.v32AssetForm=function(aid){ ensureData(); var a=window.SALES_ASSETS.find(function(x){return x.id===aid;})||{}; var html='<div class="v32-form"><div class="v32-row2">'+formInput(tr('property'),'sa_name',a.name)+formInput('Type','sa_type',a.type||'Investment')+'</div><div class="v32-row3">'+formInput(tr('country'),'sa_country',a.country||'Узбекистан')+formInput(tr('city'),'sa_city',a.city||'')+formInput(tr('areaMin'),'sa_area',a.area,'number')+'</div><div class="v32-row3">'+formInput(tr('price'),'sa_price',a.price,'number')+formInput('% '+tr('commission'),'sa_cr',a.commissionRate||2,'number')+formInput(tr('commission'),'sa_comm',a.expectedCommission,'number')+'</div><div class="v32-row3">'+formSelect(tr('stage'),'sa_stage',a.stage||'lead',[['lead','Lead'],['nda','NDA'],['dd','DD'],['offer','Offer'],['spa','SPA'],['closed','Closed'],['lost','Lost']])+formInput(tr('broker'),'sa_broker',a.broker||brokerName())+formSelect(tr('access'),'sa_vis',a.visibility||'internal',[['internal',tr('private')],['partners',tr('public')]])+'</div>'+formInput(tr('seller'),'sa_seller',a.seller||'')+formInput(tr('nextAction'),'sa_next',a.nextAction||'')+formInput(tr('due'),'sa_due',a.due||addDays(7),'date')+formText('Notes','sa_notes',a.notes||'')+'</div>'; modal(aid?tr('edit'):tr('addAsset'),html,'<button class="btn ghost" onclick="v32CloseModal()">'+h(tr('cancel'))+'</button><button class="btn" onclick="v32SaveAsset(\''+(aid||'')+'\')">'+h(tr('save'))+'</button>'); };
  window.v32SaveAsset=function(aid){ ensureData(); var price=num('sa_price'), cr=num('sa_cr'), comm=num('sa_comm')||price*cr/100; var row={id:aid||id(),name:gv('sa_name').trim(),type:gv('sa_type').trim(),country:gv('sa_country').trim(),city:gv('sa_city').trim(),area:num('sa_area'),price:price,currency:'USD',commissionRate:cr,expectedCommission:comm,stage:gv('sa_stage'),broker:gv('sa_broker').trim(),visibility:gv('sa_vis'),seller:gv('sa_seller').trim(),nextAction:gv('sa_next').trim(),due:gv('sa_due'),notes:gv('sa_notes').trim(),createdAt:todayISO()}; if(!row.name){toast(tr('property')+' — '+tr('required'),'warn');return;} var i=window.SALES_ASSETS.findIndex(function(x){return x.id===row.id;}); if(i>=0) window.SALES_ASSETS[i]=Object.assign(window.SALES_ASSETS[i],row); else window.SALES_ASSETS.unshift(row); persistV32(); v32CloseModal(); go('v32_sales'); };
  window.v32BuyerForm=function(bid){ ensureData(); var b=window.SALES_BUYERS.find(function(x){return x.id===bid;})||{}; var html='<div class="v32-form"><div class="v32-row2">'+formInput(tr('buyer'),'sb_name',b.name)+formInput('Asset type','sb_type',b.assetType||'Retail')+'</div><div class="v32-row3">'+formInput(tr('country'),'sb_country',b.country||'')+formInput(tr('city'),'sb_city',b.city||'')+formInput(tr('broker'),'sb_broker',b.broker||brokerName())+'</div><div class="v32-row2">'+formInput('Budget min','sb_bmin',b.budgetMin,'number')+formInput('Budget max','sb_bmax',b.budgetMax,'number')+'</div><div class="v32-row2">'+formInput(tr('areaMin'),'sb_amin',b.areaMin,'number')+formInput(tr('areaMax'),'sb_amax',b.areaMax,'number')+'</div>'+formInput('Cap rate','sb_cap',b.capRate||'')+formInput(tr('email')+' / '+tr('phone'),'sb_contact',b.contact||'')+formText('Notes','sb_notes',b.notes||'')+'</div>'; modal(bid?tr('edit'):tr('addBuyer'),html,'<button class="btn ghost" onclick="v32CloseModal()">'+h(tr('cancel'))+'</button><button class="btn" onclick="v32SaveBuyer(\''+(bid||'')+'\')">'+h(tr('save'))+'</button>'); };
  window.v32SaveBuyer=function(bid){ ensureData(); var row={id:bid||id(),name:gv('sb_name').trim(),assetType:gv('sb_type').trim(),country:gv('sb_country').trim(),city:gv('sb_city').trim(),broker:gv('sb_broker').trim(),budgetMin:num('sb_bmin'),budgetMax:num('sb_bmax'),areaMin:num('sb_amin'),areaMax:num('sb_amax'),capRate:gv('sb_cap'),contact:gv('sb_contact'),notes:gv('sb_notes'),stage:'active',createdAt:todayISO()}; if(!row.name){toast(tr('buyer')+' — '+tr('required'),'warn');return;} var i=window.SALES_BUYERS.findIndex(function(x){return x.id===row.id;}); if(i>=0) window.SALES_BUYERS[i]=Object.assign(window.SALES_BUYERS[i],row); else window.SALES_BUYERS.unshift(row); persistV32(); v32CloseModal(); go('v32_sales'); };
  window.v32MatchBuyers=function(aid){ var a=window.SALES_ASSETS.find(function(x){return x.id===aid;}); if(!a)return; var buyers=window.SALES_BUYERS.filter(function(b){ var price=+a.price||0, area=+a.area||0; var budgetOk=(!b.budgetMin||price>=b.budgetMin)&&(!b.budgetMax||price<=b.budgetMax); var areaOk=(!b.areaMin||area>=b.areaMin)&&(!b.areaMax||area<=b.areaMax); var cityOk=!b.city||!a.city||String(b.city).toLowerCase()===String(a.city).toLowerCase(); return budgetOk&&areaOk&&(cityOk||!b.city); }); var html='<div class="v32-card"><h3>'+h(a.name)+'</h3>'+(buyers.length?'<table class="v32-table"><tr><th>'+h(tr('buyer'))+'</th><th>'+h(tr('budget'))+'</th><th>Contact</th></tr>'+buyers.map(function(b){return '<tr><td><b>'+h(b.name)+'</b><div class="mut">'+h(b.assetType||'')+'</div></td><td>'+money(b.budgetMin||0)+' - '+money(b.budgetMax||0)+'</td><td>'+h(b.contact||'-')+'</td></tr>';}).join('')+'</table>':'<div class="v32-empty">'+h(tr('noRows'))+'</div>')+'</div>'; modal(tr('match'),html,'<button class="btn" onclick="v32CloseModal()">OK</button>'); };

  window.v32PartnerForm=function(pid){ ensureData(); var p=window.CASE_PARTNERS.find(function(x){return x.id===pid;})||{}; var html='<div class="v32-form"><div class="v32-row2">'+formInput(tr('partners'),'pt_name',p.name)+formInput('Type','pt_type',p.type||'Partner')+'</div><div class="v32-row3">'+formInput(tr('country'),'pt_country',p.country||'')+formInput(tr('city'),'pt_city',p.city||'')+formInput(tr('broker'),'pt_owner',p.owner||brokerName())+'</div><div class="v32-row2">'+formInput(tr('email'),'pt_email',p.email)+formInput(tr('phone'),'pt_phone',p.phone)+'</div><div class="v32-row3">'+formSelect(tr('access'),'pt_access',p.access||'sales_only',[['sales_only','Sales only'],['requests_only','Requests only'],['requests_and_sales','Requests + sales'],['readonly','Read only']])+formInput(tr('scope'),'pt_scope',p.scope||'assigned_city')+formSelect(tr('stage'),'pt_status',p.status||'pending',[['pending','Pending'],['active','Active'],['paused','Paused']])+'</div>'+formText('Notes','pt_notes',p.notes||'')+'</div>'; modal(pid?tr('edit'):tr('addPartner'),html,'<button class="btn ghost" onclick="v32CloseModal()">'+h(tr('cancel'))+'</button><button class="btn" onclick="v32SavePartner(\''+(pid||'')+'\')">'+h(tr('save'))+'</button>'); };
  window.v32SavePartner=function(pid){ ensureData(); var row={id:pid||id(),name:gv('pt_name').trim(),type:gv('pt_type').trim(),country:gv('pt_country').trim(),city:gv('pt_city').trim(),owner:gv('pt_owner').trim(),email:gv('pt_email').trim(),phone:gv('pt_phone').trim(),access:gv('pt_access'),scope:gv('pt_scope').trim(),status:gv('pt_status'),notes:gv('pt_notes').trim(),createdAt:todayISO()}; if(!row.name){toast(tr('partners')+' — '+tr('required'),'warn');return;} var i=window.CASE_PARTNERS.findIndex(function(x){return x.id===row.id;}); if(i>=0) window.CASE_PARTNERS[i]=Object.assign(window.CASE_PARTNERS[i],row); else window.CASE_PARTNERS.unshift(row); persistV32(); v32CloseModal(); go('v32_partners'); };

  function clearFieldErrors(){ document.querySelectorAll('.case-field-error').forEach(function(e){e.remove();}); document.querySelectorAll('.case-invalid').forEach(function(e){e.classList.remove('case-invalid');}); var top=document.getElementById('v32DocErrors'); if(top)top.remove(); }
  function showFieldError(field,msg,htmlMsg){ var el=document.getElementById(field); if(!el)return; el.classList.add('case-invalid'); var er=document.createElement('div'); er.className='case-field-error'; if(htmlMsg) er.innerHTML=htmlMsg; else er.textContent=msg; el.insertAdjacentElement('afterend',er); }
  function jumpField(field){ var el=document.getElementById(field); if(!el)return; el.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(function(){ try{ el.focus(); if(el.select)el.select(); }catch(e){} },250); }
  window.v32JumpField=jumpField;
  function docReqs(){ var type=(window.DOC&&DOC.t)||'kp'; var arr=[]; function add(idv,label,test,msg){ arr.push({id:idv,label:label,ok:test(),msg:msg}); }
    add('f_ten',tr('brand'),function(){return !!(document.getElementById('f_ten')&&document.getElementById('f_ten').value.trim());},tr('needBrand'));
    if(type==='kp'){ add('f_unit',tr('property'),function(){return !!(document.getElementById('f_unit')&&document.getElementById('f_unit').value.trim());},tr('needUnit')); add('f_area',tr('areaMin'),function(){return (+((document.getElementById('f_area')||{}).value)||0)>0;},tr('needArea')); add('f_rate',tr('price'),function(){return (+((document.getElementById('f_rate')||{}).value)||0)>0;},tr('needRate')); }
    if(type==='loi' && (!document.getElementById('f_loitype') || document.getElementById('f_loitype').value==='unit')){ add('f_unit',tr('property'),function(){return !!(document.getElementById('f_unit')&&document.getElementById('f_unit').value.trim());},tr('needUnit')); add('f_area',tr('areaMin'),function(){return (+((document.getElementById('f_area')||{}).value)||0)>0;},tr('needArea')); add('f_rate',tr('price'),function(){return (+((document.getElementById('f_rate')||{}).value)||0)>0;},tr('needRate')); }
    if(type==='remind'){ add('f_sub',tr('nextAction'),function(){return !!(document.getElementById('f_sub')&&document.getElementById('f_sub').value.trim());},tr('needSubject')); add('f_date2',tr('due'),function(){return !!((document.getElementById('f_date2')||{}).value);},tr('needDate')); }
    return arr;
  }
  function validateDoc(){ clearFieldErrors(); var req=docReqs(); var bad=req.filter(function(x){return !x.ok;}); if(!bad.length) return true; bad.forEach(function(x){ showFieldError(x.id,x.msg); }); var form=document.getElementById('dform'); if(form){ form.insertAdjacentHTML('afterbegin','<div id="v32DocErrors" class="v32-doc-errors"><b>'+h(tr('inlineTop'))+'</b><div>'+bad.map(function(x){return '<a onclick="v32JumpField(\''+x.id+'\')">'+h(x.label)+'</a>';}).join('')+'</div></div>'); }
    jumpField(bad[0].id); return false;
  }
  function injectDocChecklist(){ var form=document.getElementById('dform'); if(!form||form.querySelector('.v32-checklist')) return; var btn=form.querySelector('button.btn[onclick*="gen"]')||form.querySelector('button.btn'); if(!btn)return; var box=document.createElement('div'); box.className='v32-checklist'; btn.parentNode.insertBefore(box,btn); updateDocChecklist(); }
  function updateDocChecklist(){ var box=document.querySelector('.v32-checklist'); if(!box)return; var req=docReqs(); var ok=req.filter(function(x){return x.ok;}).length; var pct=req.length?Math.round(ok/req.length*100):100; box.innerHTML='<h4>'+h(tr('ready'))+': '+pct+'%</h4>'+req.map(function(x){return '<div class="v32-check '+(x.ok?'ok':'bad')+'"><span>'+h(x.label)+'</span><b>'+(x.ok?'✓':'✕')+'</b></div>';}).join(''); }
  function installDocValidation(){
    ['genKP','genLOI','genREM'].forEach(function(n){ var old=window[n]; if(typeof old==='function'&&!old._v32){ window[n]=function(){ if(!validateDoc())return; return old.apply(this,arguments); }; window[n]._v32=true; } });
    if(typeof window.ensureBrandInBase==='function'&&!window.ensureBrandInBase._v32){
      window.ensureBrandInBase=function(name){ name=String(name||'').trim(); if(!name)return false; try{ if(BRANDS.some(function(b){return String(b.name||'').trim().toLowerCase()===name.toLowerCase();}))return true; }catch(e){}
        showFieldError('f_ten','',h(tr('brandNotFound'))+' <button type="button" class="btn ghost sm" onclick="v32AddBrandFromDoc()">+ '+h(tr('addBrand'))+'</button>'); jumpField('f_ten'); return false; };
      window.ensureBrandInBase._v32=true;
    }
    window.v32AddBrandFromDoc=function(){ var e=document.getElementById('f_ten'), name=e&&e.value.trim(); if(!name)return; try{ var nb=typeof brand==='function'?brand({name:name,cat:'Услуги',status:'target',notes:'Создано из формы документа'}):{id:id(),name:name,cat:'Услуги',status:'target'}; nb.editedBy=userName(); nb.editedAt=typeof nowMin==='function'?nowMin():new Date().toISOString(); BRANDS.push(nb); persistV32(); toast(tr('addBrand')+': '+name,'good'); clearFieldErrors(); updateDocChecklist(); }catch(ex){ toast(String(ex),'warn'); } };
    document.addEventListener('input',function(e){ if(e.target&&e.target.closest&&e.target.closest('#dform')){ updateDocChecklist(); saveDocDraft(); } },true);
    document.addEventListener('change',function(e){ if(e.target&&e.target.closest&&e.target.closest('#dform')){ updateDocChecklist(); saveDocDraft(); } },true);
  }
  function saveDocDraft(){ try{ if(!window.DOC)return; var data={t:DOC.t,at:Date.now(),fields:{}}; document.querySelectorAll('#dform input,#dform select,#dform textarea').forEach(function(el){ if(el.id) data.fields[el.id]=(el.type==='checkbox')?el.checked:el.value; }); localStorage.setItem('caseos-v32-docdraft-'+DOC.t,JSON.stringify(data)); }catch(e){} }
  function restoreDocDraft(){ try{ if(!window.DOC)return; var raw=localStorage.getItem('caseos-v32-docdraft-'+DOC.t); if(!raw)return; var data=JSON.parse(raw); if(!data||!data.fields)return; Object.keys(data.fields).forEach(function(k){ var el=document.getElementById(k); if(!el)return; if(el.type==='checkbox')el.checked=!!data.fields[k]; else if(!el.value) el.value=data.fields[k]; }); updateDocChecklist(); }catch(e){} }
  function wrapDocs(){ wrapRender('renderDocs',function(){ setTimeout(function(){ injectDocChecklist(); restoreDocDraft(); },30); }); var oldPick=window.pickT; if(typeof oldPick==='function'&&!oldPick._v32){ window.pickT=function(){ var r=oldPick.apply(this,arguments); setTimeout(function(){ injectDocChecklist(); restoreDocDraft(); },30); return r; }; window.pickT._v32=true; } var oldEmit=window.genEmit; if(typeof oldEmit==='function'&&!oldEmit._v32){ window.genEmit=function(){ var r=oldEmit.apply(this,arguments); try{ if(window.DOC) localStorage.removeItem('caseos-v32-docdraft-'+DOC.t); }catch(e){} return r; }; window.genEmit._v32=true; } }

  function routePractice(i){ var routes=['registry','v32_action','v32_requests','map','v32_action','kpi']; var r=routes[i]||'dash'; if(r==='map'||r==='registry'||r==='kpi') { try{ go(r); }catch(e){} } else go(r); }
  function installPracticeRouting(){
    document.addEventListener('click',function(e){ var item=e.target.closest&&e.target.closest('.v31-practice-item'); if(!item)return; var p=item.parentNode; var idx=[].slice.call(p.children).indexOf(item); routePractice(idx); },true);
  }

  function install(){
    ensureData(); installCSS(); wrapState(); installAlertLayer(); installNav(); installGo(); installDocValidation(); wrapDocs(); installPracticeRouting();
    wrapRender('renderDash',injectDashboard);
    try{ if(typeof buildNav==='function') buildNav(); }catch(e){}
    try{ if(window.S&&S.view==='dash') injectDashboard(); }catch(e){}
    try{ applyTranslation(); localizePracticeCards(); }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
