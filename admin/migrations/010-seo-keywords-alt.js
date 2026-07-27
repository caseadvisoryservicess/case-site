/**
 * Правка 010: SEO без обмана поисковиков.
 *
 * Скрытый текст с ключевыми словами делать нельзя: это спам-политика Google
 * и Яндекса, наказание - ручные санкции на весь домен. Поэтому работаем
 * только легальными местами, которые посетитель не видит, а робот читает:
 *
 *  1. seo.keywords - расширенный список запросов (тег почти не учитывается,
 *     но вреда нет и владелец просил);
 *  2. alt-подписи картинок в галерее «О здании» - раньше все три получали
 *     один и тот же заголовок страницы, теперь у каждой свой осмысленный
 *     текст с назначением помещений и районом. Это официально учитывается
 *     и одновременно нужно для доступности;
 *  3. seo.description - переписан под поисковый запрос, с площадями,
 *     потолками и форматами сделки; это влияет на кликабельность в выдаче.
 *
 * Работает для обоих проектов, набор строк выбирается по слагу.
 * Идемпотентна: повторный запуск ничего не меняет.
 *
 * Запуск: node migrations/010-seo-keywords-alt.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2'); process.exit(1); }

const ml = (ru, uz, en) => ({ ru, uz, en });

const DATA = {
  takhtapul: {
    keywords: [
      'аренда офиса Ташкент', 'аренда помещения Ташкент', 'продажа коммерческой недвижимости Ташкент',
      'аренда здания целиком Ташкент', 'помещение под клинику Ташкент', 'помещение под медцентр Ташкент',
      'помещение под учебный центр Ташкент', 'аренда с последующим выкупом Ташкент',
      'офис Шайхантахурский район', 'коммерческая недвижимость Шайхантахур',
      'помещение свободного назначения Ташкент', 'аренда этажа под офис', 'бизнес центр Тахтапул',
      'здание TAXTAPUL', 'Тахтапул 31', 'open space офис Ташкент',
      'ofis ijarasi Toshkent', 'bino ijaraga berish Toshkent', 'tijorat ko\'chmas mulki Toshkent',
      'klinika uchun bino', 'office for rent Tashkent', 'commercial building for sale Tashkent'
    ].join(', '),
    desc: ml(
      'Отдельно стоящее коммерческое здание в Шайхантахурском районе: 1 855,0 м² арендопригодной площади, 5 уровней со свободной планировкой, потолки до 4,0 м, лифт, паркинг. Этажи от 359 до 382 м². Аренда, покупка или аренда с последующим выкупом.',
      'Shayxontohur tumanidagi alohida tijorat binosi: 1 855,0 m² ijaraga yaroqli maydon, erkin planirovkali 5 daraja, shift balandligi 4,0 m gacha, lift, avtoturargoh. Qavatlar 359 dan 382 m² gacha. Ijara, sotib olish yoki keyinchalik sotib olish sharti bilan ijara.',
      'A standalone commercial building in Shaykhantahur district: 1,855.0 m² of leasable area, 5 open-plan levels, ceilings up to 4.0 m, lift and parking. Floor plates from 359 to 382 m². Available for lease, purchase or lease-to-own.'),
    alts: [
      ml('Коммерческое здание Тахтапул 31 в Ташкенте, вид с высоты ночью',
         'Toshkentdagi Taxtapul 31 tijorat binosi, tunda yuqoridan ko\'rinish',
         'Taxtapul 31 commercial building in Tashkent, aerial night view'),
      ml('Фасад здания Тахтапул 31 с витражным остеклением, вечерняя подсветка',
         'Taxtapul 31 binosi fasadi, vitraj oynalar va kechki yoritish',
         'Facade of Taxtapul 31 with floor-to-ceiling glazing and evening lighting'),
      ml('Коммерческое здание под офис, клинику или учебный центр в Шайхантахурском районе Ташкента',
         'Toshkent Shayxontohur tumanida ofis, klinika yoki o\'quv markazi uchun tijorat binosi',
         'Commercial building for an office, clinic or training center in Shaykhantahur district, Tashkent')
    ]
  },
  galaba: {
    keywords: [
      'аренда помещения Ташкент', 'аренда офиса Алмазарский район', 'коммерческая недвижимость Алмазар',
      'помещение под клинику Ташкент', 'помещение под медцентр Алмазарский район',
      'аренда под учебный центр Ташкент', 'аренда этажа целиком Ташкент',
      'помещение свободного назначения Ташкент', 'аренда с последующим выкупом Ташкент',
      'продажа коммерческого помещения Ташкент', 'аренда Каракамыш', 'помещение у парка Победы Ташкент',
      'аренда помещения Гузальбог', 'здание Галаба Ташкент', 'первый этаж под аптеку Ташкент',
      'помещение под кафе Ташкент', 'open space этаж Ташкент',
      'ofis ijarasi Toshkent', 'Olmazor tumani ijara', 'tijorat ko\'chmas mulki Olmazor',
      'klinika uchun maydon Toshkent', 'o\'quv markazi uchun bino',
      'office for rent Tashkent', 'commercial premises Olmazor Tashkent'
    ].join(', '),
    desc: ml(
      'Новое коммерческое здание в Алмазарском районе у парка Победы: 1 436,5 м² под аренду, этажи с 3-го по 5-й свободны целиком по 330,1 м², потолки 4,05 м на первом этаже и 3,60 м выше, лифт, эксплуатируемая терраса, парковка на 35-40 мест. Аренда, покупка или аренда с последующим выкупом.',
      'Olmazor tumanida, G\'alaba bog\'i yonida yangi tijorat binosi: ijaraga 1 436,5 m², 3-5-qavatlar to\'liq bo\'sh, har biri 330,1 m², birinchi qavatda shift 4,05 m va yuqorida 3,60 m, lift, foydalaniladigan terrassa, 35-40 o\'rinli avtoturargoh. Ijara, sotib olish yoki keyinchalik sotib olish sharti bilan ijara.',
      'A new commercial building in Olmazor district by Victory Park: 1,436.5 m² available, floors 3 to 5 entirely free at 330.1 m² each, 4.05 m ceilings on the ground floor and 3.60 m above, a lift, a rooftop terrace and parking for 35 to 40 cars. Available for lease, purchase or lease-to-own.'),
    alts: [
      ml('Коммерческое здание Галаба в Ташкенте, белый фасад с латунной сеткой и арочным стилобатом',
         'Toshkentdagi G\'alaba tijorat binosi, latun to\'rli oq fasad va arkali stilobat',
         'Galaba commercial building in Tashkent, white facade with brass mesh and an arcaded stylobate'),
      ml('Здание под клинику, офис или учебный центр в Алмазарском районе Ташкента, у парка Победы',
         'Toshkent Olmazor tumanida, G\'alaba bog\'i yonida klinika, ofis yoki o\'quv markazi uchun bino',
         'A building for a clinic, office or training center in Olmazor district, Tashkent, by Victory Park'),
      ml('Первый этаж с витринами на первой линии и арками стилобата, помещение под аптеку или кафе',
         'Birinchi qatorda vitrinali birinchi qavat va stilobat arklari, dorixona yoki kafe uchun maydon',
         'Ground floor with street-front shopfronts and stylobate arches, suitable for a pharmacy or cafe')
    ]
  }
};

const D = DATA[slug];
if (!D) { console.error('Нет набора строк для проекта:', slug); process.exit(1); }

let changes = 0;

// 1) ключевые слова
if (cfg.seo.keywords !== D.keywords) {
  cfg.seo.keywords = D.keywords; changes++;
  console.log('✓ ключевые слова обновлены:', D.keywords.split(', ').length, 'запросов');
}

// 2) описание для выдачи
if (JSON.stringify(cfg.seo.description) !== JSON.stringify(D.desc)) {
  cfg.seo.description = D.desc; changes++;
  console.log('✓ описание страницы переписано под поисковый запрос');
}

// 3) подписи картинок в галерее «О здании»
const imgs = (cfg.about && cfg.about.images) || [];
imgs.forEach((g, i) => {
  const want = D.alts[i];
  if (want && JSON.stringify(g.alt) !== JSON.stringify(want)) {
    g.alt = want; changes++;
    console.log('✓ подпись картинки', i + 1, '->', want.ru.slice(0, 52) + '...');
  }
});

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
