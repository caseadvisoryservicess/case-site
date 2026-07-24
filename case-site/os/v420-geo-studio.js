/* CASE OS v4.8.1 — universal/editable geo layer with integrated Tashkent master baseline and F&B classification. */
(function(){
  'use strict';
  var PARAMS=new URLSearchParams(location.search),EMBEDDED=PARAMS.get('embedded')==='1';
  var GEO_CAN_EDIT=!EMBEDDED,GEO_ADMIN_EDIT=!EMBEDDED,GEO_EDIT_MODE=false,GEO_EXTERNAL=false,GEO_CONTEXT={},GEO_META={status:'online',updatedAt:'',updatedBy:'',datasets:{}},
      GEO_PROFILES={},GEO_DATASET='bc',GEO_QUERY='',GEO_PICK_PROJECT=false,GEO_STATE_LOADED=false;
  var GEO_SAVE_STATE='idle',GEO_SAVE_MESSAGE='';
  var CENTER={lat:41.31110,lng:69.27970};
  var GEO_POI={hotels:[],shopping:[],street_retail:[],supermarkets:[],markets:[],restaurants:[],cafes:[],fast_food:[],parks:[],playgrounds:[],entertainment:[],sports:[],education:[],residential:[],warehouses:[],parking:[],transport_hubs:[],culture:[],tourism:[],finance:[],government:[],fuel_auto:[],mahallas:[]};
  var GEO_POI_LAYERS={},GEO_POI_RENDERER=null,GEO_POI_LOADING={},GEO_POI_LABSTYLE={};
  var POI_DEFS={
    hotels:{label:'Гостиницы и апарт-отели',short:'Гостиница',icon:'H',color:'#7B4BA1',fields:[['category','Категория / звёзды','text'],['keys','Номерной фонд / keys','number'],['operator','Оператор / бренд','text'],['adr','ADR','number'],['occupancy','Загрузка, %','number'],['revpar','RevPAR','number'],['facilities','F&B, SPA, MICE и сервисы','textarea']]},
    shopping:{label:'ТРЦ и торговые центры',short:'ТРЦ / ТЦ',icon:'Т',color:'#C55A11',fields:[['format','Формат / класс центра','text'],['gba','GBA, м²','number'],['gla','GLA, м²','number'],['floors','Этажей','number'],['anchors','Якорные арендаторы','textarea'],['tenants','Арендаторы / tenant mix','textarea'],['rentRange','Ставки аренды по этажам','textarea'],['occupancy','Заполняемость, %','number'],['parkingSpaces','Парковочных мест','number'],['annualFootfall','Посещаемость в год','number'],['floorPlans','Планировки / ссылки','textarea']]},
    street_retail:{label:'Стрит-ритейл',short:'Стрит-ритейл',icon:'R',color:'#D9822B',fields:[['format','Формат помещения','text'],['gba','GBA, м²','number'],['gla','GLA, м²','number'],['frontage','Фронт / витрина, м','number'],['floors','Этажей','number'],['rentRange','Ставка аренды','text'],['tenant','Арендатор / категория','text'],['footTraffic','Пешеходный трафик','number']]},
    supermarkets:{label:'Супермаркеты и продуктовый ритейл',short:'Супермаркет',icon:'S',color:'#3E8E41',fields:[['format','Формат','text'],['chain','Сеть','text'],['salesArea','Торговая площадь, м²','number'],['parkingSpaces','Парковочных мест','number'],['hours','Режим работы','text'],['delivery','Доставка','text']]},
    markets:{label:'Рынки и базары',short:'Рынок',icon:'Б',color:'#8A6D3B',fields:[['format','Тип рынка','text'],['area','Площадь, м²','number'],['units','Торговых мест','number'],['hours','Режим работы','text'],['parkingSpaces','Парковочных мест','number'],['footTraffic','Посещаемость / трафик','number']]},
    restaurants:{label:'Рестораны',short:'Ресторан',icon:'Р',color:'#B33A3A',fields:[['cuisinePrimary','Основная кухня (для сортировки)','text'],['cuisines','Кухни / теги (через |)','textarea'],['alcoholStatus','Алкоголь','select',[['unknown','Не проверено'],['yes','Есть'],['no','Нет'],['limited','Ограниченный ассортимент / только пиво-вино'],['seasonal','Сезонно / только мероприятия']]],['alcoholTypes','Виды алкоголя (пиво | вино | крепкий | коктейли)','text'],['alcoholVerification','Как проверен алкоголь','select',[['not_checked','Не проверено'],['official_menu','Официальное меню / сайт'],['phone','Подтверждено по телефону'],['field','Подтверждено при выезде'],['owner','Подтверждено владельцем']]],['alcoholSourceUrl','Источник по алкоголю','text'],['segment','Сегмент','text'],['seats','Посадочных мест','number'],['avgCheck','Средний чек','number'],['hours','Режим работы','text'],['terrace','Терраса','text'],['delivery','Доставка','text']]},
    cafes:{label:'Кафе и кофейни',short:'Кафе',icon:'К',color:'#A36A3E',fields:[['cuisinePrimary','Основная кухня / формат (для сортировки)','text'],['cuisines','Кухни / теги (через |)','textarea'],['alcoholStatus','Алкоголь','select',[['unknown','Не проверено'],['yes','Есть'],['no','Нет'],['limited','Ограниченный ассортимент / только пиво-вино'],['seasonal','Сезонно / только мероприятия']]],['alcoholTypes','Виды алкоголя (пиво | вино | крепкий | коктейли)','text'],['alcoholVerification','Как проверен алкоголь','select',[['not_checked','Не проверено'],['official_menu','Официальное меню / сайт'],['phone','Подтверждено по телефону'],['field','Подтверждено при выезде'],['owner','Подтверждено владельцем']]],['alcoholSourceUrl','Источник по алкоголю','text'],['format','Формат','text'],['chain','Сеть','text'],['seats','Посадочных мест','number'],['avgCheck','Средний чек','number'],['hours','Режим работы','text'],['terrace','Терраса','text'],['delivery','Доставка','text']]},
    fast_food:{label:'Фастфуд и QSR',short:'Фастфуд',icon:'F',color:'#D9534F',fields:[['format','Формат','text'],['chain','Сеть','text'],['seats','Посадочных мест','number'],['avgCheck','Средний чек','number'],['hours','Режим работы','text'],['driveThru','Drive-through','text'],['delivery','Доставка','text']]},
    parks:{label:'Парки и зелёные зоны',short:'Парк',icon:'П',color:'#2E8B57',fields:[['parkType','Тип парка / зоны','text'],['areaHa','Площадь, га','number'],['amenities','Инфраструктура и функции','textarea'],['condition','Состояние','text'],['accessibility','Доступность','text'],['attendance','Посещаемость','number']]},
    playgrounds:{label:'Детские площадки',short:'Детская площадка',icon:'Д',color:'#F0A202',fields:[['areaSqm','Площадь, м²','number'],['ageGroups','Возрастные группы','text'],['equipment','Оборудование','textarea'],['surface','Покрытие','text'],['condition','Состояние / безопасность','text'],['accessibility','Доступность','text']]},
    entertainment:{label:'Развлечения и досуг',short:'Досуг',icon:'E',color:'#9B59B6',fields:[['format','Формат / направление','text'],['area','Площадь, м²','number'],['capacity','Вместимость','number'],['ticket','Средний билет','number'],['hours','Режим работы','text'],['audience','Целевая аудитория','text']]},
    sports:{label:'Спортивные объекты',short:'Спорт',icon:'C',color:'#2878B5',fields:[['sportType','Вид спорта / формат','text'],['area','Площадь, м²','number'],['capacity','Вместимость','number'],['membership','Стоимость / абонемент','text'],['hours','Режим работы','text'],['facilities','Инфраструктура','textarea']]},
    education:{label:'Образование',short:'Образование',icon:'О',color:'#4C6EF5',fields:[['institutionType','Тип учреждения','text'],['capacity','Проектная вместимость','number'],['students','Учащихся','number'],['fees','Стоимость обучения','text'],['languages','Языки обучения','text'],['programs','Программы / специализация','textarea']]},
    residential:{label:'Жилые комплексы',short:'Жилой комплекс',icon:'Ж',color:'#67748E',fields:[['projectClass','Класс проекта','text'],['gba','GBA, м²','number'],['units','Количество квартир','number'],['buildings','Корпусов','number'],['floors','Этажность','text'],['parkingSpaces','Парковочных мест','number'],['priceRange','Цена за м²','text'],['commissioned','Срок ввода','text'],['amenities','Инфраструктура','textarea']]},
    warehouses:{label:'Склады и логистика',short:'Склад / логистика',icon:'Л',color:'#5F6B6D',fields:[['warehouseClass','Класс склада','text'],['gba','GBA, м²','number'],['clearHeight','Рабочая высота, м','number'],['docks','Доков / ворот','number'],['yard','Маневровая площадка','text'],['rentRange','Ставка аренды','text'],['occupancy','Заполняемость, %','number']]},
    parking:{label:'Паркинги и стоянки',short:'Паркинг',icon:'P',color:'#4F5D75',fields:[['parkingType','Тип паркинга','text'],['spaces','Количество мест','number'],['rate','Тариф','text'],['hours','Режим работы','text'],['occupancy','Средняя загрузка, %','number'],['evCharging','Зарядки для ЭВ','text']]},
    transport_hubs:{label:'Транспортные узлы и остановки',short:'Транспортный узел',icon:'T',color:'#006D77',fields:[['hubType','Тип узла','text'],['routes','Маршруты','textarea'],['passengerFlow','Пассажиропоток','number'],['hours','Режим работы','text'],['connections','Пересадки / связи','textarea']]},
    culture:{label:'Культурные объекты',short:'Культура',icon:'М',color:'#8F5E99',fields:[['cultureType','Тип объекта','text'],['capacity','Вместимость','number'],['attendance','Посещаемость','number'],['ticket','Стоимость билета','text'],['hours','Режим работы','text'],['program','Программа / профиль','textarea']]},
    tourism:{label:'Туристические объекты',short:'Туризм',icon:'★',color:'#0F8B8D',fields:[['attractionType','Тип объекта','text'],['attendance','Посещаемость','number'],['ticket','Стоимость посещения','text'],['hours','Режим работы','text'],['seasonality','Сезонность','text'],['services','Сервисы','textarea']]},
    finance:{label:'Банки и финансы',short:'Банк',icon:'₿',color:'#1B6B4A',fields:[['serviceType','Тип (банк/банкомат/обменник/финтех)','text'],['bankName','Банк / бренд','text'],['services','Услуги','textarea'],['hours','Режим работы','text'],['corporate','Работа с юр. лицами','text']]},
    government:{label:'Госучреждения и услуги',short:'Госуслуги',icon:'Г',color:'#5C4E8E',fields:[['officeType','Тип учреждения','text'],['services','Услуги / функции','textarea'],['hours','Режим работы','text'],['footTraffic','Посещаемость / трафик','number']]},
    fuel_auto:{label:'АЗС и автосервисы',short:'АЗС / авто',icon:'A',color:'#B3541E',fields:[['stationType','Тип (АЗС/АГЗС/мойка/сервис/салон)','text'],['brand','Сеть / бренд','text'],['fuelTypes','Виды топлива / услуги','textarea'],['hours','Режим работы','text'],['evCharging','Зарядки для ЭВ','text']]},
    mahallas:{label:'Махалли (граждан. собрания)',short:'Махалля',icon:'⌂',color:'#8C6A2F',fields:[['population','Население махалли','number'],['households','Домохозяйств','number'],['chairperson','Председатель','text'],['phone2','Телефон комитета','text'],['notes2','Примечания','textarea']]}
  };
  // Единый список слоёв по категориям (объединяет «Слои и стиль» и «Городские объекты»,
  // раньше это были два раздельных списка). Ключ - id секции-якоря geoCatAnchor-<key> в HTML.
  // Таксономия по отраслевому принципу (не по типу гео-объекта) - HoReCa/Ритейл/Досуг и т.д.,
  // а не «еда», «недвижимость» и «транспорт» вперемешку (независимый разбор категорий).
  var POI_CATEGORY_GROUPS={
    horeca:['hotels','restaurants','cafes','fast_food'],
    retail:['shopping','supermarkets','markets','street_retail'],
    leisure:['parks','playgrounds','entertainment','sports','culture','tourism'],
    education:['education'],
    residential:['residential'],
    services:['finance','government','fuel_auto'],
    infrastructure:['warehouses','parking','transport_hubs'],
    boundaries:['mahallas']
  };
  // Товарные подтипы стрит-ритейла - определяются из тега OSM shop=* (уже приходит в поле
  // subtype с сервера, api/gis_proxy.php). Названия сверены с реальной таксономией «Категория/
  // Подкатегория», которой уже пользуется команда (файлы ASAAS_brands_full/CASE_brands) - чтобы
  // подписи слоя совпадали с тем, к чему привыкли в модуле «Бренды».
  // Деление доступно только на уровне товарной группы: OSM не даёт машиночитаемого признака
  // «для женщин/для мужчин» у магазинов одежды - потребовало бы ручной доразметки каждой точки
  // через существующий инструмент верификации.
  var STREET_RETAIL_SUBTYPES={
    clothes:'Одежда', shoes:'Обувь', bag:'Сумки и аксессуары',
    jewelry:'Ювелирные изделия', watches:'Часы',
    electronics:'Электроника и техника', mobile_phone:'Электроника и техника', appliance:'Электроника и техника', computer:'Электроника и техника',
    books:'Книги и канцтовары', stationery:'Книги и канцтовары',
    furniture:'Мебель и товары для дома', doityourself:'Мебель и товары для дома', houseware:'Мебель и товары для дома', interior_decoration:'Мебель и товары для дома',
    cosmetics:'Косметика и парфюмерия', perfumery:'Косметика и парфюмерия',
    bakery:'Кондитерские и выпечка', confectionery:'Кондитерские и выпечка', pastry:'Кондитерские и выпечка',
    sports:'Спорттовары', beauty:'Салоны красоты', hairdresser:'Салоны красоты',
    optician:'Оптика', variety_store:'Товары по одной цене / разное', department_store:'Универсальные магазины', convenience:'Универсальные магазины',
    gift_shop:'Подарки и сувениры', toys:'Игрушки и детские товары', florist:'Цветы'
  };
  var GEO_RETAIL_SUB_ON={};
  function retailSubtypeLabel(raw){return STREET_RETAIL_SUBTYPES[String(raw||'').toLowerCase()]||'Прочее';}
  function retailSubtypeList(){ // отсортированный список меток без дублей + «Прочее» в конце
    var set={};Object.keys(STREET_RETAIL_SUBTYPES).forEach(function(k){set[STREET_RETAIL_SUBTYPES[k]]=true;});
    var out=Object.keys(set).sort(function(a,b){return a.localeCompare(b,'ru');});out.push('Прочее');return out;
  }
  function geoRetailSubKey(label){return 'rs_'+label.replace(/[^a-zа-я0-9]+/gi,'_');}
  function geoSaveRetailSubFilter(){try{localStorage.setItem('asaas_geo_retail_subtypes',JSON.stringify(GEO_RETAIL_SUB_ON));}catch(e){}}
  function geoLoadRetailSubFilter(){try{var s=JSON.parse(localStorage.getItem('asaas_geo_retail_subtypes')||'{}');Object.keys(s).forEach(function(k){GEO_RETAIL_SUB_ON[k]=!!s[k];});}catch(e){}}
  function retailSubCounts(){var c={};(GEO_POI.street_retail||[]).forEach(function(x){var lb=retailSubtypeLabel(x.subtype);c[lb]=(c[lb]||0)+1;});return c;}
  function retailSubPanelHtml(){
    var counts=retailSubCounts();
    return '<div id="geoRetailSubPanel" class="styrow sub geo-poi-sub geo-retail-sub" style="flex-wrap:wrap;gap:6px 10px">'+retailSubtypeList().map(function(lb){
      var key=geoRetailSubKey(lb),on=GEO_RETAIL_SUB_ON[key]!==false,n=counts[lb]||0;
      return '<label class="ck" style="font-size:11px"><input type="checkbox" id="geoRS-'+key+'"'+(on?' checked':'')+' onchange="geoRetailSubToggle(\''+key+'\',this.checked)"> '+esc(lb)+' <small class="geo-poi-count">'+n+'</small></label>';
    }).join('')+'</div>';
  }
  window.geoRetailSubToggle=function(key,on){GEO_RETAIL_SUB_ON[key]=!!on;geoSaveRetailSubFilter();renderPoiLayer('street_retail');};
  function refreshRetailSubPanel(){var el=document.getElementById('geoRetailSubPanel');if(el)el.outerHTML=retailSubPanelHtml();}
  var TYPE_LABELS={mall:'Торговый центр / Mall',office:'Бизнес-центр / Office',hotel:'Гостиница / Resort',mixed:'Mixed-use',street:'Street / Plinth retail',warehouse:'Склад / Логистика',residential:'Жилой проект',other:'Другой коммерческий объект'};
  var COMMON=[
    ['name','Название проекта','text'],['type','Тип объекта','type'],['country','Страна','text'],['city','Город','text'],['district','Район / территория','text'],['address','Адрес','text'],
    ['lat','Широта','number'],['lng','Долгота','number'],['siteArea','Площадь участка, га','number'],['stage','Стадия проекта','stage'],['verification','Статус данных','verification'],
    ['source','Основной источник','text'],['sourceDate','Дата источника','date'],['checkedBy','Проверил','text'],['checkedAt','Дата ручной проверки','date'],['notes','Примечания / ограничения','textarea'],['attachments','Вложения и ссылки на исходные материалы (по строке)','textarea']
  ];
  var PLAN_FIELDS=[
    ['planVerification','Статус градпроверки','planVerification'],['cadastreNo','Кадастровый номер','text'],['zoneCode','Код территориальной зоны','text'],['siteArea','Площадь участка, га','number'],
    ['permittedUses','Разрешённые виды использования','textarea'],['conditionalUses','Условно разрешённые функции','textarea'],['prohibitedUses','Запрещённые функции','textarea'],
    ['maxFloors','Максимальная этажность','number'],['maxHeight','Максимальная высота, м','number'],['planFar','FAR / КИН','number'],['planCoverage','Максимальная застройка участка, %','number'],['densityLimit','Предельная плотность','text'],
    ['setbacks','Минимальные отступы','textarea'],['redLines','Красные линии','textarea'],['parkingNorm','Норматив парковки','textarea'],['heritage','Охранные / исторические зоны','textarea'],['sanitary','Санитарные и экологические зоны','textarea'],['utilities','Инженерные сети и мощности','textarea'],
    ['planningConstraints','Прочие ограничения и сервитуты','textarea'],['planningConclusion','Что допустимо построить: тип, размер, этажность','textarea'],
    ['planSourceUrl','Ссылка на официальный источник / карточку','text'],['planDocumentNo','Номер документа / решения','text'],['planDocumentDate','Дата документа','date'],['planDataDate','Дата актуальности данных','date'],['planCheckedBy','Проверил','text'],['planCheckedAt','Дата ручной проверки','date'],['planningEvidence','Ссылки на скриншоты и доказательные материалы','textarea']
  ];
  var SCHEMAS={
    mall:[['gba','GBA, м²','number'],['gla','GLA, м²','number'],['floors','Этажей','number'],['retailFloors','Торговые этажи','text'],['units','Количество помещений','number'],['parking','Парковочных мест','number'],['occupancy','Заполняемость, %','number'],['annualFootfall','Посещаемость в год','number'],['anchors','Якорные арендаторы','textarea'],['tenants','Список арендаторов','textarea'],['tenantMix','Tenant mix по категориям','textarea'],['rentsByFloor','Ставки аренды по этажам','textarea'],['serviceCharge','Service charge','text'],['floorPlans','Планировки / ссылки на планы','textarea']],
    office:[['gba','GBA, м²','number'],['nla','NLA, м²','number'],['class','Класс БЦ','text'],['floors','Этажей','number'],['typicalFloor','Типовой этаж, м²','number'],['parking','Парковочных мест','number'],['parkingRatio','Парковочный коэффициент','text'],['occupancy','Заполняемость, %','number'],['rentRange','Ставка аренды, $/м²/мес','text'],['serviceCharge','Service charge','text'],['tenants','Арендаторы','textarea'],['coworking','Коворкинг / гибкие офисы','textarea'],['floorPlans','Планировки / ссылки на планы','textarea']],
    hotel:[['gba','GBA, м²','number'],['landArea','Территория, га','number'],['category','Категория / звёздность','text'],['keys','Количество номеров / keys','number'],['roomMix','Номерной фонд по типам','textarea'],['adr','ADR','number'],['occupancy','Загрузка, %','number'],['revpar','RevPAR','number'],['operator','Оператор / бренд','text'],['facilities','F&B, SPA, MICE и инфраструктура','textarea'],['saleUnits','Юниты на продажу','textarea'],['masterPlan','Генплан / ссылки','textarea']],
    mixed:[['gba','Общий GBA, м²','number'],['landArea','Территория, га','number'],['parking','Парковочных мест','number'],['phases','Очереди реализации','textarea'],['components','Компоненты: тип, GBA/GLA/NLA/keys/units','textarea'],['commercialMix','Функциональный / коммерческий mix','textarea'],['operators','Операторы и якоря','textarea'],['rentsByComponent','Ставки по компонентам','textarea'],['plans','Генплан и планировки / ссылки','textarea']],
    street:[['gba','GBA, м²','number'],['gla','GLA, м²','number'],['frontage','Фронт / витрина, м','number'],['floors','Этажей','number'],['units','Помещений','number'],['ceilingHeight','Высота потолков, м','number'],['rentRange','Ставки аренды','text'],['tenants','Арендаторы / целевые категории','textarea'],['plans','Планировки / ссылки','textarea']],
    warehouse:[['gba','GBA, м²','number'],['gla','Арендопригодная площадь, м²','number'],['class','Класс склада','text'],['clearHeight','Рабочая высота, м','number'],['docks','Доков / ворот','number'],['yard','Маневровая площадка','text'],['rail','Ж/д доступ','text'],['occupancy','Заполняемость, %','number'],['rentRange','Ставки аренды','text'],['tenants','Арендаторы','textarea'],['plans','Планы / ссылки','textarea']],
    residential:[['gba','GBA, м²','number'],['saleableArea','Продаваемая площадь, м²','number'],['units','Количество квартир','number'],['buildings','Корпуса / башни','number'],['floors','Этажность','text'],['parking','Парковочных мест','number'],['retailGla','Коммерческий GLA, м²','number'],['priceRange','Цена продажи за м²','text'],['salesPace','Темп продаж','text'],['amenities','Инфраструктура / amenities','textarea'],['unitMix','Mix квартир','textarea'],['plans','Планировки / ссылки','textarea']],
    other:[['gba','GBA, м²','number'],['usableArea','Полезная площадь, м²','number'],['capacity','Вместимость / мощность','text'],['program','Функциональная программа','textarea'],['commercialTerms','Коммерческие показатели','textarea'],['plans','Планы / ссылки','textarea']]
  };
  var DATASETS={
    bc:{label:'Бизнес-центры',kind:'array',ref:function(){return BC;},template:{name:'Новый бизнес-центр',district:'',provider:'CASE manual',lat:'',lng:'',status:'Needs review',_verification:'needs_review'}},
    medicine:{label:'Медицинские объекты',kind:'array',ref:function(){return MEDPTS;},template:{n:'Новый медицинский объект',la:'',ln:'',t:'clinic',s:'CASE manual',sp:'gen',_verification:'needs_review'}},
    pharmacies:{label:'Аптеки',kind:'array',ref:function(){return PHARM;},template:{name:'Новая аптека',format:'Аптека',chain:'',status:'Действующая',address:'',district:'',lat:CENTER.lat,lng:CENTER.lng,phone:'',website:'',hours:'',delivery:'',prescription:'',rating:'',reviews:'',provider:'CASE manual',sourceUrl:'',_sourceDate:'',_verification:'needs_review',_checkedBy:'',_checkedAt:'',_note:''}},
    population:{label:'Сетка населения',kind:'array',ref:function(){return POP;},template:[CENTER.lat,CENTER.lng,0]},
    districts:{label:'Районы Ташкента',kind:'object',ref:function(){return DIST;},template:{}},
    region:{label:'Ташкентская область',kind:'object',ref:function(){return DISTR;},template:{}},
    market:{label:'Рыночные показатели',kind:'object',ref:function(){return MARKET;},template:{}},
    prices:{label:'Ставки и предложения',kind:'object',ref:function(){return PRICES;},template:{}},
    metro:{label:'Метро',kind:'array',ref:function(){return METRO;},template:{n:'Новая линия',c:'#9E0000',s:[]}},
    roads:{label:'Маршруты / транспорт',kind:'array',ref:function(){return ROADS;},template:{n:'Новый маршрут',c:'#9E0000',km:0,min:0,p:[]}}
  };
  var GEO_RECORD_SCHEMAS={
    bc:[
      ['Основное',[['name','Название','text'],['district','Район','text'],['provider','Источник','text'],['status','Рабочий статус','text']]],
      ['Локация',[['address','Адрес','textarea'],['lat','Широта','lat'],['lng','Долгота','lng']]],
      ['Параметры здания',[['class','Класс БЦ','text'],['floors','Этажей','number'],['gla','GLA, м²','number'],['gba','GBA, м²','number'],['parking','Парковочных мест','number'],['year','Год постройки','number']]],
      ['Контакты',[['website','Сайт','text'],['socials','Социальные сети','textarea'],['phone','Телефон','text']]],
      ['Коммерческие данные',[['rent','Аренда, $/м²/мес','number'],['avail','Свободная площадь, м²','number'],['sale','Продажа, $/м²','number'],['psrc','Источник цены','text'],['pdate','Дата цены','date']]],
      ['Оценка и заметки',[['rating','Рейтинг','number'],['reviews','Количество отзывов','number'],['comment','Комментарий','textarea']]],
      ['Мастер-база',[['master_id','ID мастер-базы','text'],['seed_object_id','ID исходного seed','text'],['source_count','Количество источников','number'],['data_confidence','Уровень доверия','text'],['coordinate_accuracy','Точность координат','text'],['possible_duplicate','Возможный дубль','text'],['duplicate_group_id','Группа дублей','text'],['sourceUrl','Ссылка на источник','text']]],
      ['Ручная проверка',[['_verification','Статус проверки','select',[['online','Онлайн, не проверено'],['needs_review','Нужна ручная проверка'],['verified','Подтверждено вручную']]],['_sourceDate','Дата источника','date'],['_checkedBy','Проверил','text'],['_checkedAt','Дата проверки','date'],['_note','Примечание проверки','textarea']]]
    ],
    medicine:[
      ['Основное',[['n','Название','text'],['t','Тип объекта','select',[['hospital','Больница / стационар'],['clinic','Клиника / поликлиника'],['private','Частная клиника'],['doctors','Врачебная практика'],['dentist','Стоматология'],['lab','Лаборатория / диагностика'],['maternity','Роддом / перинатальный центр'],['rehab','Реабилитация'],['other','Другое']]],['sp','Специализация','text'],['status','Рабочий статус','text']]],
      ['Локация и контакты',[['a','Адрес','textarea'],['d','Район','text'],['la','Широта','lat'],['ln','Долгота','lng'],['p','Телефон','text'],['website','Сайт','text']]],
      ['Мастер-база',[['master_id','ID мастер-базы','text'],['seed_object_id','ID исходного seed','text'],['source_count','Количество источников','number'],['data_confidence','Уровень доверия','text'],['coordinate_accuracy','Точность координат','text'],['possible_duplicate','Возможный дубль','text'],['duplicate_group_id','Группа дублей','text'],['sourceUrl','Ссылка на источник','text']]],
      ['Источник и проверка',[['s','Источник','text'],['_verification','Статус проверки','select',[['online','Онлайн, не проверено'],['needs_review','Нужна ручная проверка'],['verified','Подтверждено вручную']]],['_sourceDate','Дата источника','date'],['_checkedBy','Проверил','text'],['_checkedAt','Дата проверки','date'],['_note','Примечание','textarea']]]
    ],
    pharmacies:[
      ['Основное',[['name','Название','text'],['format','Формат / тип','text'],['chain','Сеть / бренд','text'],['status','Рабочий статус','text']]],
      ['Локация и контакты',[['address','Адрес','textarea'],['district','Район','text'],['lat','Широта','lat'],['lng','Долгота','lng'],['phone','Телефон','text'],['website','Сайт','text'],['hours','Режим работы','text']]],
      ['Профильные данные',[['delivery','Доставка','text'],['prescription','Рецептурный отпуск / услуги','textarea'],['rating','Рейтинг','number'],['reviews','Количество отзывов','number']]],
      ['Мастер-база',[['master_id','ID мастер-базы','text'],['seed_object_id','ID исходного seed','text'],['source_count','Количество источников','number'],['data_confidence','Уровень доверия','text'],['coordinate_accuracy','Точность координат','text'],['possible_duplicate','Возможный дубль','text'],['duplicate_group_id','Группа дублей','text']]],
      ['Источник и ручная проверка',[['provider','Источник данных','text'],['sourceUrl','Ссылка на источник','text'],['_sourceDate','Дата источника','date'],['_verification','Статус проверки','select',[['online','Онлайн, не проверено'],['needs_review','Нужна ручная проверка'],['verified','Подтверждено вручную']]],['_checkedBy','Проверил','text'],['_checkedAt','Дата проверки','date'],['_note','Примечание аналитика','textarea']]]
    ],
    population:[['Ячейка населения',[['0','Широта','lat'],['1','Долгота','lng'],['2','Население, чел.','number']]]],
    metro:[['Линия метро',[['n','Название линии','text'],['c','Цвет линии','color'],['s','Станции и координаты','json']]]],
    roads:[['Маршрут',[['n','Название','text'],['c','Цвет','color'],['km','Длина, км','number'],['min','Время, мин','number'],['p','Точки маршрута','json']]]]
  };
  var VERIFY_FIELDS=[['_verification','Статус проверки','select',[['online','Онлайн, не проверено'],['needs_review','Нужна ручная проверка'],['verified','Подтверждено вручную']]],['_sourceDate','Дата источника','date'],['_checkedBy','Проверил','text'],['_checkedAt','Дата проверки','date'],['_note','Примечание аналитика','textarea']];
  Object.keys(POI_DEFS).forEach(function(k){var d=POI_DEFS[k];DATASETS[k]={label:d.label,kind:'array',ref:function(){return GEO_POI[k];},template:{name:'Новый объект',subtype:'',status:'Действующий',operator:'',chain:'',address:'',district:'',lat:CENTER.lat,lng:CENTER.lng,phone:'',website:'',socials:'',provider:'CASE manual',sourceUrl:'',_sourceDate:'',attachments:'',_verification:'needs_review',_checkedBy:'',_checkedAt:'',_note:''}};GEO_RECORD_SCHEMAS[k]=[
    ['Основное',[['name','Название','text'],['subtype','Подтип / формат','text'],['status','Статус объекта','text'],['operator','Оператор','text'],['chain','Сеть / бренд','text']]],
    ['Локация',[['address','Адрес','textarea'],['district','Район / территория','text'],['lat','Широта','lat'],['lng','Долгота','lng']]],
    ['Профильные показатели',d.fields],
    ['Контакты',[['phone','Телефон','text'],['website','Сайт','text'],['socials','Социальные сети','textarea']]],
    ['Источник и материалы',[['provider','Источник данных','text'],['sourceUrl','Ссылка на источник','text'],['attachments','Вложения / ссылки на файлы','textarea']]],
    ['Мастер-база',[['master_id','ID мастер-базы','text'],['seed_object_id','ID исходного seed','text'],['source_count','Количество источников','number'],['data_confidence','Уровень доверия','text'],['coordinate_accuracy','Точность координат','text'],['possible_duplicate','Возможный дубль','text'],['duplicate_group_id','Группа дублей','text']]],
    ['Ручная проверка',VERIFY_FIELDS]
  ];});
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function normalizePharmacy(x){
    if(Array.isArray(x))return{name:'Аптека (OSM)',format:'Аптека',chain:'',status:'Требует проверки',address:'',district:'',lat:+x[0],lng:+x[1],phone:'',website:'',hours:'',delivery:'',prescription:'',rating:'',reviews:'',provider:'OSM',sourceUrl:'',_sourceDate:'',_verification:'online',_checkedBy:'',_checkedAt:'',_note:''};
    x=x&&typeof x==='object'?x:{};return Object.assign({name:'Аптека',format:'Аптека',chain:'',status:'Требует проверки',address:'',district:'',lat:CENTER.lat,lng:CENTER.lng,phone:'',website:'',hours:'',delivery:'',prescription:'',rating:'',reviews:'',provider:'OSM',sourceUrl:'',_sourceDate:'',_verification:'online',_checkedBy:'',_checkedAt:'',_note:''},x,{lat:Number.isFinite(+x.lat)?+x.lat:CENTER.lat,lng:Number.isFinite(+x.lng)?+x.lng:CENTER.lng});
  }
  function normalizePharmacies(rows){return(Array.isArray(rows)?rows:[]).map(normalizePharmacy);}
  function replaceArray(target,value){target.splice(0,target.length);(Array.isArray(value)?value:[]).forEach(function(x){target.push(x);});}
  function replaceObject(target,value){Object.keys(target).forEach(function(k){delete target[k];});if(value&&typeof value==='object'&&!Array.isArray(value))Object.keys(value).forEach(function(k){target[k]=value[k];});}
  /* Дедуп записей набора: ключ = название + адрес + округл. координаты. Лечит дубли, накопившиеся
     из-за прежних сломанных сохранений (каждый БЦ по 2 раза). Записи без названия не трогаем. */
  function _recKey(r){if(!r||typeof r!=='object')return '';var nm=String(r.name||r.n||'').trim().toLowerCase();var ad=String(r.address||r.a||'').trim().toLowerCase();var la=(r.lat!=null?r.lat:r.la),ln=(r.lng!=null?r.lng:r.ln);var lat=(la!=null&&isFinite(+la))?(+la).toFixed(5):'';var lng=(ln!=null&&isFinite(+ln))?(+ln).toFixed(5):'';return nm+'|'+ad+'|'+lat+'|'+lng;}
  function dedupDataset(arr){if(!Array.isArray(arr)||arr.length<2)return arr;var seen=Object.create(null),out=[];arr.forEach(function(r){var nm=String((r&&(r.name||r.n))||'').trim().toLowerCase();if(!nm){out.push(r);return;}var k=_recKey(r);if(seen[k])return;seen[k]=1;out.push(r);});return out;}
  function dedupInPlace(arr){var dd=dedupDataset(arr);if(dd.length!==arr.length){replaceArray(arr,dd);return arr.length;}return 0;}
  function typeKey(v){v=String(v||'').toLowerCase();if(/mall|торг|shopping/.test(v))return'mall';if(/office|business|бизнес|офис/.test(v))return'office';if(/hotel|resort|гост|курорт/.test(v))return'hotel';if(/warehouse|logistic|склад|логист/.test(v))return'warehouse';if(/residen|жил/.test(v))return'residential';if(/street|plinth|стрит|встроен/.test(v))return'street';if(/mixed|многофунк/.test(v))return'mixed';return'other';}
  function normalizeProject(o){
    o=o||{};var id=String(o.id||('geo-'+Date.now()));
    return Object.assign({id:id,name:o.ru||o.name||'Новый проект',type:typeKey(o.type),country:o.country||'Узбекистан',city:o.city||'Ташкент',district:'',address:'',lat:Number.isFinite(+o.lat)?+o.lat:CENTER.lat,lng:Number.isFinite(+o.lng)?+o.lng:CENTER.lng,stage:'concept',verification:'needs_review',source:'CASE OS / онлайн-данные',sourceDate:'',checkedBy:'',checkedAt:'',notes:'',attachments:'',files:[]},o,{id:id,type:typeKey(o.type),files:Array.isArray(o.files)?o.files:[]});
  }
  function activeId(){var s=document.getElementById('proj');return s&&s.value||Object.keys(PROJECTS)[0]||'project';}
  function active(){return PROJECTS[activeId()]||PROJECTS[Object.keys(PROJECTS)[0]]||normalizeProject({id:'project'});}
  function recordStatus(r){if(r&&typeof r==='object'&&!Array.isArray(r)){var v=r._verification||r.verification;if(v)return v;if(/reviewed|verified|подтверж/i.test(String(r.status||'')))return'verified';if(/needs|провер/i.test(String(r.status||'')))return'needs_review';}return'online';}
  function quality(){var out={online:0,needs_review:0,verified:0,total:0};['bc','medicine','pharmacies'].concat(Object.keys(POI_DEFS)).forEach(function(k){DATASETS[k].ref().forEach(function(r){var s=recordStatus(r);out[s]=(out[s]||0)+1;out.total++;});});out.total+=POP.length;out.online+=POP.length;return out;}
  function resetIndexes(){try{IXPOP=IXMED=IXBC=IXPH=null;DBB=null;}catch(e){}try{Object.keys(EDITS).forEach(function(k){delete EDITS[k];});}catch(e){}BC.forEach(function(b,i){b.id=i;});}
  function geoExcluded(){return (GEO_META&&GEO_META.excludedProjects&&typeof GEO_META.excludedProjects==='object')?GEO_META.excludedProjects:{};}
  function syncProjects(rows,selected){
    var saved={};Object.keys(GEO_PROFILES).forEach(function(k){saved[k]=clone(GEO_PROFILES[k]);});
    if(Array.isArray(rows)&&rows.length&&saved.project&&/^Новый (универсальный )?проект$/i.test(String(saved.project.name||'')))delete saved.project;
    var ex=geoExcluded();
    Object.keys(PROJECTS).forEach(function(k){delete PROJECTS[k];});
    (Array.isArray(rows)?rows:[]).forEach(function(o){if(ex[String(o.id)])return;var p=normalizeProject(Object.assign({},o,saved[String(o.id)]||{}));PROJECTS[p.id]=p;GEO_PROFILES[p.id]=clone(p);});
    Object.keys(saved).forEach(function(k){if(ex[k]){delete GEO_PROFILES[k];return;}if(!PROJECTS[k]){PROJECTS[k]=normalizeProject(saved[k]);GEO_PROFILES[k]=clone(PROJECTS[k]);}});
    if(!Object.keys(PROJECTS).length){var p=normalizeProject({id:'project'});PROJECTS[p.id]=p;GEO_PROFILES[p.id]=clone(p);}
    var s=document.getElementById('proj'),want=String(selected||s&&s.value||Object.keys(PROJECTS)[0]);
    if(s){s.innerHTML=Object.keys(PROJECTS).map(function(k){return '<option value="'+esc(k)+'">'+esc(PROJECTS[k].name||k)+'</option>';}).join('');s.value=PROJECTS[want]?want:Object.keys(PROJECTS)[0];}
  }
  function collectState(){
    Object.keys(PROJECTS).forEach(function(k){GEO_PROFILES[k]=clone(PROJECTS[k]);});
    /* На сервере храним ТОЛЬКО изменённые наборы (правки/удаления/добавления), а нетронутый
       встроенный справочник (2GIS-мастербаза ~тысячи объектов) не гоняем при каждом сохранении —
       иначе общий блоб состояния раздувается и упирается в лимиты памяти/размера PHP.
       Нетронутый набор при загрузке берётся из встроенной константы (applyState это учитывает). */
    var mod=(GEO_META&&GEO_META.datasets&&typeof GEO_META.datasets==='object')?GEO_META.datasets:{};
    var dirty=function(k){return !!mod[k];};
    var datasets={};
    if(dirty('bc')||Object.keys(EDITS).length)datasets.bc=BC.map(function(b){return clone(eff(b));});
    if(dirty('medicine'))datasets.medicine=clone(MEDPTS);
    if(dirty('pharmacies'))datasets.pharmacies=clone(PHARM);
    if(dirty('population'))datasets.population=clone(POP);
    if(dirty('districts'))datasets.districts=clone(DIST);
    if(dirty('region'))datasets.region=clone(DISTR);
    if(dirty('market'))datasets.market=clone(MARKET);
    if(dirty('prices'))datasets.prices=clone(PRICES);
    if(dirty('metro'))datasets.metro=clone(METRO);
    if(dirty('roads'))datasets.roads=clone(ROADS);
    Object.keys(POI_DEFS).forEach(function(k){if(dirty(k))datasets[k]=clone(GEO_POI[k]);});
    return {version:2,status:'manual_review',updatedAt:new Date().toISOString(),updatedBy:(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||'',projects:Object.keys(GEO_PROFILES).map(function(k){return clone(GEO_PROFILES[k]);}),datasets:datasets,meta:clone(GEO_META)};
  }
  function applyState(s){
    if(!s||typeof s!=='object')return;
    GEO_STATE_LOADED=true;GEO_META=s.meta&&typeof s.meta==='object'?clone(s.meta):GEO_META;
    if(Array.isArray(s.projects)){GEO_PROFILES={};s.projects.forEach(function(p){var n=normalizeProject(p);GEO_PROFILES[n.id]=n;});}
    var d=s.datasets||{};
    if(Array.isArray(d.bc))replaceArray(BC,d.bc.filter(function(b){return !(/botanica|taxtapul/i.test(String(b.name||b.n||''))&&/case/i.test(String(b.provider||b.src||'')));}));
    if(Array.isArray(d.medicine))replaceArray(MEDPTS,d.medicine);if(Array.isArray(d.pharmacies))replaceArray(PHARM,normalizePharmacies(d.pharmacies));if(Array.isArray(d.population))replaceArray(POP,d.population);
    if(d.districts)replaceObject(DIST,d.districts);if(d.region)replaceObject(DISTR,d.region);if(d.market)replaceObject(MARKET,d.market);if(d.prices)replaceObject(PRICES,d.prices);if(Array.isArray(d.metro))replaceArray(METRO,d.metro);if(Array.isArray(d.roads))replaceArray(ROADS,d.roads);
    Object.keys(POI_DEFS).forEach(function(k){if(Array.isArray(d[k]))replaceArray(GEO_POI[k],d[k]);});
    /* Авто-дедуп при загрузке: чиним накопившиеся дубли (каждый БЦ по 2 раза) сразу в памяти. */
    try{[BC,MEDPTS,PHARM,POP,METRO,ROADS].forEach(function(a){dedupInPlace(a);});Object.keys(POI_DEFS).forEach(function(k){dedupInPlace(GEO_POI[k]);});}catch(e){}
    resetIndexes();syncProjects(GEO_CONTEXT.projects||s.projects,GEO_CONTEXT.activeProjectId);refreshAll();
  }
  function post(type,payload){if(!EMBEDDED||window.parent===window)return;try{window.parent.postMessage(Object.assign({source:'asaas-geo-v42',type:type},payload||{}),location.origin);}catch(e){}}
  function commit(reason){
    if(!GEO_CAN_EDIT){alert('Ваша роль имеет доступ только для просмотра.');return;}
    GEO_META.updatedAt=new Date().toISOString();GEO_META.updatedBy=(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||'manual';
    GEO_SAVE_STATE='saving';GEO_SAVE_MESSAGE='';updateBanner();
    var data=collectState();if(EMBEDDED)post('asaas-geo-save',{data:data,reason:reason||'ручное редактирование'});else try{localStorage.setItem('asaas_geo_v1',JSON.stringify(data));GEO_SAVE_STATE='saved';GEO_SAVE_MESSAGE='Сохранено локально';}catch(e){GEO_SAVE_STATE='error';GEO_SAVE_MESSAGE=e.message;alert('Не удалось сохранить: '+e.message);}
    updateBanner();
  }
  function refreshAll(){
    try{renderProj();renderBC();renderMed();renderPharm();catchSummary();}catch(e){}
    try{renderPoiLayers();}catch(e){}
    try{analytics();compare();siteTab();dataTab();}catch(e){}
    try{if(typeof geoObjTab==='function')geoObjTab();}catch(e){}
    try{planningTab();}catch(e){}
    updateBanner();
  }
  function updateBanner(){
    var q=quality(),a=document.getElementById('geoAccess'),h=document.getElementById('hdrCount'),sv=document.getElementById('geoSaveStatus'),poi=Object.keys(POI_DEFS).reduce(function(n,k){return n+GEO_POI[k].length;},0);
    if(a)a.textContent=GEO_CAN_EDIT?'РЕДАКТИРОВАНИЕ':'ТОЛЬКО ПРОСМОТР';
    if(h)h.textContent=(BC.length+MEDPTS.length+PHARM.length+poi).toLocaleString('ru')+' объектов · '+q.verified+' проверено';
    if(sv){sv.className='tag geo-save-status '+GEO_SAVE_STATE;sv.textContent=GEO_SAVE_STATE==='saving'?'СОХРАНЕНИЕ…':GEO_SAVE_STATE==='saved'?'СОХРАНЕНО':GEO_SAVE_STATE==='error'?'ОШИБКА СОХРАНЕНИЯ':'';sv.title=GEO_SAVE_MESSAGE||'';sv.style.display=sv.textContent?'inline-flex':'none';}
    document.body.classList.toggle('geo-readonly',!GEO_CAN_EDIT);
  }
  function fieldHtml(f,p){var k=f[0],l=f[1],t=f[2],v=p[k]==null?'':p[k],dis=GEO_CAN_EDIT?'':' disabled';
    if(t==='textarea')return '<label class="geo-field wide"><span>'+l+'</span><textarea class="geo-pf" data-k="'+k+'"'+dis+'>'+esc(v)+'</textarea></label>';
    if(t==='type')return '<label class="geo-field"><span>'+l+'</span><select class="geo-pf" data-k="type" onchange="geoTypeChange(this.value)"'+dis+'>'+Object.keys(TYPE_LABELS).map(function(x){return '<option value="'+x+'"'+(p.type===x?' selected':'')+'>'+TYPE_LABELS[x]+'</option>';}).join('')+'</select></label>';
    if(t==='stage')return '<label class="geo-field"><span>'+l+'</span><select class="geo-pf" data-k="stage"'+dis+'>'+[['concept','Концепция'],['analysis','Анализ'],['design','Проектирование'],['construction','Строительство'],['operating','Действующий']].map(function(x){return '<option value="'+x[0]+'"'+(p.stage===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label>';
    if(t==='verification')return '<label class="geo-field"><span>'+l+'</span><select class="geo-pf" data-k="verification"'+dis+'>'+[['online','Онлайн, не проверено'],['needs_review','Нужна ручная проверка'],['verified','Подтверждено вручную']].map(function(x){return '<option value="'+x[0]+'"'+(p.verification===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label>';
    return '<label class="geo-field"><span>'+l+'</span><input class="geo-pf" data-k="'+k+'" type="'+(t==='number'?'number':t==='date'?'date':'text')+'" value="'+esc(v)+'"'+(t==='number'?' step="any"':'')+dis+'></label>';
  }
  function universalProfile(){
    var p=active(),q=quality(),specific=SCHEMAS[p.type]||SCHEMAS.other;
    var html='<div class="geo-profile-head"><div><h2>'+esc(p.name)+'</h2><p>'+esc(TYPE_LABELS[p.type]||TYPE_LABELS.other)+' · '+esc([p.city,p.country].filter(Boolean).join(', '))+'</p></div><div class="geo-quality"><b>'+q.verified.toLocaleString('ru')+'</b><span>записей подтверждено</span></div></div>'
      +'<div class="geo-form"><h3>Общие данные</h3><div class="geo-fields">'+COMMON.map(function(f){return fieldHtml(f,p);}).join('')+'</div><h3>Показатели для типа «'+esc(TYPE_LABELS[p.type]||TYPE_LABELS.other)+'»</h3><div class="geo-fields">'+specific.map(function(f){return fieldHtml(f,p);}).join('')+'</div></div>'
      +'<div class="geo-files"><h3>Файлы проекта</h3><div class="geo-file-list">'+projectFiles(p)+'</div>'+(GEO_CAN_EDIT?'<input id="geoProjectFiles" type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,text/csv"><button class="btn sec" onclick="document.getElementById(\'geoProjectFiles\').click()">＋ Прикрепить файлы</button><small>PDF, изображения, Excel, CSV и Word · до 1 МБ на файл, до 4 МБ на проект</small>':'')+'</div>'
      +'<div class="geo-actions">'+(GEO_CAN_EDIT?'<button class="btn" onclick="geoSaveProject()">💾 Сохранить профиль</button><button class="btn sec" onclick="geoPickPoint()">⌖ Выбрать точку на карте</button><button class="btn sec" onclick="geoNewProject()">＋ Новый geo-проект</button>':'<span class="geo-view-note">Эта роль может анализировать данные, но не изменять их.</span>')+'<button class="btn sec" onclick="geoExportProject()">⤓ JSON проекта</button></div>'
      +'<div class="geo-summary"><h3>Автоматический контекст точки</h3>'+pointSummary(p)+'</div>';
    document.getElementById('siteT').innerHTML=html;
  }
  function planFieldHtml(f,p){var k=f[0],l=f[1],t=f[2],v=p[k]==null?'':p[k],dis=GEO_CAN_EDIT?'':' disabled';
    if(t==='textarea')return '<label class="geo-field wide"><span>'+l+'</span><textarea class="geo-plan-pf" data-k="'+k+'"'+dis+'>'+esc(v)+'</textarea></label>';
    if(t==='planVerification')return '<label class="geo-field"><span>'+l+'</span><select class="geo-plan-pf" data-k="'+k+'"'+dis+'>'+[['unchecked','Не проверено'],['checking','Проверяется'],['verified','Подтверждено вручную'],['conflict','Есть противоречия']].map(function(x){return '<option value="'+x[0]+'"'+((v||'unchecked')===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label>';
    return '<label class="geo-field"><span>'+l+'</span><input class="geo-plan-pf" data-k="'+k+'" type="'+(t==='number'?'number':t==='date'?'date':'text')+'" value="'+esc(v)+'"'+(t==='number'?' step="any"':'')+dis+'></label>';
  }
  function planningEnvelope(p){var area=+p.siteArea||0,far=+p.planFar||0,cov=+p.planCoverage||0,gfa=area>0&&far>0?area*10000*far:0,footprint=area>0&&cov>0?area*10000*cov/100:0;
    function n(v){return v?v.toLocaleString('ru-RU',{maximumFractionDigits:0})+' м²':'—';}
    return '<div class="geo-envelope"><div><b>'+n(gfa)+'</b><span>Ориентировочный максимум надземного GFA = площадь участка × FAR</span></div><div><b>'+n(footprint)+'</b><span>Ориентировочное максимальное пятно по введённому проценту застройки</span></div><div><b>'+(p.maxFloors||'—')+'</b><span>Предельная этажность по вручную проверенному документу</span></div></div>';
  }
  function planningTab(){var host=document.getElementById('planT');if(!host)return;var p=active(),lat=Number.isFinite(+p.lat)?+p.lat:CENTER.lat,lng=Number.isFinite(+p.lng)?+p.lng:CENTER.lng;
    var html='<div class="geo-legal-warning"><b>Предварительная проверка.</b> Параметры подтверждаются только официальным документом.</div>'
      +'<section class="geo-dshk-panel"><div class="geo-dshk-head"><div><h3>DSHK · Shaffof Qurilish</h3><span class="geo-plan-coords">'+lat.toFixed(6)+', '+lng.toFixed(6)+'</span></div></div><div class="geo-dshk-card" style="border:1px solid var(--line);border-radius:10px;background:#faf9f7;padding:14px 16px;margin-top:6px"><p style="margin:0 0 10px;color:#555;font-size:12.5px;line-height:1.5">Государственный портал «Shaffof Qurilish» (DSHK) запрещает встраивание в сторонние сайты — поэтому здесь он не отображается. Откройте его в отдельной вкладке: карту зон, ПДП/АПЗ и статусы разрешений смотрите на самом портале.</p><a class="btn" href="https://dshk.shaffofqurilish.uz/" target="_blank" rel="noopener noreferrer">Открыть портал DSHK ↗</a></div></section>'
      +'<section class="geo-plan-section"><h3>Ориентировочный строительный конверт</h3>'+planningEnvelope(p)+'<p class="note">Расчёт появляется только из вручную введённых площади участка, FAR и процента застройки. Он не заменяет ПДП, АПЗ, экспертизу или разрешение.</p></section>'
      +'<section class="geo-plan-section"><h3>Карточка ручной проверки</h3><div class="geo-fields">'+PLAN_FIELDS.map(function(f){return planFieldHtml(f,p);}).join('')+'</div></section>'
      +'<div class="geo-files"><h3>Доказательные файлы проекта</h3><div class="geo-file-list">'+projectFiles(p)+'</div>'+(GEO_CAN_EDIT?'<input id="geoPlanningFiles" type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.xls,.xlsx,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,text/csv"><button class="btn sec" onclick="document.getElementById(\'geoPlanningFiles\').click()">＋ Приложить документ / скриншот</button><small>Общие файлы проекта · до 1 МБ на файл, до 4 МБ на проект</small>':'')+'</div>'
      +'<div class="geo-actions">'+(GEO_CAN_EDIT?'<button class="btn" onclick="geoSavePlanning()">💾 Сохранить градпроверку</button><button class="btn sec" onclick="geoPlanningRecalc()">↺ Пересчитать ориентиры</button>':'<span class="geo-view-note">Эта роль может просматривать проверку, но не изменять её.</span>')+'<button class="btn sec" onclick="geoExportProject()">⤓ JSON проекта</button></div>';
    host.innerHTML=html;
  }
  window.geoReloadDshk=function(){var f=document.getElementById('geoDshkFrame'),l=document.getElementById('geoDshkLoading');if(!f)return;if(l)l.classList.remove('hidden');f.src='https://dshk.shaffofqurilish.uz/?asaas_reload='+(Date.now());};
  function capturePlanning(){var p=active();document.querySelectorAll('.geo-plan-pf').forEach(function(el){var v=el.value;if(el.type==='number')v=v===''?'':+v;p[el.dataset.k]=v;});GEO_PROFILES[p.id]=clone(p);return p;}
  window.geoPlanningRecalc=function(){if(!GEO_CAN_EDIT)return;capturePlanning();planningTab();};
  window.geoSavePlanning=function(){if(!GEO_CAN_EDIT)return;var p=capturePlanning();if(p.planVerification==='verified'&&(!String(p.planSourceUrl||'').trim()||!String(p.planCheckedBy||'').trim())){alert('Для статуса «Подтверждено вручную» укажите официальный источник и проверяющего.');return;}if(p.planVerification==='verified')p.planCheckedAt=p.planCheckedAt||new Date().toISOString().slice(0,10);GEO_PROFILES[p.id]=clone(p);commit('градостроительная проверка: '+p.name);planningTab();};
  function projectFiles(p){var files=Array.isArray(p.files)?p.files:[];if(!files.length)return '<span class="note">Файлы пока не прикреплены.</span>';return files.map(function(f,i){return '<span class="geo-file"><a href="'+esc(f.data||'#')+'" download="'+esc(f.name||'file')+'">'+esc(f.name||'Файл')+'</a><small>'+Math.ceil((+f.size||0)/1024)+' КБ</small>'+(GEO_CAN_EDIT?'<button onclick="geoRemoveProjectFile('+i+')" title="Удалить">×</button>':'')+'</span>';}).join('');}
  function pointSummary(p){
    var rs=[500,1000,3000],rows=rs.map(function(r){return '<tr><td>'+r.toLocaleString('ru')+' м</td><td>'+(popR(p.lat,p.lng,r)||'—').toLocaleString('ru')+'</td><td>'+bcR(p.lat,p.lng,r)+'</td><td>'+medR(p.lat,p.lng,r,false)+'</td><td>'+phR(p.lat,p.lng,r)+'</td></tr>';}).join('');
    return '<table><thead><tr><th>Радиус</th><th>Население</th><th>БЦ</th><th>Медицина</th><th>Аптеки</th></tr></thead><tbody>'+rows+'</tbody></table><p class="note">Расчёт обновляется от координат выбранного проекта. Для транспортной изохроны используйте карту.</p>';
  }
  function captureProfile(){var p=active();document.querySelectorAll('.geo-pf').forEach(function(el){var k=el.dataset.k,v=el.value;if(el.type==='number')v=v===''?'':+v;p[k]=v;});GEO_PROFILES[p.id]=clone(p);return p;}
  window.geoTypeChange=function(v){var p=captureProfile();p.type=v;GEO_PROFILES[p.id]=clone(p);universalProfile();};
  window.geoSaveProject=function(){var p=captureProfile();if(!Number.isFinite(+p.lat)||!Number.isFinite(+p.lng)){alert('Проверьте широту и долготу.');return;}p.lat=+p.lat;p.lng=+p.lng;p.checkedAt=p.verification==='verified'?(p.checkedAt||new Date().toISOString().slice(0,10)):p.checkedAt;GEO_PROFILES[p.id]=clone(p);syncProjects(Object.keys(GEO_PROFILES).map(function(k){return GEO_PROFILES[k];}),p.id);commit('профиль проекта: '+p.name);refreshAll();};
  window.geoPickPoint=function(){if(!GEO_CAN_EDIT)return;GEO_PICK_PROJECT=true;var p=document.querySelector('[data-t="mapT"]');if(p)p.click();var l=document.getElementById('lProbe');if(l)l.checked=false;alert('Кликните по нужной точке на карте.');};
  window.geoNewProject=function(){if(!GEO_CAN_EDIT)return;var name=prompt('Название нового проекта','Новый проект');if(!name)return;var p=normalizeProject({id:'geo-'+Date.now(),name:name,type:'mixed'});GEO_PROFILES[p.id]=p;PROJECTS[p.id]=p;syncProjects(Object.keys(GEO_PROFILES).map(function(k){return GEO_PROFILES[k];}),p.id);renderProj();universalProfile();try{geoObjTab();}catch(e){}};
  window.geoExportProject=function(){downloadJson('CASE_OS_GEO_project_'+activeId()+'.json',active());};
  window.geoRemoveProjectFile=function(i){if(!GEO_CAN_EDIT)return;var p=active();if(!Array.isArray(p.files)||i<0||i>=p.files.length)return;p.files.splice(i,1);GEO_PROFILES[p.id]=clone(p);commit('удалён файл проекта: '+p.name);universalProfile();planningTab();};
  function attachProjectFiles(list){if(!GEO_CAN_EDIT||!list||!list.length)return;var p=active();p.files=Array.isArray(p.files)?p.files:[];var allowed=/\.(pdf|png|jpe?g|webp|csv|xlsx?|docx?)$/i,total=p.files.reduce(function(n,f){return n+(+f.size||0);},0),queue=Array.from(list),added=0;
    function next(){var f=queue.shift();if(!f){if(added){GEO_PROFILES[p.id]=clone(p);commit('прикреплены файлы проекта: '+p.name);universalProfile();planningTab();}return;}if(!allowed.test(f.name||'')||f.size>1048576||total+f.size>4194304){next();return;}var r=new FileReader();r.onload=function(){p.files.push({name:f.name,type:f.type||'',size:f.size,data:r.result,uploadedAt:new Date().toISOString(),uploadedBy:(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||''});total+=f.size;added++;next();};r.onerror=next;r.readAsDataURL(f);}next();
  }
  function genericAnalytics(){
    var p=active(),q=quality(),src={};BC.forEach(function(b){var e=eff(b),s=e.provider||'Без источника';src[s]=(src[s]||0)+1;});
    var byD=Object.keys(DIST).map(function(d){var a=DIST[d]||[],n=BC.map(eff).filter(function(b){return b.district===d;}).length;return{d:d,pop:+a[0]||0,area:+a[1]||0,n:n};}).sort(function(a,b){return b.n-a.n;});
    document.getElementById('anaT').innerHTML='<div class="kpis"><span class="kpi"><b>'+BC.length+'</b><small>бизнес-центров</small></span><span class="kpi"><b>'+MEDPTS.length+'</b><small>медицинских объектов с координатами'+(typeof MED!=='undefined'&&MED&&MED.total&&MED.total!==MEDPTS.length?' <span class="mini" style="display:block;font-weight:400" title="Разные числа: MEDPTS - точки на карте с координатами, MED.total - общий счётчик по категориям источника (2GIS), не у всех записей каталога есть координаты для карты">из '+MED.total+' по каталогу источника</span>':'')+'</small></span><span class="kpi"><b>'+PHARM.length+'</b><small>аптек</small></span><span class="kpi"><b>'+q.verified+'</b><small>проверено вручную</small></span></div>'
      +'<h3>Контекст выбранной точки</h3>'+pointSummary(p)+'<h3>Покрытие БЦ по районам</h3><table><thead><tr><th>Район</th><th>БЦ</th><th>Население, тыс.</th><th>Площадь, км²</th><th>БЦ / 100k</th></tr></thead><tbody>'+byD.map(function(x){return '<tr><td>'+esc(x.d)+'</td><td>'+x.n+'</td><td>'+x.pop+'</td><td>'+x.area+'</td><td>'+(x.pop?((x.n/x.pop)*100).toFixed(1):'—')+'</td></tr>';}).join('')+'</tbody></table>'
      +'<h3>Источники БЦ</h3><div class="geo-source-list">'+Object.keys(src).map(function(s){return '<span><b>'+src[s]+'</b> '+esc(s)+'</span>';}).join('')+'</div><p class="note">До ручного подтверждения данные нельзя считать финальными для клиентского отчёта.</p>';
  }
  function datasetOptions(){var all='<option value="__all__"'+(GEO_DATASET==='__all__'?' selected':'')+'>★ Все объекты (все наборы)</option>';return all+Object.keys(DATASETS).map(function(k){return '<option value="'+k+'"'+(GEO_DATASET===k?' selected':'')+'>'+DATASETS[k].label+'</option>';}).join('');}
  var GEO_SEL=Object.create(null);
  var GEO_SORT='',GEO_ONLY_UNEDITED=false;
  function geoAllRows(){var out=[];Object.keys(DATASETS).forEach(function(k){var cfg=DATASETS[k];if(cfg.kind!=='array')return;cfg.ref().forEach(function(x,i){out.push({k:k,x:x,i:i});});});return out;}
  function recordUpdatedAt(x){return x&&typeof x==='object'&&x._updatedAt?x._updatedAt:null;}
  function fmtUpdated(iso){if(!iso)return null;var d=new Date(iso);if(isNaN(d))return null;var days=Math.floor((Date.now()-d.getTime())/86400000);var datePart=d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'});var rel=days<=0?'сегодня':days===1?'вчера':days<7?days+' дн. назад':datePart;return {rel:rel,full:d.toLocaleString('ru-RU'),days:days};}
  window.geoSortChange=function(v){geoEnsureUiPrefs();GEO_SORT=v||'';geoSaveUiPrefs();renderDatasetRows();};
  window.geoToggleUnedited=function(on){geoEnsureUiPrefs();GEO_ONLY_UNEDITED=!!on;geoSaveUiPrefs();renderDatasetRows();};
  function rowText(x,i){if(Array.isArray(x))return x.slice(0,4).join(' · ');if(x&&typeof x==='object')return x.name||x.n||x.title||x.d||x.id||('Запись '+(i+1));return String(x);}
  function rowSummary(x,k){if(k==='bc')return [x.district,x['class'],x.address,x.provider].filter(Boolean).join(' · ');if(k==='medicine')return [x.d||x.a,x.t,x.sp,x.s].filter(Boolean).join(' · ');if(k==='pharmacies')return [x.format,x.district,x.address,x.chain,x.provider].filter(Boolean).join(' · ');if(k==='population')return 'Население: '+Number(x[2]||0).toLocaleString('ru-RU')+' · '+(+x[0]).toFixed(5)+', '+(+x[1]).toFixed(5);if(k==='metro')return (Array.isArray(x.s)?x.s.length:0)+' станций';if(k==='roads')return [x.km&&x.km+' км',x.min&&x.min+' мин'].filter(Boolean).join(' · ');if(POI_DEFS[k])return [x.subtype,x.district,x.address,x.operator||x.chain,x.provider].filter(Boolean).join(' · ');return '';}
  window.geoMasterToggle=function(){try{var c=localStorage.getItem('caseos_geo_master_collapsed')==='1';localStorage.setItem('caseos_geo_master_collapsed',c?'0':'1');}catch(e){}try{dataManager();}catch(e){}};
  function dataManager(){
    var q=quality();
    var bm=window.ASAAS_GEO_MASTER_META||{};
    document.getElementById('dataT').innerHTML=(GEO_CAN_EDIT?'':'<div class="geo-notice">Режим просмотра: редактирование отключено для этой роли.</div>')
      +(function(){var col=false;try{col=localStorage.getItem('caseos_geo_master_collapsed')==='1';}catch(e){}
        var stats=(bm.records||q.total).toLocaleString('ru-RU')+' объектов с координатами · '+(bm.business_centers||BC.length)+' БЦ · '+(bm.medicine||MEDPTS.length)+' медицина · '+(bm.pharmacies||PHARM.length)+' аптек · '+(bm.restaurants||GEO_POI.restaurants.length)+' ресторанов · '+(bm.cafes||GEO_POI.cafes.length)+' кафе · '+(bm.mahallas||0)+' махаллинских комитетов';
        var links=GEO_CAN_EDIT?'<div class="geo-master-links"><a href="api/geo_master.php?file=master.csv" download>Master CSV</a><a href="api/geo_master.php?file=master.geojson" download>GeoJSON</a><a href="api/geo_master.php?file=research_queue.csv" download>Очередь проверки</a><a href="api/geo_master.php?file=qa_issues.csv" download>QA-ошибки</a></div>':'';
        return '<div class="geo-master-banner"><div style="flex:1;min-width:0"><b onclick="geoMasterToggle()" title="Свернуть / развернуть" style="cursor:pointer;user-select:none">'+(col?'▸':'▾')+' Мастер-база Ташкента · '+esc(bm.version||'4.8.1')+'</b>'+(col?'':'<span>'+stats+'</span>')+'</div>'+(col?'':links)+'</div>';
      })()
      +'<div class="geo-data-head"><div><h2>Управление геоданными</h2></div><div class="geo-qchips"><span>Онлайн <b>'+q.online+'</b></span><span>Проверить <b>'+q.needs_review+'</b></span><span>Подтверждено <b>'+q.verified+'</b></span></div></div>'
      +'<div class="geo-data-tools"><select id="geoDataset" onchange="geoDatasetChange(this.value)">'+datasetOptions()+'</select><input id="geoSearch" value="'+esc(GEO_QUERY)+'" placeholder="Поиск в наборе…" oninput="geoSearch(this.value)">'
      +'<select id="geoSortBy" onchange="geoSortChange(this.value)"><option value=""'+(GEO_SORT===''?' selected':'')+'>Сортировка: по умолчанию</option><option value="updated_desc"'+(GEO_SORT==='updated_desc'?' selected':'')+'>Сначала недавно обновлённые</option><option value="updated_asc"'+(GEO_SORT==='updated_asc'?' selected':'')+'>Сначала неотредактированные</option></select>'
      +'<label class="geo-unedited-toggle"><input type="checkbox" id="geoOnlyUnedited"'+(GEO_ONLY_UNEDITED?' checked':'')+' onchange="geoToggleUnedited(this.checked)"> Только неотредактированные</label>'
      +(GEO_ADMIN_EDIT?'<button class="btn sec'+(GEO_EDIT_MODE?' geo-on':'')+'" onclick="geoToggleEdit()" title="Редактирование значений прямо в таблице (выберите конкретный набор). Доступно только администраторам.">✎ Правка в таблице'+(GEO_EDIT_MODE?': ВКЛ':'')+'</button>':'')
      +(GEO_CAN_EDIT?'<button class="btn" onclick="geoAddRecord()">＋ Добавить</button><button class="btn sec" style="border-color:#e0a0a0;color:#9E0000" onclick="geoDeleteSelected()">🗑 Удалить выбранные</button><button class="btn sec" onclick="geoDedupAll()" title="Удалить дубликаты во всех наборах (по названию+адресу+координатам)">🧹 Дубликаты</button><button class="btn sec" onclick="geoImportDataset()">⇧ Импорт</button>':'')+'<button class="btn sec" onclick="geoExportTableCSV()">⤓ CSV / Excel</button><button class="btn sec" onclick="geoPrintDataset()">🖨 PDF / печать</button><button class="btn sec" onclick="geoExportDataset()">⤓ JSON</button></div><input type="file" id="geoFile" accept=".json,.csv,application/json,text/csv" hidden onchange="geoFilePicked(this)"><div id="geoRows"></div>';
    renderDatasetRows();
  }
  function geoColWidthKey(){try{var u=(typeof S!=='undefined'&&S&&S.user)||{};var id=String(u.id||u.email||u.name||'guest').toLowerCase().replace(/[^a-z0-9_-]+/gi,'_').slice(0,80)||'guest';return 'geo_col_widths::'+id;}catch(e){return 'geo_col_widths::guest';}}
  var GEO_COLW_KEY='',GEO_COLW={};
  function geoEnsureColWidthsUser(){try{var k=geoColWidthKey();if(k===GEO_COLW_KEY)return;GEO_COLW_KEY=k;var raw=localStorage.getItem(k);if(raw){GEO_COLW=JSON.parse(raw||'{}')||{};return;}var legacy=localStorage.getItem('geo_col_widths');if(legacy){localStorage.setItem(k,legacy);GEO_COLW=JSON.parse(legacy||'{}')||{};}else GEO_COLW={};}catch(e){GEO_COLW={};}}
  function geoSaveColWidths(){try{geoEnsureColWidthsUser();localStorage.setItem(geoColWidthKey(),JSON.stringify(GEO_COLW));}catch(e){}}
  function geoTableWidthFromCols(table){var sum=0;table.querySelectorAll('col[data-colkey]').forEach(function(col){sum+=parseInt(col.style.width,10)||0;});return sum;}
  function geoMakeColsResizable(table){
    if(!table)return;
    var ths=table.querySelectorAll('th[data-colkey]');
    ths.forEach(function(th){
      var handle=th.querySelector('.geo-col-resizer');if(!handle)return;
      var dragging=false,startX=0,startW=0,key=th.getAttribute('data-colkey');
      handle.addEventListener('mousedown',function(ev){
        ev.preventDefault();ev.stopPropagation();dragging=true;startX=ev.clientX;startW=th.getBoundingClientRect().width;
        document.body.style.userSelect='none';document.body.style.cursor='col-resize';
        function onMove(e){if(!dragging)return;var w=Math.max(34,Math.round(startW+(e.clientX-startX)));th.style.width=w+'px';var col=table.querySelector('col[data-colkey="'+key+'"]');if(col)col.style.width=w+'px';table.style.width=geoTableWidthFromCols(table)+'px';}
        function onUp(){if(!dragging)return;dragging=false;document.body.style.userSelect='';document.body.style.cursor='';GEO_COLW[key]=parseInt(th.style.width,10)||startW;geoSaveColWidths();table.style.width=geoTableWidthFromCols(table)+'px';document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      handle.addEventListener('dblclick',function(ev){ev.stopPropagation();delete GEO_COLW[key];geoSaveColWidths();renderDatasetRows();});
    });
  }
  // Город отдельным полем в данных не хранится (объекты почти всегда ташкентские) - он у него
  // просто дописан последним куском адреса через запятую ("...Tashkent"). Достаём его оттуда;
  // если когда-нибудь появится настоящее поле x.city/x.town - оно в приоритете.
  function rowCity(x){
    if(x.city)return x.city;if(x.town)return x.town;
    var addr=x.address||x.a||'';if(!addr)return '';
    var parts=addr.split(',');return (parts[parts.length-1]||'').trim();
  }
  // Разбивает то же, что уже собирает rowSummary() одной строкой ("Детали"), на отдельные
  // поля-колонки, чтобы базовую информацию было видно и можно было сортировать/фильтровать
  // без открытия карточки. rowSummary() не трогаем - её отдельно использует CSV/печать.
  function rowFields(x,k){
    var city=rowCity(x),klass=x['class']||x.klass||'';
    if(k==='bc')return {city:city,district:x.district||'',category:x['class']||'',address:x.address||'',source:x.provider||'',klass:klass,cuisine:'',alcohol:''};
    if(k==='medicine')return {city:city,district:x.d||'',category:x.t||x.sp||'',address:x.a||'',source:x.s||'',klass:klass,cuisine:'',alcohol:''};
    if(k==='pharmacies')return {city:city,district:x.district||'',category:x.format||'',address:x.address||'',source:x.chain||x.provider||'',klass:klass,cuisine:'',alcohol:''};
    if(k==='population')return {city:'',district:'',category:'',address:(+x[0]).toFixed(5)+', '+(+x[1]).toFixed(5),source:'',klass:'',cuisine:'',alcohol:''};
    if(POI_DEFS[k])return {city:city,district:x.district||'',category:x.subtype||'',cuisine:x.cuisinePrimary||x.cuisine||'',alcohol:x.alcoholStatus||'',address:x.address||'',source:x.operator||x.chain||x.provider||'',klass:klass};
    return {city:city,district:x.district||'',category:x['class']||x.subtype||x.format||'',cuisine:x.cuisinePrimary||x.cuisine||'',alcohol:x.alcoholStatus||'',address:x.address||'',source:x.provider||x.chain||x.operator||'',klass:klass};
  }
  var GEO_TSORT=null,GEO_TFILTERS={},GEO_TFOCUS=null,GEO_UI_USER_KEY='';
  function geoUiPrefKey(){try{var u=(typeof S!=='undefined'&&S&&S.user)||{};var id=String(u.id||u.email||u.name||'guest').toLowerCase().replace(/[^a-z0-9_-]+/gi,'_').slice(0,80)||'guest';return 'caseos_geo_table_prefs::'+id;}catch(e){return 'caseos_geo_table_prefs::guest';}}
  function geoEnsureUiPrefs(){try{var k=geoUiPrefKey();if(k===GEO_UI_USER_KEY)return;GEO_UI_USER_KEY=k;var p=JSON.parse(localStorage.getItem(k)||'{}')||{};GEO_TSORT=p.sort||null;GEO_TFILTERS=p.filters&&typeof p.filters==='object'?p.filters:{};GEO_SORT=p.legacySort||GEO_SORT||'';GEO_ONLY_UNEDITED=!!p.onlyUnedited;GEO_OBJ_SORT=p.objSort||null;GEO_OBJ_FILTERS=p.objFilters&&typeof p.objFilters==='object'?p.objFilters:{};}catch(e){}}
  function geoSaveUiPrefs(){try{localStorage.setItem(geoUiPrefKey(),JSON.stringify({sort:GEO_TSORT||null,filters:GEO_TFILTERS||{},legacySort:GEO_SORT||'',onlyUnedited:!!GEO_ONLY_UNEDITED,objSort:GEO_OBJ_SORT||null,objFilters:GEO_OBJ_FILTERS||{}}));}catch(e){}}
  window.geoTblSort=function(key){geoEnsureUiPrefs();if(!GEO_TSORT||GEO_TSORT.key!==key)GEO_TSORT={key:key,dir:1};else if(GEO_TSORT.dir>0)GEO_TSORT.dir=-1;else GEO_TSORT=null;geoSaveUiPrefs();renderDatasetRows();};
  window.geoTblFilter=function(key,v){geoEnsureUiPrefs();GEO_TFILTERS[key]=v;GEO_TFOCUS='geoTFilter_'+key;geoSaveUiPrefs();renderDatasetRows();};
  window.geoTblFilterReset=function(){geoEnsureUiPrefs();GEO_TFILTERS={};GEO_TSORT=null;geoSaveUiPrefs();renderDatasetRows();};
  /* ===== Табличное редактирование геоданных (как в LCR) — только для админ-ролей (владелец / мл. админ / администратор) ===== */
  var GEO_ALC=[['','—'],['unknown','Не проверено'],['yes','Есть'],['no','Нет'],['limited','Ограниченно'],['seasonal','Сезонно']];
  function geoColToRaw(k,col){
    if(POI_DEFS[k])return ({name:'name',district:'district',category:'subtype',cuisine:'cuisinePrimary',alcohol:'alcoholStatus',address:'address',source:'operator',klass:'class'})[col]||null;
    var M={bc:{name:'name',district:'district',category:'class',klass:'class',address:'address',source:'provider'},
           medicine:{name:'n',district:'d',category:'t',address:'a',source:'s'},
           pharmacies:{name:'name',district:'district',category:'format',address:'address',source:'chain'}};
    return (M[k]||{})[col]||null;
  }
  var GEO_COMMIT_T=null;
  function geoCommitSoon(reason){clearTimeout(GEO_COMMIT_T);GEO_COMMIT_T=setTimeout(function(){try{commit(reason||'правка в таблице');}catch(e){}},700);}
  window.geoSetCell=function(k,i,col,val){if(!GEO_ADMIN_EDIT){alert('Недостаточно прав.');return;}var cfg=DATASETS[k],data=cfg&&cfg.ref();i=+i;if(!cfg||cfg.kind!=='array'||!Array.isArray(data)||!data[i]||Array.isArray(data[i]))return;var raw=geoColToRaw(k,col);if(!raw)return;data[i][raw]=val;try{stampRecord(data[i]);}catch(e){}markDataset(k);try{resetIndexes();}catch(e){}geoCommitSoon('изменено поле «'+col+'» в наборе '+k);};
  window.geoToggleEdit=function(){if(!GEO_ADMIN_EDIT){alert('Правка в таблице доступна только администраторам.');return;}GEO_EDIT_MODE=!GEO_EDIT_MODE;dataManager();};
  function geoFilterActive(fv){return fv!=null&&fv!==''&&(typeof fv!=='object'||Array.isArray(fv.vals));}
  /* Меню фильтра столбца «как в LCR/Google Sheets»: сортировка + галочки значений + поиск + «содержит». */
  var GEO_MENU=null;
  function geoMenuClose(){var m=document.getElementById('geoColMenu');if(m&&m.parentNode)m.parentNode.removeChild(m);GEO_MENU=null;document.removeEventListener('mousedown',geoMenuAway,true);document.removeEventListener('keydown',geoMenuEsc,true);}
  window.geoMenuClose=geoMenuClose;
  function geoMenuAway(e){var m=document.getElementById('geoColMenu');if(m&&!m.contains(e.target))geoMenuClose();}
  function geoMenuEsc(e){if(e.key==='Escape')geoMenuClose();}
  function geoPlaceColMenu(m,anchor){var vv=window.visualViewport,vw=Math.max(280,Math.floor(vv?vv.width:window.innerWidth)),vh=Math.max(280,Math.floor(vv?vv.height:window.innerHeight)),ox=vv?vv.offsetLeft:0,oy=vv?vv.offsetTop:0,mw=Math.min(326,vw-16);m.style.width=mw+'px';m.style.maxHeight=Math.max(260,vh-16)+'px';var r=anchor.getBoundingClientRect();var left=Math.max(ox+8,Math.min(r.left,ox+vw-mw-8));m.style.left=left+'px';var mh=m.offsetHeight,below=oy+vh-r.bottom-8,above=r.top-oy-8,top;if(below>=Math.min(mh,320))top=r.bottom+4;else if(above>=Math.min(mh,260))top=r.top-mh-4;else top=Math.max(oy+8,Math.min(r.bottom+4,oy+vh-mh-8));m.style.top=top+'px';}
  function geoDistinctVals(col){var base=(GEO_DATASET==='__all__')?geoAllRows():DATASETS[GEO_DATASET].ref().map(function(x,i){return{k:GEO_DATASET,x:x,i:i};});var set=[],blank=false;base.forEach(function(r){var f=rowFields(r.x,r.k);var v=col==='name'?rowText(r.x,r.i):col==='dataset'?((DATASETS[r.k]||{}).label||r.k):(f[col]||'');if(v==null||v==='')blank=true;else{v=String(v);if(set.indexOf(v)<0)set.push(v);}});set.sort(function(a,b){return a.localeCompare(b,'ru',{numeric:true});});if(blank)set.push('(Пусто)');return set;}
  window.geoColMenu=function(key,anchor){geoMenuClose();var distinct=geoDistinctVals(key);var cur=GEO_TFILTERS[key];var curVals=(cur&&typeof cur==='object'&&Array.isArray(cur.vals))?cur.vals.slice():null;var curTxt=(typeof cur==='string')?cur:'';var checked={};distinct.forEach(function(v){checked[v]=curVals==null?true:curVals.indexOf(v)>=0;});GEO_MENU={key:key,distinct:distinct,checked:checked};
    var valList=distinct.map(function(v){return '<label class="geo-m-v"><input type="checkbox" data-v="'+esc(v)+'"'+(checked[v]?' checked':'')+' onchange="geoMenuCheck(this)"><span>'+esc(v)+'</span></label>';}).join('');
    var th=anchor&&anchor.closest?anchor.closest('th'):null,label=key;if(th){var ln=th.querySelector('.geo-th-label');if(ln)label=(ln.textContent||key).replace(/[⇅▲▼▾]/g,'').trim()||key;}
    var html='<div class="geo-m-head"><b>'+esc(label)+'</b><button type="button" class="geo-m-x" onclick="geoMenuClose()" aria-label="Закрыть">×</button></div>'
      +'<div class="geo-m-body"><div class="geo-m-sort"><button type="button" onclick="geoMenuSort(1)">▲ А → Я</button><button type="button" onclick="geoMenuSort(-1)">▼ Я → А</button></div>'
      +'<div class="geo-m-sec">Условие</div><label class="geo-m-field"><span>Содержит</span><input type="search" id="geoMTxt" value="'+esc(curTxt)+'" placeholder="Введите текст"></label>'
      +'<div class="geo-m-sec">Значения <small>'+distinct.length+'</small></div><input type="search" id="geoMSrch" placeholder="Поиск значения…" oninput="geoMenuSearch(this.value)">'
      +'<div class="geo-m-links"><a href="#" onclick="geoMenuAll(true);return false">Выбрать все</a><span>·</span><a href="#" onclick="geoMenuAll(false);return false">Снять все</a></div>'
      +'<div id="geoMVals" class="geo-m-vals">'+(valList||'<div class="geo-m-empty">Нет значений</div>')+'</div></div>'
      +'<div class="geo-m-ftr"><button type="button" onclick="geoMenuReset()">Сбросить</button><span class="geo-m-spacer"></span><button type="button" onclick="geoMenuClose()">Отмена</button><button type="button" class="geo-m-ok" onclick="geoMenuApply()">Применить</button></div>';
    var m=document.createElement('div');m.id='geoColMenu';m.innerHTML=html;document.body.appendChild(m);
    geoPlaceColMenu(m,anchor);
    setTimeout(function(){document.addEventListener('mousedown',geoMenuAway,true);document.addEventListener('keydown',geoMenuEsc,true);},0);};
  window.geoMenuCheck=function(el){if(GEO_MENU)GEO_MENU.checked[el.getAttribute('data-v')]=el.checked;};
  window.geoMenuAll=function(on){if(!GEO_MENU)return;var q=(document.getElementById('geoMSrch').value||'').toLowerCase();document.querySelectorAll('#geoMVals input').forEach(function(cb){var v=cb.getAttribute('data-v');if(!q||v.toLowerCase().indexOf(q)>=0){cb.checked=on;GEO_MENU.checked[v]=on;}});};
  window.geoMenuSearch=function(q){q=(q||'').toLowerCase();document.querySelectorAll('#geoMVals .geo-m-v').forEach(function(l){var v=l.querySelector('input').getAttribute('data-v');l.style.display=(!q||v.toLowerCase().indexOf(q)>=0)?'grid':'none';});};
  window.geoMenuSort=function(dir){if(!GEO_MENU)return;var k=GEO_MENU.key;geoMenuClose();GEO_TSORT={key:k,dir:dir};geoSaveUiPrefs();renderDatasetRows();};
  window.geoMenuReset=function(){if(!GEO_MENU)return;var k=GEO_MENU.key;geoMenuClose();delete GEO_TFILTERS[k];if(GEO_TSORT&&GEO_TSORT.key===k)GEO_TSORT=null;geoSaveUiPrefs();renderDatasetRows();};
  window.geoMenuApply=function(){if(!GEO_MENU)return;var k=GEO_MENU.key,distinct=GEO_MENU.distinct;var txt=((document.getElementById('geoMTxt')||{}).value||'').trim();var all=true,any=false,sel=[];distinct.forEach(function(v){if(GEO_MENU.checked[v]){any=true;sel.push(v);}else all=false;});geoMenuClose();if(txt){GEO_TFILTERS[k]=txt;}else if(!all){GEO_TFILTERS[k]={vals:any?sel:[]};}else{delete GEO_TFILTERS[k];}geoSaveUiPrefs();renderDatasetRows();};
  function geoEnsureTblCss(){if(document.getElementById('geoTblEditCss'))return;var st=document.createElement('style');st.id='geoTblEditCss';st.textContent=
    '.geo-th-fnl{display:inline-block;margin-left:5px;cursor:pointer;color:#8a847c;font-size:16px;line-height:1;opacity:.85;vertical-align:-1px}'+
    '.geo-th-fnl:hover{opacity:1;color:#9E0000}.geo-th-fnl.on{color:#fff;background:#9E0000;border-radius:5px;padding:0 4px;opacity:1}'+
    '.geo-cell-inp{width:100%;box-sizing:border-box;font-family:inherit;font-size:12px;padding:3px 5px;border:1px solid #d9d2c7;border-radius:6px}'+
    '#geoColMenu{position:fixed;z-index:100000;display:flex;flex-direction:column;box-sizing:border-box;min-width:280px;background:#fff;border:1px solid #d9d2c7;border-radius:12px;box-shadow:0 16px 42px rgba(28,22,18,.24);padding:0;font-size:12px;overflow:hidden;color:#1c1f26}'+
    '#geoColMenu *{box-sizing:border-box}'+
    '#geoColMenu .geo-m-head{display:flex;align-items:center;gap:8px;min-height:42px;padding:9px 11px;border-bottom:1px solid #ece7e0;background:#fff}'+
    '#geoColMenu .geo-m-head b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}'+
    '#geoColMenu .geo-m-x{margin-left:auto;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:#766f67;font-size:20px;line-height:1;cursor:pointer}'+
    '#geoColMenu .geo-m-x:hover{background:#f4f0eb;color:#9E0000}'+
    '#geoColMenu .geo-m-body{min-height:0;padding:10px 11px 0;overflow:hidden}'+
    '#geoColMenu .geo-m-sort{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px;margin:0 0 9px}'+
    '#geoColMenu .geo-m-sort button{min-width:0;text-align:center;background:#fff;border:1px solid #ded7ce;padding:7px 6px;border-radius:8px;font-family:inherit;font-size:11.5px;font-weight:650;cursor:pointer;color:#3d3935;white-space:nowrap}'+
    '#geoColMenu .geo-m-sort button:hover{background:#f7f3ee;border-color:#cfc4b8}'+
    '#geoColMenu .geo-m-sec{display:flex;align-items:center;gap:5px;font-size:9.5px;font-weight:800;color:#7d756d;text-transform:uppercase;letter-spacing:.035em;margin:9px 0 5px;border-top:1px solid #eee8e1;padding-top:9px}'+
    '#geoColMenu .geo-m-sec small{margin-left:auto;font-size:9px;color:#a29a92;font-weight:650}'+
    '#geoColMenu .geo-m-field{display:block;margin:0}#geoColMenu .geo-m-field>span{display:none}'+
    '#geoColMenu input[type=search],#geoColMenu input[type=text]{display:block;width:100%;min-width:0;height:32px;font-family:inherit;font-size:11.5px;padding:6px 8px;border:1px solid #d9d2c7;border-radius:7px;background:#fff;color:#1c1f26;outline:none}'+
    '#geoColMenu input[type=search]:focus,#geoColMenu input[type=text]:focus{border-color:#9E0000;box-shadow:0 0 0 2px rgba(158,0,0,.08)}'+
    '#geoColMenu input[type=checkbox]{width:15px;height:15px;min-width:15px;margin:1px 0 0;accent-color:#9E0000;padding:0;border:0}'+
    '#geoColMenu .geo-m-links{display:flex;align-items:center;gap:5px;font-size:10.5px;margin:6px 0 5px;white-space:nowrap}#geoColMenu .geo-m-links a{color:#9E0000;text-decoration:none}#geoColMenu .geo-m-links a:hover{text-decoration:underline}'+
    '#geoColMenu .geo-m-vals{height:min(230px,34vh);min-height:76px;overflow-y:auto;overflow-x:hidden;border:1px solid #ece7e0;border-radius:8px;padding:4px;background:#fff;scrollbar-gutter:stable}'+
    '#geoColMenu .geo-m-v{display:grid;grid-template-columns:17px minmax(0,1fr);gap:7px;align-items:start;width:100%;min-width:0;padding:5px 5px;font-size:11.5px;line-height:1.25;cursor:pointer;border-radius:6px;white-space:normal}'+
    '#geoColMenu .geo-m-v:hover{background:#f7f3ee}#geoColMenu .geo-m-v span{display:block;min-width:0;overflow-wrap:anywhere;word-break:break-word}'+
    '#geoColMenu .geo-m-empty{padding:12px;text-align:center;color:#8d857d}'+
    '#geoColMenu .geo-m-ftr{display:flex;flex:0 0 auto;gap:6px;align-items:center;margin-top:10px;border-top:1px solid #ece7e0;padding:9px 11px 10px;background:#fff}'+
    '#geoColMenu .geo-m-spacer{flex:1}#geoColMenu .geo-m-ftr button{font-family:inherit;font-size:11.5px;font-weight:650;padding:7px 10px;border:1px solid #d9d2c7;border-radius:8px;background:#fff;color:#49443f;cursor:pointer;white-space:nowrap}'+
    '#geoColMenu .geo-m-ftr button:hover{background:#f7f3ee}#geoColMenu .geo-m-ok{background:#9E0000!important;color:#fff!important;border-color:#9E0000!important}'+
    '.btn.geo-on{background:#9E0000;color:#fff;border-color:#9E0000}';
    document.head.appendChild(st);}
  function renderDatasetRows(){var host=document.getElementById('geoRows');if(!host)return;try{geoEnsureUiPrefs();geoEnsureColWidthsUser();geoEnsureTblCss();}catch(e){}
    var ALL=GEO_DATASET==='__all__';
    if(!ALL){var cfg0=DATASETS[GEO_DATASET];if(cfg0&&cfg0.kind==='object'){var data0=cfg0.ref();host.innerHTML='<div class="geo-object"><b>'+esc(cfg0.label)+'</b><span>'+Object.keys(data0).length+' ключей</span><pre>'+esc(JSON.stringify(data0,null,2).slice(0,12000))+(JSON.stringify(data0).length>12000?'\n…':'')+'</pre></div>';return;}}
    var base=ALL?geoAllRows():DATASETS[GEO_DATASET].ref().map(function(x,i){return{k:GEO_DATASET,x:x,i:i};});
    var total=base.length,q=GEO_QUERY.toLowerCase();
    var rows=base.map(function(r){r.t=rowText(r.x,r.i);r.fields=rowFields(r.x,r.k);r.st=recordStatus(r.x);r.upd=recordUpdatedAt(r.x);return r;}).filter(function(r){
      if(q){var hay=[r.t,r.fields.city,r.fields.district,r.fields.category,r.fields.cuisine,r.fields.alcohol,r.fields.klass,r.fields.address,r.fields.source].join(' ').toLowerCase();if(hay.indexOf(q)<0&&JSON.stringify(r.x).toLowerCase().indexOf(q)<0)return false;}
      for(var fk in GEO_TFILTERS){var fv=GEO_TFILTERS[fk];if(!geoFilterActive(fv))continue;
        var val=fk==='name'?r.t:(fk==='dataset'?((DATASETS[r.k]||{}).label||r.k):(r.fields[fk]||''));
        if(fv&&typeof fv==='object'&&Array.isArray(fv.vals)){var sv=(val==null||val==='')?'(Пусто)':String(val);if(fv.vals.indexOf(sv)<0)return false;}
        else if(String(val).toLowerCase().indexOf(String(fv).toLowerCase())<0)return false;}
      return true;
    });
    var uneditedTotal=rows.filter(function(r){return !r.upd;}).length;
    if(GEO_ONLY_UNEDITED)rows=rows.filter(function(r){return !r.upd;});
    if(GEO_TSORT){
      var sk=GEO_TSORT.key,sd=GEO_TSORT.dir;
      rows.sort(function(a,b){
        if(sk==='updated'){var av=a.upd?new Date(a.upd).getTime():-1,bv=b.upd?new Date(b.upd).getTime():-1;return (av-bv)*sd;}
        var va=sk==='name'?a.t:sk==='dataset'?((DATASETS[a.k]||{}).label||a.k):sk==='status'?a.st:(a.fields[sk]||'');
        var vb=sk==='name'?b.t:sk==='dataset'?((DATASETS[b.k]||{}).label||b.k):sk==='status'?b.st:(b.fields[sk]||'');
        va=String(va).toLowerCase();vb=String(vb).toLowerCase();
        return (va<vb?-1:va>vb?1:0)*sd;
      });
    }else if(GEO_SORT==='updated_desc')rows.sort(function(a,b){return (b.upd?new Date(b.upd).getTime():-1)-(a.upd?new Date(a.upd).getTime():-1);});
    else if(GEO_SORT==='updated_asc')rows.sort(function(a,b){var av=a.upd?new Date(a.upd).getTime():-1,bv=b.upd?new Date(b.upd).getTime():-1;return av-bv;});
    var CAP=400,shown=rows.slice(0,CAP);
    var head='<div class="geo-list-count">Показано <b>'+shown.length+'</b>'+(rows.length>CAP?' из '+rows.length+' найденных':'')+' · всего <b>'+total+'</b>'+
      ' · не редактировано <b>'+uneditedTotal+'</b>'+
      ' · выбрано <b id="geoSelCount">'+Object.keys(GEO_SEL).length+'</b>'+
      (GEO_TSORT||Object.keys(GEO_TFILTERS).some(function(k){return GEO_TFILTERS[k];})?' · <a href="#" onclick="geoTblFilterReset();return false">сбросить сортировку/фильтры</a>':'')+'</div>';
    if(GEO_EDIT_MODE&&GEO_ADMIN_EDIT)head+=(GEO_DATASET==='__all__'
      ?'<div class="geo-list-count" style="color:#9E0000">✎ Правка в таблице: выберите конкретный набор данных (не «★ Все объекты»), чтобы редактировать значения прямо в ячейках.</div>'
      :'<div class="geo-list-count" style="color:#1f6f2b">✎ Правка в таблице включена — редактируйте ячейки (Название, Район, Категория, Кухня/формат, Алкоголь, Класс, Адрес, Источник). Сохраняется автоматически.</div>');
    var cols=[
      {key:'sel',w:30,label:'<input type="checkbox" id="geoSelAll" onclick="geoSelectPage(this.checked)" title="Выбрать показанные">'},
      {key:'status',w:26,label:'',sortable:true},
      {key:'name',w:190,label:'Название',sortable:true,filterable:true}
    ].concat(ALL?[{key:'dataset',w:130,label:'Набор',sortable:true,filterable:true}]:[]).concat([
      {key:'city',w:100,label:'Город',sortable:true,filterable:true},
      {key:'district',w:120,label:'Район',sortable:true,filterable:true},
      {key:'category',w:130,label:'Категория',sortable:true,filterable:true},
      {key:'cuisine',w:150,label:'Кухня / формат',sortable:true,filterable:true},
      {key:'alcohol',w:120,label:'Алкоголь',sortable:true,filterable:true},
      {key:'klass',w:80,label:'Класс',sortable:true,filterable:true},
      {key:'address',w:220,label:'Адрес',sortable:true,filterable:true},
      {key:'source',w:110,label:'Источник',sortable:true,filterable:true},
      {key:'updated',w:130,label:'Обновлено',sortable:true}
    ]);
    var colgroup='<colgroup>'+cols.map(function(c){var w=GEO_COLW[c.key]||c.w;return '<col data-colkey="'+c.key+'" style="width:'+w+'px">';}).join('')+'</colgroup>';
    var sortIc=function(c){if(!c.sortable||!GEO_TSORT||GEO_TSORT.key!==c.key)return '';return ' <span class="geo-th-sort-ic on">'+(GEO_TSORT.dir>0?'▲':'▼')+'</span>';};
    var th='<tr>'+cols.map(function(c){var w=GEO_COLW[c.key]||c.w;var directSort=c.sortable&&!c.filterable;var sty=' style="width:'+w+'px'+(directSort?';cursor:pointer':'')+'"';var click=directSort?' onclick="geoTblSort(\''+c.key+'\')" title="Сортировать"':'';var fnl=c.filterable?' <span class="geo-th-fnl'+(geoFilterActive(GEO_TFILTERS[c.key])?' on':'')+'" title="Фильтр и сортировка" onclick="event.stopPropagation();geoColMenu(\''+c.key+'\',this)">▾</span>':'';return '<th data-colkey="'+c.key+'"'+click+sty+'><span class="geo-th-label">'+c.label+sortIc(c)+fnl+'</span><span class="geo-col-resizer" title="Потяните, чтобы изменить ширину · двойной клик — сбросить" onclick="event.stopPropagation()"></span></th>';}).join('')+'</tr>';
    var filterRow='';
    var EDIT=GEO_EDIT_MODE&&GEO_ADMIN_EDIT&&GEO_DATASET!=='__all__';
    var editCell=function(r,col,dispHtml,rawVal){if(EDIT&&geoColToRaw(r.k,col)){if(col==='alcohol')return '<td onclick="event.stopPropagation()"><select class="geo-cell-inp" onchange="geoSetCell(\''+esc(r.k)+'\','+r.i+',\'alcohol\',this.value)">'+GEO_ALC.map(function(o){return '<option value="'+o[0]+'"'+(String(rawVal||'')===o[0]?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></td>';return '<td onclick="event.stopPropagation()"><input class="geo-cell-inp" value="'+esc(rawVal==null?'':rawVal)+'" onchange="geoSetCell(\''+esc(r.k)+'\','+r.i+',\''+col+'\',this.value)"></td>';}return '<td>'+dispHtml+'</td>';};
    // table-layout:fixed only respects exact column widths if the table's OWN width equals their sum —
    // otherwise the browser redistributes any leftover space (often dumping it onto the last column),
    // making resized widths drift. Pin the table's width explicitly so there is nothing to redistribute.
    var totalW=cols.reduce(function(s,c){return s+(GEO_COLW[c.key]||c.w);},0);
    var body=shown.map(function(r){var key=r.k+'::'+r.i,ck=GEO_SEL[key]?' checked':'';var uf=fmtUpdated(r.upd),f=r.fields;
      var updCell=uf?'<span class="geo-upd-badge" title="'+esc(uf.full)+(r.x._updatedBy?' · '+esc(r.x._updatedBy):'')+'">✓ '+esc(uf.rel)+'</span>':'<span class="geo-upd-badge geo-upd-none" title="Ещё не редактировалось">— не тронуто</span>';
      return '<tr class="geo-trow'+(uf?' geo-row-edited':'')+'" data-k="'+esc(r.k)+'" data-i="'+r.i+'" onclick="geoRowClick(event,\''+esc(r.k)+'\','+r.i+')">'+
        '<td onclick="event.stopPropagation()"><input type="checkbox" data-selkey="'+esc(key)+'"'+ck+' onclick="geoToggleSel(\''+esc(key)+'\',this.checked)"></td>'+
        '<td><span class="geo-status '+r.st+'" title="'+r.st+'"></span></td>'+
        editCell(r,'name','<b>'+esc(r.t)+'</b>',r.t)+(ALL?'<td><small>'+esc((DATASETS[r.k]||{}).label||r.k)+'</small></td>':'')+
        '<td><small>'+esc(f.city||'—')+'</small></td>'+
        editCell(r,'district','<small>'+esc(f.district||'—')+'</small>',f.district)+
        editCell(r,'category','<small>'+esc(f.category||'—')+'</small>',f.category)+
        editCell(r,'cuisine','<small>'+esc(f.cuisine||'—')+'</small>',f.cuisine)+
        editCell(r,'alcohol','<small>'+esc(({yes:'Есть',no:'Нет',unknown:'Не проверено',limited:'Ограниченно',seasonal:'Сезонно'}[f.alcohol]||f.alcohol||'—'))+'</small>',f.alcohol)+
        editCell(r,'klass','<small>'+esc(f.klass||'—')+'</small>',f.klass)+
        editCell(r,'address','<small>'+esc(f.address||'—')+'</small>',f.address)+
        editCell(r,'source','<small>'+esc(f.source||'—')+'</small>',f.source)+
        '<td>'+updCell+'</td></tr>';}).join('');
    host.innerHTML=head+'<div class="geo-table-wrap"><table class="geo-table geo-table-resizable" data-grid-engine="geo" data-case-grid-key="geo_dataset_'+esc(GEO_DATASET)+'" style="width:100%;min-width:'+totalW+'px;--geo-min-width:'+totalW+'px">'+colgroup+th+filterRow+body+'</table></div>'+(rows.length>CAP?'<div class="geo-list-count" style="opacity:.7">Уточните поиск, чтобы увидеть остальные '+(rows.length-CAP)+'.</div>':'');
    geoMakeColsResizable(host.querySelector('.geo-table-resizable'));
    if(GEO_TFOCUS){var fe=document.getElementById(GEO_TFOCUS);GEO_TFOCUS=null;if(fe){fe.focus();var vlen=fe.value.length;if(fe.setSelectionRange)fe.setSelectionRange(vlen,vlen);}}
  }
  window.geoRowClick=function(ev,k,i){if(ev&&ev.target&&(ev.target.tagName==='INPUT'))return;openDatasetRecord(k,i);};
  window.geoToggleSel=function(key,on){if(on)GEO_SEL[key]=1;else delete GEO_SEL[key];var c=document.getElementById('geoSelCount');if(c)c.textContent=Object.keys(GEO_SEL).length;};
  window.geoSelectPage=function(on){document.querySelectorAll('#geoRows input[data-selkey]').forEach(function(cb){cb.checked=on;var key=cb.getAttribute('data-selkey');if(on)GEO_SEL[key]=1;else delete GEO_SEL[key];});var c=document.getElementById('geoSelCount');if(c)c.textContent=Object.keys(GEO_SEL).length;};
  window.geoDedupAll=function(){if(!GEO_CAN_EDIT){alert('Нет прав на редактирование.');return;}
    var arrs={bc:BC,medicine:MEDPTS,pharmacies:PHARM,population:POP,metro:METRO,roads:ROADS};try{Object.keys(POI_DEFS).forEach(function(k){arrs[k]=GEO_POI[k];});}catch(e){}
    var plan=[],total=0;Object.keys(arrs).forEach(function(k){var a=arrs[k];if(!Array.isArray(a))return;var d=a.length-dedupDataset(a).length;if(d>0){plan.push(k);total+=d;}});
    if(!total){alert('Дубликаты не найдены.');return;}
    if(!confirm('Найдено дубликатов: '+total+'. Удалить их и сохранить?'))return;
    plan.forEach(function(k){dedupInPlace(arrs[k]);markDataset(k);});
    GEO_SEL=Object.create(null);commit('удалено дубликатов: '+total);resetIndexes();refreshAll();
    setTimeout(function(){alert('Удалено дубликатов: '+total+'.');},50);};
  window.geoDeleteSelected=function(){if(!GEO_CAN_EDIT){alert('Нет прав на редактирование.');return;}var keys=Object.keys(GEO_SEL);if(!keys.length){alert('Отметьте объекты галочками, чтобы удалить.');return;}if(!confirm('Удалить выбранные объекты ('+keys.length+' шт.)? Действие нельзя отменить.'))return;var byK={};keys.forEach(function(key){var p=key.split('::'),k=p[0],i=+p[1];(byK[k]=byK[k]||[]).push(i);});Object.keys(byK).forEach(function(k){var cfg=DATASETS[k];if(!cfg||cfg.kind!=='array')return;var data=cfg.ref();byK[k].sort(function(a,b){return b-a;}).forEach(function(i){if(i>=0&&i<data.length)data.splice(i,1);});markDataset(k);});GEO_SEL=Object.create(null);commit('удалено объектов: '+keys.length);resetIndexes();refreshAll();};
  function csvCell(v){v=(v==null?'':String(v));if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';}
  // «Обновлено» не значит «проверено» (независимый аудит, P1-08): выгрузка/печать - это уже
  // клиентский отчёт, а не рабочий список аналитика, поэтому перед выгрузкой явно спрашиваем,
  // включать ли непроверенные записи, а не молча отдаём всё как единый «актуальный» список.
  function confirmIncludeUnverified(base){
    var unver=base.filter(function(r){return recordStatus(r.x)!=='verified';}).length;
    if(!unver)return base;
    var include=confirm('В выгрузку попадёт '+unver+' непроверенных вручную записей из '+base.length+' (статус «онлайн»/«нужна проверка»).\n\nOK - включить все записи.\nОтмена - выгрузить только подтверждённые вручную ('+(base.length-unver)+' шт.).');
    if(include)return base;
    return base.filter(function(r){return recordStatus(r.x)==='verified';});
  }
  window.geoExportTableCSV=function(){var ALL=GEO_DATASET==='__all__';var base=ALL?geoAllRows():DATASETS[GEO_DATASET].ref().map(function(x,i){return{k:GEO_DATASET,x:x,i:i};});base=confirmIncludeUnverified(base);var cols=ALL?['Набор','Название','Район','Детали','Широта','Долгота','Статус']:null;var lines=[];
    if(ALL){lines.push(cols.map(csvCell).join(';'));base.forEach(function(r){lines.push([(DATASETS[r.k]||{}).label||r.k,rowText(r.x,r.i),(r.x&&(r.x.district||r.x.d))||'',rowSummary(r.x,r.k),(r.x&&(r.x.lat!=null?r.x.lat:r.x.la))||'',(r.x&&(r.x.lng!=null?r.x.lng:r.x.ln))||'',recordStatus(r.x)].map(csvCell).join(';'));});}
    else{var keyset={};base.forEach(function(r){if(r.x&&typeof r.x==='object'&&!Array.isArray(r.x))Object.keys(r.x).forEach(function(kk){keyset[kk]=1;});});var ks=Object.keys(keyset).slice(0,40);if(!ks.length)ks=['value'];lines.push((['Статус'].concat(ks)).map(csvCell).join(';'));base.forEach(function(r){lines.push(([recordStatus(r.x)].concat(ks.map(function(kk){return Array.isArray(r.x)?'':(r.x&&r.x[kk]!=null?(typeof r.x[kk]==='object'?JSON.stringify(r.x[kk]):r.x[kk]):'');}))).map(csvCell).join(';'));});}
    var blob=new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='CASE_OS_GEO_'+(ALL?'all':GEO_DATASET)+'_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},400);};
  window.geoPrintDataset=function(){var ALL=GEO_DATASET==='__all__';var base=ALL?geoAllRows():DATASETS[GEO_DATASET].ref().map(function(x,i){return{k:GEO_DATASET,x:x,i:i};});base=confirmIncludeUnverified(base);var title=ALL?'Все объекты геоаналитики':((DATASETS[GEO_DATASET]||{}).label||GEO_DATASET);var rowsHtml=base.map(function(r){return '<tr><td>'+esc(recordStatus(r.x))+'</td><td>'+esc(rowText(r.x,r.i))+'</td>'+(ALL?'<td>'+esc((DATASETS[r.k]||{}).label||r.k)+'</td>':'')+'<td>'+esc(rowSummary(r.x,r.k)||'')+'</td></tr>';}).join('');var w=window.open('','_blank');if(!w){alert('Разрешите всплывающие окна для печати/PDF.');return;}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#1c1f26}h1{font-size:18px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#9E0000;color:#fff}small{color:#666}</style></head><body><h1>CASE OS · '+esc(title)+'</h1><div>'+esc(new Date().toLocaleString('ru-RU'))+' · записей: '+base.length+'</div><table><tr><th>Статус</th><th>Название</th>'+(ALL?'<th>Набор</th>':'')+'<th>Детали</th></tr>'+rowsHtml+'</table><script>window.onload=function(){setTimeout(function(){window.print();},250);}<\/script></body></html>');w.document.close();};
  window.geoDatasetChange=function(v){GEO_DATASET=(DATASETS[v]||v==='__all__')?v:'bc';GEO_QUERY='';GEO_SEL=Object.create(null);dataManager();};window.geoSearch=function(v){GEO_QUERY=v||'';renderDatasetRows();};
  function stampRecord(v){if(v&&typeof v==='object'&&!Array.isArray(v)){v._updatedAt=new Date().toISOString();v._updatedBy=(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||'manual';}return v;}
  function openDatasetRecord(k,i){var cfg=DATASETS[k],data=cfg&&cfg.ref();if(!cfg||cfg.kind!=='array'||i<0||i>=data.length)return;var editor=GEO_RECORD_SCHEMAS[k];if(!editor)return openJsonEditor('Запись · '+cfg.label,data[i],function(v){data[i]=stampRecord(v);markDataset(k);commit('изменена запись '+k);resetIndexes();refreshAll();},function(){data.splice(i,1);markDataset(k);commit('удалена запись '+k);resetIndexes();refreshAll();});openRecordEditor(cfg.label+' · '+rowText(data[i],i),data[i],editor,function(v){data[i]=stampRecord(v);markDataset(k);commit('изменена запись '+k);resetIndexes();refreshAll();},function(){data.splice(i,1);markDataset(k);commit('удалена запись '+k);resetIndexes();refreshAll();});}
  window.geoEditRecord=function(i){openDatasetRecord(GEO_DATASET,i);};
  window.geoAddRecord=function(){if(!GEO_CAN_EDIT)return;var k=GEO_DATASET;if(k==='__all__'||!DATASETS[k]){alert('Выберите конкретный набор данных, чтобы добавить в него запись.');return;}var cfg=DATASETS[k],data=cfg.ref();if(cfg.kind==='object'){geoRawDataset();return;}var editor=GEO_RECORD_SCHEMAS[k],value=clone(cfg.template);if(POI_DEFS[k]||k==='pharmacies'){var p=active();value.lat=Number.isFinite(+p.lat)?+p.lat:CENTER.lat;value.lng=Number.isFinite(+p.lng)?+p.lng:CENTER.lng;value.district=p.district||'';}if(!editor)return openJsonEditor('Новая запись · '+cfg.label,value,function(v){data.push(stampRecord(v));markDataset(k);commit('добавлена запись '+k);resetIndexes();refreshAll();});openRecordEditor('Новая запись · '+cfg.label,value,editor,function(v){data.push(stampRecord(v));markDataset(k);commit('добавлена запись '+k);resetIndexes();refreshAll();});};
  window.geoRawDataset=function(){if(!GEO_CAN_EDIT)return;var cfg=DATASETS[GEO_DATASET];openJsonEditor('Весь набор · '+cfg.label,cfg.ref(),function(v){if(cfg.kind==='array'&&!Array.isArray(v))throw new Error('Ожидается массив');if(cfg.kind==='object'&&(!v||typeof v!=='object'||Array.isArray(v)))throw new Error('Ожидается объект');replaceDataset(GEO_DATASET,v);markDataset();commit('заменён набор '+GEO_DATASET);resetIndexes();refreshAll();},null,true);};
  function recordFieldHtml(f,value){var k=f[0],label=f[1],type=f[2]||'text',opts=f[3]||[],v=value==null?'':value[k],dis=GEO_CAN_EDIT?'':' disabled',attr=' data-record-k="'+esc(k)+'" data-record-type="'+esc(type)+'"'+dis;if(type==='select')return '<label class="geo-record-field"><span>'+esc(label)+'</span><select'+attr+'>'+opts.map(function(o){return '<option value="'+esc(o[0])+'"'+(String(v||'')===String(o[0])?' selected':'')+'>'+esc(o[1])+'</option>';}).join('')+'</select></label>';if(type==='textarea'||type==='json')return '<label class="geo-record-field wide"><span>'+esc(label)+'</span><textarea'+attr+'>'+(type==='json'?esc(JSON.stringify(v==null?[]:v,null,2)):esc(v))+'</textarea></label>';if(type==='color'){v=/^#[0-9a-f]{6}$/i.test(String(v||''))?v:'#9E0000';return '<label class="geo-record-field"><span>'+esc(label)+'</span><input type="color" value="'+esc(v)+'"'+attr+'></label>';}var inputType=type==='number'||type==='lat'||type==='lng'?'number':type==='date'?'date':'text';return '<label class="geo-record-field"><span>'+esc(label)+'</span><input type="'+inputType+'" value="'+esc(v)+'"'+(inputType==='number'?' step="any"':'')+attr+'></label>';}
  function captureRecord(value){var next=clone(value);document.querySelectorAll('#card [data-record-k]').forEach(function(el){var k=el.dataset.recordK,type=el.dataset.recordType,v=el.value.trim();if(type==='json'){try{v=v?JSON.parse(v):[];}catch(e){throw new Error('Проверьте поле «'+el.previousElementSibling.textContent+'»: неверный формат данных.');}}else if(type==='number'||type==='lat'||type==='lng'){v=v===''?'':+v;if(v!==''&&!Number.isFinite(v))throw new Error('Введите корректное число.');if(type==='lat'&&v!==''&&(v<-90||v>90))throw new Error('Широта должна быть от −90 до 90.');if(type==='lng'&&v!==''&&(v<-180||v>180))throw new Error('Долгота должна быть от −180 до 180.');}if(Array.isArray(next))next[+k]=v;else next[k]=v;});if(!Array.isArray(next)){var la=(next.lat!=null?next.lat:next.la),ln=(next.lng!=null?next.lng:next.ln);if(+la===0&&+ln===0)throw new Error('Координаты 0,0 недопустимы. Переместите точку или оставьте запись в очереди геокодирования.');if(la!==''&&ln!==''&&(!Number.isFinite(+la)||!Number.isFinite(+ln)))throw new Error('Введите корректные координаты.');var urlKeys=['website','sourceUrl','googleUrl','yandexUrl','dgisUrl','alcoholSourceUrl'];urlKeys.forEach(function(k){var u=String(next[k]||'').trim();if(u&&!/^https?:\/\//i.test(u))throw new Error('Поле «'+k+'» должно содержать полную ссылку http:// или https://.');});if(Object.prototype.hasOwnProperty.call(next,'alcoholStatus')){var aok=['unknown','yes','no','limited','seasonal'],vok=['not_checked','official_menu','phone','field','owner'];next.alcoholStatus=String(next.alcoholStatus||'unknown');next.alcoholVerification=String(next.alcoholVerification||'not_checked');if(aok.indexOf(next.alcoholStatus)<0)throw new Error('Выберите корректный статус алкоголя.');if(vok.indexOf(next.alcoholVerification)<0)throw new Error('Выберите корректный способ проверки алкоголя.');if(next.alcoholStatus!=='unknown'&&next.alcoholVerification==='not_checked')throw new Error('Наличие или отсутствие алкоголя нужно подтвердить меню, звонком, выездом или владельцем.');if(next.alcoholVerification==='official_menu'&&!String(next.alcoholSourceUrl||'').trim())throw new Error('Для проверки по официальному меню добавьте ссылку на источник.');if(next.alcoholStatus==='unknown'||next.alcoholStatus==='no')next.alcoholTypes='';next.cuisinePrimary=String(next.cuisinePrimary||'Unknown').trim()||'Unknown';next.cuisines=String(next.cuisines||'').split('|').map(function(x){return x.trim();}).filter(Boolean).filter(function(x,i,a){return a.indexOf(x)===i;}).join('|');}if(next.rating!==''&&next.rating!=null&&(!Number.isFinite(+next.rating)||+next.rating<0||+next.rating>5))throw new Error('Рейтинг должен быть от 0 до 5.');if(next.reviews!==''&&next.reviews!=null&&(!Number.isFinite(+next.reviews)||+next.reviews<0))throw new Error('Количество отзывов не может быть отрицательным.');}if(!Array.isArray(next)&&next._verification==='verified'){var source=next.provider||next.s||next._source||'';if(!String(source).trim())throw new Error('Для подтверждённой записи укажите источник.');if(!String(next._checkedBy||'').trim())throw new Error('Для подтверждённой записи укажите проверяющего.');next._checkedAt=next._checkedAt||new Date().toISOString().slice(0,10);}return next;}
  function openRecordEditor(title,value,schema,onSave,onDelete){var c=document.getElementById('card'),bg=document.getElementById('cardbg');c.classList.remove('geo-json-card');c.classList.add('geo-record-card');var body=schema.map(function(g){return '<section class="geo-record-group"><h3>'+esc(g[0])+'</h3><div class="geo-record-fields">'+g[1].map(function(f){return recordFieldHtml(f,value);}).join('')+'</div></section>';}).join('');c.innerHTML='<div class="ch"><span style="flex:1">'+esc(title)+'</span><button class="btn sec" onclick="closeCard()" aria-label="Закрыть">✕</button></div><div class="body">'+body+'<div id="geoRecordError" class="geo-record-error"></div></div><div class="cbtns">'+(GEO_CAN_EDIT?'<button class="btn pri" id="geoRecordSave">💾 Сохранить</button>':'')+(GEO_CAN_EDIT&&onDelete?'<button class="btn sec" id="geoRecordDelete">Удалить</button>':'')+'<button class="btn sec" onclick="closeCard()">Закрыть</button></div>';c.classList.add('open');bg.classList.add('open');var s=document.getElementById('geoRecordSave');if(s)s.onclick=function(){try{onSave(captureRecord(value));closeCard();}catch(e){document.getElementById('geoRecordError').textContent=e.message||String(e);}};var d=document.getElementById('geoRecordDelete');if(d)d.onclick=function(){if(confirm('Удалить запись?')){onDelete();closeCard();}};}
  function openJsonEditor(title,value,onSave,onDelete,wide){var c=document.getElementById('card'),bg=document.getElementById('cardbg');c.classList.remove('geo-record-card');c.classList.add('geo-json-card');c.innerHTML='<div class="ch"><span style="flex:1">'+esc(title)+'</span><span class="btn sec" onclick="closeCard()">✕</span></div><div class="body"><p class="note">Служебный режим полного набора. Используйте его только для массовой технической правки.</p><textarea id="geoJsonEdit" class="geo-json '+(wide?'wide':'')+'">'+esc(JSON.stringify(value,null,2))+'</textarea><div id="geoJsonError" class="savemsg"></div></div><div class="cbtns">'+(GEO_CAN_EDIT?'<button class="btn pri" id="geoJsonSave">💾 Сохранить</button>':'')+(GEO_CAN_EDIT&&onDelete?'<button class="btn sec" id="geoJsonDelete">Удалить</button>':'')+'<button class="btn sec" onclick="closeCard()">Закрыть</button></div>';c.classList.add('open');bg.classList.add('open');var s=document.getElementById('geoJsonSave');if(s)s.onclick=function(){try{var v=JSON.parse(document.getElementById('geoJsonEdit').value);onSave(v);closeCard();}catch(e){document.getElementById('geoJsonError').textContent='Ошибка JSON: '+e.message;}};var d=document.getElementById('geoJsonDelete');if(d)d.onclick=function(){if(confirm('Удалить запись?')){onDelete();closeCard();}};}
  function poiRowHtml(k){var d=POI_DEFS[k],n=GEO_POI[k].length,loading=GEO_POI_LOADING[k];
    var radius=(d.radius!=null?d.radius:6),opacity=(d.opacity!=null?d.opacity:92),labels=!!d.labels,labelSize=(d.labelSize!=null?d.labelSize:11);
    /* класс lrow (не styrow) — это конечный вид, в который buildPanel() в geoanalytics-studio.html
       превращает строки БЦ/Медицина/Аптеки после загрузки страницы; здесь строим тот же вид сразу,
       чтобы все строки слоёв выглядели одинаково без ожидания того (более раннего) прохода. */
    /* #91: компактная строка — только чекбокс, название, счётчик, цвет-индикатор и ⚙.
       Все настройки (размер/прозрачность/подписи + доп. фильтр) спрятаны в поповер ⚙ рядом с надписью. */
    return '<div class="lrow geo-poi-row" data-poi-k="'+k+'"><label class="ck"><input type="checkbox" id="geoLayer-'+k+'" onchange="geoTogglePoiLayer(\''+k+'\')"> '+esc(d.label)+' <small id="geoLayerCount-'+k+'" class="geo-poi-count">'+(loading?'загрузка…':n)+'</small></label><span class="geo-dot" style="background:'+esc(d.color)+'"></span><button type="button" class="geo-gear" title="Настройки слоя" aria-label="Настройки слоя" onclick="geoToggleGear(\''+k+'\')">⚙</button></div>'
      +'<div class="geo-poi-gear" id="geoGear-'+k+'" style="display:none">'
      +'<div class="styrow sub geo-poi-sub"><label>цвет</label><input type="color" id="geoColor-'+k+'" value="'+d.color+'" title="фикс. цвет" oninput="geoPoiColor(\''+k+'\',this.value)"><label>размер</label><input type="range" id="geoR-'+k+'" min="3" max="12" value="'+radius+'" oninput="geoPoiRadius(\''+k+'\',this.value)" title="размер точки"><label>прозр.</label><input type="range" id="geoOp-'+k+'" min="20" max="100" value="'+opacity+'" oninput="geoPoiOpacity(\''+k+'\',this.value)" title="непрозрачность"></div>'
      +'<div class="styrow sub geo-poi-sub"><label class="ck"><input type="checkbox" id="geoLab-'+k+'" title="показывать надписи на карте"'+(labels?' checked':'')+' onchange="geoPoiLabels(\''+k+'\',this.checked)"> подписи</label><label>размер подписи</label><input type="range" id="geoLS-'+k+'" min="8" max="20" value="'+labelSize+'" oninput="geoPoiLabelSize(\''+k+'\',this.value)" title="размер надписи на карте"></div>'
      +'<div class="styrow sub geo-poi-sub"><label class="ck"><input type="checkbox" id="geoClu-'+k+'"'+(d.cluster!==false?' checked':'')+' onchange="geoPoiCluster(\''+k+'\',this.checked)" title="объединять близкие точки в кружки-кластеры; выключите, чтобы видеть каждую точку отдельно"> кластеры точек</label></div>'
      +(k==='street_retail'?retailSubPanelHtml():'')
      +'</div>';
  }
  window.geoToggleGear=function(k){var g=document.getElementById('geoGear-'+k);if(!g)return;var open=g.style.display==='none';g.style.display=open?'block':'none';var btn=document.querySelector('.geo-poi-row[data-poi-k="'+k+'"] .geo-gear');if(btn)btn.classList.toggle('on',open);};
  // Единая настройка стиля слоя (цвет/размер/прозрачность/подписи) - раньше сохранялся
  // только цвет (asaas_geo_layer_colors). Ключ переименован, но старые сохранённые цвета
  // всё ещё читаются один раз для обратной совместимости.
  function geoSaveLayerStyle(){var out={};Object.keys(POI_DEFS).forEach(function(k){var d=POI_DEFS[k];out[k]={color:d.color,radius:d.radius,opacity:d.opacity,labels:!!d.labels,labelSize:d.labelSize,cluster:d.cluster!==false};});try{localStorage.setItem('asaas_geo_layer_style',JSON.stringify(out));}catch(e){}}
  function geoLoadLayerStyle(){
    try{var legacy=JSON.parse(localStorage.getItem('asaas_geo_layer_colors')||'{}');Object.keys(legacy).forEach(function(k){if(POI_DEFS[k]&&/^#[0-9a-f]{6}$/i.test(legacy[k]))POI_DEFS[k].color=legacy[k];});}catch(e){}
    try{var saved=JSON.parse(localStorage.getItem('asaas_geo_layer_style')||'{}');Object.keys(saved).forEach(function(k){if(!POI_DEFS[k])return;var s=saved[k];if(s&&/^#[0-9a-f]{6}$/i.test(s.color))POI_DEFS[k].color=s.color;if(s&&Number.isFinite(+s.radius))POI_DEFS[k].radius=+s.radius;if(s&&Number.isFinite(+s.opacity))POI_DEFS[k].opacity=+s.opacity;if(s)POI_DEFS[k].labels=!!s.labels;if(s&&s.cluster===false)POI_DEFS[k].cluster=false;if(s&&Number.isFinite(+s.labelSize))POI_DEFS[k].labelSize=+s.labelSize;});}catch(e){}
  }
  var GEO_POI_CONTROLS_BUILT=false;
  function ensurePoiLayerControls(){
    // Строим строки-контролы ОДИН раз. Раньше перестройка происходила на каждый moveend
    // (renderPoiLayers→ensurePoiLayerControls), и innerHTML сбрасывал состояние галочек слоёв —
    // включённые слои гасли при любом сдвиге/зуме карты. Теперь строим единожды; счётчики
    // обновляются отдельно через poiRowRefresh, состояние галочек сохраняется при панораме.
    geoLoadLayerStyle();geoLoadRetailSubFilter();
    var anchors=Object.keys(POI_CATEGORY_GROUPS).map(function(c){return document.getElementById('geoCatAnchor-'+c);});
    var haveAnchors=anchors.some(Boolean);
    var alreadyBuilt=GEO_POI_CONTROLS_BUILT&&anchors.some(function(a){return a&&a.querySelector('.geo-poi-row');});
    if(!haveAnchors||alreadyBuilt)return;
    Object.keys(POI_CATEGORY_GROUPS).forEach(function(cat){
      var anchor=document.getElementById('geoCatAnchor-'+cat);if(!anchor)return;
      anchor.innerHTML=POI_CATEGORY_GROUPS[cat].map(poiRowHtml).join('');
    });
    GEO_POI_CONTROLS_BUILT=true;
  }
  function poiRowRefresh(k){var row=document.querySelector('.geo-poi-row[data-poi-k="'+k+'"]');if(!row)return;var cnt=row.querySelector('#geoLayerCount-'+k);if(cnt)cnt.textContent=GEO_POI_LOADING[k]?'загрузка…':GEO_POI[k].length;row.classList.toggle('geo-poi-empty',!GEO_POI_LOADING[k]&&!GEO_POI[k].length);}
  function poiPopupHtml(k,i,x){var d=POI_DEFS[k],status=recordStatus(x),statusLabel=status==='verified'?'Подтверждено':status==='needs_review'?'Нужна проверка':'Онлайн, не проверено',profile=(d.fields||[]).filter(function(f){return x[f[0]]!==''&&x[f[0]]!=null;}).slice(0,3).map(function(f){return '<div><span>'+esc(f[1])+'</span><b>'+esc(x[f[0]])+'</b></div>';}).join('');return '<div class="geo-map-popup"><strong>'+esc(x.name||d.short)+'</strong><p>'+esc([x.subtype,x.district].filter(Boolean).join(' · '))+'</p>'+(x.address?'<p>'+esc(x.address)+'</p>':'')+(profile?'<div class="geo-map-popup-grid">'+profile+'</div>':'')+'<small class="'+status+'">'+statusLabel+(x.provider?' · '+esc(x.provider):'')+'</small><div class="geo-map-popup-btns"><button type="button" onclick="geoOpenMapRecord(\''+k+'\','+i+');return false">Открыть карточку</button>'+(GEO_CAN_EDIT?'<button type="button" onclick="geoDeleteMapRecord(\''+k+'\','+i+');return false" style="margin-top:5px;background:#9E0000;color:#fff;border:none;border-radius:6px;padding:5px 9px;cursor:pointer;font-size:12px" title="Удалить этот объект с карты (неактуальный/закрытый). Изменение сохранится для всех.">🗑 Удалить объект</button>':'')+'</div></div>';}
  function renderPoiLayer(k){if(!map||!window.L||!POI_DEFS[k])return;if(!GEO_POI_RENDERER)GEO_POI_RENDERER=L.svg({padding:.25});var g=GEO_POI_LAYERS[k];
   // Кластеризация маркеров (Leaflet.markercluster) — при поднятом лимите 2000 точек/слой без
   // неё карта превращается в кашу и тормозит. На близком зуме (>=17) кластеры распадаются на
   // отдельные точки, и подписи снова видны. Если плагин почему-то не загрузился — обычная группа.
   var _wantClu=(POI_DEFS[k].cluster!==false)&&typeof L.markerClusterGroup==='function';
   if(g&&g._geoClu!==_wantClu){try{map.removeLayer(g);}catch(e){}g=GEO_POI_LAYERS[k]=null;}
   if(!g){g=GEO_POI_LAYERS[k]=(_wantClu
       ?L.markerClusterGroup({chunkedLoading:true,disableClusteringAtZoom:17,maxClusterRadius:48,spiderfyOnMaxZoom:true,showCoverageOnHover:false})
       :L.layerGroup()).addTo(map);g._geoClu=_wantClu;}
   g.clearLayers();var cb=document.getElementById('geoLayer-'+k),count=document.getElementById('geoLayerCount-'+k);if(count)count.textContent=GEO_POI[k].length;if(!cb||!cb.checked)return;
   var d=POI_DEFS[k],VB=typeof vbox==='function'?vbox():null;
   var radius=(d.radius!=null?d.radius:6),op=(d.opacity!=null?d.opacity:92)/100,showLab=!!d.labels;
   // Размер подписи регулируется по слою (ползунок «размер подписи»). Значение из настройки —
   // базовый px; сохраняем лёгкое масштабирование по зуму, чтобы подписи не были гигантскими на
   // мелком масштабе (независимый разбор: "нужно регулировать размер надписей у каждой категории").
   var baseLS=(d.labelSize!=null?d.labelSize:11);
   var zAdj=(map&&map.getZoom?Math.max(-3,Math.min(3,map.getZoom()-13)):0);
   var fs=Math.max(7,baseLS+zAdj*0.8);
   GEO_POI_LABSTYLE[k]=fs;
   var st=document.getElementById('geoPoiLabStyle');if(!st){st=document.createElement('style');st.id='geoPoiLabStyle';document.head.appendChild(st);}
   st.textContent=Object.keys(GEO_POI_LABSTYLE).map(function(kk){return '.leaflet-tooltip.geo-poi-lab-'+kk+'{font-size:'+(+GEO_POI_LABSTYLE[kk]).toFixed(1)+'px}';}).join('');
   GEO_POI[k].forEach(function(x,i){var la=+x.lat,ln=+x.lng;if(!Number.isFinite(la)||!Number.isFinite(ln)||VB&&!VB.contains([la,ln]))return;
    // подкатегории стрит-ритейла переключаются независимо от родительского слоя
    // (независимый разбор категорий: "каждая категория и подкатегория индивидуально редактируемая").
    if(k==='street_retail'&&GEO_RETAIL_SUB_ON[geoRetailSubKey(retailSubtypeLabel(x.subtype))]===false)return;
    var m=L.circleMarker([la,ln],{renderer:GEO_POI_RENDERER,radius:radius,color:'#fff',weight:1.5,fillColor:d.color,fillOpacity:op,className:'geo-poi-marker geo-poi-'+k});
    m.bindPopup(poiPopupHtml(k,i,x),{maxWidth:310});
    // Точки без подписей (было всегда так - только всплывающая подсказка по наведению) vs
    // постоянная подпись на карте, когда для слоя включена галочка «подписи» (независимый
    // аудит: "при постановке галочки на карте появляются только точки, надписей нет").
    if(showLab)m.bindTooltip(esc(x.name||d.short),{permanent:true,direction:'top',className:'geo-poi-lab geo-poi-lab-'+k,offset:[0,-radius-2]});
    else m.bindTooltip(esc(x.name||d.short),{sticky:true});
    m.on('click',function(ev){L.DomEvent.stopPropagation(ev);if(typeof markSel==='function')markSel(la,ln);m.openPopup();});m.addTo(g);
   // SVG-рендерер (не canvas) - у маркера есть настоящий DOM-элемент, поэтому можно дать ему
   // доступное имя для скринридеров (независимый аудит: "map marker accessibility-name issues").
   try{var el=m.getElement&&m.getElement();if(el){el.setAttribute('role','img');el.setAttribute('aria-label',(x.name||d.short||'точка')+' - '+(d.short||k));}}catch(e){}
  });}
  function renderPoiLayers(){ensurePoiLayerControls();Object.keys(POI_DEFS).forEach(renderPoiLayer);}
  function geoFetchPoiLayer(k){
    if(GEO_POI_LOADING[k])return Promise.resolve();
    var VB=typeof vbox==='function'?vbox():null;
    if(!VB){var d=CENTER;VB={getSouth:function(){return d.lat-0.09;},getWest:function(){return d.lng-0.14;},getNorth:function(){return d.lat+0.09;},getEast:function(){return d.lng+0.14;}};}
    GEO_POI_LOADING[k]=true;poiRowRefresh(k);
    var url='api/gis_proxy.php?mode=poi&provider=osm&category='+encodeURIComponent(k)+'&south='+VB.getSouth()+'&west='+VB.getWest()+'&north='+VB.getNorth()+'&east='+VB.getEast();
    return fetch(url,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
      GEO_POI_LOADING[k]=false;
      if(j&&j.ok&&Array.isArray(j.rows)){
        GEO_POI[k]=j.rows;
        markDataset(k);commit('загружен слой «'+(POI_DEFS[k]||{}).label+'» из OSM: '+j.rows.length);
        if(k==='street_retail')refreshRetailSubPanel();
      }else{
        var cb=document.getElementById('geoLayer-'+k);if(cb)cb.checked=false;
        toastGeo((j&&j.message)||'Не удалось загрузить слой из OSM.');
      }
      poiRowRefresh(k);
    }).catch(function(e){
      GEO_POI_LOADING[k]=false;var cb=document.getElementById('geoLayer-'+k);if(cb)cb.checked=false;
      toastGeo('Ошибка сети при загрузке слоя: '+e.message);poiRowRefresh(k);
    });
  }
  function toastGeo(msg){try{if(typeof toast==='function'){toast(msg);return;}}catch(e){}try{alert(msg);}catch(e2){}}
  window.geoTogglePoiLayer=function(k){
    var cb=document.getElementById('geoLayer-'+k);
    if(cb&&cb.checked&&!GEO_POI[k].length&&!GEO_POI_LOADING[k]){
      geoFetchPoiLayer(k).then(function(){renderPoiLayer(k);});
      return;
    }
    renderPoiLayer(k);
  };
  // Регулируемые размер/прозрачность/подписи для каждого слоя городских объектов -
  // раньше это было только у БЦ/Медицины/Метро, у остальных 19 слоёв — только цвет
  // (независимый аудит: "все размеры и цвета надо сделать регулируемыми").
  window.geoPoiLabels=function(k,on){if(!POI_DEFS[k])return;POI_DEFS[k].labels=!!on;geoSaveLayerStyle();renderPoiLayer(k);};
  window.geoPoiLabelSize=function(k,v){if(!POI_DEFS[k])return;var n=+v;if(!Number.isFinite(n))return;POI_DEFS[k].labelSize=n;geoSaveLayerStyle();renderPoiLayer(k);};
  window.geoPoiRadius=function(k,v){if(!POI_DEFS[k])return;var n=+v;if(!Number.isFinite(n))return;POI_DEFS[k].radius=n;geoSaveLayerStyle();renderPoiLayer(k);};
  window.geoPoiOpacity=function(k,v){if(!POI_DEFS[k])return;var n=+v;if(!Number.isFinite(n))return;POI_DEFS[k].opacity=n;geoSaveLayerStyle();renderPoiLayer(k);};
  window.geoPoiCluster=function(k,on){if(!POI_DEFS[k])return;POI_DEFS[k].cluster=!!on;geoSaveLayerStyle();var g=GEO_POI_LAYERS[k];if(g){try{map.removeLayer(g);}catch(e){}delete GEO_POI_LAYERS[k];}renderPoiLayer(k);}; /* v4.41: «разъединить точки» по каждой категории */
  window.geoPoiColor=function(k,color){if(!POI_DEFS[k]||!/^#[0-9a-f]{6}$/i.test(color))return;POI_DEFS[k].color=color;geoSaveLayerStyle();renderPoiLayer(k);};
  window.geoOpenMapRecord=function(k,i){if(map)map.closePopup();openDatasetRecord(k,+i);};
  /* Удаление неактуального (закрытого/устаревшего) объекта прямо из всплывающего окна на карте.
     Тот же путь сохранения, что и «Удалить выбранные»/дедуп: splice → markDataset(dirty) → commit → geo_state.php,
     поэтому удаление сохраняется на сервере и не возвращается после перезагрузки. */
  window.geoDeleteMapRecord=function(k,i){if(!GEO_CAN_EDIT){alert('Ваша роль имеет доступ только для просмотра.');return;}var cfg=DATASETS[k],data=cfg&&cfg.ref();i=+i;if(!cfg||cfg.kind!=='array'||!Array.isArray(data)||i<0||i>=data.length)return;var nm=rowText(data[i],i)||'объект';if(!confirm('Удалить объект «'+nm+'» с карты?\n\nОн больше не будет отображаться (у всех сотрудников). Действие нельзя отменить.'))return;if(map)map.closePopup();data.splice(i,1);markDataset(k);commit('удалён объект с карты: '+nm);resetIndexes();refreshAll();};
  window.geoOpenBusinessCard=function(id){if(map)map.closePopup();openCard(+id);};
  function replaceDataset(k,v){var cfg=DATASETS[k],t=cfg.ref();if(cfg.kind==='array')replaceArray(t,k==='pharmacies'?normalizePharmacies(v):v);else replaceObject(t,v);}
  function markDataset(k){k=k||GEO_DATASET;GEO_META.datasets=GEO_META.datasets||{};GEO_META.datasets[k]={status:'manual_review',updatedAt:new Date().toISOString(),updatedBy:(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||'manual'};}
  window.geoImportDataset=function(){if(!GEO_CAN_EDIT)return;document.getElementById('geoFile').click();};
  window.geoFilePicked=function(inp){var f=inp.files&&inp.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var v;if(/\.json$/i.test(f.name))v=JSON.parse(r.result);else v=parseCsv(r.result);replaceDataset(GEO_DATASET,v);markDataset();commit('импорт '+GEO_DATASET+' · '+f.name);resetIndexes();refreshAll();}catch(e){alert('Ошибка импорта: '+e.message);}inp.value='';};r.readAsText(f,'utf-8');};
  function parseCsv(txt){var lines=String(txt).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);if(!lines.length)return[];var sep=(lines[0].split(';').length>lines[0].split(',').length)?';':',';function cells(line){var out=[],s='',q=false;for(var i=0;i<line.length;i++){var c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){s+='"';i++;}else q=!q;}else if(c===sep&&!q){out.push(s);s='';}else s+=c;}out.push(s);return out;}var h=cells(lines.shift());return lines.map(function(l){var a=cells(l),o={};h.forEach(function(k,i){var v=a[i]||'';o[k]=v!==''&&!isNaN(v)?+v:v;});return o;});}
  window.geoExportDataset=function(){var cfg=DATASETS[GEO_DATASET],v=cfg.ref();downloadJson('CASE_OS_GEO_'+GEO_DATASET+'_'+new Date().toISOString().slice(0,10)+'.json',v);};
  function downloadJson(name,v){var b=new Blob([JSON.stringify(v,null,2)],{type:'application/json;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},0);}
  function baselineCleanup(){
    try{BC.forEach(function(b){Object.assign(b,eff(b));});Object.keys(EDITS).forEach(function(k){delete EDITS[k];});}catch(e){}
    replaceArray(PHARM,normalizePharmacies(PHARM));
    for(var i=BC.length-1;i>=0;i--){var b=BC[i];if(/botanica|taxtapul/i.test(String(b.name||''))&&/case/i.test(String(b.provider||'')))BC.splice(i,1);}
    for(var r=ROADS.length-1;r>=0;r--)if(/botanica|богишамол|проект/i.test(String(ROADS[r].n||'')))ROADS.splice(r,1);
    resetIndexes();
  }
  var oldOpenCard=openCard;
  openCard=function(id){var i=BC.findIndex(function(x){return x.id===id;});if(i>=0)return openDatasetRecord('bc',i);oldOpenCard(id);};
  try{CARDG.push(['Ручная проверка',[['Статус проверки','_verification'],['Дата источника','_sourceDate'],['Проверил','_checkedBy'],['Дата проверки','_checkedAt'],['Примечание проверки','_note','ta']]]);}catch(e){}
  saveCard=function(id){if(!GEO_CAN_EDIT){alert('Нет прав на редактирование.');return;}var b=BC.find(function(x){return x.id===id;});if(!b)return;document.querySelectorAll('#card [data-k]').forEach(function(el){var v=el.value.trim();b[el.dataset.k]=v;if(['lat','lng','gla','gba','parking','floors','rent','avail','sale','rating','reviews'].indexOf(el.dataset.k)>=0&&v!==''&&!isNaN(v))b[el.dataset.k]=+v;});if(!b._verification)b._verification='needs_review';b._checkedBy=b._checkedBy||(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||'';b._checkedAt=b._verification==='verified'?(b._checkedAt||new Date().toISOString().slice(0,10)):b._checkedAt;b._updatedAt=new Date().toISOString();b._updatedBy=(GEO_CONTEXT.user&&GEO_CONTEXT.user.name)||'manual';markDataset();commit('карточка БЦ: '+(b.name||id));resetIndexes();closeCard();refreshAll();};
  function applyContext(c){GEO_CONTEXT=c||{};GEO_CAN_EDIT=!!c.editable;GEO_ADMIN_EDIT=!!c.adminEdit;GEO_EXTERNAL=!!c.external;if(GEO_EXTERNAL)GEO_CAN_EDIT=false;if(!GEO_ADMIN_EDIT)GEO_EDIT_MODE=false;try{geoApplyRoleUi();}catch(e){}if(c.geoRevision!=null){GEO_META.serverRevision=+c.geoRevision||0;}document.body.classList.toggle('dark',String(c.theme||'').toLowerCase()==='dark');if(c.geoData)applyState(c.geoData);else{syncProjects(c.projects||[],c.activeProjectId);refreshAll();}try{if(c.probeProjectId)geoAutoProbe(String(c.probeProjectId));}catch(e){}updateBanner();}
  var GEO_AUTOPROBED={};
  function geoAutoProbe(pid){ /* v4.43.1: явный переход «Аналитика» — отчёт по точке проекта открывается сам, кликать по карте не нужно */
    if(!pid||GEO_AUTOPROBED[pid])return;var p=PROJECTS[pid];if(!p)return;
    var la=+p.lat,ln=+p.lng;if(!isFinite(la)||!isFinite(ln))return;
    GEO_AUTOPROBED[pid]=1;
    var tries=0;(function wait(){
      if(window.map&&typeof window.probeAt==='function'){try{window.probeAt(la,ln);}catch(e){}return;}
      if(++tries<40)setTimeout(wait,300);
    })();
  }
  window.addEventListener('message',function(e){if(e.origin!==location.origin||!e.data||e.data.source!=='asaas-os-v4')return;if(e.data.type==='asaas-geo-context')applyContext(e.data.context||{});else if(e.data.type==='asaas-geo-saving'){GEO_SAVE_STATE='saving';GEO_SAVE_MESSAGE='';updateBanner();}else if(e.data.type==='asaas-geo-saved'){GEO_META.updatedAt=e.data.savedAt||GEO_META.updatedAt;GEO_META.updatedBy=e.data.savedBy||GEO_META.updatedBy;if(e.data.geoRevision!=null)GEO_META.serverRevision=+e.data.geoRevision||0;GEO_SAVE_STATE='saved';GEO_SAVE_MESSAGE='Сохранено на сервере'+(e.data.savedBy?' · '+e.data.savedBy:'');updateBanner();setTimeout(function(){if(GEO_SAVE_STATE==='saved'){GEO_SAVE_STATE='idle';updateBanner();}},3500);}else if(e.data.type==='asaas-geo-save-failed'){GEO_SAVE_STATE='error';GEO_SAVE_MESSAGE=e.data.error||'Неизвестная ошибка';updateBanner();}});
  function loadMasterBaseline(){
    return fetch('api/geo_master.php?file=runtime.json',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('master '+r.status);return r.json();}).then(function(d){
      if(!d||!d.meta||!Array.isArray(d.bc)||!Array.isArray(d.medicine)||!Array.isArray(d.pharmacies)||!Array.isArray(d.mahallas)||!Array.isArray(d.restaurants)||!Array.isArray(d.cafes))throw new Error('invalid master payload');
      replaceArray(BC,d.bc);replaceArray(MEDPTS,d.medicine);replaceArray(PHARM,normalizePharmacies(d.pharmacies));replaceArray(GEO_POI.restaurants,d.restaurants);replaceArray(GEO_POI.cafes,d.cafes);window.ASAAS_GEO_MASTER_MAHALLAS=d.mahallas;window.ASAAS_GEO_MASTER_META=d.meta;window.ASAAS_GEO_MASTER_READY=true;
    }).catch(function(e){console.warn('CASE OS geo master baseline not loaded; using bundled fallback',e);});
  }
  function auth(){
    // Проверяем не только факт входа, но и серверную рабочую область. Раньше прямой URL
    // geoanalytics-studio.html пропускал любую внутреннюю роль, даже когда модуль был скрыт.
    return Promise.all([
      fetch('api/auth.php',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.ok?r.json():Promise.reject(new Error('auth'));}),
      fetch('api/workspace_access.php?view=geoanalytics',{credentials:'same-origin',cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('workspace '+r.status);return r.json();})
    ]).then(function(rows){var j=rows[0],a=rows[1];if(!j.auth||!j.user||!a.allowed)throw new Error('denied');if(!EMBEDDED)GEO_CAN_EDIT=!!a.can_edit;document.body.classList.remove('geo-auth-pending');}).catch(function(){document.body.innerHTML='<main class="geo-denied"><h1>CASE Universal Geoanalytics</h1><p>Защищённый модуль открывается только сотрудникам, чья рабочая область включает геоаналитику.</p><a href="index.html">Открыть CASE OS</a></main>';document.body.classList.remove('geo-auth-pending');throw new Error('denied');});
  }
  /* ---- v4.31.0: подраздел «Объекты на карте» — карточки наших точек, вкл/выкл, вид, видимость для внешних ---- */
  var GEO_PROJ_MARKERS={},GEO_PROJ_CENTERED=false;
  window.geoMarkers=function(){return GEO_PROJ_MARKERS;};
  function geoObjById(id){return PROJECTS[String(id)];}
  function geoObjColorOf(q){return (/^#[0-9a-f]{6}$/i.test(q&&q.markerColor||''))?q.markerColor:((q&&q.verification==='verified')?'#14675B':'#A8792C');}
  function geoApplyRoleUi(){
    var b=[].slice.call(document.querySelectorAll('.tabs button')).filter(function(x){return x.dataset.t==='objT';})[0];
    if(b)b.style.display=GEO_EXTERNAL?'none':'';
    // если внешний оказался на скрытой вкладке — вернуть на карту
    if(GEO_EXTERNAL){var p=document.getElementById('objT');if(p&&!p.classList.contains('hidden')){var mb=[].slice.call(document.querySelectorAll('.tabs button')).filter(function(x){return x.dataset.t==='mapT';})[0];if(mb)mb.click();}}
  }
  function geoEnsureObjCss(){
    if(document.getElementById('geoObjCss'))return;
    var s=document.createElement('style');s.id='geoObjCss';
    s.textContent='.geo-obj-wrap{padding:2px}.geo-obj-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}.geo-obj-head h3{margin:0 0 3px}.geo-obj-head small{color:#666;font-size:11px;display:block;max-width:660px;line-height:1.4}'
      +'.geo-obj-tblwrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;max-height:70vh;overflow-y:auto}'
      +'.geo-obj-tbl{border-collapse:collapse;width:100%;font-size:12px;background:#fff}'
      +'.geo-obj-tbl th{background:#f5f6f7;text-align:left;padding:7px 9px;font-weight:600;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;z-index:2}'
      +'.geo-obj-tbl td{padding:5px 9px;border-bottom:1px solid #eef0f2;vertical-align:middle}'
      +'.geo-obj-tbl tr:hover td{background:#faf7f5}.geo-obj-c{text-align:center}'
      +'.geo-obj-focus{background:none;border:none;color:#9E0000;font-weight:600;cursor:pointer;padding:0;text-align:left;font-size:12px}.geo-obj-focus:hover{text-decoration:underline}'
      +'.geo-obj-pf{font-size:9px;background:#eef3ff;color:#3157a8;border-radius:4px;padding:1px 4px;vertical-align:middle}'
      +'.geo-obj-warn{color:#c07a00}.geo-obj-nocoord td{background:#fffdf5}.geo-ok{color:#28945a}.geo-warn{color:#e29b19}'
      +'.geo-obj-color{width:34px;height:22px;border:1px solid var(--line);border-radius:4px;padding:0;cursor:pointer;background:none}.geo-obj-edit{padding:2px 8px}.geo-obj-del{padding:2px 8px;border-color:#e0a0a0!important;color:#9E0000!important}.geo-obj-del:hover{background:#fbeaea}'
      +'.geo-obj-pop b{font-size:13px}.geo-obj-pop-xy{font-size:11px;color:#666;margin-top:3px}.geo-obj-pop-ver{font-size:11px;margin-top:2px}.geo-obj-pop-act{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}.geo-obj-pop-act .btn{font-size:11px;padding:3px 7px}'
      +'.geo-sw{position:relative;display:inline-block;width:34px;height:18px;cursor:pointer}.geo-sw input{opacity:0;width:0;height:0;position:absolute}.geo-sw span{position:absolute;inset:0;background:#c9ccd1;border-radius:18px;transition:.15s}.geo-sw span:before{content:"";position:absolute;width:14px;height:14px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.15s}.geo-sw input:checked+span{background:#28945a}.geo-sw-ext input:checked+span{background:#2f6fd6}.geo-sw input:checked+span:before{transform:translateX(16px)}.geo-sw input:disabled+span{opacity:.5;cursor:not-allowed}'
      +'.geo-obj-tbl .geo-th-sort-ic{color:#b7b1a8;font-size:11px}.geo-obj-tbl .geo-th-sort-ic.on{color:#9E0000}.geo-obj-count{font-size:11px;color:#8a847c;margin:0 0 6px 2px}'
      +'body.dark .geo-obj-tbl,body.dark .geo-obj-tbl th,body.dark .geo-obj-tbl td{background:#202329;color:#eee;border-color:#393d45}body.dark .geo-obj-tbl tr:hover td{background:#2b2f36}';
    document.head.appendChild(s);
  }
  /* ---- фильтрация + сортировка таблицы «Объекты на карте» (как в LCR / «Управление данными») ---- */
  var GEO_OBJ_SORT=null,GEO_OBJ_FILTERS={},GEO_OBJ_MENU=null;
  var GEO_OBJ_COLS=[
    {k:'name',label:'Название',get:function(p){return p.name||p.id||'';}},
    {k:'loc',label:'Город / Район',get:function(p){return [p.city,p.district].filter(Boolean).join(' · ');}},
    {k:'type',label:'Тип',get:function(p){return TYPE_LABELS[p.type]||p.type||'';}},
    {k:'xy',label:'Координаты',get:function(p){var la=+p.lat,ln=+p.lng;return (Number.isFinite(la)&&Number.isFinite(ln))?(la.toFixed(5)+', '+ln.toFixed(5)):'';},sortval:function(p){return Number.isFinite(+p.lat)?+p.lat:-1e9;}},
    {k:'ver',label:'Пров.',get:function(p){return p.verification==='verified'?'Подтверждён':'Требует проверки';}},
    {k:'onmap',label:'На карте',get:function(p){return p.mapHidden?'Нет':'Да';}},
    {k:'ext',label:'Внешним',get:function(p){return p.extVisible?'Да':'Нет';}}
  ];
  function geoObjColByKey(k){for(var i=0;i<GEO_OBJ_COLS.length;i++)if(GEO_OBJ_COLS[i].k===k)return GEO_OBJ_COLS[i];return null;}
  function geoObjCellText(p,c){var v=c.get(p);return String(v==null?'':v);}
  function geoObjDistinct(k){var c=geoObjColByKey(k);var set=[],blank=false;Object.keys(PROJECTS).forEach(function(id){var v=geoObjCellText(PROJECTS[id],c);if(v==='')blank=true;else if(set.indexOf(v)<0)set.push(v);});set.sort(function(a,b){return a.localeCompare(b,'ru',{numeric:true});});if(blank)set.push('(Пусто)');return set;}
  function geoObjFilterOn(k){var f=GEO_OBJ_FILTERS[k];return !!(f&&Array.isArray(f.vals));}
  function geoObjPass(p){for(var k in GEO_OBJ_FILTERS){var f=GEO_OBJ_FILTERS[k];if(!f||!Array.isArray(f.vals))continue;var c=geoObjColByKey(k);if(!c)continue;var v=geoObjCellText(p,c);if(f.vals.indexOf(v===''?'(Пусто)':v)<0)return false;}return true;}
  function geoObjSortedIds(){var ids=Object.keys(PROJECTS).filter(function(id){return geoObjPass(PROJECTS[id]);});
    if(GEO_OBJ_SORT){var c=geoObjColByKey(GEO_OBJ_SORT.key),dir=GEO_OBJ_SORT.dir<0?-1:1;if(c)ids.sort(function(a,b){var pa=PROJECTS[a],pb=PROJECTS[b],va,vb;if(c.sortval){va=c.sortval(pa);vb=c.sortval(pb);}else{va=geoObjCellText(pa,c).toLowerCase();vb=geoObjCellText(pb,c).toLowerCase();}return va<vb?-dir:va>vb?dir:0;});}
    return ids;}
  function geoObjMenuClose(){var m=document.getElementById('geoColMenu');if(m&&m.parentNode)m.parentNode.removeChild(m);GEO_OBJ_MENU=null;document.removeEventListener('mousedown',geoObjMenuAway,true);document.removeEventListener('keydown',geoObjMenuEsc,true);}
  window.geoObjMenuClose=geoObjMenuClose;
  function geoObjMenuAway(e){var m=document.getElementById('geoColMenu');if(m&&!m.contains(e.target))geoObjMenuClose();}
  function geoObjMenuEsc(e){if(e.key==='Escape')geoObjMenuClose();}
  window.geoObjMenu=function(key,anchor){try{if(typeof geoMenuClose==='function')geoMenuClose();}catch(e){}geoObjMenuClose();
    var c=geoObjColByKey(key);if(!c)return;try{geoEnsureTblCss();}catch(e){}
    var distinct=geoObjDistinct(key),cur=GEO_OBJ_FILTERS[key],curVals=(cur&&Array.isArray(cur.vals))?cur.vals.slice():null,checked={};
    distinct.forEach(function(v){checked[v]=curVals==null?true:curVals.indexOf(v)>=0;});GEO_OBJ_MENU={key:key,distinct:distinct,checked:checked};
    var valList=distinct.map(function(v){return '<label class="geo-m-v"><input type="checkbox" data-v="'+esc(v)+'"'+(checked[v]?' checked':'')+' onchange="geoObjMenuCheck(this)"><span>'+esc(v)+'</span></label>';}).join('');
    var label=(c&&c.label)||key;
    var html='<div class="geo-m-head"><b>'+esc(label)+'</b><button type="button" class="geo-m-x" onclick="geoObjMenuClose()" aria-label="Закрыть">×</button></div>'
      +'<div class="geo-m-body"><div class="geo-m-sort"><button type="button" onclick="geoObjMenuSort(1)">▲ А → Я</button><button type="button" onclick="geoObjMenuSort(-1)">▼ Я → А</button></div>'
      +'<div class="geo-m-sec">Значения <small>'+distinct.length+'</small></div><input type="search" id="geoMSrch" placeholder="Поиск значения…" oninput="geoObjMenuSearch(this.value)">'
      +'<div class="geo-m-links"><a href="#" onclick="geoObjMenuAll(true);return false">Выбрать все</a><span>·</span><a href="#" onclick="geoObjMenuAll(false);return false">Снять все</a></div>'
      +'<div id="geoMVals" class="geo-m-vals">'+(valList||'<div class="geo-m-empty">Нет значений</div>')+'</div></div>'
      +'<div class="geo-m-ftr"><button type="button" onclick="geoObjMenuReset()">Сбросить</button><span class="geo-m-spacer"></span><button type="button" onclick="geoObjMenuClose()">Отмена</button><button type="button" class="geo-m-ok" onclick="geoObjMenuApply()">Применить</button></div>';
    var m=document.createElement('div');m.id='geoColMenu';m.innerHTML=html;document.body.appendChild(m);
    geoPlaceColMenu(m,anchor);
    setTimeout(function(){document.addEventListener('mousedown',geoObjMenuAway,true);document.addEventListener('keydown',geoObjMenuEsc,true);},0);};
  window.geoObjMenuCheck=function(el){if(GEO_OBJ_MENU)GEO_OBJ_MENU.checked[el.getAttribute('data-v')]=el.checked;};
  window.geoObjMenuAll=function(on){if(!GEO_OBJ_MENU)return;var q=(document.getElementById('geoMSrch').value||'').toLowerCase();document.querySelectorAll('#geoMVals input').forEach(function(cb){var v=cb.getAttribute('data-v');if(!q||v.toLowerCase().indexOf(q)>=0){cb.checked=on;GEO_OBJ_MENU.checked[v]=on;}});};
  window.geoObjMenuSearch=function(q){q=(q||'').toLowerCase();document.querySelectorAll('#geoMVals .geo-m-v').forEach(function(l){var v=l.querySelector('input').getAttribute('data-v');l.style.display=(!q||v.toLowerCase().indexOf(q)>=0)?'grid':'none';});};
  window.geoObjMenuSort=function(dir){if(!GEO_OBJ_MENU)return;var k=GEO_OBJ_MENU.key;geoObjMenuClose();GEO_OBJ_SORT={key:k,dir:dir};geoSaveUiPrefs();geoObjTab();};
  window.geoObjMenuReset=function(){if(!GEO_OBJ_MENU)return;var k=GEO_OBJ_MENU.key;geoObjMenuClose();delete GEO_OBJ_FILTERS[k];if(GEO_OBJ_SORT&&GEO_OBJ_SORT.key===k)GEO_OBJ_SORT=null;geoSaveUiPrefs();geoObjTab();};
  window.geoObjMenuApply=function(){if(!GEO_OBJ_MENU)return;var k=GEO_OBJ_MENU.key,distinct=GEO_OBJ_MENU.distinct,all=true,any=false,sel=[];distinct.forEach(function(v){if(GEO_OBJ_MENU.checked[v]){any=true;sel.push(v);}else all=false;});geoObjMenuClose();if(!all){GEO_OBJ_FILTERS[k]={vals:any?sel:[]};}else{delete GEO_OBJ_FILTERS[k];}geoSaveUiPrefs();geoObjTab();};
  window.geoObjFilterReset=function(){GEO_OBJ_FILTERS={};GEO_OBJ_SORT=null;geoSaveUiPrefs();geoObjTab();};
  window.geoObjSortToggle=function(k){if(!GEO_OBJ_SORT||GEO_OBJ_SORT.key!==k)GEO_OBJ_SORT={key:k,dir:1};else if(GEO_OBJ_SORT.dir>0)GEO_OBJ_SORT.dir=-1;else GEO_OBJ_SORT=null;geoSaveUiPrefs();geoObjTab();};
  function geoObjSortIc(k){if(!GEO_OBJ_SORT||GEO_OBJ_SORT.key!==k)return '';return ' <span class="geo-th-sort-ic on">'+(GEO_OBJ_SORT.dir<0?'▼':'▲')+'</span>';}
  function geoObjTh(c){return '<th><span class="geo-th-label">'+esc(c.label)+geoObjSortIc(c.k)+' <span class="geo-th-fnl'+(geoObjFilterOn(c.k)?' on':'')+'" title="Фильтр и сортировка" onclick="event.stopPropagation();geoObjMenu(\''+c.k+'\',this)">▾</span></span></th>';}
  window.geoObjTab=function(){
    var host=document.getElementById('objT');if(!host)return;try{geoEnsureUiPrefs();}catch(e){}
    try{geoEnsureObjCss();}catch(e){}try{geoEnsureTblCss();}catch(e){}
    var canEdit=GEO_CAN_EDIT,ids=geoObjSortedIds(),total=Object.keys(PROJECTS).length;
    var body=ids.map(function(id){
      var p=PROJECTS[id]||{},la=+p.lat,ln=+p.lng,hasxy=Number.isFinite(la)&&Number.isFinite(ln);
      var color=geoObjColorOf(p),loc=[p.city,p.district].filter(Boolean).join(' · ')||'—',typ=TYPE_LABELS[p.type]||p.type||'—';
      return '<tr class="geo-obj-row'+(hasxy?'':' geo-obj-nocoord')+'" data-id="'+esc(id)+'">'
        +'<td class="geo-obj-name"><button class="geo-obj-focus" onclick="geoObjFocus(\''+esc(id)+'\')" title="Показать на карте">'+esc(p.name||id)+'</button>'+(p.portfolio?' <span class="geo-obj-pf">портфель</span>':'')+'</td>'
        +'<td>'+esc(loc)+'</td><td>'+esc(typ)+'</td>'
        +'<td class="geo-obj-xy">'+(hasxy?(la.toFixed(5)+', '+ln.toFixed(5)):'<span class="geo-obj-warn">нет координат</span>')+'</td>'
        +'<td class="geo-obj-c">'+(p.verification==='verified'?'<span class="geo-ok" title="Подтверждён">✔</span>':'<span class="geo-warn" title="Требует проверки">⚠</span>')+'</td>'
        +'<td class="geo-obj-c"><label class="geo-sw"><input type="checkbox" '+(!p.mapHidden?'checked':'')+(canEdit?'':' disabled')+' onchange="geoObjToggleMap(\''+esc(id)+'\',this.checked)"><span></span></label></td>'
        +'<td class="geo-obj-c"><label class="geo-sw geo-sw-ext"><input type="checkbox" '+(p.extVisible?'checked':'')+(canEdit?'':' disabled')+' onchange="geoObjToggleExt(\''+esc(id)+'\',this.checked)"><span></span></label></td>'
        +'<td class="geo-obj-c"><input type="color" class="geo-obj-color" value="'+color+'" '+(canEdit?'':'disabled')+' onchange="geoObjColor(\''+esc(id)+'\',this.value)"></td>'
        +'<td class="geo-obj-c" style="white-space:nowrap">'+(canEdit?'<button class="btn sec geo-obj-edit" onclick="geoObjEdit(\''+esc(id)+'\')" title="Полная карточка">✎</button> <button class="btn sec geo-obj-del" onclick="geoObjDelete(\''+esc(id)+'\')" title="Удалить объект">🗑</button>':'')+'</td></tr>';
    }).join('');
    var active=GEO_OBJ_SORT||Object.keys(GEO_OBJ_FILTERS).some(function(k){return geoObjFilterOn(k);});
    host.innerHTML='<div class="geo-obj-wrap"><div class="geo-obj-head"><div><h3>Объекты на карте</h3>'
      +'<small>Наши проекты и точки, отображаемые на карте. Клик по названию — показать точку на карте. Воронка ▾ в заголовке — фильтр и сортировка (как в LCR). '
      +(canEdit?'«На карте» — видимость точки; «Внешним» — видят ли её внешние агенты (AGX), по умолчанию наши объекты им скрыты; «Вид» — цвет метки; ✎ — полная карточка.':'Режим просмотра — редактирование недоступно для вашей роли.')+'</small></div>'
      +'<div style="display:flex;gap:8px;align-items:center">'+(active?'<button class="btn sec" onclick="geoObjFilterReset()" title="Сбросить фильтры и сортировку">✕ Сброс</button>':'')+(canEdit?'<button class="btn" onclick="geoNewProject()">＋ Добавить объект</button>':'')+'</div></div>'
      +(active?'<div class="geo-obj-count">Показано '+ids.length+' из '+total+'</div>':'')
      +'<div class="geo-obj-tblwrap"><table class="geo-obj-tbl" data-grid-engine="geo-objects" data-case-grid-key="geo_objects"><thead><tr>'+GEO_OBJ_COLS.map(geoObjTh).join('')+'<th>Вид</th><th></th></tr></thead>'
      +'<tbody>'+(body||'<tr><td colspan="9" style="text-align:center;color:#888;padding:16px">'+(total?'Ничего не найдено по фильтру':'Пока нет объектов')+'</td></tr>')+'</tbody></table></div></div>';
  };
  function geoObjPopup(id){
    var q=PROJECTS[id];if(!q)return '';
    var loc=[q.city,q.district].filter(Boolean).join(' · ')||'—',typ=TYPE_LABELS[q.type]||q.type||'—',la=+q.lat,ln=+q.lng;
    var s='<div class="geo-obj-pop"><b>'+esc(q.name||id)+'</b><br><small>'+esc(typ)+' · '+esc(loc)+'</small>'
      +'<div class="geo-obj-pop-xy">'+(Number.isFinite(la)?la.toFixed(5):'—')+', '+(Number.isFinite(ln)?ln.toFixed(5):'—')+'</div>'
      +'<div class="geo-obj-pop-ver">'+(q.verification==='verified'?'✔ подтверждён':'⚠ требует проверки')+(q.extVisible?' · <span style="color:#0a7">виден внешним</span>':'')+'</div>';
    if(GEO_CAN_EDIT)s+='<div class="geo-obj-pop-act"><button class="btn sec" onclick="geoObjEdit(\''+esc(id)+'\')">✎ Редактировать</button><button class="btn sec" onclick="geoObjToggleMap(\''+esc(id)+'\',false)">🙈 Скрыть</button><button class="btn sec" style="border-color:#e0a0a0;color:#9E0000" onclick="geoObjDelete(\''+esc(id)+'\')">🗑 Удалить</button></div>';
    return s+'</div>';
  }
  function geoRenderProj(){
    var p=(typeof active==='function')?active():PROJECTS[Object.keys(PROJECTS)[0]];
    var pi=document.getElementById('projInfo'),plat=+(p&&p.lat),plng=+(p&&p.lng);
    if(pi&&p)pi.innerHTML=esc(p.name)+'<br>Район: <b>'+esc(p.district||'—')+'</b><br>'+(Number.isFinite(plat)?plat.toFixed(5):'—')+', '+(Number.isFinite(plng)?plng.toFixed(5):'—')+(p.verification!=='verified'?'<br><span style="color:#9b6b00">требуется проверка</span>':'');
    try{if(typeof renderRings==='function')renderRings();}catch(e){}
    try{if(typeof catchSummary==='function')catchSummary();}catch(e){}
    if(!map||!window.L||!gProj)return;
    gProj.clearLayers();GEO_PROJ_MARKERS={};
    Object.keys(PROJECTS).forEach(function(id){
      var q=PROJECTS[id],la=+q.lat,ln=+q.lng;
      if(!Number.isFinite(la)||!Number.isFinite(ln)||q.mapHidden)return;
      if(GEO_EXTERNAL&&!q.extVisible)return;
      var isActive=(p&&String(id)===String(p.id)),color=geoObjColorOf(q),mk;
      if(isActive){
        var ic=L.divIcon({className:'',html:'<div style="background:'+color+';width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5)"></div>',iconSize:[20,20],iconAnchor:[10,18]});
        mk=L.marker([la,ln],{icon:ic}).bindTooltip('★ '+esc(q.name),{permanent:true,direction:'top',className:'dlab'});
      }else{
        var rad=Number.isFinite(+q.markerSize)&&+q.markerSize>0?+q.markerSize:6;
        mk=L.circleMarker([la,ln],{radius:rad,color:'#fff',weight:1.5,fillColor:color,fillOpacity:.85}).bindTooltip(esc(q.name));
      }
      mk.bindPopup(geoObjPopup(id),{maxWidth:300});
      mk.on('click',function(){var s=document.getElementById('proj');if(s&&s.value!==String(id)){s.value=String(id);if(typeof universalProfile==='function')universalProfile();}mk.openPopup();});
      mk.addTo(gProj);GEO_PROJ_MARKERS[String(id)]=mk;
    });
    if(!GEO_PROJ_CENTERED&&Number.isFinite(plat)&&Number.isFinite(plng)){try{map.setView([plat,plng],11);}catch(e){}GEO_PROJ_CENTERED=true;}
  }
  window.geoObjFocus=function(id){
    var p=geoObjById(id);if(!p)return;var s=document.getElementById('proj');if(s)s.value=String(id);
    var mb=[].slice.call(document.querySelectorAll('.tabs button')).filter(function(b){return b.dataset.t==='mapT';})[0];if(mb)mb.click();
    if(typeof universalProfile==='function')universalProfile();
    var la=+p.lat,ln=+p.lng;
    if(map&&Number.isFinite(la)&&Number.isFinite(ln)){try{map.setView([la,ln],15);}catch(e){}}
    if(typeof renderProj==='function')renderProj();
    setTimeout(function(){try{var mk=GEO_PROJ_MARKERS[String(id)];if(mk&&mk.openPopup)mk.openPopup();else if(!Number.isFinite(la))alert('У объекта «'+(p.name||id)+'» нет координат. Откройте ✎ и задайте их.');}catch(e){}},140);
  };
  window.geoObjEdit=function(id){
    var p=geoObjById(id);if(!p||!GEO_CAN_EDIT)return;var s=document.getElementById('proj');if(s)s.value=String(id);
    var sb=[].slice.call(document.querySelectorAll('.tabs button')).filter(function(b){return b.dataset.t==='siteT';})[0];if(sb)sb.click();
    if(typeof universalProfile==='function')universalProfile();
  };
  window.geoObjToggleMap=function(id,on){var p=geoObjById(id);if(!p||!GEO_CAN_EDIT)return;p.mapHidden=!on;GEO_PROFILES[id]=clone(p);commit('видимость на карте: '+(p.name||id));try{renderProj();}catch(e){}try{geoObjTab();}catch(e){}};
  window.geoObjToggleExt=function(id,on){var p=geoObjById(id);if(!p||!GEO_CAN_EDIT)return;p.extVisible=!!on;GEO_PROFILES[id]=clone(p);commit('видимость для внешних агентов: '+(p.name||id));try{renderProj();}catch(e){}};
  window.geoObjColor=function(id,color){var p=geoObjById(id);if(!p||!GEO_CAN_EDIT||!/^#[0-9a-f]{6}$/i.test(color))return;p.markerColor=color;GEO_PROFILES[id]=clone(p);commit('вид метки: '+(p.name||id));try{renderProj();}catch(e){}};
  window.geoObjDelete=function(id){var p=geoObjById(id);if(!p||!GEO_CAN_EDIT)return;
    if(!confirm('Удалить объект «'+(p.name||id)+'» из геоаналитики? Он исчезнет с карты и из списка. Действие можно отменить через «🕘 История / восстановление».'))return;
    GEO_META.excludedProjects=GEO_META.excludedProjects||{};GEO_META.excludedProjects[String(id)]=true;
    delete PROJECTS[String(id)];delete GEO_PROFILES[String(id)];
    var s=document.getElementById('proj');if(s&&s.value===String(id))s.value=Object.keys(PROJECTS)[0]||'';
    syncProjects(GEO_CONTEXT.projects||Object.keys(GEO_PROFILES).map(function(k){return GEO_PROFILES[k];}),s&&s.value);
    commit('удалён объект: '+(p.name||id));try{renderProj();}catch(e){}try{geoObjTab();}catch(e){}};
  function boot(){
    if(window.ASAAS_GEO_MASTER_META){GEO_META=Object.assign({},GEO_META,{status:'preloaded_master',updatedAt:window.ASAAS_GEO_MASTER_META.generated_at||'',updatedBy:'CASE OS integrated baseline',master:clone(window.ASAAS_GEO_MASTER_META)});}
    baselineCleanup();siteTab=universalProfile;analytics=genericAnalytics;dataTab=dataManager;window.renderProj=geoRenderProj;try{geoApplyRoleUi();}catch(e){}
    document.body.classList.toggle('geo-embedded',EMBEDDED);
    var tabs=document.querySelectorAll('.tabs button');tabs.forEach(function(b){if(b.dataset.t==='siteT')b.textContent='Профиль проекта';if(b.dataset.t==='dataT')b.textContent='Управление данными';});
    if(!EMBEDDED){try{var s=JSON.parse(localStorage.getItem('asaas_geo_v1')||'null');if(s)applyState(s);}catch(e){}}
    syncProjects(Object.keys(GEO_PROFILES).length?Object.keys(GEO_PROFILES).map(function(k){return GEO_PROFILES[k];}):[],activeId());refreshAll();
    var ps=document.getElementById('proj');if(ps)ps.addEventListener('change',function(){universalProfile();genericAnalytics();planningTab();});
    document.addEventListener('change',function(e){if(e.target&&(e.target.id==='geoProjectFiles'||e.target.id==='geoPlanningFiles')){attachProjectFiles(e.target.files);e.target.value='';}});
    if(map)map.on('click',function(e){if(!GEO_PICK_PROJECT)return;GEO_PICK_PROJECT=false;var p=active();p.lat=+e.latlng.lat.toFixed(6);p.lng=+e.latlng.lng.toFixed(6);p.district=distFast(p.lat,p.lng)||p.district;GEO_PROFILES[p.id]=clone(p);commit('координаты проекта: '+p.name);renderProj();universalProfile();planningTab();});
    if(map)map.on('moveend',renderPoiLayers);
    seedMahallas();
    updateBanner();post('asaas-geo-ready',{});
  }
  // Стартовый слой содержит 545 валидных координат офисов махаллинских комитетов.
  // 26 исходных строк с координатами 0,0 намеренно не показываются на карте и остаются в
  // data/geo_master/research_queue.csv до геокодирования. Сохранённое серверное состояние
  // всегда имеет приоритет над предзагруженной мастер-базой.
  function seedMahallas(){
    setTimeout(function(){
      if(GEO_POI.mahallas.length)return;
      var built=window.ASAAS_GEO_MASTER_MAHALLAS;
      if(Array.isArray(built)&&built.length){replaceArray(GEO_POI.mahallas,built);poiRowRefresh('mahallas');renderPoiLayer('mahallas');updateBanner();return;}
      fetch('data/mahallas_tashkent.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(rows){
        if(!Array.isArray(rows)||!rows.length||GEO_POI.mahallas.length)return;
        rows=rows.filter(function(x){return Number.isFinite(+x.lat)&&Number.isFinite(+x.lng)&&!(+x.lat===0&&+x.lng===0);});
        replaceArray(GEO_POI.mahallas,rows);poiRowRefresh('mahallas');renderPoiLayer('mahallas');updateBanner();
      }).catch(function(){});
    },250);
  }
  /* Ускорение первой загрузки: НЕ держим готовность на 2.5-МБ мастер-наборе. Сначала грузим
     оболочку и карту (boot → готовность прячет загрузчик), а тяжёлую мастер-базу (медицина/аптеки)
     тянем в фоне и до-рисовываем, когда пришла. Так карта появляется за ~1с, а не за 4-5с. */
  function geoStart(){boot();try{loadMasterBaseline().then(function(){try{refreshAll();}catch(e){}});}catch(e){}}
  auth().then(function(){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',geoStart,{once:true});else setTimeout(geoStart,0);}).catch(function(){});
})();
