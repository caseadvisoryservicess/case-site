# -*- coding: utf-8 -*-
"""Конфиг лендинга: готовый ресторан при отеле Mercure, Ташкент.

Все цифры - с плана CASE (GBA 303,8 / GLA 279,7 / терраса 47,7) и с фотографий
объекта. Чего нет в исходниках, на страницу не попадает (правило 3): посадка,
потолки, электрическая мощность, точный адрес - ждут владельца.
Ставка не публикуется (правило 2), только «по запросу».
Формат сделки - исключительно аренда, поэтому intent = none.
"""
import json, os

def ml(ru, uz, en): return {"ru": ru, "uz": uz, "en": en}

CFG = {
  "slug": "mercure-restaurant",
  "name": "Ресторан при отеле Mercure (аренда)",
  "schemaVersion": 2,

  "site": {
    "code": "RESTAURANT",
    "title": "Restaurant space at Mercure Tashkent",
    "fileBase": "Restaurant-Mercure",
    "planBase": "Restaurant-Mercure",
    "favicon": "R",
    "assetType": "single",   # одно готовое помещение: таблицы уровней нет
    "intent": "none",        # только аренда
    "addr": {
      "headline": ml("Центр Ташкента · отель Mercure", "Toshkent markazi · Mercure mehmonxonasi", "Central Tashkent · Mercure hotel"),
      "street": ml("здание отеля Mercure", "Mercure mehmonxonasi binosi", "the Mercure hotel building"),
      "locality": ml("Ташкент", "Toshkent", "Tashkent"),
      "region": ml("Ташкент", "Toshkent", "Tashkent"),
      "streetLd": "", "localityLd": "Tashkent", "regionLd": "Toshkent"
    },
    # палитра снята пипеткой с фотографий зала: кремовые стены, чёрная
    # столярка, латунные буквы вывески, бордовые шторы
    "theme": {"bg": "#faf7f0", "ink": "#24211d", "muted": "#6f665c",
              "accent": "#9a7b43", "accentD": "#7a5c2e", "dark": "#3b2226"},
    # типографика: антиква Cormorant Garamond на заголовках и цифрах.
    # Файлы лежат в uploads проекта и уезжают в assets, сторонних запросов нет.
    "fonts": {
      "family": "Cormorant Garamond",
      "scale": 64,
      "tracking": ".004em",
      "files": [
        {"file": "cormorant-500-latin.woff2", "weight": 500,
         "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"},
        {"file": "cormorant-500-cyrillic.woff2", "weight": 500, "range": "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"},
        {"file": "cormorant-600-latin.woff2", "weight": 600,
         "range": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"},
        {"file": "cormorant-600-cyrillic.woff2", "weight": 600, "range": "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"}
      ]
    }
  },

  "brand": {"mark": "R", "logo": "",
            "name": ml("RESTAURANT", "RESTAURANT", "RESTAURANT"),
            "tag": ml("Аренда ресторана при отеле", "Mehmonxonadagi restoran ijarasi", "Restaurant space at a hotel")},
  "contacts": {"phone": "+998 77 041 73 75", "telegram": "caseadvisory_leasing",
               "people": [
                 {"name": ml("Нодир Махмудходжизода", "Nodir Mahmudhojizoda", "Nodir Mahmudhojizoda"), "phone": "+998 77 041 73 75"},
                 {"name": ml("Хилола Омонуллаева", "Hilola Omonullayeva", "Hilola Omonullayeva"), "phone": "+998 70 164 40 02"}
               ],
               "email": "caseadvisoryservicess@gmail.com", "sheetsEndpoint": "",
               "smtpHost": "", "smtpPort": "", "smtpUser": "", "smtpPass": ""},
  "adminUrl": "", "leadEndpoint": "",

  "texts": {
    "nav.about": ml("О помещении", "Maydon haqida", "The space"),
    "hero.cta": ml("Запросить условия", "Shartlarni so'rash", "Request terms"),
    "about.viz": ml("фотография помещения", "maydon fotosurati", "photo of the space"),
    "about.vizAll": ml(
      "Фотографии сделаны в помещении. Мебель, свет и оборудование на снимках остаются новому арендатору.",
      "Fotosuratlar maydonning o'zida olingan. Suratlardagi mebel, yoritish va jihozlar yangi ijarachiga qoladi.",
      "The photographs were taken on site. The furniture, lighting and equipment shown remain for the new tenant."),
    "legal.area": ml(
      "Площади приведены по обмерному плану: общая площадь 303,8 м², арендопригодная 279,7 м², терраса 47,7 м². Информация носит справочный характер и не является публичной офертой.",
      "Maydonlar o'lchov rejasi bo'yicha keltirilgan: umumiy maydon 303,8 m², ijaraga yaroqli 279,7 m², terrassa 47,7 m². Ma'lumot ma'lumot xarakteriga ega va ommaviy oferta hisoblanmaydi.",
      "Areas are stated per the measured plan: 303.8 m² gross, 279.7 m² leasable and a 47.7 m² terrace. This information is for reference only and does not constitute a public offer.")
  },

  "seo": {
    "title": ml("Аренда готового ресторана 279,7 м² с террасой в центре Ташкента",
                "Toshkent markazida terrassali 279,7 m² tayyor restoran ijarasi",
                "Fully fitted 279.7 m² restaurant with a terrace for lease in central Tashkent"),
    "description": ml(
      "Аренда помещения работавшего ресторана в здании отеля в центре Ташкента: 279,7 м² зала и кухни, остеклённая терраса 47,7 м², профессиональная кухня с вытяжкой, мебель, свет и посуда на месте. Два входа: из лобби отеля и с улицы. Ставка по запросу.",
      "Toshkent markazidagi mehmonxona binosida ishlagan restoran maydoni ijaraga beriladi: 279,7 m² zal va oshxona, 47,7 m² oynali terrassa, so'rg'ichli professional oshxona, mebel, yoritish va idishlar joyida. Ikkita kirish: mehmonxona lobbisidan va ko'chadan. Narxi so'rov bo'yicha.",
      "A fully fitted restaurant for lease inside a hotel building in central Tashkent: 279.7 m² of dining rooms and kitchen, a 47.7 m² glazed terrace, a professional kitchen with extraction, plus furniture, lighting and tableware in place. Two entrances: from the hotel lobby and from the street. Rent on request."),
    "keywords": ", ".join([
      "аренда ресторана Ташкент", "аренда готового ресторана", "ресторан с оборудованием аренда Ташкент",
      "помещение под ресторан Ташкент", "аренда кафе Ташкент", "аренда помещения с кухней Ташкент",
      "ресторан при отеле аренда", "аренда ресторана с террасой", "помещение под кофейню Ташкент",
      "аренда банкетного зала Ташкент", "ресторан под ключ аренда Ташкент",
      "готовый бизнес ресторан Ташкент аренда", "аренда помещения общепит Ташкент",
      "restoran ijaraga Toshkent", "tayyor restoran ijarasi", "oshxonali maydon ijarasi Toshkent",
      "restaurant for lease Tashkent", "fully fitted restaurant Tashkent", "turnkey restaurant space Uzbekistan",
      "hotel restaurant lease Tashkent", "F&B space for rent Tashkent"
    ]),
    "domain": "", "googleVerification": "", "yandexVerification": "",
    "publicUrl": "https://caseadvisory.uz/restaurant"
  },

  "intro": {
    "image": "hall.jpg",
    "focus": "50% 55%",
    "h1": ml("Готовый ресторан 279,7 м² с террасой в здании отеля Mercure",
             "Mercure mehmonxonasi binosida terrassali 279,7 m² tayyor restoran",
             "A fully fitted 279.7 m² restaurant with a terrace inside the Mercure hotel"),
    "sub": ml("Аренда помещения с мебелью, светом и работающей кухней",
              "Mebel, yoritish va ishlaydigan oshxona bilan maydon ijarasi",
              "Space for lease with furniture, lighting and a working kitchen"),
    "facts": [
      {"n": ml("279,7", "279,7", "279.7"), "l": ml("м² арендопригодной площади (GLA)", "m² ijaraga yaroqli maydon (GLA)", "m² of leasable area (GLA)")},
      {"n": ml("47,7", "47,7", "47.7"), "l": ml("м² остеклённая терраса", "m² oynali terrassa", "m² glazed terrace")},
      {"n": "2", "l": ml("входа: из лобби отеля и с улицы", "kirish: mehmonxona lobbisidan va ko'chadan", "entrances: hotel lobby and street")}
    ]
  },

  "params": [
    {"n": ml("303,8", "303,8", "303.8"), "l": ml("м² общая площадь (GBA)", "m² umumiy maydon (GBA)", "m² gross area (GBA)")},
    {"n": ml("279,7", "279,7", "279.7"), "l": ml("м² залы и кухня", "m² zallar va oshxona", "m² dining rooms and kitchen")},
    {"n": ml("47,7", "47,7", "47.7"), "l": ml("м² терраса", "m² terrassa", "m² terrace")},
    {"n": "", "l": ml("Мебель и оборудование остаются", "Mebel va jihozlar qoladi", "Furniture and equipment stay")},
    {"n": "", "l": ml("Только аренда", "Faqat ijara", "Lease only")}
  ],

  "unitsSection": {"h2": ml("Помещение", "Maydon", "The space"), "note": ml("", "", "")},
  "units": [],

  "useCases": {
    "h2": ml("Кому подходит помещение", "Maydon kimga mos keladi", "Who this space suits"),
    "cards": [
      {"icon": "office",
       "h": ml("Ресторан городского формата", "Shahar formatidagi restoran", "A city restaurant"),
       "levels": ml("основной сценарий", "asosiy stsenariy", "primary scenario"),
       "p": ml("Залы, кухня, санузлы и терраса уже собраны в рабочую конфигурацию. Оператор заходит со своей концепцией и командой, не тратя полгода на стройку и согласования.",
               "Zallar, oshxona, hojatxonalar va terrassa allaqachon ishchi holatga keltirilgan. Operator o'z konsepsiyasi va jamoasi bilan kiradi, qurilish va kelishuvlarga yarim yil sarflamaydi.",
               "Dining rooms, kitchen, restrooms and terrace are already a working set-up. An operator walks in with a concept and a team instead of spending half a year on fit-out and approvals.")},
      {"icon": "clinic",
       "h": ml("Кофейня, бистро, кондитерская", "Qahvaxona, bistro, qandolatxona", "Cafe, bistro or patisserie"),
       "levels": ml("дневной трафик", "kunduzgi tirbandlik", "daytime traffic"),
       "p": ml("Терраса с раздвижным навесом и отдельный вход с улицы дают дневную посадку и витрину, независимую от режима отеля.",
               "Suriladigan soyabonli terrassa va ko'chadan alohida kirish mehmonxona rejimidan mustaqil kunduzgi o'tirish joyi va vitrina beradi.",
               "The terrace with a retractable canopy and its own street entrance give daytime seating and a shopfront independent of the hotel's rhythm.")},
      {"icon": "school",
       "h": ml("Банкеты и мероприятия", "Banketlar va tadbirlar", "Banquets and events"),
       "levels": ml("вечерняя загрузка", "kechki yuklama", "evening utilisation"),
       "p": ml("Два зала разделены стеклянными перегородками: можно закрыть один под мероприятие, оставив второй в общем режиме.",
               "Ikki zal shisha to'siqlar bilan ajratilgan: bittasini tadbir uchun yopib, ikkinchisini umumiy rejimda qoldirish mumkin.",
               "Two rooms are separated by glazed partitions, so one can be closed for a private event while the other keeps trading.")},
      {"icon": "office",
       "h": ml("Работа с гостями отеля", "Mehmonxona mehmonlari bilan ishlash", "Working with hotel guests"),
       "levels": ml("по договорённости с отелем", "mehmonxona bilan kelishuv bo'yicha", "subject to agreement with the hotel"),
       "p": ml("Вход прямо из лобби даёт постоянный поток проживающих и делегаций. Формат участия в завтраках и обслуживании номеров обсуждается отдельно с отелем.",
               "Lobbidan to'g'ridan-to'g'ri kirish yashovchilar va delegatsiyalarning doimiy oqimini beradi. Nonushta va xonalarga xizmat ko'rsatishda ishtirok etish formati mehmonxona bilan alohida muhokama qilinadi.",
               "A direct door from the lobby brings a steady flow of in-house guests and delegations. Participation in breakfasts and room service is agreed separately with the hotel.")}
    ]
  },

  "scenarios": {
    "h2": ml("Формат сделки", "Bitim formati", "Deal structure"),
    "cols": [
      {"h": ml("Аренда", "Ijara", "Lease"),
       "p": ml("Помещение только сдаётся в аренду, целиком. Ставка и срок договора обсуждаются индивидуально: оставьте контакты, и мы вышлем условия.",
               "Maydon faqat to'liq holda ijaraga beriladi. Narx va shartnoma muddati alohida muhokama qilinadi: kontaktlaringizni qoldiring, shartlarni yuboramiz.",
               "The space is available for lease only, as a whole. Rent and lease term are discussed individually: leave your contacts and we will send the terms.")},
      {"h": ml("Что уже есть в помещении", "Maydonda nima bor", "What is already in place"),
       "p": ml("Мебель залов и террасы, светильники, посуда, бар и раздача, профессиональная кухня с вытяжной вентиляцией, санузлы для гостей. Точный перечень оборудования передаём по запросу.",
               "Zallar va terrassa mebeli, chiroqlar, idishlar, bar va tarqatish joyi, so'rg'ich ventilyatsiyali professional oshxona, mehmonlar uchun hojatxonalar. Jihozlarning aniq ro'yxatini so'rov bo'yicha beramiz.",
               "Furniture for the rooms and terrace, light fittings, tableware, the bar and service counter, a professional kitchen with extraction, and guest restrooms. A detailed equipment list is provided on request.")},
      {"h": ml("Условия на старт", "Ishga tushirish shartlari", "Terms at launch"),
       "p": ml("Собственник готов обсуждать арендные каникулы на период запуска и раскрутки. Порядок оплаты коммунальных услуг и участие в маркетинге фиксируются в договоре.",
               "Mulkdor ishga tushirish va targ'ib qilish davriga ijara ta'tilini muhokama qilishga tayyor. Kommunal to'lovlar tartibi va marketingda ishtirok shartnomada belgilanadi.",
               "The landlord is open to discussing a rent-free period while the venue opens and builds traffic. Utility payments and marketing contributions are fixed in the lease.")}
    ]
  },

  "about": {
    "h2": ml("О помещении", "Maydon haqida", "About the space"),
    "sfbNote": ml("", "", ""),
    "status": ml("Ресторан не работает, помещение свободно и готово к передаче новому оператору. Осмотр по договорённости.",
                 "Restoran ishlamayapti, maydon bo'sh va yangi operatorga topshirishga tayyor. Ko'rik kelishuv bo'yicha.",
                 "The restaurant is closed; the space is vacant and ready to hand over to a new operator. Viewings by appointment."),
    "specs": [
      {"b": ml("Общая площадь (GBA)", "Umumiy maydon (GBA)", "Gross area (GBA)"),
       "s": ml("303,8 м²", "303,8 m²", "303.8 m²")},
      {"b": ml("Арендопригодная площадь (GLA)", "Ijaraga yaroqli maydon (GLA)", "Leasable area (GLA)"),
       "s": ml("279,7 м² - залы, кухня, санузлы", "279,7 m² - zallar, oshxona, hojatxonalar", "279.7 m² - dining rooms, kitchen, restrooms")},
      {"b": ml("Терраса", "Terrassa", "Terrace"),
       "s": ml("47,7 м², остеклённая, с раздвижным навесом", "47,7 m², oynali, suriladigan soyabonli", "47.7 m², glazed, with a retractable canopy")},
      {"b": ml("Расположение", "Joylashuvi", "Location"),
       "s": ml("первый этаж здания отеля Mercure, центр Ташкента", "Mercure mehmonxonasi binosining birinchi qavati, Toshkent markazi", "ground floor of the Mercure hotel building, central Tashkent")},
      {"b": ml("Входы", "Kirishlar", "Entrances"),
       "s": ml("из лобби отеля и отдельный с улицы", "mehmonxona lobbisidan va ko'chadan alohida", "from the hotel lobby and a separate street entrance")},
      {"b": ml("Кухня", "Oshxona", "Kitchen"),
       "s": ml("профессиональная, с вытяжной вентиляцией и холодильным оборудованием", "professional, so'rg'ich ventilyatsiya va sovutish jihozlari bilan", "professional, with extraction and refrigeration")},
      {"b": ml("Залы", "Zallar", "Dining rooms"),
       "s": ml("два зала, разделены стеклянными перегородками", "ikki zal, shisha to'siqlar bilan ajratilgan", "two rooms, separated by glazed partitions")},
      {"b": ml("Что остаётся арендатору", "Ijarachiga nima qoladi", "What stays for the tenant"),
       "s": ml("мебель, светильники, посуда, бар и раздача", "mebel, chiroqlar, idishlar, bar va tarqatish joyi", "furniture, light fittings, tableware, bar and service counter")},
      {"b": ml("Формат сделки", "Bitim formati", "Deal type"),
       "s": ml("только аренда, помещение целиком", "faqat ijara, maydon to'liq", "lease only, the whole space")}
    ],
    "images": [
      {"file": "plan-f1.jpg",
       "badge": ml("план помещения", "maydon rejasi", "floor plan"),
       "alt": ml("План первого этажа ресторана: 279,7 м² залов и кухни и терраса 47,7 м²",
                 "Restoranning birinchi qavat rejasi: 279,7 m² zallar va oshxona hamda 47,7 m² terrassa",
                 "Ground floor plan of the restaurant: 279.7 m² of rooms and kitchen plus a 47.7 m² terrace")},
      {"file": "terrace.jpg",
       "alt": ml("Остеклённая терраса ресторана 47,7 м² с раздвижным навесом и уличной мебелью",
                 "Restoranning 47,7 m² oynali terrassasi, suriladigan soyabon va ko'cha mebeli bilan",
                 "The 47.7 m² glazed restaurant terrace with a retractable canopy and outdoor furniture")},
      {"file": "kitchen.jpg",
       "alt": ml("Профессиональная кухня ресторана с вытяжкой, плитой и холодильными столами",
                 "Restoranning professional oshxonasi: so'rg'ich, plita va sovutgichli stollar",
                 "The professional restaurant kitchen with extraction, range and refrigerated counters")}
    ]
  },

  "location": {
    "h2": ml("Центр Ташкента, здание отеля Mercure", "Toshkent markazi, Mercure mehmonxonasi binosi", "Central Tashkent, the Mercure hotel building"),
    "sub": ml("Ресторан занимает первый этаж действующего отеля: поток проживающих гостей и делегаций дополняется городской публикой с улицы.",
              "Restoran amaldagi mehmonxonaning birinchi qavatini egallaydi: yashovchi mehmonlar va delegatsiyalar oqimi ko'chadagi shahar auditoriyasi bilan to'ldiriladi.",
              "The restaurant occupies the ground floor of an operating hotel: a flow of resident guests and delegations, complemented by city footfall from the street."),
    "address": ml("Центр Ташкента, здание отеля Mercure", "Toshkent markazi, Mercure mehmonxonasi binosi", "Central Tashkent, the Mercure hotel building"),
    "addressNote": ml("", "", ""),
    "city": ml("Ташкент", "Toshkent", "Tashkent"),
    "lat": "41.2727553", "lng": "69.2418485",
    "pois": [],
    "drive": [],
    "metroNote": ml("", "", ""),
    "around": ml("", "", "")
  },

  "faq": [
    {"q": ml("Что входит в аренду?", "Ijaraga nima kiradi?", "What is included in the lease?"),
     "a": ml("Помещение целиком: два зала, кухня, санузлы и остеклённая терраса, а также мебель, светильники, посуда, бар и раздача. Подробный перечень оборудования высылаем по запросу вместе с условиями.",
             "Maydon to'liq: ikki zal, oshxona, hojatxonalar va oynali terrassa, shuningdek mebel, chiroqlar, idishlar, bar va tarqatish joyi. Jihozlarning batafsil ro'yxatini shartlar bilan birga so'rov bo'yicha yuboramiz.",
             "The entire space: two dining rooms, the kitchen, restrooms and the glazed terrace, plus furniture, light fittings, tableware, the bar and the service counter. A detailed equipment list is sent on request together with the terms.")},
    {"q": ml("Есть ли отдельный вход с улицы?", "Ko'chadan alohida kirish bormi?", "Is there a separate street entrance?"),
     "a": ml("Да. Гости заходят как из лобби отеля, так и с улицы через собственную входную группу. Оператор не зависит от режима работы стойки регистрации и может работать по своему графику.",
             "Ha. Mehmonlar mehmonxona lobbisidan ham, ko'chadan o'z kirish guruhi orqali ham kiradi. Operator qabul stolining ish rejimiga bog'liq emas va o'z jadvali bo'yicha ishlashi mumkin.",
             "Yes. Guests can enter both from the hotel lobby and from the street through the restaurant's own entrance, so the operator is not tied to the front desk hours and can keep its own schedule.")},
    {"q": ml("В каком состоянии кухня?", "Oshxona qanday holatda?", "What condition is the kitchen in?"),
     "a": ml("Кухня рабочая: вытяжная вентиляция, тепловое и холодильное оборудование, производственные столы и мойки на местах. Состав оборудования фиксируется в акте передачи.",
             "Oshxona ishchi holatda: so'rg'ich ventilyatsiya, issiqlik va sovutish jihozlari, ishlab chiqarish stollari va yuvish joylari o'z o'rnida. Jihozlar tarkibi topshirish dalolatnomasida qayd etiladi.",
             "The kitchen is operational: extraction, cooking and refrigeration equipment, prep counters and sinks are all in place. The exact inventory is recorded in the handover schedule.")},
    {"q": ml("Возможны ли арендные каникулы?", "Ijara ta'tili mumkinmi?", "Is a rent-free period possible?"),
     "a": ml("Собственник готов обсуждать каникулы на период запуска: новому оператору нужно время на команду, меню и первую аудиторию. Длительность зависит от срока договора и концепции.",
             "Mulkdor ishga tushirish davriga ta'til muhokama qilishga tayyor: yangi operatorga jamoa, menyu va birinchi auditoriya uchun vaqt kerak. Muddati shartnoma muddati va konsepsiyaga bog'liq.",
             "The landlord is open to a rent-free period at launch: a new operator needs time for the team, the menu and the first audience. Its length depends on the lease term and the concept.")},
    {"q": ml("Можно ли работать с гостями отеля?", "Mehmonxona mehmonlari bilan ishlash mumkinmi?", "Can we serve the hotel guests?"),
     "a": ml("Это одна из сильных сторон объекта: проживающие и делегации заходят прямо из лобби. Формат участия в завтраках и обслуживании номеров обсуждается с отелем отдельно и фиксируется договором.",
             "Bu obyektning kuchli tomonlaridan biri: yashovchilar va delegatsiyalar to'g'ridan-to'g'ri lobbidan kiradi. Nonushta va xonalarga xizmat ko'rsatishda ishtirok etish formati mehmonxona bilan alohida muhokama qilinadi va shartnomada belgilanadi.",
             "This is one of the strengths of the asset: in-house guests and delegations walk in straight from the lobby. Participation in breakfasts and room service is agreed with the hotel separately and fixed in the contract.")},
    {"q": ml("Какая ставка аренды?", "Ijara narxi qancha?", "What is the rent?"),
     "a": ml("Ставка и условия обсуждаются индивидуально и зависят от срока договора, концепции и объёма каникул. Оставьте контакты, и мы вышлем коммерческое предложение.",
             "Narx va shartlar alohida muhokama qilinadi hamda shartnoma muddati, konsepsiya va ta'til hajmiga bog'liq. Kontaktlaringizni qoldiring, tijorat taklifini yuboramiz.",
             "Rent and terms are discussed individually and depend on the lease length, the concept and the rent-free period. Leave your contacts and we will send a proposal.")},
    {"q": ml("Можно ли посмотреть помещение?", "Maydonni ko'rish mumkinmi?", "Can we view the space?"),
     "a": ml("Да, осмотр по договорённости. Оставьте контакты в форме, и мы согласуем удобное время.",
             "Ha, ko'rik kelishuv bo'yicha. Shakl orqali kontaktlaringizni qoldiring, qulay vaqtni kelishamiz.",
             "Yes, viewings are by appointment. Leave your contacts in the form and we will arrange a convenient time.")}
  ],

  "lead": {
    "h2": ml("Запросить условия аренды", "Ijara shartlarini so'rash", "Request the lease terms"),
    "sub": ml("Оставьте контакты - вышлем условия, перечень оборудования и согласуем осмотр.",
              "Kontaktlaringizni qoldiring - shartlar, jihozlar ro'yxatini yuboramiz va ko'rikni kelishamiz.",
              "Leave your contacts and we will send the terms and the equipment list, and arrange a viewing.")
  },
  "enquiry": {"note": ml("Ответим в течение дня", "Kun davomida javob beramiz", "We reply within the day")},

  "footer": {
    "addr": ml("Центр Ташкента, здание отеля Mercure", "Toshkent markazi, Mercure mehmonxonasi binosi", "Central Tashkent, the Mercure hotel building"),
    "legal": ml(
      "CASE Real Estate Advisory выступает агентом собственника помещения по сдаче в аренду и не является представителем гостиничного оператора. Информация на сайте носит справочный характер и не является публичной офертой. © 2026 CASE Advisory",
      "CASE Real Estate Advisory maydon mulkdorining ijaraga berish bo'yicha agenti sifatida ish yuritadi va mehmonxona operatorining vakili emas. Saytdagi ma'lumotlar ma'lumot xarakteriga ega va ommaviy oferta hisoblanmaydi. © 2026 CASE Advisory",
      "CASE Real Estate Advisory acts as the letting agent for the owner of the premises and is not a representative of the hotel operator. Information on this site is for reference only and does not constitute a public offer. © 2026 CASE Advisory")
  },

  "settings": {"mapsApiKey": "", "metricaId": "", "ga4Id": "", "gtmId": ""},

  # брошюра: у режима «одно готовое помещение» те же 7 страниц, что у земли,
  # но подписи свои - тут не участок, а действующий интерьер
  "pres": {
    "aboutImg": "plan-f1.jpg",
    "aboutImgFit": "contain",
    "vizImgs": ["terrace.jpg", "kitchen.jpg", "hall-wood.jpg"],
    "T": {
      "addr": ml("Центр Ташкента · отель Mercure", "Toshkent markazi · Mercure mehmonxonasi", "Central Tashkent · Mercure hotel"),
      "lbl_land": ml("Помещение", "Maydon", "The space"),
      "land_deal": ml("Ставка и условия - по запросу:", "Narx va shartlar - so'rov bo'yicha:", "Rent and terms on request:"),
      "land_loc_zone": ml(
        "Помещение занимает первый этаж действующего отеля: гости и делегации заходят прямо из лобби, городская публика - с улицы через собственный вход.",
        "Maydon amaldagi mehmonxonaning birinchi qavatini egallaydi: mehmonlar va delegatsiyalar to'g'ridan-to'g'ri lobbidan, shahar auditoriyasi esa ko'chadan o'z kirishi orqali kiradi.",
        "The space occupies the ground floor of an operating hotel: guests and delegations arrive straight from the lobby, while city visitors use the restaurant's own street entrance."),
      "lbl_viz": ml("Фотографии", "Fotosuratlar", "Photographs"),
      "h_viz": ml("Как выглядит помещение", "Maydon qanday ko'rinadi", "What the space looks like"),
      "viz_p": ml(
        "Два зала со стеклянными перегородками, остеклённая терраса с раздвижным навесом и профессиональная кухня с вытяжкой. Мебель, светильники, посуда, бар и раздача остаются новому арендатору: помещение можно открывать, а не строить.",
        "Shisha to'siqli ikki zal, suriladigan soyabonli oynali terrassa va so'rg'ichli professional oshxona. Mebel, chiroqlar, idishlar, bar va tarqatish joyi yangi ijarachiga qoladi: maydonni qurish emas, ochish mumkin.",
        "Two dining rooms with glazed partitions, a covered terrace with a retractable canopy and a professional kitchen with extraction. Furniture, light fittings, tableware, the bar and the service counter stay for the new tenant: the venue can be opened rather than built."),
      "viz_all_concept": ml(
        "Фотографии сделаны в помещении. Публичной офертой не являются.",
        "Fotosuratlar maydonning o'zida olingan. Ommaviy oferta hisoblanmaydi.",
        "The photographs were taken on site. They do not constitute a public offer."),
      "c_h": ml("Обсудим помещение?", "Maydonni muhokama qilamizmi?", "Shall we discuss the space?"),
      "c_s": ml("Ответим в течение дня - условия, перечень оборудования, осмотр.",
                "Kun davomida javob beramiz - shartlar, jihozlar ro'yxati, ko'rik.",
                "We reply within the day - terms, the equipment list and a viewing.")
    }
  }
}

OUT = '/home/user/case-site/admin/data/projects/mercure-restaurant/project.json'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(CFG, f, ensure_ascii=False, indent=2)
print('конфиг записан:', OUT)
