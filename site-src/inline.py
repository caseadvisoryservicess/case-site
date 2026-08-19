#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Однофайловый предпросмотр страницы сайта.

Зачем: собранный сайт это набор файлов, и чтобы его посмотреть, нужен сервер.
Этот скрипт складывает одну страницу в один .html: стили, шрифты, схемы и
скрипты уходят внутрь файла. Такой файл можно открыть двойным кликом,
отправить в мессенджере или опубликовать как ссылку на предпросмотр.

Это только предпросмотр. Настоящий сайт лежит в case-site/ и деплоится
файлами: переходы между страницами внутри одного файла работать не могут
и поэтому отключены явно, с предупреждением наверху.

Запуск:
    python3 site-src/inline.py ru/index.html > /tmp/preview.html
    python3 site-src/inline.py                # то же самое, ru/index.html
"""

import base64
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SITE = os.path.join(ROOT, "case-site")

# Начертания, которые реально рисуют русскую страницу. Остальные подмножества
# в предпросмотр не тащим: они утяжелят файл и ни разу не понадобятся.
FONTS_BY_LANG = {
    "ru": ["oswald-400-cyrillic", "bebas-neue-400-latin",
           "montserrat-400-cyrillic", "montserrat-500-cyrillic", "montserrat-700-cyrillic",
           "montserrat-400-latin", "montserrat-500-latin", "montserrat-700-latin"],
    "uz": ["bebas-neue-400-latin", "bebas-neue-400-latin-ext",
           "montserrat-400-latin", "montserrat-500-latin", "montserrat-700-latin"],
    "en": ["bebas-neue-400-latin",
           "montserrat-400-latin", "montserrat-500-latin", "montserrat-700-latin"],
}

BANNER = {
    "ru": ("Предпросмотр одной страницы в одном файле. "
           "Настоящий сайт состоит из 39 страниц, переходы здесь отключены."),
    "uz": ("Bitta faylda bitta sahifaning koʻrinishi. "
           "Haqiqiy sayt 39 sahifadan iborat, bu yerda oʻtishlar oʻchirilgan."),
    "en": ("A one page preview in a single file. "
           "The real site has 39 pages; navigation is disabled here."),
}


def data_uri(path, mime):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def inline_css(lang):
    css = open(os.path.join(SITE, "assets/css/styles.css"), encoding="utf-8").read()
    keep = set(FONTS_BY_LANG[lang])

    def font_face(m):
        block, name = m.group(0), m.group(1)
        if name not in keep:
            return ""
        uri = data_uri(os.path.join(SITE, "assets/fonts", name + ".woff2"), "font/woff2")
        return block.replace("'../fonts/%s.woff2'" % name, "'%s'" % uri)

    css = re.sub(r"@font-face\{[^}]*?\.\./fonts/([a-z0-9-]+)\.woff2[^}]*?\}", font_face, css)
    # @charset допустим только в отдельном файле стилей, внутри style он мусор.
    return css.replace('@charset "utf-8";', "").lstrip()


def inline_js(body):
    """Порядок важен: сначала библиотека, потом наш код."""
    parts = []
    for rel in ("vendor/gsap.min.js", "vendor/ScrollTrigger.min.js",
                "vendor/SplitText.min.js", "vendor/lenis.min.js"):
        parts.append(open(os.path.join(SITE, "assets/js", rel), encoding="utf-8").read())

    # app.js подключает i18n.js как модуль. Внутри одного файла модули не нужны,
    # поэтому склеиваем и снимаем import и export.
    i18n = open(os.path.join(SITE, "assets/js/i18n.js"), encoding="utf-8").read()
    i18n = i18n.replace("export function", "function")
    app = open(os.path.join(SITE, "assets/js/app.js"), encoding="utf-8").read()
    app = re.sub(r"^import .*?;\s*$", "", app, flags=re.M)
    parts.append("(function(){\n%s\n%s\n})();" % (i18n, app))

    parts.append(open(os.path.join(SITE, "assets/js/motion.js"), encoding="utf-8").read())
    # Сцена объёма и стенд нужны только там, где они есть на странице.
    if "data-massing" in body:
        parts.append(open(os.path.join(SITE, "assets/js/massing.js"), encoding="utf-8").read())
    if "data-stand" in body:
        parts.append(open(os.path.join(SITE, "assets/js/dscr.js"), encoding="utf-8").read())

    # Переходы между страницами в одном файле невозможны: гасим их честно,
    # оставляя якоря внутри страницы рабочими.
    parts.append("""
document.addEventListener('click', function (e) {
  var a = e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  if (href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
  if (a.hostname && a.hostname !== location.hostname) return;
  e.preventDefault();
}, true);
""")
    return "\n;\n".join(parts)


def build(page):
    lang = "ru" if page.startswith("ru/") else ("en" if page.startswith("en/") else "uz")
    html = open(os.path.join(SITE, page), encoding="utf-8").read()

    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    # У предпросмотра своё имя: заголовок страницы написан под выдачу поиска,
    # а на вкладке и в списке файлов нужнее короткое название.
    if page.endswith("index.html"):
        title = "CASE Advisory"
    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)

    # Схемы кейсов и постер уезжают в файл целиком.
    def img(m):
        rel = m.group(1).lstrip("/")
        path = os.path.join(SITE, rel)
        if not os.path.exists(path):
            return m.group(0)
        return 'src="%s"' % data_uri(path, "image/svg+xml")

    body = re.sub(r'src="(/assets/img/[^"]+\.svg)"', img, body)

    banner = ('<p style="margin:0;padding:.6rem 1rem;background:#0D0D0D;color:#FAF9F7;'
              'font:600 12px/1.4 Montserrat,system-ui,sans-serif;letter-spacing:.04em;'
              'text-align:center">%s</p>' % BANNER[lang])

    return """<title>%s</title>
<style>
%s
/* Предпросмотр открывается в чужой странице: свой фон обязателен. */
html,body{background:#FAF9F7}
</style>
<script>document.documentElement.classList.add('js');document.documentElement.lang='%s';</script>
%s
%s
<script>
%s
</script>
""" % (title, inline_css(lang), lang, banner, body, inline_js(body))


if __name__ == "__main__":
    page = sys.argv[1] if len(sys.argv) > 1 else "ru/index.html"
    out = build(page)
    if len(sys.argv) > 2:
        with open(sys.argv[2], "w", encoding="utf-8") as f:
            f.write(out)
        sys.stderr.write("%s: %.0f КБ\n" % (sys.argv[2], len(out.encode()) / 1024))
    else:
        sys.stdout.write(out)
