# 06. Регламент «CASE system» - дословное извлечение и сверка с ТЗ

**Источник-регламент:** `/tmp/claude-0/-home-user-case-site/3fd249ae-01de-50f2-b471-8036ae594682/scratchpad/offer/extracted/CASE-system.txt` (137 строк)  
**Источник-ТЗ:** `/root/.claude/uploads/3fd249ae-01de-50f2-b471-8036ae594682/29312183-CASEOSOfferBuilderprompt.md` (581 строка), разделы 8ter / 8quater / 8quinquies / 8sexies

> **Замечание о типографике (важно для §7.2 ТЗ).** В файле регламента **нет ни одного символа U+2018** (`o‘`, `g‘`).
> Строки 3-44 (политика визитов) используют ASCII-апостроф `'` (U+0027): `o'rganish`, `bo'yicha`, `ko'ra`, `ro'yxati`, `mas'ul`.
> Строки 47-61 (Report optimization) используют `’` (U+2019): `ma’lumotlar`, `o’tadi`, `qo’yiladi`, `qaymog’i`.
> Ниже узбекский текст приведён посимвольно как в файле, без нормализации.

> **Замечание о таблицах.** В извлечённом `.txt` таблицы разложены построчно: каждая ячейка - отдельная строка с ведущим разделителем ` | `.
> Ниже сначала даётся дословный блок исходных строк, затем та же таблица в собранном виде (убран только разделитель `|`, текст ячеек не изменён).

---

## 1. Модель этапов

В регламенте **нет отдельного раздела «модель этапов»**. Названия этапов встречаются ровно один раз - как строки таблицы лимитов визитов (раздел «1. Tashriflar limiti», строки 5-33).

### 1.1 Названия этапов - дословно (строки 10, 14, 18, 22, 26, 30)

```
Loyiha hududini o'rganish
Initial / Light chizma
Draft chizma + Draft finance
Final chizma + Final finance + Light report
Final report
Hokimiyat / davlat vakillari uchun taqdimot
```

Последняя строка (`Hokimiyat / davlat vakillari uchun taqdimot`) - не этап проекта, а отдельный вид визита; ТЗ это учитывает и в модель этапов её не включает.

### 1.2 Недели

**Не найдено.** В регламенте недели / сроки этапов не указаны нигде. Числа `1-3 / 3-5 / 5-9 / 9-13 / 13-14` есть только в ТЗ (§8quinquies, строки 442-446).

### 1.3 Что закрывает каждый этап

**Не найдено.** Регламент не описывает ни deliverables этапа, ни правило закрытия этапа письменным подтверждением клиента. Формулировка «Each stage closes with a written client confirmation before the next begins» и таблица `stage_confirmations` - это ТЗ (строки 449-450).

Косвенно содержание этапов читается только из самих названий: `Initial / Light chizma`, `Draft chizma + Draft finance`, `Final chizma + Final finance + Light report`, `Final report`.

Единственное указание на форму сдачи - по `Final report` (строка 27):

```
E-version yoki bosma shaklda yuboriladi
```

### 1.4 Платежи и триггеры

**Не найдено.** В регламенте нет ни одного упоминания платежей, долей 40/30/30, аванса, промежуточного или финального транша. Единственная денежная величина в файле - ставка `$80 / soat` (строки 39-41). Цены вынесены наружу (строки 135-136):

```
Service prices
In separate excel
```

Схема 40/30/30 и триггеры «этап 3 → 30 %», «этап 5 → финальные 30 %» присутствуют только в ТЗ (§3 строка 137, §8bis.1 строка 373, §8quinquies строки 444, 446).

---

## 2. Политика визитов

### 2.1 Заголовок и базовый принцип «онлайн по умолчанию» (строки 3-4), дословно

```
Toshkentdan tashqaridagi loyihalar bo'yicha tashrif tartibi
Toshkent shahridan tashqaridagi loyihalarda barcha ishchi uchrashuvlar imkon qadar online shaklda o'tkaziladi. Offline tashriflar faqat aniq maqsad, tasdiqlangan kun tartibi va mijoz tomonidan mas'ul shaxs mavjud bo'lganda amalga oshiriladi.
```

Смысл: для проектов вне Ташкента все рабочие встречи по возможности проводятся онлайн; офлайн-визит - только при наличии чёткой цели (`aniq maqsad`), утверждённой повестки (`tasdiqlangan kun tartibi`) и ответственного лица со стороны клиента (`mijoz tomonidan mas'ul shaxs`).

### 2.2 Лимиты по этапам - «1. Tashriflar limiti» (строки 5-33)

Дословный исходный фрагмент:

```
1. Tashriflar limiti
Ish bosqichi
 | Online uchrashuv
 | Offline tashrif / uchrashuv limiti
 |
Loyiha hududini o'rganish
 | Zaruratga ko'ra
 | 2 marta, har biri o'rtacha 2 kun
 |
Initial / Light chizma
 | Moslashuvchan
 | 1 marta
 |
Draft chizma + Draft finance
 | Moslashuvchan
 | 1 marta
 |
Final chizma + Final finance + Light report
 | 1 marta
 | 1 marta
 |
Final report
 | E-version yoki bosma shaklda yuboriladi
 | Talab qilinmaydi
 |
Hokimiyat / davlat vakillari uchun taqdimot
 | Zaruratga ko'ra
 | 2 martagacha, har biri 1 kun
 |
```

Та же таблица в собранном виде:

| Ish bosqichi | Online uchrashuv | Offline tashrif / uchrashuv limiti | строки |
|---|---|---|---|
| `Loyiha hududini o'rganish` | `Zaruratga ko'ra` | `2 marta, har biri o'rtacha 2 kun` | 10-12 |
| `Initial / Light chizma` | `Moslashuvchan` | `1 marta` | 14-16 |
| `Draft chizma + Draft finance` | `Moslashuvchan` | `1 marta` | 18-20 |
| `Final chizma + Final finance + Light report` | `1 marta` | `1 marta` | 22-24 |
| `Final report` | `E-version yoki bosma shaklda yuboriladi` | `Talab qilinmaydi` | 26-28 |
| `Hokimiyat / davlat vakillari uchun taqdimot` | `Zaruratga ko'ra` | `2 martagacha, har biri 1 kun` | 30-32 |

### 2.3 Презентация для госпредставителей - что считается днём (строки 34-37), дословно

```
2. Davlat vakillari uchun taqdimot
• Davlat vakillari uchun loyiha hududida taqdimot o'tkazish bo'yicha 2 tagacha tashrif xizmat doirasiga kiritiladi.
• Har bir tashrif 1 kun hisoblanadi: 1 kun = 24 soatgacha.
• 24 soat ichiga yo'l, kutish, uchrashuv, taqdimot va qaytish vaqti kiradi.
```

Ключевое:

- До 2 визитов для презентации госпредставителям на площадке проекта **входят в объём услуги** - `2 tagacha tashrif xizmat doirasiga kiritiladi` (строка 35).
- **Правило дня:** `Har bir tashrif 1 kun hisoblanadi: 1 kun = 24 soatgacha` (строка 36) - каждый визит считается за 1 день; 1 день = до 24 часов.
- **Что входит в 24 часа:** `24 soat ichiga yo'l, kutish, uchrashuv, taqdimot va qaytish vaqti kiradi` (строка 37) - дорога, ожидание, встреча, презентация и время возвращения.
- Важно: в регламенте правило 24 часов сформулировано **внутри раздела 2, то есть применительно к презентациям для госпредставителей**, а не как общее правило по всем этапам.

### 2.4 Сверхлимитное время и дополнительные визиты; ставка (строки 38-42), дословно

```
3. Qo'shimcha vaqt va qo'shimcha tashriflar
Kelishilgan limitdan ortiq har qanday vaqt yoki qo'shimcha tashrif $80 / soat asosida hisoblanadi.
• $80 / soat hisobiga yo'l, kutish, uchrashuv, taqdimot, qaytish va boshqa barcha bog'liq vaqtlar kiradi.
• Kelishilgan 2 ta taqdimot tashrifidan tashqari har bir alohida tashrif ham yo'lga chiqishdan uy/ofisga qaytishgacha $80 / soat bo'yicha hisoblanadi.
• Transport, mehmonxona, ovqatlanish va boshqa safar xarajatlari shartnomaga muvofiq alohida qoplanadi.
```

- **Ставка сверх лимита: `$80 / soat`** (строка 39) - за любое время или дополнительный визит сверх согласованного лимита (`Kelishilgan limitdan ortiq har qanday vaqt yoki qo'shimcha tashrif`).
- В `$80 / soat` входит `yo'l, kutish, uchrashuv, taqdimot, qaytish va boshqa barcha bog'liq vaqtlar` (строка 40) - дорога, ожидание, встреча, презентация, возвращение и всё связанное время.
- Каждый отдельный визит сверх согласованных 2 презентационных считается **от выезда до возвращения домой/в офис** - `yo'lga chiqishdan uy/ofisga qaytishgacha` (строка 41).
- **Оплачивается отдельно** (возмещается по договору): `Transport, mehmonxona, ovqatlanish va boshqa safar xarajatlari shartnomaga muvofiq alohida qoplanadi` (строка 42) - транспорт, гостиница, питание и прочие командировочные расходы.

---

## 3. Обязательные поля для подтверждения визита

Раздел «4. Tashrifni tasdiqlash qoidasi» (строки 43-44), дословно:

```
4. Tashrifni tasdiqlash qoidasi
Har bir tashrifdan oldin tashrif maqsadi, kun tartibi, sana-vaqt, ishtirokchilar ro'yxati va mijoz tomonidan mas'ul shaxs tasdiqlanishi kerak.
```

Пять обязательных полей, подтверждаемых **до каждого визита** (`Har bir tashrifdan oldin ... tasdiqlanishi kerak`):

| # | Дословно (регламент) | Смысл | Поле в ТЗ `project_visits` (строки 425-429) |
|---|---|---|---|
| 1 | `tashrif maqsadi` | цель визита | `purpose` |
| 2 | `kun tartibi` | повестка дня | `agenda` |
| 3 | `sana-vaqt` | дата-время | `planned_at` |
| 4 | `ishtirokchilar ro'yxati` | список участников | `participants` |
| 5 | `mijoz tomonidan mas'ul shaxs` | ответственное лицо со стороны клиента | `client_responsible` |

Соответствие полное: ТЗ строка 413 требует «enforce all five fields before a visit can be marked `confirmed`».

Отдельно, в преамбуле (строка 4), условие допустимости офлайн-визита как такового - три из этих пяти: `aniq maqsad`, `tasdiqlangan kun tartibi`, `mijoz tomonidan mas'ul shaxs`.

---

## 4. Стандартизация отчёта - раздел «Report optimization» (строки 45-61)

Дословно, построчно (апострофы U+2019 сохранены как в файле):

```
Report optimization

Введение qismida bazi bir umumiy ma’lumotlar appendixga olinadi.
Анализ зоны охвата - reportda qoladi, faqat boshidagi 3 ta slayddagiday umumiy ma’lumotlar, terminologiyalar haqida ma’lumotlar appendixga o’tadi, standard bir xil qilib qo’yiladi hamma shu turdagi loyihalar uchun.

Анализ рынка розничной торговли - ning faqat boshidagi eng muhim 3 beti qoladi, qolganlari appendixda bo’ladi. Bozordagi har bir o’yinchiga toxtalish (appendixda) soddaroq, ortiqcha ma’lumotlarsiz yoritiladi. Tarixi shart emas, shunchaki bino raqamlari va ijarachilari ro’yxati kerak.

Анализ локации - asosiy reportda emas, appendixda bo’ladi. Bundan faqat Схема Позиционирования asosiy reportda bo’ladi. Shunda reportda bu bo’lim Анализ локации emas balki o’zining nomi bilan ataladi.
Ритейл стратегия - reportda qoladi, faqat orasidagi exceldan ro’yxat bo’lmaydi, oxiridagi qaymog’i bo’ladi xolos.
Обзор организационной структуры - reportda qoladi faqat birinchi beti appendixga o’tadi.

Qizildagi bo’limlar, appendixga tushadigan bo’limlarni standart, har bir turdagi loyiha uchun bir xil ko’rinishga keltirishga mas’ul hodim tayinlab, deadline belgilab olish zarur

Reportga kiradi faqat orasida appendixga o’tadigan page lari bor.
Umuman kirmaydi reportga, ja bo’lmasa shu turdagi loyihalar uchun standard qilingan qismlar appendixga qo’shiladi.
Butunlay Appendixga o’tadi.
O’zgarmasdan qoladi reportda.
```

### 4.1 Разбор по разделам отчёта

| Раздел отчёта | Остаётся в основном отчёте | Уходит в appendix | строка |
|---|---|---|---|
| `Введение` | всё прочее | `bazi bir umumiy ma’lumotlar` - некоторые общие сведения | 47 |
| `Анализ зоны охвата` | `reportda qoladi` - раздел остаётся | `faqat boshidagi 3 ta slayddagiday umumiy ma’lumotlar, terminologiyalar haqida ma’lumotlar appendixga o’tadi`; и это делается `standard bir xil qilib qo’yiladi hamma shu turdagi loyihalar uchun` | 48 |
| `Анализ рынка розничной торговли` | `faqat boshidagi eng muhim 3 beti qoladi` | `qolganlari appendixda bo’ladi`; по каждому игроку рынка - `Bozordagi har bir o’yinchiga toxtalish (appendixda) soddaroq, ortiqcha ma’lumotlarsiz yoritiladi`; `Tarixi shart emas, shunchaki bino raqamlari va ijarachilari ro’yxati kerak` | 50 |
| `Анализ локации` | только `Схема Позиционирования`; и тогда в отчёте раздел называется **не** «Анализ локации», а `o’zining nomi bilan ataladi` | всё остальное: `asosiy reportda emas, appendixda bo’ladi` | 52 |
| `Ритейл стратегия` | `reportda qoladi`; `oxiridagi qaymog’i bo’ladi xolos` - остаётся только итоговая «выжимка» в конце | `faqat orasidagi exceldan ro’yxat bo’lmaydi` - список из Excel в середине убирается | 53 |
| `Обзор организационной структуры` | `reportda qoladi` | `faqat birinchi beti appendixga o’tadi` - только первая страница | 54 |

### 4.2 Организационное требование (строка 56), дословно

```
Qizildagi bo’limlar, appendixga tushadigan bo’limlarni standart, har bir turdagi loyiha uchun bir xil ko’rinishga keltirishga mas’ul hodim tayinlab, deadline belgilab olish zarur
```

Смысл: по «красным» разделам и по разделам, уходящим в appendix, необходимо **назначить ответственного сотрудника и установить дедлайн**, чтобы привести их к стандартному, одинаковому виду для каждого типа проектов.

### 4.3 Легенда - четыре категории размещения (строки 58-61)

Это подписи к цветовой легенде исходного документа:

| № | Дословно | Смысл |
|---|---|---|
| 1 | `Reportga kiradi faqat orasida appendixga o’tadigan page lari bor.` | входит в отчёт, но отдельные страницы внутри переходят в appendix |
| 2 | `Umuman kirmaydi reportga, ja bo’lmasa shu turdagi loyihalar uchun standard qilingan qismlar appendixga qo’shiladi.` | в отчёт не входит вообще; в крайнем случае стандартизованные для этого типа проектов части добавляются в appendix |
| 3 | `Butunlay Appendixga o’tadi.` | полностью переходит в appendix |
| 4 | `O’zgarmasdan qoladi reportda.` | остаётся в отчёте без изменений |

Сами цвета в извлечённом тексте отсутствуют (форматирование потеряно при извлечении), поэтому сопоставить категорию легенды с конкретным разделом отчёта **по этому файлу нельзя** - нужен исходный документ с форматированием.

---

## 5. Авторский надзор (mualliflik nazorati)

**В регламенте `CASE-system.txt` - не найдено.** В файле нет ни термина `mualliflik nazorati`, ни «авторский надзор», ни «supervision», ни помесячного объёма работ, ни числа встреч в месяц.

Единственное пересечение с ТЗ - ставка `$80 / soat` (строка 39), которую ТЗ переиспользует для сверхлимитных часов надзора.

Всё содержание авторского надзора взято **только из ТЗ, §8ter (строки 391-407)**:

- **Объём в месяц:** `check drawings against the commercial logic and issue written recommendations`; `decisions on GLA / zoning / flows changes`; `advice on incorporating tenant requirements` (строки 406-407).
- **Число встреч:** `2 online meetings` в месяц; в схеме `visits_included_per_month int default 2` (строки 400, 406).
- **Минимальный срок:** `months int,   -- min 3` (строка 397); продублировано в §8bis.1: `months_of_supervision > 0 ⇒ min 3 months enforced` (строка 360).
- **Сверх лимита:** `Anything beyond the included visits bills at 80 USD/hour` (строка 407).
- **Биллинг:** помесячно, **вне** схемы 40/30/30 - `supervision is invoiced monthly` (строка 373), `not inside the 40/30/30 schedule` (строка 523).

---

## 6. Прочее, относящееся к подготовке предложения и ведению проекта

### 6.1 Матрица тарифов «Service tariffs» (строки 63-123)

| Deliverables/Tariffs | Expert Review | Concept Support | Commercial Concept | Full Strategy | строки |
|---|---|---|---|---|---|
| Expert recommendations | ✅ | ✅ | ✅ | ✅ | 70-74 |
| Technical order for architects | ✅ | ✅ | ✅ | ✅ | 76-80 |
| CAD / Revit / 3D drawings | No | ✅ | ✅ | ✅ | 82-86 |
| Market validation based on CASE market intelligence* | No | ✅ | ✅ | ✅ | 88-92 |
| Merchandise mix budget and rent revenue model in Excel | No | No | ✅ | ✅ | 94-98 |
| Final recommendations** (commercial and planning) | No | No | ✅ | ✅ | 100-104 |
| Full market research report | No | No | No | ✅ | 106-110 |
| 10-15 year investment appraisal | No | No | No | ✅ | 112-116 |
| Full report | No | No | No | ✅ | 118-122 |

Обозначения в файле: `✅` = включено, `No` = не включено. Тарифов ровно 4, строк-deliverables ровно 9 (включая `Full report`).

### 6.2 Сноска `*` - что означает market validation (строки 125-130), дословно

```
*
we use our existing market database;
we use previous research experience;
we check whether the data is still relevant;
we do additional research only if needed;
but we do not prepare a separate full market research report unless the client buys Full Strategy.
```

Это прямое ограничение объёма: используется существующая база рынка + прошлый опыт + проверка актуальности данных + доисследование только при необходимости; **отдельный полный market research report не готовится, если клиент не купил Full Strategy**.

### 6.3 Сноска `**` - границы Commercial Concept (строки 132-133), дословно

```
**
Commercial Concept includes commercial and planning recommendations based on zoning, merchandise mix, GLA distribution, and rental revenue potential. It does not include full investment feasibility, IRR, NPV, payback period, or final investment decision.
```

### 6.4 Цены (строки 135-136), дословно

```
Service prices
In separate excel
```

В регламенте **нет ни одной ставки USD/m²**, нет минимального гонорара, нет валюты, нет срока действия оферты. Единственная ставка - `$80 / soat` за сверхлимитное время.

---

## 7. РАСХОЖДЕНИЯ между регламентом и ТЗ

Обозначения: **R** = регламент `CASE-system.txt`, **T** = ТЗ `29312183-CASEOSOfferBuilderprompt.md`.

### 7.1 Критические - T утверждает то, чего в R нет

**D1. Недели этапов.** T §8quinquies (строки 442-446) даёт `weeks 1-3 / 3-5 / 5-9 / 9-13 / 13-14` под заголовком «Use the firm's real stages everywhere». В R недель нет вообще. Заголовок §8quater «(from «CASE system»)» и соседство §8quinquies создают впечатление, что сроки тоже из регламента - это не так. Источник чисел нужно найти и подтвердить.

**D2. Платёжные триггеры.** T §8quinquies привязывает `30% interim payment` к этапу 3 и `final 30%` к этапу 5; T §3 (строка 137) сеет `40 / 30 / 30`. В R **о платежах нет ни слова**. Дополнительно: **триггер для первых 40 % не определён нигде в ТЗ** - поле `trigger_key` есть, событие не названо.

**D3. Авторский надзор.** T §8ter задаёт `2 online meetings`, `visits_included_per_month = 2`, `min 3 months`, месячную ставку. В R раздела об авторском надзоре нет. Из R подтверждается только ставка `$80 / soat`.

**D4. Правило «1 день = 24 часа» расширено по области действия.** В R (строки 34-37) правило `1 kun = 24 soatgacha` стоит **внутри раздела 2, посвящённого презентациям для госпредставителей**. T (строки 432-434) делает его глобальным для всех визитов всех этапов. По смыслу, вероятно, верно, но это расширение, а не цитата - требуется подтверждение автора регламента, иначе оно не покрывает, например, `2 marta, har biri o'rtacha 2 kun` на этапе изучения площадки (там «в среднем 2 дня», не «до 24 часов»).

**D5. Не перенесено ограничение Commercial Concept.** R строка 133: `It does not include full investment feasibility, IRR, NPV, payback period, or final investment decision`. В T этой оговорки **нет нигде** - ни в §9 (строка 478), ни в списке блоков оферты §6, ни в acceptance-критериях §12. Для коммерческого предложения это ключевая защитная формулировка; её отсутствие = риск спора об объёме.

**D6. Не перенесена сноска `*` о market validation.** R строки 125-130 явно фиксируют: полный отчёт по рынку **не готовится** без Full Strategy. В T §9 (строка 477) это сжато до «market validation against the CASE database» без оговорки. Та же категория риска, что D5.

### 7.2 Существенные - искажение или потеря нюанса

**D7. `placement enum(report, appendix, both)` не покрывает легенду R.** T §8sexies (строка 461) предлагает 3 значения. В R (строки 58-61) - **4 различимых категории**, включая `Umuman kirmaydi reportga, ja bo’lmasa shu turdagi loyihalar uchun standard qilingan qismlar appendixga qo’shiladi` (не входит в отчёт вообще) и `O’zgarmasdan qoladi reportda` (остаётся без изменений). Значение `both` из T прямого соответствия в R не имеет, а категория «не входит в отчёт вообще» в T невыразима. Нужен 4-й enum и/или отдельный флаг `unchanged`.

**D8. `Ритейл стратегия` - потеряна половина правила.** R строка 53: `reportda qoladi, faqat orasidagi exceldan ro’yxat bo’lmaydi, oxiridagi qaymog’i bo’ladi xolos`. T (строка 459) передаёт только «stays minus the Excel listing» и теряет `oxiridagi qaymog’i bo’ladi xolos` - остаётся лишь итоговая выжимка в конце.

**D9. `Анализ зоны охвата` - потеряно требование единого стандарта.** R строка 48: `standard bir xil qilib qo’yiladi hamma shu turdagi loyihalar uchun`. T упоминает `standardised bool` в схеме, но нигде не формулирует правило, что стандарт **одинаков для всех проектов данного типа**.

**D10. «Beti» (страницы) vs «slayd» (слайды).** R строка 50 говорит о `3 beti` (3 страницы) для анализа рынка, а R строка 48 - о `3 ta slayd` (3 слайда) для зоны охвата. T (строки 456-458) унифицирует всё в «pages», стирая различие носителя. Требует уточнения: отчёт вёрстается как документ или как слайды.

**D11. «Входят в объём услуги» не перенесено.** R строка 35: `2 tagacha tashrif xizmat doirasiga kiritiladi` - до 2 госпрезентационных визитов **включены в стоимость**. T (строка 422) даёт только лимит «up to 2 × 1 day» в таблице, не указывая, что они уже оплачены базовым гонораром. Без этого биллинг-логика (`billed_amount`, `is_over_limit`) может ошибочно тарифицировать первые два визита.

### 7.3 Типографика и текст

**D12. Апострофы регламента противоречат §7.2 ТЗ.** T строка 313 требует: «always `o‘`/`g‘` (U+2018) in Latin output, never `'` or `` ` ``». Исходный R **не содержит U+2018**: строки 3-44 - U+0027 (`o'rganish`, `mas'ul`, `bo'yicha`, `ko'ra`, `qo'shimcha`), строки 47-61 - U+2019 (`ma’lumotlar`, `o’tadi`, `qaymog’i`, `mas’ul`). При этом T строка 254 требует засеивать пресеты «verbatim». Прямое противоречие: дословный перенос нарушит правило типографики, нормализация нарушит «verbatim». Нужно явное правило конверсии: `o`/`g` + любой апостроф → `o‘`/`g‘` (U+2018); прочие апострофы (тутук белгиси: `ma’lumot`, `mas’ul`) → U+2019. Без такого правила транслитератор `toCyrl` из §7.2 на этом тексте отработает неверно.

**D13. Название этапа в T уже нормализовано.** T строки 417 и 442: `Loyiha hududini o‘rganish` (U+2018). R строка 10: `Loyiha hududini o'rganish` (U+0027). Остальные четыре названия этапов (T строки 418-420, 443-445) совпадают с R побайтно - в них апострофов нет.

### 7.4 Внутренние противоречия ТЗ, обнаруженные при сверке (R их не разрешает)

**D14. Две несовместимые сетки недель.** §8quinquies (строки 442-446): этапы 1-3, 3-5, 5-9, 9-13, 13-14. §9 «Task granularity» (строки 484-485): `A = weeks 1-4, B = 3-9, C = 8-12, final presentation = 13-14`. Для одного и того же проекта заданы две разные разбивки. R недель не содержит и арбитром быть не может.

**D15. Ставки: §3 против §8bis.1.** §3 (строка 93): `rate_per_sqm numeric -- 2.0 / 2.5 / 4.5 / null for t4`. §8bis.1 (строки 369-370): Expert Review 2,0; Concept Support **2,2 (unconfirmed - verify against the price Excel)**; Commercial Concept 2,5; Full Strategy **4,5**. Full Strategy = t4 не может быть одновременно `null` и `4,5`; ставки 2,2 в комментарии §3 нет. R цен не содержит вообще (строки 135-136: `In separate excel`) - нужен прайс-Excel.

**D16. Объём документов.** §1 (строки 41-42) и §8 (строки 333-334): 6 страниц A4 / 13 слайдов; §12.2 (строка 527) подтверждает «6-page A4 PDF and a 13-slide deck». §13 build order (строка 559): `A4 renderer (7 pages)` / `deck renderer (15 slides)`. К регламенту не относится, но противоречие внутри одного документа.

### 7.5 Что перенесено из регламента в ТЗ корректно

- Таблица лимитов визитов T §8quater (строки 417-422) соответствует R строкам 10-32 по всем шести строкам: `2 visits × ~2 days`, `1`, `1`, `1 / 1`, `e-version or printed / not required`, `up to 2 × 1 day`.
- Пять обязательных полей подтверждения визита (T строки 411-413, схема `project_visits` строки 425-429) = R строка 44.
- Ставка `80 USD/hour` «door-to-door» (T строка 434) = R строки 39-41 (`yo'lga chiqishdan uy/ofisga qaytishgacha`).
- Возмещение транспорта, гостиницы, питания отдельно по договору (T строка 434) = R строка 42.
- Онлайн по умолчанию для проектов вне Ташкента (T строка 411) = R строки 3-4.
- Матрица тарифов T §9 (строки 476-479) сходится с R строками 63-123 по всем 9 позициям и 4 тарифам, включая накопительную логику «+».
- Ответственный + дедлайн на стандартизацию отчёта (T строки 461-462: `owner_id`, `deadline date`, «an owner and a deadline are required») = R строка 56.
- Распределение 6 разделов отчёта между report и appendix (T строки 455-460) по существу соответствует R строкам 47-54 - с оговорками D7-D10.
- Ставки/прайс вынесены в Excel: T строка 368 «maintained from the price list (currently a separate Excel)» = R строки 135-136.

---

## 8. Сводка «не найдено» в регламенте

- Недели и длительности этапов - **не найдено**.
- Deliverables этапа и правило закрытия этапа подтверждением клиента - **не найдено**.
- Платежи, доли, аванс, триггеры платежей - **не найдено**.
- Авторский надзор: объём в месяц, число встреч, месячная ставка, минимум месяцев - **не найдено**.
- Ставки USD/m², минимальный гонорар (`MIN_FEE 5 000 USD`), валюта, `validity_days` - **не найдено** (вынесено в отдельный Excel, строка 136).
- Расчётная площадь «hisob-kitob maydoni», её включения/исключения - **не найдено**.
- Разбивка ценности 50 / 30 / 20 (Konsepsiya va chizmalar / Moliyaviy model / Texnik topshiriq) - **не найдено**.
- Нумерация оферт, версионирование, роли и права, жизненный цикл оферты - **не найдено**.
- Глоссарий «чистого узбекского» (§7.1 ТЗ) - **не найдено**.
- Цветовая легенда раздела Report optimization (какой раздел каким цветом помечен) - **не найдено** в извлечённом тексте: форматирование потеряно при извлечении, нужен исходный файл.
