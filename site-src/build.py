#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка статического сайта CASE Real Estate Advisory.

Что делает: берёт тексты из content/<lang>.py и факты из content/facts.py
и раскладывает готовые .html по папке case-site/. Ничего не минифицирует,
ничего не бандлит, зависимостей нет. На выходе обычные файлы, которые
можно просто положить на хостинг.

Запуск:  python3 site-src/build.py
Проверка: python3 site-src/build.py --check
"""

import json
import os
import re
import sys
from html import escape as _esc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "case-site")
sys.path.insert(0, os.path.join(HERE, "content"))

import facts  # noqa: E402

LANGS = {}
for code in facts.LANGS:
    LANGS[code] = __import__(code).L

SITE = facts.SITE
USED_TBD = set()


# ----------------------------------------------------------------- утилиты
def esc(s):
    return _esc(str(s), quote=True)


def path_for(lang, page):
    tail = facts.PATHS[page]
    return ("/" + tail) if lang == facts.DEFAULT_LANG else ("/%s/%s" % (lang, tail))


def case_path(lang, slug):
    tail = "projects/%s.html" % slug
    return ("/" + tail) if lang == facts.DEFAULT_LANG else ("/%s/%s" % (lang, tail))


def outfile(url_path):
    """/ru/ -> ru/index.html, /services.html -> services.html"""
    rel = url_path.lstrip("/")
    if rel == "" or rel.endswith("/"):
        rel += "index.html"
    return os.path.join(OUT, rel)


def write(url_path, text):
    p = outfile(url_path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return p


def num(v, lang):
    """Разделитель разрядов: узкий пробел, десятичный знак по языку."""
    s = "{:,}".format(v).replace(",", " ")
    return s


def tbd(key, lang):
    """Заглушка для данных, которых пока нет. Видна и на странице, и в отчёте."""
    USED_TBD.add(key)
    q = facts.TBD[key]["q"]
    label = LANGS[lang]["ui"]["tbd_prefix"]
    return '<span class="tbd" data-tbd="%s">%s %s</span>' % (esc(key), esc(label), esc(q))


# ----------------------------------------------------------------- каркас
def head(lang, page, title, desc, extra_schema=None, scripts=(), canonical_path=None, breadcrumb=None):
    L = LANGS[lang]
    p = canonical_path if canonical_path is not None else path_for(lang, page)
    canonical = SITE + p

    alts = []
    for code in facts.LANGS:
        if canonical_path is not None and page == "case":
            alt = SITE + case_path(code, canonical_path.rsplit("/", 1)[-1].replace(".html", ""))
        else:
            alt = SITE + path_for(code, page)
        alts.append('<link rel="alternate" hreflang="%s" href="%s">' % (code, alt))
    xdef = SITE + (case_path(facts.DEFAULT_LANG, canonical_path.rsplit("/", 1)[-1].replace(".html", ""))
                   if (canonical_path is not None and page == "case") else path_for(facts.DEFAULT_LANG, page))
    alts.append('<link rel="alternate" hreflang="x-default" href="%s">' % xdef)

    og_slug = page if page != "case" else "case-" + canonical_path.rsplit("/", 1)[-1].replace(".html", "")
    og = "%s/assets/img/og/%s-%s.png" % (SITE, lang, og_slug)

    # Предзагружаем ровно два начертания, которые рисуют первый экран
    # на этом языке. Кириллица и латиница лежат в разных файлах.
    subset = "cyrillic" if lang == "ru" else "latin"
    display_font = "oswald-400-cyrillic" if lang == "ru" else "bebas-neue-400-latin"
    preloads = [
        '<link rel="preload" href="/assets/fonts/%s.woff2" as="font" type="font/woff2" crossorigin>' % display_font,
        '<link rel="preload" href="/assets/fonts/montserrat-700-%s.woff2" as="font" type="font/woff2" crossorigin>' % subset,
    ]

    graph = base_graph(lang, page, title, desc, canonical, breadcrumb)
    if extra_schema:
        graph.extend(extra_schema)
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph},
                    ensure_ascii=False, separators=(",", ":"))

    # Интерфейсный скрипт маленький и грузится сразу. Библиотека движения
    # весит больше и подключается только после события load: она не имеет
    # права соревноваться за канал с первым экраном.
    js = ['<script type="module" src="/assets/js/app.js"></script>',
          '<script>addEventListener("load",function(){var v=["/assets/js/vendor/gsap.min.js",'
          '"/assets/js/vendor/ScrollTrigger.min.js","/assets/js/vendor/SplitText.min.js",'
          '"/assets/js/vendor/lenis.min.js"],i=0;'
          '(function n(){if(i>=v.length){var m=document.createElement("script");m.type="module";'
          'm.src="/assets/js/motion.js";document.head.appendChild(m);return}'
          'var e=document.createElement("script");e.src=v[i++];e.onload=n;e.onerror=n;'
          'document.head.appendChild(e)})()})</script>']
    for extra in scripts:
        js.append('<script type="module" src="%s"></script>' % extra)

    return """<!DOCTYPE html>
<html lang="%(lang)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(canonical)s">
%(alts)s
<meta property="og:type" content="website">
<meta property="og:site_name" content="CASE Real Estate Advisory">
<meta property="og:locale" content="%(locale)s">
<meta property="og:title" content="%(title)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(canonical)s">
<meta property="og:image" content="%(og)s">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(title)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(og)s">
<meta name="theme-color" content="#FAF9F7">
%(preloads)s
<link rel="stylesheet" href="/assets/css/styles.css">
<link rel="manifest" href="/site.webmanifest">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add('js');addEventListener('load',function(){setTimeout(function(){var d=document.documentElement;if(!d.classList.contains('motion-ready')){d.classList.remove('js')}},3000)})</script>
<script type="application/ld+json">%(ld)s</script>
%(js)s
</head>
<body>
<a class="skip" href="#main">%(skip)s</a>
""" % {
        "lang": lang, "title": esc(title), "desc": esc(desc), "canonical": canonical,
        "alts": "\n".join(alts), "locale": LANGS[lang]["locale"], "og": og,
        "preloads": "\n".join(preloads), "ld": ld, "js": "\n".join(js),
        "skip": esc(L["ui"]["skip"]),
    }


def base_graph(lang, page, title, desc, canonical, breadcrumb):
    L = LANGS[lang]
    org_id = SITE + "/#organization"
    site_id = SITE + "/#website"
    graph = [
        {
            "@type": "Organization",
            "@id": org_id,
            "name": facts.LEGAL_NAME,
            "alternateName": facts.TRADE_NAME,
            "url": SITE + "/",
            "foundingDate": str(facts.FOUNDED),
            "description": L["home"]["sub"],
            "sameAs": facts.SAME_AS,
            "address": {
                "@type": "PostalAddress",
                "addressLocality": facts.CITY_CODE,
                "addressCountry": facts.COUNTRY_CODE,
            },
            "contactPoint": [{
                "@type": "ContactPoint",
                "telephone": facts.PHONE_TEL,
                "email": facts.EMAIL,
                "contactType": "sales",
                "availableLanguage": ["uz", "ru", "en"],
            }],
        },
        {
            "@type": "ProfessionalService",
            "@id": SITE + "/#professionalservice",
            "name": facts.LEGAL_NAME,
            "parentOrganization": {"@id": org_id},
            "url": SITE + "/",
            "telephone": facts.PHONE_TEL,
            "email": facts.EMAIL,
            "priceRange": "$$$",
            "areaServed": [{"@type": "Country", "name": c} for c in
                           ["Uzbekistan", "Tajikistan", "Saudi Arabia"]],
            "address": {"@type": "PostalAddress", "addressLocality": facts.CITY_CODE,
                        "addressCountry": facts.COUNTRY_CODE},
        },
        {
            "@type": "WebSite",
            "@id": site_id,
            "url": SITE + "/",
            "name": facts.TRADE_NAME,
            "publisher": {"@id": org_id},
            "inLanguage": facts.LANGS,
        },
        {
            "@type": "WebPage",
            "@id": canonical + "#webpage",
            "url": canonical,
            "name": title,
            "description": desc,
            "isPartOf": {"@id": site_id},
            "about": {"@id": org_id},
            "inLanguage": lang,
            "dateModified": facts.UPDATED,
        },
    ]
    if breadcrumb:
        graph.append({
            "@type": "BreadcrumbList",
            "@id": canonical + "#breadcrumb",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": nm,
                 "item": SITE + href} for i, (nm, href) in enumerate(breadcrumb)
            ],
        })
    return graph


def nav(lang, page):
    L = LANGS[lang]
    links = []
    for key, label in L["nav"]:
        cur = ' aria-current="page"' if key == page else ""
        links.append('<a href="%s"%s>%s</a>' % (path_for(lang, key), cur, esc(label)))
    langs = []
    for code in facts.LANGS:
        cur = ' aria-current="true"' if code == lang else ""
        href = path_for(code, page) if page in facts.PATHS else path_for(code, "home")
        langs.append('<a href="%s" hreflang="%s" lang="%s"%s>%s</a>'
                     % (href, code, code, cur, esc(LANGS[code]["label"])))
    return """<header class="nav" data-nav>
<div class="wrap nav__bar">
<a class="nav__logo" href="%(home)s"><b>CASE</b><span>Real Estate Advisory</span></a>
<button class="nav__toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="nav-links"><b></b>%(menu)s</button>
<nav class="nav__links" id="nav-links" aria-label="%(menu)s">%(links)s</nav>
<div class="nav__side">
<nav class="lang" data-lang-switcher aria-label="%(langnav)s">%(langs)s</nav>
<a class="btn nav__cta magnetic" href="%(contact)s" data-goal="nav_cta">%(cta)s<i class="btn__arrow"></i></a>
</div>
</div>
</header>
""" % {
        "home": path_for(lang, "home"), "menu": esc(L["ui"]["menu"]),
        "links": "".join(links), "langnav": esc(L["ui"]["lang_nav"]),
        "langs": "".join(langs), "contact": path_for(lang, "contact"),
        "cta": esc(L["nav_cta"]),
    }


def foot(lang):
    L = LANGS[lang]
    F = L["foot"]
    nav_links = "".join('<li><a href="%s">%s</a></li>' % (path_for(lang, k), esc(v))
                        for k, v in L["nav"])
    legal = "".join([
        '<li><a href="%s">%s</a></li>' % (path_for(lang, "privacy"), esc(L["meta"]["privacy"]["title"].split(":")[0])),
        '<li><a href="%s">%s</a></li>' % (path_for(lang, "conflicts"), esc(L["meta"]["conflicts"]["title"].split(":")[0])),
    ])
    social = "".join('<li><a href="%s" rel="me noopener" target="_blank">%s</a></li>'
                     % (u, esc(u.split("//")[1].split("/")[0].replace("www.", "")))
                     for u in facts.SAME_AS)
    return """<footer class="foot">
<div class="wrap foot__grid">
<div class="foot__brand">
<a class="nav__logo" href="%(home)s"><b>CASE</b><span>Real Estate Advisory</span></a>
<p class="small mt-md w-34">%(tagline)s</p>
</div>
<div class="foot__col"><h4>%(cnav)s</h4><ul>%(nav)s</ul></div>
<div class="foot__col"><h4>%(clegal)s</h4><ul>%(legal)s</ul></div>
<div class="foot__col"><h4>%(ccontact)s</h4><ul>
<li><a href="tel:%(teltrim)s">%(tel)s</a></li>
<li><a href="mailto:%(mail)s">%(mail)s</a></li>
</ul></div>
<div class="foot__col"><h4>Social</h4><ul>%(social)s</ul></div>
</div>
<div class="wrap"><div class="foot__bottom">
<span>&copy; %(year)s CASE Real Estate Advisory. %(rights)s</span>
<span>%(updated)s: <time datetime="%(iso)s">%(iso)s</time></span>
<span class="w-52">%(legalnote)s</span>
</div></div>
</footer>
</body>
</html>
""" % {
        "home": path_for(lang, "home"), "tagline": esc(F["tagline"]),
        "cnav": esc(F["col_nav"]), "nav": nav_links,
        "clegal": esc(F["col_legal"]), "legal": legal,
        "ccontact": esc(F["col_contact"]), "teltrim": facts.PHONE_TEL,
        "tel": esc(facts.PHONE), "mail": facts.EMAIL, "social": social,
        "year": facts.UPDATED[:4], "rights": esc(F["rights"]),
        "updated": esc(L["ui"]["updated"]), "iso": facts.UPDATED,
        "legalnote": esc(F["legal_note"]),
    }


def counted(value, lang):
    """Разметка числа со счётчиком. Год не анимируем: отсчёт от нуля до 2022
    выглядит как ошибка, а не как приём. Значение всегда стоит в разметке."""
    raw = str(value).replace(" ", "")
    sep = "." if lang == "en" else ","
    norm = raw.replace(",", ".")
    try:
        num = float(norm)
    except ValueError:
        return esc(value)
    if float(num).is_integer() and 1900 <= num <= 2100:
        return esc(value)
    dec = len(norm.split(".")[1]) if "." in norm else 0
    return '<span data-count="%s" data-dec="%d" data-sep="%s">%s</span>' % (
        norm, dec, sep, esc(value))


def sec_head(num_, title, lead=None, tag="h2", right=False, variant=""):
    """variant: bleed (номер выходит за край), indent (заголовок сдвинут вправо)."""
    lead_html = '<p class="lead muted reveal">%s</p>' % esc(lead) if lead else ""
    cls = " break-r" if right else ""
    for v in variant.split():
        if v:
            cls += " sec-head--" + v
    # Хореография: номер проявляется, заголовок поднимается построчно,
    # лид догоняет. Поэтому reveal висит на частях, а не на всём блоке.
    return """<div class="sec-head%(r)s">
<div class="sec-head__n reveal"><span class="mono-label">%(n)s</span><span class="sec-head__ghost" data-drift aria-hidden="true">%(n)s</span></div>
<div class="sec-head__inner"><%(t)s data-lines>%(title)s</%(t)s>%(lead)s</div></div>""" % {
        "n": esc(num_), "t": tag, "title": esc(title), "lead": lead_html, "r": cls,
    }


# Тёмные секции въезжают шторой: чёрное поле раскрывается сверху вниз.
# По умолчанию оно на месте, движение включает только живой motion.js.
GROUND = '<span class="ground" data-ground aria-hidden="true"></span>'



def crumbs(lang, trail):
    items = []
    for i, (name, href) in enumerate(trail):
        if i == len(trail) - 1:
            items.append("<li>%s</li>" % esc(name))
        else:
            items.append('<li><a href="%s">%s</a></li>' % (href, esc(name)))
    return '<div class="wrap"><nav aria-label="breadcrumb"><ol class="crumbs">%s</ol></nav></div>' % "".join(items)


def updated_line(lang):
    L = LANGS[lang]
    return '<p class="micro muted">%s: <time datetime="%s">%s</time></p>' % (
        esc(L["ui"]["updated"]), facts.UPDATED, facts.UPDATED)


# ----------------------------------------------------------------- секции
def tiers_block(lang, linked=True):
    L = LANGS[lang]
    T = L["tiers"]
    out = ['<div class="tiers">']
    for t in facts.TIERS:
        code = t["code"]
        d = T[code]
        cls = "tier tier--hero" if t.get("hero") else "tier"
        flag = '<span class="tier__flag tier__flag--none" aria-hidden="true">&#183;</span>'
        if t["flag"]:
            fcls = "tier__flag tier__flag--anchor" if t["flag"] == "anchor" else "tier__flag"
            flag = '<span class="%s">%s</span>' % (fcls, esc(T["flags"][t["flag"]]))
        items = "".join("<li>%s</li>" % esc(x) for x in d["in"])
        href = path_for(lang, "feasibility") if code == "T2" else (path_for(lang, "services") + "#" + t["slug"])
        link = '<a class="arrow-link" href="%s">%s</a>' % (href, esc(L["home"]["tiers_more"])) if linked else ""
        out.append("""<article class="%(cls)s card--lit reveal" id="%(slug)s">
<span class="tier__code">%(code)s</span>%(flag)s
<h3>%(name)s<br><span class="muted">%(tag)s</span></h3>
<p class="small">%(desc)s</p>
<ul class="tier__list">%(items)s</ul>
<p class="micro muted">%(out)s</p>
<dl class="tier__meta">
<dt>%(ltime)s</dt><dd>%(vtime)s</dd>
<dt>%(lprice)s</dt><dd>%(vprice)s<br><span class="micro muted">%(hint)s</span></dd>
</dl>%(link)s</article>""" % {
            "cls": cls, "slug": t["slug"], "code": code, "flag": flag,
            "name": esc(d["name"]), "tag": esc(d["tag"]), "desc": esc(d["desc"]),
            "items": items, "out": esc(d["out"]),
            "ltime": esc(T["labels"]["time"]), "vtime": tbd("%s_time" % code.lower(), lang),
            "lprice": esc(T["labels"]["price"]), "vprice": tbd("%s_price" % code.lower(), lang),
            "hint": esc(T["price_hint"]),
            "link": link,
        })
    out.append("</div>")
    return "".join(out)


def case_media(slug, alt):
    return ('<figure class="case-card__media"><img src="/assets/img/cases/%s.svg" alt="%s" '
            'width="800" height="600" loading="lazy" decoding="async"></figure>'
            % (slug, esc(alt)))


def cases_block(lang):
    L = LANGS[lang]
    out = ['<div class="cases">']
    for c in facts.CASES:
        cd = L["cases"][c["slug"]]
        facts_line = []
        facts_line.append("<span><b>%s</b> %s</span>" % (num(c["gla"], lang), esc(L["case_labels"]["gla"])))
        facts_line.append("<span>%s</span>" % esc(L["cities"][c["city_key"]]))
        out.append("""<a class="case-card card--lit reveal" href="%(href)s" data-case-link data-vt="%(slug)s" data-goal="case_open">
%(media)s
<div class="case-card__body">
<p class="case-card__where">%(city)s, %(country)s</p>
<h3>%(name)s</h3>
<p class="case-card__why">%(why)s</p>
<div class="case-card__facts">%(facts)s</div>
</div></a>""" % {
            "href": case_path(lang, c["slug"]), "slug": c["slug"],
            "media": case_media(c["slug"], cd["name"]),
            "city": esc(L["cities"][c["city_key"]]),
            "country": esc(L["countries"][c["country_key"]]),
            "name": esc(cd["name"]), "why": esc(cd["why"]),
            "facts": "".join(facts_line),
        })
    out.append("</div>")
    return "".join(out)


def scale_block(lang):
    """Столбцы по реальным GLA трёх кейсов. Ни одного условного числа:
    это единственные цифры портфеля, согласованные к публикации."""
    L = LANGS[lang]
    H = L["home"]
    top = max(c["gla"] for c in facts.CASES)
    rows = []
    for c in facts.CASES:
        cd = L["cases"][c["slug"]]
        rows.append("""<li class="scaleb__row reveal">
<span class="scaleb__name">%(name)s</span>
<span class="scaleb__bar" style="--w:%(w).1f%%"></span>
<span class="scaleb__val">%(gla)s <small>m<sup>2</sup></small></span></li>""" % {
            "name": esc(cd["name"]), "w": c["gla"] / float(top) * 100.0,
            "gla": num(c["gla"], lang),
        })
    return """<div class="scaleb mt-lg">
<h3 class="scaleb__title">%(title)s</h3>
<p class="micro muted">%(glafull)s</p>
<ul class="scaleb__list">%(rows)s</ul>
<p class="basis mt-md">%(note)s</p></div>""" % {
        "title": esc(H["scale_title"]), "glafull": esc(H["gla_full"]),
        "rows": "".join(rows), "note": esc(H["scale_note"]),
    }


def faq_block(lang, ids=True):
    L = LANGS[lang]
    items = []
    for i, (q, a) in enumerate(L["faq"]):
        items.append("""<div class="faq__item">
<h3><button class="faq__q" type="button" aria-expanded="true" aria-controls="faq-%(i)d">%(q)s<span class="faq__sign" aria-hidden="true"></span></button></h3>
<div class="faq__a" id="faq-%(i)d"><p>%(a)s</p></div>
</div>""" % {"i": i, "q": esc(q), "a": esc(a)})
    return '<div class="faq" data-faq>%s</div>' % "".join(items)


def faq_schema(lang):
    L = LANGS[lang]
    return {
        "@type": "FAQPage",
        "@id": SITE + path_for(lang, "home") + "#faq",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in L["faq"]
        ],
    }


def service_schema(lang):
    L = LANGS[lang]
    T = L["tiers"]
    out = []
    for t in facts.TIERS:
        d = T[t["code"]]
        out.append({
            "@type": "Service",
            "@id": SITE + path_for(lang, "services") + "#" + t["slug"],
            "name": "%s %s" % (t["code"], d["name"]),
            "serviceType": d["name"],
            "description": d["desc"],
            "provider": {"@id": SITE + "/#organization"},
            "areaServed": {"@type": "Country", "name": "Uzbekistan"},
            "inLanguage": lang,
        })
    return out


def form_block(lang, form_id="consultation"):
    L = LANGS[lang]
    C = L["contact"]
    f = C["fields"]
    stages = "".join('<option value="%s">%s</option>' % (esc(s), esc(s)) for s in C["stages"])
    return """<form class="form" method="post" action="%(action)s" enctype="text/plain" data-form="%(fid)s"
 data-msg-sending="%(sending)s" data-msg-ok="%(sent)s" data-msg-err="%(err)s" data-msg-slow="%(slow)s">
<div class="field"><label for="f-name">%(name)s</label><input id="f-name" name="name" type="text" autocomplete="name" required></div>
<div class="field"><label for="f-company">%(company)s</label><input id="f-company" name="company" type="text" autocomplete="organization"></div>
<div class="field"><label for="f-phone">%(phone)s</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" required></div>
<div class="field"><label for="f-email">%(email)s</label><input id="f-email" name="email" type="email" autocomplete="email" required></div>
<div class="field"><label for="f-city">%(city)s</label><input id="f-city" name="city" type="text"></div>
<div class="field"><label for="f-plot">%(plot)s</label><input id="f-plot" name="plot" type="text" inputmode="numeric"></div>
<div class="field field--full"><label for="f-stage">%(stage)s</label><select id="f-stage" name="stage"><option value="">%(stageph)s</option>%(stages)s</select></div>
<div class="field field--full"><label for="f-message">%(message)s</label><textarea id="f-message" name="message" rows="5"></textarea></div>
<div class="field field--hp" aria-hidden="true"><label for="f-url">%(trap)s</label><input id="f-url" name="company_url" type="text" tabindex="-1" autocomplete="off"></div>
<input type="hidden" name="started_at" value="">
<input type="hidden" name="lang" value="%(lang)s">
<div class="field field--full"><label class="consent"><input type="checkbox" name="consent" required> <span>%(consent)s <a class="link" href="%(privacy)s">%(consent_link)s</a></span></label></div>
<div class="field field--full"><button class="btn btn--red magnetic" type="submit" data-goal="consultation_submit">%(submit)s<i class="btn__arrow"></i></button></div>
<p class="form__status" data-form-status role="status" aria-live="polite"></p>
<p class="basis field--full">%(endpoint_note)s</p>
</form>""" % {
        "fid": form_id, "lang": lang, "action": facts.FORM_ENDPOINT,
        "sending": esc(L["ui"]["sending"]), "sent": esc(L["ui"]["sent"]),
        "err": esc(L["ui"]["send_error"]), "slow": esc(L["ui"]["too_fast"]),
        "name": esc(f["name"]), "company": esc(f["company"]), "phone": esc(f["phone"]),
        "email": esc(f["email"]), "city": esc(f["city"]), "plot": esc(f["plot"]),
        "stage": esc(f["stage"]), "stageph": esc(C["stage_placeholder"]), "stages": stages,
        "message": esc(f["message"]), "trap": esc(C["trap_label"]),
        "consent": esc(C["consent"]), "submit": esc(C["submit"]),
        "privacy": path_for(lang, "privacy"), "consent_link": esc(C["consent_link"]),
        "endpoint_note": tbd("form_endpoint", lang),
    }


# ----------------------------------------------------------------- страницы
def page_home(lang):
    L = LANGS[lang]
    H = L["home"]
    m = L["meta"]["home"]
    extra = [faq_schema(lang)] + service_schema(lang)
    out = [head(lang, "home", m["title"], m["desc"], extra_schema=extra)]
    out.append(nav(lang, "home"))
    out.append('<main id="main">')

    # 00 герой
    halves = "".join('<span class="slogan__h">%s</span>' % esc(x) for x in H["slogan"])
    facts_rows = "".join(
        '<li class="hero__fact"><b>%s</b><span>%s</span></li>' % (counted(a, lang), esc(b))
        for a, b in H["hero_facts"])
    out.append("""<section class="hero"><div class="wrap hero__grid">
<div class="hero__main">
<p class="mono-label hero__eyebrow">%(eyebrow)s</p>
<p class="slogan" data-slogan>%(halves)s</p>
<span class="slogan__rule reveal-rule" aria-hidden="true"></span>
<h1 class="reveal" data-hero-after>%(h1)s</h1>
<p class="lead hero__sub reveal" data-hero-after>%(sub)s</p>
<div class="hero__cta reveal" data-hero-after>
<a class="btn magnetic" href="%(contact)s" data-goal="hero_cta">%(cta1)s<i class="btn__arrow"></i></a>
<a class="btn btn--ghost magnetic" href="%(feas)s" data-goal="hero_feasibility">%(cta2)s<i class="btn__arrow"></i></a>
</div>
</div>
<aside class="hero__aside reveal" data-hero-after>
<p class="mono-label">%(flabel)s</p>
<ul class="hero__facts">%(facts)s</ul>
%(updated)s
</aside>
</div></section>""" % {
        "eyebrow": esc(H["eyebrow"]), "halves": halves, "h1": esc(H["h1"]), "sub": esc(H["sub"]),
        "contact": path_for(lang, "contact"), "cta1": esc(H["cta1"]),
        "feas": path_for(lang, "feasibility"), "cta2": esc(H["cta2"]),
        "flabel": esc(H["hero_facts_label"]), "facts": facts_rows,
        "updated": updated_line(lang),
    })


    # Оглавление: у длинной страницы должны быть адресуемые части, иначе
    # она читается одним нерасчленимым свитком. Заодно это работает как
    # навигация с телефона и как карта для машин, читающих разметку.
    toc = "".join(
        '<li><span class="toc__n">%02d</span><a href="#%s">%s</a></li>' % (i + 1, esc(a), esc(t))
        for i, (a, t) in enumerate(H["toc"]))
    out.append("""<nav class="toc" aria-label="%(label)s"><div class="wrap toc__in">
<span class="toc__label">%(label)s</span><ol class="toc__list">%(items)s</ol>
</div></nav>""" % {"label": esc(H["toc_label"]), "items": toc})

    # 01 кто мы не
    nots = "".join("""<article class="nots__i reveal"><h3>%s</h3><p class="small muted">%s</p></article>"""
                   % (esc(n["t"]), esc(n["d"])) for n in H["nots"])
    out.append("""<section class="section" id="position"><div class="wrap">
%(head)s
<div class="nots">%(nots)s</div>
<p class="basis mt-md reveal">%(caveat)s <a class="link" href="%(clink)s">%(clabel)s</a></p>
</div></section>""" % {
        "head": sec_head(H["nots_num"], H["nots_title"], H["nots_lead"]),
        "nots": nots, "caveat": esc(H["nots_caveat"]),
        "clink": path_for(lang, "conflicts"), "clabel": esc(H["nots_caveat_link"]),
    })

    # 02 цепочка
    stages = []
    for i, (key, tier) in enumerate(facts.CHAIN, 1):
        t, d, tag = H["chain"][key]
        stages.append("""<li class="chain__stage" data-tier="%s"><span class="chain__n">%02d</span>
<h3>%s</h3><p>%s</p><span class="chain__tag">%s</span></li>""" % (tier, i, esc(t), esc(d), esc(tag)))
    legend = "".join('<span class="%s"><i></i>%s</span>'
                     % (["is-now", "is-next", ""][i], esc(x))
                     for i, x in enumerate(H["chain_legend"]))
    out.append("""<section class="section chain" id="chain" data-chain><div class="wrap">
%(head)s</div>
<div class="chain__viewport"><ol class="chain__track">
<span class="chain__prog" aria-hidden="true"></span><li class="chain__pad" aria-hidden="true"></li>%(stages)s</ol></div>
<div class="wrap"><div class="chain__legend">%(legend)s</div>
<p class="micro muted mt-md">%(hint)s</p></div></section>""" % {
        "head": sec_head(H["chain_num"], H["chain_title"], H["chain_lead"]),
        "stages": "".join(stages), "legend": legend, "hint": esc(H["chain_hint"]),
    })

    # 03 тарифы
    out.append("""<section class="section" id="products"><div class="wrap">
%(head)s%(tiers)s
<p class="basis mt-md reveal">%(policy)s</p>
<p class="mt-md reveal"><a class="arrow-link" href="%(services)s">%(more)s</a></p>
</div></section>""" % {
        "policy": esc(H["tbd_policy"]),
        "head": sec_head(H["tiers_num"], H["tiers_title"], H["tiers_lead"]),
        "tiers": tiers_block(lang), "services": path_for(lang, "services"),
        "more": esc(H["tiers_all"]),
    })

    # 04 погружение: один участок, три программы
    # Разрез и состав программы схематические. Ни одной цифры на экране:
    # пока нет расчёта, показываем механику, а не выдуманные значения.
    shapes = [
        "70,380 70,380 250,380 250,380 390,380 390,380 570,380 570,380",
        "70,380 70,120 250,120 250,120 390,120 390,120 570,120 570,380",
        "70,380 70,246 250,246 250,246 390,246 390,246 570,246 570,380",
        "70,380 70,286 250,286 250,146 390,146 390,286 570,286 570,380",
        "110,380 110,300 250,300 250,214 390,214 390,300 530,300 530,380",
        "110,380 110,300 250,300 250,214 390,214 390,300 530,300 530,380",
    ]
    comps = ["0,0,0", "0,0,0", "88,0,12", "55,30,15", "62,8,30", "62,8,30"]
    steps = []
    for i, st in enumerate(H["scen_steps"]):
        steps.append("""<article class="dive__step reveal" data-points="%(pts)s" data-comp="%(comp)s"%(last)s>
<span class="dive__level">%(lvl)02d</span>
<h3 data-lines>%(t)s</h3><p class="small">%(d)s</p></article>""" % {
            "pts": shapes[i], "comp": comps[i], "lvl": i + 1,
            "last": ' data-final="1"' if i == len(H["scen_steps"]) - 1 else "",
            "t": esc(st["t"]), "d": esc(st["d"]),
        })
    ghosts = "".join('<polygon class="cut__ghost" data-ghost points="%s"></polygon>' % shapes[j]
                     for j in (2, 3, 4))
    final_comp = [float(x) for x in comps[-1].split(",")]
    seg_attrs, cursor = [], 0.0
    for part in final_comp:
        w = part / 100.0 * 500.0
        seg_attrs.append((cursor, w))
        cursor += w
    legend = "".join('<span class="l-%s"><i></i>%s</span>' % (c, esc(t))
                     for c, t in zip("abc", H["scen_legend"]))
    out.append("""<section class="section dive section--wipe" id="numbers" data-dive>%(ground)s<span class="dive__light" data-dive-light aria-hidden="true"></span>
<div class="wrap">
%(head)s
<div class="dive__grid">
<div class="dive__stage">
<svg class="cut" viewBox="0 0 640 480" role="img" aria-label="%(alt)s">
<rect class="cut__plot" x="70" y="110" width="500" height="270"></rect>
<line class="cut__ground" x1="40" y1="380" x2="600" y2="380" stroke-width="1"></line>
%(ghosts)s
<polygon class="cut__mass" data-shape points="%(p0)s"></polygon>
<g transform="translate(70,424)">
<rect class="cut__seg" data-seg="0" x="%(x0).1f" y="0" width="%(w0).1f" height="14" fill="#A91D20"></rect>
<rect class="cut__seg" data-seg="1" x="%(x1).1f" y="0" width="%(w1).1f" height="14" fill="#BE8E3A"></rect>
<rect class="cut__seg" data-seg="2" x="%(x2).1f" y="0" width="%(w2).1f" height="14" fill="rgba(250,249,247,.4)"></rect>
</g>
</svg>
<div class="dive__legend">%(legend)s</div>
</div>
<div class="dive__steps">
<span class="dive__gauge" aria-hidden="true"><span class="dive__mark" data-dive-mark></span></span>
%(steps)s
</div>
</div>
<p class="basis mt-lg">%(note)s %(tbd)s</p>
<p class="mt-md"><a class="arrow-link" href="%(feas)s">%(cta)s</a></p>
</div></section>""" % {
        "ground": GROUND,
        "head": sec_head(H["scen_num"], H["scen_title"], H["scen_lead"], variant="bleed"),
        "alt": esc(H["scen_title"]), "p0": shapes[-1], "ghosts": ghosts,
        "x0": seg_attrs[0][0], "w0": seg_attrs[0][1],
        "x1": seg_attrs[1][0], "w1": seg_attrs[1][1],
        "x2": seg_attrs[2][0], "w2": seg_attrs[2][1],
        "legend": legend, "steps": "".join(steps),
        "note": esc(H["scen_note"]), "tbd": tbd("scenarios", lang),
        "feas": path_for(lang, "feasibility"), "cta": esc(H["scen_cta"]),
    })

    # 05 кейсы
    out.append("""<section class="section" id="cases"><div class="wrap">
%(head)s%(cases)s
%(scale)s
<p class="mt-lg reveal"><a class="arrow-link" href="%(projects)s">%(all)s</a></p>
</div></section>""" % {
        "head": sec_head(H["cases_num"], H["cases_title"], H["cases_lead"]),
        "cases": cases_block(lang), "scale": scale_block(lang),
        "projects": path_for(lang, "projects"),
        "all": esc(L["ui"]["all_projects"]),
    })

    # 06 доказательства
    proof = []
    for p in H["proof"]:
        proof.append("""<div class="proof__item reveal"><span class="proof__n">%s</span>
<span class="proof__l">%s</span><span class="proof__note">%s</span></div>"""
                     % (counted(p["n"], lang), esc(p["l"]), esc(p["note"])))
    proof.append("""<div class="proof__item reveal"><span class="proof__l">%s</span>
<span class="proof__note">%s</span></div>""" % (esc(H["proof_icsc_label"]), tbd("icsc", lang)))
    out.append("""<section class="section" id="proof"><div class="wrap">
%(head)s<div class="proof">%(proof)s</div></div></section>""" % {
        "head": sec_head(H["proof_num"], H["proof_title"], H["proof_lead"], right=True),
        "proof": "".join(proof),
    })

    # 07 исламское финансирование
    body = "".join("<p>%s</p>" % esc(x) for x in H["islam_body"])
    out.append("""<section class="section section--dark section--wipe" id="islamic">%(ground)s<div class="wrap">
%(head)s
<div class="split"><div class="split__a"><p class="lead">%(lead)s</p></div>
<div class="split__b prose">%(body)s<p class="basis basis--gold">%(disc)s</p></div></div>
</div></section>""" % {
        "ground": GROUND,
        "head": sec_head(H["islam_num"], H["islam_title"], variant="bleed"),
        "lead": esc(H["islam_lead"]), "body": body, "disc": esc(H["islam_disclaimer"]),
    })

    # 08 FAQ
    out.append("""<section class="section" id="faq"><div class="wrap">
%(head)s%(faq)s</div></section>""" % {
        "head": sec_head(H["faq_num"], H["faq_title"]), "faq": faq_block(lang),
    })

    # 09 контакты
    out.append("""<section class="section" id="contact"><div class="wrap">
%(head)s
<div class="split"><div class="split__a stack-md">
<p class="lead">%(promise)s</p>
<ul class="stack-md">
<li><span class="mono-label">%(pl)s</span><br><a class="link" href="tel:%(teltrim)s">%(tel)s</a></li>
<li><span class="mono-label">%(el)s</span><br><a class="link" href="mailto:%(mail)s">%(mail)s</a></li>
<li><span class="mono-label">%(cl)s</span><br>%(cv)s</li>
</ul></div>
<div class="split__b">%(form)s</div></div>
</div></section>""" % {
        "head": sec_head(H["contact_num"], H["contact_title"], H["contact_lead"]),
        "promise": esc(L["contact"]["promise"]),
        "pl": esc(L["contact"]["phone_label"]), "teltrim": facts.PHONE_TEL, "tel": esc(facts.PHONE),
        "el": esc(L["contact"]["email_label"]), "mail": facts.EMAIL,
        "cl": esc(L["contact"]["city_label"]), "cv": esc(L["contact"]["city_value"]),
        "form": form_block(lang, "home"),
    })

    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_services(lang):
    L = LANGS[lang]
    S = L["services"]
    m = L["meta"]["services"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (S["h1"], path_for(lang, "services"))]
    out = [head(lang, "services", m["title"], m["desc"], extra_schema=service_schema(lang),
                breadcrumb=trail)]
    out.append(nav(lang, "services"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap">
<h1 data-lines>%s</h1><p class="lead phead__lead muted reveal">%s</p><div class="phead__meta">%s</div>
</div></section>""" % (esc(S["h1"]), esc(S["lead"]), updated_line(lang)))

    intro = "".join("<p>%s</p>" % esc(x) for x in S["intro_body"])
    out.append("""<section class="section"><div class="wrap">
%s<div class="prose reveal">%s</div></div></section>"""
               % (sec_head(S["intro_num"], S["intro_title"]), intro))

    out.append('<section class="section"><div class="wrap">%s%s</div></section>'
               % (sec_head("02", S["compare_title"]), tiers_block(lang, linked=False)))

    head_row = "".join("<th scope='col'>%s</th>" % esc(h) for h in S["compare_head"])
    rows = []
    for r in S["compare_rows"]:
        cells = "".join(
            "<td>%s</td>" % (esc(S["compare_yes"]) if v == 1 else
                             ('<span class="muted">%s</span>' % esc(S["compare_no"])))
            for v in r[1:])
        rows.append("<tr><th scope='row'>%s</th>%s</tr>" % (esc(r[0]), cells))
    out.append("""<section class="section section--paper2"><div class="wrap">
%(head)s<div class="table-scroll reveal"><table class="plist"><thead><tr>%(hr)s</tr></thead>
<tbody>%(rows)s</tbody></table></div>
<p class="basis mt-md">%(custom)s</p></div></section>""" % {
        "head": sec_head(S["compare_num"], S["compare_title"]),
        "hr": head_row, "rows": "".join(rows),
        "custom": esc("T4: " + S["compare_custom"]),
    })

    nots = "".join("<li>%s</li>" % esc(x) for x in S["not_items"])
    out.append("""<section class="section"><div class="wrap">
%s<div class="prose reveal"><ul>%s</ul></div></div></section>"""
               % (sec_head(S["not_num"], S["not_title"]), nots))

    out.append(cta_strip(lang))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def cta_strip(lang):
    L = LANGS[lang]
    return """<section class="section section--dark section--wipe section--tight">%(ground)s<div class="wrap">
<div class="split"><div class="split__a"><h2 data-lines>%(t)s</h2></div>
<div class="split__b"><p class="lead">%(l)s</p>
<p class="mt-md"><a class="btn btn--ghost magnetic" href="%(c)s" data-goal="strip_cta">%(cta)s<i class="btn__arrow"></i></a></p>
</div></div></div></section>""" % {
        "ground": GROUND,
        "t": esc(L["home"]["contact_title"]), "l": esc(L["contact"]["promise"]),
        "c": path_for(lang, "contact"), "cta": esc(L["home"]["cta1"]),
    }


def page_feasibility(lang):
    L = LANGS[lang]
    F = L["feasibility"]
    m = L["meta"]["feasibility"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")),
             (L["services"]["h1"], path_for(lang, "services")),
             ("T2 CASE Feasibility", path_for(lang, "feasibility"))]
    svc = [s for s in service_schema(lang) if s["@id"].endswith("#feasibility")]
    out = [head(lang, "feasibility", m["title"], m["desc"], extra_schema=svc,
                scripts=("/assets/js/massing.js", "/assets/js/dscr.js"), breadcrumb=trail)]
    out.append(nav(lang, "feasibility"))
    out.append('<main id="main" data-depth-goal="feasibility_depth">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap">
<p class="mono-label phead__eyebrow">%s</p>
<h1 data-lines>%s</h1><p class="lead phead__lead muted reveal">%s</p>
<p class="mt-lg"><a class="btn magnetic" href="%s" data-goal="feasibility_cta">%s<i class="btn__arrow"></i></a></p>
<div class="phead__meta">%s</div></div></section>"""
               % (esc(F["eyebrow"]), esc(F["h1"]), esc(F["lead"]),
                  path_for(lang, "contact"), esc(F["cta"]), updated_line(lang)))

    body1 = "".join("<p>%s</p>" % esc(x) for x in F["s1_body"])
    figs = "".join('<div class="fig" style="%s"><b>%s</b><span>%s</span></div>'
                   % (pos, esc(a), esc(b))
                   for pos, (a, b) in zip(
                       ["left:6%;top:14%", "right:7%;top:30%", "left:9%;bottom:14%"],
                       F["stage_figs"]))
    out.append("""<section class="section"><div class="wrap">
%(head)s
<div class="split"><div class="split__b prose reveal order-2">%(body)s</div>
<div class="split__a reveal">
<div class="stage3d" data-massing>
<img class="stage3d__poster" src="/assets/img/massing-poster.svg" alt="%(alt)s" width="1600" height="1000" loading="lazy" decoding="async">
<div class="stage3d__scene" aria-hidden="true"></div>
<div class="stage3d__figs" aria-hidden="true">%(figs)s</div>
</div>
<p class="basis mt-md">%(cap)s</p>
</div></div></div></section>""" % {
        "head": sec_head(F["s1_num"], F["s1_title"]), "body": body1,
        "alt": esc(F["stage_caption"]), "figs": figs, "cap": esc(F["stage_caption"]),
    })

    toc = "".join("""<div class="case-row"><div class="case-row__k">%02d %s</div>
<div class="case-row__v"><p class="small muted">%s</p></div></div>""" % (i + 1, esc(t), esc(d))
                  for i, (t, d) in enumerate(F["toc"]))
    out.append("""<section class="section section--paper2"><div class="wrap">
%s<div class="case-block reveal">%s</div></div></section>"""
               % (sec_head(F["s2_num"], F["s2_title"], F["s2_lead"]), toc))

    for numkey, titlekey, bodykey in [("s3_num", "s3_title", "s3_body"),
                                      ("s4_num", "s4_title", "s4_body")]:
        b = "".join("<p>%s</p>" % esc(x) for x in F[bodykey])
        out.append("""<section class="section"><div class="wrap">
%s<div class="prose reveal">%s</div></div></section>"""
                   % (sec_head(F[numkey], F[titlekey]), b))

    out.append(stand_block(lang))

    b = "".join("<p>%s</p>" % esc(x) for x in F["s5_body"])
    out.append("""<section class="section"><div class="wrap">
%s<div class="prose reveal">%s</div></div></section>"""
               % (sec_head(F["s5_num"], F["s5_title"], variant="indent"), b))

    T = L["tiers"]
    out.append("""<section class="section section--paper2"><div class="wrap">
%(head)s
<div class="split">
<div class="split__a"><dl class="tier__meta reveal">
<dt>%(lt)s</dt><dd>%(vt)s</dd><dt>%(lp)s</dt><dd>%(vp)s</dd></dl></div>
<div class="split__b reveal"><div class="empty">
<h3>%(et)s</h3><p class="small muted">%(eb)s</p>
<form class="form" method="post" action="%(action)s" enctype="text/plain" data-form="excerpt"
 data-msg-sending="%(sending)s" data-msg-ok="%(sent)s" data-msg-err="%(err)s" data-msg-slow="%(slow)s">
<div class="field field--full"><label for="x-email">%(el)s</label><input id="x-email" name="email" type="email" required></div>
<div class="field field--hp" aria-hidden="true"><label for="x-url">%(trap)s</label><input id="x-url" name="company_url" type="text" tabindex="-1" autocomplete="off"></div>
<input type="hidden" name="started_at" value=""><input type="hidden" name="lang" value="%(lang)s">
<div class="field field--full"><button class="btn btn--red magnetic" type="submit" data-goal="guide_download">%(ec)s<i class="btn__arrow"></i></button></div>
<p class="form__status" data-form-status role="status" aria-live="polite"></p>
</form>
<p class="basis">%(pdf)s</p>
</div></div></div></div></section>""" % {
        "action": facts.FORM_ENDPOINT,
        "head": sec_head(F["s6_num"], F["s6_title"]),
        "lt": esc(T["labels"]["time"]), "vt": tbd("t2_time", lang),
        "lp": esc(T["labels"]["price"]), "vp": tbd("t2_price", lang),
        "et": esc(F["excerpt_title"]), "eb": esc(F["excerpt_body"]),
        "el": esc(F["excerpt_email"]), "ec": esc(F["excerpt_cta"]),
        "trap": esc(L["contact"]["trap_label"]), "lang": lang,
        "sending": esc(L["ui"]["sending"]), "sent": esc(L["ui"]["sent"]),
        "err": esc(L["ui"]["send_error"]), "slow": esc(L["ui"]["too_fast"]),
        "pdf": tbd("excerpt_pdf", lang),
    })

    # Глоссарий там, где сокращений больше всего. Он же помогает машинам,
    # которые собирают ответ из нашей страницы.
    glossary = "".join(
        '<div class="case-row"><div class="case-row__k">%s</div>'
        '<div class="case-row__v"><p class="small muted">%s</p></div></div>'
        % (esc(t), esc(d)) for t, d in F["glossary"])
    out.append("""<section class="section section--tight"><div class="wrap">
<h2 data-lines>%s</h2><div class="case-block mt-md reveal">%s</div></div></section>"""
               % (esc(F["glossary_title"]), glossary))

    out.append(cta_strip(lang))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def stand_block(lang):
    """Стенд DSCR. Начальное состояние считается здесь же, поэтому без
    JavaScript блок показывает не пустые поля, а готовый пример."""
    L = LANGS[lang]
    F = L["feasibility"]
    GLA, OPEX, DEBT, RATE, YEARS = 20000, 0.30, 18000000, 0.12, 10
    base = [28, 8, 0]  # ставка, вакансия, задержка
    service = DEBT * RATE / (1 - (1 + RATE) ** -YEARS)
    gross = GLA * base[0] * 12 * (1 - base[1] / 100.0) * (1 - base[2] / 12.0)
    noi = gross * (1 - OPEX)
    dscr = noi / service
    ok = dscr >= 1.30
    dec = "." if lang == "en" else ","

    def money(v):
        return "{:,.0f}".format(v).replace(",", " ")

    ranges = [(12, 45, 1), (0, 30, 1), (0, 12, 1)]
    dials = []
    for i, (name, unit) in enumerate(F["stand_inputs"]):
        lo, hi, step = ranges[i]
        dials.append("""<div class="dial">
<div class="dial__top"><label class="dial__name" for="dial-%(i)d">%(name)s</label>
<span class="dial__val"><span data-out>%(v)s</span><small>%(unit)s</small></span></div>
<input id="dial-%(i)d" type="range" min="%(lo)d" max="%(hi)d" step="%(step)d" value="%(v)s"
 aria-label="%(name)s, %(unit)s"></div>""" % {
            "i": i, "name": esc(name), "unit": esc(unit), "v": base[i],
            "lo": lo, "hi": hi, "step": step,
        })

    assumptions = "".join("<li>%s</li>" % esc(x) for x in F["stand_assumptions"])
    return """<section class="section section--paper2" id="stand"><div class="wrap">
%(head)s
<div class="stand" data-stand data-state="%(state)s" data-dec="%(dec)s"
 data-ok="%(okmsg)s" data-bad="%(badmsg)s">
<div class="stand__controls reveal">
%(dials)s
<div class="prose"><h4>%(atitle)s</h4><ul>%(assump)s</ul></div>
</div>
<div class="stand__out reveal">
<div class="stand__row"><span>%(noil)s</span><b data-noi>%(noi)s</b></div>
<div class="stand__row"><span>%(debtl)s</span><b data-debt>%(debt)s</b></div>
<div class="stand__dscr"><b data-dscr>%(dscr)s</b>
<span class="stand__verdict" data-verdict>%(verdict)s</span></div>
<div class="scale"><span class="scale__fill" data-fill style="width:%(fill).1f%%"></span>
<span class="scale__mark" style="left:43.3%%"></span></div>
<div class="scale__note"><span>0</span><span>%(thr)s</span><span>3%(dec)s0</span></div>
<p class="basis">%(disc)s</p>
</div></div></div></section>""" % {
        "head": sec_head(F["stand_num"], F["stand_title"], F["stand_lead"], variant="bleed"),
        "state": "ok" if ok else "bad", "dec": dec,
        "okmsg": esc(F["stand_ok"]), "badmsg": esc(F["stand_bad"]),
        "dials": "".join(dials), "atitle": esc(F["stand_assumptions_title"]),
        "assump": assumptions,
        "noil": esc(F["stand_noi"]), "noi": money(noi),
        "debtl": esc(F["stand_debt"]), "debt": money(service),
        "dscr": ("%.2f" % dscr).replace(".", dec),
        "verdict": esc(F["stand_ok"] if ok else F["stand_bad"]),
        "fill": max(0.0, min(100.0, dscr / 3 * 100)),
        "thr": esc(F["stand_threshold"]), "disc": esc(F["stand_disclaimer"]),
    }


def page_projects(lang):
    L = LANGS[lang]
    P = L["projects"]
    m = L["meta"]["projects"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (P["h1"], path_for(lang, "projects"))]
    out = [head(lang, "projects", m["title"], m["desc"], breadcrumb=trail)]
    out.append(nav(lang, "projects"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap">
<h1 data-lines>%s</h1><p class="lead phead__lead muted reveal">%s</p><div class="phead__meta">%s</div>
</div></section>""" % (esc(P["h1"]), esc(P["lead"]), updated_line(lang)))

    filters = "".join('<button type="button" data-filter="%s" aria-pressed="%s">%s</button>'
                      % (k, "true" if k == "all" else "false", esc(v)) for k, v in P["filters"])
    rows = []
    for c in facts.CASES:
        cd = L["cases"][c["slug"]]
        tags = "%s %s" % (c["country_key"], "mixed" if c["slug"] != "chilonzor" else "retail")
        rows.append("""<tr data-project="%(tags)s">
<td><a class="link" href="%(href)s">%(name)s</a></td>
<td>%(city)s</td><td><b>%(gla)s</b></td><td>%(role)s</td>
<td><span class="micro muted">%(status)s</span></td></tr>""" % {
            "tags": tags, "href": case_path(lang, c["slug"]), "name": esc(cd["name"]),
            "city": esc(L["cities"][c["city_key"]]), "gla": num(c["gla"], lang),
            "role": esc(cd["why"].split(":")[0]), "status": esc(P["status_open"]),
        })
    for a in facts.ANON_ROWS:
        rows.append("""<tr data-project="%(tags)s">
<td>%(name)s</td><td>%(country)s</td><td><b>%(gla)s</b></td><td>%(role)s</td>
<td><span class="micro muted">%(status)s</span></td></tr>""" % {
            "tags": a["filter"], "name": esc(P["anon_names"][a["key"]]),
            "country": esc(L["countries"][a["country_key"]]), "gla": num(a["gla"], lang),
            "role": esc(L["case_labels"]["role"]), "status": esc(P["status_anon"]),
        })
    head_row = "".join("<th scope='col'>%s</th>" % esc(h) for h in P["head"])
    out.append("""<section class="section"><div class="wrap">
<div class="filters" data-filters aria-label="%(flabel)s">%(filters)s</div>
<p class="micro muted">%(shown)s <span data-project-count>%(n)d</span> %(of)s %(total)d %(word)s</p>
<div class="table-scroll mt-md"><table class="plist"><thead><tr>%(hr)s</tr></thead>
<tbody>%(rows)s</tbody></table></div>
<div class="empty mt-lg reveal"><h3>%(pt)s: %(pending)d</h3><p class="small muted">%(pb)s</p><p>%(tbd)s</p></div>
<div class="mt-lg reveal"><h2>%(polt)s</h2><p class="prose mt-md muted">%(polb)s</p></div>
</div></section>""" % {
        "flabel": esc(P["filters_label"]), "filters": filters,
        "shown": esc(L["ui"]["shown"]), "n": len(rows), "of": esc(L["ui"]["of"]),
        "total": facts.PROJECTS, "word": esc(L["ui"]["projects_word"]),
        "hr": head_row, "rows": "".join(rows),
        "pt": esc(P["pending_title"]), "pending": facts.PROJECTS_PENDING,
        "pb": esc(P["pending_body"]), "tbd": tbd("nda_audit", lang),
        "polt": esc(P["policy_title"]), "polb": esc(P["policy_body"]),
    })
    out.append(cta_strip(lang))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_case(lang, case):
    L = LANGS[lang]
    cd = L["cases"][case["slug"]]
    CL = L["case_labels"]
    p = case_path(lang, case["slug"])
    title = "%s: %s" % (cd["name"], L["cities"][case["city_key"]])
    if len(title) > 58:
        title = cd["name"]
    desc = cd["why"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")),
             (L["projects"]["h1"], path_for(lang, "projects")),
             (cd["name"], p)]
    schema = [{
        "@type": "CreativeWork",
        "@id": SITE + p + "#case",
        "name": cd["name"],
        "about": cd["problem"],
        "creator": {"@id": SITE + "/#organization"},
        "inLanguage": lang,
        "dateModified": facts.UPDATED,
    }]
    out = [head(lang, "case", title, desc, extra_schema=schema, canonical_path=p, breadcrumb=trail)]
    out.append(nav(lang, "projects"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap">
<p class="mono-label phead__eyebrow">%(city)s, %(country)s</p>
<h1 data-lines>%(name)s</h1><p class="lead phead__lead muted reveal">%(why)s</p>
<div class="phead__meta">%(upd)s</div></div></section>""" % {
        "city": esc(L["cities"][case["city_key"]]),
        "country": esc(L["countries"][case["country_key"]]),
        "name": esc(cd["name"]), "why": esc(cd["why"]), "upd": updated_line(lang),
    })
    out.append("""<section class="section section--tight"><div class="wrap">
<figure class="case-media reveal" data-vt="%s"><img src="/assets/img/cases/%s.svg" alt="%s" width="1600" height="686" fetchpriority="high" decoding="async"></figure>
</div></section>""" % (case["slug"], case["slug"], esc(cd["name"])))

    params = []
    params.append((CL["city"], L["cities"][case["city_key"]]))
    params.append((CL["country"], L["countries"][case["country_key"]]))
    if case.get("investor"):
        params.append((CL["investor"], case["investor"]))
    params.append((CL["gla"], "%s m<sup>2</sup>" % num(case["gla"], lang)))
    if case.get("year"):
        params.append((CL["year"], str(case["year"])))
    if case.get("renovation"):
        params.append(("%s, %s" % (CL["year"], "renovation"), case["renovation"]))

    param_rows = "".join("<tr><th scope='row'>%s</th><td>%s</td></tr>" % (esc(k), v if "<sup>" in str(v) else esc(v))
                         for k, v in params)
    result_key = {"82-mall": "case_82_result", "chilonzor": "case_chilonzor_result",
                  "jabal-omar": "case_jabal_result"}[case["slug"]]

    rows = [
        (CL["problem"], "<p>%s</p>" % esc(cd["problem"])),
        (CL["stage"], "<p>%s</p>" % esc(cd["stage"])),
        (CL["solution"], "<p>%s</p>" % esc(cd["solution"])),
        (CL["result"], "<p>%s</p>" % tbd(result_key, lang)),
        (CL["params"], '<div class="table-scroll"><table class="spec"><tbody>%s</tbody></table></div>' % param_rows),
        (CL["nda"], '<p class="small muted">%s</p>' % esc(cd["nda"])),
    ]
    block = "".join("""<div class="case-row reveal"><div class="case-row__k">%s</div>
<div class="case-row__v">%s</div></div>""" % (esc(k), v) for k, v in rows)
    out.append('<section class="section"><div class="wrap"><div class="case-block">%s</div>'
               '<p class="mt-lg"><a class="arrow-link" href="%s">%s</a></p></div></section>'
               % (block, path_for(lang, "projects"), esc(L["ui"]["back_to_projects"])))
    out.append(cta_strip(lang))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_leasing(lang):
    L = LANGS[lang]
    G = L["leasing"]
    m = L["meta"]["leasing"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (G["h1"], path_for(lang, "leasing"))]
    out = [head(lang, "leasing", m["title"], m["desc"], breadcrumb=trail)]
    out.append(nav(lang, "leasing"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap"><h1 data-lines>%s</h1>
<p class="lead phead__lead muted reveal">%s</p><div class="phead__meta">%s</div></div></section>"""
               % (esc(G["h1"]), esc(G["lead"]), updated_line(lang)))
    for numk, titlek, bodyk in [("s1_num", "s1_title", "s1_body"), ("s2_num", "s2_title", "s2_body")]:
        b = "".join("<p>%s</p>" % esc(x) for x in G[bodyk])
        extra = ('<p class="mt-md"><a class="arrow-link" href="%s">%s</a></p>'
                 % (path_for(lang, "conflicts"), esc(G["s2_link"]))) if titlek == "s2_title" else ""
        out.append("""<section class="section"><div class="wrap">%s<div class="prose reveal">%s</div>%s</div></section>"""
                   % (sec_head(G[numk], G[titlek]), b, extra))
    do = "".join("<li>%s</li>" % esc(x) for x in G["do"])
    dont = "".join("<li>%s</li>" % esc(x) for x in G["dont"])
    out.append("""<section class="section section--paper2"><div class="wrap">%(head)s
<div class="split"><div class="split__a prose reveal"><h3>%(dt)s</h3><ul>%(do)s</ul></div>
<div class="split__b prose reveal"><h3>%(nt)s</h3><ul>%(dont)s</ul></div></div>
</div></section>""" % {
        "head": sec_head(G["s3_num"], G["s3_title"]), "dt": esc(G["do_title"]),
        "do": do, "nt": esc(G["dont_title"]), "dont": dont,
    })
    out.append(cta_strip(lang))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_insights(lang):
    L = LANGS[lang]
    I = L["insights"]
    m = L["meta"]["insights"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (I["h1"], path_for(lang, "insights"))]
    out = [head(lang, "insights", m["title"], m["desc"], breadcrumb=trail)]
    out.append(nav(lang, "insights"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap"><h1 data-lines>%s</h1>
<p class="lead phead__lead muted reveal">%s</p><div class="phead__meta">%s</div></div></section>"""
               % (esc(I["h1"]), esc(I["lead"]), updated_line(lang)))
    body = "".join("<p>%s</p>" % esc(x) for x in I["empty_body"])
    out.append("""<section class="section"><div class="wrap"><div class="empty reveal">
<h2>%(t)s</h2><div class="prose">%(b)s</div>
<form class="form" method="post" action="%(action)s" enctype="text/plain" data-form="insights"
 data-msg-sending="%(sending)s" data-msg-ok="%(sent)s" data-msg-err="%(err)s" data-msg-slow="%(slow)s">
<div class="field field--full"><label for="i-email">%(el)s</label><input id="i-email" name="email" type="email" required></div>
<div class="field field--hp" aria-hidden="true"><label for="i-url">%(trap)s</label><input id="i-url" name="company_url" type="text" tabindex="-1" autocomplete="off"></div>
<input type="hidden" name="started_at" value=""><input type="hidden" name="lang" value="%(lang)s">
<div class="field field--full"><button class="btn btn--red magnetic" type="submit" data-goal="insights_subscribe">%(cta)s<i class="btn__arrow"></i></button></div>
<p class="form__status" data-form-status role="status" aria-live="polite"></p></form>
</div></div></section>""" % {
        "action": facts.FORM_ENDPOINT,
        "t": esc(I["empty_title"]), "b": body, "el": esc(I["email_label"]),
        "cta": esc(I["cta"]), "trap": esc(L["contact"]["trap_label"]), "lang": lang,
        "sending": esc(L["ui"]["sending"]), "sent": esc(L["ui"]["sent"]),
        "err": esc(L["ui"]["send_error"]), "slow": esc(L["ui"]["too_fast"]),
    })
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_about(lang):
    L = LANGS[lang]
    A = L["about"]
    m = L["meta"]["about"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (A["h1"], path_for(lang, "about"))]
    out = [head(lang, "about", m["title"], m["desc"], breadcrumb=trail)]
    out.append(nav(lang, "about"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap"><h1 data-lines>%s</h1>
<p class="lead phead__lead muted reveal">%s</p><div class="phead__meta">%s</div></div></section>"""
               % (esc(A["h1"]), esc(A["lead"]), updated_line(lang)))
    b1 = "".join("<p>%s</p>" % esc(x) for x in A["s1_body"])
    out.append('<section class="section"><div class="wrap">%s<div class="prose reveal">%s</div></div></section>'
               % (sec_head(A["s1_num"], A["s1_title"]), b1))

    layers = "".join("""<div class="depth__layer reveal">
<div class="depth__mark"><span class="depth__d">%02d</span><span class="depth__u">%s</span></div>
<div class="depth__body"><h3>%s</h3><p class="small muted mt-md">%s</p></div>
<div class="depth__out"><h4>%s</h4><p class="small">%s</p></div></div>"""
                     % (i + 1, esc(l[0]), esc(l[1]), esc(l[2]), esc(A["depth_out_label"]), esc(l[3]))
                     for i, l in enumerate(A["depth"]))
    out.append('<section class="section section--paper2 depth"><div class="wrap">%s%s</div></section>'
               % (sec_head(A["s2_num"], A["s2_title"], A["s2_lead"]), layers))

    b3 = "".join("<p>%s</p>" % esc(x) for x in A["s3_body"])
    out.append('<section class="section"><div class="wrap">%s<div class="prose reveal">%s</div></div></section>'
               % (sec_head(A["s3_num"], A["s3_title"]), b3))

    team = "".join("""<article class="person reveal"><span class="person__role">%s</span>
<h3>%s</h3><p class="small muted">%s</p><p class="person__note">%s</p></article>"""
                   % (esc(p["role"]), esc(p["name"]), esc(p["note"]), tbd("team_dates", lang))
                   for p in A["team"])
    out.append('<section class="section"><div class="wrap">%s<div class="team">%s</div></div></section>'
               % (sec_head(A["s4_num"], A["s4_title"], A["s4_lead"]), team))

    out.append("""<section class="section section--tight"><div class="wrap">%s
<p class="prose muted reveal">%s</p><p class="mt-md">%s</p></div></section>"""
               % (sec_head(A["s5_num"], A["s5_title"]), esc(A["s5_body"]), tbd("icsc", lang)))
    out.append(cta_strip(lang))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_contact(lang):
    L = LANGS[lang]
    C = L["contact"]
    m = L["meta"]["contact"]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (C["h1"], path_for(lang, "contact"))]
    schema = [{
        "@type": "ContactPage",
        "@id": SITE + path_for(lang, "contact") + "#contactpage",
        "about": {"@id": SITE + "/#organization"},
        "inLanguage": lang,
    }]
    out = [head(lang, "contact", m["title"], m["desc"], extra_schema=schema, breadcrumb=trail)]
    out.append(nav(lang, "contact"))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap"><h1 data-lines>%s</h1>
<p class="lead phead__lead muted reveal">%s</p><div class="phead__meta">%s</div></div></section>"""
               % (esc(C["h1"]), esc(C["lead"]), updated_line(lang)))
    out.append("""<section class="section"><div class="wrap"><div class="split">
<div class="split__a stack-md reveal">
<p class="lead">%(promise)s</p>
<ul class="stack-md">
<li><span class="mono-label">%(pl)s</span><br><a class="link" href="tel:%(teltrim)s">%(tel)s</a></li>
<li><span class="mono-label">%(el)s</span><br><a class="link" href="mailto:%(mail)s">%(mail)s</a></li>
<li><span class="mono-label">%(cl)s</span><br>%(cv)s</li>
</ul></div>
<div class="split__b reveal"><h2 class="mb">%(ft)s</h2><div class="mt-md">%(form)s</div></div>
</div></div></section>""" % {
        "promise": esc(C["promise"]), "pl": esc(C["phone_label"]),
        "teltrim": facts.PHONE_TEL, "tel": esc(facts.PHONE),
        "el": esc(C["email_label"]), "mail": facts.EMAIL,
        "cl": esc(C["city_label"]), "cv": esc(C["city_value"]),
        "ft": esc(C["form_title"]), "form": form_block(lang, "contact"),
    })
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


def page_legal(lang, key):
    L = LANGS[lang]
    D = L[key]
    m = L["meta"][key]
    trail = [(L["ui"]["home_crumb"], path_for(lang, "home")), (D["h1"], path_for(lang, key))]
    out = [head(lang, key, m["title"], m["desc"], breadcrumb=trail)]
    out.append(nav(lang, key))
    out.append('<main id="main">')
    out.append(crumbs(lang, trail))
    out.append("""<section class="phead"><div class="wrap"><h1>%s</h1>
<div class="phead__meta">%s</div></div></section>""" % (esc(D["h1"]), updated_line(lang)))
    blocks = []
    for i, (title, paras) in enumerate(D["body"], 1):
        ps = "".join("<p>%s</p>" % esc(x) for x in paras)
        blocks.append('<div class="case-row reveal"><div class="case-row__k">%02d %s</div>'
                      '<div class="case-row__v prose">%s</div></div>' % (i, esc(title), ps))
    out.append('<section class="section"><div class="wrap"><div class="case-block">%s</div></div></section>'
               % "".join(blocks))
    out.append("</main>")
    out.append(foot(lang))
    return "".join(out)


# ----------------------------------------------------------------- служебные файлы
def build_robots():
    allowed = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User",
               "PerplexityBot", "Perplexity-User", "Googlebot", "YandexBot"]
    lines = [
        "# CASE Real Estate Advisory",
        "# Поисковых роботов ИИ не закрываем: закрыть их значит выпасть из ответов целиком.",
        "",
    ]
    for bot in allowed:
        lines += ["User-agent: %s" % bot, "Allow: /", ""]
    lines += [
        "User-agent: *",
        "Allow: /",
        "Disallow: /os/",
        "Disallow: /admin/",
        "Disallow: /docs/",
        "",
        "# Обучающие краулеры. Решение за собственником: снимите комментарий,",
        "# если контент не должен уходить в обучающие выборки.",
        "# User-agent: GPTBot",
        "# Disallow: /",
        "# User-agent: ClaudeBot",
        "# Disallow: /",
        "# User-agent: Google-Extended",
        "# Disallow: /",
        "",
        "Sitemap: %s/sitemap.xml" % SITE,
        "",
    ]
    write("/robots.txt", "\n".join(lines))


def build_sitemap():
    urls = []
    for lang in facts.LANGS:
        for page in facts.PAGES:
            urls.append((SITE + path_for(lang, page), lang, page, None))
        for c in facts.CASES:
            urls.append((SITE + case_path(lang, c["slug"]), lang, "case", c["slug"]))
    parts = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
             'xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for url, lang, page, slug in urls:
        alts = []
        for code in facts.LANGS:
            alt = SITE + (case_path(code, slug) if page == "case" else path_for(code, page))
            alts.append('<xhtml:link rel="alternate" hreflang="%s" href="%s"/>' % (code, alt))
        alts.append('<xhtml:link rel="alternate" hreflang="x-default" href="%s"/>'
                    % (SITE + (case_path(facts.DEFAULT_LANG, slug) if page == "case"
                               else path_for(facts.DEFAULT_LANG, page))))
        prio = "1.0" if page == "home" else ("0.9" if page in ("feasibility", "services") else "0.7")
        parts.append("<url><loc>%s</loc><lastmod>%s</lastmod><priority>%s</priority>%s</url>"
                     % (url, facts.UPDATED, prio, "".join(alts)))
    parts.append("</urlset>")
    write("/sitemap.xml", "\n".join(parts) + "\n")


def build_llms():
    L = LANGS["en"]
    lines = [
        "# CASE Real Estate Advisory",
        "",
        "> Independent commercial real estate advisory firm based in Tashkent, Uzbekistan, "
        "founded in %d. CASE answers what to build on a site and what it will earn, "
        "before architectural design begins. Portfolio: %d projects in %d countries." % (
            facts.FOUNDED, facts.PROJECTS, facts.COUNTRIES),
        "",
        "CASE is not an architecture practice, not a broker and not a valuer. "
        "The firm sells the decision that is taken before the drawing exists: "
        "concept, merchandise mix, zoning, a design brief for the architect and a financial model.",
        "",
        "## Core pages",
        "",
        "- [What to build and what it will earn](%s/en/): position, the seven stage chain, "
        "the four engagement formats and the proof numbers." % SITE,
        "- [T2 CASE Feasibility](%s/en/feasibility.html): the financial model product, "
        "the bank version, the DSCR 1.30 break point and the forecast versus outcome promise." % SITE,
        "- [Services T1 to T4](%s/en/services.html): what each format includes and, "
        "just as important, what it excludes." % SITE,
        "- [Projects](%s/en/projects.html): the portfolio register with parameters and CASE role." % SITE,
        "- [Leasing](%s/en/leasing.html): leasing as execution of an approved strategy." % SITE,
        "- [Conflict of interest policy](%s/en/legal/conflicts.html): how advisory and leasing are separated." % SITE,
        "- [About the firm](%s/en/about.html): method, team and how numbers are sourced." % SITE,
        "",
        "## Verifiable numbers",
        "",
        "- Founded: %d." % facts.FOUNDED,
        "- Projects in the portfolio: %d." % facts.PROJECTS,
        "- Countries: %d." % facts.COUNTRIES,
        "- %s mn m2 GBA, including work by members of the team before CASE was founded in %d."
        % (facts.GBA_MN, facts.FOUNDED),
        "- Response to an enquiry: within %d hours on working days." % facts.RESPONSE_HOURS,
        "",
        "## Languages",
        "",
        "- Uzbek: %s/ (default)" % SITE,
        "- Russian: %s/ru/" % SITE,
        "- English: %s/en/" % SITE,
        "",
        "## Contact",
        "",
        "- Phone: %s" % facts.PHONE,
        "- Email: %s" % facts.EMAIL,
        "- Office: Tashkent, Uzbekistan",
        "",
        "Last updated: %s" % facts.UPDATED,
        "",
    ]
    write("/llms.txt", "\n".join(lines))


def build_manifest():
    data = {
        "name": facts.LEGAL_NAME,
        "short_name": "CASE",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#FAF9F7",
        "theme_color": "#FAF9F7",
        "icons": [{"src": "/assets/img/favicon.svg", "sizes": "any", "type": "image/svg+xml"}],
    }
    write("/site.webmanifest", json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def build_redirects():
    host = SITE.split("//")[1]
    lines = [
        "# Карта 301 со старых адресов",
        "",
        "Старый сайт держал языки отдельными страницами и дублировал портфолио.",
        "Каждый адрес ниже отдаёт 301 на новый. Готовые правила: `redirects/.htaccess`",
        "(Apache, DirectAdmin) и `redirects/_redirects` (Netlify).",
        "",
        "| Старый адрес | Новый адрес |",
        "|---|---|",
    ]
    for old in facts.OLD_URLS:
        lines.append("| `%s` | `%s` |" % (old, facts.REDIRECT_MAP[old]))
    lines += [
        "",
        "## Два домена: %s и %s" % (host, facts.ALT_HOST),
        "",
        "Сейчас работают оба. Канонический один: `%s`. Поисковой системе и ИИ" % host,
        "нужен единственный адрес, иначе вес делится между копиями, а в ответы",
        "попадает то одна версия, то другая.",
        "",
        "Правило: весь сайтовый трафик с `%s` и с `www` уходит 301 на `%s`." % (facts.ALT_HOST, host),
        "",
        "**Важное исключение.** На `%s` живёт внутренняя платформа CASE OS" % facts.ALT_HOST,
        "в папке `/os/` (её заливает GitHub Actions) и админка в `/admin/`.",
        "Эти пути редиректить нельзя: они не часть публичного сайта.",
        "Правила в `redirects/.htaccess` их исключают. Почта на домене `.uz`",
        "(`%s`) редиректом не затрагивается вообще." % facts.EMAIL,
        "",
    ]
    with open(os.path.join(ROOT, "redirects.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    ht = ["# Сгенерировано site-src/build.py. Правки вносите в facts.REDIRECT_MAP.",
          "RewriteEngine On",
          "",
          "# CASE OS и админка остаются на своём хосте, их не трогаем.",
          "RewriteRule ^os/ - [L]",
          "RewriteRule ^admin/ - [L]",
          "",
          "# Единственный канонический хост.",
          "RewriteCond %{HTTP_HOST} ^www\\.(.*)$ [NC]",
          "RewriteRule ^(.*)$ https://%1/$1 [R=301,L]",
          "RewriteCond %%{HTTP_HOST} ^%s$ [NC]" % re.escape(facts.ALT_HOST),
          "RewriteRule ^(.*)$ https://%s/$1 [R=301,L]" % host,
          ""]
    for old in facts.OLD_URLS:
        ht.append("RedirectMatch 301 ^%s/?$ %s" % (re.escape(old), facts.REDIRECT_MAP[old]))
    ht.append("")
    write("/redirects/.htaccess", "\n".join(ht))

    nf = ["# Сгенерировано site-src/build.py",
          "https://%s/os/*   https://%s/os/:splat   200" % (facts.ALT_HOST, facts.ALT_HOST),
          "https://%s/*      https://%s/:splat      301!" % (facts.ALT_HOST, host)]
    for old in facts.OLD_URLS:
        nf.append("%s  %s  301" % (old, facts.REDIRECT_MAP[old]))
    nf.append("")
    write("/redirects/_redirects", "\n".join(nf))


def build_todo():
    lines = [
        "# TODO-CONTENT: что нужно от CASE до запуска",
        "",
        "Собрано автоматически при сборке: `python3 site-src/build.py`.",
        "Каждая строка это жёлтый маркер на сайте. Пока маркер стоит, страницу нельзя",
        "считать готовой к публикации.",
        "",
        "Дата сборки: %s" % facts.UPDATED,
        "",
        "| Ключ | Кто отвечает | На какой вопрос нужен ответ | Где на сайте |",
        "|---|---|---|---|",
    ]
    where = {
        "t1_time": "Главная, Услуги", "t1_price": "Главная, Услуги",
        "t2_time": "Главная, Услуги, Feasibility", "t2_price": "Главная, Услуги, Feasibility",
        "t3_time": "Главная, Услуги", "t3_price": "Главная, Услуги",
        "t4_time": "Главная, Услуги", "t4_price": "Главная, Услуги",
        "icsc": "Главная, О фирме",
        "case_82_result": "Кейс 82 Mall", "case_chilonzor_result": "Кейс Chilonzor",
        "case_jabal_result": "Кейс Jabal Omar",
        "scenarios": "Главная, блок 04", "form_endpoint": "Все формы",
        "nda_audit": "Проекты", "excerpt_pdf": "Feasibility",
        "team_dates": "О фирме", "og_photo": "Карточки кейсов, OG",
        "analytics": "Все страницы",
    }
    for key in sorted(facts.TBD):
        t = facts.TBD[key]
        mark = "" if key in USED_TBD else " (маркер сейчас не выводится)"
        lines.append("| `%s` | %s | %s%s | %s |" % (key, t["owner"], t["q"], mark, where.get(key, "")))
    lines += [
        "",
        "## Отдельно: расхождения, которые надо закрыть решением, а не текстом",
        "",
        "1. **82 Mall, GLA.** На сайте везде 35 324 м², как задано брифом. Внутренний реестр",
        "   `case-site/os/data/case_portfolio_projects_v4.9.3.json` показывает 36 000 м²",
        "   и инвестора SOM LLC вместо DAR DAR. Нужно решить, какое значение верное,",
        "   и привести реестр и сайт к одному.",
        "2. **Jabal Omar, GLA.** На сайте 60 000 м² по брифу, во внутреннем реестре 50 000 м².",
        "3. **Размер портфеля.** На сайте 42 проекта. Во внутреннем реестре 95 строк",
        "   со статусом `needs_review`. Нужна письменная методика счёта проекта:",
        "   что считается проектом, что стадией, что отдельным мандатом.",
        "4. **Членство ICSC.** В маркетинговых материалах фигурирует, в Company Profile нет,",
        "   в конкурентном обзоре указано, что публичных членств у фирмы нет.",
        "   До подтверждения статуса на сайте стоит маркер, а не заявление.",
        "5. **Контакты.** На сайте один телефон и одна почта: %s и %s." % (facts.PHONE, facts.EMAIL),
        "   В обращении есть ещё две пары. Остальные надо вывести из использования.",
        "",
    ]
    with open(os.path.join(ROOT, "TODO-CONTENT.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


# ----------------------------------------------------------------- проверки
def check(files):
    problems = []
    for p in files:
        with open(p, encoding="utf-8") as f:
            s = f.read()
        # Символы заданы кодами: сам файл проверки не должен их содержать.
        if "\u2014" in s or "\u2013" in s:
            problems.append("%s: найдено тире" % os.path.relpath(p, ROOT))
        m = re.search(r"<title>(.*?)</title>", s, re.S)
        if m and len(m.group(1)) > 60:
            problems.append("%s: title %d символов, лимит 60" % (os.path.relpath(p, ROOT), len(m.group(1))))
        m = re.search(r'<meta name="description" content="(.*?)">', s, re.S)
        if m and len(m.group(1)) > 155:
            problems.append("%s: description %d символов, лимит 155"
                            % (os.path.relpath(p, ROOT), len(m.group(1))))
        if s.count("<h1") != 1:
            problems.append("%s: h1 встречается %d раз" % (os.path.relpath(p, ROOT), s.count("<h1")))
    unknown = USED_TBD - set(facts.TBD)
    for k in unknown:
        problems.append("маркер TBD `%s` не описан в facts.TBD" % k)
    return problems


# ----------------------------------------------------------------- запуск
def main():
    files = []
    for lang in facts.LANGS:
        files.append(write(path_for(lang, "home"), page_home(lang)))
        files.append(write(path_for(lang, "services"), page_services(lang)))
        files.append(write(path_for(lang, "feasibility"), page_feasibility(lang)))
        files.append(write(path_for(lang, "projects"), page_projects(lang)))
        files.append(write(path_for(lang, "leasing"), page_leasing(lang)))
        files.append(write(path_for(lang, "insights"), page_insights(lang)))
        files.append(write(path_for(lang, "about"), page_about(lang)))
        files.append(write(path_for(lang, "contact"), page_contact(lang)))
        files.append(write(path_for(lang, "privacy"), page_legal(lang, "privacy")))
        files.append(write(path_for(lang, "conflicts"), page_legal(lang, "conflicts")))
        for c in facts.CASES:
            files.append(write(case_path(lang, c["slug"]), page_case(lang, c)))

    build_robots()
    build_sitemap()
    build_llms()
    build_manifest()
    build_redirects()
    build_todo()

    problems = check(files)
    print("Собрано страниц: %d" % len(files))
    print("Маркеров TBD на сайте: %d из %d описанных" % (len(USED_TBD), len(facts.TBD)))
    if problems:
        print("\nПроблемы (%d):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1
    print("Проверки пройдены: тире нет, title и description в лимитах, по одному h1 на страницу.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
