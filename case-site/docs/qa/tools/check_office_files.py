#!/usr/bin/env python3
"""Проверка выгруженных .xlsx и .pptx настоящими библиотеками.

Файлы CASE OS собирает сам, без сторонних библиотек в браузере, поэтому мало
убедиться, что файл скачался: он должен ОТКРЫВАТЬСЯ. openpyxl и python-pptx
разбирают тот же формат, что Excel и PowerPoint, — если структура битая,
здесь это видно сразу.

    pip install openpyxl python-pptx
    python3 check_office_files.py docs/qa/tools/exporttest
"""
import sys, os, glob, zipfile
from xml.etree import ElementTree

failed = 0


def ck(name, cond, detail=None):
    global failed
    print(('OK  ' if cond else '!!  ') + name + ('' if detail is None else ' — ' + str(detail)))
    if not cond:
        failed += 1


def check_zip_xml(path):
    """Каждая часть пакета должна быть валидным XML — иначе Office молча откажет."""
    bad = []
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            if n.endswith('.xml') or n.endswith('.rels'):
                try:
                    ElementTree.fromstring(z.read(n))
                except Exception as e:
                    bad.append(n + ': ' + str(e)[:60])
    return bad


def check_xlsx(path):
    import openpyxl
    ck('Excel: файл открывается openpyxl', True) if False else None
    bad = check_zip_xml(path)
    ck('Excel: все части пакета — валидный XML', not bad, '; '.join(bad) or 'ок')
    wb = openpyxl.load_workbook(path)
    ck('Excel: файл открывается', True, os.path.basename(path))
    names = wb.sheetnames
    # Тест перед выгрузкой снимает галочки «Метро» и «Рынок города» и задаёт свои
    # радиусы — файл обязан это учесть, иначе настройка проекта ни на что не влияет.
    want = ['Сводка', 'Население', 'Население по районам', 'Районы города', 'Радиусы',
            'Бизнес-центры', 'Конкуренты', 'Медицина', 'Городские объекты',
            'Образование по типам', 'F&B по типам']
    ck('Excel: состав листов соответствует настройке проекта', names == want, names)
    ck('Excel: отключённые разделы не попали в файл',
       'Метро' not in names and 'Рынок города' not in names, names)

    sv = wb['Сводка']
    vals = [str(c.value) for row in sv.iter_rows() for c in row if c.value is not None]
    ck('Excel: в сводке есть название проекта', any('Samsung' in v for v in vals), vals[:6])
    ck('Excel: в сводке есть координаты', any('41.3' in v for v in vals))
    ck('Excel: в сводке есть скоринг', any('Потенциал' in v for v in vals),
       [v for v in vals if 'Потенциал' in v][:4])
    ck('Excel: формула скоринга описана', any('0,55' in v for v in vals))

    rd = wb['Радиусы']
    head = [c.value for c in next(rd.iter_rows(min_row=1, max_row=1))]
    ck('Excel: шапка радиусов полная',
       head[:4] == ['Радиус, м', 'Население', 'Бизнес-центры', 'Медицина'] and 'F&B' in head and 'Образование' in head,
       head)
    body = list(rd.iter_rows(min_row=2, values_only=True))
    ck('Excel: строки по радиусам посчитаны', len(body) >= 3, len(body))
    nums = [r[0] for r in body]
    ck('Excel: радиусы — числа, а не текст', all(isinstance(x, (int, float)) for x in nums), nums)
    ck('Excel: радиусы взяты из настройки проекта', nums == [400, 800, 1600], nums)
    fnb_col = head.index('F&B')
    ck('Excel: F&B посчитан', any(isinstance(r[fnb_col], (int, float)) for r in body),
       [r[fnb_col] for r in body])

    # --- население: плотность и прирост по кольцам
    pop = wb['Население']
    ph = [c.value for c in next(pop.iter_rows(min_row=1, max_row=1))]
    ck('Excel: в населении есть плотность и прирост',
       'Плотность, чел/км²' in ph and 'Прирост в кольце' in ph and 'Доля населения района, %' in ph, ph)
    pbody = [r for r in pop.iter_rows(min_row=2, values_only=True) if isinstance(r[0], (int, float))]
    ck('Excel: строки населения посчитаны', len(pbody) >= 3, len(pbody))
    dens = [r[ph.index('Плотность, чел/км²')] for r in pbody]
    ck('Excel: плотность — числа', all(isinstance(x, (int, float)) for x in dens), dens)
    area = [r[ph.index('Площадь круга, км²')] for r in pbody]
    ck('Excel: площадь круга растёт с радиусом', area == sorted(area) and area[0] > 0, area)

    # --- разрез по районам: радиус детализации тоже из настройки (800 м)
    bd = wb['Население по районам']
    bh = [c.value for c in next(bd.iter_rows(min_row=1, max_row=1))]
    ck('Excel: разрез населения по районам с радиусом из настройки',
       bh == ['Район', 'Жителей в 800 м', 'Жителей в 3 км'], bh)

    # --- эталоны проекта попали в методику
    ck('Excel: в сводке указаны эталоны проекта',
       any('Эталоны насыщения' in v for v in vals) and any('F&B 3' in v for v in vals),
       [v for v in vals if 'талон' in v][:3])

    # --- образование и F&B по человеческим типам
    ed = wb['Образование по типам']
    erows = [r for r in ed.iter_rows(min_row=2, values_only=True) if r[0]]
    ck('Excel: образование разложено по типам', len(erows) >= 2, erows[:4])
    labels = [str(r[0]) for r in erows]
    ck('Excel: типы образования человеческие, а не теги OSM',
       'Школа' in labels and 'Курсы / учебный центр' in labels
       and not any(x in labels for x in ('school', 'training', 'university')), labels)
    fb = wb['F&B по типам']
    frows = [str(r[0]) for r in fb.iter_rows(min_row=2, values_only=True) if r[0]]
    ck('Excel: чайхана выделена из ресторанов', 'Чайхана / национальная' in frows, frows)

    # --- все районы города
    ad = wb['Районы города']
    arows = list(ad.iter_rows(min_row=2, values_only=True))
    ck('Excel: справочник районов города заполнен', len(arows) >= 10, f'районов: {len(arows)}')
    ck('Excel: у районов есть население и плотность',
       all(isinstance(r[1], (int, float)) and isinstance(r[3], (int, float)) for r in arows[:5]),
       arows[:2])
    ck('Excel: район проекта отмечен', any((r[4] or '') == 'да' for r in arows),
       [r[0] for r in arows if (r[4] or '') == 'да'])

    # --- бизнес-центры
    bc = wb['Бизнес-центры']
    bch = [c.value for c in next(bc.iter_rows(min_row=1, max_row=1))]
    ck('Excel: у конкурентов есть цена, класс и адрес',
       'Ставка, $/м²/мес' in bch and 'Класс' in bch and 'Адрес' in bch, bch)
    bcrows = [r for r in bc.iter_rows(min_row=2, values_only=True) if r[0]]
    ck('Excel: список конкурентов не пуст', len(bcrows) >= 1, f'строк: {len(bcrows)}')

    # --- конкуренты: та самая таблица из презентаций по рынку
    cp = wb['Конкуренты']
    ch = [c.value for c in next(cp.iter_rows(min_row=1, max_row=1))]
    need = ['№', 'Объект', 'Тип', 'Откр.', 'Участок, м²', 'GBA, м²', 'GLA, м²', 'Эт.',
            'Точки', 'F&B', 'Парк.', 'Ставка, $/м²/мес', 'Расст. по прямой, км']
    ck('Excel: карточка конкурента со всеми колонками', ch[:len(need)] == need, ch)
    crows = [r for r in cp.iter_rows(min_row=2, values_only=True) if isinstance(r[0], int)]
    ck('Excel: конкуренты перечислены', len(crows) >= 3, f'строк: {len(crows)}')
    dist = [r[12] for r in crows]
    ck('Excel: конкуренты отсортированы по расстоянию', dist == sorted(dist), dist[:6])
    ck('Excel: ставка записана диапазоном или суммой',
       any(isinstance(r[11], str) and r[11].startswith('$') for r in crows),
       [r[11] for r in crows[:6]])

    # --- метро



def check_pptx(path):
    from pptx import Presentation
    from pptx.util import Emu
    bad = check_zip_xml(path)
    ck('PowerPoint: все части пакета — валидный XML', not bad, '; '.join(bad) or 'ок')
    pr = Presentation(path)
    ck('PowerPoint: файл открывается', True, os.path.basename(path))
    ck('PowerPoint: формат 16:9', abs(pr.slide_width / pr.slide_height - 16 / 9) < 0.01,
       f'{pr.slide_width}×{pr.slide_height}')
    n = len(pr.slides.__iter__.__self__._sldIdLst)
    ck('PowerPoint: слайдов не меньше восьми', n >= 8, n)

    texts, tables = [], 0
    for sl in pr.slides:
        for sh in sl.shapes:
            if sh.has_text_frame:
                texts.append(sh.text_frame.text)
            if getattr(sh, 'has_table', False) and sh.has_table:
                tables += 1
    all_text = '\n'.join(texts)
    ck('PowerPoint: титул с названием проекта', 'Samsung' in all_text, texts[:3])
    ck('PowerPoint: есть слайд по радиусам', 'радиус' in all_text.lower(), None)
    ck('PowerPoint: есть слайд конкурентной среды', 'Конкурентная среда' in all_text)
    ck('PowerPoint: есть слайд скоринга', 'скоринг' in all_text.lower())
    ck('PowerPoint: таблицы построены', tables >= 3, f'таблиц: {tables}')
    ck('PowerPoint: указан источник данных', 'OpenStreetMap' in all_text)
    ck('PowerPoint: формула скоринга приведена', '0,55' in all_text)
    ck('PowerPoint: есть слайд населения', 'Население вокруг точки' in all_text)
    ck('PowerPoint: есть разрез по районам города', 'районы города' in all_text.lower(), None)
    ck('PowerPoint: есть слайд источников и методики', 'Источники и методика' in all_text)
    ck('PowerPoint: указана плотность населения', 'плотность' in all_text.lower())

    with zipfile.ZipFile(path) as z:
        media = [n for n in z.namelist() if n.startswith('ppt/media/')]
        if media:
            png = z.read(media[0])
            ck('PowerPoint: снимок карты — настоящий PNG', png[:8] == b'\x89PNG\r\n\x1a\n', media[0])
            w = int.from_bytes(png[16:20], 'big')
            h = int.from_bytes(png[20:24], 'big')
            ck('PowerPoint: снимок карты нормального размера', w > 300 and h > 200, f'{w}×{h}')

        else:
            print('..  снимка карты нет — подложка не отдала тайлы с CORS, презентация собрана без картинки')

    # --- слайд «Заявленные ставки»: столбцы min–max, наш проект чёрным
    chart = None
    for sl in pr.slides:
        t = ' '.join(sh.text_frame.text for sh in sl.shapes if sh.has_text_frame)
        if 'Заявленные ставки' in t:
            chart = sl
    ck('PowerPoint: есть слайд «Заявленные ставки»', chart is not None)
    if chart is not None:
        bars, W = [], pr.slide_width
        for sh in chart.shapes:
            fill = getattr(sh, 'fill', None)
            try:
                rgb = str(fill.fore_color.rgb)
            except Exception:
                continue
            # столбцы графика: шире линии сетки и ниже шапки слайда
            if sh.width > 50000 and sh.top > 1000000 and rgb in ('9E0000', '111111'):
                bars.append((sh.left, sh.width, rgb, sh.top))
        ck('PowerPoint: столбцы ставок нарисованы', len(bars) >= 2, f'столбцов: {len(bars)}')
        ck('PowerPoint: столбцы не вылезают за слайд',
           all(b[0] + b[1] <= W for b in bars),
           [(b[0], b[1]) for b in bars[:3]])
        ck('PowerPoint: столбцы идут сверху вниз без наложения',
           [b[3] for b in bars] == sorted(b[3] for b in bars),
           [b[3] for b in bars[:4]])
        ck('PowerPoint: у графика есть шкала в долларах',
           sum(1 for sh in chart.shapes if sh.has_text_frame and sh.text_frame.text.startswith('$')) >= 3)



def main():
    d = sys.argv[1] if len(sys.argv) > 1 else 'exporttest'
    xs = glob.glob(os.path.join(d, '*.xlsx'))
    ps = glob.glob(os.path.join(d, '*.pptx'))
    ck('файл Excel найден', bool(xs), d)
    ck('файл PowerPoint найден', bool(ps), d)
    if xs:
        check_xlsx(xs[0])
    if ps:
        check_pptx(ps[0])
    print('\nПРОВАЛЕНО проверок: %d' % failed if failed else '\nВсе проверки пройдены')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
