"""Зона охвата Samsung BC: население по радиусам и предложение офисов вокруг.

Откуда что берётся:
  население - сетка 1 км из os/data/bundle_tashkent_realdata.json (ключ pop,
              6865 ячеек [широта, долгота, человек]; расстояние между соседними
              ячейками измерено и равно 1005 м, то есть это регулярный растр);
  БЦ        - 151 точка: 148 из 2ГИС плюс три проекта CASE из geoanalytics-studio.html;
  координаты Samsung BC - из geoanalytics-studio.html, где точку внёс и проверил
              владелец. В портфеле у этого же проекта стоят ДРУГИЕ координаты
              с пометкой inferred_city; они выведены из названия города и для
              расчёта охвата непригодны. Расхождение считается и печатается.

Почему доля площади, а не «центр ячейки внутри круга». Ячейка - квадрат 1 км².
Круг радиусом 1 км имеет площадь 3,14 км², то есть пересекает всего три ячейки,
и решение «попал центр или нет» дало бы ошибку в разы. Поэтому для каждой ячейки
считается, какая доля её площади попала в круг, и берётся та же доля населения.
Это не делает данные точнее, но убирает ошибку самого метода.

Запуск: python3 samsung_catchment.py
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OS_DIR = os.path.join(ROOT, 'os')

# Точка проекта: geoanalytics-studio.html, запись владельца со статусом Reviewed.
SAMSUNG = (41.34874282632705, 69.28821941229232)
SAMSUNG_PORTFOLIO = (41.314564, 69.217462)      # inferred_city, для сравнения
CELL_M = 1005.0                                  # измеренный шаг сетки
RINGS_M = [500, 1000, 2000, 3000, 5000]

R_EARTH = 6371008.8


def haversine(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R_EARTH * math.asin(math.sqrt(h))


def local_metres(origin, point):
    """Плоские координаты в метрах относительно origin. На масштабе города
    искажением проекции можно пренебречь: 5 км против радиуса Земли."""
    dy = (point[0] - origin[0]) * math.pi / 180 * R_EARTH
    dx = (point[1] - origin[1]) * math.pi / 180 * R_EARTH * math.cos(math.radians(origin[0]))
    return dx, dy


def cell_circle_overlap(dx, dy, half, radius, n=12):
    """Доля площади квадратной ячейки, попавшей в круг.

    Считается подсеткой n x n: аналитическое пересечение квадрата с кругом
    выписывается долго и ошибается на углах, а подсетка 12x12 даёт погрешность
    заведомо меньше, чем сама сетка населения в 1 км.
    """
    d = math.hypot(dx, dy)
    if d + half * math.sqrt(2) <= radius:
        return 1.0
    if d - half * math.sqrt(2) >= radius:
        return 0.0
    step = 2 * half / n
    inside = 0
    for i in range(n):
        px = dx - half + step * (i + 0.5)
        for j in range(n):
            py = dy - half + step * (j + 0.5)
            if px * px + py * py <= radius * radius:
                inside += 1
    return inside / (n * n)


def load():
    bundle = json.load(open(os.path.join(OS_DIR, 'data', 'bundle_tashkent_realdata.json'), encoding='utf-8'))
    html = open(os.path.join(OS_DIR, 'geoanalytics-studio.html'), encoding='utf-8').read()
    i = html.index('const BC=') + len('const BC=')
    bc_studio = json.loads(html[i:i + _json_len(html, i)])
    return bundle, bc_studio


def _json_len(s, i):
    """Длина массива JSON, начинающегося в позиции i.

    Поиском по '];' пользоваться нельзя: внутри записей БЦ встречаются вложенные
    массивы, и первое же ']' обрывает разбор на середине данных.
    """
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


def main():
    bundle, bc = load()
    pop = bundle['pop']

    off = haversine(SAMSUNG, SAMSUNG_PORTFOLIO)
    print('ИСХОДНЫЕ ДАННЫЕ')
    print(f'  Samsung BC (гео-студия, запись владельца): {SAMSUNG[0]:.6f}, {SAMSUNG[1]:.6f}')
    print(f'  Samsung BC (портфель, inferred_city):      {SAMSUNG_PORTFOLIO[0]:.6f}, {SAMSUNG_PORTFOLIO[1]:.6f}')
    print(f'  расхождение между ними: {off/1000:.1f} км - это разные зоны охвата, не уточнение')
    print(f'  сетка населения: {len(pop)} ячеек, шаг {CELL_M:.0f} м, сумма {sum(p[2] for p in pop):,} чел.'.replace(',', ' '))
    print(f'  БЦ на карте: {len(bc)}')

    half = CELL_M / 2
    # Берём только ячейки, способные пересечь самый большой круг.
    near = []
    for la, ln, n in pop:
        dx, dy = local_metres(SAMSUNG, (la, ln))
        if abs(dx) < RINGS_M[-1] + CELL_M and abs(dy) < RINGS_M[-1] + CELL_M:
            near.append((dx, dy, n))

    print('\nНАСЕЛЕНИЕ В ЗОНЕ ОХВАТА')
    print(f'  {"радиус":>8} {"площадь":>10} {"население":>12} {"плотность":>12} {"ячеек":>7} {"БЦ":>4}')
    print(f'  {"":>8} {"км²":>10} {"чел.":>12} {"чел./км²":>12} {"задето":>7} {"":>4}')
    rows = []
    for r in RINGS_M:
        total = 0.0
        touched = 0
        for dx, dy, n in near:
            f = cell_circle_overlap(dx, dy, half, r)
            if f > 0:
                total += n * f
                touched += 1
        area = math.pi * (r / 1000) ** 2
        n_bc = sum(1 for b in bc if haversine(SAMSUNG, (b['lat'], b['lng'])) <= r
                   and b.get('provider') != 'CASE (owner)')
        rows.append({'radius_m': r, 'area_km2': round(area, 2), 'population': int(round(total)),
                     'density': int(round(total / area)), 'cells_touched': touched, 'bc': n_bc})
        print(f'  {r/1000:>7.1f}к {area:>10.2f} {int(round(total)):>12,} {int(round(total/area)):>12,} '
              f'{touched:>7} {n_bc:>4}'.replace(',', ' '))

    print('\n  Кольца (не накопительно):')
    prev_pop = prev_area = 0
    for row in rows:
        dp = row['population'] - prev_pop
        da = row['area_km2'] - prev_area
        print(f'    {prev_area and int(math.sqrt(prev_area/math.pi)*1000) or 0}-{row["radius_m"]} м: '
              f'{dp:,} чел., {int(dp/da):,} чел./км²'.replace(',', ' '))
        prev_pop, prev_area = row['population'], row['area_km2']

    # Насколько результат устойчив к сдвигу точки: сетка в 1 км, и если сдвиг
    # центра на полкилометра меняет ответ в разы, число доверия не заслуживает.
    print('\nПРОВЕРКА УСТОЙЧИВОСТИ (сдвиг центра на 500 м в четыре стороны)')
    for r in (500, 1000, 2000, 3000):
        vals = []
        for ddx, ddy in ((500, 0), (-500, 0), (0, 500), (0, -500)):
            t = 0.0
            for dx, dy, n in near:
                t += n * cell_circle_overlap(dx - ddx, dy - ddy, half, r)
            vals.append(t)
        base = next(x['population'] for x in rows if x['radius_m'] == r)
        lo, hi = min(vals), max(vals)
        spread = (hi - lo) / base * 100 if base else 0
        print(f'  {r} м: {int(lo):,} .. {int(hi):,} при базовом {base:,} - разброс {spread:.0f}%'.replace(',', ' '))

    out = os.path.join(HERE, 'samsung_catchment.json')
    json.dump({'center': {'lat': SAMSUNG[0], 'lng': SAMSUNG[1], 'source': 'geoanalytics-studio.html, owner record'},
               'portfolio_center': {'lat': SAMSUNG_PORTFOLIO[0], 'lng': SAMSUNG_PORTFOLIO[1],
                                    'source': 'case_portfolio_projects_v4.9.3.json, inferred_city',
                                    'offset_km': round(off / 1000, 2)},
               'grid': {'cell_m': CELL_M, 'cells': len(pop), 'total_population': sum(p[2] for p in pop)},
               'rings': rows},
              open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\nЧисла сохранены: {out}')


if __name__ == '__main__':
    main()
