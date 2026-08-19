# -*- coding: utf-8 -*-
"""Факты, одинаковые во всех языках.

Правило проекта: ни одна цифра не попадает на сайт, если у неё нет
источника или названного основания. Всё, чего здесь нет, ставится
маркером TBD и попадает в TODO-CONTENT.md. Выдумывать запрещено.

Источник исправленного набора цифр: бриф CASE-Website-Build-Prompt.md, 18.08.2026.
"""

# ---------------------------------------------------------------- хост и языки
SITE = "https://caseadvisory.com"
# Второй рабочий домен. Сайтовый трафик с него уходит 301 на канонический,
# но /os/ (платформа CASE OS) и /admin/ остаются на нём: см. redirects.md.
ALT_HOST = "caseadvisory.uz"
LANGS = ["uz", "ru", "en"]
DEFAULT_LANG = "uz"

# Дата последнего обновления контента. Виден на странице и в schema:
# свежесть напрямую влияет на цитируемость в ответах ИИ.
UPDATED = "2026-08-19"

# ---------------------------------------------------------------- цифры фирмы
FOUNDED = 2022
PROJECTS = 42          # столько проектов в публичном портфеле
COUNTRIES = 7
GBA_MN = "8.1"         # млн м² GBA, с обязательной оговоркой про работы до 2022
GBA_SCHEMA = 8100000

# Контакты. Единственный телефон и единственная почта на весь сайт:
# разнобой в контактах был отдельной находкой аудита.
PHONE = "+998 77 047 73 75"
PHONE_TEL = "+998770477375"
EMAIL = "support@caseadvisory.uz"
CITY_CODE = "Tashkent"
COUNTRY_CODE = "UZ"
RESPONSE_HOURS = 48

# Куда уходит форма. Пока настоящий приёмник заявок не согласован, стоит почта:
# без JavaScript браузер откроет почтовый клиент с заполненным письмом, и заявка
# не потеряется. Как только появится endpoint, меняется только эта строка.
FORM_ENDPOINT = "mailto:%s" % EMAIL

LEGAL_NAME = "CASE Real Estate Advisory"
TRADE_NAME = "CASE Advisory"

SAME_AS = [
    "https://www.linkedin.com/company/case-real-estate-advisory",
    "https://www.instagram.com/caseadvisory",
    "https://t.me/case_advisory",
    "https://www.youtube.com/@case.advisory",
]

# ---------------------------------------------------------------- цепочка стадий
# 01..03 продаём сегодня, 04..05 следующий шаг, 06..07 приглушены.
CHAIN = [
    ("land", "now"),
    ("market", "now"),
    ("concept", "now"),
    ("model", "next"),
    ("brief", "next"),
    ("leasing", "later"),
    ("opening", "later"),
]

# ---------------------------------------------------------------- тарифы
TIERS = [
    {"code": "T1", "slug": "concept", "flag": None},
    {"code": "T2", "slug": "feasibility", "flag": "priority", "hero": True},
    {"code": "T3", "slug": "full-cycle", "flag": "anchor"},
    {"code": "T4", "slug": "custom", "flag": "priority"},
]

# ---------------------------------------------------------------- кейсы
# GLA приводится в одном значении на всём сайте. 82 Mall: 35 324 м², и нигде 36 000.
CASES = [
    {
        "slug": "82-mall",
        "city_key": "dushanbe",
        "country_key": "tj",
        "investor": "DAR DAR",
        "gla": 35324,
        "gba": None,
        "year": None,
        "role_key": "concept_leasing",
        "anonymised": False,
        "home": True,
    },
    {
        "slug": "chilonzor",
        "city_key": "tashkent",
        "country_key": "uz",
        "investor": None,
        "gla": 7439,
        "gba": None,
        "year": 1963,
        "renovation": "2023-2024",
        "role_key": "reposition",
        "anonymised": False,
        "home": True,
    },
    {
        "slug": "jabal-omar",
        "city_key": "mecca",
        "country_key": "sa",
        "investor": "Jabal Omar Development Co",
        "gla": 60000,
        "gba": None,
        "year": None,
        "role_key": "part_of_team",
        "anonymised": False,
        "home": True,
    },
]

CASE_SLUGS = [c["slug"] for c in CASES]

# Единственная анонимная строка в реестре: пример из брифа.
# Имя не раскрывается, пока нет письменного согласия.
ANON_ROWS = [
    {"key": "mecca_retail", "gla": 45000, "country_key": "sa", "filter": "sa retail"},
]

# Сколько строк портфеля ещё закрыто до проверки NDA.
PROJECTS_PENDING = PROJECTS - len(CASES) - len(ANON_ROWS)

# ---------------------------------------------------------------- страницы
PAGES = [
    "home", "feasibility", "services", "projects", "leasing",
    "insights", "about", "contact", "privacy", "conflicts",
]

PATHS = {
    "home": "",
    "feasibility": "feasibility.html",
    "services": "services.html",
    "projects": "projects.html",
    "leasing": "leasing.html",
    "insights": "insights.html",
    "about": "about.html",
    "contact": "contact.html",
    "privacy": "legal/privacy.html",
    "conflicts": "legal/conflicts.html",
}

# ---------------------------------------------------------------- 301 со старых адресов
OLD_URLS = [
    "/main-ru", "/main-en", "/portfolio-uz", "/portfolio-ru", "/portfolio-en",
    "/portfolio-uz2", "/portfolio-ru2", "/portfolio-en2",
    "/faq-uz", "/faq-ru", "/faq-en",
    "/ijara", "/arenda", "/leasing",
    "/82mall", "/82mall-ru", "/82mall-uz",
    "/chilonzormall", "/chilonzormall-ru", "/chilonzormall-uz",
    "/form-ru", "/form-en", "/form-uz",
    "/ru", "/uz", "/en",
]

REDIRECT_MAP = {
    "/main-ru": "/ru/",
    "/main-en": "/en/",
    "/portfolio-uz": "/projects.html",
    "/portfolio-uz2": "/projects.html",
    "/portfolio-ru": "/ru/projects.html",
    "/portfolio-ru2": "/ru/projects.html",
    "/portfolio-en": "/en/projects.html",
    "/portfolio-en2": "/en/projects.html",
    "/faq-uz": "/#faq",
    "/faq-ru": "/ru/#faq",
    "/faq-en": "/en/#faq",
    "/ijara": "/leasing.html",
    "/arenda": "/ru/leasing.html",
    "/leasing": "/en/leasing.html",
    "/82mall": "/en/projects/82-mall.html",
    "/82mall-ru": "/ru/projects/82-mall.html",
    "/82mall-uz": "/projects/82-mall.html",
    "/chilonzormall": "/en/projects/chilonzor.html",
    "/chilonzormall-ru": "/ru/projects/chilonzor.html",
    "/chilonzormall-uz": "/projects/chilonzor.html",
    "/form-ru": "/ru/contact.html",
    "/form-en": "/en/contact.html",
    "/form-uz": "/contact.html",
    "/ru": "/ru/",
    "/uz": "/",
    "/en": "/en/",
}

# ---------------------------------------------------------------- незакрытые данные
# Каждый ключ отсюда рендерится жёлтым маркером и обязан попасть в TODO-CONTENT.md.
TBD = {
    "t1_time": {"owner": "Aziz Shermuhamedov", "q": "Срок выполнения T1 CASE Concept, в неделях"},
    "t1_price": {"owner": "Aziz Shermuhamedov", "q": "Вилка цены T1, USD"},
    "t2_time": {"owner": "Aziz Shermuhamedov", "q": "Срок выполнения T2 CASE Feasibility, в неделях"},
    "t2_price": {"owner": "Aziz Shermuhamedov", "q": "Вилка цены T2, USD"},
    "t3_time": {"owner": "Aziz Shermuhamedov", "q": "Срок выполнения T3 CASE Full Cycle, в неделях"},
    "t3_price": {"owner": "Aziz Shermuhamedov", "q": "Вилка цены T3, USD"},
    "t4_time": {"owner": "Aziz Shermuhamedov", "q": "Срок выполнения T4 CASE Custom, в неделях"},
    "t4_price": {"owner": "Aziz Shermuhamedov", "q": "Ставка нормо-часа T4, USD"},
    "icsc": {"owner": "Aziz Shermuhamedov", "q": "Статус членства ICSC: действует ли, точная формулировка, номер и год"},
    "case_82_result": {"owner": "Bekzod Abdumajitov", "q": "82 Mall: результат в цифрах, согласованный к публикации"},
    "case_chilonzor_result": {"owner": "Bekzod Abdumajitov", "q": "Chilonzor: результат в цифрах, согласованный к публикации"},
    "case_jabal_result": {"owner": "Aziz Shermuhamedov", "q": "Jabal Omar: результат в цифрах и точная роль CASE, согласованные к публикации"},
    "scenarios": {"owner": "Aziz Shermuhamedov", "q": "Три сценария программы для блока «цифры, которые решают»: GLA, трафик, доходность, источник"},
    "form_endpoint": {"owner": "Abdulaziz Rakhimov", "q": "Endpoint формы: адрес приёмника заявок и формат ответа"},
    "nda_audit": {"owner": "Aziz Shermuhamedov", "q": "Аудит NDA по 42 проектам и письменные согласия на имена и логотипы"},
    "excerpt_pdf": {"owner": "Aziz Shermuhamedov", "q": "Обезличенный разворот отчёта на 2 страницы в PDF для скачивания"},
    "team_dates": {"owner": "Aziz Shermuhamedov", "q": "Команда: должности и даты начала работы для профилей вместо «50+ лет опыта»"},
    "og_photo": {"owner": "Abdulaziz Rakhimov", "q": "Фотографии объектов с правом публикации, для карточек кейсов и OG"},
    "analytics": {"owner": "Abdulaziz Rakhimov", "q": "Аналитика: домен Plausible или Umami, оставлять ли Yandex Metrica"},
}
