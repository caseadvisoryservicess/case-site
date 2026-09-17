# 03. Калькулятор цены - эталонная спецификация (порт 1:1)

**Источник:** `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Narx Kalkulyatori.dc.html` (214 строк).
Разметка - строки 9-146 (`<x-dc>` + шаблон `{{ … }}`), логика - строки 147-212 (`<script type="text/x-dc">`, класс `Component extends DCLogic`).

**Проверка символов (выполнена по файлу).** Небайтовые символы во всём файле только эти:
`‘` U+2018 (14 шт.), `·` U+00B7 (8), `²` U+00B2 (8), `-` U+2014 (7), `-` U+2013 (4), `×` U+00D7 (1).
Следствие: **U+2019 в файле нет** - узбекские апострофы это `o‘`, `g‘`, `qo‘`, `yo‘` с U+2018.
**Тонкого/неразрывного пробела в файле НЕТ** - все пробелы обычные ASCII U+0020, включая разделитель
тысяч в `usd()` и в строке `'Minimal summa $5 000 …'`.

---

## 1. Константы (строки 148-154)

```js
const TARIFFS = {
  t1: { name: 'Expert Review', rate: 2.0 },
  t2: { name: 'Concept Support', rate: 2.2, unconfirmed: true },
  t3: { name: 'Commercial Concept', rate: 2.5 },
  t4: { name: 'Full Strategy', rate: 4.5 }
};
const MIN_FEE = 5000, HOURLY = 80, MIN_MONTHS = 3;
```

| код | `name` | `rate` (USD/m²) | `unconfirmed` |
|-----|--------|-----------------|---------------|
| `t1` | `Expert Review` | 2.0 | не задан (undefined) |
| `t2` | `Concept Support` | 2.2 | `true` |
| `t3` | `Commercial Concept` | 2.5 | не задан |
| `t4` | `Full Strategy` | 4.5 | не задан |

Флаг `unconfirmed` есть **только у `t2`**. У остальных ключ физически отсутствует (не `false`).

| константа | значение | где используется |
|-----------|----------|------------------|
| `MIN_FEE` | `5000` | нижняя граница базовой суммы + условие `minNote` |
| `HOURLY` | `80` | `extra = hours * HOURLY`; в подписи поля жёстко продублировано `($80/soat)` |
| `MIN_MONTHS` | `3` | нижняя граница месяцев, но только при `months > 0` |

---

## 2. Начальное состояние (строка 157)

```js
state = { area: 18400, tariff: 't3', rate: 2.5, months: 0, monthly: 2500, hours: 0 };
```

| поле | значение | тип |
|------|----------|-----|
| `area` | `18400` | number, м² |
| `tariff` | `'t3'` | ключ TARIFFS |
| `rate` | `2.5` | number, USD/m² (совпадает с `TARIFFS.t3.rate`) |
| `months` | `0` | number, месяцев авторского надзора |
| `monthly` | `2500` | number, USD/мес |
| `hours` | `0` | number, часов сверх лимита |

---

## 3. Формулы - дословно (строки 178-184)

```js
const s = this.state;
const raw = s.area * s.rate;
const base = Math.max(raw, MIN_FEE);
const months = s.months > 0 ? Math.max(s.months, MIN_MONTHS) : 0;
const supervision = months * s.monthly;
const extra = s.hours * HOURLY;
const total = base + supervision + extra;
```

Порядок вычислений обязателен к сохранению:

1. `raw = area × rate` - сырая сумма, **без** пола.
2. `base = Math.max(raw, 5000)` - базовая услуга с полом MIN_FEE.
3. `months` - **условный** клэмп: если `s.months > 0`, то `Math.max(s.months, 3)`; если `s.months === 0` → `0`.
   Т.е. 1 и 2 месяца превращаются в 3; ноль остаётся нулём (нет надзора вообще).
4. `supervision = months × monthly` - считается от **клэмпнутых** месяцев.
5. `extra = hours × 80`.
6. `total = base + supervision + extra` - от `base`, не от `raw`.

Округления внутри формул нет - округление только в `usd()` при выводе.

---

## 4. Форматирование

### 4.1 `usd(n)` (строки 159-161)

```js
usd(n) {
  return '$' + Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
}
```

- `Math.round` - банковского округления нет, .5 идёт вверх: `usd(2.5) === '$3'`, `usd(3.5) === '$4'`, `usd(1500.5) === '$1 501'`.
- `toLocaleString('en-US')` на целом числе даёт группы по 3 с запятыми: `46000 → "46,000"`.
- `.replace(/,/g, ' ')` - глобальная замена запятых на **обычный пробел U+0020** (НЕ тонкий, НЕ NBSP).
- Итог: `usd(46000) === '$46 000'`, `usd(960) === '$960'`, `usd(0) === '$0'`, `usd(303600) === '$303 600'`.
- Знак `$` ставится префиксом вручную, форматирование валюты Intl не используется.

Эквивалент без `toLocaleString` (для порта): целое число, группы по 3 справа налево, разделитель `' '`.

### 4.2 `num(v, fallback)` (строки 162-165)

```js
num(v, fallback) {
  const n = parseFloat(String(v).replace(',', '.'));
  return isFinite(n) && n >= 0 ? n : fallback;
}
```

- `String(v)` - приведение к строке.
- `.replace(',', '.')` - **без флага `g`**: заменяется только ПЕРВАЯ запятая. `'1,234,5' → '1.234,5' → parseFloat → 1.234`.
- `parseFloat` - «мягкий» разбор: ведущие пробелы игнорируются, хвост мусора отбрасывается.
- Возвращается `n`, только если `isFinite(n) && n >= 0`; иначе `fallback`.
  Отрицательные, `NaN`, `Infinity` → fallback.

Проверенные значения:

| вход | результат при `fallback = 0` |
|------|------------------------------|
| `''` | `0` (fallback) |
| `'2,5'` | `2.5` |
| `'1,234,5'` | `1.234` |
| `'-3'` | `0` (fallback, т.к. `n >= 0` ложно) |
| `'abc'` | `0` (fallback) |
| `'  4.5 '` | `4.5` |
| `'1e3'` | `1000` |

Во всех пяти обработчиках ввода `fallback === 0` (строки 200-204).

### 4.3 Строковые метки (строки 188-197)

```js
tariffName: TARIFFS[s.tariff].name + (TARIFFS[s.tariff].unconfirmed ? ' · stavka tasdiqlanmagan' : ''),
unconfirmedDisplay: TARIFFS[s.tariff].unconfirmed ? 'flex' : 'none',
baseFeeLabel: this.usd(base),
baseFormula: s.area.toLocaleString('en-US').replace(/,/g, ' ') + ' m² × ' + String(s.rate).replace('.', ',') + ' USD/m²',
supervisionLabel: months ? this.usd(supervision) + ' (' + months + ' oy)' : '-',
extraLabel: extra ? this.usd(extra) + ' (' + s.hours + ' soat)' : '-',
totalLabel: this.usd(total),
minNote: raw < MIN_FEE ? 'Minimal summa $5 000 qo‘llanildi (hisob ' + this.usd(raw) + ').' : '',
monthsLabel: s.months === 0 ? 'yo‘q' : (months + ' oy'),
hoursLabel: s.hours === 0 ? 'yo‘q' : (s.hours + ' soat'),
```

Разбор нетривиальных мест:

**`baseFormula`** - `18 400 m² × 2,5 USD/m²`
- Площадь: `s.area.toLocaleString('en-US')` **без** `Math.round` → запятые тысяч меняются на пробел,
  но **десятичная точка остаётся точкой**: `area = 1234.5` → `"1 234.5 m² × …"`.
  (`toLocaleString` по умолчанию режет до 3 знаков после точки.)
- Разделители: `' m² × '` - пробел, `m`, `²` (U+00B2), пробел, `×` (U+00D7), пробел.
- Ставка: `String(s.rate).replace('.', ',')` - **точка меняется на запятую** (одна замена, без `g`).
  `2.5 → "2,5"`, `2 → "2"` (целое остаётся без дробной части), `4.5 → "4,5"`, `2.2 → "2,2"`.
- Хвост: `' USD/m²'`.

**`supervisionLabel`** - использует **клэмпнутое** `months`, не `s.months`.
Условие `months ?` - при `months === 0` выводится `'-'` (U+2014). При `monthly = 0` и `months = 6`
`supervision = 0`, но условие проверяет `months`, а не `supervision`, поэтому выведется `'$0 (6 oy)'`.

**`extraLabel`** - условие проверяет `extra` (произведение), а количество часов печатается сырое `s.hours`.
`hours = 0` → `extra = 0` → `'-'`.

**`minNote`** - сравнение `raw < MIN_FEE` (сырая, до пола). Сумма `$5 000` **захардкожена строкой**,
не берётся из `usd(MIN_FEE)`. Внутри скобок - `usd(raw)`. Точка в конце. Апостроф в `qo‘llanildi` - U+2018.
Когда условие ложно - **пустая строка** `''`.

**`monthsLabel`** - проверка на `s.months === 0` (сырое), а печатается клэмпнутое `months`.
Т.е. ползунок на 1 → подпись `3 oy`. При 0 → `yo‘q` (U+2018).

**`hoursLabel`** - `s.hours === 0` → `yo‘q`, иначе `s.hours + ' soat'` (сырые часы).

---

## 5. Разбивка ценности и график платежей (строки 198-199)

```js
split50: this.usd(base * 0.5), split30: this.usd(base * 0.3), split20: this.usd(base * 0.2),
pay40: this.usd(base * 0.4), pay30: this.usd(base * 0.3), pay30b: this.usd(base * 0.3),
```

**ПРИНЦИПИАЛЬНО: все шесть величин считаются от `base`, а НЕ от `total`.**
Ни авторский надзор, ни дополнительные часы в них не входят. Это подтверждено и текстом сноски
(строка 140): `Jadval faqat asosiy xizmat summasiga qo‘llanadi. Mualliflik nazorati har oy alohida hisob-faktura bilan to‘lanadi.`

| ключ | формула | подпись в UI |
|------|---------|--------------|
| `split50` | `usd(base * 0.5)` | `50%` - `Konsepsiya va chizmalar` |
| `split30` | `usd(base * 0.3)` | `30%` - `Moliyaviy model` |
| `split20` | `usd(base * 0.2)` | `20%` - `Texnik topshiriq` |
| `pay40` | `usd(base * 0.4)` | `Boshlang‘ich to‘lov - ish boshlanishida` |
| `pay30` | `usd(base * 0.3)` | `Oraliq - Draft chizma va Draft finance` |
| `pay30b` | `usd(base * 0.3)` | `Yakuniy - Final report` |

`pay30` и `pay30b` - идентичные выражения (`base * 0.3`), разные ключи для двух строк таблицы.
Округление у каждой доли независимое (`Math.round` внутри `usd`), поэтому сумма долей может
не совпасть с `base` на ±1 USD - так в оригинале, компенсации нет.

---

## 6. Поля ввода в разметке

Все обработчики повешены и на `onChange`, и на `onInput` (одна и та же функция).

| # | строка | поле | тип | атрибуты | обработчик | state |
|---|--------|------|-----|----------|-----------|-------|
| 1 | 40 | площадь | `number` | `min="0" step="100"` | `onArea` | `area` |
| 2 | 47-50 | тариф | 4 × `button type="button"` | - | `pickT1..pickT4` | `tariff` + `rate` |
| 3 | 56 | ставка | `number` | `min="0" step="0.1"` | `onRate` | `rate` |
| 4 | 66 | месяцы | `range` | `min="0" max="24" step="1"` | `onMonths` | `months` |
| 5 | 70 | оплата в месяц | `number` | `min="0" step="100"` | `onMonthly` | `monthly` |
| 6 | 78 | часы | `range` | `min="0" max="120" step="4"` | `onHours` | `hours` |

### Подписи (узбекский - дословно, апострофы U+2018)

**Заголовок карточки ввода** (стр. 36): `Kirish ma‘lumotlari`
**Шапка страницы** (стр. 27-28): `CASE OS · ichki vosita` / `Xizmat narxi kalkulyatori`

**1. Площадь** (стр. 39, 41)
- label: `Hisob-kitob maydoni, m²`
- подсказка: `Tijorat stilobati + tijorat avtoturargohi + stilobatga tegishli o‘tish yo‘laklari va jamoat zallari + BoH. Turar-joy zinapoya, lift va kirish zallari kirmaydi.`
- стиль поля: `font-size:26px;font-weight:700;padding:10px 12px;border:1px solid #DAD6D0;background:#FBFAF8;color:#14181B;width:100%;box-sizing:border-box`

**2. Тариф** (стр. 45-51), label: `Tarif`; сетка `grid-template-columns:1fr 1fr;gap:8px`

| кнопка | 1-я строка | 2-я строка (`font-weight:400;font-size:12px;opacity:0.75`) |
|--------|-----------|------------------------------------------------------------|
| t1 | `Expert Review` | `2,0 USD/m² · 2-3 hafta` |
| t2 | `Concept Support` | `[2,2] USD/m² · 4-6 hafta` |
| t3 | `Commercial Concept` | `2,5 USD/m² · 7-10 hafta` |
| t4 | `Full Strategy` | `4,5 USD/m² · 10-14 hafta` |

Разделитель между строками - `<br />`. Тире в диапазонах недель - `-` (U+2013), точка-разделитель - `·` (U+00B7).
Ставка в подписи кнопок пишется с **запятой** (`2,0`), у t2 дополнительно в квадратных скобках `[2,2]`.

**3. Ставка вручную** (стр. 55, 57, 58)
- label: `Stavkani qo‘lda o‘zgartirish, USD/m²`
- подсказка: `Chegirma yoki murakkablik uchun tuzatish. Sababini offerda izohlash shart.`
- ширина поля 160px, `font-size:20px;font-weight:600;padding:9px 12px`
- предупреждение (видимость `display:{{ unconfirmedDisplay }}`), полный текст с вложенным span:
  `Concept Support stavkasi ` + `<span style="font-weight:700;color:#9A1D20">tasdiqlanmagan</span>` + ` - narx-navo faylidan (Excel) tekshirib, mijozga yuborishdan oldin aniqlashtiring.`
- стиль плашки: `gap:8px;align-items:flex-start;background:rgba(154,29,32,0.07);border-left:3px solid #9A1D20;padding:9px 12px;font-size:12px;line-height:1.45;color:#6E6A66`

**4-5. Авторский надзор** (стр. 64, 71)
- заголовок блока: `Mualliflik nazorati - alohida oylik tarif` (тире U+2014)
- справа от ползунка: `{{ monthsLabel }}`, стиль `font-size:20px;font-weight:700;min-width:96px;text-align:right;font-variant-numeric:tabular-nums`
- рядом с числовым полем: `USD/oy · minimal 3 oy`; ширина поля 120px, `font-size:16px;font-weight:600;padding:8px 10px`

**6. Часы** (стр. 76)
- label: `Limitdan ortiq vaqt, soat ($80/soat)`
- справа от ползунка: `{{ hoursLabel }}` (тот же стиль, что у monthsLabel)

Между блоком «ставка» и блоком «надзор» - разделитель `<div style="height:1px;background:#DAD6D0"></div>` (стр. 61).

### Тексты панели результата (стр. 86-140)

| строка | текст |
|--------|-------|
| 86 | `Hisob-kitob` |
| 88 | `Xizmat narxi ({{ tariffName }})` |
| 90 | `{{ baseFormula }}` |
| 94 | `Asosiy xizmat` → `{{ baseFeeLabel }}` |
| 96 | `Mualliflik nazorati` → `{{ supervisionLabel }}` |
| 98 | `Qo‘shimcha vaqt` → `{{ extraLabel }}` |
| 103 | `Jami` → `{{ totalLabel }}` |
| 106 | `{{ minNote }} Soliqlar kiritilmagan. Transport, mehmonxona va ovqatlanish alohida qoplanadi.` |
| 110 | `Narx nimadan tashkil topadi` |
| 114 / 119 / 124 | `Konsepsiya va chizmalar` / `Moliyaviy model` / `Texnik topshiriq` |
| 131 | `To‘lov jadvali · 40 / 30 / 30` |
| 133 / 135 / 137 | `Boshlang‘ich to‘lov - ish boshlanishida` / `Oraliq - Draft chizma va Draft finance` / `Yakuniy - Final report` |
| 140 | `Jadval faqat asosiy xizmat summasiga qo‘llanadi. Mualliflik nazorati har oy alohida hisob-faktura bilan to‘lanadi.` |

Шрифт крупной цифры `baseFeeLabel` - `Newsreader,Georgia,serif;font-size:46px;font-weight:400`;
`totalLabel` - `Archivo,sans-serif;font-size:34px;font-weight:700`. Числовые ячейки везде `font-variant-numeric:tabular-nums`.

---

## 7. Стили кнопок тарифов - `btnStyle(code)` (строки 169-175)

```js
btnStyle(code) {
  const on = this.state.tariff === code;
  return 'text-align:left;padding:12px 14px;line-height:1.35;font-size:14px;font-weight:600;cursor:pointer;'
    + 'border:1px solid ' + (on ? '#9A1D20' : '#DAD6D0') + ';'
    + 'background:' + (on ? '#9A1D20' : '#FBFAF8') + ';'
    + 'color:' + (on ? '#fff' : '#14181B') + ';font-family:Archivo,sans-serif';
}
```

| свойство | активная (`on`) | неактивная |
|----------|-----------------|------------|
| `border` | `1px solid #9A1D20` | `1px solid #DAD6D0` |
| `background` | `#9A1D20` | `#FBFAF8` |
| `color` | `#fff` (три символа, не `#ffffff`) | `#14181B` |

Общая часть (одинакова всегда): `text-align:left;padding:12px 14px;line-height:1.35;font-size:14px;font-weight:600;cursor:pointer;` … `font-family:Archivo,sans-serif`.

Готовые строки целиком:
```
активная:   text-align:left;padding:12px 14px;line-height:1.35;font-size:14px;font-weight:600;cursor:pointer;border:1px solid #9A1D20;background:#9A1D20;color:#fff;font-family:Archivo,sans-serif
неактивная: text-align:left;padding:12px 14px;line-height:1.35;font-size:14px;font-weight:600;cursor:pointer;border:1px solid #DAD6D0;background:#FBFAF8;color:#14181B;font-family:Archivo,sans-serif
```

**Выбор тарифа** (строки 166-168):
```js
pick(code) { this.setState({ tariff: code, rate: TARIFFS[code].rate }); }
```
Клик по тарифу перезаписывает `rate` значением из TARIFFS. Обратная связь отсутствует:
ручное изменение `rate` **не** сбрасывает `tariff`, поэтому возможно состояние
`tariff: 't3'` при `rate: 1.8` - заголовок скажет `Commercial Concept`, а формула покажет `1,8 USD/m²`.

### Палитра (для порта)

| токен | hex | где |
|-------|-----|-----|
| фон страницы | `#EFECE8` | body, корневой div |
| акцент (бордовый) | `#9A1D20` | линии, ссылки, активный тариф, accent-color range |
| акцент светлый | `#C8494D` | заголовок «Hisob-kitob» на тёмной карточке |
| текст | `#14181B` | основной; фон тёмной карточки |
| текст на тёмном | `#F7F5F2` | + `rgba(247,245,242,0.75)`, `…,0.6)`, разделитель `…,0.2)` |
| приглушённый | `#6E6A66` | подсказки, надзаголовки |
| граница | `#DAD6D0` | инпуты, разделители |
| фон инпута | `#FBFAF8` | инпуты, неактивные кнопки |
| блоки 50/30/20 | `#9A1D20` / `rgba(154,29,32,0.72)` / `rgba(154,29,32,0.45)`, текст `#fff` | стр. 112, 117, 122 |
| плашка «tasdiqlanmagan» | `rgba(154,29,32,0.07)` | стр. 58 |

Шрифты (стр. 13): `Newsreader` (opsz 6..72, wght 400/500/600) - заголовки/крупные цифры; `Archivo` (400/500/600/700) - весь остальной UI.
Логотип: `assets/case-logo-color.png`, `width:150px;height:auto` (стр. 30).
Сетка: внешний контейнер `max-width:1180px`, `padding:48px 56px 64px`, `gap:26px`;
две колонки `grid-template-columns:1.05fr 1fr;gap:26px;align-items:start` (стр. 33).

---

## 8. Тест-векторы (вычислены запуском кода 1:1)

Все значения ниже получены прогоном исходной логики в Node - можно использовать как ожидания в тестах.

### V1 - состояние по умолчанию `{area:18400, tariff:'t3', rate:2.5, months:0, monthly:2500, hours:0}`
```
raw=46000  base=46000  months=0  supervision=0  extra=0  total=46000
tariffName    = "Commercial Concept"
baseFeeLabel  = "$46 000"
baseFormula   = "18 400 m² × 2,5 USD/m²"
supervisionLabel = "-"      extraLabel = "-"
totalLabel    = "$46 000"   minNote = ""
monthsLabel   = "yo‘q"      hoursLabel = "yo‘q"
split50/30/20 = "$23 000" / "$13 800" / "$9 200"
pay40/30/30b  = "$18 400" / "$13 800" / "$13 800"
unconfirmedDisplay = "none"
```

### V2 - срабатывает MIN_FEE `{area:1000, tariff:'t1', rate:2.0, months:0, monthly:2500, hours:0}`
```
raw=2000  base=5000  total=5000
baseFormula = "1 000 m² × 2 USD/m²"      ← rate 2.0 печатается как "2"
minNote     = "Minimal summa $5 000 qo‘llanildi (hisob $2 000)."
totalLabel  = "$5 000"
split50/30/20 = "$2 500" / "$1 500" / "$1 000"
pay40/30/30b  = "$2 000" / "$1 500" / "$1 500"
```

### V3 - клэмп месяцев `{area:18400, tariff:'t3', rate:2.5, months:1, monthly:2500, hours:0}`
```
months=3  supervision=7500  total=53500
supervisionLabel = "$7 500 (3 oy)"
monthsLabel      = "3 oy"        ← ползунок стоит на 1, подпись показывает 3
totalLabel       = "$53 500"
split/pay - как в V1 (от base=46000, надзор не влияет)
```

### V4 - неподтверждённый тариф `{area:20000, tariff:'t2', rate:2.2, months:6, monthly:3000, hours:12}`
```
raw=44000  base=44000  months=6  supervision=18000  extra=960  total=62960
tariffName        = "Concept Support · stavka tasdiqlanmagan"
unconfirmedDisplay= "flex"
baseFormula       = "20 000 m² × 2,2 USD/m²"
supervisionLabel  = "$18 000 (6 oy)"
extraLabel        = "$960 (12 soat)"
totalLabel        = "$62 960"
monthsLabel="6 oy"  hoursLabel="12 soat"
split50/30/20 = "$22 000" / "$13 200" / "$8 800"
pay40/30/30b  = "$17 600" / "$13 200" / "$13 200"
```

### V5 - максимумы ползунков `{area:52000, tariff:'t4', rate:4.5, months:24, monthly:2500, hours:120}`
```
raw=234000  base=234000  supervision=60000  extra=9600  total=303600
baseFormula      = "52 000 m² × 4,5 USD/m²"
supervisionLabel = "$60 000 (24 oy)"
extraLabel       = "$9 600 (120 soat)"
totalLabel       = "$303 600"
split50/30/20 = "$117 000" / "$70 200" / "$46 800"
pay40/30/30b  = "$93 600" / "$70 200" / "$70 200"
```

### V6 - нулевая площадь `{area:0, …rate:2.5}`
```
raw=0  base=5000  total=5000
baseFormula = "0 m² × 2,5 USD/m²"
minNote     = "Minimal summa $5 000 qo‘llanildi (hisob $0)."
```

### V7 - дробная площадь `{area:1234.5, rate:2}`
```
raw=2469  base=5000
baseFormula = "1 234.5 m² × 2 USD/m²"   ← точка в площади НЕ меняется на запятую
minNote     = "Minimal summa $5 000 qo‘llanildi (hisob $2 469)."
```

### V8 - юнит-тесты форматтеров
```
usd(2.5)="$3"   usd(3.5)="$4"   usd(0.4)="$0"   usd(1500.5)="$1 501"
num('', 'X')='X'   num('2,5',0)=2.5   num('1,234,5',0)=1.234
num('-3',0)=0      num('abc',7)=7     num('  4.5 ',0)=4.5   num('1e3',0)=1000
```

---

## 9. Полный эталонный код логики (строки 148-211, дословно)

```js
const TARIFFS = {
  t1: { name: 'Expert Review', rate: 2.0 },
  t2: { name: 'Concept Support', rate: 2.2, unconfirmed: true },
  t3: { name: 'Commercial Concept', rate: 2.5 },
  t4: { name: 'Full Strategy', rate: 4.5 }
};
const MIN_FEE = 5000, HOURLY = 80, MIN_MONTHS = 3;

class Component extends DCLogic {
  state = { area: 18400, tariff: 't3', rate: 2.5, months: 0, monthly: 2500, hours: 0 };

  usd(n) {
    return '$' + Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
  }
  num(v, fallback) {
    const n = parseFloat(String(v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : fallback;
  }
  pick(code) {
    this.setState({ tariff: code, rate: TARIFFS[code].rate });
  }
  btnStyle(code) {
    const on = this.state.tariff === code;
    return 'text-align:left;padding:12px 14px;line-height:1.35;font-size:14px;font-weight:600;cursor:pointer;'
      + 'border:1px solid ' + (on ? '#9A1D20' : '#DAD6D0') + ';'
      + 'background:' + (on ? '#9A1D20' : '#FBFAF8') + ';'
      + 'color:' + (on ? '#fff' : '#14181B') + ';font-family:Archivo,sans-serif';
  }

  renderVals() {
    const s = this.state;
    const raw = s.area * s.rate;
    const base = Math.max(raw, MIN_FEE);
    const months = s.months > 0 ? Math.max(s.months, MIN_MONTHS) : 0;
    const supervision = months * s.monthly;
    const extra = s.hours * HOURLY;
    const total = base + supervision + extra;

    return {
      area: s.area, rate: s.rate, months: s.months, monthly: s.monthly, hours: s.hours,
      tariffName: TARIFFS[s.tariff].name + (TARIFFS[s.tariff].unconfirmed ? ' · stavka tasdiqlanmagan' : ''),
      unconfirmedDisplay: TARIFFS[s.tariff].unconfirmed ? 'flex' : 'none',
      baseFeeLabel: this.usd(base),
      baseFormula: s.area.toLocaleString('en-US').replace(/,/g, ' ') + ' m² × ' + String(s.rate).replace('.', ',') + ' USD/m²',
      supervisionLabel: months ? this.usd(supervision) + ' (' + months + ' oy)' : '-',
      extraLabel: extra ? this.usd(extra) + ' (' + s.hours + ' soat)' : '-',
      totalLabel: this.usd(total),
      minNote: raw < MIN_FEE ? 'Minimal summa $5 000 qo‘llanildi (hisob ' + this.usd(raw) + ').' : '',
      monthsLabel: s.months === 0 ? 'yo‘q' : (months + ' oy'),
      hoursLabel: s.hours === 0 ? 'yo‘q' : (s.hours + ' soat'),
      split50: this.usd(base * 0.5), split30: this.usd(base * 0.3), split20: this.usd(base * 0.2),
      pay40: this.usd(base * 0.4), pay30: this.usd(base * 0.3), pay30b: this.usd(base * 0.3),
      onArea: e => this.setState({ area: this.num(e.target.value, 0) }),
      onRate: e => this.setState({ rate: this.num(e.target.value, 0) }),
      onMonths: e => this.setState({ months: this.num(e.target.value, 0) }),
      onMonthly: e => this.setState({ monthly: this.num(e.target.value, 0) }),
      onHours: e => this.setState({ hours: this.num(e.target.value, 0) }),
      pickT1: () => this.pick('t1'), pickT2: () => this.pick('t2'),
      pickT3: () => this.pick('t3'), pickT4: () => this.pick('t4'),
      t1Style: this.btnStyle('t1'), t2Style: this.btnStyle('t2'),
      t3Style: this.btnStyle('t3'), t4Style: this.btnStyle('t4')
    };
  }
}
```

Полный список выходных ключей `renderVals()` (25 значений + 5 обработчиков + 4 pick + 4 стиля):
`area, rate, months, monthly, hours, tariffName, unconfirmedDisplay, baseFeeLabel, baseFormula,
supervisionLabel, extraLabel, totalLabel, minNote, monthsLabel, hoursLabel, split50, split30, split20,
pay40, pay30, pay30b, onArea, onRate, onMonths, onMonthly, onHours, pickT1..pickT4, t1Style..t4Style`.
Заметьте: `months` в выходе - это **сырое** `s.months` (для ползунка), а не клэмпнутое.

---

## 10. Замечания, противоречия, риски порта

1. **`num` заменяет только первую запятую** (нет флага `g`). `'1,234,5'` даст `1.234`, а не `1234.5`.
   Это баг-как-фича; для порта 1:1 сохранить.
2. **Подпись кнопки t2 = `[2,2]`, а `TARIFFS.t2.rate = 2.2`.** Квадратные скобки в разметке -
   маркер неподтверждённой ставки. Значения не расходятся, но текст кнопки и текст формулы выглядят по-разному.
3. **`minNote` хардкодит `$5 000`** вместо `usd(MIN_FEE)`. При смене MIN_FEE строка разъедется.
4. **Ручное изменение `rate` не сбрасывает выбранный тариф** - возможно противоречивое отображение
   («Commercial Concept» + произвольная ставка). Плашка `unconfirmed` тоже зависит только от `tariff`.
5. **`monthsLabel` показывает клэмпнутое значение, а ползунок - сырое.** При `months=1` или `2`
   ползунок и подпись рассинхронизированы (1 vs «3 oy»). Так в оригинале.
6. **`supervisionLabel` проверяет `months`, а не `supervision`** - при `monthly = 0` выведет `$0 (N oy)`, не `-`.
   **`extraLabel` наоборот проверяет `extra`** - при `hours > 0` и (гипотетически) HOURLY=0 дал бы `-`.
7. **Площадь в `baseFormula` не округляется**, десятичная точка остаётся точкой, тогда как ставка
   переводится на запятую. Смешанная типографика в одной строке - так в оригинале.
8. **Доли округляются независимо** - `split50+split30+split20` и `pay40+pay30+pay30b` могут
   отличаться от `base` на ±1 USD. Компенсации нет.
9. **Строка 106**: шаблон `{{ minNote }} Soliqlar kiritilmagan.` - при пустом `minNote` остаётся
   ведущий пробел (в HTML схлопывается, но при выводе в plain-text/PDF нужно `trim()`).
10. **Валидация ввода отсутствует за пределами `num`**: `area` и `monthly` не ограничены сверху,
    `rate` не ограничена. Атрибуты `min/max/step` - только подсказки браузеру; range-инпуты
    ограничивают 0-24 и 0-120, числовые поля - нет.
11. **Верхнего предела у `months` в логике нет** (клэмп только снизу); ограничение 24 живёт лишь в
    атрибуте `max` ползунка.
12. **`DCLogic`/`setState` - рантайм платформы** (подключается `./support.js`, стр. 6). Для ванильного
    порта нужен собственный механизм состояния и перерисовки; сама формула от него не зависит.
13. **Внешние зависимости разметки**: Google Fonts (стр. 11-13) и `assets/case-logo-color.png` (стр. 30).
    Не найдено: тёмная тема, локализация, экспорт/печать, сохранение состояния, любые НДС/налоги
    (явно сказано `Soliqlar kiritilmagan`), скидочные коэффициенты помимо ручной правки ставки.
