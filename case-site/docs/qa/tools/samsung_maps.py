"""Три карты по Samsung BC: зона охвата, спрос по ставкам, предложение БЦ.

Что чем подкреплено:
  зона охвата  - точка проекта из geoanalytics-studio.html (запись владельца,
                 статус Reviewed) и границы районов из tashkent_districts.geojson;
  предложение  - 148 бизнес-центров из 2ГИС с координатами плюс три проекта CASE;
  спрос        - достигнутые ставки: медианы по девяти районам (OLX и uybor) и
                 29 поимённых БЦ со ставкой, источники и дата в самих данных.

Населения на картах нет намеренно. Единственный источник населения в системе -
сетка pop из bundle_tashkent_realdata.json, и она не проходит проверку: центр
масс смещён на 8,6 км южнее центра города, плотность районов перевёрнута
(Янгихаёт 19 176 чел./км² против Чиланзара 1 663), а десять верхних ячеек имеют
почти одинаковое значение ~40 670. Сама система помечает слой как
«Методологический слой; проверить источник/единицу измерения». Показывать такие
числа клиенту нельзя, поэтому они не показаны.

Проекция: локальная равнопромежуточная (x = долгота * cos(широта центра)).
На масштабе города искажение пренебрежимо, а круги остаются кругами.

Запуск: python3 samsung_maps.py
"""
import json
import math
import os

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon as MplPolygon
from matplotlib.lines import Line2D
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OS_DIR = os.path.join(ROOT, 'os')
OUT = HERE

SAMSUNG = (41.34874282632705, 69.28821941229232)
LAT0 = 41.31
KX = math.cos(math.radians(LAT0))
R_EARTH = 6371008.8

RED = '#9E0000'
INK = '#15181D'
MUTED = '#6B7280'
LINE = '#C9CDD3'
PAPER = '#FFFFFF'

plt.rcParams.update({
    'font.family': 'DejaVu Sans',
    'font.size': 9,
    'axes.edgecolor': LINE,
    'figure.facecolor': PAPER,
    'axes.facecolor': PAPER,
})


def px(lng):
    return lng * KX


def metres(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R_EARTH * math.asin(math.sqrt(h))


def deg_for_metres(m):
    """Радиус в градусах широты. Круг рисуется в координатах (px(lng), lat),
    где обе оси уже в одном масштабе, поэтому радиус один на обе."""
    return m / (math.pi / 180 * R_EARTH)


def json_len(s, i):
    depth = 0
    in_str = False
    esc = False
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
    bundle = json.load(open(os.path.join(OS_DIR, 'data', 'bundle_tashkent_realdata.json'), encoding='utf-8'))
    districts = json.load(open(os.path.join(OS_DIR, 'data', 'tashkent_districts.geojson'), encoding='utf-8'))
    html = open(os.path.join(OS_DIR, 'geoanalytics-studio.html'), encoding='utf-8').read()
    i = html.index('const BC=') + len('const BC=')
    bc = json.loads(html[i:i + json_len(html, i)])
    return bundle, districts, bc


def draw_districts(ax, districts, fill=None, label_key=None, lw=0.7):
    """Границы районов. Возвращает словарь имя -> центроид для подписей."""
    centroids = {}
    for f in districts['features']:
        name = f['properties']['name']
        geom = f['geometry']
        polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        best = None
        for poly in polys:
            ring = poly[0]
            pts = [(px(x), y) for x, y in ring]
            col = fill(name) if fill else 'none'
            ax.add_patch(MplPolygon(pts, closed=True, facecolor=col, edgecolor=LINE,
                                    linewidth=lw, zorder=1))
            area = abs(sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                           for i in range(len(pts)))) / 2
            if best is None or area > best[0]:
                cx = sum(p[0] for p in pts) / len(pts)
                cy = sum(p[1] for p in pts) / len(pts)
                best = (area, cx, cy)
        if best:
            centroids[name] = (best[1], best[2])
    return centroids


def near_project(cx, cy, limit_m):
    """Не подписывать район, если подпись попадёт под метку проекта.
    Обе координаты уже в одном масштабе, поэтому расстояние считается прямо."""
    d = math.hypot(cx - px(SAMSUNG[1]), cy - SAMSUNG[0])
    return d < deg_for_metres(limit_m)


def frame(ax, bounds, title, subtitle, source):
    ax.set_xlim(bounds[0], bounds[1])
    ax.set_ylim(bounds[2], bounds[3])
    ax.set_aspect('equal')
    ax.set_xticks([])
    ax.set_yticks([])
    for s in ax.spines.values():
        s.set_color(LINE)
    ax.set_title(title, loc='left', fontsize=14, fontweight='bold', color=INK, pad=30)
    ax.text(0, 1.008, subtitle, transform=ax.transAxes, fontsize=9, color=MUTED, va='bottom')
    ax.text(0, -0.045, source, transform=ax.transAxes, fontsize=7.5, color=MUTED, va='top')


def scalebar(ax, bounds, km=2):
    """Масштабная линейка. Без неё карта без подложки не читается как карта."""
    d = deg_for_metres(km * 1000)
    x0 = bounds[0] + (bounds[1] - bounds[0]) * 0.04
    y0 = bounds[2] + (bounds[3] - bounds[2]) * 0.045
    ax.plot([x0, x0 + d], [y0, y0], color=INK, lw=2.2, solid_capstyle='butt', zorder=9)
    ax.text(x0 + d / 2, y0 + (bounds[3] - bounds[2]) * 0.012, f'{km} км',
            ha='center', fontsize=7.5, color=INK, zorder=9)


# ── карта 1: зона охвата ────────────────────────────────────────────────────
def map_catchment(bundle, districts, bc):
    fig, ax = plt.subplots(figsize=(9.5, 9.5))
    r_out = deg_for_metres(3600)
    b = (px(SAMSUNG[1]) - r_out, px(SAMSUNG[1]) + r_out,
         SAMSUNG[0] - r_out, SAMSUNG[0] + r_out)
    cent = draw_districts(ax, districts, fill=lambda n: '#F6F4F1')

    rings = [(500, '#9E0000'), (1000, '#B23A3A'), (2000, '#C97070'), (3000, '#DFA6A6')]
    for r, col in reversed(rings):
        ax.add_patch(Circle((px(SAMSUNG[1]), SAMSUNG[0]), deg_for_metres(r),
                            facecolor=col, alpha=0.13, edgecolor=col,
                            linewidth=1.4, zorder=2))
    for r, col in rings:
        ax.text(px(SAMSUNG[1]), SAMSUNG[0] + deg_for_metres(r) - deg_for_metres(90),
                f'{r/1000:g} км'.replace('.', ','), ha='center', fontsize=8,
                color=col, fontweight='bold', zorder=6,
                bbox=dict(boxstyle='round,pad=0.18', fc='white', ec='none', alpha=0.85))

    others = [x for x in bc if x.get('provider') != 'CASE (owner)']
    inside = [x for x in others if metres(SAMSUNG, (x['lat'], x['lng'])) <= 3000]
    outside = [x for x in others if 3000 < metres(SAMSUNG, (x['lat'], x['lng'])) <= 4200]
    ax.scatter([px(x['lng']) for x in outside], [x['lat'] for x in outside],
               s=16, c='#B9BEC6', edgecolor='white', linewidth=0.5, zorder=4)
    ax.scatter([px(x['lng']) for x in inside], [x['lat'] for x in inside],
               s=30, c=INK, edgecolor='white', linewidth=0.6, zorder=5)
    ax.scatter([px(SAMSUNG[1])], [SAMSUNG[0]], s=250, marker='*', c=RED,
               edgecolor='white', linewidth=1.2, zorder=8)
    ax.text(px(SAMSUNG[1]) + deg_for_metres(130), SAMSUNG[0] + deg_for_metres(130),
            'Samsung BC', fontsize=11, fontweight='bold', color=RED, zorder=8)

    for name, (cx, cy) in cent.items():
        if b[0] < cx < b[1] and b[2] < cy < b[3] and not near_project(cx, cy, 1800):
            # matplotlib не умеет межбуквенный интервал; разрежаем строку сами
            ax.text(cx, cy, ' '.join(name.upper()), fontsize=7, color='#9AA1AA',
                    ha='center', zorder=3)

    frame(ax, b, 'Зона охвата Samsung BC',
          'Радиусы 500 м, 1, 2 и 3 км. Точками показаны действующие бизнес-центры',
          'Точка проекта: CASE OS, гео-студия (запись владельца, статус Reviewed). '
          'Бизнес-центры: 2ГИС, 148 объектов. Границы районов: Toshkent shahar chegarasi, 2024.')
    scalebar(ax, b, 1)
    ax.legend(handles=[
        Line2D([], [], marker='*', color='none', markerfacecolor=RED, markeredgecolor='white',
               markersize=17, label='Samsung BC (планируется)'),
        Line2D([], [], marker='o', color='none', markerfacecolor=INK, markeredgecolor='white',
               markersize=8, label='Действующий БЦ в пределах 3 км'),
        Line2D([], [], marker='o', color='none', markerfacecolor='#B9BEC6', markeredgecolor='white',
               markersize=7, label='Действующий БЦ дальше 3 км'),
    ], loc='upper right', frameon=True, framealpha=0.94, edgecolor=LINE, fontsize=8.5)
    fig.tight_layout()
    p = os.path.join(OUT, 'samsung_catchment_map.png')
    fig.savefig(p, dpi=170, bbox_inches='tight', facecolor=PAPER)
    plt.close(fig)
    return p


# ── карта 2: спрос через достигнутые ставки ─────────────────────────────────
def map_demand(bundle, districts, bc):
    """Спрос показан ставками, а не населением.

    Ставка - это то, что арендатор согласился платить: прямое свидетельство
    спроса, в отличие от числа жителей вокруг, которое для офиса вообще не
    является спросом (офис снимают компании, а не соседи)."""
    rent_d = bundle['market']['rentByD']
    # Медиана двух площадок; где есть только одна, берём её.
    val = {}
    for d, v in rent_d.items():
        xs = [x for x in (v.get('olx'), v.get('uybor')) if x]
        if xs:
            val[d] = sum(xs) / len(xs)
    # Имена районов в ставках и в геоданных писались разными людьми.
    alias = {'Shaykhantakhur': 'Shayxontohur', 'Mirabad': 'Mirobod', 'Yakkasaray': 'Yakkasaroy',
             'Yashnabad': 'Yashnobod', 'Chilanzar': 'Chilonzor', 'Yunusabad': 'Yunusobod',
             'Uchtepa': 'Uchtepa', 'Olmazor': 'Olmazor', 'Mirzo-Ulugbek': 'Mirzo Ulugbek'}
    geo_val = {alias.get(k, k): v for k, v in val.items()}
    lo, hi = min(geo_val.values()), max(geo_val.values())
    cmap = matplotlib.colormaps['YlOrRd']

    def fill(name):
        v = geo_val.get(name)
        if v is None:
            return '#F2F2F2'
        return cmap(0.18 + 0.72 * (v - lo) / (hi - lo))

    fig, ax = plt.subplots(figsize=(10, 9.5))
    cent = draw_districts(ax, districts, fill=fill, lw=0.9)

    prices = bundle['prices']
    named = []
    for x in bc:
        rec = prices.get(x['name'])
        if rec and rec.get('rent'):
            named.append((x, rec['rent']))
    if named:
        rs = [r for _, r in named]
        ax.scatter([px(x['lng']) for x, _ in named], [x['lat'] for x, _ in named],
                   s=[28 + (r - min(rs)) / (max(rs) - min(rs) + 1e-9) * 190 for _, r in named],
                   facecolor='none', edgecolor=INK, linewidth=1.3, zorder=6)
        # В деловом ядре БЦ стоят вплотную, и двадцать подписей сливались в кашу.
        # Клиенту важно не «сколько стоит вон тот кружок», а какие здания держат
        # верх рынка, поэтому подписываем пять самых дорогих - именами.
        # Пять выносок из одного плотного ядра указывали почти в одну точку и
        # накладывались друг на друга. Разводим их лесенкой вниз-вправо: якорь
        # остаётся на здании, подпись уходит в пустое поле карты.
        # Подписи ставим лесенкой в пустое поле карты на юге (Сергели, Янгихаёт),
        # а не рядом со зданиями: в деловом ядре свободного места нет вовсе.
        # Позиция в долях осей, чтобы выноски не уезжали за край при смене границ.
        top = sorted(named, key=lambda t: -t[1])[:5]
        for k, (x, r) in enumerate(top):
            ax.annotate(f"{x['name']}  {r:g} $",
                        xy=(px(x['lng']), x['lat']),
                        xytext=(0.30, 0.30 - k * 0.058), textcoords='axes fraction',
                        fontsize=8.5, color=INK, fontweight='bold', zorder=10,
                        ha='left', va='center',
                        bbox=dict(boxstyle='round,pad=0.32', fc='white', ec=LINE, lw=0.7, alpha=0.97),
                        arrowprops=dict(arrowstyle='-', color='#6B7280', lw=0.7,
                                        shrinkA=0, shrinkB=4,
                                        connectionstyle='arc3,rad=0.10'))

    ax.scatter([px(SAMSUNG[1])], [SAMSUNG[0]], s=280, marker='*', c=RED,
               edgecolor='white', linewidth=1.3, zorder=9)
    ax.text(px(SAMSUNG[1]) + deg_for_metres(400), SAMSUNG[0] + deg_for_metres(300),
            'Samsung BC', fontsize=10.5, fontweight='bold', color=RED, zorder=9)

    xs = [px(c[0]) if False else c[0] for c in cent.values()]
    ys = [c[1] for c in cent.values()]
    b = (min(xs) - 0.02, max(xs) + 0.02, min(ys) - 0.03, max(ys) + 0.03)
    for name, (cx, cy) in cent.items():
        v = geo_val.get(name)
        if near_project(cx, cy, 2600):
            cy -= deg_for_metres(2200)     # Юнусабад: уводим подпись из-под метки проекта
        ax.text(cx, cy, name.upper() + (f'\n{v:.0f} $' if v else ''), fontsize=7.5,
                color=INK if v else '#B0B5BC', ha='center', va='center', zorder=5,
                linespacing=1.5, fontweight='bold' if v else 'normal')

    frame(ax, b, 'Спрос на офисы: где платят больше',
          'Заливка - медианная ставка аренды по району, $/м² в месяц. Кружки - бизнес-центры '
          'с известной ставкой, размер по величине ставки; подписаны пять самых дорогих',
          'Ставки: OLX.uz и uybor.uz, 07.2026, медианы по району; поимённые ставки - soffice.uz '
          '(управляющая компания 18 БЦ) и объявления. Население не использовано: см. примечание к отчёту.')
    sm = matplotlib.cm.ScalarMappable(cmap=cmap, norm=matplotlib.colors.Normalize(lo, hi))
    cb = fig.colorbar(sm, ax=ax, fraction=0.028, pad=0.035)
    cb.set_label('медианная ставка, $/м² в месяц', fontsize=8.5, color=INK)
    cb.outline.set_edgecolor(LINE)
    scalebar(ax, b, 5)
    fig.tight_layout()
    p = os.path.join(OUT, 'samsung_demand_map.png')
    fig.savefig(p, dpi=170, bbox_inches='tight', facecolor=PAPER)
    plt.close(fig)
    return p


# ── карта 3: предложение, плотность БЦ ──────────────────────────────────────
def map_supply(bundle, districts, bc):
    """Тепловая карта концентрации бизнес-центров.

    Ядро гауссово с радиусом 1,2 км: меньше - карта распадается на отдельные
    точки и перестаёт быть тепловой, больше - размазывает деловое ядро города,
    которое в Ташкенте компактное."""
    others = [x for x in bc if x.get('provider') != 'CASE (owner)']
    pts = [(px(x['lng']), x['lat']) for x in others]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    pad = 0.03
    b = (min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad)

    n = 320
    gx = np.linspace(b[0], b[1], n)
    gy = np.linspace(b[2], b[3], n)
    GX, GY = np.meshgrid(gx, gy)
    sigma = deg_for_metres(1200)
    Z = np.zeros_like(GX)
    for x, y in pts:
        Z += np.exp(-((GX - x) ** 2 + (GY - y) ** 2) / (2 * sigma ** 2))

    fig, ax = plt.subplots(figsize=(10, 9.5))
    cmap = matplotlib.colormaps['YlOrRd']
    ax.imshow(Z, extent=b, origin='lower', cmap=cmap, alpha=0.9, zorder=1,
              interpolation='bilinear', aspect='auto')
    cent = draw_districts(ax, districts, fill=None, lw=1.0)
    ax.scatter(xs, ys, s=9, c=INK, alpha=0.55, zorder=4)
    ax.scatter([px(SAMSUNG[1])], [SAMSUNG[0]], s=280, marker='*', c=RED,
               edgecolor='white', linewidth=1.3, zorder=9)
    ax.text(px(SAMSUNG[1]) + deg_for_metres(400), SAMSUNG[0] + deg_for_metres(300),
            'Samsung BC', fontsize=10.5, fontweight='bold', color=RED, zorder=9)
    for name, (cx, cy) in cent.items():
        if near_project(cx, cy, 2600):
            continue
        ax.text(cx, cy, name.upper(), fontsize=7, color='#4B5158', ha='center',
                va='center', zorder=5)

    frame(ax, b, 'Предложение: где сосредоточены бизнес-центры',
          f'Плотность {len(others)} действующих БЦ. Ядро сглаживания 1,2 км',
          'Бизнес-центры: 2ГИС, 148 объектов с координатами, выгрузка CASE OS. '
          'Границы районов: Toshkent shahar chegarasi, 2024.')
    sm = matplotlib.cm.ScalarMappable(cmap=cmap,
                                      norm=matplotlib.colors.Normalize(float(Z.min()), float(Z.max())))
    cb = fig.colorbar(sm, ax=ax, fraction=0.028, pad=0.035)
    cb.set_label('концентрация БЦ (условные единицы)', fontsize=8.5, color=INK)
    cb.set_ticks([])
    cb.outline.set_edgecolor(LINE)
    scalebar(ax, b, 5)
    fig.tight_layout()
    p = os.path.join(OUT, 'samsung_supply_map.png')
    fig.savefig(p, dpi=170, bbox_inches='tight', facecolor=PAPER)
    plt.close(fig)
    return p


def main():
    bundle, districts, bc = load()
    out = [map_catchment(bundle, districts, bc),
           map_demand(bundle, districts, bc),
           map_supply(bundle, districts, bc)]
    for p in out:
        print('готово:', p)


if __name__ == '__main__':
    main()
