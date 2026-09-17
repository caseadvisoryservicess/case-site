# Инвентарь A4-оффера CASE Advisory (узбекский)

Источник: `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/CASE Tijorat Taklifi A4.dc.html` - 616 строк.
Сопутствующие файлы: `.../offer/doc-page.js` (веб-компонент `<doc-page>`), `.../offer/image-slot.js`, `.../offer/support.js`, `.../offer/assets/case-logo-color.png`.

Все узбекские тексты ниже приведены ДОСЛОВНО, посимвольно, с типографскими `‘` (U+2018).
HTML-сущности сохранены как в исходнике: `&amp;` = «&», `&nbsp;` = неразрывный пробел, `<br />` = перенос строки.

---

## 0. Общая конструкция документа

| Что | Значение | Строки |
|---|---|---|
| Корневой узел | `<x-dc>` → `<helmet>` → `<doc-page size="a4">` | 9, 10, 25 |
| Внешние шрифты | Google Fonts: `Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600` + `Archivo:wght@400;500;600;700`, `display=swap` | 13 |
| Подключаемые скрипты | `./support.js` (6), `./doc-page.js` (22), `./image-slot.js` (23) | 6, 22, 23 |
| Страниц | 7 `<section class="page" data-screen-label="…">` | 27, 77, 166, 254, 340, 472, 536 |
| Логика/props | `<script type="text/x-dc" data-dc-script>` с `class Component extends DCLogic` | 602-614 |

### Страницы (data-screen-label → строки)

| # | data-screen-label | Строки секции |
|---|---|---|
| 01 | `01 Muqova` | 27-75 |
| 02 | `02 Xat va tajriba` | 77-164 |
| 03 | `03 Ish hajmi` | 166-252 |
| 04 | `04 Tariflar` | 254-338 |
| 05 | `05 Muddat va narx` | 340-470 |
| 06 | `06 Nazorat va tashriflar` | 472-534 |
| 07 | `07 Shartlar va tasdiq` | 536-597 |

### Плейсхолдеры вида `{{ … }}`

Найдены ТОЛЬКО в атрибуте `style` тега `<doc-page>` (строка 25) - это подстановки движка DC, а не текст оффера:

```
--red: {{ red }}; --ph-bg: {{ phBg }}; --s: {{ s }}; --guide: {{ guide }}
```

Внутри страниц плейсхолдеров `{{ … }}` НЕ НАЙДЕНО. Заменяемые поля оформлены иначе - как span с подсветкой:
`<span style="background:var(--ph-bg,rgba(154,29,32,0.10));padding:0 5px">…</span>`. Их полный список - в разделе 9.

### props (редактируемые параметры), строка 602 + renderVals 603-613

| prop | editor | default | диапазон / options | секция | что задаёт |
|---|---|---|---|---|---|
| `showGuidance` | boolean | `true` | - | `Shakl` | `--guide` = `block` / `none` (блоки «Yo‘riqnoma») |
| `showPlaceholderTint` | boolean | `true` | - | `Shakl` | `--ph-bg` = `rgba(154,29,32,0.10)` / `transparent` |
| `textScale` | range | `1` | min 0.9, max 1.1, step 0.02 | `Shakl` | `--s` (множитель всех кеглей) |
| `brandRed` | color | `#9A1D20` | `#9A1D20`, `#7E1A1C`, `#14181B` | `Shakl` | `--red` |

---

## 1. Страница 01 - `01 Muqova` (обложка), строки 27-75

Структура секции (стр. 27): `box-sizing:border-box; background:var(--paper,#fff); color:var(--ink,#14181B); font-family:Newsreader,Georgia,serif; display:flex; flex-direction:column`.
Внутренний контейнер (стр. 28): `padding:52px 52px 0; display:flex; flex-direction:column; flex:1`.

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `cover.logo` | изображение | `src="assets/case-logo-color.png"`, `alt="CASE Real Estate Advisory"`, `width:206px;height:auto` | 30 |
| `cover.eyebrow` | подпись (Archivo, uppercase, ls 0.2em, lh 1.8, right) | `Tijorat ko‘chmas mulk<br />konsaltingi · 2017 dan` | 31 |
| `cover.rule_red` | структура | полоса `height:4px; background:var(--red,#9A1D20); margin-top:26px` | 33 |
| `cover.kicker` | подпись (Archivo 700, ls 0.26em, uppercase, red) | `Tijorat taklifi` | 35 |
| `cover.title` | заголовок H1 (Newsreader 400, `calc(40px * var(--s,1))`, lh 1.14, ls −0.01em, `text-wrap:pretty`) | `«Loyiha nomi» ko‘p funksiyali majmuasi uchun konsepsiya, reja yechimlari va moliyaviy TEA` - где `Loyiha nomi` обёрнут в плейсхолдер-span (`padding:0 6px`) | 36 |
| `cover.meta.client.label` | подпись | `Buyurtmachi` | 39 |
| `cover.meta.client.value` | подпись-плейсхолдер | `Kompaniya nomi` | 40 |
| `cover.meta.location.label` | подпись | `Joylashuv` | 43 |
| `cover.meta.location.value` | подпись-плейсхолдер | `Shahar, mamlakat` | 44 |
| `cover.meta.date.label` | подпись | `Sana` | 47 |
| `cover.meta.date.value` | подпись-плейсхолдер | `kun oy yil` | 48 |

Мета-строка: `display:grid; grid-template-columns:repeat(3,auto); gap:36px; justify-content:start; font-family:Archivo; margin-top:6px`; внутри каждой колонки `gap:6px`, значение - `font-size:var(--fs-small); padding:2px 6px`.
Обёртка титульного блока (стр. 34): `display:flex; flex-direction:column; gap:20px; margin-top:auto; padding-bottom:34px`.

### Тёмная полоса A/B/C/D (строки 53-70)

Контейнер: `background:var(--ink,#14181B); color:#fff; padding:22px 52px; display:grid; grid-template-columns:repeat(4,1fr); gap:20px; font-family:Archivo,sans-serif`.
Каждая ячейка: `border-top:2px solid var(--red,#9A1D20); padding-top:9px; gap:5px`; буква - `var(--fs-label)`, `ls 0.14em`, `color:rgba(255,255,255,0.5)`; текст - `var(--fs-small)`, `lh 1.35`.
**Исключение:** у колонки D верхняя граница `border-top:2px solid rgba(255,255,255,0.3)` (не красная).

| block_key | Буква | Дословный текст | Строка |
|---|---|---|---|
| `cover.band.a` | `A` | `Bozor va raqobat muhiti` | 55-56 |
| `cover.band.b` | `B` | `Konsepsiya va reja` | 59-60 |
| `cover.band.c` | `C` | `Moliyaviy TEA` | 63-64 |
| `cover.band.d` | `D` | `Individual hajm - kelishuv bo‘yicha` | 67-68 |

### Футер (строки 71-74)

Контейнер: `padding:14px 52px 20px; display:flex; justify-content:space-between; align-items:baseline; font-family:Archivo; font-size:var(--fs-label,10px); color:var(--muted,#6E6A66)`. Разделителя-линии здесь НЕТ (в отличие от стр. 02-06).

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `cover.footer.contacts` | подпись | `Tel. +998 77 047 73 75 &nbsp;\|&nbsp; support@caseadvisory.uz &nbsp;\|&nbsp; www.caseadvisory.com` | 72 |
| `cover.footer.pagenum` | номер страницы (`font-variant-numeric:tabular-nums`) | `01` | 73 |

---

## 2. Страница 02 - `02 Xat va tajriba`, строки 77-164

Секция: `padding:44px 52px 34px` (единый паттерн для стр. 02-07), flex-колонка.

### Шапка (78-81)
`display:flex; align-items:center; justify-content:space-between; padding-bottom:11px; border-bottom:2px solid var(--red,#9A1D20)`; логотип `width:118px`.

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `page.header.logo` | изображение | `assets/case-logo-color.png`, alt `CASE Real Estate Advisory`, 118px | 79 |
| `letter.header_label` | подпись (Archivo, ls 0.16em, uppercase, muted) | `Hamrohlik xati` | 80 |

### Текст письма

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `letter.subject` | абзац (Archivo, `--fs-small`, muted; `margin:20px 0 0`) | `Mavzu: «Loyiha nomi» majmuasining tijorat qismi bo‘yicha konsepsiya ishlab chiqish.` - «Mavzu:» = `font-weight:600;color:var(--ink)`, `Loyiha nomi` = плейсхолдер-span | 82 |
| `letter.salutation` | абзац (`--fs-body`, lh 1.55, `margin:16px 0 10px`) | `Hurmatli F.I.Sh.,` - `F.I.Sh.` = плейсхолдер-span | 83 |
| `letter.para_intro` | абзац (`--fs-body`, lh 1.55, `margin:0 0 9px`, `text-wrap:pretty`) | `Hamkorlikka qiziqish bildirganingiz uchun minnatdorchilik bildiramiz. CASE Real Estate Advisory - O‘zbekiston va Markaziy Osiyoda tijorat ko‘chmas mulkiga ixtisoslashgan konsalting kompaniyasi. Biz loyihalarni barcha bosqichlarda kuzatib boramiz: konsepsiya, ijara, ob‘ektni ishga tushirish va operatsion boshqaruv.` | 84 |
| `letter.para_scope` | абзац (`margin:0 0 14px`) | `Quyida loyihani tushunishimiz, ish hajmi, tanlash uchun to‘rt tarif, orientir muddatlar, narx va shartlar keltirilgan. Yakuniy hajmni mulkdorning ustuvor vazifalariga moslashtirishga tayyormiz.` | 85 |
| `letter.signature.name` | подпись (`--fs-body`, lh 1.4) | `Hurmat bilan, Aziz Shermuhamedov` - фамилия и имя в `font-weight:600` | 87 |
| `letter.signature.role` | подпись (Archivo, `--fs-small`, muted) | `Asoschi, Bosh direktor · CASE Real Estate Advisory` | 88 |

### Таблица показателей (строки 90-115)

Сетка: `display:grid; grid-template-columns:repeat(6,1fr); gap:1px; background:var(--rule,#DAD6D0); border:1px solid var(--rule,#DAD6D0); margin-top:22px; font-family:Archivo`.
Ячейка: `background:var(--paper,#fff); padding:12px 10px; gap:3px`; число - `var(--fs-num,25px)`, `font-weight:600`, `lh 1`, `color:var(--red)`; суффикс внутри числа - `var(--fs-small)`; подпись - `var(--fs-label)`, `ls 0.1em`, uppercase, muted.

| block_key | Число | Суффикс | Подпись (дословно) | Строки |
|---|---|---|---|---|
| `letter.stats.projects` | `89` | - | `loyiha` | 92-93 |
| `letter.stats.countries` | `8` | - | `mamlakat` | 96-97 |
| `letter.stats.area` | `8` | ` mln m²` | `maydon` | 100-101 |
| `letter.stats.investment` | `$5` | ` mlrd+` | `investitsiya` | 104-105 |
| `letter.stats.years` | `7` | ` yil+` | `bozorda` | 108-109 |
| `letter.stats.team` | `50` | ` yil+` | `jamoa tajribasi` | 112-113 |

### Избранные проекты (116-139)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `letter.projects.label` | подпись (Archivo 700, ls 0.18em, uppercase, muted, `margin:22px 0 10px`) | `Tanlangan loyihalar` | 116 |

Сетка: `repeat(3,1fr); gap:12px`. Каждая карточка: слот изображения `height:104px; background:var(--band,#F4F1EE)` + `<image-slot shape="rect">`.

| block_key | image-slot id / placeholder | Название | Подпись (дословно) | Строки |
|---|---|---|---|---|
| `letter.projects.1` | `proj-1` / `Margilon City Mall - foto` | `Margilon City Mall` | `Marg‘ilon, O‘zbekiston · 49 000 m²` | 119-122 |
| `letter.projects.2` | `proj-2` / `Tashkent City Park - foto` | `Tashkent City Park` | `Toshkent, O‘zbekiston · 140 000 m²` | 126-129 |
| `letter.projects.3` | `proj-3` / `82 Mall / 82 Towers - foto` | `82 Mall / 82 Towers` | `Dushanbe, Tojikiston · 58 000 m²` | 133-136 |

### Понимание проекта (140-156)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `letter.understanding.h2` | заголовок H2 (Newsreader 400, `--fs-h2`, lh 1.2, `margin:22px 0 12px`) | `Loyihani tushunishimiz` | 140 |
| `letter.understanding.para_object` | абзац | `Loyiha nomi - shahar, tumanda joylashgan ko‘p funksiyali majmua. Tarkibi: tijorat stilobati (+1…+3), turar-joy bloklari, yer osti avtoturargohi (−1…−2).` - три плейсхолдера: `Loyiha nomi`, `shahar, tuman` (суффикс `da` вне span), `tijorat stilobati (+1…+3), turar-joy bloklari, yer osti avtoturargohi (−1…−2)` | 141 |
| `letter.understanding.para_subject` | абзац (`margin:0 0 16px`) | `Taklif predmeti - tijorat qismining (savdo, xizmat, ko‘ngilochar, F&amp;B) tijorat jihatdan asoslangan konsepsiyasi va reja yechimlari; ular ijaraning likvidligini, barqaror tashrif buyuruvchilar oqimini va mulkdor daromadini ta‘minlaydi.` | 142 |

Три задачи - сетка `repeat(3,1fr); gap:14px; margin-bottom:18px`; каждая карточка `border-top:2px solid var(--ink,#14181B); padding-top:9px; gap:5px`; лейбл - Archivo 700, `--fs-label`, ls 0.14em, uppercase, red; текст - Archivo, `--fs-small`, lh 1.4, весь в плейсхолдер-span (`padding:0 4px`).

| block_key | Лейбл | Дословный текст задачи | Строки |
|---|---|---|---|
| `letter.tasks.01` | `Vazifa 01` | `Tijorat qismining formatini va bozordagi o‘rnini aniqlash` | 145-146 |
| `letter.tasks.02` | `Vazifa 02` | `Rejani ijaraga yaroqli va samarali holatga keltirish` | 149-150 |
| `letter.tasks.03` | `Vazifa 03` | `Investitsiya qarori uchun moliyaviy asosni tayyorlash` | 153-154 |

### Блок-инструкция (157-159)

Стиль: `display:var(--guide,block); border-left:3px solid var(--red,#9A1D20); background:var(--band,#F4F1EE); padding:11px 14px; margin:0 0 20px`.

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `letter.guide` | абзац-инструкция (Archivo, `--fs-small`, lh 1.45, muted) | `Yo‘riqnoma. Bu bo‘lim mijozning so‘zlari bilan emas, bizning tahlilimiz bilan yoziladi: ob‘ekt tarkibi, hozirgi holati, mulkdor maqsadi va biz hal qiladigan tijorat vazifasi. Uch vazifa - mijoz o‘qiydigan eng muhim uch qator.` - «Yo‘riqnoma.» = `font-weight:700; color:var(--red)` | 158 |

### Футер (160-163)
`margin-top:auto; padding-top:14px; border-top:1px solid var(--rule,#DAD6D0)`; текст - тот же `page.footer.contacts`; номер - `02`.

---

## 3. Страница 03 - `03 Ish hajmi`, строки 166-252

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `scope.header_label` | подпись шапки | `Ish hajmi va natijalar` | 169 |
| `scope.h2` | заголовок H2 (`margin:22px 0 4px`) | `Ish hajmi va natijalar` | 171 |
| `scope.lead` | абзац (`--fs-body`, lh 1.5, `margin:0 0 18px`) | `Uch bo‘lim ketma-ket bajariladi; har biri keyingisining kirish ma‘lumotini beradi.` | 172 |

Три колонки: `display:grid; grid-template-columns:repeat(3,1fr); gap:22px; flex:1` (стр. 173).
Каждая колонка: бейдж-квадрат `width:26px;height:26px;background:var(--red);color:#fff;` Archivo 700, `--fs-small`; заголовок Archivo 700, `--fs-h3`, lh 1.2; под ними разделитель `height:2px; background:var(--ink,#14181B)`; список - ряд span'ов `padding:6px 0; border-bottom:1px solid var(--rule)`, верх списка `border-top:1px solid var(--rule)`; блок «Natija/Natijalar» - `background:var(--band,#F4F1EE); padding:10px 12px; margin-top:auto; gap:4px`.

### Колонка A (175-196)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `scope.a.badge` | бейдж | `A` | 177 |
| `scope.a.title` | заголовок | `Bozor va raqobat muhiti` | 178 |
| `scope.a.goal` | абзац | `Maqsad. Konsepsiyaning faktik asosini qurish: bozor nishalari va kelgusi talab dinamikasi.` - «Maqsad.» = 700 + ink | 181 |
| `scope.a.item_01` | список | `Makroiqtisodiy sharh va iste‘molchi tendensiyalari` | 183 |
| `scope.a.item_02` | список | `Joylashuv, transport aloqalari va kirish-chiqishni baholash` | 184 |
| `scope.a.item_03` | список | `Mavjud va rejalashtirilgan raqobatchilar tahlili` | 185 |
| `scope.a.item_04` | список | `Raqobatchilarning tenant-mix va to‘ldirilganligi` | 186 |
| `scope.a.item_05` | список | `Demografiya, daromad darajasi va xarajat tarkibi` | 187 |
| `scope.a.item_06` | список | `Savdo zonasi (catchment) va yo‘l vaqti hisob-kitobi` | 188 |
| `scope.a.item_07` | список | `Potensial GLA va tashrif buyuruvchilar oqimi` | 189 |
| `scope.a.item_08` | список | `SWOT-tahlil va bozordagi o‘rni bo‘yicha tavsiyalar` | 190 |
| `scope.a.result_label` | подпись | `Natija` | 193 |
| `scope.a.result_01` | подпись | `Bozor va raqobat muhiti hisoboti (PDF)` | 194 |

### Колонка B (198-220)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `scope.b.badge` | бейдж | `B` | 200 |
| `scope.b.title` | заголовок | `Konsepsiya va reja` | 201 |
| `scope.b.goal` | абзац | `Maqsad. Arxitektura-funksional konsepsiya: foydalanish bosqichidagi samaradorlikni belgilaydi.` | 204 |
| `scope.b.item_01` | список | `Format, asosiy ustunlik (USP) va maqsadli auditoriya` | 206 |
| `scope.b.item_02` | список | `Tarkib: langar ijarachilar, galereya, F&amp;B, ko‘ngilochar, supermarket` | 207 |
| `scope.b.item_03` | список | `Qavatlar bo‘yicha zonalashtirish va navigatsiya` | 208 |
| `scope.b.item_04` | список | `Oqimlar: tashrif buyuruvchi, xodim, yuk, avtoturargoh` | 209 |
| `scope.b.item_05` | список | `Rejani eskiz darajasida ishlab chiqish` | 210 |
| `scope.b.item_06` | список | `Ijarachilarni joylashtirish mantig‘i` | 211 |
| `scope.b.item_07` | список | `Arxitektorlar uchun tavsiyalar va cheklovlar` | 212 |
| `scope.b.item_08` | список | `Loyihalash uchun texnik topshiriq` | 213 |
| `scope.b.result_label` | подпись | `Natijalar` | 216 |
| `scope.b.result_01` | подпись | `Texnik topshiriq (PDF, DWG) va og‘zaki taqdimot` | 217 |
| `scope.b.result_02` | подпись | `Konsepsiya va merchandayzing hisoboti: rangli rejalar (PDF/DWG) + maydonlar programmasi (Excel)` | 218 |

### Колонка C (222-242)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `scope.c.badge` | бейдж | `C` | 224 |
| `scope.c.title` | заголовок | `Moliyaviy TEA` | 225 |
| `scope.c.goal` | абзац | `Maqsad. Loyihaning moliyaviy barqarorligini 10-15 yillik gorizontda baholash.` | 228 |
| `scope.c.item_01` | список | `Daromad qismi: ijara, xizmat yig‘imi, sponsorlik, qo‘shimcha tijoratlashtirish` | 230 |
| `scope.c.item_02` | список | `OpEx: foydalanish, qo‘riqlash, tozalash, energiya, zaxira fondi` | 231 |
| `scope.c.item_03` | список | `Ijara modeli va rent-roll (Excel)` | 232 |
| `scope.c.item_04` | список | `NOI, IRR, NPV, qoplanish muddati, sezgirlik tahlili` | 233 |
| `scope.c.item_05` | список | `Investitsiya baholovi va risklar ro‘yxati` | 234 |
| `scope.c.item_06` | список | `Xarajatlarni kamaytirish tavsiyalari` | 235 |
| `scope.c.result_label` | подпись | `Natijalar` | 238 |
| `scope.c.result_01` | подпись | `Moliyaviy model (Excel): daromad, xarajat, yillar bo‘yicha prognoz` | 239 |
| `scope.c.result_02` | подпись | `Xulosa va tavsiyalar bilan analitik hisobot (PDF)` | 240 |

### Инструкция и футер

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `scope.guide` | абзац-инструкция (`margin-top:16px`) | `Yo‘riqnoma. A, B, C - doimiy tarkib. Loyihaga tegishli bo‘lmagan qatorni olib tashlang; yangi qator qo‘shishdan oldin uni tarif jadvali va narx bilan solishtirib tekshiring.` | 246 |
| `page.footer.contacts` / `scope.footer.pagenum` | футер (`margin-top:14px; padding-top:14px; border-top:1px solid var(--rule)`) | контакты + `03` | 248-251 |

---

## 4. Страница 04 - `04 Tariflar`, строки 254-338

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `tariffs.header_label` | подпись шапки | `Xizmat tariflari` | 257 |
| `tariffs.h2` | заголовок H2 (`margin:20px 0 4px`) | `Xizmat tariflari` | 259 |
| `tariffs.lead` | абзац (`--fs-body`, lh 1.45, `margin:0 0 14px`) | `Har bir keyingi tarif oldingisining barcha natijalarini o‘z ichiga oladi. Commercial Concept - ishlanish chuqurligi bo‘yicha optimal variant.` | 260 |

Полная таблица - в разделе 8 «Таблица тарифов».

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `tariffs.footnote_1` | сноска (Archivo, `--fs-small`, lh 1.4, muted) | `* Mavjud bozor bazamiz va oldingi tadqiqot tajribamizdan foydalanamiz, ma‘lumotlarning bugungi holatga mosligini tekshiramiz, zarurat bo‘lsagina qo‘shimcha tadqiqot o‘tkazamiz. Alohida to‘liq bozor tadqiqoti hisoboti faqat Full Strategy tarifida tayyorlanadi.` - знак `*` красный, 700 | 324 |
| `tariffs.footnote_2` | сноска | `** Commercial Concept zonalashtirish, merchandise mix, GLA taqsimoti va ijara daromadi salohiyatiga asoslangan tavsiyalarni qamrab oladi. To‘liq investitsiya baholovi, IRR, NPV, qoplanish muddati va yakuniy investitsiya qarori bunga kirmaydi.` - знак `**` красный, 700 | 325 |
| `tariffs.custom.label` | подпись (Archivo 700, ls 0.14em, uppercase, red, `white-space:nowrap`) | `Individual hajm` | 328 |
| `tariffs.custom.text` | абзац | `Har qanday tarif tarkibi loyihaning o‘ziga xos vazifalariga moslashtirilishi mumkin - masalan faqat moliyaviy blok yoki bir necha ob‘ekt bo‘yicha portfel tahlili. Hajm va narx muhokamadan keyin alohida ilova bilan tasdiqlanadi.` | 329 |
| `tariffs.guide` | абзац-инструкция | `Yo‘riqnoma. Stavkalar narx-navo faylidan (Excel) olinadi; kvadrat qavsdagi qiymat tasdiqlanmagan. Minimal summa - $5 000. Tarif nomlarini o‘zgartirmang: shartnoma va CASE OS shu nomlar bilan bog‘langan.` | 332 |
| `tariffs.footer.pagenum` | номер | `04` | 336 |

Структурные детали:
- Сноски - сетка `repeat(2,1fr)`… точнее `grid-template-columns:1fr 1fr; gap:22px; margin-top:14px` (стр. 323).
- Блок «Individual hajm» - `display:flex; gap:18px; align-items:flex-start; margin-top:14px; border-top:2px solid var(--ink,#14181B); padding-top:12px` (стр. 327).
- Инструкция - `margin-top:12px`; футер - `margin-top:auto; padding-top:14px; border-top:1px solid var(--rule)` (стр. 334).

---

## 5. Страница 05 - `05 Muddat va narx`, строки 340-470

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `schedule.header_label` | подпись шапки | `Bosqichlar, narx va to‘lov` | 343 |
| `schedule.h2` | заголовок H2 (`margin:20px 0 12px`) | `Ish bosqichlari va muddatlar` | 345 |

### Диаграмма Ганта (346-372)

Сетка: `display:grid; grid-template-columns:236px repeat(14,1fr); font-family:Archivo; font-size:var(--fs-label,10px); align-items:center; row-gap:7px`.
Шапка: `Bosqich / hafta` (muted, ls 0.1em, uppercase) + номера недель `1`…`14` (по центру, `tabular-nums`, muted), строки 347-361.
Подписи этапов: `grid-column:1; font-size:var(--fs-small); font-weight:600; padding-right:12px; line-height:1.25`. Полосы: `height:15px`.

| block_key | Дословный текст этапа | grid-column полосы | Недели | Цвет полосы | Строки |
|---|---|---|---|---|---|
| `schedule.gantt.row_01` | `Loyiha hududini o‘rganish` | `2 / 4` | 1-2 | `var(--red,#9A1D20)` | 362-363 |
| `schedule.gantt.row_02` | `Initial / Light chizma` | `4 / 6` | 3-4 | `var(--red,#9A1D20)` | 364-365 |
| `schedule.gantt.row_03` | `Draft chizma + Draft finance` | `6 / 10` | 5-8 | `var(--red,#9A1D20)` | 366-367 |
| `schedule.gantt.row_04` | `Final chizma + finance + Light report` | `10 / 14` | 9-12 | `var(--red,#9A1D20)` | 368-369 |
| `schedule.gantt.row_05` | `Final report` | `14 / 16` | 13-14 | `var(--ink,#14181B)` | 370-371 |

### Карточки сроков по тарифам (373-390)

Сетка: `repeat(4,1fr); gap:1px; background:var(--rule); border:1px solid var(--rule); margin-top:16px`. Ячейка: `padding:10px 12px; gap:2px`; лейбл - `--fs-label`, ls 0.12em, uppercase, lh 1.3; срок - `--fs-small`, `font-weight:600`.

| block_key | Лейбл (дословно) | Срок (дословно) | Особое | Строки |
|---|---|---|---|---|
| `schedule.terms.expert` | `Expert Review` | `2-3 hafta` | - | 375-376 |
| `schedule.terms.concept_support` | `Concept Support` | `4-6 hafta` | - | 379-380 |
| `schedule.terms.commercial` | `Commercial Concept · tavsiya` | `7-10 hafta` | фон `rgba(154,29,32,0.07)`, лейбл красный, срок `font-weight:700` | 383-384 |
| `schedule.terms.full` | `Full Strategy` | `10-14 hafta` | - | 387-388 |

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `schedule.note` | абзац (Archivo, `--fs-small`, lh 1.45, muted, `margin:10px 0 0`) | `Jadval Full Strategy tarifi uchun ko‘rsatilgan. Har bir bosqich yozma tasdiqlash bilan yopiladi. Muddatlar boshlang‘ich ma‘lumotlarning to‘liqligi va kelishuvlar tezligiga bog‘liq.` | 391 |

### Расчётная площадь (392-427)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `area.h2` | заголовок H2 (`margin:26px 0 10px`) | `Hisob-kitob maydoni: nima kiradi` | 392 |

Сетка блока: `grid-template-columns:1.15fr 1fr; gap:24px; align-items:start` (стр. 393).
Стопка этажей (394-419): `flex-direction:column; gap:3px; font-family:Archivo; font-size:var(--fs-small)`; каждая строка `display:flex; align-items:center; gap:10px; padding:7px 10px`, номер этажа в `width:34px; font-variant-numeric:tabular-nums`.

| block_key | Отметка этажа | Дословный текст | Фон / стиль | Строка |
|---|---|---|---|---|
| `area.stack.plus4` | `+4…` | `Turar-joy bloklari - kirmaydi` | `repeating-linear-gradient(135deg,#EFECE8 0 5px,#fff 5px 10px)`, `border:1px solid var(--rule,#DAD6D0)`, текст muted | 395-397 |
| `area.stack.plus3` | `+3` | `F&amp;B va ko‘ngilochar zonalar` | `background:var(--red,#9A1D20); color:#fff` | 399-401 |
| `area.stack.plus2` | `+2` | `Savdo galereyasi` | `background:var(--red,#9A1D20); color:#fff` | 403-405 |
| `area.stack.plus1` | `+1` | `Langar ijarachilar, savdo, xizmat` | `background:var(--red,#9A1D20); color:#fff` | 407-409 |
| `area.stack.minus1` | `−1` | `Avtoturargoh, texnik xonalar, BoH` | `background:rgba(154,29,32,0.55); color:#fff` | 411-413 |
| `area.stack.minus2` | `−2` | `Avtoturargoh - tijorat qismi` | `background:rgba(154,29,32,0.55); color:#fff` | 415-417 |

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `area.price_note` | абзац (`--fs-body`, lh 1.5) | `Narx tanlangan tarifga ko‘ra 1 m² hisob-kitob maydoni uchun belgilanadi va buyurtmachi bilan kelishiladi.` | 421 |
| `area.included` | список-строка (Archivo, `--fs-small`, lh 1.4) | `Kiradi tijorat stilobati qurilish o‘lchamlari to‘liq hajmda; tijorat qismining yer osti avtoturargohi; turar-joy bloklari doirasidagi, aslida stilobatga tegishli o‘tish yo‘laklari, jamoat xollari va tijorat maydonlari; texnik xonalar, omborlar, BoH.` - слово `Kiradi` = red + 700 | 423 |
| `area.excluded` | список-строка (muted) | `Kirmaydi turar-joy zinapoya va liftlari: zinapoyalar, lift shaxtalari va qabul zonasi bilan kirish zallari.` - слово `Kirmaydi` = 700, `white-space:nowrap` | 424 |

### Порядок оплаты (428-446)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `payment.h2` | заголовок H2 (`margin:24px 0 10px`) | `To‘lov tartibi` | 428 |

Сетка: `grid-template-columns:40fr 30fr 30fr; gap:3px; font-family:Archivo` (стр. 429). Плашка процента: `height:26px; padding:0 10px; font-size:var(--fs-small); font-weight:700; color:#fff`.

| block_key | % | Заголовок (дословно) | Пояснение (дословно) | Цвет плашки | Строки |
|---|---|---|---|---|---|
| `payment.stage_1` | `40%` | `Boshlang‘ich to‘lov` | `Ish boshlanishida; taxminiy hisob-kitob maydoni bo‘yicha` | `var(--red,#9A1D20)` | 431-433 |
| `payment.stage_2` | `30%` | `Oraliq` | `Draft chizma va Draft finance topshirilganda` | `rgba(154,29,32,0.72)` | 436-438 |
| `payment.stage_3` | `30%` | `Yakuniy` | `Final report topshirilganda` | `rgba(154,29,32,0.45)` | 441-443 |

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `payment.note` | абзац (Archivo, `--fs-small`, lh 1.45, muted, `margin:10px 0 0`) | `Hisob-kitoblar AQSh dollarida; narx soliqlarni o‘z ichiga olmaydi. Yakuniy summa reja tasdiqlangandan so‘ng aniqlashtiriladi. Ish hajmi yoki muddatlar o‘zgarsa, summalar o‘zaro kelishuv bilan qayta ko‘rib chiqiladi.` | 446 |

### Следующие шаги (447-465)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `next.h2` | заголовок H2 (`margin:24px 0 12px`) | `Keyingi qadamlar` | 447 |

Сетка: `repeat(4,1fr); gap:14px`; карточка - `border-top:2px solid var(--red,#9A1D20); padding-top:9px; gap:5px`; номер - Archivo, `--fs-num`, 600, lh 1, red; текст - Archivo, `--fs-small`, lh 1.4.

| block_key | Номер | Дословный текст | Строки |
|---|---|---|---|
| `next.step_01` | `01` | `Tarifni tanlash va taklifni imzolash bilan tasdiqlash` | 450-451 |
| `next.step_02` | `02` | `Shartnoma tuzish va hisob-kitob maydonini kelishish` | 454-455 |
| `next.step_03` | `03` | `Boshlang‘ich ma‘lumotlar va boshlang‘ich to‘lov - ish shundan boshlanadi` | 458-459 |
| `next.step_04` | `04` | `Kirish uchrashuvi: jamoa, aloqa tartibi, haftalik hisobot` | 462-463 |

Футер: контакты + `05` (строки 466-469).

---

## 6. Страница 06 - `06 Nazorat va tashriflar`, строки 472-534

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `supervision.header_label` | подпись шапки | `Mualliflik nazorati va tashrif tartibi` | 475 |
| `supervision.h2` | заголовок H2 (`margin:20px 0 6px`) | `Mualliflik nazorati - alohida oylik tarif` | 477 |
| `supervision.lead` | абзац (`--fs-body`, lh 1.5, `margin:0 0 14px`, `text-wrap:pretty`) | `Konsepsiya topshirilgandan so‘ng loyihalash va qurilish bosqichida tijorat mantig‘i buzilmasligini kuzatib boramiz. Istalgan asosiy tarifga qo‘shiladi va alohida hisob-kitob qilinadi.` | 478 |

### Две ценовые карточки (479-490)

Сетка: `grid-template-columns:1fr 1fr; gap:1px; background:var(--rule); border:1px solid var(--rule); font-family:Archivo`; ячейка `padding:14px 16px; gap:4px`.

| block_key | Лейбл | Значение | Суффикс | Примечание (дословно) | Строки |
|---|---|---|---|---|---|
| `supervision.rate.monthly` | `Oylik tarif` (red, ls 0.12em, uppercase) | `2 500` - **плейсхолдер-span** `--fs-num`, 700 | ` USD/oy` (`--fs-small`, muted) | `Minimal muddat - 3 oy. Har oy hisobot va tavsiyalar bilan yopiladi.` | 480-483 |
| `supervision.rate.overtime` | `Limitdan ortiq vaqt` (muted) | `80` (`--fs-num`, 600) | ` USD/soat` | `Yo‘l, kutish, uchrashuv, taqdimot va qaytish vaqti shu hisobga kiradi.` | 485-488 |

Фон карточки «Oylik tarif» - `rgba(154,29,32,0.07)`; второй - `var(--paper,#fff)`.

### Нумерованный список входящего (491-498)

Сетка: `grid-template-columns:auto 1fr; column-gap:14px; margin-top:14px; border-top:1px solid var(--rule)`; номера - red, 700; строки `padding:8px 0; border-bottom:1px solid var(--rule); line-height:1.35`.

| block_key | № | Дословный текст | Строки |
|---|---|---|---|
| `supervision.item_01` | `01` | `Chizmalarni tijorat mantig‘iga muvofiqligini tekshirish va yozma tavsiyalar` | 492-493 |
| `supervision.item_02` | `02` | `Har oy 2 online uchrashuv va o‘zgarishlar bo‘yicha qarorlar (GLA, zonalashtirish, oqimlar)` | 494-495 |
| `supervision.item_03` | `03` | `Ijarachi talablarini loyihaga kiritish bo‘yicha maslahat` | 496-497 |

### Порядок визитов (499-523)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `visits.h2` | заголовок H2 (`margin:22px 0 6px`) | `Tashrif tartibi` | 499 |
| `visits.lead` | абзац | `Toshkentdan tashqaridagi loyihalarda barcha ishchi uchrashuvlar imkon qadar online shaklda o‘tkaziladi. Offline tashrif faqat aniq maqsad, tasdiqlangan kun tartibi va mijoz tomonidan mas‘ul shaxs mavjud bo‘lganda amalga oshiriladi.` | 500 |

Таблица: `display:grid; grid-template-columns:1.5fr 1fr 1.3fr; font-family:Archivo; font-size:var(--fs-small); border-top:2px solid var(--ink,#14181B)`.
Шапка (`font-weight:700`), строки - `padding:9px 10px 9px 0` / `9px 10px` / `9px 0 9px 10px`, все с `border-bottom:1px solid var(--rule)`; 3-я колонка `font-weight:600`, 2-я колонка `color:var(--muted)`.

| block_key | Ish bosqichi | Online uchrashuv | Offline tashrif limiti | Строки |
|---|---|---|---|---|
| `visits.head` | `Ish bosqichi` | `Online uchrashuv` | `Offline tashrif limiti` | 502-504 |
| `visits.row_01` | `Loyiha hududini o‘rganish` | `Zaruratga ko‘ra` | `2 marta · har biri o‘rtacha 2 kun` | 505-507 |
| `visits.row_02` | `Initial / Light chizma` | `Moslashuvchan` | `1 marta` | 508-510 |
| `visits.row_03` | `Draft chizma + Draft finance` | `Moslashuvchan` | `1 marta` | 511-513 |
| `visits.row_04` | `Final chizma + finance + Light report` | `1 marta` | `1 marta` | 514-516 |
| `visits.row_05` | `Final report` | `E-versiya yoki bosma shaklda` | `Talab qilinmaydi` | 517-519 |
| `visits.row_06` | `Hokimiyat / davlat vakillari uchun taqdimot` | `Zaruratga ko‘ra` | `2 martagacha · har biri 1 kun` | 520-522 |

### Примечания к визитам (524-529)

Контейнер: `flex-direction:column; gap:5px; margin-top:12px; font-family:Archivo; font-size:var(--fs-small); color:var(--muted)`; в каждой строке первая часть - `font-weight:700; color:var(--ink,#14181B)`.

| block_key | Дословный текст | Строка |
|---|---|---|
| `visits.note_01` | `1 kun = 24 soatgacha. Yo‘l, kutish, uchrashuv, taqdimot va qaytish vaqti shu hisobga kiradi.` | 525 |
| `visits.note_02` | `Limitdan ortiq har qanday vaqt yoki qo‘shimcha tashrif $80/soat asosida hisoblanadi - yo‘lga chiqishdan qaytishgacha.` | 526 |
| `visits.note_03` | `Transport, mehmonxona va ovqatlanish hamda boshqa safar xarajatlari shartnomaga muvofiq alohida qoplanadi.` | 527 |
| `visits.note_04` | `Tasdiqlash qoidasi. Har bir tashrifdan oldin maqsad, kun tartibi, sana-vaqt, ishtirokchilar ro‘yxati va mijoz tomonidan mas‘ul shaxs yozma tasdiqlanadi.` | 528 |

Футер: контакты + `06` (строки 530-533).

---

## 7. Страница 07 - `07 Shartlar va tasdiq`, строки 536-597

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `terms.header_label` | подпись шапки | `Shartlar, qadamlar va tasdiqlash` | 539 |
| `terms.h2` | заголовок H2 (`margin:22px 0 12px`) | `Shartlar va qoidalar` | 541 |

Сетка условий: `grid-template-columns:1fr 1fr; gap:10px 26px; font-size:var(--fs-small,11.8px)` (стр. 542). У каждого пункта заголовок - `font-weight:600; font-family:Archivo`, тело - Newsreader, `lh 1.45`.

| block_key | Заголовок пункта | Дословный полный текст | Строка |
|---|---|---|---|
| `terms.item_disclaimer` | `Yuridik maslahatdan voz kechish.` | `Yuridik maslahatdan voz kechish. CASE xizmatlari bizning bilim va tajribamizga asoslangan tijorat maslahatlarini qamrab oladi; CASE yuridik maslahat bermaydi.` | 543 |
| `terms.item_exclusivity` | `Yakka hamkorlik.` | `Yakka hamkorlik. Buyurtmachi CASE xizmatlariga o‘xshash yoki CASE manfaatlariga zid keladigan kelishuvlarni uchinchi tomonlar bilan tuzmaslikni o‘z zimmasiga oladi.` | 544 |
| `terms.item_representative` | `Buyurtmachi vakili.` | `Buyurtmachi vakili. Buyurtmachi CASE bilan bog‘lovchi bo‘g‘in sifatida ish yuritadigan vakolatli vakilni tayinlaydi.` | 545 |
| `terms.item_publicity` | `Ommaviylik.` | `Ommaviylik. CASE loyiha tasvirlaridan foydalanish va marketing materiallarida maslahatchi sifatida ko‘rsatilish huquqini saqlab qoladi.` | 546 |
| `terms.item_termination` | `Bekor qilish.` (занимает всю ширину: `grid-column:1 / -1`) | `Bekor qilish. Kelishuv har qanday tomon tomonidan buzilishlarni bartaraf etish uchun o‘n (10) kun oldin yozma xabar berish yo‘li bilan bekor qilinishi mumkin. Bekor qilish tomonlar o‘z majburiyatlarini, shu jumladan barcha to‘lovlarni bajarmaguncha kuchga kirmaydi.` | 547 |

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `terms.guide` | абзац-инструкция (`margin-top:14px`) | `Yo‘riqnoma. Beshta shart o‘zgarmas. Loyihaga xos qo‘shimcha shart (mahalliy arxitektor hamrohligi, safar xarajatlari, ekspertizani kuzatib borish) oxirgi band sifatida qo‘shiladi va boshqaruvchi hamkor bilan kelishiladi. Mijozga yuborishdan oldin barcha yo‘riqnomalarni o‘chiring.` | 550 |

### Требуемые исходные данные (552-572)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `input.h2` | заголовок H2 (`margin:0 0 6px`) | `Talab qilinadigan boshlang‘ich ma‘lumotlar` | 552 |
| `input.lead` | абзац (`--fs-body`, lh 1.5, `margin:0 0 12px`) | `Ishni boshlash va hisob-kitoblarning aniqligi uchun quyidagilar zarur.` | 553 |

Две колонки: `grid-template-columns:1fr 1fr; column-gap:28px`; внутри каждой - `grid-template-columns:auto 1fr; column-gap:12px; border-top:1px solid var(--ink,#14181B)`; номера - red, `tabular-nums`.

| block_key | № | Дословный текст | Строки |
|---|---|---|---|
| `input.item_01` | `01` | `Topografik o‘lchov (geodeziya) va uchastka chegaralari` | 556-557 |
| `input.item_02` | `02` | `Qavat rejalari va kesimlar (DWG / PDF)` | 558-559 |
| `input.item_03` | `03` | `Bloklar bo‘yicha TIK: qavat va vazifasi bo‘yicha maydonlar` | 560-561 |
| `input.item_04` | `04` | `Shaharsozlik cheklovlari va texnik shartlar` | 564-565 |
| `input.item_05` | `05` | `Maqsadli muddatlar va byudjet mo‘ljallari` | 566-567 |
| `input.item_06` | `06` | `Mavjud ijarachilar va majburiyatlar - ob‘ekt ishlayotgan bo‘lsa` | 568-569 |

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `input.note` | абзац (Archivo, `--fs-small`, lh 1.45, muted, `margin:12px 0 0`) | `Ma‘lumotlar to‘liq taqdim etilmaguncha muddatlar va yakuniy summa taxminiy hisoblanadi.` | 572 |

### Подписи сторон (573-587)

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `sign.h2` | заголовок H2 (`margin:26px 0 14px`) | `Buyurtmachining tasdig‘i` | 573 |
| `sign.executor.label` | подпись (Archivo 700, ls 0.16em, uppercase, red) | `Ijrochi` | 576 |
| `sign.executor.body` | подпись (`--fs-small`, lh 1.55, с `<br />`) | `«Case Advisory» MChJ<br />Shermuhamedov A. A.<br />Asoschi, Bosh direktor` | 577 |
| `sign.executor.rule` | структура | линия `height:1px; background:var(--ink,#14181B); margin-top:34px` | 578 |
| `sign.executor.caption` | подпись | `Imzo va muhr` | 579 |
| `sign.client.label` | подпись | `Buyurtmachi` | 582 |
| `sign.client.body` | подпись-плейсхолдеры (3 span'а, `<br />` между ними) | `Kompaniya nomi<br />F.I.Sh.<br />Lavozimi` | 583 |
| `sign.client.rule` | структура | линия `height:1px; background:var(--ink,#14181B); margin-top:34px` | 584 |
| `sign.client.caption` | подпись | `Imzo va muhr` | 585 |

Сетка подписей: `grid-template-columns:1fr 1fr; gap:44px; font-family:Archivo`.

### Финальный футер (588-596)

Отличается от футеров стр. 02-06: `margin-top:auto; padding-top:16px; border-top:2px solid var(--red,#9A1D20); display:flex; justify-content:space-between; align-items:flex-end`.

| block_key | Тип | Дословный текст | Строка |
|---|---|---|---|
| `final.company` | подпись (700, ink) | `CASE Real Estate Advisory` | 590 |
| `final.address` | подпись | `Toshkent, O‘zbekiston · Tel. +998 77 047 73 75` | 591 |
| `final.contacts` | подпись | `support@caseadvisory.uz · www.caseadvisory.com` | 592 |
| `final.validity` | подпись (`--fs-label`) | `Taklif amal qilish muddati: yuborilgan kundan 30 kun.` | 593 |
| `final.pagenum` | номер | `07` | 595 |

---

## 8. Таблица тарифов (страница 04, строки 261-322)

Сетка: `display:grid; grid-template-columns:1fr 96px 104px 116px 104px; font-family:Archivo,sans-serif; font-size:calc(10.4px * var(--s,1)); border-top:2px solid var(--ink,#14181B)`.

### Шапка (262-266)

| Колонка | Дословный текст | Стиль |
|---|---|---|
| 1 | `Natijalar va xizmatlar` | `padding:9px 8px 9px 0; border-bottom:2px solid var(--ink); font-weight:700; font-size:var(--fs-small,11.8px)` |
| 2 | `Expert Review` | `padding:9px 5px; border-bottom:2px solid var(--ink); text-align:center; line-height:1.25; font-weight:600` |
| 3 | `Concept Support` | то же |
| 4 | `Commercial Concept<br />TAVSIYA` | `border-bottom:2px solid var(--red,#9A1D20); font-weight:700; background:rgba(154,29,32,0.07)`; слово `TAVSIYA` - `color:var(--red); letter-spacing:0.06em` |
| 5 | `Full Strategy` | как колонки 2-3 |

### Строка цены (267-271)

| Подпись | Expert Review | Concept Support | Commercial Concept | Full Strategy |
|---|---|---|---|---|
| `Narx, USD / 1 m² hisob-kitob maydoni` | `2,0` | `[2,2]` | `2,5` | `4,5` |

Стиль: подпись - `font-weight:700; font-size:var(--fs-small,11.8px)`; значения - по центру, `font-weight:700`, `--fs-small`, `font-variant-numeric:tabular-nums`; ячейка Commercial Concept - `background:rgba(154,29,32,0.07); color:var(--red,#9A1D20)`. Значение `[2,2]` в квадратных скобках = «не подтверждено» (см. `tariffs.guide`, строка 332).

### Строка сроков (272-276)

| Подпись | Expert Review | Concept Support | Commercial Concept | Full Strategy |
|---|---|---|---|---|
| `Orientir muddat` | `2-3 hafta` | `4-6 hafta` | `7-10 hafta` | `10-14 hafta` |

Стиль: вся строка `color:var(--muted,#6E6A66)`; ячейка Commercial Concept - фон `rgba(154,29,32,0.07)`.

### Строки состава (277-321)

Отметки: `✓` (U+2713) - включено; `-` (em dash, U+2014, `color:var(--muted)`) - не включено. **Точек (•) и текстовых отметок в клетках НЕ НАЙДЕНО.**
В колонке Commercial Concept галочка дополнительно: `background:rgba(154,29,32,0.07); color:var(--red,#9A1D20); font-weight:700`; прочерк там же - фон `rgba(154,29,32,0.07)`, цвет muted.

| # | block_key | Дословный текст строки | Expert Review | Concept Support | Commercial Concept | Full Strategy | Строки |
|---|---|---|---|---|---|---|---|
| 1 | `tariffs.row_expert_advice` | `Ekspert tavsiyalari (tijorat va reja bo‘yicha)` | ✓ | ✓ | ✓ | ✓ | 277-281 |
| 2 | `tariffs.row_tor` | `Arxitektorlar uchun texnik topshiriq` | ✓ | ✓ | ✓ | ✓ | 282-286 |
| 3 | `tariffs.row_cad` | `CAD / Revit / 3D chizmalar bilan ish` | - | ✓ | ✓ | ✓ | 287-291 |
| 4 | `tariffs.row_market_check` | `CASE bozor bazasi asosida bozor tekshiruvi *` | - | ✓ | ✓ | ✓ | 292-296 |
| 5 | `tariffs.row_merch_model` | `Merchandise mix byudjeti va ijara daromadi modeli (Excel)` | - | - | ✓ | ✓ | 297-301 |
| 6 | `tariffs.row_final_reco` | `Yakuniy tavsiyalar ** (tijorat va reja bo‘yicha)` | - | - | ✓ | ✓ | 302-306 |
| 7 | `tariffs.row_full_research` | `To‘liq bozor tadqiqoti hisoboti` | - | - | - | ✓ | 307-311 |
| 8 | `tariffs.row_investment` | `10-15 yillik investitsiya baholovi` | - | - | - | ✓ | 312-316 |
| 9 | `tariffs.row_full_report` | `To‘liq hisobot` | - | - | - | ✓ | 317-321 |

Итого в таблице: 5 колонок × 12 строк (шапка + цена + срок + 9 строк состава).

### Названия тарифов и ставки (сводка)

| Тариф | Ставка, USD / 1 m² | Срок | Пометка |
|---|---|---|---|
| `Expert Review` | `2,0` | `2-3 hafta` | - |
| `Concept Support` | `[2,2]` | `4-6 hafta` | значение в квадратных скобках - не подтверждено |
| `Commercial Concept` | `2,5` | `7-10 hafta` | `TAVSIYA` (рекомендуемый), выделен фоном `rgba(154,29,32,0.07)` |
| `Full Strategy` | `4,5` | `10-14 hafta` | - |

Прочие цифры по документу: минимальная сумма `$5 000` (стр. 332); авторский надзор `2 500 USD/oy` при минимуме `3 oy` (стр. 482-483); превышение лимита `80 USD/soat` = `$80/soat` (стр. 487, 526); срок действия оффера `30 kun` (стр. 593).

---

## 9. Плейсхолдеры-подстановки (тонированные span'ы)

Разметка: `<span style="background:var(--ph-bg,rgba(154,29,32,0.10));padding:0 Npx">…</span>`; тонировка отключается prop `showPlaceholderTint`.

| Строка | Стр. док. | padding | Дословный текст-заполнитель |
|---|---|---|---|
| 36 | 01 | `0 6px` | `Loyiha nomi` |
| 40 | 01 | `2px 6px` | `Kompaniya nomi` |
| 44 | 01 | `2px 6px` | `Shahar, mamlakat` |
| 48 | 01 | `2px 6px` | `kun oy yil` |
| 82 | 02 | `0 5px` | `Loyiha nomi` |
| 83 | 02 | `0 5px` | `F.I.Sh.` |
| 141 | 02 | `0 5px` | `Loyiha nomi` |
| 141 | 02 | `0 5px` | `shahar, tuman` |
| 141 | 02 | `0 5px` | `tijorat stilobati (+1…+3), turar-joy bloklari, yer osti avtoturargohi (−1…−2)` |
| 146 | 02 | `0 4px` | `Tijorat qismining formatini va bozordagi o‘rnini aniqlash` |
| 150 | 02 | `0 4px` | `Rejani ijaraga yaroqli va samarali holatga keltirish` |
| 154 | 02 | `0 4px` | `Investitsiya qarori uchun moliyaviy asosni tayyorlash` |
| 482 | 06 | `0 6px` | `2 500` |
| 583 | 07 | `0 5px` | `Kompaniya nomi` |
| 583 | 07 | `0 5px` | `F.I.Sh.` |
| 583 | 07 | `0 5px` | `Lavozimi` |

Итого 16 плейсхолдер-span'ов.

---

## 10. ТОЧНЫЕ КОНСТАНТЫ ВЁРСТКИ

### 10.1 Размер страницы

| Параметр | Значение | Источник |
|---|---|---|
| Атрибут | `<doc-page size="a4">` | строка 25 HTML |
| A4 | `210mm × 297mm` | `doc-page.js:152` (`a4: ['210mm', '297mm']`) |
| В пикселях (1in = 96px, 1mm = 96/25.4px) | ≈ `793.70 × 1122.52 px` | `doc-page.js:171` (`PX_PER`) |
| Ориентация | не задана → portrait | `doc-page.js:351-355` |
| `margin` компонента | атрибут не задан → default `0.75in` | `doc-page.js:362` |
| Режим | пагинированный: прямые дети `.page` - это страницы; `.sheet.paginated { padding:0 }` - страницы full-bleed, внутренние отступы задаёт содержимое | `doc-page.js:214-224` |
| `.page` на экране | `width:100%; aspect-ratio:var(--doc-page-ar); container-type:size; overflow:hidden; background:#fff; border-radius:7px; box-shadow:0 2px 10px rgba(0,0,0,0.25)` | `doc-page.js:225-239` |
| Зазор между страницами (экран) | `margin-top:1rem` | `doc-page.js:240` |
| `.page` при печати | `aspect-ratio:auto !important; width:var(--doc-page-w) !important; height:var(--doc-page-h) !important; overflow:hidden !important; border-radius:0; box-shadow:none; margin:0; break-before:page` | `doc-page.js:246-282` |
| Фон «стола» хоста | `background:#f5f5f4; padding:48px 24px` (`:host`) | `doc-page.js:377-397` |

Служебные переменные компонента (`:host`, `doc-page.js:390-397`): `--doc-page-w:8.5in`, `--doc-page-h:11in` (переопределяются на выбранный размер, строки 483-485), `--doc-page-margin:0.75in`, `--doc-hdr-h:0px`, `--doc-ftr-h:0px`, `--doc-hdr-pad:0px`, `--doc-ftr-pad:0px`.

### 10.2 Padding страниц

| Страница | padding | Строка |
|---|---|---|
| 01 Muqova (секция) | без padding у секции; внутренний контейнер `52px 52px 0` | 27, 28 |
| 01 - тёмная полоса | `22px 52px` | 53 |
| 01 - футер | `14px 52px 20px` | 71 |
| 02-07 (секции) | `44px 52px 34px` | 77, 166, 254, 340, 472, 536 |

### 10.3 CSS-переменные

Заданы в `<style>` внутри `<helmet>` (строки 15-17), на `:root`:

```css
--ink:#14181B;
--muted:#6E6A66;
--rule:#DAD6D0;
--band:#F4F1EE;
--paper:#FFFFFF;
```

Заданы инлайн на `<doc-page>` (строка 25):

| Переменная | Значение | Что означает |
|---|---|---|
| `--red` | `{{ red }}` → default `#9A1D20` | брендовый красный (варианты `#9A1D20`, `#7E1A1C`, `#14181B`) |
| `--ph-bg` | `{{ phBg }}` → `rgba(154,29,32,0.10)` или `transparent` | подсветка плейсхолдеров |
| `--s` | `{{ s }}` → default `1` (0.9…1.1, шаг 0.02) | масштаб текста |
| `--guide` | `{{ guide }}` → `block` или `none` | видимость блоков «Yo‘riqnoma» |
| `--fs-body` | `calc(13.5px * var(--s,1))` | основной текст |
| `--fs-small` | `calc(11.8px * var(--s,1))` | мелкий текст |
| `--fs-label` | `calc(10px * var(--s,1))` | лейблы/капс |
| `--fs-h2` | `calc(21px * var(--s,1))` | заголовки H2 |
| `--fs-h3` | `calc(13.5px * var(--s,1))` | заголовки колонок A/B/C |
| `--fs-num` | `calc(25px * var(--s,1))` | крупные цифры |

### 10.4 Полный список цветов (hex / rgba)

| Значение | Где применяется | Строки |
|---|---|---|
| `#14181B` | `--ink`: основной текст, тёмная полоса на обложке, разделители 2px, hover-цвет ссылок, полоса «Final report» | 16, 20, 27, 53, 180, 371… |
| `#6E6A66` | `--muted`: вторичный текст, лейблы, прочерки | 16 |
| `#DAD6D0` | `--rule`: тонкие линии и заливка зазоров в сетках | 16 |
| `#F4F1EE` | `--band`: плашки «Natija», фон блоков-инструкций, фон слотов изображений | 16 |
| `#FFFFFF` | `--paper`: фон страниц и ячеек | 16 |
| `#9A1D20` | `--red` (default), цвет ссылок | 19, 25, 607 |
| `#7E1A1C` | опция props `brandRed` | 602 |
| `#fff` | белый текст на тёмных/красных плашках, фолбэк `background:var(--paper,#fff)` | 53, 177, 399… |
| `#EFECE8` | штриховка «Turar-joy bloklari - kirmaydi» | 395 |
| `#f5f5f4` | фон «стола» компонента (`:host`) | `doc-page.js:383` |
| `rgba(154,29,32,0.35)` | подчёркивание ссылок | 19 |
| `rgba(154,29,32,0.10)` | `--ph-bg`: подсветка плейсхолдеров | 25, 608 |
| `rgba(154,29,32,0.07)` | выделение колонки/карточки Commercial Concept, карточка «Oylik tarif» | 265, 270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 382, 480 |
| `rgba(154,29,32,0.55)` | этажи `−1`, `−2` в стопке площадей | 411, 415 |
| `rgba(154,29,32,0.72)` | плашка оплаты «30% Oraliq» | 436 |
| `rgba(154,29,32,0.45)` | плашка оплаты «30% Yakuniy» | 441 |
| `rgba(255,255,255,0.5)` | буквы A/B/C/D на тёмной полосе обложки | 55, 59, 63, 67 |
| `rgba(255,255,255,0.3)` | верхняя граница колонки D | 66 |
| `rgba(0,0,0,0.25)` | тень `.page` на экране | `doc-page.js:234` |
| `repeating-linear-gradient(135deg,#EFECE8 0 5px,#fff 5px 10px)` | штриховка исключённого этажа | 395 |

### 10.5 Шрифты, кегли, веса

| Роль | Семейство | Размер | Вес | line-height | letter-spacing | Строки |
|---|---|---|---|---|---|---|
| Тело страниц (наследуемое) | `Newsreader, Georgia, serif` | - | - | - | - | 27, 77, 166, 254, 340, 472, 536 |
| Заголовок обложки H1 | `Newsreader, Georgia, serif` | `calc(40px * var(--s,1))` | 400 | 1.14 | −0.01em | 36 |
| Заголовки H2 | `Newsreader, Georgia, serif` | `var(--fs-h2,21px)` | 400 | 1.2 | - | 140, 171, 259, 345, 392, 428, 447, 477, 499, 541, 552, 573 |
| Заголовки колонок A/B/C | `Archivo, sans-serif` | `var(--fs-h3,13.5px)` | 700 | 1.2 | - | 178, 201, 225 |
| Основной абзац | Newsreader (наследуется) | `var(--fs-body,13.5px)` | 400 | 1.55 / 1.5 / 1.45 | - | 83-85 (1.55), 172/421/478/500/553 (1.5), 260 (1.45) |
| Мелкий текст | `Archivo, sans-serif` | `var(--fs-small,11.8px)` | 400 / 600 / 700 | 1.45 / 1.4 / 1.35 / 1.3 / 1.25 | - | по всему документу |
| Лейблы/капс | `Archivo, sans-serif` | `var(--fs-label,10px)` | 400 / 700 | 1.8 / 1.4 / 1.3 | 0.1-0.26em | 31, 35, 39, 80… |
| Крупные цифры | `Archivo, sans-serif` | `var(--fs-num,25px)` | 600 / 700 | 1 | - | 92, 450, 482, 487 |
| Тело таблицы тарифов | `Archivo, sans-serif` | `calc(10.4px * var(--s,1))` | 400 | 1.3 | - | 261, 277 |
| Подписи сторон | `Archivo, sans-serif` | `var(--fs-small,11.8px)` | 400 | 1.55 | - | 577, 583 |

Веса, подключённые из Google Fonts: Newsreader - 400, 500, 600; Archivo - 400, 500, 600, 700 (строка 13). Вес Newsreader 500 в разметке не используется.

Все встреченные `letter-spacing`: `-0.01em` (H1), `0.06em` (`TAVSIYA`), `0.1em` (подписи статистики, «Bosqich / hafta»), `0.12em` (лейблы карточек сроков и «Oylik tarif»), `0.14em` (буквы полосы обложки, «Natija», «Vazifa NN», «Individual hajm»), `0.16em` (мета-лейблы обложки, лейблы шапок стр. 02-07, «Ijrochi»/«Buyurtmachi»), `0.18em` («Tanlangan loyihalar»), `0.2em` (эйбрау обложки), `0.26em` («Tijorat taklifi»).

Все встреченные `line-height`: `1` (крупные цифры), `1.14` (H1), `1.2` (H2, H3), `1.25` (шапка тарифов, подписи Ганта), `1.3`, `1.35`, `1.4`, `1.45`, `1.5`, `1.55`, `1.8` (эйбрау обложки).

### 10.6 Линии, полосы, разделители

| Элемент | Стиль | Где |
|---|---|---|
| Красная полоса обложки | `height:4px; background:var(--red); margin-top:26px` | 33 |
| Шапка стр. 02-07 | `padding-bottom:11px; border-bottom:2px solid var(--red,#9A1D20)` | 78, 167, 255, 341, 473, 537 |
| Верх карточек A/B/C/D обложки | `border-top:2px solid var(--red)` (D - `rgba(255,255,255,0.3)`) | 54, 58, 62, 66 |
| Разделитель под заголовком колонок A/B/C | `height:2px; background:var(--ink)` | 180, 203, 227 |
| Верх карточек «Vazifa» | `border-top:2px solid var(--ink,#14181B)` | 144, 148, 152 |
| Верх карточек «Keyingi qadamlar» | `border-top:2px solid var(--red,#9A1D20)` | 449, 453, 457, 461 |
| Верх таблицы тарифов | `border-top:2px solid var(--ink,#14181B)` | 261 |
| Низ шапки таблицы тарифов | `border-bottom:2px solid var(--ink)` (у Commercial Concept - `2px solid var(--red)`) | 262-266 |
| Строки таблиц/списков | `border-bottom:1px solid var(--rule,#DAD6D0)` | по всему документу |
| Верх таблицы визитов | `border-top:2px solid var(--ink,#14181B)` | 501 |
| Верх списков исходных данных | `border-top:1px solid var(--ink,#14181B)` | 555, 563 |
| Блок «Individual hajm» | `border-top:2px solid var(--ink); padding-top:12px` | 327 |
| Блоки «Yo‘riqnoma» | `border-left:3px solid var(--red); background:var(--band); padding:11px 14px`; видимость `display:var(--guide,block)` | 157, 245, 331, 549 |
| Футер стр. 02-06 | `padding-top:14px; border-top:1px solid var(--rule,#DAD6D0)` | 160, 248, 334, 466, 530 |
| Футер стр. 07 | `padding-top:16px; border-top:2px solid var(--red,#9A1D20)` | 588 |
| Линии подписи сторон | `height:1px; background:var(--ink,#14181B); margin-top:34px` | 578, 584 |
| Сетки-таблицы через `gap:1px` | `gap:1px; background:var(--rule); border:1px solid var(--rule)` (эффект «рамки»: статистика 6 колонок, карточки сроков 4 колонки, надзор 2 колонки) | 90, 373, 479 |
| Полосы Ганта | `height:15px` | 363, 365, 367, 369, 371 |
| Плашки оплаты | `height:26px; padding:0 10px` | 431, 436, 441 |
| Бейджи A/B/C | `width:26px; height:26px; background:var(--red); color:#fff` | 177, 200, 224 |
| Слоты изображений проектов | `height:104px; background:var(--band,#F4F1EE)` | 119, 126, 133 |

### 10.7 Номера страниц

Все номера: `font-variant-numeric:tabular-nums`, шрифт Archivo, `var(--fs-label,10px)`, `color:var(--muted,#6E6A66)`.

| Страница | Текст | Строка |
|---|---|---|
| 01 | `01` | 73 |
| 02 | `02` | 162 |
| 03 | `03` | 250 |
| 04 | `04` | 336 |
| 05 | `05` | 468 |
| 06 | `06` | 532 |
| 07 | `07` | 595 |

Строка контактов в футере страниц 01-06 идентична (`Tel. +998 77 047 73 75 &nbsp;|&nbsp; support@caseadvisory.uz &nbsp;|&nbsp; www.caseadvisory.com`), строки 72, 161, 249, 335, 467, 531. На странице 07 вместо неё - блок из 4 строк (`final.company`, `final.address`, `final.contacts`, `final.validity`).

### 10.8 Логотип и изображения

| Элемент | Файл | Размер | Строки |
|---|---|---|---|
| Логотип обложки | `assets/case-logo-color.png` | `width:206px; height:auto` | 30 |
| Логотип шапок 02-07 | `assets/case-logo-color.png` | `width:118px; height:auto` | 79, 168, 256, 342, 474, 538 |
| Alt всех логотипов | `CASE Real Estate Advisory` | - | те же |
| `image-slot proj-1` | placeholder `Margilon City Mall - foto`, `shape="rect"` | контейнер 104px | 119 |
| `image-slot proj-2` | placeholder `Tashkent City Park - foto`, `shape="rect"` | контейнер 104px | 126 |
| `image-slot proj-3` | placeholder `82 Mall / 82 Towers - foto`, `shape="rect"` | контейнер 104px | 133 |

В каталоге `assets/` также лежит `case-logo-black.svg` - в этом HTML НЕ используется.

---

## 11. Повторяемые (стандартные) паттерны для библиотеки текстов

1. `page.header` - логотип 118px + правый лейбл шапки (уникальный текст на каждой странице), под ним красная линия 2px. Стр. 02-07.
2. `page.footer` - контакты + номер страницы, над ними линия 1px `--rule`. Стр. 02-06 (на 01 - без линии, на 07 - расширенный вариант с красной линией 2px).
3. `guide.*` - блоки «Yo‘riqnoma» (4 шт.: строки 158, 246, 332, 550), управляются `--guide`. Все начинаются словом `Yo‘riqnoma.` красным и жирным. По собственному указанию в строке 550: `Mijozga yuborishdan oldin barcha yo‘riqnomalarni o‘chiring.`
4. `scope.{a|b|c}.*` - одинаковая структура колонок: бейдж + заголовок + линия + `Maqsad.` + список + плашка `Natija`/`Natijalar`.
5. Названия тарифов повторяются в трёх местах: обложка (полоса A/B/C/D - по смыслу разделов, не тарифов), таблица тарифов (стр. 04, строки 263-266), карточки сроков (стр. 05, строки 375-388). Тарифные имена латиницей и не переводятся (`tariffs.guide`: `Tarif nomlarini o‘zgartirmang…`).
6. Названия этапов совпадают в диаграмме Ганта (стр. 05) и в таблице визитов (стр. 06): `Loyiha hududini o‘rganish`, `Initial / Light chizma`, `Draft chizma + Draft finance`, `Final chizma + finance + Light report`, `Final report`.

---

## 12. Инвентарь специальных символов (для точного посева библиотеки)

Подсчёт по текстовому содержимому `<doc-page>…</doc-page>` (без тегов, HTML-сущности раскрыты).

| Символ | Кодпоинт | Имя Unicode | Вхождений | Где |
|---|---|---|---|---|
| `‘` | U+2018 | LEFT SINGLE QUOTATION MARK | 131 | и как `o‘`/`g‘`, и как тутук-белги в `ma‘lumot`, `ta‘minlaydi`, `iste‘molchi`, `ob‘ekt`, `mas‘ul` |
| `-` | U+2014 | EM DASH | 31 | тире в тексте + прочерки в таблице тарифов |
| ` ` | U+00A0 | NO-BREAK SPACE | 24 | `&nbsp;` в футерах (по 4 на страницу × 6) |
| `✓` | U+2713 | CHECK MARK | 21 | таблица тарифов |
| `·` | U+00B7 | MIDDLE DOT | 10 | разделитель в подписях |
| `-` | U+2013 | EN DASH | 10 | диапазоны (`2-3 hafta`, `10-15 yillik`) |
| `²` | U+00B2 | SUPERSCRIPT TWO | 6 | `m²` |
| `−` | U+2212 | MINUS SIGN | 4 | уровни `−1`, `−2` (НЕ дефис и НЕ en dash) |
| `«` / `»` | U+00AB / U+00BB | ANGLE QUOTATION MARKS | 3 / 3 | `«Loyiha nomi»` ×2, `«Case Advisory» MChJ` |
| `…` | U+2026 | HORIZONTAL ELLIPSIS | 3 | `+4…`, `(+1…+3)`, `(−1…−2)` |

Апостроф `ʼ` (U+02BC, тутуқ белгиси) в документе НЕ используется - везде U+2018. Прямой ASCII-апостроф `'` в узбекском тексте НЕ найден.

Всего текстовых узлов в теле документа: 365 (268 уникальных) - все они перечислены выше.

---

## 13. Замеченные несостыковки и точки внимания

1. **`[2,2]` в квадратных скобках** (строка 269) - по инструкции на строке 332 это неподтверждённая ставка Concept Support. Требует уточнения из Excel-прайса перед отправкой.
2. **Ставка сверх лимита записана двумя способами**: `80` + ` USD/soat` (строка 487) и `$80/soat` (строка 526). Для библиотеки - один источник значения.
3. **Тонирован как плейсхолдер только `2 500`** (строка 482), а `80` (строка 487) - нет, хотя обе величины прайсовые.
4. **Четыре блока «Yo‘riqnoma»** (строки 158, 246, 332, 550) по умолчанию ВИДИМЫ (`--guide` default `block`, prop `showGuidance` default `true`). Инструкция на строке 550 требует их удалить перед отправкой клиенту.
5. **Футеры не единообразны**: стр. 01 - без верхней линии и с `padding:14px 52px 20px`; стр. 02, 04, 05, 06 - `margin-top:auto`; стр. 03 - `margin-top:14px` (не `auto`), т. е. футер не прижат к низу; стр. 07 - отдельный расширенный блок с `border-top:2px solid var(--red)`.
6. **`--fs-h3` дублирует `--fs-body`** - обе `calc(13.5px * var(--s,1))` (строка 25).
7. **Newsreader weight 500 подключён** (строка 13), но в разметке не используется; `assets/case-logo-black.svg` лежит в каталоге, но в этом файле не подключён.
8. **Все три `image-slot`** (proj-1/2/3) - пустые слоты с текстовыми placeholder-подписями, реальных фото в разметке нет.
9. **Полоса A/B/C/D на обложке** (строки 53-70) перечисляет разделы работ, а не тарифы; пункт `D` = `Individual hajm - kelishuv bo‘yicha` - это не раздел, а опция индивидуального объёма (дублирует блок на стр. 04, строки 328-329). Верхняя граница у `D` намеренно нейтральная (`rgba(255,255,255,0.3)`).
10. **Разные шкалы сроков**: Гант на стр. 05 построен на 14 недель для тарифа Full Strategy (это оговорено в `schedule.note`, строка 391), тогда как таблица тарифов даёт диапазоны 2-3 / 4-6 / 7-10 / 10-14 недель.
11. **Заголовок H2 и лейбл шапки на стр. 05 не совпадают**: лейбл `Bosqichlar, narx va to‘lov`, первый H2 - `Ish bosqichlari va muddatlar` (на стр. 03 и 04 лейбл и H2 совпадают дословно).
12. **`{{ … }}`-плейсхолдеров внутри страниц нет** - все подстановки движка сосредоточены в атрибуте `style` тега `<doc-page>` (строка 25). Пользовательские поля реализованы тонированными span'ами (16 шт., раздел 9).
13. **Отметок «точка» (•) и текстовых отметок в клетках таблицы тарифов не найдено** - только `✓` и `-`.
14. **Отступ `margin-top:34px`** над линиями подписи (строки 578, 584) - единственное, что задаёт высоту поля под подпись; при `textScale` > 1 это поле не масштабируется (фиксированные px, вне `calc(... * var(--s))`). То же относится ко всем padding'ам и высотам полос - масштабируются только кегли.
15. **`doc-page` не задаёт `margin`**, поэтому применяется дефолт `0.75in` (`doc-page.js:362`), но в пагинированном режиме он не влияет на `.page` - отступы полностью задаются `padding` секций (52px по бокам).
