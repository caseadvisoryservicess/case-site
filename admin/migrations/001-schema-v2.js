/**
 * Миграция 001: схема лендинга v2 (структура из 9 экранов).
 *
 * Аддитивная: старые секции (lots, invest, progress, hero, uses) не удаляются —
 * их перестаёт читать новый шаблон, но панель и откат работают.
 * Все цифры — только верифицированные из брифа. Тексты — либо утверждённые
 * формулировки брифа, либо перенос уже опубликованного контента.
 *
 * Запуск:  node migrations/001-schema-v2.js up   [slug]
 * Откат:   node migrations/001-schema-v2.js down [slug]
 * (без slug — takhtapul; up пишет резервную копию project.pre-v2.bak)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[3] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const BAK = FILE.replace(/\.json$/, '.pre-v2.bak');

const ml = (ru, uz, en) => ({ ru: ru || '', uz: uz || '', en: en || '' });

function up() {
  const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (cfg.schemaVersion >= 2) { console.log('Уже v2, пропуск.'); return; }
  fs.writeFileSync(BAK, JSON.stringify(cfg, null, 2));

  cfg.schemaVersion = 2;

  // ── экран 1: hero ──
  cfg.intro = {
    image: 'facade-evening.jpg', // временно; заменить на рендер TAXTAPUL (сумерки) через панель
    h1: ml(
      'Коммерческое здание Тахтапул, 31 — Ташкент',
      'Taxtapul 31 tijorat binosi — Toshkent',
      'Commercial building at 31 Taxtapul Street, Tashkent'
    ),
    sub: ml(
      'Аренда · Покупка · Аренда с последующим выкупом',
      'Ijara · Sotib olish · Keyinchalik sotib olish sharti bilan ijara',
      'Lease · Purchase · Lease with option to buy'
    ),
    facts: [
      { n: '5', l: ml('уровней', 'daraja', 'levels') },
      { n: '337–396', l: ml('м² GLA на этаж', 'm² GLA har qavatda', 'm² GLA per floor') },
      { n: '', l: ml('Шайхантахурский район', 'Shayxontohur tumani', 'Shaykhantahur district') }
    ]
  };

  // ── экран 2: ключевые параметры (5 плиток, только цифры) ──
  cfg.params = [
    { n: '1 882,9', l: ml('м² GLA всего', 'm² umumiy GLA', 'm² total GLA') },
    { n: '5', l: ml('уровней', 'daraja', 'levels') },
    { n: 'Open plan', l: ml('свободная планировка', 'erkin planirovka', 'open floor plates') },
    { n: '12', l: ml('машиномест', 'avtoturargoh joyi', 'parking spaces') },
    { n: '', l: ml('Лифт', 'Lift', 'Lift'), icon: 'lift' }
  ];

  // ── экран 3: юниты ──
  cfg.unitsSection = {
    h2: ml('Помещения', 'Maydonlar', 'Premises'),
    note: ml(
      'Все этажи — open plan: только колонны с сеткой 5 950 × 7 150 мм и лифтовое ядро, без внутренних перегородок. Пространство делится под задачу арендатора.',
      "Barcha qavatlar — open plan: faqat 5 950 × 7 150 mm to'rli kolonnalar va lift yadrosi, ichki to'siqlarsiz. Maydon ijarachining vazifasiga moslab bo'linadi.",
      'All floors are open plan: columns on a 5 950 × 7 150 mm grid and the lift core only, no internal partitions. Each floor plate can be subdivided to the tenant’s brief.'
    )
  };
  cfg.units = [
    {
      id: 'b', lvlShort: '−1', gla: '337,4', plan: 'plan-b.svg',
      level: ml('Подвал', 'Podval', 'Basement'),
      uses: ml('сервис, шоурум, вспомогательные функции', "xizmat ko'rsatish, shourum, yordamchi funksiyalar", 'services, showroom, support functions'),
      status: 'available'
    },
    {
      id: 'f1', lvlShort: '1', gla: '358,7', plan: 'plan-f1.svg',
      level: ml('1 этаж', '1-qavat', 'Floor 1'),
      uses: ml('шоурум, сервис, ресепшн клиники', 'shourum, servis, klinika qabulxonasi', 'showroom, services, clinic reception'),
      status: 'available'
    },
    {
      id: 'f2', lvlShort: '2', gla: '395,6', plan: 'plan-f2.svg',
      level: ml('2 этаж', '2-qavat', 'Floor 2'),
      uses: ml('клиника, офис, учебный центр', "klinika, ofis, o'quv markazi", 'clinic, office, training center'),
      status: 'available'
    },
    {
      id: 'f3', lvlShort: '3', gla: '395,6', plan: 'plan-f3.svg',
      level: ml('3 этаж', '3-qavat', 'Floor 3'),
      uses: ml('клиника, офис, учебный центр', "klinika, ofis, o'quv markazi", 'clinic, office, training center'),
      status: 'available'
    },
    {
      id: 'f4', lvlShort: '4', gla: '395,6', glaNote: '314,2 + 101,8', plan: 'plan-f4.svg',
      level: ml('4 этаж', '4-qavat', 'Floor 4'),
      uses: ml('офис, учебный центр', "ofis, o'quv markazi", 'office, training center'),
      status: 'available'
    },
    {
      id: 'all', lvlShort: '1–4', gla: '1 882,9', whole: true,
      level: ml('Здание целиком', 'Butun bino', 'Whole building'),
      uses: ml('клиника, учебный центр, штаб-квартира — здание под один бренд', "klinika, o'quv markazi, bosh ofis — bino bitta brend uchun", 'clinic, training center, headquarters — the building under one brand'),
      status: 'available'
    }
  ];

  // ── экран 4: сценарии использования (порядок: клиника → обучение → офис → сервис) ──
  cfg.useCases = {
    h2: ml('Кому подходит', 'Kimga mos keladi', 'Use cases'),
    cards: [
      {
        icon: 'clinic',
        h: ml('Клиника', 'Klinika', 'Clinic'),
        levels: ml('этажи 1–3', '1–3-qavatlar', 'floors 1–3'),
        p: ml(
          'Рядом сложившийся медицинский кластер: Sinomed MD International Hospital, областной онкологический центр и республиканский медколледж в радиусе ~1 км. Open plan позволяет спроектировать кабинеты и диагностику под лицензию.',
          "Yaqin atrofda shakllangan tibbiyot klasteri: Sinomed MD International Hospital, viloyat onkologiya markazi va respublika tibbiyot kolleji ~1 km radiusda. Open plan litsenziyaga mos kabinetlar va diagnostikani loyihalash imkonini beradi.",
          'An established medical cluster nearby: Sinomed MD International Hospital, the regional oncology center and the republican medical college within ~1 km. Open plan lets you lay out consulting and diagnostic rooms to licensing requirements.'
        )
      },
      {
        icon: 'education',
        h: ml('Учебный центр', "O'quv markazi", 'Training center'),
        levels: ml('этажи 2–4', '2–4-qavatlar', 'floors 2–4'),
        p: ml(
          'Этаж 395,6 м² без перегородок делится на аудитории любого размера. Паркинг для преподавателей и удобный подъезд для слушателей.',
          "To'siqlarsiz 395,6 m² qavat istalgan o'lchamdagi auditoriyalarga bo'linadi. O'qituvchilar uchun avtoturargoh va tinglovchilar uchun qulay kirish yo'li.",
          'A 395.6 m² floor plate with no partitions divides into classrooms of any size. Parking for staff and easy drive-in access for students.'
        )
      },
      {
        icon: 'office',
        h: ml('Офис', 'Ofis', 'Office'),
        levels: ml('этажи 2–4 или здание целиком', '2–4-qavatlar yoki butun bino', 'floors 2–4 or the whole building'),
        p: ml(
          'Штаб-квартира с собственной вывеской на фасаде. Один этаж — одна компания, без соседей по коридору.',
          "Fasadda o'z peshlavhangiz bilan bosh ofis. Bir qavat — bitta kompaniya, yo'lakda qo'shnilarsiz.",
          'A headquarters with your own signage on the facade. One floor — one company, no corridor neighbours.'
        )
      },
      {
        icon: 'service',
        h: ml('Сервис / шоурум', 'Servis / shourum', 'Service / showroom'),
        levels: ml('1 этаж и подвал', '1-qavat va podval', 'floor 1 and basement'),
        p: ml(
          'Первая линия, витражное остекление первого этажа и парковка у входа — формат для шоурума или сервиса с клиентским потоком на автомобиле.',
          "Birinchi qator, birinchi qavatning vitrina oynalari va kiraverishdagi avtoturargoh — avtomobildagi mijozlar oqimiga ega shourum yoki servis uchun format.",
          'First line, floor-to-ceiling glazing on the ground floor and parking at the door — a format for a showroom or service business whose clients arrive by car.'
        )
      }
    ]
  };

  // ── экран 5: сценарии сделки (текст брифа дословно) ──
  cfg.scenarios = {
    h2: ml('Форматы сделки', 'Bitim formatlari', 'Deal scenarios'),
    cols: [
      {
        h: ml('Аренда', 'Ijara', 'Lease'),
        p: ml(
          'Помещения свободного назначения под офис, клинику, учебный центр или сервис. Условия обсуждаются по каждому лоту отдельно — площадь, срок, порядок входа.',
          "Ofis, klinika, o'quv markazi yoki xizmat ko'rsatish uchun erkin maqsadli maydonlar. Shartlar har bir lot bo'yicha alohida muhokama qilinadi — maydon, muddat, kirish tartibi.",
          'Flexible-use premises for offices, clinics, training centers or services. Terms are discussed per unit — area, duration, entry conditions.'
        )
      },
      {
        h: ml('Покупка', 'Sotib olish', 'Purchase'),
        p: ml(
          'Возможна покупка отдельного этажа или здания целиком.',
          'Alohida qavat yoki butun binoni sotib olish mumkin.',
          'Individual floors or the entire building are available for purchase.'
        )
      },
      {
        h: ml('Аренда с последующим выкупом', 'Ijara va keyinchalik sotib olish', 'Lease with option to buy'),
        p: ml(
          'Работаем и по комбинированной схеме: заходите как арендатор, решение о покупке принимаете позже. Условия структурируем под конкретную ситуацию — обсуждаем при встрече.',
          "Kombinatsiyalangan sxema bo'yicha ham ishlaymiz: avval ijarachi sifatida kirasiz, sotib olish qarorini keyinroq qabul qilasiz. Shartlarni aniq vaziyatga moslab tuzamiz.",
          'We also work on a combined basis: enter as a tenant, decide on purchase later. Terms are structured around your specific situation.'
        )
      }
    ]
  };

  // ── экран 6: о здании (только верифицированные параметры; высота потолков не
  //    верифицирована — строка появится, когда админ заполнит значение) ──
  cfg.about = {
    h2: ml('О здании', 'Bino haqida', 'The building'),
    sfbNote: ml(
      'Здание также известно как бизнес-центр SFB.',
      'Bino SFB biznes markazi nomi bilan ham tanilgan.',
      'The building is also known as the SFB business center.'
    ),
    status: ml(
      'Объект на финальной стадии — идут фасадные и отделочные работы. Осмотр возможен по договорённости.',
      "Obyekt yakuniy bosqichda — fasad va pardozlash ishlari olib borilmoqda. Ko'rikni kelishuv asosida tashkil etamiz.",
      'The building is in its final stage — facade and interior finishing works are underway. Site visits by arrangement.'
    ),
    specs: [
      { b: ml('Уровни', 'Darajalar', 'Levels'), s: ml('подвал + 4 этажа, лифт', 'podval + 4 qavat, lift', 'basement + 4 floors, lift') },
      { b: ml('GLA', 'GLA', 'GLA'), s: ml('1 882,9 м²', '1 882,9 m²', '1,882.9 m²') },
      { b: ml('Пятно этажа', 'Qavat maydoni', 'Floor plate'), s: ml('≈ 19,1 × 20,4 м', '≈ 19,1 × 20,4 m', '≈ 19.1 × 20.4 m') },
      { b: ml('Сетка колонн', 'Kolonna to’ri', 'Column grid'), s: ml('5 950 / 7 150 / 5 950 мм', '5 950 / 7 150 / 5 950 mm', '5,950 / 7,150 / 5,950 mm') },
      { b: ml('Высота потолков', 'Shift balandligi', 'Ceiling height'), s: ml('', '', '') },
      { b: ml('Паркинг', 'Avtoturargoh', 'Parking'), s: ml('12 машиномест: 6 подземных + 6 наземных', '12 joy: 6 yer osti + 6 yer usti', '12 spaces: 6 underground + 6 surface') }
    ],
    images: [
      { file: 'facade-evening.jpg' },
      { file: 'facade-angle.jpg' },
      { file: 'hero.jpg' }
    ]
  };

  // ── экран 7: локация (верифицированные координаты и времена в пути) ──
  cfg.location.lat = 41.338889;
  cfg.location.lng = 69.263403;
  cfg.location.address = ml(
    'ул. Тахтапул, 31, Шайхантахурский район, Ташкент',
    "Taxtapul ko'chasi 31, Shayxontohur tumani, Toshkent",
    '31 Taxtapul Street, Shaykhantahur district, Tashkent'
  );
  cfg.location.drive = [
    { to: ml('Tashkent City', 'Tashkent City', 'Tashkent City'), time: ml('~12 мин · 4,5 км', '~12 daqiqa · 4,5 km', '~12 min · 4.5 km') },
    { to: ml('Центр (сквер Амира Темура)', 'Markaz (Amir Temur xiyoboni)', 'City center (Amir Temur square)'), time: ml('~13 мин · 5,2 км', '~13 daqiqa · 5,2 km', '~13 min · 5.2 km') },
    { to: ml('Аэропорт им. Ислама Каримова', 'Islom Karimov nomidagi aeroport', 'Islam Karimov International Airport'), time: ml('~31 мин · 14,9 км', '~31 daqiqa · 14,9 km', '~31 min · 14.9 km') },
    { to: ml('Выезд на Малую кольцевую', 'Kichik halqa yo’liga chiqish', 'Small Ring Road access'), time: ml('рядом', 'yonida', 'adjacent') }
  ];
  cfg.location.metroNote = ml(
    'Для справки: метро «Гафур Гулям» — 25 мин пешком (1,8 км).',
    "Ma'lumot uchun: «G'afur G'ulom» metro bekati — piyoda 25 daqiqa (1,8 km).",
    'For reference: Gafur Gulom metro station — a 25-minute walk (1.8 km).'
  );
  cfg.location.around = ml(
    'Рядом — сложившийся медицинский кластер: Sinomed MD International Hospital, областной онкологический центр и республиканский медколледж (~1 км). В радиусе 1–2,5 км — мечеть Минор, парк Навруз, отели Crowne Plaza, AZIMUT и Radisson Blu.',
    "Yaqin atrofda shakllangan tibbiyot klasteri: Sinomed MD International Hospital, viloyat onkologiya markazi va respublika tibbiyot kolleji (~1 km). 1–2,5 km radiusda — Minor masjidi, Navro'z bog'i, Crowne Plaza, AZIMUT va Radisson Blu mehmonxonalari.",
    'Nearby is an established medical cluster: Sinomed MD International Hospital, the regional oncology center and the republican medical college (~1 km). Within 1–2.5 km — the Minor Mosque, Navruz Park, and the Crowne Plaza, AZIMUT and Radisson Blu hotels.'
  );

  // ── экран 8: FAQ (курировано: без даты сдачи и устаревшей «занятости») ──
  const keepQ = [];
  const old = cfg.faq || [];
  const take = (i) => { if (old[i]) keepQ.push(old[i]); };
  take(0); // какой бизнес можно разместить
  take(1); // цена по запросу
  take(2); // черновая отделка
  take(6); // парковка
  keepQ.push({
    q: ml('В какой стадии объект?', 'Obyekt qanday bosqichda?', 'What stage is the building at?'),
    a: cfg.about.status
  });
  keepQ.push({
    q: ml('Можно ли арендовать, а не покупать?', 'Sotib olmasdan ijaraga olish mumkinmi?', 'Can I lease instead of buying?'),
    a: ml(
      'Да. Помещения доступны в аренду, к покупке (отдельный этаж или здание целиком) и по комбинированной схеме — заходите как арендатор, решение о покупке принимаете позже.',
      "Ha. Maydonlar ijaraga, sotib olishga (alohida qavat yoki butun bino) va kombinatsiyalangan sxema bo'yicha taklif etiladi — avval ijarachi sifatida kirasiz, sotib olish qarorini keyinroq qabul qilasiz.",
      'Yes. The premises are available for lease, for purchase (an individual floor or the whole building) and on a combined basis — enter as a tenant and decide on purchase later.'
    )
  });
  keepQ.push({
    q: ml('Можно ли разделить этаж под свою планировку?', "Qavatni o'z planirovkangizga bo'lish mumkinmi?", 'Can a floor be subdivided to my layout?'),
    a: ml(
      'Да. Этажи открытой планировки: только колонны с сеткой 5 950 × 7 150 мм и лифтовое ядро. Перегородки проектируются под задачу арендатора.',
      "Ha. Qavatlar ochiq planirovkali: faqat 5 950 × 7 150 mm to'rli kolonnalar va lift yadrosi. To'siqlar ijarachining vazifasiga moslab loyihalanadi.",
      'Yes. The floors are open plan: columns on a 5,950 × 7,150 mm grid and the lift core only. Partitions are designed to the tenant’s brief.'
    )
  });
  cfg.faq = keepQ;

  // ── экран 9: форма ──
  cfg.enquiry = {
    note: ml('Ответим в течение дня', 'Kun davomida javob beramiz', 'We reply within the day')
  };

  // ── настройки интеграций (заполняются в панели; ключи не хардкодятся) ──
  cfg.settings = Object.assign({ mapsApiKey: '', metricaId: '', ga4Id: '', gtmId: '' }, cfg.settings || {});

  // ── футер: юр-текст без упоминания SFB (по брифу SFB — один раз, в «О здании») ──
  cfg.footer.legal = ml(
    'Информация на сайте носит справочный характер и не является публичной офертой. Визуализации — иллюстративные. © 2026 CASE Advisory',
    "Saytdagi ma'lumotlar ma'lumot xarakteriga ega va ommaviy oferta hisoblanmaydi. Vizualizatsiyalar — illyustrativ. © 2026 CASE Advisory",
    'Information on this site is for reference and does not constitute a public offer. Visualisations are illustrative. © 2026 CASE Advisory'
  );

  // ── SEO: публичный URL обязателен; title без SFB ──
  cfg.seo.publicUrl = cfg.seo.publicUrl || 'https://caseadvisory.uz/taxtapul';
  cfg.seo.title = ml(
    'Коммерческое здание Тахтапул, 31, Ташкент — аренда и продажа помещений',
    'Taxtapul 31 tijorat binosi, Toshkent — maydonlar ijarasi va sotuvi',
    'Commercial building at 31 Taxtapul St, Tashkent — offices for lease and sale'
  );
  cfg.seo.description = ml(
    'Отдельное коммерческое здание 1 882,9 м² GLA: 5 уровней open plan, лифт, паркинг 12 мест. Аренда, покупка или аренда с выкупом. Этажи 337–396 м². Условия — по запросу.',
    "Alohida tijorat binosi, 1 882,9 m² GLA: 5 daraja open plan, lift, 12 o'rinli avtoturargoh. Ijara, sotib olish yoki keyinchalik sotib olish bilan ijara. Qavatlar 337–396 m². Shartlar — so'rov bo'yicha.",
    'A standalone commercial building with 1,882.9 m² GLA: 5 open-plan levels, lift, 12 parking spaces. Lease, purchase or lease-to-own. Floor plates 337–396 m². Terms on request.'
  );

  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Миграция v2 применена:', FILE);
  console.log('Резервная копия:', BAK);
}

function down() {
  if (!fs.existsSync(BAK)) { console.error('Нет резервной копии', BAK); process.exit(1); }
  fs.copyFileSync(BAK, FILE);
  console.log('Откат к схеме v1 выполнен из', BAK);
}

const cmd = process.argv[2];
if (cmd === 'up') up();
else if (cmd === 'down') down();
else { console.log('Использование: node migrations/001-schema-v2.js up|down [slug]'); process.exit(1); }
