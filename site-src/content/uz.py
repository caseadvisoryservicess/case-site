# -*- coding: utf-8 -*-
"""Oʻzbekcha versiya. Tuzilishi ru.py bilan bir xil, kalitma kalit.

Matn qoidalari: tire ishlatilmaydi, blokning birinchi jumlasi sarlavhadagi
savolga javob beradi, har bir blok mustaqil va 40 dan 150 gacha soʻzdan iborat,
asosi koʻrsatilmagan raqam yozilmaydi.
Imlo: oʻ va gʻ harflari toʻgʻri belgilar bilan yoziladi.
"""

L = {
    "code": "uz",
    "label": "UZ",
    "name": "Oʻzbekcha",
    "locale": "uz_UZ",

    "ui": {
        "skip": "Asosiy qismga oʻtish",
        "menu": "Menyu",
        "lang_nav": "Til tanlash",
        "home_crumb": "Bosh sahifa",
        "updated": "Yangilangan",
        "read_more": "Batafsil",
        "all_projects": "Butun portfel",
        "back_to_projects": "Barcha loyihalar",
        "basis": "Raqamning asosi",
        "tbd_prefix": "Maʼlumot kerak:",
        "sending": "Yuborilmoqda",
        "sent": "Qabul qilindi. 48 soat ichida javob beramiz.",
        "send_error": "Yuborilmadi. support@caseadvisory.uz manziliga yozing yoki qoʻngʻiroq qiling.",
        "too_fast": "Shakl juda tez toʻldirildi. Maydonlarni tekshirib, qayta yuboring.",
        "required": "majburiy",
        "shown": "Koʻrsatilgan",
        "of": "dan",
        "projects_word": "loyiha",
    },

    "nav": [
        ("services", "Xizmatlar"),
        ("feasibility", "Feasibility"),
        ("projects", "Loyihalar"),
        ("about", "Firma haqida"),
        ("insights", "Nashrlar"),
        ("leasing", "Ijara"),
        ("contact", "Aloqa"),
    ],
    "nav_cta": "Maslahat",

    "meta": {
        "home": {
            "title": "CASE Advisory: nima qurish va qancha keltiradi",
            "desc": "Toshkentda mustaqil tijorat koʻchmas mulk ekspertizasi: yerda nima qurish va bu qancha daromad keltiradi. Javob loyihalash boshlanishidan oldin.",
        },
        "feasibility": {
            "title": "CASE Feasibility: loyihalashdan oldingi model",
            "desc": "Obyektning toʻliq moliyaviy modeli: stsenariylar, sezgirlik tahlili, bank uchun alohida versiya va DSCR 1,30 dan pastga tushadigan nuqta.",
        },
        "services": {
            "title": "CASE xizmatlari: T1 dan T4 gacha toʻrt format",
            "desc": "Konsepsiya, moliyaviy model, toʻliq sikl va vazifaga moslangan tarkib. Har bir formatga nima kiradi, nima kirmaydi va qaysi bosqichda qoʻshilamiz.",
        },
        "projects": {
            "title": "CASE loyihalari: portfel reyestri",
            "desc": "7 mamlakatda 42 loyiha. Obyekt parametrlari va CASE roli koʻrsatilgan reyestr. Nomlar faqat yozma rozilik boʻlganda ochiladi.",
        },
        "leasing": {
            "title": "CASE ijara: tasdiqlangan strategiyani amalga oshirish",
            "desc": "Ijarani biz maydon toʻldirish emas, tasdiqlangan konsepsiyani bajarish sifatida olib boramiz. Manfaatlar toʻqnashuvi siyosati alohida chop etilgan.",
        },
        "insights": {
            "title": "CASE nashrlari: bozor tahlili",
            "desc": "Oʻzbekiston va mintaqadagi tijorat koʻchmas mulk bozori tahlili, raqamlari va manbalari koʻrsatilgan holda. Birinchi son tayyorlanmoqda.",
        },
        "about": {
            "title": "CASE Real Estate Advisory haqida",
            "desc": "Tijorat koʻchmas mulk sohasidagi mustaqil konsalting firmasi. 2022 yilda Toshkentda tashkil etilgan. Metod, jamoa va tekshiriladigan raqamlar.",
        },
        "contact": {
            "title": "CASE Advisory bilan bogʻlanish, Toshkent",
            "desc": "Yer uchastkasi va loyiha bosqichini yozing. 48 soat ichida javob beramiz. Telefon +998 77 047 73 75, pochta support@caseadvisory.uz.",
        },
        "privacy": {
            "title": "CASE maxfiylik siyosati",
            "desc": "CASE Advisory sayti qanday maʼlumot yigʻadi, u nima uchun kerak, qancha saqlanadi va uni qanday oʻchirish mumkin.",
        },
        "conflicts": {
            "title": "CASE manfaatlar toʻqnashuvi siyosati",
            "desc": "CASE konsaltingni ijaradan qanday ajratadi, mijozga nimani ochiq aytadi va qanday mandatlardan voz kechadi.",
        },
    },

    "home": {
        "slogan": ["Bitimdan oldin.", "Chizmadan oldin."],
        "h1": "Bu yerda nima qurish va bu qancha keltiradi. Javob loyihalash boshlanishidan oldin.",
        "sub": "CASE bu mustaqil tijorat koʻchmas mulk ekspertizasi: loyihalashdan oldin nimani qurish va bu qancha daromad keltirishini aniqlaymiz.",
        "cta1": "Strategik maslahat olish",
        "cta2": "Feasibility sahifasi",
        "hero_facts_label": "Tekshirsa boʻladigan raqamlar",
        "hero_facts": [
            ("2022", "firma tashkil etilgan yil"),
            ("42", "portfeldagi loyiha, 7 mamlakat"),
            ("48", "soat ichida javob beramiz"),
        ],

        "nots_num": "01",
        "nots_title": "Biz kim emasmiz",
        "nots_lead": "Toifani inkor orqali aytish osonroq. Biz chizma paydo boʻlishidan oldin qabul qilinadigan qaror uchun javob beramiz.",
        "nots": [
            {
                "t": "Biz arxitektura byurosi emasmiz",
                "d": "Biz ishchi hujjatlar chiqarmaymiz va fasad chizmaymiz. Arxitektorga texnik topshiriq beramiz: format, maydonlarning toifalar boʻyicha taqsimoti, korpus chuqurligi, oqimlar. Undan keyingisini arxitektor loyihalaydi.",
            },
            {
                "t": "Biz broker emasmiz",
                "d": "Biz maydon sotmaymiz. Berilgan konsepsiyada u qancha keltirishini hisoblaymiz va hisob qaysi shartlarda buzilishini koʻrsatamiz.",
            },
            {
                "t": "Biz baholovchi emasmiz",
                "d": "Biz bank yoki sud uchun qiymat hisobotini imzolamaymiz. Biz qaror uchun javob beramiz: nima qurish, kim uchun va qanday hajmda, hamda shu qarordan kelib chiqadigan pul oqimi prognozi uchun.",
            },
        ],
        "nots_caveat": "Ijara haqida alohida. Bizda ijara yoʻnalishi bor va bu manfaatlar toʻqnashuvi ehtimoli. Buni shartnoma imzolanishidan oldin yozma ochib beramiz va firma ichida rollarni ajratamiz.",
        "nots_caveat_link": "Manfaatlar toʻqnashuvi siyosati",

        "chain_num": "02",
        "chain_title": "Qarorlar zanjiri va biz ishlaydigan joy",
        "chain_lead": "01 dan 03 gacha boʻlgan bosqichlarni bugun sotamiz. Xato narxi shu yerda eng yuqori, tuzatish narxi esa eng past: jadval oʻzgaradi, qurilgan bino emas.",
        "chain": {
            "land": ("Yer uchastkasi", "Kirishda nima bor: chegaralar, kirish yoʻllari, cheklovlar, yuklamalar, atrof.", "Bugun sotamiz"),
            "market": ("Bozor", "Yaqin atrofda kim bor, nima yetishmaydi, qamrov zonasida necha kishi va ularning imkoniyati qanday.", "Bugun sotamiz"),
            "concept": ("Konsepsiya", "Format, maydon, toifalar boʻyicha taqsimot, zonalash, mix, tekshiruv rejasi.", "Bugun sotamiz"),
            "model": ("Moliyaviy model", "Stsenariylar, sezgirlik, uzilish nuqtasi, bank uchun versiya.", "Keyingi qadam"),
            "brief": ("Arxitektorga topshiriq", "Hajm, oqimlar, muhandislik va maydonlarga talablar, yozma shaklda.", "Keyingi qadam"),
            "leasing": ("Ijara", "Tasdiqlangan strategiyani bajarish: ijarachilar puli, shartlar, jadval.", "Zanjirda keyinroq"),
            "opening": ("Ochilish", "Ishga tushirish, birinchi oylar va prognozni fakt bilan solishtirish.", "Zanjirda keyinroq"),
        },
        "chain_legend": ["Bugun sotamiz", "Keyingi qadam", "Zanjirda keyinroq"],
        "chain_hint": "Yon tomonga suring yoki sahifani aylantiring",

        "tiers_num": "03",
        "tiers_title": "Toʻrt ish formati",
        "tiers_lead": "Formatlar bitta narsa bilan farq qiladi: qarorni qaysi bosqichgacha yetkazamiz va uni moliyalashtiradigan raqam uchun javobgarlikni olamizmi.",
        "tiers_more": "Nima kiradi va nima kirmaydi",
        "tiers_all": "Formatlarni solishtirish",

        "scen_num": "04",
        "scen_title": "Qaror qiladigan raqamlar",
        "scen_lead": "Arxitektor rasm koʻrsatadi. Biz raqamlardan qaror qanday tugʻilishini koʻrsatamiz. Bitta yer uchastkasi dastur turiga qarab turlicha natija beradi va bu farq loyihalashdan oldin koʻrinadi, ochilishdan keyin emas.",
        "scen_steps": [
            {
                "t": "A stsenariy. Maksimal savdo",
                "d": "Butun maydon savdoga berilgan. Tez toʻlish, bitta talab manbaiga va langar ijarachiga yuqori bogʻliqlik. Langar ketsa, butun obyekt qulaydi.",
            },
            {
                "t": "B stsenariy. Aralash dastur",
                "d": "Savdo qoʻshimcha ofis yoki xizmat bilan. Kvadrat metrga choʻqqi daromad pastroq, barqarorlik yuqoriroq: ikki xil oqim tsiklning turli fazalarida ijara toʻlaydi.",
            },
            {
                "t": "C stsenariy. Ushlab turishga qaratilgan dastur",
                "d": "Ijaraga beriladigan maydon kamroq, jamoat maydoni va parkovka koʻproq. Boshlangʻich tushum pastroq, takroriy tashriflar va oʻrtacha chek uzoq muddatda yuqoriroq.",
            },
        ],
        "scen_kpis": ["GLA, m2", "Oqim, kishi/yil", "Daromadlilik, %"],
        "scen_note": "Uch stsenariy boʻyicha qiymatlar haqiqiy hisobdan qoʻyiladi. U boʻlmaguncha shartli raqam koʻrsatmaymiz: faqat asosi koʻrsatilgan raqamlarni solishtirish mumkin.",
        "scen_cta": "Moliyaviy model qanday hisoblanadi",

        "cases_num": "05",
        "cases_title": "Uchta keys",
        "cases_lead": "Kartochka formati barcha loyihalar uchun bir xil: egasining vazifasi, kirish bosqichi, yechim, raqamlardagi natija, parametrlar va NDA izohi. Agar natijani ochiq koʻrsatib boʻlmasa, buni toʻgʻridan toʻgʻri yozamiz, sifatdosh bilan almashtirmaymiz.",

        "proof_num": "06",
        "proof_title": "Nimani tekshirish mumkin",
        "proof_lead": "Quyidagi har bir raqamning asosi koʻrsatilgan. Tekshirib boʻlmaydigan narsa saytda yoʻq.",
        "proof": [
            {
                "n": "2022", "l": "CASE tashkil etilgan yil",
                "note": "Firma 2022 yilda tashkil etilgan. Eski saytdagi «bozorda 7 yildan ortiq» iborasi olib tashlandi: u tashkil etilgan sana bilan mos kelmaydi.",
            },
            {
                "n": "42", "l": "portfeldagi loyiha",
                "note": "Ochiq portfel reyestri. Eski saytdagi 89 raqami olib tashlandi: portfelda hech qachon shuncha boʻlmagan.",
            },
            {
                "n": "7", "l": "mamlakat",
                "note": "Portfel loyihalari mavjud mamlakatlar hisoblanadi. Ilgari 8 deb koʻrsatilgan edi, bu xato edi.",
            },
            {
                "n": "8,1", "l": "mln m2 GBA",
                "note": "CASE 2022 yilda tashkil etilishidan oldin jamoa aʼzolari bajargan ishlarni ham hisobga olgan holda. Bu izohsiz raqam notoʻgʻri boʻladi.",
            },
            {
                "n": "48", "l": "soat ichida javob",
                "note": "Ish kunlarida murojaatga birinchi mazmunli javob berish muddati boʻyicha majburiyatimiz.",
            },
        ],
        "proof_icsc_label": "ICSC aʼzoligi",

        "islam_num": "07",
        "islam_title": "Islom moliyasi",
        "islam_lead": "Biz moliyaviy modelning shariat vositalariga moslangan versiyasini tayyorlaymiz. Bu bozorda buni hech kim qilmaydi.",
        "islam_body": [
            "Oʻzbekistonda islom bankchiligi toʻgʻrisidagi qonun 27.03.2026 da imzolangan va 29.06.2026 da kuchga kirgan. 2026 yil davomida kamida bitta islomiy oyna ochiladi. Bu hisobni oʻzgartiradi: foizli kredit obyektni moliyalashtirishning yagona yoʻli boʻlmay qoladi.",
            "Amalda bu ikki narsani anglatadi. Birinchisi: moliyalashtirish tuzilmasi foizli qarz oʻrniga murobaha, ijara yoki musharaka asosida yigʻiladi va pul oqimi shunga qayta hisoblanadi. Ikkinchisi: ijarachilar puli AAOIFI mezonlari boʻyicha tekshiruvdan oʻtadi, chunki ayrim ijarachi profillari obyektga bunday moliyalashtirish yoʻlini butunlay yopadi.",
        ],
        "islam_disclaimer": "Bu fatvo emas. Yakuniy xulosani malakali shariat mutaxassisi yoki bankning shariat kengashi beradi. Biz hisob va bunday koʻrib chiqishga hujjat tayyorlash uchun javob beramiz.",

        "faq_num": "08",
        "faq_title": "Birinchi uchrashuvdan oldin beriladigan savollar",

        "contact_num": "09",
        "contact_title": "Suhbatni boshlash",
        "contact_lead": "Yer uchastkasi va bosqichni yozing. 48 soat ichida javob beramiz va birinchi qoʻngʻiroqda ishimiz sizga umuman kerakmi yoʻqmi, toʻgʻridan toʻgʻri aytamiz.",
    },

    "tiers": {
        "T1": {
            "name": "CASE Concept",
            "tag": "«Nima qurish»",
            "desc": "Bu yerda nima turishi va qanday hajmda boʻlishi kerakligiga javob beradi.",
            "in": [
                "Obyekt konsepsiyasi va pozitsiyalash",
                "Merchandise mix va zonalash",
                "Tekshiruv rejasi",
                "Arxitektorga texnik topshiriq",
                "Yoʻnaltiruvchi darajadagi moliyaviy model",
            ],
            "out": "Kirmaydi: stsenariyli toʻliq moliyaviy model va bank uchun versiya.",
        },
        "T2": {
            "name": "CASE Feasibility",
            "tag": "«Nima qurish va qancha keltiradi»",
            "desc": "T1 dagi hamma narsa va bank hamda hamkor bilan suhbatda tayanish mumkin boʻlgan toʻliq moliyaviy model.",
            "in": [
                "T1 tarkibining hammasi",
                "Stsenariylar boʻyicha toʻliq moliyaviy model",
                "Sezgirlik tahlili va uzilish nuqtasi",
                "Kredit qoʻmitasi uchun alohida versiya",
                "Ochilishdan 12 oy keyin prognozni fakt bilan solishtirish",
            ],
            "out": "Kirmaydi: loyihalashni kuzatib borish va ijara.",
        },
        "T3": {
            "name": "CASE Full Cycle",
            "tag": "«Yerdan ochilishgacha»",
            "desc": "T2 dagi hamma narsa va loyihalashni kuzatib borish, ijara strategiyasi hamda hisobotdan keyin olti oy hamrohlik.",
            "in": [
                "T2 tarkibining hammasi",
                "Loyihalashni kuzatib borish va topshiriq nazorati",
                "Ijara strategiyasi",
                "Hisobot topshirilgandan keyin olti oy hamrohlik",
            ],
            "out": "Kirmaydi: ishchi hujjatlar va bosh pudratchi vazifalari.",
        },
        "T4": {
            "name": "CASE Custom",
            "tag": "«Vazifaga qarab yigʻiladi»",
            "desc": "Tarkib aniq savol atrofida yigʻiladi, narx norma soat boʻyicha. Bozorlar, parklar, redevelopment va begona hisobotga ikkinchi fikr uchun.",
            "in": [
                "Tarkib aniq savol atrofida yigʻiladi",
                "Tayyor konsepsiya yoki modelga ikkinchi fikr",
                "Bozorlar, parklar, redevelopment, nostandart formatlar",
                "Toʻlov norma soat boʻyicha",
            ],
            "out": "Kirmaydi: qatʼiy belgilangan hajm. U ish boshlanishidan oldin aniqlanadi va shartnomada qayd etiladi.",
        },
        "flags": {"priority": "Sotuvda ustuvor", "anchor": "Langar"},
        "labels": {"time": "Muddat", "price": "Narx oraligʻi", "in": "Nima kiradi", "out": "Chegaralar"},
    },

    "services": {
        "h1": "Toʻrt format va har birining chegarasi",
        "lead": "Biz hisobotning qalinligini emas, qarorni sotamiz. Quyida: har bir formatga nima kiradi, u nima bilan tugaydi va javobgarligimiz chegarasi qayerda.",
        "intro_num": "01",
        "intro_title": "Formatni qanday tanlash kerak",
        "intro_body": [
            "Format bitta belgi boʻyicha tanlanadi: ishni topshirganimizdan keyin nimadan foydalanasiz. Bu yerda umuman nima qurish maʼqulligini bilish kerak boʻlsa, bu T1. Qaror moliyalashtiriladigan va uni kredit qoʻmitasi yoki hamkor oldida himoya qilish kerak boʻlsa, bu T2. Qabul qilingan qaror ochilishgacha buzilmay yetib borishini istasangiz, bu T3. Savol tor yoki obyekt nostandart boʻlsa, bu T4.",
            "Agar ish sizga kerak emas deb hisoblasak, undan voz kechamiz. Bu ikkala tomon uchun ham javonga qoʻyiladigan hisobotdan arzonroq.",
        ],
        "compare_num": "02",
        "compare_title": "Formatlarni solishtirish",
        "compare_head": ["Nimani olasiz", "T1", "T2", "T3", "T4"],
        "compare_rows": [
            ("Konsepsiya va pozitsiyalash", 1, 1, 1, 0),
            ("Merchandise mix va zonalash", 1, 1, 1, 0),
            ("Tekshiruv rejasi", 1, 1, 1, 0),
            ("Arxitektorga texnik topshiriq", 1, 1, 1, 0),
            ("Moliyaviy model, yoʻnaltiruvchi", 1, 1, 1, 0),
            ("Stsenariyli toʻliq model", 0, 1, 1, 0),
            ("Sezgirlik tahlili va uzilish nuqtasi", 0, 1, 1, 0),
            ("Kredit qoʻmitasi uchun versiya", 0, 1, 1, 0),
            ("Loyihalashni kuzatib borish", 0, 0, 1, 0),
            ("Ijara strategiyasi", 0, 0, 1, 0),
            ("Prognozni fakt bilan solishtirish", 0, 1, 1, 0),
            ("Aniq vazifa uchun tarkib", 0, 0, 0, 1),
        ],
        "compare_yes": "kiradi",
        "compare_no": "kirmaydi",
        "compare_custom": "kelishuv boʻyicha, hajm ish boshlanishidan oldin qayd etiladi",
        "not_num": "03",
        "not_title": "Hech bir formatda qilmaydigan ishlarimiz",
        "not_items": [
            "Ishchi hujjatlar va mualliflik nazorati. Bu arxitektura byurosining ishi.",
            "Bank yoki sud uchun baholash hisoboti. Bu litsenziyali baholovchining ishi.",
            "Tasdiqlangan konsepsiyasiz maydon sotish. Toʻldirish uchun toʻldirish obyekt qiymatini tushiradi.",
            "Oldindan belgilangan natijaga raqamlarni moslashtirish. Model chiqmasa, chiqmadi deb yozamiz.",
        ],
    },

    "feasibility": {
        "eyebrow": "T2 CASE Feasibility",
        "h1": "Kredit qoʻmitasi oldida himoya qilinadigan moliyaviy model",
        "lead": "Feasibility egasining ikkinchi savoliga javob beradi: bu yerda nima qurish emas, balki qancha keltiradi va qaysi shartlarda keltirmay qoʻyadi.",
        "cta": "Loyihani muhokama qilish",
        "s1_num": "01",
        "s1_title": "Qaysi savolga javob beradi",
        "s1_body": [
            "Feasibility obyektning loyiha ufqidagi pul oqimini va u ishlashda davom etadigan chegaralarni koʻrsatadi. Biz bitta raqamni emas, maydonni hisoblaymiz: asosiy stsenariy, konservativ va stress stsenariy, hamda alohida qarz xizmati operatsion oqim bilan qoplanmay qoladigan nuqta.",
            "Amalda bu shuni anglatadiki, siz daromad vaʼdasini emas, chegaralari koʻrsatilgan risk xaritasini olasiz. Qarorni siz qabul qilasiz, lekin uni ijara stavkasi, boʻsh maydon yoki ochilish kechikishi qaysi darajada hisobni buzishini bilib turib qabul qilasiz.",
        ],
        "s2_num": "02",
        "s2_title": "Hisobot ichida nima bor",
        "s2_lead": "Mavzular roʻyxati emas, haqiqiy hisobotning mundarijasi.",
        "toc": [
            ("Egasi uchun rezyume", "Qaror, raqamlar va risklar ikki sahifada. Birinchi va alohida oʻqiladi."),
            ("Yer uchastkasi va cheklovlar", "Chegaralar, kirish, yuklamalar, balandlik va qurilish cheklovlari, ulardan qaysi biri dasturga taʼsir qiladi."),
            ("Qamrov zonasi va talab", "Qamrov zonasiga kim kiradi, necha kishi, xarid qobiliyati qanday, sigʻim qanday hisoblangan."),
            ("Raqobat va pipeline", "Mavjud obyektlar va eʼlon qilinganlari. Siz ochilguningizcha nima oʻzgaradi."),
            ("Dastur va maydon taqsimoti", "Format, GLA, toifalar boʻyicha taqsimot, langarlar, tekshiruv rejasi."),
            ("Operatsion faraz", "Toifalar boʻyicha stavkalar, boʻsh maydon, service charge, OPEX, indeksatsiya, rent free."),
            ("Investitsiya xarajatlari", "Moddalar boʻyicha CAPEX, oʻzlashtirish jadvali, manbalar va shartlar."),
            ("Moliyaviy model", "Pul oqimi, NPV, IRR, qoplanish muddati, yillar boʻyicha DSCR."),
            ("Stsenariylar va sezgirlik", "Asosiy, konservativ, stress. Har bir faraz oʻzgarganda nima boʻladi."),
            ("Uzilish nuqtasi", "DSCR 1,30 dan pastga tushadigan stavka, boʻsh maydon va kechikish kombinatsiyasi."),
            ("Bank uchun versiya", "Kredit qoʻmitasi talablariga moslangan alohida hujjat."),
            ("Manbalar reyestri", "Har bir raqam boʻyicha manba, sana va maʼlumot turi."),
        ],
        "s3_num": "03",
        "s3_title": "Bank uchun versiya",
        "s3_body": [
            "Kredit qoʻmitasi konsepsiyaga emas, obyektning qarzni toʻlay olishiga qaraydi. Shu sababli bank versiyasi alohida yigʻiladi: u pozitsiyalash va rasmlardan emas, toʻlov jadvali, yillar boʻyicha DSCR va stress testdan boshlanadi.",
            "Unda qoʻmita odatda birinchi boʻlib eʼtiroz bildiradigan farazlar ochiq nomlanadi: rejadagi toʻlishga chiqish muddati, langar ijarachining barqarorligi, stavkalar indeksatsiyasi va ochilish kechikishi. Har bir faraz boʻyicha manba va sana koʻrsatiladi.",
        ],
        "s4_num": "04",
        "s4_title": "DSCR 1,30 uzilish nuqtasi",
        "s4_body": [
            "Biz operatsion oqimning qarz xizmatiga nisbati 1,30 dan pastga tushadigan shartlar kombinatsiyasini aytamiz. Bu hisobotning bezagi emas, mazmuni: egasi va bank stavka, boʻsh maydon va kechikishning qaysi qoʻshilmasi loyihani xavfsiz yoʻlakdan chiqarishini oldindan koʻradi.",
            "1,30 chegarasi tijorat koʻchmas mulk uchun odatiy kovenant sifatida olingan. Bankingiz boshqa qiymat bilan ishlasa, model unga qayta hisoblanadi va hisobotda kimning talabi qoʻllanilgani koʻrsatiladi.",
        ],
        "s5_num": "05",
        "s5_title": "Prognozni fakt bilan solishtirish",
        "s5_body": [
            "Ochilishdan 12 oy oʻtgach egasiga va bankka prognozni fakt bilan oʻzimiz solishtirgan hujjatni yuboramiz: model qayerda toʻgʻri chiqdi, qayerda adashdi va nima uchun. Bu majburiyat T2 va T3 tarkibiga kiradi.",
            "Buni shuning uchun qilamizki, oʻz prognozini hech qachon tekshirmaydigan konsalting oddiy fikrdan farq qilmaydi. Bu solishtirish bizga obroʻ riskini keltiradi va aynan shu sababli sizga foydali.",
        ],
        "s6_num": "06",
        "s6_title": "Muddat, narx va hisobot parchasi",
        "excerpt_title": "Hisobotning obezlashtirilgan parchasi",
        "excerpt_body": "Haqiqiy hisobotning ikki sahifasi, nom va manzillar yopilgan holda: farazlar jadvali qanday koʻrinadi va xulosa qanday koʻrinadi. Pochtaga yuboramiz.",
        "excerpt_cta": "Parchani olish",
        "excerpt_email": "Ish pochtasi",
        "stage_caption": "Hajm sxemasi: savdo qismini oʻz ichiga olgan stilobat va uning ustidagi daromadli qism. Sahna faqat kompyuterda va faqat qurilma koʻtara olsa ishga tushadi.",
        "stage_figs": [("GBA", "umumiy maydon"), ("GLA", "ijaraga yaroqli"), ("DSCR", "qarz qoplami")],
    },

    "projects": {
        "h1": "Portfel reyestri",
        "lead": "7 mamlakatda 42 loyiha. Quyida reyestr: obyekt parametrlari, CASE roli va ish davri. Egasi va obyekt nomi faqat yozma rozilik boʻlgan joyda ochiladi. Qolgani nomsiz koʻrsatiladi.",
        "policy_title": "Nega ayrim qatorlar yopiq",
        "policy_body": "Loyihalarning bir qismida oshkor qilmaslik shartnomalari amal qiladi, bir qismida esa nom va logotipni chop etishga rozilik hali olinmagan. Rozilik boʻlmaguncha obyektni nomsiz, lekin haqiqiy parametrlari bilan koʻrsatamiz. Bu egasining ruxsatisiz saytga logotip qoʻyishdan halolroq.",
        "filters_label": "Filtr",
        "filters": [("all", "Hammasi"), ("uz", "Oʻzbekiston"), ("tj", "Tojikiston"), ("sa", "Saudiya Arabistoni"), ("retail", "Savdo obyektlari"), ("mixed", "Mixed use")],
        "head": ["Obyekt", "Shahar", "GLA, m2", "CASE roli", "Qator holati"],
        "status_open": "Nomi ochilgan",
        "status_anon": "Nomsiz",
        "anon_names": {"mecca_retail": "Makkadagi savdo markazi, tafsilotlar soʻrov boʻyicha"},
        "pending_title": "Reyestrda yana qator bor",
        "pending_body": "Bu qatorlar barcha 42 loyiha boʻyicha NDA auditi tugagach va nom hamda logotiplarga yozma rozilik olingach chop etiladi.",
    },

    "case_labels": {
        "problem": "Egasining vazifasi",
        "stage": "Kirish bosqichi va sotilgan mahsulot",
        "solution": "Yechim",
        "result": "Raqamlardagi natija",
        "params": "Parametrlar",
        "nda": "Izoh",
        "city": "Shahar",
        "country": "Mamlakat",
        "investor": "Investor",
        "gla": "GLA",
        "year": "Yil",
        "role": "CASE roli",
        "why": "Bu keys nega bu yerda",
    },
    "countries": {"uz": "Oʻzbekiston", "tj": "Tojikiston", "sa": "Saudiya Arabistoni"},
    "cities": {"tashkent": "Toshkent", "dushanbe": "Dushanbe", "mecca": "Makka"},

    "cases": {
        "82-mall": {
            "name": "82 Mall / 82 Towers",
            "why": "Bitta obyektda konsepsiya va ijara: farqimiz amalda.",
            "problem": "Egasida Dushanbeda yer uchastkasi va yirik koʻp funksiyali obyekt qurish niyati bor edi. Ochiq qolgan asosiy savol shu edi: savdo qismi maydon va tarkib boʻyicha qanday boʻlishi kerakki, u toʻlsin va oqimni ushlab tursin, turar joy ostidagi boʻsh birinchi qavatga aylanmasin.",
            "stage": "Biz arxitektura qarorlari qayd etilishidan oldin qoʻshildik va loyihani zanjir boʻylab olib bordik: avval konsepsiya va merchandise mix, keyin tasdiqlangan strategiyani bajarish sifatida ijara.",
            "solution": "Savdo qismining formati va hajmi aniqlandi, toifalar boʻyicha taqsimot yigʻildi, zonalash belgilandi va reja oqimlarning bogʻliqligiga tekshirildi. Tasdiqlangan dastur ostida ijarachilar puli yigʻildi: avval langarlar, keyin hamrohlik qiluvchi toifalar. Ijara konsepsiya hisoblangan jadvalning oʻzida olib borildi, shuning uchun ijarachilar tarkibi hisobdan uzoqlashmadi.",
            "nda": "Tijorat shartlarining bir qismi egasi bilan shartnoma asosida yopiq. Faqat obyekt parametrlari va CASE roli chop etiladi.",
        },
        "chilonzor": {
            "name": "Chilonzor Shopping Center",
            "why": "Sovet davrida qurilgan obyektni qayta pozitsiyalash: toshkentlik egasi oʻz holatini taniydi.",
            "problem": "Toshkentda 1963 yilda qurilgan, maydon taqsimoti va ijarachilar tarkibi eskirgan ishlab turgan savdo markazi. Egasining savoli «qanday taʼmirlash» emas, «bu obyekt bugungi bozorda qanday rol oʻynashi kerakki, taʼmir oʻzini oqlasin» edi.",
            "stage": "Biz rekonstruksiya boʻyicha qaror bosqichida, loyiha tayyorlanishidan oldin qoʻshildik. Mahsulot: tekshiruv rejasi bilan konsepsiya va merchandise mix.",
            "solution": "Obyektning roli qayta yigʻildi: universal markazdan yaqin qamrov zonasining muntazam oqimiga ishlaydigan formatga oʻtkazildi. Maydon taqsimoti tashrif chastotasi yuqori toifalarga moslandi, kirish guruhi va vertikal aloqalar zonalashi qayta koʻrildi. Rekonstruksiya 2023 va 2024 yillarda tasdiqlangan dastur ostida oʻtkazildi.",
            "nda": "Obyekt nomi egasining roziligi bilan chop etilgan. Ijaraning tijorat shartlari oshkor qilinmaydi.",
        },
        "jabal-omar": {
            "name": "Jabal Omar",
            "why": "Salmoq va ishonch, rolimiz hamda ish davri boʻyicha halol izoh bilan.",
            "problem": "Makkada Masjidul Haram yonidagi koʻp funksiyali majmua. Savdo qismi boʻyicha vazifa: mavsumiyligi, tarkibi va xarid mantigʻi shahar riteylidan tubdan farq qiladigan ziyoratchilar oqimiga dastur yigʻish.",
            "stage": "Ish majmuaning savdo qismi boʻyicha olib borildi: riteyl strategiyasi, merchandise mix, zonalash va byudjet.",
            "solution": "Dastur odatiy shahar toifalar toʻplamiga emas, mavsumning choʻqqi yuklamasi va ziyoratchi xarajatlari tuzilishiga moslab yigʻildi. Zonalash masjidga va ortga boʻlgan oqimlarga boʻysundirildi: qisqa tashrif va yuqori oʻtkazuvchanlikda ishlaydigan toifalarga ustunlik berildi.",
            "nda": "CASE jamoasi aʼzolari bu loyihani firma 2022 yilda tashkil etilishidan oldin, boshqa jamoa tarkibida olib borgan. Buni ochiq yozamiz: firma tashkil etilishidan oldingi tajribani bunday izohsiz firmaga yozish notoʻgʻri boʻlardi.",
        },
    },

    "leasing": {
        "h1": "Ijara tasdiqlangan strategiyani bajarish sifatida",
        "lead": "Bizda ijara maydon toʻldirish boʻyicha alohida xizmat emas. Bu tasdiqlangan konsepsiyani bajarish: oʻsha mix, oʻsha jadval, model hisoblangan oʻsha farazlar.",
        "s1_num": "01",
        "s1_title": "Amalda bu nimani anglatadi",
        "s1_body": [
            "Ijara mandatini tasdiqlangan konsepsiya va tenant mix boʻlganda olamiz. Ular boʻlmasa, ijara boʻsh metrlarni kim chiqsa oʻsha bilan toʻldirishga aylanadi va ikki yildan keyin obyektni egasining hisobidan qayta pozitsiyalashga toʻgʻri keladi.",
            "Ishda langarlardan hamrohlik qiluvchi toifalarga qarab boramiz, toifalar ulushini tasdiqlangan dastur chegarasida ushlaymiz va pozitsiyalashni buzadigan ijarachilarga, hatto bozordan yuqori toʻlashga tayyor boʻlsa ham, rad javobini beramiz. Bu ayni damda noqulay va uzoq muddatda oʻzini oqlaydi.",
        ],
        "s2_num": "02",
        "s2_title": "Manfaatlar toʻqnashuvi",
        "s2_body": [
            "Ijara konsalting bilan manfaatlar toʻqnashuvini yuzaga keltiradi: dasturni tavsiya qiladigan firma uni amalga oshirishdan daromad olishi mumkin. Biz bu muammo yoʻqdek koʻrsatmaymiz.",
            "Toʻqnashuvni shartnoma imzolanishidan oldin yozma ochib beramiz, firma ichida rollarni ajratamiz va maslahatchi mukofotini shu obyekt boʻyicha ijara natijasiga bogʻlamaymiz. Egasi ijarani boshqa tomonga berishga haqli va bu bizning konsalting ishimizga taʼsir qilmaydi.",
        ],
        "s2_link": "Siyosatning toʻliq matni",
        "s3_num": "03",
        "s3_title": "Nima qilamiz va nima qilmaymiz",
        "do": [
            "Tasdiqlangan dastur ostida ijarachilar pulini yigʻamiz",
            "Muzokaralar olib boramiz va tijorat shartlarini tayyorlaymiz",
            "Toifalar ulushini konsepsiya chegarasida ushlaymiz",
            "Voronka boʻyicha hisobot beramiz: kontaktlar, LOI, imzolashlar",
        ],
        "dont": [
            "Tasdiqlangan dasturdan tashqarida maydon toʻldirmaymiz",
            "Qabul qilingan konsepsiyasiz mandat olmaymiz",
            "Bitta bitim boʻyicha bir vaqtda egasi va ijarachi uchun ishlamaymiz",
            "Egasi bilan suhbatda ijarani konsalting ustiga qoʻymaymiz",
        ],
        "do_title": "Qilamiz",
        "dont_title": "Qilmaymiz",
    },

    "insights": {
        "h1": "Nashrlar",
        "lead": "Raqamlari va manbalari koʻrsatilgan bozor tahlillari chiqadigan boʻlim.",
        "empty_title": "Birinchi son tayyorlanmoqda",
        "empty_body": [
            "Oʻzbekiston bozorida metodikasini raqamlari bilan birga chop etadigan muntazam ochiq manba yoʻq. Biz maslahatlar bilan toʻla yana bitta blog qoʻshmoqchi emas, shu boʻshliqni yopmoqchimiz.",
            "Birinchi material: bitta hisobning yer uchastkasidan xulosagacha boʻlgan tahlili, farazlari va manbalari ochiq holda. Uni birinchilardan boʻlib olishni istasangiz, pochtangizni qoldiring.",
        ],
        "cta": "Birinchi son haqida xabar berish",
        "email_label": "Ish pochtasi",
    },

    "about": {
        "h1": "Mustaqil tijorat koʻchmas mulk ekspertizasi",
        "lead": "CASE Real Estate Advisory bu tijorat koʻchmas mulk sohasidagi mustaqil konsalting firmasi. Biz qarorlarni hali oʻzgartirish mumkin boʻlgan bosqichda ishlaymiz: asosiy arxitektura qarorlari qayd etilishidan oldin.",
        "s1_num": "01",
        "s1_title": "Biz nima qilamiz",
        "s1_body": [
            "Biz obyektning tijorat va operatsion asosini shakllantiramiz: nima qurish, kim uchun, u qanday ishlashi va qanday daromad keltirishi kerak. Undan keyin arxitektor shu topshiriq ostida loyihalaydi, teskarisi emas.",
            "Obyekt turlari: savdo markazlari va mixed use, mehmonxonalar va kurortlar, biznes markazlar. Oʻzbekistonda va mintaqada ishlaymiz.",
        ],
        "s2_num": "02",
        "s2_title": "Metod: qatlamlar boʻylab pastga",
        "depth_out_label": "Natijada nima chiqadi",
        "s2_lead": "Har bir keyingi qatlam avvalgisiga tayanadi. Qatlamni oʻtkazib yuborish mumkin, lekin unda qaror maʼlumotga emas, farazga asoslanadi.",
        "depth": [
            ("1 qatlam", "Yer uchastkasi", "Chegaralar, kirish, yuklamalar, qurilish cheklovlari. Bu yerda jismonan nima mumkin.", "Cheklovlar xaritasi"),
            ("2 qatlam", "Qamrov zonasi", "Qamrov zonasida kim yashaydi va ishlaydi, necha kishi, qanday harakatlanadi, byudjeti qanday.", "Sigʻim hisobi"),
            ("3 qatlam", "Raqobat", "Mavjud obyektlar va eʼlon qilinganlari. Qaysi joylar boʻsh, qaysilari band.", "Taklif xaritasi"),
            ("4 qatlam", "Dastur", "Format, maydon, toifalar boʻyicha taqsimot, langarlar, tekshiruv rejasi.", "Konsepsiya va mix"),
            ("5 qatlam", "Model", "Stavkalar, boʻsh maydon, OPEX, CAPEX, jadval, stsenariylar va sezgirlik.", "Moliyaviy model"),
            ("6 qatlam", "Tekshiruv", "Uzilish nuqtasi, bank versiyasi, ochilishdan bir yil keyin prognozni fakt bilan solishtirish.", "Stress test va solishtirish"),
        ],
        "s3_num": "03",
        "s3_title": "Manbalar va tekshiriluvchanlik",
        "s3_body": [
            "Har bir hisobotda manbalar reyestri bor: har bir raqam boʻyicha manba, sana va maʼlumot turi koʻrsatiladi. Faraz faraz deb, fakt fakt deb belgilanadi. Bu zerikarli va hisobni fikrdan ajratishning yagona yoʻli.",
            "Saytda ham shu qoida amal qiladi. Agar raqamni asoslab boʻlmasa, u bu yerda yoʻq. Eski saytning tekshiruvdan oʻtmagan iboralari olib tashlandi: 89 loyiha, 8 mamlakat, bozorda 7 yildan ortiq, 5 milliard dollar investitsiya.",
        ],
        "s4_num": "04",
        "s4_title": "Jamoa",
        "s4_lead": "Ish staji yigʻindisi oʻrniga odamlarni va ularning rollarini nomlaymiz. Ish boshlagan sanalar tekshiruvdan keyin qoʻshiladi.",
        "team": [
            {"name": "Aziz Shermuhamedov", "role": "Asoschi va bosh direktor", "note": "Metodologiya va har bir hisobot boʻyicha yakuniy qaror uchun javob beradi."},
            {"name": "Bekzod Abdumajitov", "role": "Ijara boʻyicha direktor", "note": "Ijarachilar puli, tijorat shartlari, tasdiqlangan strategiyani bajarish."},
            {"name": "Timur Ilmuradov", "role": "Ijara boʻyicha direktor", "note": "Tarmoqlar bilan muzokaralar, langar ijarachilar bilan ish."},
            {"name": "Sunnatullo Mardanov", "role": "Ijara boʻyicha menejer", "note": "Bitimlar voronkasi va mandat boʻyicha hisobot."},
        ],
        "s5_num": "05",
        "s5_title": "Aʼzoliklar",
        "s5_body": "Soha tashkilotlaridagi ochiq aʼzolikni faqat maqom va aniq ibora tasdiqlangandan keyin koʻrsatamiz.",
    },

    "contact": {
        "h1": "Yer uchastkasi va bosqichni yozing",
        "lead": "Kirish maʼlumotlari qanchalik aniq boʻlsa, birinchi suhbat shunchalik foydali. Birinchi qoʻngʻiroqda ishimiz sizga kerakmi va qaysi formatda kerakligini toʻgʻridan toʻgʻri aytamiz.",
        "promise": "Ish kunlarida 48 soat ichida javob beramiz.",
        "phone_label": "Telefon",
        "email_label": "Pochta",
        "city_label": "Shahar",
        "city_value": "Toshkent, Oʻzbekiston",
        "form_title": "Strategik maslahatga soʻrov",
        "fields": {
            "name": "Ism",
            "company": "Kompaniya",
            "phone": "Telefon",
            "email": "Pochta",
            "city": "Loyiha shahri",
            "plot": "Uchastka maydoni, m2",
            "stage": "Loyiha bosqichi",
            "message": "Vazifa",
        },
        "stages": [
            "Uchastka sotib olingan, qaror yoʻq",
            "Konsepsiya bor, tekshiruv kerak",
            "Loyihalash ketmoqda",
            "Obyekt ishlayapti, qayta koʻrish kerak",
            "Boshqa",
        ],
        "stage_placeholder": "Bosqichni tanlang",
        "consent": "Shaxsiy maʼlumotlarim qayta ishlanishiga roziman.",
        "consent_link": "Maxfiylik siyosati",
        "submit": "Soʻrovni yuborish",
        "trap_label": "Bu maydonni toʻldirmang",
    },

    "faq": [
        (
            "CASE aynan nima bilan shugʻullanadi",
            "CASE egasining ikki savoliga javob beradi: bu yerda nima qurish va bu qancha keltiradi. Biz loyihalash boshlanishidan oldin, qarorni hali qurilishda emas, jadvalda oʻzgartirish mumkin boʻlgan paytda ishlaymiz. Ish natijasi: obyekt konsepsiyasi, maydonlarning toifalar boʻyicha taqsimoti, tekshiruv rejasi, arxitektorga texnik topshiriq va moliyaviy model. Biz ishchi hujjatlar chiqarmaymiz, maydon sotmaymiz va baholash hisobotlarini imzolamaymiz.",
        ),
        (
            "Qaysi bosqichda murojaat qilish kerak",
            "Eng yaxshi bosqich: yer uchastkasi bor, arxitektura qarorlari esa hali qayd etilmagan payt. Shu damda dasturni oʻzgartirish bitta jadvalga tushadi. Loyihalash topshirigʻi berilgandan keyin har bir tuzatish qimmatlashadi, qurilish boshlangach esa qarorlarning koʻpi qaytarib boʻlmaydigan boʻladi. Ishlab turgan obyektlar bilan ham ishlaymiz, lekin u yerda vazifa boshqa: loyihalash emas, qurilganini qayta pozitsiyalash.",
        ),
        (
            "Siz loyihachimisiz",
            "Yoʻq. Biz arxitektura byurosi emasmiz, ishchi hujjatlar chiqarmaymiz va mualliflik nazoratini olib bormaymiz. Arxitektorga texnik topshiriq beramiz: format, maydonlar, toifalar boʻyicha taqsimot, oqimlarga, korpus chuqurligiga va qavatlar bogʻliqligiga talablar. Undan keyingisini arxitektor loyihalaydi, biz esa loyiha tasdiqlangan dastur ichida qolayotganini tekshiramiz. Bunday boʻlinish ikkala tomonga foydali: arxitektor aniq kirish maʼlumotini oladi, egasi tijorat mantigʻi ustidan nazoratni saqlaydi.",
        ),
        (
            "Moliyaviy modelga nima kiradi",
            "Obyektning loyiha ufqidagi pul oqimi: toifalar boʻyicha stavkalar, boʻsh maydon, service charge, OPEX, CAPEX va uning oʻzlashtirish jadvali, moliyalashtirish manbalari va toʻlov jadvali. Keyin uch stsenariy, har bir asosiy faraz boʻyicha sezgirlik tahlili va uzilish nuqtasi: DSCR 1,30 dan pastga tushadigan stavka, boʻsh maydon va ochilish kechikishi kombinatsiyasi. Bank uchun kredit qoʻmitasi talablariga moslangan alohida versiya yigʻiladi.",
        ),
        (
            "Bu qancha turadi va narx nimaga bogʻliq",
            "Narx uch narsaga bogʻliq: ish formati, obyektning hajmi va murakkabligi hamda uchastka va bozor boʻyicha maʼlumot allaqachon yigʻilganmi yoki yoʻq. T1 formati nima qurish kerakligiga javob beradi. T2 toʻliq moliyaviy model va bank versiyasini qoʻshadi. T3 qarorni ochilishgacha yetkazadi. T4 aniq vazifa atrofida yigʻiladi va norma soat boʻyicha hisoblanadi. Har bir format boʻyicha oraliqlar narx roʻyxati tasdiqlangach xizmatlar sahifasida chop etiladi.",
        ),
        (
            "Ish qancha vaqt oladi",
            "Muddat formatga va uchastka boʻyicha boshlangʻich maʼlumot qanchalik yopilganiga bogʻliq. Hal qiluvchi omil maʼlumotning mavjudligi: oqim oʻlchovlari, uchastka hujjatlari va tasdiqlangan cheklovlar ishni jamoa hajmidan koʻra kuchliroq tezlashtiradi. Har bir format boʻyicha aniq muddatlar reglament tasdiqlangach xizmatlar sahifasida chop etiladi.",
        ),
        (
            "CBRE, JLL va mahalliy brokerlardan nimasi bilan farq qilasiz",
            "Yirik xalqaro firmalar baholash, brokerlik va xalqaro hisobotda kuchli, va ularning koʻpchiligida Oʻzbekistonda oʻz ofisi yoʻq: mintaqa qoʻshni davlatlardan borib kelib xizmat qilinadi. Mahalliy brokerlar bitimlarda kuchli, lekin bino qurib boʻlingandan keyin ishga tushadi. Biz ular orasidagi bosqichni egallaymiz: loyihalashdan oldingi qaror, moliyaviy model bilan va ochilishdan bir yil keyin prognozni fakt bilan solishtirish majburiyati bilan. Biz mustaqilmiz: franshiza ham, tarmoq oldidagi majburiyat ham yoʻq.",
        ),
        (
            "Oʻzingiz ijara bilan shugʻullansangiz, manfaatlar toʻqnashuvidan qanday qochasiz",
            "Toʻqnashuvni ochiq nomlaymiz va uni uch qoida bilan cheklaymiz. Birinchi: toʻqnashuv shartnoma imzolanishidan oldin yozma ochib beriladi. Ikkinchi: maslahatchi mukofoti shu obyekt boʻyicha ijara natijasiga bogʻlanmaydi, shuning uchun dasturni oshirib koʻrsatishga ragʻbatimiz yoʻq. Uchinchi: egasi ijarani boshqa tomonga berishga haqli va bu bizning konsalting ishimizga taʼsir qilmaydi. Shuningdek, bitta bitim boʻyicha bir vaqtda egasi va ijarachi uchun ishlamaymiz.",
        ),
        (
            "Oʻzbekistondan tashqarida ishlaysizmi",
            "Ha. Portfelda 7 mamlakatda 42 loyiha bor, jumladan Tojikiston va Saudiya Arabistoni. Oʻzbekistondan tashqarida ham xuddi shu shartlarda ishlaymiz, lekin doim bozor boʻyicha mahalliy maʼlumot manbai bilan: usiz hisob begona farazlarga tayanadi. Agar mamlakat boʻyicha kerakli sifatdagi statistika mavjud boʻlmasa, buni hisobotda emas, shartnoma imzolanishidan oldin aytamiz.",
        ),
        (
            "Boshlash uchun mendan nima kerak",
            "Birinchi suhbat uchun uch narsa yetarli: uchastkaning shahri va manzili, maydoni va loyiha bosqichi. Foydali, lekin kirishda majburiy emas: huquqni belgilovchi hujjatlar, shaharsozlik cheklovlari, topografik suratga olish, allaqachon tayyorlangan konsepsiya yoki hisoblar. Birinchi qoʻngʻiroq bepul va unda ishimiz sizga kerakmi yoʻqmi toʻgʻridan toʻgʻri aytamiz. Vazifa bizsiz hal boʻlsa, shuni aytamiz.",
        ),
    ],

    "privacy": {
        "h1": "Maxfiylik siyosati",
        "body": [
            ("Qanday maʼlumot yigʻamiz", [
                "Saytdagi shakl orqali: ism, kompaniya, telefon, pochta, loyiha shahri, uchastka maydoni, bosqich va soʻrov matni. Bu maʼlumot bitta maqsad uchun kerak: siz bilan bogʻlanish va mazmunli javob tayyorlash.",
                "Avtomatik tarzda: reklama cookie fayllarisiz nomsiz tashrif statistikasi. Biz profillash uchun maʼlumot yigʻmaymiz va uni reklama platformalariga bermaymiz.",
            ]),
            ("Qancha saqlaymiz", [
                "Soʻrovlar yozishmalar davom etgunicha va oxirgi aloqadan keyin 24 oy saqlanadi. Soʻrovingiz boʻyicha ertaroq oʻchiramiz.",
            ]),
            ("Kimga beramiz", [
                "Qonun talab qilgan hollardan tashqari firma tashqarisiga hech kimga. Biz kontaktlarni sotmaymiz va uchinchi shaxslarga bermaymiz.",
            ]),
            ("Maʼlumotni qanday oʻchirish mumkin", [
                "Soʻrovda koʻrsatilgan manzildan support@caseadvisory.uz ga yozing. 10 ish kuni ichida oʻchiramiz va xat bilan tasdiqlaymiz.",
            ]),
        ],
    },
    "conflicts": {
        "h1": "Manfaatlar toʻqnashuvi siyosati",
        "body": [
            ("Toʻqnashuv qayerda paydo boʻladi", [
                "CASE konsalting va ijara bilan shugʻullanadi. Obyekt dasturini tavsiya qiladigan firma ayni paytda shu obyektda maydon ijarasidan daromad olishi mumkin. Bu manfaatlar toʻqnashuvi va biz uni izohga yashirmay, ochiq aytamiz.",
            ]),
            ("Uni cheklash uchun nima qilamiz", [
                "Toʻqnashuvni shartnoma imzolanishidan oldin, ilovadagi qator emas, alohida band sifatida yozma ochib beramiz.",
                "Maslahatchi mukofotini shu obyekt boʻyicha ijara natijasiga bogʻlamaymiz.",
                "Firma ichida rollarni ajratamiz: dasturni hisoblagan maslahatchi shu obyekt boʻyicha ijara sotuv rejasi uchun javob bermaydi.",
                "Bitta bitim boʻyicha bir vaqtda egasi va ijarachi uchun ishlamaymiz.",
                "Egasi ijarani boshqa tomonga berishga haqli. Bu bizning konsalting ishimizga taʼsir qilmaydi.",
            ]),
            ("Nimadan voz kechamiz", [
                "Tasdiqlangan konsepsiyasiz ijara mandatidan.",
                "Kerakli xulosa oldindan belgilangan ishdan.",
                "Bitta qamrov zonasidagi ikki raqobatchi obyekt uchun bir vaqtda ishlashdan, ikkala tomonning yozma roziligisiz.",
            ]),
            ("Buzilish haqida qanday xabar berish mumkin", [
                "support@caseadvisory.uz manziliga «manfaatlar toʻqnashuvi» mavzusi bilan yozing. 5 ish kuni ichida javob beramiz.",
            ]),
        ],
    },

    "foot": {
        "tagline": "Mustaqil tijorat koʻchmas mulk ekspertizasi. Nima qurish va bu qancha keltiradi, loyihalashdan oldin.",
        "col_nav": "Boʻlimlar",
        "col_legal": "Huquqiy",
        "col_contact": "Aloqa",
        "rights": "Barcha huquqlar himoyalangan.",
        "legal_note": "Sayt materiallari axborot xarakteriga ega va oferta, baholash yoki investitsiya tavsiyasi emas.",
    },
}
