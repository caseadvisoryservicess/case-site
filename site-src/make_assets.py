#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Генерация статичных изображений сайта.

Что делает: рисует фавиконку, схемы кейсов, постер сцены объёма и картинки
Open Graph 1200x630 для каждой страницы каждого языка.

Схемы кейсов намеренно нарисованы, а не сфотографированы: фотографий
объектов с правом публикации у нас пока нет, а сток мы не ставим.
Как только появятся фотографии, замените файлы в assets/img/cases
на .avif плюс .webp и поправьте build.case_media.

Запуск: python3 site-src/make_assets.py   (нужен Pillow только для OG)
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "case-site")
IMG = os.path.join(OUT, "assets", "img")
sys.path.insert(0, os.path.join(HERE, "content"))

import facts  # noqa: E402

PAPER = "#F2EFEA"
BLACK = "#0D0D0D"
RED = "#A91D20"
GOLD = "#BE8E3A"
LINE = "#D9D4CC"


def put(rel, text):
    p = os.path.join(IMG, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return p


# ----------------------------------------------------------------- фавиконка
def favicon():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<rect width="32" height="32" fill="%s"/>
<rect x="8" y="7" width="17" height="3" fill="%s"/>
<rect x="8" y="7" width="3" height="18" fill="#FAF9F7"/>
<rect x="8" y="22" width="17" height="3" fill="#FAF9F7"/>
</svg>
""" % (BLACK, RED)
    put("favicon.svg", svg)


# ----------------------------------------------------------------- схемы кейсов
def frame(inner, w=1600, h=1200):
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img">
<rect width="%d" height="%d" fill="%s"/>
%s
</svg>
""" % (w, h, w, h, w, h, PAPER, inner)


def grid(step=50, w=1600, h=1200):
    lines = []
    x = step
    while x < w:
        lines.append('<line x1="%d" y1="0" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (x, x, h, LINE))
        x += step
    y = step
    while y < h:
        lines.append('<line x1="0" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1"/>' % (y, w, y, LINE))
        y += step
    return "".join(lines)


def label(x, y, text, size=26, fill=BLACK, weight=700, anchor="start"):
    return ('<text x="%d" y="%d" font-family="Montserrat, sans-serif" font-size="%d" '
            'font-weight="%d" fill="%s" text-anchor="%s" letter-spacing="2">%s</text>'
            % (x, y, size, weight, fill, anchor, text))


def case_82_mall():
    """Многофункциональный объект: стилобат с торговой частью и две башни сверху.

    Подписей внутри нет намеренно: имя, город и GLA стоят рядом в разметке,
    а картинку карточка обрезает по краям."""
    inner = [grid()]
    # стилобат
    inner.append('<rect x="160" y="700" width="1280" height="300" fill="%s" fill-opacity="0.05" stroke="%s" stroke-width="3"/>' % (BLACK, BLACK))
    for i in range(1, 8):
        x = 160 + i * 160
        inner.append('<line x1="%d" y1="700" x2="%d" y2="1000" stroke="%s" stroke-width="1.5"/>' % (x, x, LINE))
    # якоря по концам ленты
    inner.append('<rect x="160" y="700" width="160" height="300" fill="%s" fill-opacity="0.18"/>' % RED)
    inner.append('<rect x="1280" y="700" width="160" height="300" fill="%s" fill-opacity="0.18"/>' % RED)
    # башни
    inner.append('<rect x="420" y="330" width="260" height="370" fill="none" stroke="%s" stroke-width="3"/>' % BLACK)
    inner.append('<rect x="920" y="430" width="260" height="270" fill="none" stroke="%s" stroke-width="3"/>' % BLACK)
    for y in range(370, 700, 60):
        inner.append('<line x1="420" y1="%d" x2="680" y2="%d" stroke="%s" stroke-width="1"/>' % (y, y, LINE))
    for y in range(470, 700, 60):
        inner.append('<line x1="920" y1="%d" x2="1180" y2="%d" stroke="%s" stroke-width="1"/>' % (y, y, LINE))
    # главный поток вдоль галереи
    inner.append('<path d="M160 850 L1440 850" stroke="%s" stroke-width="3" stroke-dasharray="16 12"/>' % RED)
    inner.append('<circle cx="800" cy="850" r="12" fill="%s"/>' % RED)
    return frame("".join(inner))


def case_chilonzor():
    """Объект 1963 года: исходная регулярная сетка и нарезка после реновации."""
    inner = [grid()]
    inner.append('<rect x="200" y="330" width="1200" height="540" fill="none" stroke="%s" stroke-width="3"/>' % BLACK)
    for i in range(1, 8):
        x = 200 + i * 150
        inner.append('<line x1="%d" y1="330" x2="%d" y2="870" stroke="%s" stroke-width="1.5"/>' % (x, x, LINE))
    inner.append('<line x1="200" y1="600" x2="1400" y2="600" stroke="%s" stroke-width="1.5"/>' % LINE)
    # переназначенные блоки: частый спрос слева, якорь справа
    inner.append('<rect x="200" y="330" width="450" height="270" fill="%s" fill-opacity="0.16"/>' % RED)
    inner.append('<rect x="950" y="600" width="450" height="270" fill="%s" fill-opacity="0.20"/>' % GOLD)
    # новая входная группа и ось движения
    inner.append('<rect x="740" y="870" width="120" height="60" fill="%s"/>' % BLACK)
    inner.append('<path d="M800 870 L800 690 L1180 690" stroke="%s" stroke-width="3" stroke-dasharray="16 12" fill="none"/>' % RED)
    return frame("".join(inner))


def case_jabal_omar():
    """Программа под поток паломников: ось движения к мечети и обратно."""
    inner = [grid()]
    inner.append('<circle cx="800" cy="300" r="130" fill="none" stroke="%s" stroke-width="3"/>' % BLACK)
    inner.append('<circle cx="800" cy="300" r="60" fill="%s" fill-opacity="0.06"/>' % BLACK)
    inner.append('<rect x="240" y="620" width="1120" height="320" fill="none" stroke="%s" stroke-width="3"/>' % BLACK)
    for i in range(1, 6):
        x = 240 + i * 187
        inner.append('<line x1="%d" y1="620" x2="%d" y2="940" stroke="%s" stroke-width="1.5"/>' % (x, x, LINE))
    # зона коротких визитов на оси
    inner.append('<rect x="614" y="620" width="374" height="320" fill="%s" fill-opacity="0.18"/>' % RED)
    inner.append('<path d="M800 620 L800 430" stroke="%s" stroke-width="4"/>' % RED)
    inner.append('<path d="M614 780 L988 780" stroke="%s" stroke-width="3" stroke-dasharray="16 12"/>' % RED)
    inner.append('<path d="M240 1010 L1360 1010" stroke="%s" stroke-width="2"/>' % LINE)
    return frame("".join(inner))


KX, KY = 0.866, 0.5


def iso_box(cx, cy, w, d, h):
    """Изометрическая коробка. (cx, cy) это ближний нижний угол основания.

    Ось ширины уходит влево вверх, ось глубины вправо вверх, высота вверх.
    Возвращает три видимые грани и координаты верхнего ближнего угла."""
    C = (cx, cy)
    B = (cx + d * KX, cy - d * KY)
    D = (cx - w * KX, cy - w * KY)
    A = (cx + d * KX - w * KX, cy - d * KY - w * KY)
    up = lambda p: (p[0], p[1] - h)

    def poly(pts, fill, stroke):
        return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.5"/>' % (
            " ".join("%.1f,%.1f" % p for p in pts), fill, stroke)

    right = poly([C, B, up(B), up(C)], "#4E4739", "#6E6553")
    left = poly([C, D, up(D), up(C)], "#2E2A22", "#4A4338")
    top = poly([up(A), up(B), up(C), up(D)], "#8A7C64", "#B29A72")
    return left, right, top, up(C)


def massing_poster():
    """Статичный постер сцены объёма: то, что видит мобильный и режим reduce.

    Изометрия, а не перспектива: объём читается однозначно и на маленькой
    картинке, и на большой."""
    W, H = 1600, 1000
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img">' % (W, H, W, H)]
    out.append('<defs><radialGradient id="lamp" cx="50%%" cy="45%%" r="55%%">'
               '<stop offset="0" stop-color="%s" stop-opacity="0.20"/>'
               '<stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>'
               '<radialGradient id="floor" cx="50%%" cy="50%%" r="50%%">'
               '<stop offset="0" stop-color="%s" stop-opacity="0.16"/>'
               '<stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient></defs>'
               % (GOLD, GOLD, GOLD, GOLD))
    out.append('<rect width="%d" height="%d" fill="#0A0A0A"/>' % (W, H))
    out.append('<rect width="%d" height="%d" fill="url(#lamp)"/>' % (W, H))

    # Земля: сетка участка под объёмом.
    gx, gy, gw, gd = 800, 930, 640, 540
    g = [(gx, gy), (gx + gd * KX, gy - gd * KY),
         (gx + gd * KX - gw * KX, gy - gd * KY - gw * KY), (gx - gw * KX, gy - gw * KY)]
    out.append('<polygon points="%s" fill="#131210" stroke="#2A2620" stroke-width="1.5"/>'
               % " ".join("%.1f,%.1f" % p for p in g))
    for i in range(1, 8):
        t = i / 8.0
        p1 = (gx + gd * KX * t, gy - gd * KY * t)
        p2 = (p1[0] - gw * KX, p1[1] - gw * KY)
        out.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#211E19" stroke-width="1"/>'
                   % (p1[0], p1[1], p2[0], p2[1]))
    out.append('<ellipse cx="800" cy="890" rx="470" ry="110" fill="url(#floor)"/>')

    # Стилобат: торговая часть.
    left, right, top, apex = iso_box(800, 880, 430, 330, 120)
    out += [left, right, top]
    # Башня: доходная часть сверху, вставлена внутрь пятна застройки.
    ow = od = 110
    cx2 = 800 - ow * KX + od * KX
    cy2 = 880 - ow * KY - od * KY - 120
    left2, right2, top2, apex2 = iso_box(cx2, cy2, 250, 200, 280)
    out += [left2, right2, top2]
    out.append('<ellipse cx="%.1f" cy="%.1f" rx="200" ry="100" fill="url(#floor)"/>'
               % (apex2[0], apex2[1] - 100))

    # Подписей в картинке нет: они лежат текстом в разметке, поэтому
    # переводятся, читаются скринридером и попадают в индекс.
    out.append("</svg>")
    return "\n".join(out) + "\n"


# ----------------------------------------------------------------- Open Graph
def og_images():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("Pillow не установлен, картинки Open Graph пропущены. "
              "Установите: pip install Pillow")
        return 0

    fdir = os.path.join(HERE, "build-fonts")
    bebas = os.path.join(fdir, "bebas-neue-400.ttf")
    mont7 = os.path.join(fdir, "montserrat-700.ttf")
    mont4 = os.path.join(fdir, "montserrat-400.ttf")
    for f in (bebas, mont7, mont4):
        if not os.path.exists(f):
            print("Нет шрифта %s, картинки Open Graph пропущены." % f)
            return 0

    sys.path.insert(0, os.path.join(HERE, "content"))
    langs = {c: __import__(c).L for c in facts.LANGS}

    def wrap(draw, text, font, width):
        words, lines, cur = text.split(), [], ""
        for w in words:
            probe = (cur + " " + w).strip()
            if draw.textlength(probe, font=font) <= width:
                cur = probe
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines

    made = 0
    dest = os.path.join(IMG, "og")
    os.makedirs(dest, exist_ok=True)

    targets = []
    for lang in facts.LANGS:
        for page in facts.PAGES:
            targets.append((lang, page, langs[lang]["meta"][page]["title"],
                            langs[lang]["meta"][page]["desc"]))
        for c in facts.CASES:
            cd = langs[lang]["cases"][c["slug"]]
            targets.append((lang, "case-" + c["slug"], cd["name"], cd["why"]))

    f_mark = ImageFont.truetype(bebas, 58)
    f_title = ImageFont.truetype(mont7, 60)
    f_sub = ImageFont.truetype(mont4, 27)
    f_meta = ImageFont.truetype(mont7, 21)

    for lang, page, title, desc in targets:
        im = Image.new("RGB", (1200, 630), "#FAF9F7")
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 1200, 8], fill=RED)
        d.text((72, 66), "CASE", font=f_mark, fill=BLACK)
        d.text((72, 132), "REAL ESTATE ADVISORY", font=f_meta, fill="#4A4A4A")

        lines = wrap(d, title, f_title, 1056)[:3]
        y = 250 - (len(lines) - 1) * 36
        for ln in lines:
            d.text((72, y), ln, font=f_title, fill=BLACK)
            y += 72

        sub = wrap(d, desc, f_sub, 1000)[:3]
        y = max(y + 20, 430)
        for ln in sub:
            d.text((72, y), ln, font=f_sub, fill="#4A4A4A")
            y += 38

        d.rectangle([72, 566, 200, 569], fill=BLACK)
        d.text((72, 582), "caseadvisory.com".upper(), font=f_meta, fill="#4A4A4A")
        d.text((1128, 582), lang.upper(), font=f_meta, fill=RED, anchor="ra")

        im.save(os.path.join(dest, "%s-%s.png" % (lang, page)), optimize=True)
        made += 1
    return made


def main():
    favicon()
    put("cases/82-mall.svg", case_82_mall())
    put("cases/chilonzor.svg", case_chilonzor())
    put("cases/jabal-omar.svg", case_jabal_omar())
    put("massing-poster.svg", massing_poster())
    n = og_images()
    print("Схемы и постер готовы. Картинок Open Graph: %d" % n)


if __name__ == "__main__":
    main()
