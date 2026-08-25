# Разбор деки «CASE Taklif Prezentatsiya.dc.html» - все 15 слайдов

Источник: `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Taklif Prezentatsiya.dc.html` (651 строка).

Сопоставляемые файлы:
- A4-документ: `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Tijorat Taklifi A4.dc.html` (616 строк)
- ТЗ: `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/prompts/CASE-OS-Offer-Builder-prompt.md`
- Заметки: `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/scratchpad.md`

---

## 0. Общая техническая рамка файла

| Что | Значение | Строки |
|---|---|---|
| Обёртка | `<x-dc>` → `<x-import component-from-global-scope="deck-stage" from="./deck-stage.js" width="1920" height="1080" hint-size="100%,100%">` | 21 |
| Слайд | `<section data-label="…" data-screen-label="NN" data-speaker-notes="…" style="…">` | 23-646 |
| Шрифты | Google Fonts: `Newsreader` (opsz 6..72, wght 400/500/600) + `Archivo` (400/500/600/700) | 13 |
| Глобальный CSS | `html,body{margin:0;padding:0;background:#0F1112;}` `a{color:#9A1D20;…}` `a:hover{color:#14181B;}` | 15-18 |
| Подключаемые скрипты | `./support.js` (стр. 6), `./image-slot.js` (стр. 19) | 6, 19 |
| Внешний JS-компонент | `deck-stage.js` | 21 |

**Важно:** у деки, в отличие от A4, **нет** блока `<script type="text/x-dc" data-dc-script data-props="…">`. То есть в деке **нет параметров редактора** (`showGuidance`, `showPlaceholderTint`, `textScale`, `brandRed`), нет CSS-переменных `--red/--ph-bg/--s/--guide`, нет плашек «Yo‘riqnoma». Все цвета и размеры в деке - **захардкожены инлайн**. В A4 они параметризованы (`CASE Tijorat Taklifi A4.dc.html:25`, `:602`).

### Палитра деки (фактически встречающиеся значения)

| Токен | HEX / rgba | Где |
|---|---|---|
| Тёмный фон (ink) | `#14181B` | фон слайдов 01 и 12; тёмные плашки на 04, 11; бордюры таблиц; последняя полоса Ганта |
| Светлый фон (paper) | `#FBFAF8` | фон слайдов 02-11, 13-15; ячейки таблиц |
| Белый | `#fff` | карточки value-chain на 02; подложка логотипа на 01 и 12 |
| Красный бренд | `#9A1D20` | полосы, акценты, ✓, заливка Ганта, ячейки калькулятора |
| Красный светлый (на тёмном) | `#C8494D` | eyebrow-надписи на тёмных слайдах, знаки × и = |
| Текст на тёмном | `#F7F5F2` | 01, 12, плашки |
| Основной текст | `#14181B` | светлые слайды |
| Вторичный текст | `#6E6A66` | подписи, сноски |
| Текст абзацев (тёмно-серый) | `#3A3D3F` | 02 (лид), 04 (абзацы) |
| Линейка | `#DAD6D0` | 1px разделители в списках/таблицах |
| Полотно под image-slot | `#F1EEEA` | 03 (фото), 06-08 (плашка «Natija») |
| Стрелка | `#C4BFB8` | → на слайде 05 |
| Подсветка плейсхолдера (тёмный фон) | `rgba(200,73,77,0.22)` | 01, 12 |
| Подсветка плейсхолдера (светлый фон) | `rgba(154,29,32,0.12)` | 04 |
| Подсветка плейсхолдера (13) | `rgba(154,29,32,0.14)` | 13 |
| Фон рекомендуемого тарифа | `rgba(154,29,32,0.08)` | 09, 10, 13 |
| Красный 72% / 45% / 60% | `rgba(154,29,32,0.72)` / `(…,0.45)` / `(…,0.6)` | 12 (структура цены), 14 (оплата, −1/−2) |

Апострофы во всём файле - **только U+2018 `‘`** (138 вхождений). Символов U+2019, U+02BB, U+02BC в файле нет. Также используются: `-` U+2014 (40), `·` U+00B7 (22), `✓` U+2713 (21), `-` U+2013 (11), `²` U+00B2 (10), `−` U+2212 (4), `…` U+2026 (3), `«»`, `→`, `×`.

---

# СЛАЙД 01 - «01 Muqova»

- `data-label="01 Muqova"`, `data-screen-label="01"`
- Строки 23-47.

**data-speaker-notes (дословно):**
> Muqova. Loyiha nomi, shahar va sana to‘ldiriladi. Bir gap bilan taklif predmetini aytamiz va keyingi slaydga o‘tamiz.

**Стиль секции (стр. 23):** `background:#14181B; color:#F7F5F2; font-family:Newsreader,Georgia,serif; box-sizing:border-box; padding:96px 112px; display:flex; flex-direction:column; justify-content:space-between`

**Структура:** три flex-строки, распределённые `space-between` по высоте 1080px.
1. Шапка: белая подложка (`background:#fff; padding:20px 26px`) с логотипом + правый тэглайн.
2. Центральный блок (`flex-direction:column; gap:34px; max-width:1400px`): красная полоса → eyebrow → H1.
3. Подвал: `border-top:1px solid rgba(247,245,242,0.22); padding-top:34px; gap:96px` - три пары «метка/значение».

**Изображения:** `assets/case-logo-color.png`, `width:280px; height:auto` (стр. 25). `image-slot` нет.

**Полосы:** `<span style="display:block;width:140px;height:6px;background:#9A1D20">` (стр. 29).

| block_key (предложение) | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `cover.tagline` (нет в ТЗ) | `Tijorat ko‘chmas mulk<br />konsaltingi · 2017 dan` | тэглайн справа в шапке | 26 | Archivo 26px, ls 0.2em, uppercase, `rgba(247,245,242,0.6)`, text-align right, lh 1.7 |
| `cover.eyebrow` (нет в ТЗ; ≈ `cover.subtitle`) | `Tijorat taklifi` | надзаголовок | 30 | Archivo 28px/700, ls 0.26em, uppercase, `#C8494D` |
| `cover.title` | `«Loyiha nomi» majmuasi tijorat qismining konsepsiyasi` (плейсхолдер `Loyiha nomi` в `<span>` с подсветкой) | H1 | 31 | Newsreader 400, **88px**, lh 1.08, margin 0, ls −0.01em, `text-wrap:pretty`; плейсхолдер `background:rgba(200,73,77,0.22); padding:0 12px` |
| `cover.label_client` | `Buyurtmachi` | метка | 35 | Archivo 24px, ls 0.16em, uppercase, `rgba(247,245,242,0.5)` |
| `cover.client` | `Kompaniya nomi` | значение (плейсхолдер) | 36 | Archivo 30px |
| `cover.label_location` | `Joylashuv` | метка | 39 | как выше |
| `cover.location` | `Shahar, mamlakat` | значение (плейсхолдер) | 40 | Archivo 30px |
| `cover.label_date` | `Sana` | метка | 43 | как выше |
| `cover.date` | `kun oy yil` | значение (плейсхолдер) | 44 | Archivo 30px; блок `margin-left:auto; align-items:flex-end` |

**Деньги на слайде:** нет.

---

# СЛАЙД 02 - «02 Kirish»

- `data-label="02 Kirish"`, `data-screen-label="02"`, строки 49-79.

**data-speaker-notes (дословно):**
> Kirish. Biz kimmiz va nima taklif qilamiz - bir sahifada. Uch qatorli xizmat zanjirini ovoz chiqarib aytish kifoya.

**Стиль секции (стр. 49):** `background:#FBFAF8; color:#14181B; font-family:Newsreader,Georgia,serif; box-sizing:border-box; padding:88px 112px; display:flex; flex-direction:column`

**Структура:**
1. Шапка-раннер (общий паттерн светлых слайдов): `padding-bottom:22px; border-bottom:4px solid #9A1D20`, слева логотип `width:190px`, справа рубрика.
2. H2 (`margin:56px 0 28px; max-width:1500px`).
3. Лид-абзац (`margin:0 0 auto; max-width:1420px`) - `margin-bottom:auto` растягивает пустоту.
4. **Сетка из 4 карточек** цепочки услуг: `display:grid; grid-template-columns:repeat(4,1fr); gap:2px; background:#DAD6D0; border:2px solid #14181B; margin-top:56px`. Карточка: `background:#fff; padding:34px 30px; gap:14px`.
5. Замыкающая строка-сноска.

**Изображения:** логотип `width:190px` (стр. 51). `image-slot` нет.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.02` (нет в ТЗ) | `Kirish` | рубрика в шапке | 52 | Archivo 24px, ls 0.18em, uppercase, `#6E6A66` |
| `company.pitch_title` (нет в ТЗ) | `Biz tijorat ko‘chmas mulkni daromad keltiradigan aktivga aylantiramiz` (фрагмент `daromad keltiradigan aktivga` в `<span style="color:#9A1D20">`) | H2 | 54 | Newsreader 400, **64px**, lh 1.12 |
| `company.pitch` | `CASE Real Estate Advisory - O‘zbekiston va Markaziy Osiyoda tijorat ko‘chmas mulkiga ixtisoslashgan konsalting kompaniyasi. Biz loyihani qog‘ozdagi g‘oyadan ishlayotgan ob‘ektgacha kuzatib boramiz.` | лид | 55 | Archivo **32px**, lh 1.5, `#3A3D3F` |
| `company.value_chain_01` | `01` / `Konsepsiya va TEA` / `Format, reja, moliyaviy model` | карточка 1 | 58-60 | номер Archivo 24px/700 ls 0.14em `#9A1D20`; заголовок Archivo 30px/600 lh 1.25; подпись Archivo 24px lh 1.4 `#6E6A66` |
| `company.value_chain_02` | `02` / `Ijara va brend jalb qilish` / `Langar ijarachilar, tenant-mix, shartlar` | карточка 2 | 63-65 | то же |
| `company.value_chain_03` | `03` / `Ishga tushirish` / `Ochilishga tayyorgarlik, marketing, ishga tushirish` | карточка 3 | 68-70 | то же |
| `company.value_chain_04` | `04` / `Boshqaruv` / `Aktivni boshqarish va daromadni o‘stirish` | карточка 4 | 73-75 | то же |
| `company.stats_note` (по смыслу - скоуп-нота) | `Ushbu taklif birinchi bosqichga tegishli: konsepsiya, reja yechimlari va moliyaviy asos.` | сноска внизу | 78 | Archivo 26px, lh 1.45, `#6E6A66`, `margin:28px 0 0` |

**Деньги на слайде:** нет.

---

# СЛАЙД 03 - «03 Tajriba»

- `data-label="03 Tajriba"`, `data-screen-label="03"`, строки 81-131.

**data-speaker-notes (дословно):**
> Tajriba. Raqamlarni o‘qib chiqmang - mijoz ularni ko‘radi. Faqat uchta o‘xshash loyihani nomlab, natijasini aytib bering.

**Стиль секции (стр. 81):** `background:#FBFAF8; color:#14181B; font-family:Newsreader,Georgia,serif; box-sizing:border-box; padding:88px 112px; display:flex; flex-direction:column`

**Структура:**
1. Шапка-раннер (как на 02).
2. **Полоса из 5 метрик:** `grid-template-columns:repeat(5,1fr); gap:2px; background:#DAD6D0; border-bottom:2px solid #14181B; margin-top:44px`. Первая ячейка `padding:26px 10px 26px 0`, остальные `padding:26px 10px 26px 26px`, фон `#FBFAF8`.
3. **Три проектные карточки:** `grid-template-columns:repeat(3,1fr); gap:32px; margin-top:48px; flex:1`; в каждой - контейнер `flex:1; background:#F1EEEA` с `image-slot` и подпись.

**Изображения / image-slot (3 шт.):**
- `<image-slot id="deck-proj-1" shape="rect" placeholder="Margilon City Mall - foto">` (стр. 110)
- `<image-slot id="deck-proj-2" shape="rect" placeholder="Tashkent City Park - foto">` (стр. 117)
- `<image-slot id="deck-proj-3" shape="rect" placeholder="82 Mall / 82 Towers - foto">` (стр. 124)

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.03` | `Tajribamizdan` | рубрика | 84 | Archivo 24px, ls 0.18em, uppercase, `#6E6A66` |
| `stats.projects` | `89` + `loyiha` | метрика 1 | 88-89 | число Archivo **76px**/600 lh 1 `#9A1D20`; подпись Archivo 24px ls 0.1em uppercase `#6E6A66` |
| `stats.countries` | `8` + `mamlakat` | метрика 2 | 92-93 | то же |
| `stats.area` | `8` + ` mln m²` + `umumiy maydon` | метрика 3 | 96-97 | число 76px, суффикс `mln m²` - **34px** |
| `stats.investment` | `$5` + ` mlrd+` + `investitsiya hajmi` | метрика 4 - **денежная сумма** | 100-101 | 76px + суффикс 34px |
| `stats.team_years` | `50` + ` yil+` + `jamoa tajribasi` | метрика 5 | 104-105 | 76px + суффикс 34px |
| `projects.item_01` | `Margilon City Mall` / `Marg‘ilon, O‘zbekiston · 49 000 m² · konsepsiya va ijara` | карточка проекта | 112-113 | название Archivo 30px/600; подпись Archivo 24px `#6E6A66` |
| `projects.item_02` | `Tashkent City Park` / `Toshkent, O‘zbekiston · 140 000 m² · tijorat konsepsiyasi` | карточка проекта | 119-120 | то же |
| `projects.item_03` | `82 Mall / 82 Towers` / `Dushanbe, Tojikiston · 58 000 m² · konsepsiya va TEA` | карточка проекта | 126-127 | то же |

**Деньги на слайде:** **ДА** - `$5 mlrd+` (стр. 100). Это цифра компетенций (объём инвестиций в портфеле), не цена услуги.

---

# СЛАЙД 04 - «04 Loyihani tushunish»

- `data-label="04 Loyihani tushunish"`, `data-screen-label="04"`, строки 133-164.

**data-speaker-notes (дословно):**
> Eng muhim slayd. Bu yerda biz mijozning vazifasini uning o‘zidan aniqroq aytib berishimiz kerak. Uchta vazifa - kelishuvning o‘zagi.

**Стиль секции (стр. 133):** `background:#FBFAF8; …; padding:88px 112px; display:flex; flex-direction:column`

**Структура:** шапка-раннер + **две колонки** `grid-template-columns:1.25fr 1fr; gap:80px; margin-top:52px; flex:1`.
- Левая: H2 → два абзаца → тёмная плашка «Asosiy savol» (`margin-top:auto; background:#14181B; color:#F7F5F2; padding:30px 34px; gap:10px`).
- Правая: метка → три блока задач, каждый `border-top:4px solid #9A1D20; padding-top:20px; gap:10px; flex:1`.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.04` | `Loyihani tushunishimiz` | рубрика | 136 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `understanding.summary` | `«Loyiha nomi» - shahardagi ko‘p funksiyali majmua` (плейсхолдеры `Loyiha nomi` и `shahar` подсвечены) | H2 | 140 | Newsreader 400, **56px**, lh 1.14; подсветка `rgba(154,29,32,0.12); padding:0 10px` |
| `understanding.composition` | `Tarkibi: tijorat stilobati (+1…+3), turar-joy bloklari, yer osti avtoturargohi (−1…−2).` (плейсхолдер - весь состав) | абзац 1 | 141 | Archivo **30px**, lh 1.5, `#3A3D3F`; подсветка `rgba(154,29,32,0.12); padding:0 8px` |
| `understanding.thesis` | `Tijorat qismi majmuaning daromad markazi bo‘lishi kerak: ijaraga likvid, tashrif buyuruvchi oqimi barqaror, foydalanish xarajati arzon. Bugungi rejada bu natija kafolatlanmagan - shu sababli konsepsiya loyihalashdan oldin qat‘iylashtiriladi.` | абзац 2 | 142 | Archivo 30px, lh 1.5, `#3A3D3F` |
| `understanding.key_question_label` | `Asosiy savol` | метка на плашке | 144 | Archivo 24px/700, ls 0.16em, uppercase, `#C8494D` |
| `understanding.key_question` | `Bu maydonlardan yiliga qancha va qanday tarkib bilan daromad olish mumkin?` | ключевой вопрос | 145 | **Newsreader 38px**, lh 1.25, на `#14181B` |
| `understanding.tasks_label` | `Hal qiladigan uch vazifa` | метка колонки | 149 | Archivo 24px/700 ls 0.18em uppercase `#6E6A66` |
| `understanding.task_01` | `01` / `Tijorat qismining formatini va bozordagi o‘rnini aniqlash` | задача 1 | 151-152 | номер Archivo 28px/700 `#9A1D20`; текст Archivo 30px lh 1.35 |
| `understanding.task_02` | `02` / `Rejani ijaraga yaroqli va samarali holatga keltirish` | задача 2 | 155-156 | то же |
| `understanding.task_03` | `03` / `Investitsiya qarori uchun moliyaviy asosni tayyorlash` | задача 3 | 159-160 | то же |

**Деньги на слайде:** нет.

---

# СЛАЙД 05 - «05 Ish hajmi · umumiy»

- `data-label="05 Ish hajmi · umumiy"`, `data-screen-label="05"`, строки 166-195.

**data-speaker-notes (дословно):**
> Ish hajmining umumiy sxemasi. Uch bo‘lim ketma-ket, har biri keyingisining kirish ma‘lumotini beradi. Batafsil keyingi uch slaydda.

**Стиль секции (стр. 166):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** шапка-раннер → H2 → подзаголовок → **сетка 5 колонок** `grid-template-columns:1fr 60px 1fr 60px 1fr; align-items:stretch; flex:1`, где узкие колонки - стрелки `→`. Колонка блока: `border-top:6px solid #9A1D20; padding-top:26px; gap:18px`; строка «Natija» - `margin-top:auto; padding-top:22px; border-top:1px solid #DAD6D0`.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.05` | `Bajariladigan ishlar` | рубрика | 169 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `scope.overview_title` | `Ish hajmi: uch bo‘lim, bir mantiq` | H2 | 171 | Newsreader 400, **60px**, lh 1.12, `margin:52px 0 12px` |
| `scope.overview_intro` | `Har bir bo‘lim keyingisining kirish ma‘lumotini beradi; natijalar alohida hujjatlar bilan topshiriladi.` | подзаголовок | 172 | Archivo 30px, lh 1.45, `#6E6A66`, `margin:0 0 52px` |
| `scope.a.letter` | `A` | буква блока | 175 | Archivo **100px**/600, lh 0.9, `#9A1D20` |
| `scope.a.title` | `Bozor va raqobat muhiti` | заголовок A | 176 | Archivo 36px/600, lh 1.2 |
| `scope.a.goal` | `Talab, savdo zonasi, raqobatchilar, SWOT` | краткое содержание A | 177 | Archivo 26px, lh 1.45, `#6E6A66` |
| `scope.a.deliverables` | `Natija · bozor hisoboti (PDF)` (`Natija` - `#9A1D20; font-weight:700`) | результат A | 178 | Archivo 24px, lh 1.4 |
| - | `→` | стрелка-разделитель | 180 | Archivo 44px, `#C4BFB8` |
| `scope.b.letter` | `B` | буква блока | 182 | Archivo 100px/600 `#9A1D20` |
| `scope.b.title` | `Konsepsiya va reja` | заголовок B | 183 | Archivo 36px/600 |
| `scope.b.goal` | `Format, zonalashtirish, tenant-mix, oqimlar` | содержание B | 184 | Archivo 26px `#6E6A66` |
| `scope.b.deliverables` | `Natija · TT, rangli rejalar, maydonlar programmasi` | результат B | 185 | Archivo 24px |
| - | `→` | стрелка | 187 | Archivo 44px `#C4BFB8` |
| `scope.c.letter` | `C` | буква блока | 189 | Archivo 100px/600 `#9A1D20` |
| `scope.c.title` | `Moliyaviy TEA` | заголовок C | 190 | Archivo 36px/600 |
| `scope.c.goal` | `Ijara modeli, OpEx, NOI, IRR, NPV, risklar` | содержание C | 191 | Archivo 26px `#6E6A66` |
| `scope.c.deliverables` | `Natija · moliyaviy model (Excel) va hisobot` | результат C | 192 | Archivo 24px |

**Деньги на слайде:** нет.

---

# СЛАЙД 06 - «06 Bo'lim A»

- `data-label="06 Bo'lim A"` (в атрибуте - **прямой ASCII-апостроф `'`**, не U+2018), `data-screen-label="06"`, строки 197-223.

**data-speaker-notes (дословно):**
> A bo‘limi. Bu bozor tadqiqoti - konsepsiyaning faktik asosi. Mijozga aytiladigan asosiy fikr: biz taxmin qilmaymiz, o‘lchaymiz.

**Стиль секции (стр. 197):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** шапка-раннер → **две колонки** `grid-template-columns:0.9fr 1.4fr; gap:80px; margin-top:52px; flex:1`.
- Левая: гигантская буква → H2 → абзац → плашка «Natija» (`margin-top:auto; background:#F1EEEA; padding:28px 32px`).
- Правая: **список 8 пунктов в 2 колонки** `grid-template-columns:1fr 1fr; gap:0 48px; align-content:start; font-size:27px`; каждый пункт `padding:20px 0; border-bottom:1px solid #DAD6D0; line-height:1.35`.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.06` | `Bo‘lim A · bozor va raqobat muhiti` | рубрика | 200 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `scope.a.letter_big` | `A` | буква-акцент | 204 | Archivo **150px**/600, lh 0.85, `#9A1D20` |
| `scope.a.title_full` | `Bozor va raqobat muhitini o‘rganish` | H2 | 205 | Newsreader 400, **52px**, lh 1.15 |
| `scope.a.goal` | `Tadqiqot loyiha doirasidagi bozor nishalarini aniqlaydi va kelgusi talab dinamikasini baholaydi. Konsepsiya shu asosda quriladi.` | цель блока | 206 | Archivo 28px, lh 1.5, `#6E6A66` |
| `scope.a.deliverables_label` | `Natija` | метка | 208 | Archivo 24px/700 ls 0.16em uppercase `#9A1D20` |
| `scope.a.deliverables[0]` | `Bozor va raqobat muhiti bo‘yicha hisobot (PDF)` | результат | 209 | Archivo 30px, lh 1.35 |
| `scope.a.activities[0]` | `Makroiqtisodiy sharh va iste‘molchi tendensiyalari` | пункт списка | 213 | Archivo 27px |
| `scope.a.activities[1]` | `Demografiya, daromad darajasi, xarajat tarkibi` | пункт | 214 | Archivo 27px |
| `scope.a.activities[2]` | `Joylashuv, transport aloqalari, kirish-chiqish` | пункт | 215 | Archivo 27px |
| `scope.a.activities[3]` | `Savdo zonasi (catchment) va yo‘l vaqti hisobi` | пункт | 216 | Archivo 27px |
| `scope.a.activities[4]` | `Mavjud va rejalashtirilgan raqobatchilar tahlili` | пункт | 217 | Archivo 27px |
| `scope.a.activities[5]` | `Potensial GLA va tashrif buyuruvchilar oqimi` | пункт | 218 | Archivo 27px |
| `scope.a.activities[6]` | `Raqobatchilarning tenant-mix va to‘ldirilganligi` | пункт | 219 | Archivo 27px |
| `scope.a.activities[7]` | `SWOT-tahlil va bozordagi o‘rni bo‘yicha tavsiyalar` | пункт | 220 | Archivo 27px |

**Деньги на слайде:** нет.

---

# СЛАЙД 07 - «07 Bo'lim B»

- `data-label="07 Bo'lim B"` (ASCII-апостроф), `data-screen-label="07"`, строки 225-252.

**data-speaker-notes (дословно):**
> B bo‘limi - taklifning yuragi. Aynan shu yerda reja pulga aylanadi: zonalashtirish, oqimlar, tenant-mix.

**Стиль секции (стр. 225):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** идентична слайду 06 (`0.9fr 1.4fr`, gap 80px). Отличие: в плашке «Natijalar» **два** результата, `gap:10px`, размер 27px.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.07` | `Bo‘lim B · konsepsiya va reja` | рубрика | 228 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `scope.b.letter_big` | `B` | буква-акцент | 232 | Archivo 150px/600, lh 0.85, `#9A1D20` |
| `scope.b.title_full` | `Konsepsiya va reja yechimlari` | H2 | 233 | Newsreader 400, 52px, lh 1.15 |
| `scope.b.goal` | `Arxitektura-funksional konsepsiya foydalanish bosqichidagi samaradorlikni belgilaydi. Loyihalashdan oldin qat‘iylashtiriladi.` | цель | 234 | Archivo 28px, lh 1.5, `#6E6A66` |
| `scope.b.deliverables_label` | `Natijalar` | метка | 236 | Archivo 24px/700 ls 0.16em uppercase `#9A1D20` |
| `scope.b.deliverables[0]` | `Loyihalash uchun texnik topshiriq (PDF, DWG)` | результат 1 | 237 | Archivo 27px, lh 1.35 |
| `scope.b.deliverables[1]` | `Rangli kodlangan rejalar va maydonlar programmasi (Excel)` | результат 2 | 238 | Archivo 27px, lh 1.35 |
| `scope.b.activities[0]` | `Format, asosiy ustunlik (USP) va maqsadli auditoriya` | пункт | 242 | Archivo 27px |
| `scope.b.activities[1]` | `Oqimlar: tashrif buyuruvchi, xodim, yuk, avtoturargoh` | пункт | 243 | Archivo 27px |
| `scope.b.activities[2]` | `Tarkib: langar ijarachilar, galereya, F&B, ko‘ngilochar` (в HTML `F&amp;B`) | пункт | 244 | Archivo 27px |
| `scope.b.activities[3]` | `Rejani eskiz darajasida ishlab chiqish` | пункт | 245 | Archivo 27px |
| `scope.b.activities[4]` | `Qavatlar bo‘yicha zonalashtirish va navigatsiya` | пункт | 246 | Archivo 27px |
| `scope.b.activities[5]` | `Ijarachilarni joylashtirish mantig‘i` | пункт | 247 | Archivo 27px |
| `scope.b.activities[6]` | `Jalb qilish nuqtalarini joylashtirish` | пункт | 248 | Archivo 27px |
| `scope.b.activities[7]` | `Arxitektorlar uchun tavsiyalar va cheklovlar` | пункт | 249 | Archivo 27px |

**Деньги на слайде:** нет.

---

# СЛАЙД 08 - «08 Bo'lim C»

- `data-label="08 Bo'lim C"` (ASCII-апостроф), `data-screen-label="08"`, строки 254-295.

**data-speaker-notes (дословно):**
> C bo‘limi. Moliyaviy TEA - investor tili. Bu yerda 10-15 yillik gorizont va sezgirlik tahlili haqida gapiramiz.

**Стиль секции (стр. 254):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** те же две колонки `0.9fr 1.4fr; gap:80px`. Правая колонка **двухъярусная** (`flex-direction:column; gap:34px`):
- ярус 1 - список 6 пунктов в 2 колонки (`gap:0 48px`, 27px);
- ярус 2 - **KPI-таблица из 3 карточек**: `grid-template-columns:repeat(3,1fr); gap:2px; background:#DAD6D0; border:2px solid #14181B; margin-top:auto`; карточка `background:#FBFAF8; padding:26px 28px; gap:6px`.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.08` | `Bo‘lim C · moliyaviy TEA` | рубрика | 257 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `scope.c.letter_big` | `C` | буква-акцент | 261 | Archivo 150px/600, lh 0.85, `#9A1D20` |
| `scope.c.title_full` | `Moliyaviy texnik-iqtisodiy asoslash` | H2 | 262 | Newsreader 400, 52px, lh 1.15 |
| `scope.c.goal` | `Loyihaning moliyaviy barqarorligini 10-15 yillik gorizontda baholaymiz: prognoz daromad, xarajat va samaradorlik ko‘rsatkichlari.` | цель | 263 | Archivo 28px, lh 1.5, `#6E6A66` |
| `scope.c.deliverables_label` | `Natijalar` | метка | 265 | Archivo 24px/700 ls 0.16em uppercase `#9A1D20` |
| `scope.c.deliverables[0]` | `Moliyaviy model (Excel): daromad, xarajat, prognoz` | результат 1 | 266 | Archivo 27px |
| `scope.c.deliverables[1]` | `Xulosa va tavsiyalar bilan analitik hisobot (PDF)` | результат 2 | 267 | Archivo 27px |
| `scope.c.activities[0]` | `Daromad qismi: ijara, xizmat yig‘imi, sponsorlik` | пункт | 272 | Archivo 27px |
| `scope.c.activities[1]` | `Ijara modeli va rent-roll (Excel)` | пункт | 273 | Archivo 27px |
| `scope.c.activities[2]` | `OpEx: foydalanish, qo‘riqlash, energiya, zaxira` | пункт | 274 | Archivo 27px |
| `scope.c.activities[3]` | `Investitsiya baholovi va risklar ro‘yxati` | пункт | 275 | Archivo 27px |
| `scope.c.activities[4]` | `Sezgirlik tahlili va qoplanish muddati` | пункт | 276 | Archivo 27px |
| `scope.c.activities[5]` | `Xarajatlarni kamaytirish tavsiyalari` | пункт | 277 | Archivo 27px |
| `scope.c.kpi_01` | `NOI` / `operatsion sof daromad` | KPI-карточка | 281-282 | аббревиатура Archivo **54px**/600 `#9A1D20`; подпись Archivo 24px `#6E6A66` |
| `scope.c.kpi_02` | `IRR` / `ichki rentabellik darajasi` | KPI-карточка | 285-286 | то же |
| `scope.c.kpi_03` | `NPV` / `sof joriy qiymat` | KPI-карточка | 289-290 | то же |

**Деньги на слайде:** нет.

---

# СЛАЙД 09 - «09 Tariflar»

- `data-label="09 Tariflar"`, `data-screen-label="09"`, строки 297-364.

**data-speaker-notes (дословно, включая двойной пробел в оригинале после «slaydlarda.»):**
> Tariflar - narxsiz. Faqat hajm farqini ko‘rsatamiz va Commercial Concept ni tavsiya qilamiz. Narx keyingi slaydlarda.  Ikki izohni albatta aytib o‘tamiz: bozor tekshiruvi to‘liq tadqiqot emas, Commercial Concept esa investitsiya baholovini o‘z ichiga olmaydi.

**Стиль секции (стр. 297):** `background:#FBFAF8; …; padding:44px 112px` (**уменьшенные вертикальные отступы** - слайд самый плотный). Логотип в шапке - `width:160px` (везде ещё `190px`), `padding-bottom:16px`.

**Структура:** шапка → H2 (44px) → подзаголовок → **CSS-grid-таблица 5×10** → две сноски `*` и `**` → полоса «Individual hajm».

**Таблица (стр. 304-355):** `display:grid; grid-template-columns:1fr 200px 200px 220px 200px; font-family:Archivo; font-size:24px; border-top:3px solid #14181B`.
- Шапка: ячейки `padding:12px 12px; border-bottom:3px solid #14181B; text-align:center; font-weight:600`. Колонка «Commercial Concept» - `border-bottom:3px solid #9A1D20; font-weight:700; background:rgba(154,29,32,0.08)` + подпись `TAVSIYA` (24px, ls 0.1em, `#9A1D20`).
- Строки: первая ячейка `padding:7px 20px 7px 0`, остальные `padding:7px 12px; text-align:center`, `border-bottom:1px solid #DAD6D0`. `-` окрашен `#6E6A66`; ✓ в рекомендуемой колонке - `background:rgba(154,29,32,0.08); color:#9A1D20; font-weight:700`.

**Матрица (9 строк × 4 тарифа), дословно:**

| Natijalar va xizmatlar | Expert Review | Concept Support | Commercial Concept | Full Strategy | Стр. |
|---|---|---|---|---|---|
| `Ekspert tavsiyalari (tijorat va reja bo‘yicha)` | ✓ | ✓ | ✓ | ✓ | 310-314 |
| `Arxitektorlar uchun texnik topshiriq` | ✓ | ✓ | ✓ | ✓ | 315-319 |
| `CAD / Revit / 3D chizmalar bilan ish` | - | ✓ | ✓ | ✓ | 320-324 |
| `CASE bozor bazasi asosida bozor tekshiruvi *` | - | ✓ | ✓ | ✓ | 325-329 |
| `Merchandise mix byudjeti va ijara daromadi modeli (Excel)` | - | - | ✓ | ✓ | 330-334 |
| `Yakuniy tavsiyalar ** (tijorat va reja bo‘yicha)` | - | - | ✓ | ✓ | 335-339 |
| `To‘liq bozor tadqiqoti hisoboti` | - | - | - | ✓ | 340-344 |
| `10-15 yillik investitsiya baholovi` | - | - | - | ✓ | 345-349 |
| `To‘liq hisobot` | - | - | - | ✓ | 350-354 |

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.09` | `Xizmat tariflari` | рубрика | 300 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `tariffs.title` | `Xizmat tariflari` | H2 | 302 | Newsreader 400, **44px**, lh 1.1, `margin:18px 0 6px` |
| `tariffs.intro` | `Har bir keyingi tarif oldingisining barcha natijalarini o‘z ichiga oladi.` | подзаголовок | 303 | Archivo 26px, lh 1.4, `#6E6A66` |
| `tariffs.col_01` | `Expert Review` | заголовок колонки | 306 | Archivo 24px/600 |
| `tariffs.col_02` | `Concept Support` | заголовок колонки | 307 | Archivo 24px/600 |
| `tariffs.col_03` | `Commercial Concept` + `TAVSIYA` | заголовок рекомендуемой колонки | 308 | Archivo 24px/700; `TAVSIYA` 24px ls 0.1em `#9A1D20` |
| `tariffs.col_04` | `Full Strategy` | заголовок колонки | 309 | Archivo 24px/600 |
| `tariffs.footnote_market` | `* Mavjud bozor bazamiz va oldingi tadqiqot tajribamizdan foydalanamiz, ma‘lumotlarning bugungi holatga mosligini tekshiramiz, zarurat bo‘lsagina qo‘shimcha tadqiqot o‘tkazamiz. Alohida to‘liq bozor tadqiqoti hisoboti faqat Full Strategy tarifida tayyorlanadi.` | сноска * | 357 | Archivo 24px, lh 1.4, `#6E6A66`; звёздочка `#9A1D20; font-weight:700` |
| `tariffs.footnote_cc` | `** Commercial Concept zonalashtirish, merchandise mix, GLA taqsimoti va ijara daromadi salohiyatiga asoslangan tavsiyalarni qamrab oladi. To‘liq investitsiya baholovi, IRR, NPV, qoplanish muddati va yakuniy investitsiya qarori bunga kirmaydi.` | сноска ** | 358 | то же |
| `tariffs.t4_note_label` | `Individual hajm` | метка | 361 | Archivo 24px/700 ls 0.14em uppercase `#9A1D20`, `white-space:nowrap` |
| `tariffs.t4_note` | `Har qanday tarif tarkibi loyihaning o‘ziga xos vazifalariga moslashtirilishi mumkin - masalan faqat moliyaviy blok yoki bir necha ob‘ekt bo‘yicha portfel tahlili. Hajm va narx muhokamadan keyin alohida ilova bilan tasdiqlanadi.` | пояснение | 362 | Archivo 25px, lh 1.4, `#6E6A66`; блок `border-top:3px solid #14181B; padding-top:14px; gap:26px` |

**Деньги на слайде:** нет сумм. Слово `narx` встречается в тексте (стр. 362), но без цифр. Строка цен из A4 (`Narx, USD / 1 m² hisob-kitob maydoni` → 2,0 / [2,2] / 2,5 / 4,5) в деке **сознательно удалена** - это соответствует ТЗ и записке в notes.

---

# СЛАЙД 10 - «10 Muddatlar»

- `data-label="10 Muddatlar"`, `data-screen-label="10"`, строки 366-419.

**data-speaker-notes (дословно):**
> Muddatlar. Bosqichlar bizning ish tartibimiz bo‘yicha: hududni o‘rganish, initial chizma, draft chizma va moliya, final chizma va light report, final report. Jadval Full Strategy uchun.

**Стиль секции (стр. 366):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** шапка → H2 (56px) → подзаголовок → **диаграмма Ганта** → **4 карточки сроков** → замыкающая сноска (`margin:auto 0 0`).

**Гант (стр. 373-399):** `display:grid; grid-template-columns:520px repeat(14,1fr); font-family:Archivo; font-size:24px; align-items:center; row-gap:18px`.
- Заголовок первой колонки: `Bosqich / hafta` (`#6E6A66`, ls 0.12em, uppercase).
- Номера недель `1`…`14` - `text-align:center; color:#6E6A66`.
- Полосы: `height:36px`, красные `#9A1D20`, последняя - тёмная `#14181B`.

| Этап (дословно) | grid-column | Недели | Цвет полосы | Стр. |
|---|---|---|---|---|
| `Loyiha hududini o‘rganish` | `2 / 4` | 1-2 | `#9A1D20` | 389-390 |
| `Initial / Light chizma` | `4 / 6` | 3-4 | `#9A1D20` | 391-392 |
| `Draft chizma + Draft finance` | `6 / 10` | 5-8 | `#9A1D20` | 393-394 |
| `Final chizma + Final finance + Light report` | `10 / 14` | 9-12 | `#9A1D20` | 395-396 |
| `Final report` | `14 / 16` | 13-14 | `#14181B` | 397-398 |

Названия этапов: Archivo **27px**/600, lh 1.25, `padding-right:20px`.

**Карточки сроков (стр. 400-417):** `grid-template-columns:repeat(4,1fr); gap:2px; background:#DAD6D0; border:2px solid #14181B; margin-top:44px`; карточка `padding:24px 28px; gap:8px`.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.10` | `Ish bosqichlari va muddatlar` | рубрика | 369 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `timeline.title` | `Ish bosqichlari va muddatlar` | H2 | 371 | Newsreader 400, **56px**, lh 1.1, `margin:44px 0 8px` |
| `timeline.intro` | `Har bir bosqich yozma tasdiqlash bilan yopiladi va keyingisi shundan so‘ng boshlanadi.` | подзаголовок | 372 | Archivo 27px, lh 1.4, `#6E6A66` |
| `timeline.card_01` | `Expert Review` / `2-3 hafta` | карточка | 402-403 | метка Archivo 24px ls 0.1em uppercase `#6E6A66`; срок Archivo **36px**/600; фон `#FBFAF8` |
| `timeline.card_02` | `Concept Support` / `4-6 hafta` | карточка | 406-407 | то же |
| `timeline.card_03` | `Commercial Concept · tavsiya` / `7-10 hafta` | карточка (рекомендуемая) | 410-411 | фон `rgba(154,29,32,0.08)`; метка `#9A1D20`; срок Archivo 36px/**700** |
| `timeline.card_04` | `Full Strategy` / `10-14 hafta` | карточка | 414-415 | как card_01 |
| `timeline.note` | `Jadval Full Strategy tarifi uchun ko‘rsatilgan. Muddatlar boshlang‘ich ma‘lumotlarning to‘liqligi va kelishuvlar tezligiga bog‘liq.` | сноска | 418 | Archivo 26px, lh 1.45, `#6E6A66`, `margin:auto 0 0` |

**Деньги на слайде:** нет.

---

# СЛАЙД 11 - «11 Ma'lumotlar»

- `data-label="11 Ma'lumotlar"` (ASCII-апостроф), `data-screen-label="11"`, строки 421-450.

**data-speaker-notes (дословно):**
> Mijozdan kerak bo‘ladigan ma‘lumotlar. Bu slayd majburiyatni ikki tomonlama qiladi - muddat shu ro‘yxat kelgan kundan boshlanadi.

**Стиль секции (стр. 421):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** шапка → H2 (56px) → подзаголовок → **две колонки нумерованного списка** (`grid-template-columns:1fr 1fr; gap:0 80px; font-size:28px`; внутри каждой - `grid-template-columns:auto 1fr; column-gap:24px; border-top:3px solid #14181B`; строка `padding:22px 0; border-bottom:1px solid #DAD6D0`) → тёмная плашка «Eslatma» (`margin-top:auto; background:#14181B; color:#F7F5F2; padding:32px 38px; gap:30px`).

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.11` | `Ishni boshlash uchun` | рубрика | 424 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `inputs.title` | `Bizga kerak bo‘ladigan ma‘lumotlar` | H2 | 426 | Newsreader 400, **56px**, lh 1.1, `margin:48px 0 12px` |
| `inputs.intro` | `Muddat shu ro‘yxat to‘liq taqdim etilgan kundan boshlanadi.` | подзаголовок | 427 | Archivo 28px, lh 1.45, `#6E6A66` |
| `inputs.item_01` | `01` / `Topografik o‘lchov (geodeziya) va uchastka chegaralari` | пункт | 430-431 | номер Archivo `#9A1D20; font-weight:700`; текст 28px lh 1.35 |
| `inputs.item_02` | `02` / `Qavat rejalari va kesimlar (DWG / PDF)` | пункт | 432-433 | то же |
| `inputs.item_03` | `03` / `Bloklar bo‘yicha TIK: qavat va vazifasi bo‘yicha maydonlar` | пункт | 434-435 | то же |
| `inputs.item_04` | `04` / `Shaharsozlik cheklovlari va texnik shartlar` | пункт | 438-439 | то же |
| `inputs.item_05` | `05` / `Maqsadli muddatlar va byudjet mo‘ljallari` | пункт | 440-441 | то же |
| `inputs.item_06` | `06` / `Mavjud ijarachilar va majburiyatlar - ob‘ekt ishlayotgan bo‘lsa` | пункт | 442-443 | то же |
| `inputs.warning_label` | `Eslatma` | метка на плашке | 447 | Archivo 24px/700 ls 0.16em uppercase `#C8494D`, `white-space:nowrap` |
| `inputs.warning` | `Ma‘lumotlar to‘liq bo‘lmasa, muddat va yakuniy summa taxminiy hisoblanadi. Yetishmayotgan ma‘lumotni biz o‘z hisobimizdan to‘playmiz - bu vaqtga ta‘sir qiladi.` | предупреждение | 448 | Archivo 28px, lh 1.45, на `#14181B` |

**Деньги на слайде:** сумм нет; упоминается `yakuniy summa` без цифры.

---

# СЛАЙД 12 - «12 Narx» ← ОСНОВНОЙ ЦЕНОВОЙ СЛАЙД

- `data-label="12 Narx"`, `data-screen-label="12"`, строки 452-514.

**data-speaker-notes (дословно):**
> Narx. Formulani ko‘rsatamiz: maydon × stavka. Eng qimmatli qism - konsepsiya va chizmalar, shuning uchun narxning yarmi shunga to‘g‘ri keladi. Concept Support stavkasi narx-navo faylidan qo‘yiladi.

**Стиль секции (стр. 452):** `background:#14181B; color:#F7F5F2; font-family:Newsreader,Georgia,serif; box-sizing:border-box; padding:72px 112px; display:flex; flex-direction:column` - **второй тёмный слайд** после обложки.

**Структура:**
1. Шапка: логотип на белой подложке (`background:#fff; padding:12px 18px`, img `width:170px`), рубрика справа; `border-bottom:4px solid #9A1D20`.
2. H2 «Narx qanday hisoblanadi» (52px).
3. **Формула из трёх боксов** (`display:flex; align-items:stretch; gap:24px`): бокс `flex:1; border:2px solid rgba(247,245,242,0.3); padding:24px 28px` × ЗНАК × бокс `flex:1` = результат `flex:1.15; background:#9A1D20`.
4. Нота о минимальной сумме.
5. **Четыре тарифные карточки:** `grid-template-columns:repeat(4,1fr); gap:2px; background:rgba(247,245,242,0.2); border:2px solid rgba(247,245,242,0.3); margin-top:36px`; карточка `padding:26px 28px; gap:10px`.
6. **Полоса структуры цены:** `grid-template-columns:50fr 30fr 20fr; gap:4px` - ширина сегмента пропорциональна проценту.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.12` | `Xizmatlar narxi` | рубрика | 455 | Archivo 24px ls 0.18em uppercase `rgba(247,245,242,0.6)` |
| `price.title` | `Narx qanday hisoblanadi` | H2 | 457 | Newsreader 400, **52px**, lh 1.1, `margin:32px 0 28px` |
| `price.formula_area_label` | `Hisob-kitob maydoni` | метка бокса 1 | 460 | Archivo 24px ls 0.14em uppercase `rgba(247,245,242,0.55)` |
| `price.formula_area_value` | `18 400 m²` (число в подсвеченном span) | значение | 461 | Archivo **44px**/600; подсветка `rgba(200,73,77,0.22); padding:0 10px` |
| - | `×` | знак | 463 | 44px, `#C8494D` |
| `price.formula_rate_label` | `Tarif stavkasi` | метка бокса 2 | 465 | Archivo 24px ls 0.14em uppercase |
| `price.formula_rate_value` | `2,5 USD/m²` (число в подсвеченном span) | значение | 466 | Archivo 44px/600 |
| - | `=` | знак | 468 | 44px, `#C8494D` |
| `price.formula_total_label` | `Xizmat narxi` | метка результата | 470 | Archivo 24px ls 0.14em uppercase `rgba(255,255,255,0.85)`; фон бокса `#9A1D20` |
| `price.formula_total_value` | `$46 000` (число в подсвеченном span) | **итоговая цена** | 471 | Archivo **44px**/700 |
| `price.intro` (нота) | `Minimal summa - $5 000. Soliqlar kiritilmagan. Yakuniy summa hisob-kitob maydoni tasdiqlangandan so‘ng aniqlashtiriladi.` | нота | 474 | Archivo 25px, lh 1.45, `rgba(247,245,242,0.6)` |
| `price.rate_01` | `Expert Review` / `2,0 USD/m²` / `2-3 hafta` | карточка тарифа | 477-479 | метка Archivo 24px ls 0.12em uppercase `rgba(247,245,242,0.55)`; ставка Archivo **60px**/600 lh 1; суффикс `USD/m²` **26px**; срок 24px |
| `price.rate_02` | `Concept Support` / `2,2 USD/m²` / `4-6 hafta` - **значение `2,2` подсвечено как неподтверждённое** | карточка тарифа | 482-484 | ставка 60px/600 + подсветка `rgba(200,73,77,0.22); padding:0 10px` |
| `price.rate_03` | `Commercial Concept · tavsiya` / `2,5 USD/m²` / `7-10 hafta` | рекомендуемая карточка | 487-489 | фон `#9A1D20`; ставка Archivo 60px/**700**; суффикс 26px `rgba(255,255,255,0.8)` |
| `price.rate_04` | `Full Strategy` / `4,5 USD/m²` / `10-14 hafta` | карточка тарифа | 492-494 | как rate_01 |
| `price.split_label` | `Narx nimadan tashkil topadi` | метка полосы | 498 | Archivo 24px/700 ls 0.16em uppercase `#C8494D` |
| `price.split_01` | `50%` / `Konsepsiya va chizmalar - eng qimmatli qism` | сегмент 50fr | 501-502 | фон `#9A1D20`; % Archivo **34px**/700; текст 25px lh 1.3; `padding:20px 24px` |
| `price.split_02` | `30%` / `Moliyaviy model va ijara daromadi` | сегмент 30fr | 505-506 | фон `rgba(154,29,32,0.72)` |
| `price.split_03` | `20%` / `Texnik topshiriqlar` | сегмент 20fr | 509-510 | фон `rgba(154,29,32,0.45)` |

**Деньги на слайде:** `18 400 m²` (площадь), `2,5 USD/m²`, `$46 000`, `$5 000` (минимум), `2,0` / `2,2` / `2,5` / `4,5 USD/m²`, `50% / 30% / 20%`.

---

# СЛАЙД 13 - «13 Mualliflik nazorati» ← ЦЕНЫ ВНЕ ЦЕНОВОГО СЛАЙДА

- `data-label="13 Mualliflik nazorati"`, `data-screen-label="13"`, строки 516-562.

**data-speaker-notes (дословно):**
> Mualliflik nazorati - alohida oylik tarif. Konsepsiya topshirilgandan keyin loyihalash va qurilish davomida biz tijorat mantig‘ining buzilmasligini kuzatib boramiz. Tashrif limitlari va $80/soat qoidasini shu yerda aytamiz.

(Обратите внимание: **сумма `$80/soat` присутствует даже в тексте заметок докладчика**.)

**Стиль секции (стр. 516):** `background:#FBFAF8; …; padding:72px 112px`

**Структура:**
1. Шапка-раннер.
2. H2 «Mualliflik nazorati» (46px) + лид (`max-width:1500px`).
3. **Две ценовые карточки:** `grid-template-columns:1fr 1fr; gap:2px; background:#DAD6D0; border:2px solid #14181B`; карточка `padding:24px 34px; gap:8px`.
4. **Две колонки ниже:** `grid-template-columns:1fr 1fr; gap:56px; margin-top:24px; flex:1` - слева список «что входит», справа таблица визитов + мелкий текст.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.13` | `Mualliflik nazorati · alohida tarif` | рубрика | 519 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `supervision.title` | `Mualliflik nazorati` | H2 | 521 | Newsreader 400, **46px**, lh 1.1, `margin:24px 0 6px` |
| `supervision.intro` | `Konsepsiya topshirilgandan so‘ng loyihalash va qurilish bosqichida tijorat mantig‘i buzilmasligini kuzatib boramiz. Alohida oylik tarif bo‘yicha ishlaydi va istalgan asosiy tarifga qo‘shiladi.` | лид | 522 | Archivo 27px, lh 1.45, `#6E6A66`, `max-width:1500px` |
| `supervision.monthly_label` | `Oylik tarif` | метка карточки 1 | 525 | Archivo 24px ls 0.12em uppercase `#9A1D20`; фон карточки `rgba(154,29,32,0.08)` |
| `supervision.monthly_rate` | `2 500 USD/oy` (число в подсвеченном span) | **цена** | 526 | Archivo **64px**/700 lh 1; суффикс `USD/oy` **28px** `#6E6A66`; подсветка `rgba(154,29,32,0.14); padding:0 10px` |
| `supervision.monthly_note` | `Minimal muddat - 3 oy. Har oy hisobot va tavsiyalar bilan yopiladi.` | подпись | 527 | Archivo 25px, lh 1.35, `#6E6A66` |
| `supervision.hourly_label` | `Limitdan ortiq vaqt` | метка карточки 2 | 530 | Archivo 24px ls 0.12em uppercase `#6E6A66`; фон `#FBFAF8` |
| `supervision.hourly_rate` | `80 USD/soat` | **цена** | 531 | Archivo **64px**/600 lh 1; суффикс 28px `#6E6A66` |
| `supervision.hourly_note` | `Yo‘l, kutish, uchrashuv, taqdimot va qaytish vaqti shu hisobga kiradi.` | подпись | 532 | Archivo 25px, lh 1.35, `#6E6A66` |
| `supervision.included_label` | `Oylik tarifga nima kiradi` | метка колонки | 537 | Archivo 24px/700 ls 0.16em uppercase `#9A1D20` |
| `supervision.included[0]` | `Chizmalarni tijorat mantig‘iga muvofiqligini tekshirish` | пункт | 539 | Archivo 26px; `padding:10px 0; border-bottom:1px solid #DAD6D0` |
| `supervision.included[1]` | `Har oy 2 online uchrashuv va yozma tavsiyalar` | пункт | 540 | то же |
| `supervision.included[2]` | `O‘zgarishlar bo‘yicha qaror: GLA, zonalashtirish, oqimlar` | пункт | 541 | то же |
| `supervision.included[3]` | `Ijarachi talablarini loyihaga kiritish bo‘yicha maslahat` | пункт | 542 | то же |
| `visits.label` | `Tashrif tartibi` | метка колонки | 546 | Archivo 24px/700 ls 0.16em uppercase `#9A1D20` |
| `visits.row_01` | `Loyiha hududini o‘rganish` → `2 marta · 2 kun` | строка таблицы | 548-549 | grid `1fr auto`, Archivo 25px; `padding:9px 0; border-bottom:1px solid #DAD6D0`; правая ячейка `text-align:right; font-weight:600` |
| `visits.row_02` | `Initial / Light chizma` → `1 marta` | строка | 550-551 | то же |
| `visits.row_03` | `Draft chizma + Draft finance` → `1 marta` | строка | 552-553 | то же |
| `visits.row_04` | `Final chizma + finance + Light report` → `1 marta` | строка | 554-555 | то же |
| `visits.row_05` | `Hokimiyat vakillari uchun taqdimot` → `2 martagacha · 1 kun` | строка | 556-557 | то же |
| `visits.note` | `Toshkentdan tashqaridagi loyihalarda uchrashuvlar imkon qadar online. Offline tashrif faqat aniq maqsad, tasdiqlangan kun tartibi va mijoz tomonidan mas‘ul shaxs bo‘lganda. 1 kun = 24 soatgacha. Transport, mehmonxona va ovqatlanish shartnomaga muvofiq alohida qoplanadi.` | сноска | 559 | Archivo 24px, lh 1.4, `#6E6A66` |

**Деньги на слайде:** **ДА** - `2 500 USD/oy` (стр. 526) и `80 USD/soat` (стр. 531). Плюс `$80/soat` в `data-speaker-notes` (стр. 516).

---

# СЛАЙД 14 - «14 To'lov tartibi»

- `data-label="14 To'lov tartibi"` (ASCII-апостроф), `data-screen-label="14"`, строки 564-612.

**data-speaker-notes (дословно):**
> To‘lov va hisob-kitob maydoni. 40/30/30. Diagramma bilan nima hisobga kirishini ko‘rsatamiz - bu eng ko‘p savol tug‘diradigan joy.

**Стиль секции (стр. 564):** `background:#FBFAF8; …; padding:72px 112px`

**Структура:**
1. Шапка-раннер.
2. H2 «To‘lov tartibi» (52px) + **три колонки платежей** `grid-template-columns:40fr 30fr 30fr; gap:4px` (ширина пропорциональна доле). В каждой - цветная плашка `height:56px; padding:0 22px; font-size:32px; font-weight:700; color:#fff`.
3. H2 «Hisob-kitob maydoni: nima kiradi» (52px) + **две колонки** `grid-template-columns:1.1fr 1fr; gap:64px; flex:1`.
   - Слева - **диаграмма этажей**, 5 полос (`gap:5px`, `padding:14px 20px`, `font-size:26px`), метка этажа фиксированной ширины `width:74px`.
   - Справа - три текстовых абзаца (26px), последний `margin-top:auto`.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.14` | `To‘lov tartibi va hisob-kitob maydoni` | рубрика | 567 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `payment.title` | `To‘lov tartibi` | H2 | 569 | Newsreader 400, **52px**, lh 1.1, `margin:32px 0 32px` |
| `payment.tranche_01` | `40%` / `Boshlang‘ich to‘lov` / `Ish boshlanishida; taxminiy hisob-kitob maydoni bo‘yicha` | транш 1 | 572-574 | плашка `#9A1D20`, 32px/700; заголовок Archivo 28px/600; подпись 25px lh 1.4 `#6E6A66` |
| `payment.tranche_02` | `30%` / `Oraliq to‘lov` / `Draft chizma va Draft finance topshirilganda` | транш 2 | 577-579 | плашка `rgba(154,29,32,0.72)` |
| `payment.tranche_03` | `30%` / `Yakuniy to‘lov` / `Final report topshirilganda` | транш 3 | 582-584 | плашка `rgba(154,29,32,0.45)` |
| `price.calc_title` | `Hisob-kitob maydoni: nima kiradi` | H2 | 587 | Newsreader 400, 52px, lh 1.1, `margin:52px 0 28px` |
| `price.calc_floor_res` | `+4…` / `Turar-joy bloklari - kirmaydi` | полоса (исключено) | 591 | фон `repeating-linear-gradient(135deg,#EFECE8 0 8px,#FBFAF8 8px 16px)`, `border:1px solid #DAD6D0`, текст `#6E6A66` |
| `price.calc_floor_p3` | `+3` / `F&B va ko‘ngilochar zonalar` (в HTML `F&amp;B`) | полоса | 594 | фон `#9A1D20`, `color:#fff` |
| `price.calc_floor_p2` | `+2` / `Savdo galereyasi` | полоса | 597 | фон `#9A1D20` |
| `price.calc_floor_p1` | `+1` / `Langar ijarachilar, savdo, xizmat` | полоса | 600 | фон `#9A1D20` |
| `price.calc_floor_minus` | `−1/−2` / `Avtoturargoh, texnik xonalar, BoH` (минус - U+2212) | полоса | 603 | фон `rgba(154,29,32,0.6)` |
| `price.calc_included` | `Kiradi. Tijorat stilobati qurilish o‘lchamlari to‘liq hajmda; tijorat qismining yer osti avtoturargohi; turar-joy bloklari doirasidagi, aslida stilobatga tegishli o‘tish yo‘laklari, jamoat zallari va tijorat maydonlari; texnik xonalar, omborlar, BoH.` | что входит | 607 | Archivo 26px, lh 1.45; слово `Kiradi.` - `#9A1D20; font-weight:700` |
| `price.calc_excluded` | `Kirmaydi. Turar-joy zinapoya va liftlari, qabul zonasi bilan kirish zallari.` | что не входит | 608 | Archivo 26px, lh 1.45, `#6E6A66`; `Kirmaydi.` - `#14181B; font-weight:700` |
| `price.payment_note` | `Hisob-kitoblar AQSh dollarida. Taklif 30 kun amal qiladi. Ish hajmi 20% dan ko‘p o‘zgarsa, summa o‘zaro kelishuv bilan qayta ko‘rib chiqiladi.` | нота | 609 | Archivo 26px, lh 1.45, `#6E6A66`, `margin-top:auto` |

**Деньги на слайде:** абсолютных сумм нет. Есть доли `40% / 30% / 30%`, порог `20%`, упоминание валюты `AQSh dollarida` и срок `30 kun` - цифр в USD нет.

---

# СЛАЙД 15 - «15 Keyingi qadamlar»

- `data-label="15 Keyingi qadamlar"`, `data-screen-label="15"`, строки 614-646.

**data-speaker-notes (дословно):**
> Yakun. To‘rt qadamni aytib, birinchi qadamni bugun kelishishni taklif qilamiz.

**Стиль секции (стр. 614):** `background:#FBFAF8; …; padding:88px 112px`

**Структура:** шапка-раннер → H2 (60px) → **четыре колонки шагов** `grid-template-columns:repeat(4,1fr); gap:40px`, каждая `border-top:6px solid #9A1D20; padding-top:24px; gap:14px` → подвал (`margin-top:auto; border-top:4px solid #9A1D20; padding-top:34px; justify-content:space-between; align-items:flex-end`) с контактами слева и логотипом `width:260px` справа.

| block_key | Дословный текст | Роль | Стр. | Стили |
|---|---|---|---|---|
| `runner.15` | `Keyingi qadamlar` | рубрика | 617 | Archivo 24px ls 0.18em uppercase `#6E6A66` |
| `next_steps.title` | `Keyingi qadamlar` | H2 | 619 | Newsreader 400, **60px**, lh 1.1, `margin:52px 0 48px` |
| `next_steps.step_01` | `01` / `Tarifni tanlash va taklifni tasdiqlash` | шаг 1 | 622-623 | номер Archivo **64px**/600 lh 1 `#9A1D20`; текст Archivo 28px lh 1.4 |
| `next_steps.step_02` | `02` / `Shartnoma va hisob-kitob maydonini kelishish` | шаг 2 | 626-627 | то же |
| `next_steps.step_03` | `03` / `Ma‘lumotlar va boshlang‘ich to‘lov - ish boshlanadi` | шаг 3 | 630-631 | то же |
| `next_steps.step_04` | `04` / `Kirish uchrashuvi: jamoa va haftalik hisobot tartibi` | шаг 4 | 634-635 | то же |
| `contact.name` | `Aziz Shermuhamedov` | подпись | 640 | Archivo **34px**/700 |
| `contact.role` | `Asoschi, Bosh direktor · CASE Real Estate Advisory` | должность | 641 | Archivo 27px `#6E6A66` |
| `contact.block` | `Tel. +998 77 047 73 75 · support@caseadvisory.uz · www.caseadvisory.com` | контакты | 642 | Archivo 27px `#6E6A66` |

**Деньги на слайде:** **нет** - ни одной суммы.

---

# ЧАСТЬ 2. ГДЕ В ДЕКЕ ПОЯВЛЯЮТСЯ ЦЕНЫ И ДЕНЕЖНЫЕ СУММЫ

## 2.1 Требование ТЗ

Дословно из `prompts/CASE-OS-Offer-Builder-prompt.md`:

- строка 42: `- **16:9 presentation** (13 slides) - for meetings; prices only on the final slides.`
- строка 334: `  - `deck`: 13 slides, 1920×1080, prices only on the price slide + next-steps slide.`

Итого требование: **цены только на ценовом слайде и на слайде следующих шагов**; деку планировали в 13 слайдов.

## 2.2 Фактическая картина в шаблоне

| Слайд | Денежные суммы | Строки | Соответствует ТЗ? |
|---|---|---|---|
| 01 Muqova | нет | - | да |
| 02 Kirish | нет | - | да |
| **03 Tajriba** | **`$5` + ` mlrd+`** (объём инвестиций в портфеле) | 100 | **НЕТ** - сумма вне разрешённых слайдов |
| 04 Loyihani tushunish | нет | - | да |
| 05 Ish hajmi | нет | - | да |
| 06 Bo‘lim A | нет | - | да |
| 07 Bo‘lim B | нет | - | да |
| 08 Bo‘lim C | нет | - | да |
| 09 Tariflar | нет цифр; только слово `narx` в тексте (стр. 362) | 362 | да |
| 10 Muddatlar | нет | - | да |
| 11 Ma‘lumotlar | нет цифр; `yakuniy summa` без числа | 448 | да |
| **12 Narx** | `18 400 m²`; `2,5 USD/m²`; `$46 000`; `$5 000` (минимум); ставки `2,0` / `2,2` / `2,5` / `4,5 USD/m²`; доли `50% / 30% / 20%` | 461, 466, 471, 474, 478, 483, 488, 493, 501, 505, 509 | да - это и есть ценовой слайд |
| **13 Mualliflik nazorati** | **`2 500 USD/oy`** и **`80 USD/soat`**; плюс **`$80/soat` внутри `data-speaker-notes`** | 526, 531; 516 | **НЕТ** - прямое нарушение |
| 14 To‘lov tartibi | абсолютных сумм нет: `40% / 30% / 30%`, `20%`, `30 kun`, `Hisob-kitoblar AQSh dollarida` | 572, 577, 582, 609 | пограничный случай - валюта названа, суммы нет |
| **15 Keyingi qadamlar** | **нет ни одной суммы** | - | **НЕТ (наоборот)** - ТЗ явно разрешает цену на этом слайде, а её там нет |

## 2.3 Вывод

**Требование ТЗ не выполнено.** Нарушений три:

1. **Слайд 13 «Mualliflik nazorati»** - полноценный ценовой блок вне ценового слайда: две крупные цифры (64px) `2 500 USD/oy` и `80 USD/soat`. Это самое серьёзное расхождение: слайд оформлен как второй прайс.
2. **Слайд 03 «Tajriba»** - денежная сумма `$5 mlrd+` (76px). Формально это цифра компетенций, а не цена услуги; если трактовать ТЗ буквально («денежные суммы»), это нарушение, если по смыслу («цены на услуги») - допустимо. Нужно решение владельца ТЗ.
3. **Слайд 15 «Keyingi qadamlar»** - цен нет вообще, хотя ТЗ их там ожидает (`price slide + next-steps slide`). Либо ТЗ надо поправить, либо на 15-й слайд добавить строку с итоговой суммой/минимумом.

**Дополнительно:** ТЗ говорит про **13 слайдов** (строки 42 и 334) - в шаблоне их **15**. И `scratchpad.md:11` описывает совсем другую структуру («17 slides», иная палитра `#A67C2E`/`#F5F2EC`, шрифт Instrument Serif) - эта записка **не соответствует** ни ТЗ, ни фактическому файлу.

**Что уже сделано правильно:** из тарифной таблицы деки (слайд 09) удалена ценовая строка `Narx, USD / 1 m² hisob-kitob maydoni`, которая есть в A4 (`CASE Tijorat Taklifi A4.dc.html:267-271`). То есть намерение «тарифы без цен» реализовано - но обошли его слайдом 13.

---

# ЧАСТЬ 3. СОПОСТАВЛЕНИЕ БЛОКОВ ДЕКИ И A4-ДОКУМЕНТА

A4: 7 страниц (`data-screen-label`): `01 Muqova`, `02 Xat va tajriba`, `03 Ish hajmi`, `04 Tariflar`, `05 Muddat va narx`, `06 Nazorat va tashriflar`, `07 Shartlar va tasdiq`.

## 3.1 Карта соответствия страниц и слайдов

| A4-страница | Слайды деки | Комментарий |
|---|---|---|
| 01 Muqova | 01 Muqova | общие реквизиты; заголовки разные |
| 02 Xat va tajriba | 02 Kirish, 03 Tajriba, 04 Loyihani tushunish | A4-страница разложена на 3 слайда; сопроводительное письмо в деке **выброшено** |
| 03 Ish hajmi | 05, 06, 07, 08 | одна A4-страница → 4 слайда (обзор + A + B + C) |
| 04 Tariflar | 09 Tariflar | таблица та же минус строки цены и срока |
| 05 Muddat va narx | 10 Muddatlar, 12 Narx, 14 To‘lov tartibi | A4 сводит Гант + область расчёта + оплату + шаги на одну страницу |
| 06 Nazorat va tashriflar | 13 Mualliflik nazorati | сжатая версия |
| 07 Shartlar va tasdiq | **нет соответствия** | условия, требуемые данные (частично на 11) и подписи - только в A4 |
| - | 11 Ma‘lumotlar | в A4 этот список живёт внутри страницы 07 |
| - | 15 Keyingi qadamlar | в A4 «Keyingi qadamlar» - блок на странице 05 |

## 3.2 Тексты, СОВПАДАЮЩИЕ посимвольно (общий источник - один блок)

Проверено программно: **106 уникальных текстовых узлов совпадают побайтово**. Ключевые:

**Обложка / реквизиты:** `Tijorat ko‘chmas mulk` · `konsaltingi · 2017 dan` · `Tijorat taklifi` · `Loyiha nomi` · `Buyurtmachi` · `Kompaniya nomi` · `Joylashuv` · `Shahar, mamlakat` · `Sana` · `kun oy yil`

**Метрики:** `loyiha` · `mamlakat` · ` mln m²` · ` mlrd+` · ` yil+` · `jamoa tajribasi` (числа 89 / 8 / 8 / $5 / 50 тоже совпадают)

**Проекты:** `Margilon City Mall` · `Tashkent City Park` · `82 Mall / 82 Towers`

**Понимание проекта:** `Loyihani tushunishimiz` · `tijorat stilobati (+1…+3), turar-joy bloklari, yer osti avtoturargohi (−1…−2)` · `Tijorat qismining formatini va bozordagi o‘rnini aniqlash` · `Rejani ijaraga yaroqli va samarali holatga keltirish` · `Investitsiya qarori uchun moliyaviy asosni tayyorlash`

**Ish hajmi (частично):** `Bozor va raqobat muhiti` · `Konsepsiya va reja` · `Moliyaviy TEA` · `Natija` / `Natijalar` · `Makroiqtisodiy sharh va iste‘molchi tendensiyalari` · `Mavjud va rejalashtirilgan raqobatchilar tahlili` · `Potensial GLA va tashrif buyuruvchilar oqimi` · `Raqobatchilarning tenant-mix va to‘ldirilganligi` · `SWOT-tahlil va bozordagi o‘rni bo‘yicha tavsiyalar` · `Format, asosiy ustunlik (USP) va maqsadli auditoriya` · `Oqimlar: tashrif buyuruvchi, xodim, yuk, avtoturargoh` · `Rejani eskiz darajasida ishlab chiqish` · `Qavatlar bo‘yicha zonalashtirish va navigatsiya` · `Ijarachilarni joylashtirish mantig‘i` · `Arxitektorlar uchun tavsiyalar va cheklovlar` · `Ijara modeli va rent-roll (Excel)` · `Investitsiya baholovi va risklar ro‘yxati` · `Xarajatlarni kamaytirish tavsiyalari` · `Xulosa va tavsiyalar bilan analitik hisobot (PDF)`

**Тарифы - совпадает целиком, кроме двух строк:** `Xizmat tariflari` · `Natijalar va xizmatlar` · `Expert Review` · `Concept Support` · `Commercial Concept` · `TAVSIYA` · `Full Strategy` · все 9 строк матрицы · обе сноски `*` и `**` (посимвольно) · `Individual hajm` + её текст

**Сроки:** `Ish bosqichlari va muddatlar` · `Bosqich / hafta` · `Loyiha hududini o‘rganish` · `Initial / Light chizma` · `Draft chizma + Draft finance` · `Final report` · `2-3 hafta` · `4-6 hafta` · `7-10 hafta` · `10-14 hafta` · `Commercial Concept · tavsiya`

**Требуемые данные - все 6 пунктов совпадают дословно:** `Topografik o‘lchov (geodeziya) va uchastka chegaralari` · `Qavat rejalari va kesimlar (DWG / PDF)` · `Bloklar bo‘yicha TIK: qavat va vazifasi bo‘yicha maydonlar` · `Shaharsozlik cheklovlari va texnik shartlar` · `Maqsadli muddatlar va byudjet mo‘ljallari` · `Mavjud ijarachilar va majburiyatlar - ob‘ekt ishlayotgan bo‘lsa`

**Авторский надзор:** `Oylik tarif` · `2 500` · ` USD/oy` · `Minimal muddat - 3 oy. Har oy hisobot va tavsiyalar bilan yopiladi.` · `Limitdan ortiq vaqt` · ` USD/soat` (значение `80` тоже одинаковое) · `Yo‘l, kutish, uchrashuv, taqdimot va qaytish vaqti shu hisobga kiradi.` · `Ijarachi talablarini loyihaga kiritish bo‘yicha maslahat` · `Tashrif tartibi` · `1 marta` · `Final chizma + finance + Light report`

**Оплата и область расчёта:** `To‘lov tartibi` · `Boshlang‘ich to‘lov` · `Ish boshlanishida; taxminiy hisob-kitob maydoni bo‘yicha` · `Draft chizma va Draft finance topshirilganda` · `Final report topshirilganda` · `Hisob-kitob maydoni: nima kiradi` · `Turar-joy bloklari - kirmaydi` · `F&B va ko‘ngilochar zonalar` · `Savdo galereyasi` · `Langar ijarachilar, savdo, xizmat` · `Avtoturargoh, texnik xonalar, BoH`

**Финал:** `Keyingi qadamlar` · `Aziz Shermuhamedov` · `Asoschi, Bosh direktor · CASE Real Estate Advisory`

## 3.3 Тексты, УНИКАЛЬНЫЕ для деки (в A4 отсутствуют)

**Слайд 01:** `» majmuasi tijorat qismining konsepsiyasi` - в A4 другой заголовок: `» ko‘p funksiyali majmuasi uchun konsepsiya, reja yechimlari va moliyaviy TEA` (A4:36). **Расхождение источника `cover.title`.**

**Слайд 02 (целиком уникален):** `Kirish` · `Biz tijorat ko‘chmas mulkni` / `daromad keltiradigan aktivga` / `aylantiramiz` · `CASE Real Estate Advisory - O‘zbekiston va Markaziy Osiyoda tijorat ko‘chmas mulkiga ixtisoslashgan konsalting kompaniyasi. Biz loyihani qog‘ozdagi g‘oyadan ishlayotgan ob‘ektgacha kuzatib boramiz.` · `Konsepsiya va TEA` / `Format, reja, moliyaviy model` · `Ijara va brend jalb qilish` / `Langar ijarachilar, tenant-mix, shartlar` · `Ishga tushirish` / `Ochilishga tayyorgarlik, marketing, ishga tushirish` · `Boshqaruv` / `Aktivni boshqarish va daromadni o‘stirish` · `Ushbu taklif birinchi bosqichga tegishli: konsepsiya, reja yechimlari va moliyaviy asos.`

**Слайд 03:** `Tajribamizdan` · `umumiy maydon` (A4: `maydon`) · `investitsiya hajmi` (A4: `investitsiya`) · подписи проектов с добавленным типом работ: `Marg‘ilon, O‘zbekiston · 49 000 m² · konsepsiya va ijara` · `Toshkent, O‘zbekiston · 140 000 m² · tijorat konsepsiyasi` · `Dushanbe, Tojikiston · 58 000 m² · konsepsiya va TEA`. Метрика `7 yil+ / bozorda` из A4 в деке **отсутствует** (в деке 5 метрик вместо 6).

**Слайд 04:** `shahar` / `dagi ko‘p funksiyali majmua` (A4: `shahar, tuman` / `da joylashgan ko‘p funksiyali majmua`) · `Tarkibi:` · `Tijorat qismi majmuaning daromad markazi bo‘lishi kerak: …qat‘iylashtiriladi.` (в A4 вместо этого - `Taklif predmeti - tijorat qismining (savdo, xizmat, ko‘ngilochar, F&B) …ta‘minlaydi.`) · `Asosiy savol` · `Bu maydonlardan yiliga qancha va qanday tarkib bilan daromad olish mumkin?` · `Hal qiladigan uch vazifa`

**Слайд 05:** `Bajariladigan ishlar` · `Ish hajmi: uch bo‘lim, bir mantiq` · `Har bir bo‘lim keyingisining kirish ma‘lumotini beradi; natijalar alohida hujjatlar bilan topshiriladi.` · `Talab, savdo zonasi, raqobatchilar, SWOT` · `Format, zonalashtirish, tenant-mix, oqimlar` · `Ijara modeli, OpEx, NOI, IRR, NPV, risklar` · `· TT, rangli rejalar, maydonlar programmasi` · `· moliyaviy model (Excel) va hisobot`

**Слайды 06-08:** `Bo‘lim A · bozor va raqobat muhiti` · `Bozor va raqobat muhitini o‘rganish` · `Tadqiqot loyiha doirasidagi bozor nishalarini aniqlaydi…` · `Bozor va raqobat muhiti bo‘yicha hisobot (PDF)` (A4: `Bozor va raqobat muhiti hisoboti (PDF)` - **без `bo‘yicha`**) · `Demografiya, daromad darajasi, xarajat tarkibi` (A4: `…daromad darajasi va xarajat tarkibi`) · `Joylashuv, transport aloqalari, kirish-chiqish` (A4: `…va kirish-chiqishni baholash`) · `Savdo zonasi (catchment) va yo‘l vaqti hisobi` (A4: `…hisob-kitobi`) · `Bo‘lim B · konsepsiya va reja` · `Konsepsiya va reja yechimlari` · `Arxitektura-funksional konsepsiya foydalanish bosqichidagi samaradorlikni belgilaydi. Loyihalashdan oldin qat‘iylashtiriladi.` · `Loyihalash uchun texnik topshiriq (PDF, DWG)` · `Rangli kodlangan rejalar va maydonlar programmasi (Excel)` · `Tarkib: langar ijarachilar, galereya, F&B, ko‘ngilochar` (A4 добавляет `, supermarket`) · `Jalb qilish nuqtalarini joylashtirish` (**только в деке**) · `Bo‘lim C · moliyaviy TEA` · `Moliyaviy texnik-iqtisodiy asoslash` · `Loyihaning moliyaviy barqarorligini 10-15 yillik gorizontda baholaymiz: prognoz daromad, xarajat va samaradorlik ko‘rsatkichlari.` · `Moliyaviy model (Excel): daromad, xarajat, prognoz` · `Daromad qismi: ijara, xizmat yig‘imi, sponsorlik` · `OpEx: foydalanish, qo‘riqlash, energiya, zaxira` · `Sezgirlik tahlili va qoplanish muddati` · `operatsion sof daromad` / `ichki rentabellik darajasi` / `sof joriy qiymat` (KPI-подписи - только в деке)

**Слайд 09:** `Har bir keyingi tarif oldingisining barcha natijalarini o‘z ichiga oladi.` - в A4 к этой же фразе добавлено ` Commercial Concept - ishlanish chuqurligi bo‘yicha optimal variant.`

**Слайд 10:** `Har bir bosqich yozma tasdiqlash bilan yopiladi va keyingisi shundan so‘ng boshlanadi.` · `Final chizma + Final finance + Light report` (A4: `Final chizma + finance + Light report`) · `Jadval Full Strategy tarifi uchun ko‘rsatilgan. Muddatlar boshlang‘ich ma‘lumotlarning to‘liqligi va kelishuvlar tezligiga bog‘liq.`

**Слайд 11:** `Ishni boshlash uchun` · `Bizga kerak bo‘ladigan ma‘lumotlar` · `Muddat shu ro‘yxat to‘liq taqdim etilgan kundan boshlanadi.` · `Eslatma` · `Ma‘lumotlar to‘liq bo‘lmasa, muddat va yakuniy summa taxminiy hisoblanadi. Yetishmayotgan ma‘lumotni biz o‘z hisobimizdan to‘playmiz - bu vaqtga ta‘sir qiladi.`

**Слайд 12 (весь ценовой калькулятор уникален для деки):** `Xizmatlar narxi` · `Narx qanday hisoblanadi` · `Hisob-kitob maydoni` · `18 400` · `Tarif stavkasi` · ` USD/m²` · `Xizmat narxi` · `46 000` · `Minimal summa - $5 000. Soliqlar kiritilmagan. Yakuniy summa hisob-kitob maydoni tasdiqlangandan so‘ng aniqlashtiriladi.` · `Narx nimadan tashkil topadi` · `Konsepsiya va chizmalar - eng qimmatli qism` · `Moliyaviy model va ijara daromadi` · `Texnik topshiriqlar`

**Слайд 13:** `Mualliflik nazorati · alohida tarif` · `Mualliflik nazorati` · `Konsepsiya topshirilgandan so‘ng … Alohida oylik tarif bo‘yicha ishlaydi va istalgan asosiy tarifga qo‘shiladi.` (в A4: `… Istalgan asosiy tarifga qo‘shiladi va alohida hisob-kitob qilinadi.`) · `Oylik tarifga nima kiradi` · `Chizmalarni tijorat mantig‘iga muvofiqligini tekshirish` · `Har oy 2 online uchrashuv va yozma tavsiyalar` · `O‘zgarishlar bo‘yicha qaror: GLA, zonalashtirish, oqimlar` · `2 marta · 2 kun` · `Hokimiyat vakillari uchun taqdimot` · `2 martagacha · 1 kun` · сжатая сноска о визитах

**Слайд 14:** `To‘lov tartibi va hisob-kitob maydoni` · `Oraliq to‘lov` / `Yakuniy to‘lov` (A4: `Oraliq` / `Yakuniy`) · `−1/−2` (в A4 два отдельных этажа `−1` и `−2`) · `Kiradi.` / `Kirmaydi.` с точкой (A4 - без точки) · формулировка `…jamoat zallari…` (A4: `…jamoat xollari…`) · `Hisob-kitoblar AQSh dollarida. Taklif 30 kun amal qiladi. Ish hajmi 20% dan ko‘p o‘zgarsa, summa o‘zaro kelishuv bilan qayta ko‘rib chiqiladi.`

**Слайд 15:** `Tarifni tanlash va taklifni tasdiqlash` (A4: `…va taklifni imzolash bilan tasdiqlash`) · `Shartnoma va hisob-kitob maydonini kelishish` (A4: `Shartnoma tuzish va …`) · `Ma‘lumotlar va boshlang‘ich to‘lov - ish boshlanadi` (A4: `Boshlang‘ich ma‘lumotlar va boshlang‘ich to‘lov - ish shundan boshlanadi`) · `Kirish uchrashuvi: jamoa va haftalik hisobot tartibi` (A4: `Kirish uchrashuvi: jamoa, aloqa tartibi, haftalik hisobot`) · контактная строка с разделителями `·` (A4 использует `|`)

## 3.4 Тексты, УНИКАЛЬНЫЕ для A4 (в деке отсутствуют)

- **Всё сопроводительное письмо:** `Hamrohlik xati`, `Mavzu:`, `Hurmatli`, `F.I.Sh.`, `Hamkorlikka qiziqish bildirganingiz uchun…`, `Quyida loyihani tushunishimiz…`, `Hurmat bilan,`
- **Все внутренние подсказки `Yo‘riqnoma.`** (4 блока: A4:158, 246, 332, 550) - в деке их заменяют `data-speaker-notes`
- **Все `Maqsad.`-абзацы** (A4:181, 204, 228)
- **Строка цен в тарифной таблице:** `Narx, USD / 1 m² hisob-kitob maydoni` + `2,0` / `[2,2]` / `2,5` / `4,5` и строка `Orientir muddat` (A4:267-276)
- **Вся страница 07:** `Shartlar va qoidalar` - 5 условий (`Yuridik maslahatdan voz kechish.`, `Yakka hamkorlik.`, `Buyurtmachi vakili.`, `Ommaviylik.`, `Bekor qilish.`), `Buyurtmachining tasdig‘i` с подписями `«Case Advisory» MChJ` / `Shermuhamedov A. A.`, `Imzo va muhr`, `Taklif amal qilish muddati: yuborilgan kundan 30 kun.`
- **Полная таблица визитов** с колонками `Ish bosqichi` / `Online uchrashuv` / `Offline tashrif limiti`, значениями `Zaruratga ko‘ra`, `Moslashuvchan`, `E-versiya yoki bosma shaklda`, `Talab qilinmaydi`, `2 marta · har biri o‘rtacha 2 kun`, `2 martagacha · har biri 1 kun`, и четыре правила (`1 kun = 24 soatgacha.`, `$80/soat asosida hisoblanadi - yo‘lga chiqishdan qaytishgacha.`, `Transport, mehmonxona va ovqatlanish …`, `Tasdiqlash qoidasi. …`)
- **Метрика `7 yil+` / `bozorda`**, заголовок `Tanlangan loyihalar`
- **Этаж `−2` `Avtoturargoh - tijorat qismi`** отдельной полосой
- `Narx tanlangan tarifga ko‘ra 1 m² hisob-kitob maydoni uchun belgilanadi va buyurtmachi bilan kelishiladi.`
- `Individual hajm - kelishuv bo‘yicha` (буква D в подвале обложки A4)
- Колонтитул с номером страницы `01`…`07` и контактами на каждой странице

## 3.5 Практический вывод для «одного источника данных»

ТЗ требует: «Both must be generated from the *same* offer record - never maintained twice» (`prompts/CASE-OS-Offer-Builder-prompt.md:44`). Фактически из ~110 текстовых узлов деки **106 совпадают побайтово** с A4 - общий источник реален. Но есть **десять пар почти-одинаковых строк с микроразличиями**, которые нельзя развести одним `block_key` без варианта длины:

| Блок | Дека | A4 |
|---|---|---|
| `cover.title` | `» majmuasi tijorat qismining konsepsiyasi` | `» ko‘p funksiyali majmuasi uchun konsepsiya, reja yechimlari va moliyaviy TEA` |
| `stats.area` подпись | `umumiy maydon` | `maydon` |
| `stats.investment` подпись | `investitsiya hajmi` | `investitsiya` |
| `scope.a.deliverables[0]` | `Bozor va raqobat muhiti **bo‘yicha** hisobot (PDF)` | `Bozor va raqobat muhiti hisoboti (PDF)` |
| `scope.a.activities` (3 шт.) | сокращённые формулировки | развёрнутые (`…ni baholash`, `…hisob-kitobi`, `…va xarajat tarkibi`) |
| `scope.b.activities[2]` | `…F&B, ko‘ngilochar` | `…F&B, ko‘ngilochar, supermarket` |
| `tariffs.intro` | одна фраза | две фразы |
| `timeline` строка 4 | `Final chizma + **Final** finance + Light report` | `Final chizma + finance + Light report` |
| `payment.tranche_02/03` | `Oraliq to‘lov` / `Yakuniy to‘lov` | `Oraliq` / `Yakuniy` |
| `next_steps.step_01..04` | все четыре короче | все четыре длиннее |
| `price.calc_included` | `…jamoat **zallari**…` | `…jamoat **xollari**…` |

Последняя пара (`zallari` / `xollari`) - **вероятная опечатка**: один и тот же юридически значимый текст расходится в двух документах, которые клиент получает вместе.

Рекомендуемая модель: один `block_key` + поле `variant_label` (`deck_short` / `a4_full`), как уже предусмотрено в схеме ТЗ (`offer_blocks.variant_label`, `prompts/CASE-OS-Offer-Builder-prompt.md:120`).
