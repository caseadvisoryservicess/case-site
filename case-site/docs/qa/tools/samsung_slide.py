"""Слайд «Зона охвата Samsung BC» в раскладке клиентского образца.

Образец (проект Gulistan, Бухара) собран из четырёх слоёв: подложка с улицами,
зоны доступности по времени, кольца расстояний и панель выводов справа.
Здесь воспроизведены три из четырёх. Чего нет и почему:

  подложка с улицами - внешние тайлы (OSM, 2ГИС, Яндекс) из рабочей среды
      недоступны, офлайн-тайлов в репозитории нет, дорожной геометрии тоже:
      все 3292 объекта в master.geojson точечные. Вместо улиц город показан
      россыпью настоящих POI: 2557 медицинских объектов и аптек, 42 заведения
      F&B, 148 БЦ. Точки стоят вдоль улиц, поэтому городская ткань читается,
      а каждая из них - проверяемый объект, а не декорация;

  зоны 5/10/15 минут - для них нужен маршрутный движок и дорожная сеть.
      Ни того, ни другого нет. Круг, подписанный «15 минут», - это тот же круг,
      только с обманчивой подписью, поэтому на карте только честные кольца.

Население в панель не вынесено: единственная сетка в системе смещена на 8,6 км
и помечена самой системой как непроверенная (см. samsung_catchment.py).

Запуск: python3 samsung_slide.py
"""
import json
import math
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon as MplPolygon, FancyBboxPatch
from matplotlib.lines import Line2D

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OS_DIR = os.path.join(ROOT, 'os')

SAMSUNG = (41.34874282632705, 69.28821941229232)
LAT0 = 41.33
KX = math.cos(math.radians(LAT0))
R_EARTH = 6371008.8

RED = '#9E0000'
INK = '#1A1D21'
MUTED = '#6B7280'
RULE = '#C9CDD3'
PAPER = '#FFFFFF'
LAND = '#F5F3F0'

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9})


def px(lng):
    return lng * KX


def metres(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R_EARTH * math.asin(math.sqrt(h))


def dm(m):
    return m / (math.pi / 180 * R_EARTH)


def json_len(s, i):
    depth, in_str, esc = 0, False, False
    for k in range(i, len(s)):
        c = s[k]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c in '[{':
            depth += 1
        elif c in ']}':
            depth -= 1
            if depth == 0:
                return k - i + 1
    raise ValueError('массив не закрыт')


def load():
    districts = json.load(open(os.path.join(OS_DIR, 'data', 'tashkent_districts.geojson'), encoding='utf-8'))
    master = json.load(open(os.path.join(OS_DIR, 'data', 'geo_master', 'master.geojson'), encoding='utf-8'))
    mah = json.load(open(os.path.join(OS_DIR, 'data', 'mahallas_tashkent.json'), encoding='utf-8'))
    html = open(os.path.join(OS_DIR, 'geoanalytics-studio.html'), encoding='utf-8').read()
    i = html.index('const BC=') + len('const BC=')
    bc = json.loads(html[i:i + json_len(html, i)])
    return districts, master, mah, bc


def pin(ax, lat, lng, label, dx=0, dy=380, ha='center'):
    """Метка места в стиле образца: красная булавка и подпись в белой плашке."""
    ax.scatter([px(lng)], [lat], s=105, marker='v', c=RED, edgecolor='white',
               linewidth=0.9, zorder=11)
    ax.text(px(lng) + dm(dx), lat + dm(dy), label, ha=ha, va='bottom',
            fontsize=8.5, fontweight='bold', color=INK, zorder=12,
            bbox=dict(boxstyle='round,pad=0.34', fc='white', ec=RULE, lw=0.8, alpha=0.97))


def build():
    districts, master, mah, bc = load()

    fig = plt.figure(figsize=(16, 9), facecolor=PAPER)
    ax = fig.add_axes([0.012, 0.03, 0.655, 0.94])
    tx = fig.add_axes([0.685, 0.03, 0.305, 0.94])
    tx.axis('off')

    span = dm(5600)
    b = (px(SAMSUNG[1]) - span, px(SAMSUNG[1]) + span, SAMSUNG[0] - span, SAMSUNG[0] + span)

    # ── земля и границы районов ───────────────────────────────────────────
    for f in districts['features']:
        geom = f['geometry']
        polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        for poly in polys:
            ax.add_patch(MplPolygon([(px(x), y) for x, y in poly[0]], closed=True,
                                    facecolor=LAND, edgecolor='#BFC6CD', lw=1.0, zorder=1))

    # ── городская ткань: настоящие POI вместо улиц ────────────────────────
    fab = [f for f in master['features']
           if f['properties'].get('main_category') != 'Административное деление и государство']
    ax.scatter([px(f['geometry']['coordinates'][0]) for f in fab],
               [f['geometry']['coordinates'][1] for f in fab],
               s=3.2, c='#8B949D', alpha=0.62, zorder=2, linewidths=0)

    # ── названия местности: 545 махаллей вместо улиц ──────────────────────
    # В образце карта читается за счёт множества мелких подписей. Улиц у нас нет,
    # но есть настоящие названия махаллей - для ташкентца они и есть ориентиры.
    # Подписи прорежаем: ставим очередную, только если она не ближе 900 м к уже
    # поставленной, иначе в центре получается нечитаемый ком.
    PINNED = ('OTCHOPAR', 'BODOMZOR', 'SHAKHRISTON')
    placed = []
    inview = sorted(((metres(SAMSUNG, (x['lat'], x['lng'])), x) for x in mah if x.get('lat')),
                    key=lambda t: t[0])
    for dist, x in inview:
        if dist > 5200:
            break
        if x['name'].upper().startswith(PINNED):
            continue
        if any(metres((x['lat'], x['lng']), q) < 900 for q in placed):
            continue
        placed.append((x['lat'], x['lng']))
        ax.scatter([px(x['lng'])], [x['lat']], s=7, c='#6E7781', zorder=3, linewidths=0)
        ax.text(px(x['lng']), x['lat'] - dm(150), x['name'].title(), ha='center', va='top',
                fontsize=6.4, color='#767E87', zorder=3)

    # ── кольца ────────────────────────────────────────────────────────────
    for r in (1000, 3000, 5000):
        ax.add_patch(Circle((px(SAMSUNG[1]), SAMSUNG[0]), dm(r), facecolor='none',
                            edgecolor=INK, lw=1.15, ls=(0, (5, 4)), zorder=6))
        ax.text(px(SAMSUNG[1]), SAMSUNG[0] + dm(r), f'{r//1000} км', ha='center', va='center',
                fontsize=8, color=INK, fontweight='bold', zorder=7,
                bbox=dict(boxstyle='round,pad=0.2', fc='white', ec='none', alpha=0.92))

    # ── конкурентное окружение ────────────────────────────────────────────
    others = [x for x in bc if x.get('provider') != 'CASE (owner)']
    for lim, col, size in ((3000, '#1F4E79', 34), (5000, '#7A93AC', 22)):
        sel = [x for x in others if metres(SAMSUNG, (x['lat'], x['lng'])) <= lim
               and (lim == 3000 or metres(SAMSUNG, (x['lat'], x['lng'])) > 3000)]
        ax.scatter([px(x['lng']) for x in sel], [x['lat'] for x in sel], s=size, c=col,
                   edgecolor='white', linewidth=0.6, zorder=8)
    far = [x for x in others if metres(SAMSUNG, (x['lat'], x['lng'])) > 5000]
    ax.scatter([px(x['lng']) for x in far], [x['lat'] for x in far], s=13, c='#C2C8CE',
               edgecolor='white', linewidth=0.4, zorder=7)

    # ── объект ────────────────────────────────────────────────────────────
    ax.scatter([px(SAMSUNG[1])], [SAMSUNG[0]], s=520, marker='*', c=RED,
               edgecolor='white', linewidth=1.6, zorder=13)
    ax.text(px(SAMSUNG[1]), SAMSUNG[0] - dm(760), 'SAMSUNG BC', ha='center', va='top',
            fontsize=11.5, fontweight='bold', color=RED, zorder=13,
            bbox=dict(boxstyle='round,pad=0.36', fc='white', ec=RED, lw=1.1, alpha=0.97))

    # ── места на карте: настоящие названия местности и ближайшие БЦ ───────
    mnear = sorted(((metres(SAMSUNG, (x['lat'], x['lng'])), x) for x in mah if x.get('lat')),
                   key=lambda t: t[0])
    for label, dxm, dym, ha in (('OTCHOPAR', -900, 260, 'right'), ('BODOMZOR', 950, -60, 'left'),
                                ('SHAKHRISTON', -1000, -700, 'right')):
        # Имена в реестре бывают с номером квартала (OTCHOPAR-1), поэтому
        # сверяем по началу строки, а не по точному совпадению.
        rec = next(x for _, x in mnear if x['name'].upper().startswith(label))
        pin(ax, rec['lat'], rec['lng'], label.title(), dx=dxm, dy=dym, ha=ha)

    bnear = sorted(((metres(SAMSUNG, (x['lat'], x['lng'])), x) for x in others), key=lambda t: t[0])
    # Обе ближайшие точки лежат к юго-западу от объекта, поэтому подписи разводим
    # в разные стороны: иначе вторая уезжает под плашку SAMSUNG BC.
    for (dist, rec), (ddx, ddy, hh) in zip(bnear[:2], ((-1150, 60, 'right'), (1150, -420, 'left'))):
        pin(ax, rec['lat'], rec['lng'], f"{rec['name']} · {dist/1000:.1f} км".replace('.', ','),
            dx=ddx, dy=ddy, ha=hh)

    ax.set_xlim(b[0], b[1])
    ax.set_ylim(b[2], b[3])
    ax.set_aspect('equal')
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_color(RULE)

    # ── масштабная линейка ────────────────────────────────────────────────
    d1 = dm(1000)
    x0 = b[0] + (b[1] - b[0]) * 0.035
    y0 = b[2] + (b[3] - b[2]) * 0.04
    ax.plot([x0, x0 + d1], [y0, y0], color=INK, lw=2.6, solid_capstyle='butt', zorder=14)
    ax.text(x0 + d1 / 2, y0 + dm(180), '1 км', ha='center', fontsize=8, color=INK, zorder=14)

    # ── легенда в стиле образца ───────────────────────────────────────────
    leg = ax.legend(handles=[
        Line2D([], [], marker='*', color='none', markerfacecolor=RED, markeredgecolor='white',
               markersize=19, label='Объект - Samsung BC'),
        Line2D([], [], marker='v', color='none', markerfacecolor=RED, markeredgecolor='white',
               markersize=10, label='Места и ближайшие БЦ (с подписями)'),
        Line2D([], [], marker='o', color='none', markerfacecolor='#1F4E79', markeredgecolor='white',
               markersize=8, label='Действующий БЦ в пределах 3 км - 23'),
        Line2D([], [], marker='o', color='none', markerfacecolor='#7A93AC', markeredgecolor='white',
               markersize=7, label='Действующий БЦ 3-5 км - 36'),
        Line2D([], [], marker='o', color='none', markerfacecolor='#C2C8CE', markeredgecolor='white',
               markersize=6, label='Действующий БЦ дальше 5 км - 89'),
        Line2D([], [], color=INK, lw=1.2, ls=(0, (5, 4)), label='Кольца 1 / 3 / 5 км'),
        Line2D([], [], marker='.', color='none', markerfacecolor='#9AA3AC',
               markeredgecolor='#9AA3AC', markersize=7,
               label='Городская ткань: 2 747 объектов города'),
    ], loc='upper right', frameon=True, framealpha=0.97, edgecolor=RULE,
        fontsize=8.6, title='Условные обозначения', borderpad=0.85, labelspacing=0.72)
    leg.get_title().set_color(RED)
    leg.get_title().set_fontweight('bold')
    leg.get_title().set_fontsize(10.5)
    leg.set_zorder(20)

    # ── панель выводов ────────────────────────────────────────────────────
    # Раскладка панели считается сверху вниз с явным запасом под сноску:
    # в прошлой версии последний пункт наезжал на источники.
    tx.set_xlim(0, 1)
    tx.set_ylim(0, 1)
    FOOT = 0.10          # нижняя полоса под источники, туда текст не заходит

    def block(y, lines, size, color, bullet=True, lead=0.0345):
        """Возвращает новую позицию y после отрисовки абзаца."""
        n = lines.count('\n') + 1
        if bullet:
            tx.text(0.010, y, '\u2022', fontsize=13, color=RED, va='top', fontweight='bold')
        tx.text(0.058 if bullet else 0.010, y, lines, fontsize=size, color=color,
                va='top', linespacing=1.55)
        return y - (n * lead + 0.021)

    tx.text(0.010, 0.995, ' '.join('ЗОНА ОХВАТА'), fontsize=9.5, color=RED, va='top',
            fontweight='bold')
    tx.text(0.010, 0.958, 'Samsung BC', fontsize=23, color=INK, va='top', fontweight='bold')
    tx.text(0.010, 0.902, 'Юнусабадский район, Ташкент\n41,348743   69,288219',
            fontsize=9.5, color=MUTED, va='top', linespacing=1.6)

    y = 0.838
    for txt in ['Кольца 1 / 3 / 5 км от площадки.',
                'В 1 км нет ни одного действующего БЦ.\nБлижайший - IBC, 1,46 км.',
                'В 3 км - 23 БЦ, в 5 км - 59 из 148 по городу.',
                'До ядра офисного рынка (Яккасарай,\nМирабад) 4,9 км на юго-запад.',
                'Ставка района 14,5 $/м²; класс A в городе\nидёт по 31 $. Цену задаст класс, а не адрес.',
                'Вакансия класса A по городу 23,3 %.']:
        y = block(y, txt, 11.5, INK)

    y -= 0.012
    tx.plot([0.010, 0.985], [y, y], color=RULE, lw=1, clip_on=False)
    y -= 0.038
    tx.text(0.010, y, 'ЧЕГО НА КАРТЕ НЕТ И ПОЧЕМУ', fontsize=9.5, color=RED,
            va='top', fontweight='bold')
    y -= 0.042
    for txt in ['Зоны 5 / 10 / 15 минут: нужен маршрутный движок\nи дорожная сеть. Круг с подписью «15 минут»\nвводит в заблуждение.',
                'Население: единственная сетка в системе смещена\nна 8,6 км и помечена ею же как непроверенная.\nНужны данные по махаллям.']:
        y = block(y, txt, 9.8, MUTED, lead=0.030)

    tx.text(0.010, FOOT * 0.30,
            'Источники: точка проекта - CASE OS, гео-студия (запись владельца).\n'
            'БЦ - 2ГИС, 148 объектов. Названия местности и городская ткань -\n'
            'CASE OS geo_master, 545 махаллей и 2 747 объектов. Ставки - OLX.uz,\n'
            'uybor.uz, soffice.uz, 07.2026. Границы районов - 2024.',
            fontsize=7.4, color=MUTED, va='bottom', linespacing=1.75)

    out = os.path.join(HERE, 'samsung_catchment_slide.png')
    fig.savefig(out, dpi=150, facecolor=PAPER)
    plt.close(fig)
    print('готово:', out)
    return out


if __name__ == '__main__':
    build()
