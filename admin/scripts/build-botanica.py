# -*- coding: utf-8 -*-
"""Конфиг лендинга: бизнес-центр Botanica, ул. Богишамол 151, Ташкент.

Все площади и отметки - с чертежей CASE (планы подвала, 1-го и типового
2-7 этажей, разрез 1-1). Итоги посчитаны из них же:
  GBA 485,7 + 485,7 + 6 x 527,0 = 4 133,4
  GLA 253,9 + 294,1 + 6 x 337,9 = 2 575,4
Высоты - расстояния между отметками перекрытий по разрезу, поэтому пишем
«высота этажа», а не «потолки в свету»: чистую высоту чертёж не даёт.
Цен и сроков нет (правила 1 и 2), класс B/B+ - формулировка владельца.
"""
import json, os

def ml(ru, uz, en): return {"ru": ru, "uz": uz, "en": en}

F_GBA, F_GLA = "527,0", "337,9"

def floor_unit(n, elev):
    return {
        "id": "f%d" % n,
        "level": ml("%d этаж" % n, "%d-qavat" % n, "Floor %d" % n),
        "gla": F_GLA, "gba": F_GBA, "ceil": "3,3",
        "plan": "plan-f27.jpg",
        "uses": ml("офисы, представительство, IT-компания",
                   "ofislar, vakolatxona, IT-kompaniya",
                   "offices, a representative office, an IT company"),
        "status": "available", "elev": elev
    }

CFG = {
  "slug": "botanica",
  "name": "Бизнес-центр Botanica (Богишамол 151)",
  "schemaVersion": 2,

  "site": {
    "code": "BOTANICA",
    "title": "Botanica Business Centre",
    "fileBase": "Botanica",
    "planBase": "Botanica",
    "favicon": "B",
    "assetType": "building",
    "intent": "both",
    "addr": {
      "headline": ml("Богишамол, 151 · Ташкент", "Bog'ishamol 151 · Toshkent", "151 Bogishamol St · Tashkent"),
      "street": ml("ул. Богишамол, 151", "Bog'ishamol ko'chasi, 151", "151 Bogishamol Street"),
      "locality": ml("Юнусабадский район", "Yunusobod tumani", "Yunusabad district"),
      "region": ml("Ташкент", "Toshkent", "Tashkent"),
      "streetLd": "Bog'ishamol ko'chasi 151", "localityLd": "Tashkent", "regionLd": "Yunusobod"
    },
    # палитра снята с логотипа: изумруд знака, золото букв, кремовый фон
    "theme": {"bg": "#f7f4ed", "ink": "#1c2a22", "muted": "#5f6b62",
              "accent": "#a3854c", "accentD": "#7f6634", "dark": "#1e362a"}
  },

  "brand": {"mark": "B", "logo": "",
            "name": ml("BOTANICA", "BOTANICA", "BOTANICA"),
            "tag": ml("Бизнес-центр на Богишамол", "Bog'ishamoldagi biznes-markaz", "Business centre on Bogishamol")},
  "contacts": {"phone": "+998 90 922 07 00", "telegram": "muhammadaxmadiy",
               "email": "caseadvisoryservicess@gmail.com", "sheetsEndpoint": "",
               "smtpHost": "", "smtpPort": "", "smtpUser": "", "smtpPass": ""},
  "adminUrl": "", "leadEndpoint": "",

  "texts": {
    "about.viz": ml("визуализация проекта", "loyiha vizualizatsiyasi", "project visualisation"),
    "about.vizAll": ml(
      "Изображения - визуализации проекта, планировки и разрез приведены по проектной документации.",
      "Tasvirlar - loyiha vizualizatsiyalari, planirovkalar va kesim loyiha hujjatlari bo'yicha keltirilgan.",
      "The images are project visualisations; the floor plans and the section are taken from the design documentation."),
    "legal.area": ml(
      "Площади и отметки приведены по проектной документации и подлежат уточнению по фактическим обмерам при вводе здания. Информация носит справочный характер и не является публичной офертой.",
      "Maydonlar va belgilar loyiha hujjatlari bo'yicha keltirilgan va bino topshirilganda haqiqiy o'lchovlar bo'yicha aniqlashtiriladi. Ma'lumot ma'lumot xarakteriga ega va ommaviy oferta hisoblanmaydi.",
      "Areas and levels are stated per the design documentation and will be confirmed by as-built measurements on completion. This information is for reference only and does not constitute a public offer.")
  },

  "seo": {
    "title": ml("Бизнес-центр Botanica на Богишамол 151 - аренда и продажа офисов в Ташкенте",
                "Bog'ishamol 151 dagi Botanica biznes-markazi - Toshkentda ofis ijarasi va sotuvi",
                "Botanica business centre at 151 Bogishamol - offices for lease and sale in Tashkent"),
    "description": ml(
      "Бизнес-центр класса B+ на улице Богишамол, 151, напротив Ботанического сада: 2 575,4 м² арендопригодной площади, подвал и 7 этажей, типовой этаж 337,9 м², высота этажа 3,3 м и 4,2 м на первом, лифт, свободная планировка. Аренда, покупка этажа или здания целиком, аренда с последующим выкупом.",
      "Bog'ishamol ko'chasi 151, Botanika bog'i ro'parasidagi B+ toifali biznes-markaz: 2 575,4 m² ijaraga yaroqli maydon, podval va 7 qavat, tipik qavat 337,9 m², qavat balandligi 3,3 m, birinchi qavatda 4,2 m, lift, erkin planirovka. Ijara, qavat yoki butun binoni sotib olish, keyinchalik sotib olish sharti bilan ijara.",
      "A class B+ business centre at 151 Bogishamol Street, opposite the Botanical Garden: 2,575.4 m² of leasable area, a basement and 7 floors, a 337.9 m² typical floor plate, 3.3 m floor height and 4.2 m on the ground floor, a lift and open-plan layouts. Available for lease, purchase of a floor or the whole building, and lease-to-own."),
    "keywords": ", ".join([
      "бизнес-центр Ташкент", "аренда офиса Ташкент", "аренда офиса Юнусабад",
      "офис класса B+ Ташкент", "продажа офиса Ташкент", "аренда этажа под офис Ташкент",
      "бизнес-центр Богишамол", "офис у Ботанического сада Ташкент",
      "аренда офиса Мирзо-Улугбек", "покупка этажа в бизнес-центре Ташкент",
      "офис open space Ташкент", "коммерческая недвижимость Юнусабад",
      "аренда с последующим выкупом офис Ташкент", "новый бизнес-центр Ташкент",
      "ofis ijarasi Toshkent", "biznes-markaz Toshkent", "Yunusobod ofis ijarasi",
      "office for rent Tashkent", "business centre Tashkent", "office space Yunusabad Tashkent",
      "class B office Tashkent", "office building for sale Tashkent"
    ]),
    "domain": "", "googleVerification": "", "yandexVerification": "",
    "publicUrl": "https://caseadvisory.uz/botanica"
  },

  "intro": {
    "image": "render-street.jpg",
    "focus": "50% 50%",
    "h1": ml("Бизнес-центр Botanica на Богишамол, 151",
             "Bog'ishamol 151 dagi Botanica biznes-markazi",
             "Botanica business centre at 151 Bogishamol"),
    "sub": ml("Класс B+, подвал и 7 этажей, типовой этаж 337,9 м². Аренда, покупка, аренда с выкупом",
              "B+ toifa, podval va 7 qavat, tipik qavat 337,9 m². Ijara, sotib olish, keyinchalik sotib olish",
              "Class B+, a basement and 7 floors, a 337.9 m² typical floor. Lease, purchase or lease-to-own"),
    "facts": [
      {"n": ml("2 575,4", "2 575,4", "2,575.4"), "l": ml("м² арендопригодной площади (GLA)", "m² ijaraga yaroqli maydon (GLA)", "m² of leasable area (GLA)")},
      {"n": ml("4 133,4", "4 133,4", "4,133.4"), "l": ml("м² общей площади (GBA)", "m² umumiy maydon (GBA)", "m² of gross area (GBA)")},
      {"n": "8", "l": ml("уровней: подвал и 7 этажей", "daraja: podval va 7 qavat", "levels: basement and 7 floors")},
      {"n": ml("337,9", "337,9", "337.9"), "l": ml("м² типовой этаж", "m² tipik qavat", "m² typical floor plate")}
    ]
  },

  "params": [
    {"n": ml("2 575,4", "2 575,4", "2,575.4"), "l": ml("м² GLA", "m² GLA", "m² GLA")},
    {"n": ml("4 133,4", "4 133,4", "4,133.4"), "l": ml("м² GBA", "m² GBA", "m² GBA")},
    {"n": "7", "l": ml("этажей и подвал", "qavat va podval", "floors plus basement")},
    {"n": ml("3,3-4,2", "3,3-4,2", "3.3-4.2"), "l": ml("м высота этажа", "m qavat balandligi", "m floor height")},
    {"n": "", "l": ml("Лифт и две лестницы", "Lift va ikkita zinapoya", "A lift and two staircases")}
  ],

  "unitsSection": {
    "h2": ml("Помещения", "Maydonlar", "Premises"),
    "note": ml(
      "Этажи со свободной планировкой: сетка колонн 5-5-6-5-5 на 6-6-6 м, габарит здания 26 x 18 м. Санузлы на каждом этаже, лифт и две лестницы, включая наружную эвакуационную.",
      "Erkin planirovkali qavatlar: kolonnalar to'ri 5-5-6-5-5 ga 6-6-6 m, bino gabariti 26 x 18 m. Har bir qavatda hojatxonalar, lift va ikkita zinapoya, shu jumladan tashqi evakuatsiya zinapoyasi.",
      "Open-plan floors on a 5-5-6-5-5 by 6-6-6 m column grid, with a 26 x 18 m building footprint. Restrooms on every floor, a lift and two staircases including an external escape stair.")
  },

  "units": [
    {"id": "b", "level": ml("Подвал", "Podval", "Basement"), "gla": "253,9", "gba": "485,7", "ceil": "3,6",
     "plan": "plan-b.jpg", "elev": "-3.600",
     "uses": ml("склад, архив, техническая зона, спортзал",
                "ombor, arxiv, texnik zona, sport zali",
                "storage, archive, plant rooms, a gym"),
     "status": "available"},
    {"id": "f1", "level": ml("1 этаж", "1-qavat", "Ground floor"), "gla": "294,1", "gba": "485,7", "ceil": "4,2",
     "plan": "plan-f1.jpg", "elev": "0.000",
     "uses": ml("банк, аптека, кофейня, клиентский офис, шоурум",
                "bank, dorixona, qahvaxona, mijozlar ofisi, shou-rum",
                "a bank, pharmacy, coffee shop, client office or showroom"),
     "status": "available"},
  ] + [floor_unit(n, e) for n, e in [(2, "+4.200"), (3, "+7.800"), (4, "+11.400"),
                                     (5, "+15.000"), (6, "+18.600"), (7, "+22.200")]] + [
    {"id": "all", "whole": True, "level": ml("Здание целиком", "Bino to'liq", "The whole building"),
     "gla": "2 575,4", "gba": "4 133,4", "ceil": "",
     "uses": ml("штаб-квартира компании, ведомство, медицинский центр",
                "kompaniya bosh qarorgohi, idora, tibbiyot markazi",
                "a corporate headquarters, an agency or a medical centre"),
     "status": "available"}
  ],

  "useCases": {
    "h2": ml("Кому подходит здание", "Bino kimga mos keladi", "Who the building suits"),
    "cards": [
      {"icon": "office",
       "h": ml("Компания на один этаж", "Bir qavatlik kompaniya", "A company on one floor"),
       "levels": ml("337,9 м², этажи 2-7", "337,9 m², 2-7-qavatlar", "337.9 m², floors 2 to 7"),
       "p": ml("Типовой этаж без внутренних несущих стен: планировка собирается под структуру компании, от кабинетной до открытой. Санузлы и лифтовой холл на этаже, вход общий.",
               "Ichki ko'taruvchi devorlarsiz tipik qavat: planirovka kompaniya tuzilmasiga moslanadi. Qavatda hojatxonalar va lift xolli, kirish umumiy.",
               "A typical floor with no internal load-bearing walls: the layout follows the company structure, from cellular to open plan. Restrooms and a lift lobby on the floor.")},
      {"icon": "clinic",
       "h": ml("Первый этаж под поток", "Birinchi qavat oqim uchun", "Ground floor for footfall"),
       "levels": ml("294,1 м², высота 4,2 м", "294,1 m², balandligi 4,2 m", "294.1 m², 4.2 m height"),
       "p": ml("Отдельный вход с улицы и высота этажа 4,2 метра: банк, аптека, кофейня или клиентский офис, который работает и на арендаторов здания, и на прохожих.",
               "Ko'chadan alohida kirish va 4,2 metr qavat balandligi: bank, dorixona, qahvaxona yoki mijozlar ofisi.",
               "A separate street entrance and 4.2 m floor height: a bank, pharmacy, coffee shop or client office serving both the building's tenants and passers-by.")},
      {"icon": "school",
       "h": ml("Здание целиком", "Bino to'liq", "The whole building"),
       "levels": ml("2 575,4 м² GLA", "2 575,4 m² GLA", "2,575.4 m² GLA"),
       "p": ml("Восемь уровней под одну организацию: штаб-квартира, ведомство или медицинский центр с собственным входом, своей вывеской и полным контролем над зданием.",
               "Sakkiz daraja bitta tashkilot uchun: bosh qarorgoh, idora yoki o'z kirishiga ega tibbiyot markazi.",
               "Eight levels for a single organisation: a headquarters, a government body or a medical centre with its own entrance, signage and full control of the building.")},
      {"icon": "office",
       "h": ml("Инвестор", "Investor", "An investor"),
       "levels": ml("покупка этажа или здания", "qavat yoki binoni sotib olish", "buy a floor or the building"),
       "p": ml("Здание проектируется под сдачу в аренду: типовые этажи одинаковой площади продаются и поэтажно, и целиком, с последующей сдачей арендаторам.",
               "Bino ijaraga berish uchun loyihalanmoqda: bir xil maydonli tipik qavatlar qavatma-qavat ham, to'liq ham sotiladi.",
               "The building is designed for leasing: identical typical floors can be bought floor by floor or as a whole and then let to tenants.")}
    ]
  },

  "scenarios": {
    "h2": ml("Формат сделки", "Bitim formati", "Deal structure"),
    "cols": [
      {"h": ml("Аренда", "Ijara", "Lease"),
       "p": ml("Этаж целиком или несколько этажей. Ставка и условия обсуждаются индивидуально: оставьте контакты, и мы вышлем предложение.",
               "Qavat to'liq yoki bir nechta qavat. Narx va shartlar alohida muhokama qilinadi.",
               "A whole floor or several floors. Rent and terms are discussed individually.")},
      {"h": ml("Покупка", "Sotib olish", "Purchase"),
       "p": ml("Покупка отдельного этажа или здания целиком. Порядок оформления и график платежей обсуждаются под конкретную сделку.",
               "Alohida qavatni yoki butun binoni sotib olish. Rasmiylashtirish tartibi va to'lov jadvali alohida muhokama qilinadi.",
               "Purchase of a single floor or the entire building. Documentation and the payment schedule are agreed deal by deal.")},
      {"h": ml("Аренда с последующим выкупом", "Keyinchalik sotib olish sharti bilan ijara", "Lease with option to buy"),
       "p": ml("Арендатор заходит в помещение и выкупает его позже, часть платежей засчитывается в стоимость. Условия фиксируются в договоре.",
               "Ijarachi maydonga kiradi va keyinroq uni sotib oladi, to'lovlarning bir qismi narxga hisoblanadi.",
               "A tenant moves in and buys the space later, with part of the payments credited against the price.")}
    ]
  },

  "about": {
    "h2": ml("О здании", "Bino haqida", "About the building"),
    "sfbNote": ml("", "", ""),
    "status": ml("Здание проектируется. Проектная документация и планировки доступны по запросу, бронирование этажей уже открыто.",
                 "Bino loyihalanmoqda. Loyiha hujjatlari va planirovkalar so'rov bo'yicha, qavatlarni bron qilish allaqachon ochiq.",
                 "The building is at design stage. The design documentation and floor plans are available on request, and floors can already be reserved."),
    "specs": [
      {"b": ml("Класс", "Toifa", "Class"), "s": ml("B+ (проектируемый)", "B+ (loyihalanayotgan)", "B+ (as designed)")},
      {"b": ml("Общая площадь (GBA)", "Umumiy maydon (GBA)", "Gross area (GBA)"), "s": ml("4 133,4 м²", "4 133,4 m²", "4,133.4 m²")},
      {"b": ml("Арендопригодная площадь (GLA)", "Ijaraga yaroqli maydon (GLA)", "Leasable area (GLA)"), "s": ml("2 575,4 м²", "2 575,4 m²", "2,575.4 m²")},
      {"b": ml("Уровни", "Darajalar", "Levels"), "s": ml("подвал и 7 этажей", "podval va 7 qavat", "a basement and 7 floors")},
      {"b": ml("Типовой этаж", "Tipik qavat", "Typical floor"), "s": ml("GBA 527,0 м², GLA 337,9 м² (этажи 2-7)", "GBA 527,0 m², GLA 337,9 m² (2-7-qavatlar)", "GBA 527.0 m², GLA 337.9 m² (floors 2 to 7)")},
      {"b": ml("Высота этажа", "Qavat balandligi", "Floor height"), "s": ml("4,2 м на первом, 3,3 м на 2-7, 3,6 м в подвале", "birinchi qavatda 4,2 m, 2-7 da 3,3 m, podvalda 3,6 m", "4.2 m on the ground floor, 3.3 m on floors 2 to 7, 3.6 m in the basement")},
      {"b": ml("Сетка колонн", "Kolonnalar to'ri", "Column grid"), "s": ml("5-5-6-5-5 на 6-6-6 м, габарит 26 x 18 м", "5-5-6-5-5 ga 6-6-6 m, gabarit 26 x 18 m", "5-5-6-5-5 by 6-6-6 m, 26 x 18 m footprint")},
      {"b": ml("Вертикальная связь", "Vertikal aloqa", "Vertical circulation"), "s": ml("лифт и две лестницы, включая наружную эвакуационную", "lift va ikkita zinapoya, tashqi evakuatsiya zinapoyasi bilan", "a lift and two staircases, including an external escape stair")},
      {"b": ml("Высота здания", "Bino balandligi", "Building height"), "s": ml("до +26,700 м, лифтовая надстройка до +30,950 м", "+26,700 m gacha, lift ustqurmasi +30,950 m gacha", "up to +26.700 m, lift overrun to +30.950 m")},
      {"b": ml("Локация", "Joylashuvi", "Location"), "s": ml("ул. Богишамол, 151, напротив Ботанического сада", "Bog'ishamol ko'chasi 151, Botanika bog'i ro'parasida", "151 Bogishamol Street, opposite the Botanical Garden")}
    ],
    "images": [
      {"file": "section.jpg",
       "badge": ml("разрез 1-1", "1-1 kesim", "section 1-1"),
       "alt": ml("Разрез 1-1 бизнес-центра Botanica: отметки этажей от -3,600 до +25,800",
                 "Botanica biznes-markazining 1-1 kesimi: qavat belgilari -3,600 dan +25,800 gacha",
                 "Section 1-1 of the Botanica business centre with floor levels from -3.600 to +25.800")},
      {"file": "render-corner.jpg",
       "alt": ml("Бизнес-центр Botanica на Богишамол, угловой ракурс со стеклянным фасадом",
                 "Bog'ishamoldagi Botanica biznes-markazi, shisha fasadli burchak ko'rinish",
                 "The Botanica business centre on Bogishamol, corner view with its glazed facade")},
      {"file": "render-aerial.jpg",
       "alt": ml("Бизнес-центр Botanica с высоты: парковка у входа и первая линия улицы",
                 "Botanica biznes-markazi yuqoridan: kiraverishdagi avtoturargoh va ko'chaning birinchi qatori",
                 "The Botanica business centre from above: parking at the entrance and the street frontage")}
    ]
  },

  "location": {
    "h2": ml("Богишамол, напротив Ботанического сада", "Bog'ishamol, Botanika bog'i ro'parasida", "Bogishamol, opposite the Botanical Garden"),
    "sub": ml("", "", ""),
    "address": ml("Ташкент, Юнусабадский район, ул. Богишамол, 151",
                  "Toshkent, Yunusobod tumani, Bog'ishamol ko'chasi, 151",
                  "Tashkent, Yunusabad district, 151 Bogishamol Street"),
    "addressNote": ml("", "", ""),
    "city": ml("Ташкент", "Toshkent", "Tashkent"),
    "lat": "41.348614", "lng": "69.316418",
    "pois": [],
    "drive": [],
    "metroNote": ml("", "", ""),
    "around": ml(
      "Здание выходит на улицу Богишамол напротив Ботанического сада. Вокруг сложившийся жилой массив Юнусабада: в пятнадцати минутах пешком живёт около 8 800 человек, а в двадцати - почти 18 000. Ближайшие махаллинские центры - Богибустон, Отчопар-2 и Обод.",
      "Bino Botanika bog'i ro'parasida Bog'ishamol ko'chasiga chiqadi. Atrofda Yunusobodning shakllangan turar-joy massivi: piyoda o'n besh daqiqada 8 800 ga yaqin, yigirma daqiqada esa deyarli 18 000 kishi yashaydi. Eng yaqin mahalla markazlari - Bog'ibo'ston, Otchopar-2 va Obod.",
      "The building fronts Bogishamol Street opposite the Botanical Garden, inside an established residential part of Yunusabad: about 8,800 people live within a fifteen-minute walk and almost 18,000 within twenty. The nearest mahalla centres are Bogibuston, Otchopar-2 and Obod.")
  },

  "faq": [
    {"q": ml("На какой стадии здание?", "Bino qaysi bosqichda?", "What stage is the building at?"),
     "a": ml("Здание проектируется. Планировки, разрез и параметры конструктива уже определены и приведены на странице, полный комплект проектной документации высылаем по запросу. Бронирование этажей открыто.",
             "Bino loyihalanmoqda. Planirovkalar, kesim va konstruktiv parametrlar aniqlangan va sahifada keltirilgan, loyiha hujjatlarining to'liq to'plamini so'rov bo'yicha yuboramiz. Qavatlarni bron qilish ochiq.",
             "The building is at design stage. The layouts, section and structural parameters are already defined and shown on this page; the full design documentation is sent on request. Floors can be reserved now.")},
    {"q": ml("Можно ли купить один этаж?", "Bitta qavatni sotib olish mumkinmi?", "Can we buy a single floor?"),
     "a": ml("Да. Этажи со 2-го по 7-й одинаковы по площади - GLA 337,9 м² каждый, и продаются как поэтажно, так и целиком. Возможна аренда и аренда с последующим выкупом.",
             "Ha. 2-dan 7-gacha qavatlar maydoni bo'yicha bir xil - har biri GLA 337,9 m², qavatma-qavat ham, to'liq ham sotiladi. Ijara va keyinchalik sotib olish sharti bilan ijara ham mumkin.",
             "Yes. Floors 2 to 7 are identical at 337.9 m² GLA each and can be bought floor by floor or as a whole. Lease and lease-to-own are also available.")},
    {"q": ml("Какая планировка на этажах?", "Qavatlarda qanday planirovka?", "What are the floor layouts like?"),
     "a": ml("Свободная. Внутренних несущих стен нет, только колонны по сетке 5-5-6-5-5 на 6-6-6 метров, поэтому этаж собирается и в кабинеты, и в открытое пространство. Санузлы и лифтовой холл вынесены в ядро.",
             "Erkin. Ichki ko'taruvchi devorlar yo'q, faqat 5-5-6-5-5 ga 6-6-6 metr to'rdagi kolonnalar, shuning uchun qavatni kabinetlarga ham, ochiq maydonga ham bo'lish mumkin.",
             "Open plan. There are no internal load-bearing walls, only columns on a 5-5-6-5-5 by 6-6-6 m grid, so a floor can be fitted out as cellular offices or as open space. Restrooms and the lift lobby sit in the core.")},
    {"q": ml("Что с высотой потолков?", "Shift balandligi qanday?", "What about ceiling heights?"),
     "a": ml("По разрезу высота этажа - 4,2 метра на первом, 3,3 метра на этажах со 2-го по 7-й и 3,6 метра в подвале. Это расстояние между отметками перекрытий; чистая высота в помещении будет меньше на толщину конструкции и подвесного потолка.",
             "Kesim bo'yicha qavat balandligi - birinchi qavatda 4,2 metr, 2-7-qavatlarda 3,3 metr, podvalda 3,6 metr. Bu qoplamalar belgilari orasidagi masofa; xonadagi toza balandlik konstruksiya va osma shift qalinligiga kamroq bo'ladi.",
             "Per the section, the floor-to-floor height is 4.2 m on the ground floor, 3.3 m on floors 2 to 7 and 3.6 m in the basement. That is the distance between slab levels; the clear height in the space will be lower by the slab and suspended ceiling.")},
    {"q": ml("Что находится вокруг?", "Atrofda nima bor?", "What is around the building?"),
     "a": ml("Улица Богишамол напротив Ботанического сада, сложившийся жилой массив Юнусабада. В радиусе полутора километров наша геобаза насчитывает 14 медицинских учреждений, 5 аптек и 4 махаллинских центра, а население в пятнадцати минутах пешком - около 8 800 человек. Подробности в блоке «Локация в цифрах».",
             "Botanika bog'i ro'parasidagi Bog'ishamol ko'chasi, Yunusobodning shakllangan turar-joy massivi. Bir yarim kilometr radiusda geobazamiz 14 ta tibbiyot muassasasi, 5 ta dorixona va 4 ta mahalla markazini hisoblaydi, piyoda o'n besh daqiqadagi aholi esa 8 800 ga yaqin.",
             "Bogishamol Street opposite the Botanical Garden, within an established residential area of Yunusabad. Within 1.5 km our geo database counts 14 medical facilities, 5 pharmacies and 4 mahalla centres, and about 8,800 people live within a fifteen-minute walk.")},
    {"q": ml("Какая цена?", "Narxi qancha?", "What is the price?"),
     "a": ml("Ставка аренды и стоимость покупки обсуждаются индивидуально и зависят от площади, этажа и формата сделки. Оставьте контакты, и мы вышлем коммерческое предложение с планировками.",
             "Ijara narxi va sotib olish qiymati alohida muhokama qilinadi hamda maydon, qavat va bitim formatiga bog'liq. Kontaktlaringizni qoldiring, planirovkalar bilan tijorat taklifini yuboramiz.",
             "Rent and purchase price are discussed individually and depend on the area, the floor and the deal format. Leave your contacts and we will send a proposal with the floor plans.")}
  ],

  "lead": {
    "h2": ml("Забронировать этаж или запросить документы", "Qavatni bron qilish yoki hujjatlarni so'rash", "Reserve a floor or request the documents"),
    "sub": ml("Оставьте контакты - вышлем планировки, проектные параметры и условия по вашему формату.",
              "Kontaktlaringizni qoldiring - planirovkalar, loyiha parametrlari va formatingiz bo'yicha shartlarni yuboramiz.",
              "Leave your contacts and we will send the floor plans, design parameters and terms for your format.")
  },
  "enquiry": {"note": ml("Ответим в течение дня", "Kun davomida javob beramiz", "We reply within the day")},

  "footer": {
    "addr": ml("Ташкент, Юнусабадский район, ул. Богишамол, 151",
               "Toshkent, Yunusobod tumani, Bog'ishamol ko'chasi, 151",
               "Tashkent, Yunusabad district, 151 Bogishamol Street"),
    "legal": ml(
      "CASE Real Estate Advisory выступает агентом собственника по коммерциализации проекта. Информация на сайте носит справочный характер и не является публичной офертой. © 2026 CASE Advisory",
      "CASE Real Estate Advisory loyihani tijoratlashtirish bo'yicha mulkdor agenti sifatida ish yuritadi. Saytdagi ma'lumotlar ma'lumot xarakteriga ega va ommaviy oferta hisoblanmaydi. © 2026 CASE Advisory",
      "CASE Real Estate Advisory acts as the owner's agent for the commercialisation of the project. Information on this site is for reference only and does not constitute a public offer. © 2026 CASE Advisory")
  },

  "settings": {"mapsApiKey": "", "metricaId": "", "ga4Id": "", "gtmId": ""},

  "pres": {
    "elev": {"b": "-3.600", "f1": "±0.000", "f2": "+4.200", "f3": "+7.800", "f4": "+11.400",
             "f5": "+15.000", "f6": "+18.600", "f7": "+22.200"},
    "plans": {"b": "plan-b.jpg", "f1": "plan-f1.jpg", "f2": "plan-f27.jpg", "f3": "plan-f27.jpg",
              "f4": "plan-f27.jpg", "f5": "plan-f27.jpg", "f6": "plan-f27.jpg", "f7": "plan-f27.jpg"},
    "planPages": [{"id": "b"}, {"id": "f1"}, {"id": "f2", "title": "f27_title"}],
    "aboutImg": "render-corner.jpg",
    "vizImgs": ["render-aerial.jpg", "section.jpg"],
    "T": {
      "addr": ml("Богишамол 151 · Ташкент", "Bog'ishamol 151 · Toshkent", "151 Bogishamol St · Tashkent"),
      "h_about": ml("Бизнес-центр класса B+ со свободной планировкой",
                    "Erkin planirovkali B+ toifali biznes-markaz",
                    "A class B+ business centre with open-plan floors"),
      "card_lvl_n": ml("8 уровней", "8 daraja", "8 levels"),
      "card_lvl_s": ml("подвал + 7 этажей, лифт", "podval + 7 qavat, lift", "basement + 7 floors, lift"),
      "card_park_n": ml("26 x 18 м", "26 x 18 m", "26 x 18 m"),
      "card_park_s": ml("габарит здания, сетка колонн 5-5-6-5-5 на 6-6-6 м",
                        "bino gabariti, kolonnalar to'ri 5-5-6-5-5 ga 6-6-6 m",
                        "footprint, column grid 5-5-6-5-5 by 6-6-6 m"),
      "h_units": ml("Восемь уровней - от этажа до здания целиком",
                    "Sakkiz daraja - qavatdan butun binogacha",
                    "Eight levels - from one floor to the whole building"),
      "f27_title": ml("Этажи 2-7 (типовой)", "2-7-qavatlar (tipik)", "Floors 2 to 7 (typical)"),
      "th_ceil": ml("Высота этажа", "Qavat balandligi", "Floor height"),
      "plan_ceil": ml("Высота этажа", "Qavat balandligi", "Floor height"),
      "plan_note": ml(
        "План по проектной документации. Свободная планировка: колонны 5-5-6-5-5 на 6-6-6 мм, санузлы и лифтовой холл в ядре.",
        "Loyiha hujjatlari bo'yicha reja. Erkin planirovka: 5-5-6-5-5 ga 6-6-6 kolonnalar, hojatxonalar va lift xolli yadroda.",
        "Plan per the design documentation. Open plan with columns on a 5-5-6-5-5 by 6-6-6 grid; restrooms and lift lobby in the core."),
      "h_viz": ml("Внешний облик и разрез", "Tashqi ko'rinish va kesim", "Exterior and section"),
      "viz_p": ml(
        "Стеклянный фасад с бронзовыми пилонами, первый этаж высотой 4,2 метра под клиентские функции, входная группа с площадкой. Разрез показывает восемь уровней: подвал на отметке -3,600 и семь этажей до +25,800.",
        "Bronza pilonli shisha fasad, mijozlar uchun 4,2 metr balandlikdagi birinchi qavat, maydonchali kirish guruhi. Kesim sakkiz darajani ko'rsatadi: -3,600 belgidagi podval va +25,800 gacha yetti qavat.",
        "A glazed facade with bronze piers, a 4.2 m ground floor for client-facing uses and an entrance forecourt. The section shows eight levels: a basement at -3.600 and seven floors up to +25.800."),
      "c_h": ml("Обсудим этаж?", "Qavatni muhokama qilamizmi?", "Shall we discuss a floor?"),
      "c_s": ml("Ответим в течение дня - планировки, параметры, условия сделки.",
                "Kun davomida javob beramiz - planirovkalar, parametrlar, bitim shartlari.",
                "We reply within the day - plans, parameters and deal terms.")
    }
  }
}

OUT = '/home/user/case-site/admin/data/projects/botanica/project.json'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(CFG, f, ensure_ascii=False, indent=2)
gla = 253.9 + 294.1 + 6 * 337.9
gba = 485.7 + 485.7 + 6 * 527.0
print('конфиг записан:', OUT)
print('сверка итогов: GLA %.1f, GBA %.1f' % (gla, gba))
