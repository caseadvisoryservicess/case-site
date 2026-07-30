#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Собирает конфиг лендинга OQ SAROY (Бухара) на базе структуры ресторана Mercure.

Класс актива тот же - одно готовое здание целиком, только аренда. Отличие:
по решению владельца арендопригодной площадью считается GBA этажа, потому что
здание сдаётся целиком под ресторан. Цифры взяты с чертежей CASE:
подвал GBA 271,4, первый этаж 284,6, второй этаж 359,7, итого 915,7 м².
Арендная площадь второго этажа при отдельной аренде - 359,7 м².

Запуск: python3 scripts/build-oq-saroy.py
"""
import json, os, copy

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'data', 'projects', 'mercure-restaurant', 'project.json')
DIR = os.path.join(ROOT, 'data', 'projects', 'oq-saroy')
OUT = os.path.join(DIR, 'project.json')
os.makedirs(os.path.join(DIR, 'uploads'), exist_ok=True)

def ml(ru, uz, en): return {"ru": ru, "uz": uz, "en": en}

c = json.load(open(SRC, encoding='utf-8'))

c['slug'] = 'oq-saroy'
c['name'] = 'Ресторан OQ SAROY (Бухара)'
c['adminUrl'] = ''
c['leadEndpoint'] = 'https://caseadvisory.uz/admin/api/lead/oq-saroy'

c['site'].update({
    "code": "OQ SAROY",
    "title": "OQ SAROY - restaurant building in Bukhara",
    "fileBase": "OQ-SAROY-Bukhara",
    "planBase": "OQ-SAROY-plan",
    "favicon": "O",
    "assetType": "single",
    "intent": "lease",
    "addr": {
        "headline": ml("Бухара · улица Сергея Юренева", "Buxoro · Sergey Yurenev ko'chasi", "Bukhara · Sergey Yurenev street"),
        "street": ml("улица Сергея Юренева", "Sergey Yurenev ko'chasi", "Sergey Yurenev street"),
        "locality": ml("Бухара", "Buxoro", "Bukhara"),
        "region": ml("Бухарская область", "Buxoro viloyati", "Bukhara region"),
        "streetLd": "", "localityLd": "Bukhara", "regionLd": "Buxoro viloyati"
    },
    "theme": {"bg": "#f8f5ef", "ink": "#23201c", "muted": "#6b6459",
              "accent": "#b08d57", "accentD": "#8a6c3e", "dark": "#1f3a34"}
})
c['site'].pop('fonts', None)

c['brand'] = {"code": "OQ SAROY", "name": ml("OQ SAROY", "OQ SAROY", "OQ SAROY")}
c['contacts'] = {
    "phone": "+998 90 922 07 00", "telegram": "muhammadaxmadiy",
    "email": "", "smtpHost": "", "smtpPort": "", "smtpUser": "", "smtpPass": "",
    "tgBotToken": "", "tgChatId": ""
}
c['settings'] = {"mapsApiKey": "", "metricaId": "111115481", "ga4Id": "G-X9Y8MHCP9L", "gtmId": ""}

c['seo'] = {
    "publicUrl": "https://caseadvisory.uz/oq-saroy",
    "title": ml(
        "Аренда здания ресторана OQ SAROY в Бухаре - 915,7 м², зал на 2 этаже",
        "Buxoroda OQ SAROY restoran binosi ijaraga - 915,7 m², 2-qavatda zal",
        "OQ SAROY restaurant building for lease in Bukhara - 915.7 m²"),
    "description": ml(
        "Готовое здание ресторана OQ SAROY в Бухаре: 915,7 м² целиком или зал второго этажа 359,7 м². Отделка в национальном стиле, кухня с вытяжкой, кабины, отдельный вход. Аренда, ставка по запросу.",
        "Buxorodagi tayyor OQ SAROY restoran binosi: butunlay 915,7 m² yoki 2-qavat zali 359,7 m². Milliy uslubdagi pardoz, so'rg'ichli oshxona, kabinalar, alohida kirish. Ijara, narx so'rov bo'yicha.",
        "A turnkey restaurant building in Bukhara: 915.7 m² in full or a 359.7 m² hall on the second floor. National-style interior, a kitchen with an extraction hood, private rooms and a separate entrance. For lease, rate on request."),
    "keywords": "аренда ресторана Бухара, ресторан в аренду Бухара, здание ресторана Бухара, готовый ресторан Бухара, аренда помещения под ресторан Бухара, банкетный зал Бухара аренда, restaurant for rent Bukhara, restaurant space Bukhara, Buxoroda restoran ijaraga, Buxoro restoran binosi ijara, to'yxona Buxoro ijaraga, oshxona ijaraga Buxoro",
    "googleVerification": "", "yandexVerification": ""
}

c['intro'] = {
    "image": "hall-wide.jpg",
    "h1": ml("Готовое здание ресторана OQ SAROY в Бухаре",
             "Buxorodagi tayyor OQ SAROY restoran binosi",
             "OQ SAROY: a turnkey restaurant building in Bukhara"),
    "sub": ml(
        "Зал в национальном стиле на втором этаже, производственная кухня, отдельные кабины и собственный вход. Сдаётся целиком под ресторан - 915,7 м², либо отдельно зал второго этажа 359,7 м².",
        "Ikkinchi qavatda milliy uslubdagi zal, ishlab chiqarish oshxonasi, alohida kabinalar va o'z kirishi. Restoran uchun butunlay ijaraga beriladi - 915,7 m², yoki alohida 2-qavat zali 359,7 m².",
        "A national-style dining hall on the second floor, a production kitchen, private rooms and its own entrance. Leased as a whole for a restaurant - 915.7 m², or the second-floor hall alone at 359.7 m²."),
    "facts": [
        {"n": ml("915,7", "915,7", "915.7"), "l": ml("м² здание целиком", "m² bino butunlay", "m² the whole building")},
        {"n": ml("359,7", "359,7", "359.7"), "l": ml("м² зал второго этажа", "m² ikkinchi qavat zali", "m² the second-floor hall")},
        {"n": "3", "l": ml("уровня: подвал, 1 и 2 этажи", "daraja: podval, 1 va 2-qavatlar", "levels: basement, floors 1 and 2")},
        {"n": ml("Готово", "Tayyor", "Ready"), "l": ml("отделка, кухня, инженерия", "pardoz, oshxona, muhandislik", "fit-out, kitchen, utilities")}
    ]
}

c['params'] = [
    {"n": ml("915,7", "915,7", "915.7"), "l": ml("м² всего", "m² jami", "m² total")},
    {"n": ml("359,7", "359,7", "359.7"), "l": ml("м² второй этаж", "m² ikkinchi qavat", "m² second floor")},
    {"n": ml("284,6", "284,6", "284.6"), "l": ml("м² первый этаж", "m² birinchi qavat", "m² first floor")},
    {"n": ml("271,4", "271,4", "271.4"), "l": ml("м² подвал", "m² podval", "m² basement")},
    {"n": "3", "l": ml("уровня", "daraja", "levels")}
]

c['units'] = []
c['unitsSection'] = {"h2": ml("Помещения", "Maydonlar", "Premises"), "sub": ml("", "", "")}

c['useCases'] = {
    "h2": ml("Кому подходит здание", "Bino kimga mos keladi", "Who the building suits"),
    "cards": [
        {"h": ml("Ресторан национальной кухни", "Milliy taomlar restorani", "A national cuisine restaurant"),
         "p": ml("Зал уже оформлен в национальном стиле: резные колонны, панджара, арочные ниши, сцена для музыкантов. Заходить можно с готовым меню, не переделывая интерьер.",
                 "Zal allaqachon milliy uslubda bezatilgan: o'ymakor ustunlar, panjara, arkali tokchalar, musiqachilar uchun sahna. Interyerni qayta qurmasdan tayyor menyu bilan kirish mumkin.",
                 "The hall is already finished in national style: carved columns, panjara screens, arched niches and a stage for musicians. A tenant can move in with a ready menu and keep the interior.")},
        {"h": ml("Торжества и банкеты", "Tantanalar va banketlar", "Celebrations and banquets"),
         "p": ml("Зал второго этажа свободной планировки со сценой, отдельные кабины на восемь человек и гардероб. Формат под свадьбы, юбилеи и корпоративные вечера.",
                 "Ikkinchi qavatning erkin planirovkali zali sahna bilan, sakkiz kishilik alohida kabinalar va garderob. To'ylar, yubileylar va korporativ kechalar uchun format.",
                 "An open-plan second-floor hall with a stage, private rooms for eight and a cloakroom. A format for weddings, anniversaries and corporate evenings.")},
        {"h": ml("Сетевой оператор", "Tarmoq operatori", "A chain operator"),
         "p": ml("Здание целиком: кухня и склад в подвале, торговые помещения первого этажа можно освободить под зал, кофейню или витрину.",
                 "Bino butunlay: oshxona va ombor podvalda, birinchi qavatdagi savdo maydonlarini zal, kafe yoki vitrina uchun bo'shatish mumkin.",
                 "The whole building: kitchen and storage in the basement, while the ground-floor retail units can be freed for a hall, a coffee shop or a shopfront.")},
        {"h": ml("Туристический поток", "Turistik oqim", "Tourist flow"),
         "p": ml("Бухара принимает туристов круглый год, рядом гостиницы Turon Plaza и The Tower Bukhara. Ресторан на первой линии дороги виден и с улицы, и с площади.",
                 "Buxoro yil davomida turistlarni qabul qiladi, yonida Turon Plaza va The Tower Bukhara mehmonxonalari. Yo'lning birinchi qatoridagi restoran ko'chadan ham, maydondan ham ko'rinadi.",
                 "Bukhara hosts tourists all year round, with the Turon Plaza and The Tower Bukhara hotels next door. A restaurant on the first line of the road is visible from both the street and the square.")}
    ]
}

c['scenarios'] = {
    "h2": ml("Формат сделки", "Bitim formati", "Deal structure"),
    "cols": [
        {"h": ml("Здание целиком", "Bino butunlay", "The whole building"),
         "p": ml("915,7 м²: подвал, первый и второй этажи. Арендная площадь считается по общей площади здания, потому что объект передаётся одному оператору.",
                 "915,7 m²: podval, birinchi va ikkinchi qavatlar. Ijara maydoni binoning umumiy maydoni bo'yicha hisoblanadi, chunki obyekt bitta operatorga topshiriladi.",
                 "915.7 m²: basement, first and second floors. The leasable area is counted as the gross area, since the property goes to a single operator.")},
        {"h": ml("Только второй этаж", "Faqat ikkinchi qavat", "The second floor only"),
         "p": ml("359,7 м²: зал со сценой, кабины и санузлы. Первый этаж в этом варианте остаётся под действующими торговыми помещениями, аренда считается только от площади второго этажа.",
                 "359,7 m²: sahnali zal, kabinalar va sanuzellar. Bu variantda birinchi qavat amaldagi savdo maydonlari ostida qoladi, ijara faqat ikkinchi qavat maydonidan hisoblanadi.",
                 "359.7 m²: the hall with a stage, private rooms and restrooms. In this option the ground floor stays with the current retail units, and rent is counted only from the second-floor area.")},
        {"h": ml("Что входит", "Nimalar kiradi", "What is included"),
         "p": ml("Отделка залов, резные элементы, освещение, вытяжка и производственная зона кухни, сантехника, кондиционирование. Перечень оборудования вышлем по запросу.",
                 "Zallar pardozi, o'ymakor elementlar, yoritish, so'rg'ich va oshxonaning ishlab chiqarish zonasi, santexnika, konditsionerlash. Uskunalar ro'yxatini so'rov bo'yicha yuboramiz.",
                 "The fit-out of the halls, carved details, lighting, the extraction hood and the production kitchen area, plumbing and air conditioning. The equipment list is available on request.")}
    ],
    "note": ml("Ставка и срок договора обсуждаются: оставьте контакты, вышлем условия.",
               "Narx va shartnoma muddati muhokama qilinadi: kontaktlaringizni qoldiring, shartlarni yuboramiz.",
               "The rate and the term are negotiable: leave your contacts and we will send the terms.")
}

c['about'] = {
    "h2": ml("О здании", "Bino haqida", "About the building"),
    "sfbNote": ml("", "", ""),
    "status": ml(
        "Здание построено и отделано, ресторан не работает: объект передаётся новому оператору.",
        "Bino qurilgan va pardozlangan, restoran ishlamayapti: obyekt yangi operatorga topshiriladi.",
        "The building is complete and fitted out; the restaurant is not operating and the property is being handed to a new operator."),
    "specs": [
        {"b": ml("Здание целиком", "Bino butunlay", "The whole building"), "s": ml("915,7 м²", "915,7 m²", "915.7 m²")},
        {"b": ml("Второй этаж, зал", "Ikkinchi qavat, zal", "Second floor, the hall"), "s": ml("359,7 м²", "359,7 m²", "359.7 m²")},
        {"b": ml("Первый этаж", "Birinchi qavat", "First floor"),
         "s": ml("284,6 м² (сейчас три торговых помещения: 48,6 / 100,8 / 87,8 м²)",
                 "284,6 m² (hozir uchta savdo maydoni: 48,6 / 100,8 / 87,8 m²)",
                 "284.6 m² (currently three retail units: 48.6 / 100.8 / 87.8 m²)")},
        {"b": ml("Подвал", "Podval", "Basement"), "s": ml("271,4 м²", "271,4 m²", "271.4 m²")},
        {"b": ml("Зал второго этажа", "Ikkinchi qavat zali", "The second-floor hall"),
         "s": ml("свободная планировка со сценой, резные колонны и панджара, арочные ниши с подсветкой",
                 "sahnali erkin planirovka, o'ymakor ustunlar va panjara, yoritilgan arkali tokchalar",
                 "open plan with a stage, carved columns and panjara screens, illuminated arched niches")},
        {"b": ml("Кухня", "Oshxona", "Kitchen"),
         "s": ml("производственная зона с вытяжным зонтом, отдельный служебный вход и лестница",
                 "so'rg'ich soyabonli ishlab chiqarish zonasi, alohida xizmat kirishi va zinapoya",
                 "a production area with an extraction hood, a separate service entrance and staircase")},
        {"b": ml("Кабины", "Kabinalar", "Private rooms"),
         "s": ml("отдельные кабинеты со столом на восемь человек",
                 "sakkiz kishilik stol bilan alohida xonalar",
                 "separate rooms with a table for eight")},
        {"b": ml("Входная группа", "Kirish guruhi", "Entrance"),
         "s": ml("отдельный вход в зал с улицы, мраморная лестница, гардероб",
                 "ko'chadan zalga alohida kirish, marmar zinapoya, garderob",
                 "a separate street entrance to the hall, a marble staircase and a cloakroom")}
    ],
    "vizAll": ml("Фотографии сделаны в июле 2026 года. Площади приведены по чертежам CASE и подлежат уточнению по фактическим обмерам.",
                 "Suratlar 2026 yil iyulida olingan. Maydonlar CASE chizmalari bo'yicha berilgan va haqiqiy o'lchovlar bo'yicha aniqlashtiriladi.",
                 "The photographs were taken in July 2026. Areas follow the CASE drawings and are subject to verification by actual survey."),
    "images": [
        {"file": "hall-wide.jpg", "badge": ml("зал второго этажа", "ikkinchi qavat zali", "the second-floor hall"),
         "alt": ml("Зал ресторана OQ SAROY в Бухаре: резные колонны, сцена и арочные ниши",
                   "Buxorodagi OQ SAROY restorani zali: o'ymakor ustunlar, sahna va arkali tokchalar",
                   "The OQ SAROY restaurant hall in Bukhara: carved columns, a stage and arched niches")},
        {"file": "facade-night.jpg", "badge": ml("фасад вечером", "kechqurun fasad", "the facade at night"),
         "alt": ml("Фасад здания ресторана OQ SAROY в Бухаре вечером с подсвеченной вывеской",
                   "Buxorodagi OQ SAROY restoran binosi fasadi kechqurun yoritilgan peshlavha bilan",
                   "The facade of the OQ SAROY restaurant building in Bukhara at night with an illuminated sign")},
        {"file": "plan-f2.jpg", "badge": ml("план второго этажа", "ikkinchi qavat rejasi", "second floor plan"),
         "alt": ml("План второго этажа здания ресторана в Бухаре: зал 359,7 м² и лестницы",
                   "Buxorodagi restoran binosi ikkinchi qavati rejasi: 359,7 m² zal va zinapoyalar",
                   "Second floor plan of the restaurant building in Bukhara: a 359.7 m² hall and staircases")}
    ]
}

c['photos'] = {
    "nav": ml("Фото", "Suratlar", "Photos"),
    "lbl": ml("Фотографии", "Suratlar", "Photographs"),
    "h2": ml("Здание изнутри", "Bino ichkaridan", "Inside the building"),
    "sub": ml("Съёмка июля 2026 года: зал, кабины, входная группа, кухня и служебные зоны.",
              "2026 yil iyul surati: zal, kabinalar, kirish guruhi, oshxona va xizmat zonalari.",
              "Photographed in July 2026: the hall, private rooms, entrance, kitchen and service areas."),
    "note": ml("Мебель и оборудование на фотографиях остаются в здании. Точный перечень вышлем по запросу.",
               "Suratlardagi mebel va uskunalar binoda qoladi. Aniq ro'yxatni so'rov bo'yicha yuboramiz.",
               "The furniture and equipment in the photographs stay in the building. The exact list is available on request."),
    "images": [
        {"file": "hall-stage.jpg", "badge": ml("зал и сцена", "zal va sahna", "hall and stage")},
        {"file": "hall-wide.jpg", "span": "wide", "badge": ml("зал второго этажа", "ikkinchi qavat zali", "second-floor hall")},
        {"file": "vip-1.jpg", "badge": ml("кабина", "kabina", "private room")},
        {"file": "vip-2.jpg", "badge": ml("кабина", "kabina", "private room")},
        {"file": "vip-3.jpg", "badge": ml("кабина", "kabina", "private room")},
        {"file": "lounge.jpg", "badge": ml("зона кабин", "kabinalar zonasi", "private room area")},
        {"file": "entrance.jpg", "badge": ml("вход с улицы", "ko'chadan kirish", "street entrance")},
        {"file": "lobby.jpg", "badge": ml("входная группа", "kirish guruhi", "entrance hall")},
        {"file": "stairs-1.jpg", "badge": ml("лестница в зал", "zalga zinapoya", "stairs to the hall")},
        {"file": "stairs-2.jpg", "badge": ml("лестница", "zinapoya", "staircase")},
        {"file": "kitchen.jpg", "badge": ml("кухня", "oshxona", "kitchen")},
        {"file": "kitchen-2.jpg", "badge": ml("кухня", "oshxona", "kitchen")},
        {"file": "service-stairs.jpg", "badge": ml("служебная лестница", "xizmat zinapoyasi", "service staircase")},
        {"file": "cloakroom.jpg", "badge": ml("гардероб", "garderob", "cloakroom")},
        {"file": "facade-night-2.jpg", "span": "wide", "badge": ml("фасад вечером", "kechqurun fasad", "the facade at night")}
    ]
}

c['location'] = {
    "h2": ml("Бухара, первая линия дороги", "Buxoro, yo'lning birinchi qatori", "Bukhara, on the first line of the road"),
    "address": ml("Бухара, улица Сергея Юренева", "Buxoro, Sergey Yurenev ko'chasi", "Bukhara, Sergey Yurenev street"),
    "lat": 39.759581, "lng": 64.447171,
    "metroNote": ml("", "", ""),
    "drive": [],
    "around": ml(
        "Здание стоит на первой линии дороги на въезде в город, напротив площади New Bukhara City. По соседству гостиницы Turon Plaza и The Tower Bukhara, рядом заправка и торговые точки. Исторический центр Бухары с Ляби-Хаузом и Пои-Калян в нескольких минутах на машине.",
        "Bino shaharga kiraverishda yo'lning birinchi qatorida, New Bukhara City maydoni ro'parasida joylashgan. Yonida Turon Plaza va The Tower Bukhara mehmonxonalari, yaqinida yoqilg'i quyish shoxobchasi va savdo nuqtalari. Labi Hovuz va Poyi Kalon bilan Buxoroning tarixiy markazi mashinada bir necha daqiqada.",
        "The building stands on the first line of the road at the entrance to the city, opposite the New Bukhara City square. The Turon Plaza and The Tower Bukhara hotels are next door, with a filling station and shops nearby. The historic centre of Bukhara with Lyabi-Hauz and Poi-Kalyan is a few minutes away by car.")
}

c['faq'] = [
    {"q": ml("Какая площадь сдаётся и как считается аренда?",
             "Qancha maydon ijaraga beriladi va ijara qanday hisoblanadi?",
             "What area is leased and how is the rent calculated?"),
     "a": ml("Здание целиком - 915,7 м²: подвал 271,4, первый этаж 284,6, второй этаж 359,7 м². Поскольку объект передаётся одному оператору, арендной площадью считается общая площадь. Если берётся только второй этаж, аренда считается от его площади - 359,7 м².",
             "Bino butunlay - 915,7 m²: podval 271,4, birinchi qavat 284,6, ikkinchi qavat 359,7 m². Obyekt bitta operatorga topshirilgani uchun ijara maydoni sifatida umumiy maydon olinadi. Faqat ikkinchi qavat olinsa, ijara uning maydonidan - 359,7 m² dan hisoblanadi.",
             "The whole building is 915.7 m²: a 271.4 m² basement, a 284.6 m² first floor and a 359.7 m² second floor. As the property goes to a single operator, the gross area is treated as the leasable area. If only the second floor is taken, rent is counted from its area of 359.7 m².")},
    {"q": ml("Что с торговыми помещениями на первом этаже?",
             "Birinchi qavatdagi savdo maydonlari nima bo'ladi?",
             "What about the retail units on the ground floor?"),
     "a": ml("Сейчас на первом этаже три торговых помещения: 48,6, 100,8 и 87,8 м². При аренде здания целиком они освобождаются и передаются оператору - под зал, кофейню, витрину или служебные зоны.",
             "Hozir birinchi qavatda uchta savdo maydoni bor: 48,6, 100,8 va 87,8 m². Bino butunlay ijaraga olinganda ular bo'shatiladi va operatorga topshiriladi - zal, kafe, vitrina yoki xizmat zonalari uchun.",
             "Today the ground floor holds three retail units of 48.6, 100.8 and 87.8 m². When the whole building is leased they are vacated and handed to the operator for a hall, a coffee shop, a shopfront or back-of-house.")},
    {"q": ml("Готово ли здание к работе ресторана?",
             "Bino restoran ishlashi uchun tayyormi?",
             "Is the building ready for a restaurant to operate?"),
     "a": ml("Отделка выполнена: зал в национальном стиле, кабины, гардероб, санузлы, входная группа с мраморной лестницей. В производственной зоне установлен вытяжной зонт. Перечень остающегося оборудования вышлем по запросу.",
             "Pardoz bajarilgan: milliy uslubdagi zal, kabinalar, garderob, sanuzellar, marmar zinapoyali kirish guruhi. Ishlab chiqarish zonasida so'rg'ich soyabon o'rnatilgan. Qoladigan uskunalar ro'yxatini so'rov bo'yicha yuboramiz.",
             "The fit-out is done: a national-style hall, private rooms, a cloakroom, restrooms and an entrance with a marble staircase. An extraction hood is installed in the production area. The list of equipment that stays is available on request.")},
    {"q": ml("Можно ли переделать интерьер под свою концепцию?",
             "Interyerni o'z konsepsiyasi ostida qayta qurish mumkinmi?",
             "Can the interior be reworked for our own concept?"),
     "a": ml("Да. Зал второго этажа - свободная планировка, перегородки внутри зала не несущие. Объём изменений и порядок согласования обсуждаются при подписании договора.",
             "Ha. Ikkinchi qavat zali - erkin planirovka, zal ichidagi to'siqlar yuk ko'taruvchi emas. O'zgarishlar hajmi va kelishuv tartibi shartnoma imzolashda muhokama qilinadi.",
             "Yes. The second-floor hall is open plan and the partitions inside it are non-structural. The scope of changes and the approval process are agreed when the lease is signed.")},
    {"q": ml("Какая ставка аренды?", "Ijara narxi qanday?", "What is the rent?"),
     "a": ml("Ставка и срок договора обсуждаются индивидуально и зависят от того, берётся здание целиком или только второй этаж. Оставьте контакты - вышлем условия.",
             "Narx va shartnoma muddati individual muhokama qilinadi va bino butunlay yoki faqat ikkinchi qavat olinishiga bog'liq. Kontaktlaringizni qoldiring - shartlarni yuboramiz.",
             "The rate and the term are agreed individually and depend on whether the whole building or only the second floor is taken. Leave your contacts and we will send the terms.")},
    {"q": ml("Есть ли парковка?", "Avtoturargoh bormi?", "Is there parking?"),
     "a": ml("Перед зданием открытая площадка вдоль дороги, рядом парковка гостиницы Turon Plaza. Точное число мест уточняется.",
             "Bino oldida yo'l bo'ylab ochiq maydoncha, yonida Turon Plaza mehmonxonasi avtoturargohi. Aniq joylar soni aniqlashtirilmoqda.",
             "There is an open area along the road in front of the building, and the Turon Plaza hotel car park is next door. The exact number of spaces is being confirmed.")}
]

c['lead'] = {
    "h2": ml("Запросить условия аренды", "Ijara shartlarini so'rash", "Request the lease terms"),
    "sub": ml("Оставьте контакты - вышлем условия, перечень оборудования и согласуем осмотр в Бухаре.",
              "Kontaktlaringizni qoldiring - shartlarni, uskunalar ro'yxatini yuboramiz va Buxoroda ko'rikni kelishamiz.",
              "Leave your contacts and we will send the terms and the equipment list, and arrange a viewing in Bukhara.")
}

c['footer'] = {
    "legal": ml(
        "CASE Real Estate Advisory выступает агентом собственника здания. Информация на сайте носит справочный характер и не является публичной офертой.",
        "CASE Real Estate Advisory bino egasining agenti sifatida ish yuritadi. Saytdagi ma'lumot ma'lumot xarakteriga ega va ommaviy oferta emas.",
        "CASE Real Estate Advisory acts as the agent of the building owner. The information on this site is for reference only and does not constitute a public offer."),
    "area": ml(
        "Площади приведены по чертежам CASE и подлежат уточнению по фактическим обмерам.",
        "Maydonlar CASE chizmalari bo'yicha berilgan va haqiqiy o'lchovlar bo'yicha aniqlashtiriladi.",
        "Areas follow the CASE drawings and are subject to verification by actual survey.")
}

c['pres'] = {
    "aboutImg": "hall-wide.jpg",
    "aboutImgFit": "cover",
    "mapImg": "",
    "vizImgs": ["facade-night.jpg", "plan-f2.jpg"],
    "T": {
        "addr": ml("OQ SAROY · Бухара", "OQ SAROY · Buxoro", "OQ SAROY · Bukhara"),
        "h_about": ml("Готовое здание ресторана в Бухаре",
                      "Buxorodagi tayyor restoran binosi",
                      "A turnkey restaurant building in Bukhara"),
        "h_grid": ml("Здание изнутри", "Bino ichkaridan", "Inside the building"),
        "c_h": ml("Обсудим аренду?", "Ijarani muhokama qilamizmi?", "Shall we discuss the lease?"),
        "c_s": ml("Ответим в течение дня - условия, перечень оборудования, осмотр.",
                  "Kun davomida javob beramiz - shartlar, uskunalar ro'yxati, ko'rik.",
                  "We reply within the day: terms, equipment list, viewing.")
    }
}

c['fin'] = {"siteArea": 0, "footprint": 0, "gba": 915.7, "gla": 915.7}

json.dump(c, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('готово:', OUT)
print('фото в сетке:', len(c['photos']['images']), '| вопросов:', len(c['faq']))
