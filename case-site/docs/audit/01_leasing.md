# CASE OS - карта воронки АРЕНДЫ и ПРОДАЖ

Базовые пути (все абсолютные):
- `/home/user/case-site/case-site/os/core.js`
- `/home/user/case-site/case-site/os/v32-upgrade.js`
- `/home/user/case-site/case-site/os/v326-commission-engines.js`
- `/home/user/case-site/case-site/os/v35-stable.js`
- `/home/user/case-site/case-site/os/v4327-patch.js`
- `/home/user/case-site/case-site/os/v496-commissions.js`

Разделы `leasing_portfolio_map` в перечисленных шести файлах **не реализованы** - только зарегистрированы
как валидный вид (`core.js:1144`) и как «занятой» экран для авто-refresh (`core.js:139`). Фактическая
отрисовка - в `v493-portfolio-suite.js` и `v492-portfolio-proposals.js`; описано в разделе 9 с пометкой.

---

## 0. Общий каркас маршрутизации

| Что | Где |
|---|---|
| Список валидных видов (`registry`, `brands`, `v32_*`, `v326_lease`, `leasing_portfolio_map`) | `core.js:1144` (`validViews`) |
| Перехват `go()` для `v32_action / v32_requests / v32_investors / v32_demand / v32_sales / v32_partners` | `v32-upgrade.js:294-303` (`installGo`), диспетчер `renderV32` - `v32-upgrade.js:304-316` |
| Перехват `go()` для `v326_lease / v326_suppliers` | `v326-commission-engines.js:306` (`installGo`) |
| Перехват `go()` для внешнего агента (AGX) | `v4327-patch.js:235-247` (`installExternalNavigation`) |
| Меню (группа «Сделки») | `v35-stable.js:449-455` (`patchNav`) + дозапись `v32-upgrade.js:287-292` (`appendNav`) + `v326-commission-engines.js:304` |
| Русские подписи разделов, доступ по ролям | `v3520-workspaces.js:46-54`, `:131-145` (не входит в задание, но именно оттуда берутся заголовки «Контроль аренды (LCR)», «Контроль продажи (SCR)», «Инвесторы и запросы», «Карта объектов») |

Права: `const R=()=>ROLES[S.role]` - `core.js:892`; сами роли - `core.js:295-309`
(`ASH, ADM, BA, AG, AGX, HO, BSH, HM, DIR, CFO, BRJ`).

---

## 1. `v32_demand` - «Инвесторы и запросы»

**1.1 Сущности и хранение.** Собственных сущностей нет - это контейнер-переключатель поверх двух
массивов: `window.BRAND_REQUESTS` и `window.INVESTOR_REQUESTS` (`v32-upgrade.js:7`, `DATA_KEYS`).

**1.2 Стадии.** Своих стадий нет - берутся из вложенных разделов (см. §2 и §3).

**1.3 Экраны.** Единственный экран - две кнопки-вкладки над телом раздела:
`renderDemand()` - `v32-upgrade.js:317-321`.
- вкладка `buy` - «Покупка · инвесторы» → вызывает `renderInvestors()`;
- вкладка `rent` - «Аренда · запросы брендов» → вызывает `renderRequests()`;
- состояние вкладки - глобальная `window.V32_DEMAND_TAB`, по умолчанию `buy`
  (`var tab=(window.V32_DEMAND_TAB==='rent')?'rent':'buy'`, строка 317).
- переключение: `onclick="window.V32_DEMAND_TAB='...';go('v32_demand')"` (строка 318) - полная
  перерисовка `#main`.

**1.4 Формы.** Своих нет - формы вложенных разделов.

**1.5 Действия.** Только две кнопки-вкладки. Подтверждений нет.

**1.6-1.7.** Путь и постподписание - см. §2/§3.

Отдельно: для роли AGX (внешний агент) `v32_demand` подменяется формой «Новый бренд»
(`v4327-patch.js:238`).

---

## 2. `v32_requests` - «Запросы брендов»

**2.1 Сущности.** `window.BRAND_REQUESTS` - массив в состоянии окна.
Объявление ключа - `v32-upgrade.js:7`; демо-заполнение - `v32-upgrade.js:115-120`.
Поля записи (из `v32SaveRequest`, `v32-upgrade.js:468`):
`id, brand, source, country, city, category, areaMin, areaMax, budgetMax, stage, broker,
potentialFee, nextAction, due, preferences, createdAt`.

Включение в сохраняемый стейт: `wrapState()` оборачивает `stateBlob`/`applyState`
(`v32-upgrade.js:167-179`), человекочитаемая подпись ключа - `core.js:156`
(`BRAND_REQUESTS:'Заявки брендов'`). Серверный приём заявок от внешних агентов -
`api/brand_requests.php` (`v4327-patch.js:224`).

**2.2 Стадии** (форма `rq_stage`, `v32-upgrade.js:467`):

| код | подпись в форме | подпись в таблице (`stageLabel`, `v32-upgrade.js:330`) |
|---|---|---|
| `new` | New | New |
| `matching` | Matching | Matching |
| `offer` | Offer | Offer |
| `won` | Won | Won |
| `lost` | Lost | Lost |

Русских подписей стадий нет - все латиницей. Вероятности для взвешенного прогноза зашиты в
`allBonusRows` (`v32-upgrade.js:237`): `won`=1, `offer`=0.65, `matching`=0.45, иначе 0.25.

**2.3 Экраны.** Один вид - таблица. `renderRequests()` - `v32-upgrade.js:340-345`.
- шапка `pageHead(tr('requests'), tr('requestsSub'), кнопка)` - `v32-upgrade.js:321`;
- панель: строка поиска `#v32ReqQ` (фильтр по всему JSON строки - `filterText`, `v32-upgrade.js:331`),
  пилюли «Мин. м² / Макс. м²» и «Потенц. комиссия: сумма»;
- таблица `.v32-table`, колонки: Бренд / Страна · Город / Категория / Мин. м² / Макс. м² / Бюджет /
  Стадия / Следующее действие / Ответственный / Действия;
- пустое состояние - `<div class="v32-empty">Нет записей</div>`.
Канбана, карточек и карты в этом разделе нет. Переключателя видов нет.

**2.4 Форма** - модалка `v32RequestForm(rid)`, `v32-upgrade.js:467`.
Хелперы полей: `formInput/formText/formSelect` - `v32-upgrade.js:460-462`.

| id | тип | подпись |
|---|---|---|
| `rq_brand` | text | Бренд |
| `rq_source` | text | Источник (умолч. `inbound`) |
| `rq_country` | text | Страна (умолч. «Узбекистан») |
| `rq_city` | text | Город |
| `rq_cat` | text | Категория |
| `rq_amin` | number | Мин. м² |
| `rq_amax` | number | Макс. м² |
| `rq_budget` | number | Бюджет |
| `rq_stage` | select | Стадия (new/matching/offer/won/lost) |
| `rq_broker` | text | Ответственный (умолч. `brokerName()`) |
| `rq_fee` | number | Потенц. комиссия |
| `rq_next` | text | Следующее действие |
| `rq_due` | date | Дедлайн (умолч. +3 дня) |
| `rq_pref` | textarea | Предпочтения |

Валидация: пустой `brand` → `toast(tr('needBrand'),'warn')`, сохранение прерывается
(`v32-upgrade.js:468`).

**2.5 Действия.**
| Кнопка | Что делает | Подтверждение |
|---|---|---|
| «+ Добавить запрос» (`v32RequestForm()`) | открывает пустую модалку | нет |
| «Сохранить» (`v32SaveRequest`) | upsert в `BRAND_REQUESTS`, `persistV32()`, закрытие модалки, `go('v32_requests')` | нет |
| «Отмена» (`v32CloseModal`) | закрывает модалку | нет |
| «Подбор» (`v32MatchRequest`, `v32-upgrade.js:469`) | подбор юнитов `U` по городу объекта, диапазону площади и статусу из `['vac','neg','off','res']`, максимум 20; модалка со списком | нет |
| «В шорт-лист» (`v32RequestToUnit`, `v32-upgrade.js:471`) | пишет бренд в `u.shortlist` и `u.vars`, `vac`→`neg`, добавляет дату `u.dates`, запись в `u.hist`, ставит `r.stage='matching'` | нет |
| «Редактировать» | та же модалка с `rid` | нет |
Кнопки удаления запроса **не найдено**.

**2.6 Путь до договора.**
1. Меню «Запросы брендов» → `go('v32_requests')` → таблица.
2. «+ Добавить запрос» → модалка → «Сохранить» → стадия `new`.
3. «Подбор» → модалка `MATCH` со списком помещений.
4. «В шорт-лист» на строке помещения → запрос переходит в `matching`, помещение - в `neg`
   («Переговоры»), бренд появляется в вариантах юнита.
5. Дальше работа уходит в LCR/Документы (см. §6 и §11) - прямого перехода со строки запроса
   к КП **не найдено**.

**2.7 После подписания.** Собственных начислений у запроса нет. Единственное денежное поле -
`potentialFee`, попадающее в сводки `allBonusRows` (`v32-upgrade.js:237`) и в KPI-плитки
«Придёт при закрытии» / «Взвешенный прогноз» (`hubHTML`, `v32-upgrade.js:247-262`).
Автоматической связи «выигранный запрос → комиссия» **не найдено**.

---

## 3. `v32_investors` - «Инвесторские заявки»

**3.1 Сущности.** `window.INVESTOR_REQUESTS` (`v32-upgrade.js:7`), демо - `v32-upgrade.js:133-138`.
Поля (из `v32SaveInvestor`, `v32-upgrade.js:474`):
`id, investor, source, country, city, assetType, budgetMin, budgetMax, areaMin, areaMax, capRate,
proofFunds, contact, stage, broker, potentialFee, nextAction, due, preferences, createdAt`;
плюс `assetIds[]` - добавляется при шорт-листе объекта (`v32-upgrade.js:476`).
Подпись ключа стейта - `core.js:156` (`INVESTOR_REQUESTS:'Заявки инвесторов'`).
Серверный эндпойнт для внешних агентов - `api/investor_requests.php` (`v4327-patch.js:233`).

**3.2 Стадии** (селект `ir_stage`, `v32-upgrade.js:473`):
`new` New · `matching` Matching · `nda` NDA · `dd` DD · `offer` Offer · `spa` SPA · `won` Won ·
`lost` Lost. Русских подписей нет.
Вероятности (`allBonusRows`, `v32-upgrade.js:238`):
`new .2 / matching .4 / nda .5 / dd .6 / offer .7 / spa .85 / won 1 / closed 1 / lost 0`, по умолчанию `.25`.

Отдельный статус `proofFunds` (подтверждение средств): `pending` / `confirmed` / `not_required`
(`v32-upgrade.js:473`). Русской подписи значений нет, подпись поля - «Подтв. средств».

**3.3 Экраны.** Только таблица. `renderInvestors()` - `v32-upgrade.js:333-338`.
Колонки: Инвестор (+источник и контакт) / Страна · Город / Тип актива / Бюджет (+потенц. комиссия) /
Мин-Макс м² / Доходность (+Подтв. средств) / Стадия / Следующее действие (+дедлайн) / Ответственный /
Действия. Поиск - `#v32InvQ`. Пилюли: «Мин. бюджет / Макс. бюджет», «Взвешенный», «Потенц. комиссия».
Переключателя видов нет.

**3.4 Форма** - `v32InvestorForm(iid)`, `v32-upgrade.js:473`:

| id | тип | подпись |
|---|---|---|
| `ir_investor` | text | Инвестор |
| `ir_source` | text | Источник (умолч. `inbound`) |
| `ir_country` | text | Страна (умолч. «Узбекистан») |
| `ir_city` | text | Город |
| `ir_type` | text | Тип актива (умолч. `Street retail / leased unit`) |
| `ir_bmin` | number | Мин. бюджет |
| `ir_bmax` | number | Макс. бюджет |
| `ir_amin` | number | Мин. м² |
| `ir_amax` | number | Макс. м² |
| `ir_cap` | text | Доходность / cap rate |
| `ir_pof` | select | Подтв. средств (Pending/Confirmed/Not required) |
| `ir_contact` | text | Контакт |
| `ir_stage` | select | Стадия (8 значений выше) |
| `ir_broker` | text | Ответственный |
| `ir_fee` | number | Потенц. комиссия |
| `ir_next` | text | Следующее действие |
| `ir_due` | date | Дедлайн (умолч. +4 дня) |
| `ir_pref` | textarea | Критерии покупки |

Валидация: пустой `investor` → `toast('Инвестор - Обязательное поле','warn')` (`v32-upgrade.js:474`).

**3.5 Действия.**
| Кнопка | Что делает | Подтверждение |
|---|---|---|
| «+ Добавить инвесторский лид» | модалка | нет |
| «Продажи объектов» | `go('v32_sales')` | нет |
| «Подобрать объекты» (`v32MatchInvestor`, `v32-upgrade.js:475`) | фильтрует `SALES_ASSETS` по бюджету, площади, городу и типу (макс. 20), модалка `INVESTMENT MATCH` | нет |
| «В шорт-лист» в модалке (`v32InvestorToAsset`, `v32-upgrade.js:476`) | `r.stage='matching'`, добавляет `aid` в `r.assetIds`, дописывает `a.nextAction` и `a.notes` | нет |
| «Создать покупателя» (`v32InvestorToBuyer`, `v32-upgrade.js:477`) | создаёт запись в `SALES_BUYERS` (если нет одноимённой), `new→matching`, `go('v32_sales')` | нет |
| «Редактировать» | модалка с `iid` | нет |
Удаления **не найдено**.

**3.6 Путь.** Меню «Инвесторы» → таблица → «+ Добавить инвесторский лид» → сохранение (`new`) →
«Подобрать объекты» → «В шорт-лист» (`matching`) → «Создать покупателя» → переход на экран
«Контроль продажи (SCR)», вкладка «Инвест-объекты», где уже ведутся стадии
`lead → nda → dd → offer → spa → closed` (см. §4).

**3.7 После подписания.** Специальной обработки нет: стадии `won`/`closed` только переводят
`potentialFee` в колонку `earned` в `allBonusRows` (`v32-upgrade.js:238`).

**Ограничение AGX**: для внешнего агента `v32_investors` подменяется формой «Новый инвестор»
(`v4327-patch.js:239`, `renderExternalInvestor` - `v4327-patch.js:228`), поля:
`ex_inv_name, ex_inv_type, ex_inv_country, ex_inv_city, ex_inv_bmin, ex_inv_bmax, ex_inv_amin,
ex_inv_amax, ex_inv_cap, ex_inv_contact, ex_inv_note`; кнопка «Отправить на проверку».

---

## 4. `v32_sales` - «Контроль продажи (SCR)»

**4.1 Сущности - три разных набора.**
1. **Поюнитный реестр продаж** - те же юниты `U` из `core.js:342` (общий массив с арендой),
   поля продажи: `u.saleStatus`, `u.salePrice` (`v32-upgrade.js:452-453`, `core.js:2713-2715`).
   Выборка юнитов текущего объекта - `scrUnits()`, `v32-upgrade.js:355`.
2. **Отказной лист** - `REFUSALS[objId]` (`core.js:362`), общий с LCR; список - `refusList`,
   `core.js:2758`.
3. **Инвест-объекты и покупатели** - `window.SALES_ASSETS` и `window.SALES_BUYERS`
   (`v32-upgrade.js:7`, демо `:122-131`).
   Поля актива (`v32SaveAsset`, `v32-upgrade.js:480`): `id, name, type, country, city, area, price,
   currency('USD'), commissionRate, expectedCommission, stage, broker, visibility, seller,
   nextAction, due, notes, createdAt`.
   Поля покупателя (`v32SaveBuyer`, `v32-upgrade.js:482`): `id, name, assetType, country, city,
   broker, budgetMin, budgetMax, areaMin, areaMax, capRate, contact, notes, stage:'active', createdAt`.

**4.2 Статусы.**
- Статус продажи юнита - `SALESTAT` (`core.js:2713`) и дубль `SCR_SALE_STS` (`v32-upgrade.js:359`):
  `savail` «Свободно», `sresv` «Бронь», `sdeal` «Договор/задаток», `ssold` «Продано».
  Цвета чипов - `SCR_STCOL` (`v32-upgrade.js:406`): savail зелёный, sresv оранжевый,
  sdeal синий, ssold красный. Нормализация - `saleOf()` (`core.js:2714`), подпись - `ssT()` (`core.js:2715`).
- Стадии инвест-объекта (селект `sa_stage`, `v32-upgrade.js:479`):
  `lead` Lead · `nda` NDA · `dd` DD · `offer` Offer · `spa` SPA · `closed` Closed · `lost` Lost.
  Вероятности (`v32-upgrade.js:239`): lead .2 / nda .35 / dd .55 / offer .7 / spa .85 / closed 1 / lost 0.
- Видимость актива (`sa_vis`): `internal` «Внутренне», `partners` «Публично партнёрам».
- Покупатель всегда сохраняется со `stage:'active'`.

**4.3 Экраны - 4 вкладки.** `renderSales()`, `v32-upgrade.js:437-450`; переключение -
`window.scrTab(t)` через `window.SCR_TAB` (`v32-upgrade.js:451`), по умолчанию `reg`.

| код | подпись | содержимое |
|---|---|---|
| `reg` | «Реестр продаж» | `scrRegistry()`, `v32-upgrade.js:362-405` |
| `plan` | «Планировка продаж» | карточка с кнопкой перехода, `v32-upgrade.js:446` |
| `refus` | «Отказы» | `scrRefus()`, `v32-upgrade.js:411-428` |
| `assets` | «Инвест-объекты (целиком)» | `renderSaleAssets()`, `v32-upgrade.js:429-436` |

Вкладка «Отказы» скрыта для внешних агентов (`R().external`) - `v32-upgrade.js:440-441`.

Экран «Реестр продаж» (`reg`):
- если объект в шапке = «Все объекты» - карточка-подсказка «Выберите конкретный объект…» (`:365`);
- если у объекта не включена продажа (`objSaleOn`) - карточка `scrSaleOffCard` (`:361`)
  с кнопкой «✎ Настройки объекта»;
- 7 KPI-плиток: Юнитов / Свободно / Бронь / Договор / Продано / Ср. цена $/м² / Портфель продаж, $ (`:369-377`);
- тулбар `.case-adaptive-actions` (`:381-387`);
- таблица через **общее табличное ядро** `buildTable('scr_registry', cols, units, {rowClick:openUnit})`
  (`v32-upgrade.js:403`); колонки: Код, Блок, Этаж, Категория, м², Цена $/м², Сумма продажи,
  Статус продажи, Варианты (бренды), Брокер (`:389-401`).

Экран «Планировка продаж» - не рисует план сам: кнопка «Открыть план продаж →» ставит
`S.planMode='sale'` и делает `go('plans')` (`v32-upgrade.js:446`).

Экран «Инвест-объекты» - два блока-таблицы (`SALE ASSETS` и `BUYERS`) плюс 6 KPI-плиток:
Объект / Инвесторские заявки / Покупатель / Комиссия / Взвешенный / Упущено (`:431-435`).

Канбана и карты в SCR нет.

**4.4 Формы.**

*Форма инвест-объекта* `v32AssetForm(aid)` - `v32-upgrade.js:479`:
`sa_name` (text, Объект) · `sa_type` (text, Type) · `sa_country` (text, Страна) ·
`sa_city` (text, Город) · `sa_area` (number, Мин. м²) · `sa_price` (number, Цена) ·
`sa_cr` (number, «% Комиссия», умолч. 2) · `sa_comm` (number, Комиссия) ·
`sa_stage` (select, Стадия) · `sa_broker` (text, Ответственный) · `sa_vis` (select, Доступ) ·
`sa_seller` (text, Продавец) · `sa_next` (text, Следующее действие) · `sa_due` (date, Дедлайн, +7 дней) ·
`sa_notes` (textarea, Notes).
Расчёт при сохранении: `comm = num('sa_comm') || price*cr/100` (`:480`).
Валидация: пустое имя → toast «Объект - Обязательное поле».

*Форма покупателя* `v32BuyerForm(bid)` - `v32-upgrade.js:481`:
`sb_name` (Покупатель) · `sb_type` (Asset type) · `sb_country` · `sb_city` · `sb_broker` ·
`sb_bmin` (number, Budget min) · `sb_bmax` (number, Budget max) · `sb_amin` (number, Мин. м²) ·
`sb_amax` (number, Макс. м²) · `sb_cap` (text, Cap rate) · `sb_contact` (text, «Email / Телефон») ·
`sb_notes` (textarea, Notes). Валидация: пустое имя → toast «Покупатель - Обязательное поле».

*Инлайн-редакторы в таблице реестра продаж* (только при `scrCanEdit()` = `edit||admin`, `:354`):
- select статуса продажи - `scrStatusCell`, `v32-upgrade.js:407`;
- `input[type=number]` цены $/м² - `scrPriceCell`, `v32-upgrade.js:408`.
Оба с `event.stopPropagation()`, чтобы клик не открывал карточку юнита.

*Форма отказа* - общая с LCR: `addRefus()` (`core.js:2759`), поля `rf_obj` (select, Объект),
`rf_unit` (select, Помещение), `rf_brand` (text, Бренд, который отказал), `rf_cond` (textarea,
Что / на каких условиях предлагали), `rf_reason` (textarea, Причина отказа).

**4.5 Действия.**
| Кнопка / контрол | Что делает | Подтверждение |
|---|---|---|
| Вкладки ▤/▭/⊘/◆ | `scrTab()` → перерисовка | нет |
| «▭ Планировка продаж» (тулбар) и «Открыть план продаж →» | `S.planMode='sale'; go('plans')` | нет |
| «⬇ CSV / Excel» (`scrExportCSV`, `v32-upgrade.js:409`) | CSV с BOM, `;`-разделитель, файл `SCR_<obj>.csv`, колонки Код/Блок/Этаж/Категория/Площадь/Цена/Сумма/Статус/Брокер | нет |
| select статуса продажи | `scrSetSaleStatus` (`:452`): пишет `u.saleStatus`, `persist()`, `audit('SCR: статус продажи', code → v)`, `refreshViewKeepScroll()` | нет |
| поле цены | `scrSetSalePrice` (`:453`): `u.salePrice`, `persist()`, refresh. Аудита нет | нет |
| клик по строке | `openUnit(u.id)` - карточка помещения в drawer (`core.js:3621`) | - |
| «+ Добавить объект продажи» / «+ Добавить покупателя» | модалки | нет |
| «Подбор» на активе (`v32MatchBuyers`, `v32-upgrade.js:483`) | фильтрует `SALES_BUYERS` по бюджету/площади/городу, модалка со списком | нет |
| «Инвесторские заявки» | `go('v32_investors')` | нет |
| «+ Отказ» | `addRefus()` | нет |
| 🗑 в отказном листе | `deleteRefus(obj,i)` - `core.js:2795` | **да**: `confirm('Удалить запись об отказе «…»?')` |
| «✎ Настройки объекта» | `addObjectForm(oid)` - `core.js:1600` | нет |

**4.6 Путь от контакта до сделки (продажа).**
- *Поюнитная продажа*: реестр продаж → select статуса `savail → sresv → sdeal → ssold`;
  цена вводится прямо в ячейке; карточка юнита открывается кликом по строке.
- *Продажа объекта целиком*: `v32_investors` (лид) → «Подобрать объекты» → «В шорт-лист» →
  «Создать покупателя» → вкладка «Инвест-объекты» → карточка актива:
  `lead → nda → dd → offer → spa → closed`; на каждом шаге стадия меняется только через
  форму `v32AssetForm` (селект `sa_stage`), отдельных кнопок-переходов нет.

**4.7 После закрытия.** При `stage='closed'` актив переносит `expectedCommission` в колонку `earned`
(`v32-upgrade.js:239`); отдельного движка выплат по продаже (аналога `v326_lease`) **не найдено**.
Передачи в эксплуатацию из SCR **не найдено**.

---

## 5. `v326_lease` - «Комиссии аренды»

**5.1 Сущности.** `window.LEASE_COMMISSION_DEALS` (массив) и `window.COMMISSION_ENGINE_CFG.lease`
(объект настроек) - `v326-commission-engines.js:8` (`DATA_KEYS`), инициализация - `:129-133`.
Дефолты конфигурации - `defaultCfg()`, `v326-commission-engines.js:113-128`:
`fxRate:11974`, `baseMethod:'manual'`, `annualPercent:8`, `fixedAmount:0`, `needsAshConfirmation:true`,
`curatorName:'Нодир'`, `supportName:'Хилола'`, `curatorSelfShare:25`, `externalAgentShare:20`,
`internalAgentShare:15`, `curatorShare:5`, `supportShare:5`, `scenario3CompanyShare:75`,
`internalMonthlySalary:0`, `splitDefault:'equal'`, `offTheTop:true`.

Поля сделки (`formDealFromDOM`, `v326-commission-engines.js:249`):
`id, objectName, unit, tenant, area, rate, termMonths, signedDate, baseMethod, commissionBase,
annualPercent, currency, scenario, stage, paymentStatus, agent1, agent2, split1, split2, curator,
support, salaryAllocation, notes, broker, createdAt` + `ashConfirmed, ashConfirmedBy, ashConfirmedAt`
+ при авто-создании `unitId, autoCreated:true` (`core.js:465`).

**5.2 Стадии и статусы.**
- Стадия сделки `stageOpts()` - `v326-commission-engines.js:195`:
  `lead` Lead · `neg` Negotiation · `loi` LOI · `contract` Contract signing · `signed` Signed ·
  `paid` Paid · `lost` Lost · `reversed` Reversed. Русских подписей нет.
- Вероятности `stageProb` (`:126`): lead 20 / neg 35 / loi 65 / contract 85 / signed 100 /
  paid 100 / lost 0 / reversed 0.
- Статус выплаты `paymentStatus` (селект `lc_pay`, `:239`):
  `pending` «Ожидается», `paid` «Выплачено», `lost` «Упущено», `reversed` «Реверс».
- Сценарий закрытия `scenario` (селект `lc_scenario`, `:239`):
  `curator_self` «Куратор закрыл сам», `external` «Закрыл внешний агент»,
  `internal` «Закрыл внутренний агент».
- Метод базы `baseMethod` (`lc_base_method`, `:238`):
  `manual` «Ручной ввод / виза ASH», `one_month` «1 месячная аренда»,
  `annual_percent` «% годовой аренды», `fixed` «Фикс».

**5.3 Экраны.** Один экран, только таблицы. `renderLease()` - `v326-commission-engines.js:210-225`:
1. `pageHead` с чипом приватности (`:209`);
2. 5 KPI: Валовая комиссия / Выплачено / Ожидается / Weighted forecast / Упущено (`:212-218`);
3. карточка «Правила» с чипами конфигурации и кнопкой «Настройки» (`:219-221`);
4. `.v326-split` - слева таблица `LEASE LEDGER` («Реестр»), справа `renderLeaseProfile`
   («Профиль» для агента / «Начисления» для finance-ролей, `:226-231`).
Колонки реестра: Сделка (объект+юнит+дата) / Арендатор / Тип закрытия / C / Выплаты /
Статус (+бейдж `✓ ASH` или `! ASH`) / кнопка «Открыть». Авто-созданные строки подсвечены и
помечены чипом «авто» (`:222`).
Канбана, карточек, карты нет. Переключателя видов нет.

**5.4 Формы.**

*Форма сделки* `v326LeaseDealForm(did)` - `v326-commission-engines.js:232-246`:

| id | тип | подпись |
|---|---|---|
| `lc_obj` | select (из `window.OBJECTS`) | Объект |
| `lc_unit` | text | Помещение |
| `lc_tenant` | text | Арендатор |
| `lc_area` | number | Площадь |
| `lc_rate` | number | Ставка |
| `lc_term` | number | Срок (умолч. 12) |
| `lc_signed` | date | Дата подписания (умолч. сегодня) |
| `lc_base_method` | select | Метод базы C |
| `lc_C` | number | База комиссии C |
| `lc_annpct` | number | % annual |
| `lc_cur` | select | Валюта (USD / UZS) |
| `lc_scenario` | select | Тип закрытия |
| `lc_stage` | select | Стадия |
| `lc_pay` | select | Статус выплаты |
| `lc_ash` | checkbox | «Требует подтверждения ASH» - **рисуется только при `rights().approve`**; остальным показывается чип-статус (`:240`) |
| `lc_a1` | select (brokers) | Агент 1 |
| `lc_a2` | select | Агент 2 (пустое = «-») |
| `lc_split1` | number | % A1 |
| `lc_split2` | number | % A2 |
| `lc_curator` | select | Куратор |
| `lc_support` | select | Поддержка |
| `lc_salary` | number | Оклад / аллокация |
| `lc_notes` | textarea | Notes |

Живой предпросмотр распределения - `#v326LeasePreview`, пересчёт на каждый `oninput`/`onchange`
формы (`v326LeasePreview`, `:258`): чипы C / Агент / Куратор / HO / Компания / Чистая прибыль +
таблица Участник · Роль · Доля % · Сумма.

*Форма настроек* `v326LeaseSettings()` - `v326-commission-engines.js:262-266`:
`ls_base` (select, Метод базы C) · `ls_ann` (number, % annual) · `ls_fixed` (number, Фикс) ·
`ls_cs` (number, Куратор закрыл сам) · `ls_ex` (number, Внешний агент) · `ls_in` (number,
Внутренний агент) · `ls_ho` (number, HO) · `ls_curshare` (number, Куратор) ·
`ls_comp3` (number, «Компания scenario 3») · `ls_sal` (number, Оклад / аллокация) ·
`ls_fx` (number, Курс ЦБ) · `ls_curname` (text, Куратор) · `ls_supname` (text, Поддержка) ·
`ls_ash` (checkbox, Требует подтверждения ASH).
Кнопка «Настройки» в шапке видна только при `canAll()` = `admin||finance||approve` (`:224`).

**5.5 Действия.**
| Кнопка | Что делает | Подтверждение |
|---|---|---|
| «+ Добавить сделку» | открывает форму | нет |
| «Сохранить» (`v326SaveLeaseDeal`, `:259`) | валидация → upsert → `audit326('Lease commission deal saved', …)` → `persist326()` → закрытие → `go('v326_lease')` | нет |
| «Отчёты» (`v326LeaseReport`, `:268`) | модалка со сводкой по участникам и ролям | нет |
| «Экспорт» (`v326ExportLease`, `:269`) | CSV `case_os_lease_commission_ledger.csv`; экранирование формул `^[=+\-@]` - `:207` | нет |
| «Настройки» (`v326SaveLeaseSettings`, `:267`) | пишет конфиг, `audit326('Lease commission settings changed')` | нет |
| «Открыть» на строке | форма сделки с id | нет |
Удаления сделок **не найдено**.

Правила валидации при сохранении (`:259`):
1. пустой `tenant` → `fieldWarn('lc_tenant', 'Арендатор - обязательное поле')` (подсветка + `alert`, `:260`);
2. `paymentStatus==='paid'` при `cfg.needsAshConfirmation` и без `ashConfirmed` →
   `fieldWarn('lc_pay','Требует подтверждения ASH - обязательное поле')`.
Флаг ASH из DOM принимается только у роли с правом `approve`; у остальных сохраняется прежнее
значение записи (`v326-commission-engines.js:251-253`).

**5.6 Путь.** Отдельного «пути от контакта» здесь нет - раздел подключается **после** подписания:
сделка либо заводится вручную («+ Добавить сделку»), либо создаётся автоматически при переводе
юнита в «Контракт подписан» (см. §6.7). Далее внутри карточки:
`stage lead→…→signed` и `paymentStatus pending → paid` (последнее - только с визой ASH).

**5.7 Расчёт распределения** - `leaseBase()` (`:154`) и `leaseCalc()` (`:167-188`):
- `monthly = deal.monthlyRent || area*rate`, `annual = monthly*12`;
- база `C`: `one_month`→monthly; `annual_percent`→`annual*%/100`; `fixed`→fixedAmount;
  `manual`→введённое `commissionBase`;
- сценарий `curator_self`: куратор `C*curatorSelfShare/100`, поддержка `C*supportShare/100`,
  агентам 0;
- сценарий `internal`: агенты `C*internalAgentShare/100`, куратор `C*curatorShare/100`,
  поддержка `C*supportShare/100`, плюс `salary = salaryAllocation || internalMonthlySalary`;
- иначе (`external`): агенты `C*externalAgentShare/100`, куратор и поддержка как выше;
- `company = C − agentTotal − curator − support`; `companyNet = company − salary`;
- доля между агентами: при двух агентах и пустых сплитах - 50/50, иначе нормируется к 100 (`:170`).

Журнал начислений `leaseLedgerRows()` (`:190-194`): по каждому участнику каждой сделки строка с
`earned` (если `paid`/`signed`), `lost` (если `lost`/`reversed`/`canceled`) либо `pending` +
`weighted = amount × вероятность стадии`.

**5.8 Приватность.** `visibleLeaseDeals()` (`:189`): без `admin/finance/approve` видны только сделки,
где пользователь = `agent1`, `agent2`, `broker`, `curator` или `support`. Строки журнала
дополнительно фильтруются по имени (`:193`). Для AGX раздел закрыт заглушкой
`renderExternalLocked()` (`v4327-patch.js:240`, `:234`).

---

## 6. `registry` - «Контроль аренды (LCR)»

**6.1 Сущности.** Юниты `U` - `core.js:342`, фабрика `unit()` - `core.js:343`
(поля `id, obj, code, floor, area, terr, cat, sub, rate, total, gap, status, broker, vars[],
dates[], comment, merged, hist[]`), плюс добавляемые по ходу: `block, format, concept, zone,
budget, budLand, factLand, capex, saleStatus, salePrice, offers[], offer, shortlist[], comments[],
extraCats[]`.
Смежные массивы: `CHANGES` (`core.js:418`) - журнал изменений в ходе сдачи;
`REFUSALS` (`core.js:362`) - отказной лист; `DOCREG` (`core.js:3810`) - реестр документов.
Всё уходит в `stateBlob()` (`core.js:130`); подпись `U:'Реестр помещений / ЛСР'` - `core.js:156`.

**6.2 Статусы аренды** - `STAT` (`core.js:323`), классы `STCLS` (`core.js:324`),
переводы `STAT_UZ`/`STAT_EN` (`core.js:325-326`), выбор языка `stT` (`core.js:331`):

| код | RU | UZ | EN |
|---|---|---|---|
| `vac` | Вакант | Boʻsh | Vacant |
| `neg` | Переговоры | Muzokara | Negotiation |
| `off` | Предложено | Taklif qilindi | Offered |
| `os` | Предложение подписано | Taklif imzolandi | Offer signed |
| `cs` | Контракт на подписании | Shartnoma imzolanmoqda | Contract signing |
| `cd` | Контракт подписан | Shartnoma imzolandi | Contract signed |
| `res` | Резерв | Rezerv | Reserved |

Занятые статусы `OCCK=['cd','cs','os']` (`core.js:333`) - обнуляют `u.gap`.
Пайплайн комиссий `COMM_PIPE=['neg','off','os','cs','res']` (`core.js:448`),
вероятности `COMM_PROB={neg:20,off:40,os:65,cs:85,res:50,cd:100}` (`core.js:449`).

**6.3 Экраны.** `renderRegistry()` - `core.js:1515-1587`.
- Верхний переключатель видов `regPlanTabs()` (`core.js:1924`) - 4 кнопки:
  «▤ Таблица» (`go('registry')`), «▭ Планировка» (`S.planViewTab='plan'; go('plans')`),
  «⫽ Канбан» (`S.planViewTab='kanban'; go('plans')`), «✓ Валидация / LCR» (`go('plan_master')`).
- Внутренние вкладки самого реестра (`core.js:1522`): «План / бюджет» (`S.regTab='plan'`),
  «Изменения (в ходе сдачи)» (`chg`), «Отказы» (`refus`, скрыта для `R().external` - `core.js:1521`).
- **Таблица** - двухъярусная шапка `regHeadRow` (`core.js:1892-1919`) с группами «Бюджет» и «Факт»
  (сворачиваются кликом, `regToggleGrp`). Колонки: чекбокс, Помещение, Блок (если есть блоки),
  Этаж, Категория, м², группа Бюджет, группа Факт, Варианты, Брокер, Комментарий, Статус.
  Колонки Бюджет (`_lcrBudColsAll`, `core.js:1870-1877`): `b_base` «Базовая аренда, $/м²»,
  `b_land` «Аренда посадки, $/м²», `b_tot` «Итого аренда, $/мес», `b_svc` «Обслуживание, $/м²»,
  `b_tots` «Итого вкл. обсл., $/мес», `b_capex` «CAPEX, $».
  Колонки Факт (`_lcrFacColsAll`, `core.js:1878-1885`): `f_base`, `f_land`, `f_tot`, `f_svc`,
  `f_tots`, `f_diff` «Разница, $/мес» (цветная).
- **Канбан** - `renderKanban()` (`core.js:1925-1928`), 5 колонок: Переговоры / Предложено /
  Предложение подписано / Контракт на подписании / Контракт подписан. Живёт внутри «Планировок»
  (`core.js:2326`); в самом реестре стоит только баннер-указатель (`core.js:1943`).
- **Карта** - в разделе `registry` нет.
- Карточка юнита - drawer `openUnit()` (`core.js:3621-3637`).

Если у объекта выключена аренда (`objLeaseOn`) - вместо реестра карточка «это объект только продажа»
с кнопками «✎ Настройки объекта» и «Открыть SCR →» (`core.js:1519`).

**6.4 Формы.**

*Фильтр-бар* `regFilterBar()` - `core.js:1512-1514`: поиск (текст), страна, город (только при
`S.obj==='ALL'`), блок, этаж, статус, категория.

*Инлайн-правка строки* `regEditRow()` - `core.js:1694`; включается кнопкой «✎ Правка»
(`toggleRegEdit`), сохранение - `saveCellLive()` (`core.js:1634`); правка ячейки двойным кликом -
`editCell()` (`core.js:1624`), запись - `saveCell()` (`core.js:1631`).

*Карточка помещения* `unitForm(id)` - `core.js:3739-3756`:

| id | тип | подпись |
|---|---|---|
| `e_code` | text | Код помещения |
| `e_floor` | text | Этаж |
| `e_block` | text | Блок (если объект разделён) |
| `e_cat` | select | Категория |
| `e_sub` | text + datalist | Подкатегория |
| `e_format` | text + datalist | Формат |
| `e_concept` | text + datalist | Концепт |
| `e_zone` | text + datalist | Зона |
| `e_area` | text/число | Площадь, м² |
| `e_terr` | text/число | Терраса, м² |
| `e_rate` | text/число | Ставка, $/м² (факт/предложение) |
| `e_status` | select | Статус (аренда) - 7 значений `STAT` |
| `e_salestatus` | select | Статус продажи (SCR) - 4 значения `SALESTAT` |
| `e_budget` | text/число | Бюджетная ставка, $/м² (план для владельца) |
| `e_broker` | select | Брокер |

Сохранение `unitSave()` - `core.js:3765-3771`: проверка уникальности кода внутри объекта
(`alert`), `rateEditGuard()` (`core.js:1629`) - защита от смены ставки при живой брони,
пересчёт `total`/`gap`, `commTrack()`, запись в `hist`, `audit('Правка помещения')`, `persist()`.

*Другие модалки той же воронки*: `addUnitDate` (`core.js:3691`, поля `ud_type`/`ud_custom`/`ud_date`,
типы дат: Открытие, Окончание брони, Подписание контракта, Окончание договора, Ревизия ставки,
Дедлайн), `mergeUnitForm` (`mg_to`), `splitUnitForm` (`sp_code`, `sp_area`),
`areaTransferForm` (`at_from`, `at_to`, `at_area`), `varToRefusal` (`vr_cond`, `vr_reason`).

**6.5 Действия (панель `case-adaptive-actions`, `core.js:1571-1584`).**
| Кнопка | Что делает | Подтверждение |
|---|---|---|
| «+ Помещение» (`addUnit`, `core.js:1734`) | создаёт юнит `NEW-n` со статусом `vac`, затем открывает `unitForm` | `alert`, если выбрано «Все объекты» |
| «✎ Правка» (`toggleRegEdit`) | инлайн-редактирование, сверху баннер-предупреждение (`core.js:1586`) | нет |
| «▾ Бюджет/Факт» (`regToggleFin`) | сворачивает группы столбцов | нет |
| «Мои сделки» (`S.regMine`) | фильтр по брокеру; при `R().ownOnly` заменяется неотключаемой меткой «Только свои» | нет |
| «+ Объект» / «✎ Изменить объект» (`addObjectForm`, `core.js:1600`) | форма объекта, включая чекбоксы `o_lease` «Аренда (LCR)» и `o_sale` «Продажа (SCR)» | нет |
| «⬆ Импорт CSV» (`importRegCSV`) | импорт реестра | - |
| «⬇ Экспорт…» | Excel RU/UZ/EN (`exportLCRExcel`) или CSV (`exportRegCSV`) | нет |
| «⬓ Блоки из кодов», «∑ GLA из юнитов», «↔ Сбросить ширину» | сервисные | нет |
| select статуса в строке | `saveCell(id,'status',v)` → пересчёт `gap`, `commTrack`, `hist`, `audit`, `persist` | нет |
| поле комментария в строке | Enter → `regQuickComment` (`core.js:1721`) | нет |
| Панель выделения `selbar` (`core.js:1570`) | «Сформировать КП по выбранным» (`regBulkKP`, `core.js:1735`), «Статус всем…» (`bulkStatus`, `:1736`), «Брокер всем…» (`bulkBroker`, `:1737`), «⊕ Объединить», «№ Перенумеровать» (`:1739`), «🗑 Удалить» (`:1753`), «Снять выбор» | удаление и часть массовых операций - через `confirm`/`alert` (`core.js:1753`, `1761`) |
| Канбан drag&drop | `kanDrop` (`core.js:1929`): меняет статус, `commTrack`, `hist`, `audit('Канбан (статус)')`, `persist`; без права `edit` - `alert('Нет прав на изменение статуса.')` | нет |

Действия из карточки юнита (`core.js:3629`): «✎ Редактировать помещение», «Сформировать КП»
(`go('docs')` + `pickT('kp',id)`), «Напоминание» (`remindFromUnit`, `core.js:3641`),
«Переговоры» (`negotiateUnit`, `core.js:3723` - `prompt` со списком брендов, `vac|res → neg`),
«＋срок» продление брони (`extendOffer`, `core.js:3712` - `prompt` количества дней),
«→ отказ» перенос варианта в отказной лист (`varToRefusal`, `core.js:3679`),
«✕» удаление варианта (`delVar`, `core.js:3678` - **с `confirm`**).

**6.6 Путь от первого контакта до подписанного договора (аренда).**
1. **Спрос**: «Запросы брендов» (`v32_requests`) → «Подбор» → «В шорт-лист» - бренд падает в
   `u.vars`/`u.shortlist`, юнит `vac → neg` (`v32-upgrade.js:471`).
   Либо напрямую из карточки юнита кнопкой «Переговоры» (`core.js:3723`).
2. **Реестр LCR** (`registry`, вкладка «План / бюджет») - статус `neg` «Переговоры».
3. **КП**: «Сформировать КП» из карточки или «Сформировать КП по выбранным» из панели выделения →
   экран «Документы» (`go('docs')`, `renderDocs` - `core.js:3974`), форма `#dform`, генерация
   `genKP()` - `core.js:4050-4117`.
   `genKP` - источник правды: по всем кодам из поля «Помещение(я)» проставляет `u.rate`, `u.budget`,
   создаёт `u.offers[]` с `validUntil`, ставит статус `off` «Предложено» (если юнит не занят),
   добавляет контрольную дату «Окончание брони (КП …)», пишет `u.hist`, при повторном номере КП -
   новую редакцию с дифом (`audit('КП: новая редакция')`). Конфликт («уже предложено другим агентом»)
   - **`confirm`** (`core.js:4093`).
4. **Валидация до генерации** - `v32-upgrade.js:497-500` (`docReqs`/`validateDoc`): для КП обязательны
   `f_ten` (Бренд), `f_unit` (Объект/помещение), `f_area` (>0), `f_rate` (>0); чек-лист готовности
   документа в процентах - `injectDocChecklist`/`updateDocChecklist` (`v32-upgrade.js:501-502`);
   бренда нет в базе → предложение «+ Добавить бренд» (`ensureBrandInBase`, `v32-upgrade.js:503`).
5. **LOI** - `genLOI()` (`core.js:4118-4127`), три типа: `unit` (по помещению), `brand`
   (стратегическое соглашение с брендом), иначе - по объекту. Срок действия `f_val` дней.
   Статус юнита при LOI автоматически не меняется.
6. **Статус `os` «Предложение подписано» → `cs` «Контракт на подписании» → `cd` «Контракт подписан»** -
   вручную: select в строке реестра, select в карточке (`e_status`) или перетаскивание карточки в
   канбане.
7. Параллельно: отказавшиеся бренды уходят в отказной лист (`varToRefusal` → вкладка «Отказы»),
   изменения по ходу сдачи - во вкладку «Изменения» (`addChange`, `core.js:1920`).

**6.7 Что происходит после подписания (`status → 'cd'`).**
Триггер - `commTrack()` (`core.js:479-493`), вызываемый из `saveCell`, `saveCellLive`, `unitSave`,
`bulkStatus`, `bulkBroker`, `kanDrop`. При `u.status==='cd' && prevStatus!=='cd'`:
1. **`commAutoLeaseDeal(u)`** (`core.js:465-470`) - автоматически создаёт запись в
   `window.LEASE_COMMISSION_DEALS` (раздел «Комиссии аренды»), если модуль загружен и по этому
   юниту сделки ещё нет. Поля: `unitId`, `objectName`, `unit`, `tenant = commUnitBrand(u)`,
   `area`, `rate`, `termMonths:12`, `signedDate: сегодня`, `baseMethod:'manual'`,
   `commissionBase = commFeeU(u)`, `currency:'USD'`, `scenario:'external'`, `stage:'signed'`,
   `paymentStatus:'pending'`, `agent1 = u.broker`, `split1:100`, `autoCreated:true`,
   заметка «Авто-создано при переходе в «Контракт подписан»».
   В реестре комиссий такая строка подсвечена и помечена чипом «авто» (`v326-commission-engines.js:222`).
2. **`commAutoCriticalDate(u)`** (`core.js:471-478`) - добавляет контрольную дату
   «Окончание договора (авто, уточнить)» на +1 год и пишет строку в `u.hist`.
3. **Комиссия CASE** считается формулой `commFeeU(u) = total × 12 × o.comm.total%`
   (`core.js:460`), доля агента - `commAgentPct` (`core.js:461`, персонально `a.commPct`,
   иначе общий `COMMCFG.agentPct`, по умолчанию 30 - `core.js:446`),
   агентская сумма - `commAgentFeeU` (`core.js:462`).
4. **Потерянная комиссия** `COMMLOST` (`core.js:447`, запись - `core.js:491`): фиксируется, если
   юнит передан другому брокеру, снят с агента или сделка сорвалась (`vac` после пайплайна).
5. **Передача в эксплуатацию** из LCR - прямых вызовов **не найдено** в перечисленных файлах
   (в `validViews` присутствуют `leasing_opening`, `tenant_contracts`, `facility_management`,
   `core.js:1144`, но переходов туда из реестра нет).

---

## 7. `brands` - «База брендов»

**7.1 Сущности.** `BRANDS` - `core.js:451` (фабрика `brand()` - `core.js:450`), доступ из модуля -
`v35-stable.js:12` (`coreBrands`). Подпись ключа - `core.js:156` (`BRANDS:'База брендов'`).
Личные настройки таблицы - `localStorage['caseos_brand_table_prefs::<user>']`
(`v35-stable.js:20-22`), черновик карточки - `localStorage[DRAFT_KEY]` (`v35-stable.js:364-366`).

**7.2 Статусы бренда** - `statuses()` (`v35-stable.js:175`), пары «полная / короткая подпись»:

| код | полная | короткая |
|---|---|---|
| `target` | Потенциальный | Пот |
| `contacted` | Был контакт | Конт |
| `active` | Активный | Акт |
| `inactive` | Неактивный | Неакт |
| `refused` | Отказ | Отказ |

Умолчание при сохранении - `target` (`v35-stable.js:446`).
Дополнительные «уровни»: `price` и `tier` - A/B/C/D (`v35-stable.js:410`);
`presence` (Присутствие в Узбекистане): «Есть в Узбекистане» / «Нет в Узбекистане» /
«Выходит на рынок» / «Уточнить» (`v35-stable.js:410`).

**7.3 Экраны - три вида, переключатель в тулбаре.** `renderBrandsStable()` - `v35-stable.js:339-343`,
контент - `buildBrandContent()` (`v35-stable.js:282-291`), переключение -
`asaas35SetView(v)` (`v35-stable.js:259`), состояние `BF.view` сохраняется в localStorage.

| код | кнопка | что рисует |
|---|---|---|
| `table` | «Таблица» | `.asaas35-table` с 15 колонками и строкой пофильтровых полей |
| `list` | «Список» | `.asaas35-list`, строки `brandLine` |
| `cards` | «Карточки» | `.asaas35-cards`, карточки `brandCard` с бейджем статуса |

Колонки таблицы (`v35-stable.js:288`): Название, Статус, Категория, Подкатегория, Тип, Страна,
«Цена, уровень», «Бренд, уровень», «Мин. площадь, м²», «Макс. площадь, м²», Ответственный,
Контакт, Действия, Комментарии (+ колонка чекбокса).
Чипы-фильтры (`v35-stable.js:342`): Все / Мои / Есть запрос / Без контакта / Без площади /
Без категории / Требует проверки / Дубли. Логика - `passBrand` (`v35-stable.js:193-203`).
Поиск - `#bf_q`; поле «Подходит под м²» - `#bf_fit` (`fitArea`, `v35-stable.js:187`).
Пагинация: 50 / 100 / «Показать ещё» / «Все» (`pagerHtml`, `v35-stable.js:298`).
Меню колонки в стиле Excel - `asaas35ColMenu` (`v35-stable.js:258`): сортировка А→Я / Я→А,
условия (Содержит, Не содержит, Начинается с, Заканчивается на, Равно, Не равно, Пусто, Не пусто;
для числовых - Больше, ≥, Меньше, ≤, =, ≠, Между, Вне диапазона), список значений с поиском,
кнопки «Сбросить / Отмена / Применить».
Карты в разделе нет.

**7.4 Форма карточки бренда** - drawer `brandFormStable(b,isNew)`, `v35-stable.js:410-428`:

| id | тип | подпись |
|---|---|---|
| `bd_name` | text | Название бренда |
| `bd_group` | text | Компания / группа / владелец бренда или франшизы |
| `bd_cat` | text + datalist `brandCatDL` | Категория |
| `bd_sub` | text + datalist `brandSubDL` | Подкатегория |
| `bd_type` | text + datalist `brandTypeDL` | Тип |
| `bd_alco` | checkbox | Алкоголь («продаёт / подаёт алкоголь»), показывается только для категорий с алкоголем |
| `bd_country` | text + datalist `countryDL` | Страна |
| `bd_status` | select | Статус (5 значений) |
| `bd_presence` | select | Присутствие в Узбекистане |
| `bd_owner` | text + datalist `ownerDL` | Ответственный |
| `bd_lastc` | date | Последний контакт |
| `bd_format` | text | Формат |
| `bd_price` | select | Ценовой уровень (A-D) |
| `bd_tier` | select | Уровень бренда (A-D) |
| `bd_amin` | text | Площадь min, м² |
| `bd_amax` | text | Площадь max, м² |
| `bd_areaVariants` | textarea | Варианты площади / исходное значение |
| `bd_fr` | text | Франшиза / модель |
| `bd_reqs` | textarea | Требования к помещению |
| `bd_coten` | text | Co-tenancy |
| `bd_reviewFlag` | textarea | Проверка данных |
| `bd_founded` | text | Год основания |
| `bd_icsc` | text | Формат ICSC |
| `bd_netPts` | text | Сеть: точек |
| `bd_netCountries` | text | Сеть: стран |
| `bd_uzOp` | text | Оператор в Узбекистане |
| `bd_about` | textarea | О бренде |
| `bd_pos` | textarea | Позиционирование |
| `bd_concept` | textarea | Концепция и ассортимент |
| `bd_rec` | textarea | Рекомендация CASE |
| `bd_c_<i>_name` | text | ФИО (повторяемый блок контактов) |
| `bd_c_<i>_title` | text | Должность |
| `bd_c_<i>_cc` | text + datalist `ccDL` | Код страны |
| `bd_c_<i>_phone` | text | Номер телефона |
| `bd_c_<i>_email` | text | Email |
| `bd_site` | text | Сайт |
| `bd_ig` | text | Instagram |
| `bd_notes` | textarea | О бренде / комментарии |

Блок контактов: `contactRowHtml` (`v35-stable.js:401`), кнопки «+ Добавить контакт»
(`asaas35AddContact`, `:406`) и «Удалить контакт» (`asaas35RemoveContact`, `:407`).
Черновик нового бренда пишется в localStorage на каждый input/change (`wireDraftForm`, `:408`)
и восстанавливается при открытии (`brandEditStable`, `:409`).

**7.5 Действия.**
| Кнопка | Что делает | Подтверждение |
|---|---|---|
| «+ Добавить бренд» | `brandEdit()` → черновик | нет |
| «+ Запрос от бренда» | `v32RequestForm()`, иначе `go('v32_requests')` (`v35-stable.js:342`) | нет |
| «⬆ Импорт CSV/XLSX» (`asaas35ImportBrands`, `:344`) | делегирует `asaas3518ImportPicker`/`importBrandsCSV` | нет |
| «Шаблон CSV» | `asaas3515DownloadTemplate()` | нет |
| «⬇ Экспорт CSV» (`asaas35ExportBrands`, `:352`) | `exportBrandsCSV()` | нет |
| «Очистить фильтры» / «↕ Сбросить сортировку» / «Очистить всё» | `:249-251` | нет |
| «Сохранить бренд» (`asaas35SaveBrand`, `:446`) | upsert, нормализация телефонов, запись в `b.hist`, `persistSafe()`, закрытие drawer, toast «Бренд сохранён» | нет (при пустом имени - фокус + toast) |
| «Очистить черновик» | удаляет ключ localStorage | нет |
| «🗑 Удалить бренд» (`asaas35DeleteBrand`, `:429`) | в корзину `trashPut('brand',…)`, `audit('Удалён бренд')` | **да**: `confirm('Удалить бренд «…»? Бренд будет перемещён в корзину.')`; без прав - `alert('Недостаточно прав.')` |
| «Открыть» / клик по строке | `asaas35OpenBrand` → карточка | - |

**7.6 Место в воронке.** База брендов - вход воронки аренды: бренд из неё попадает в варианты
помещения через шорт-лист (`v32RequestToUnit`) и в поле «Арендатор» при генерации КП;
`ensureBrandInBase` (`v32-upgrade.js:503`) не даёт выпустить КП на бренд, которого нет в базе, и
предлагает добавить его прямо из формы документа (`v32AddBrandFromDoc`, `v32-upgrade.js:505`).
Обратной связи «подписан договор → статус бренда» **не найдено**.

**7.7 После подписания.** Автоматических изменений карточки бренда не происходит: статус меняется
только вручную в форме.

Для AGX раздел подменяется формой «Новый бренд» (`v4327-patch.js:238`, `renderExternalBrand` -
`v4327-patch.js:216`): поля `ex_brand`, `ex_brand_cat`, `ex_brand_country`, `ex_brand_city`,
`ex_brand_min`, `ex_brand_max`, `ex_brand_note`, кнопка «Отправить на проверку»
(`caseSubmitExternalBrand`, `:222` → `api/brand_requests.php`).
Роль BRJ (`brandsOnly`) видит в меню только «Бренды» (`v35-stable.js:449`).

---

## 8. `v32_partners` - «Партнёры»

**8.1 Сущности.** `window.CASE_PARTNERS` (`v32-upgrade.js:7`, демо `:140-145`) и
`window.PARTNER_REFERRALS` (объявлен в `DATA_KEYS`, но экрана/формы для него **не найдено**).
Поля партнёра (`v32SavePartner`, `v32-upgrade.js:486`):
`id, name, type, country, city, owner, email, phone, access, scope, status, notes, createdAt`.

**8.2 Статусы.**
- `status` (селект `pt_status`, подписан как «Стадия»): `pending` Pending · `active` Active ·
  `paused` Paused (`v32-upgrade.js:485`);
- `access` (Доступ): `sales_only` «Sales only» · `requests_only` «Requests only» ·
  `requests_and_sales` «Requests + sales» · `readonly` «Read only»;
- `scope` (Зона доступа) - свободный текст, умолчание `assigned_city`.
Русских подписей значений нет.

**8.3 Экраны.** Одна таблица `renderPartners()` - `v32-upgrade.js:454-459`.
Колонки: Партнёры (+тип и статус) / Страна · Город / Доступ / Зона доступа / Ответственный / Действия.
Заголовок карточки - «Портал партнёров». Переключателя видов, канбана, карт нет.

**8.4 Форма** `v32PartnerForm(pid)` - `v32-upgrade.js:485`:
`pt_name` (text, Партнёры) · `pt_type` (text, Type, умолч. `Partner`) · `pt_country` (text, Страна) ·
`pt_city` (text, Город) · `pt_owner` (text, Ответственный) · `pt_email` (text, Email) ·
`pt_phone` (text, Телефон) · `pt_access` (select, Доступ) · `pt_scope` (text, Зона доступа) ·
`pt_status` (select, Стадия) · `pt_notes` (textarea, Notes).
Валидация: пустое имя → toast «Партнёры - Обязательное поле» (`:486`).

**8.5 Действия.** «+ Добавить партнёра» и «Редактировать» - только при
`canManage()` = `admin||finance||approve` (`v32-upgrade.js:19`); остальным вместо кнопки
показывается пилюля «Внутренне» (`:456`). Подтверждений нет. Удаления **не найдено**.

**8.6 Путь.** Партнёр влияет на воронку через `visibleRows()` (`v32-upgrade.js:322`): запись видна
пользователю, если у неё нет брокера, либо брокер/владелец = текущий пользователь, либо
`visibility==='partners'`. Отдельного экрана рефералов и передачи сделки партнёру нет.

**8.7 После подписания.** Начислений партнёру в этом разделе нет; внешний агент участвует в
распределении через `scenario:'external'` движка `v326_lease` (`externalAgentShare`, §5.7).

---

## 9. `leasing_portfolio_map` - «Карта объектов»

**В заданных шести файлах экран не реализован.** Найденное:
- зарегистрирован как валидный вид - `core.js:1144`;
- на нём отключён фоновой авто-refresh (`isUserBusy`) - `core.js:139`.

Фактическая реализация (за пределами списка файлов, приведена для полноты):
`/home/user/case-site/case-site/os/v493-portfolio-suite.js` - `render()` (строка 137), перехват
`go()` (строка 196), `display()` (строка 161). Линия бизнеса вычисляется по маршруту:
`leasing_portfolio_map → 'Leasing & Sales'` (`v493-portfolio-suite.js:37`).
Сущности: `CASE_PORTFOLIO_PROJECTS` плюс объекты реестра `OBJECTS`, приведённые к виду проектов
(`objectsAsProjects`, `v493-portfolio-suite.js:69-87`).
Статусы точки: `verification` = `verified` «Подтверждено вручную» / `needs_review`;
`dealState` = `lease` «Под аренду» / `sale` «Под продажу» / `done` «Выполнен».
Экраны: карта (Leaflet/OSM или Яндекс) + боковой список + панель карточки + сворачиваемая таблица.
Из карточки проекта есть переходы «Контроль аренды (LCR)» → `registry` и «Контроль продажи (SCR)»
→ `v32_sales` (`v493-portfolio-suite.js:127`).
Более ранняя версия того же экрана - `/home/user/case-site/case-site/os/v492-portfolio-proposals.js:29`
(`renderPortfolio`).

---

## 10. `v496-commissions.js` - тарифная панель комиссий (надстройка над `kpi`)

Отдельного раздела воронки не создаёт: подмешивает панель в экран `kpi`.
- монтирование только при `S.view==='kpi'` и `S.kpiTab!=='pipeline'` - `v496-commissions.js:81-87`;
  обёртка `renderKPI` - `:89-96`.
- заголовок «Тарифная система комиссий», фильтр `input[type=month]` `#tcMonth` - `:15-23`.
- данные тянутся с сервера: `apiGET('commission_tiered.php?month=…')` - `:64-78`;
  без сервера - текст «Комиссии доступны при подключении к серверу».
- два режима по `res.scope`:
  - `all` («режим: отдел (все сотрудники)») - `renderAll` (`:48-60`): KPI «Комиссия CASE за месяц» /
    «Выплачено команде» / «Остаётся компании» + таблица Сотрудник · Сделок · Закрытие ·
    Поддержка/Контроль · Итого;
  - иначе («режим: только мои начисления») - `renderOwn` (`:31-46`): KPI «Мои сделки в месяце» /
    «Закрытие» / «Поддержка/Контроль» / «Итого мне» + таблица Сделка · Комиссия · Тип · % · Мне.
- типы начислений `kindLabel` (`:62`): `close` «Закрытие», `close_override` «Закрытие (ручное)»,
  `support` «Поддержка», `control` «Контроль».
Форм ввода и кнопок действий нет - панель только для чтения.

---

## 11. Вспомогательные механизмы

**11.1 Сохранение.**
- `persist()` - `core.js:907-925`: пишет `stateBlob()` в `localStorage[STORAGE_KEY]`; при работающем
  бэкенде исключает «тяжёлые» ключи (`_HEAVY_LOCAL_KEYS`); при `QuotaExceededError` - мягкая
  деградация до ядра; при полном отказе - toast «⛔ Не удалось сохранить в этом браузере».
- `stateBlob()` - `core.js:130` (перечень сохраняемых массивов).
- Модульные обёртки, добавляющие свои ключи в стейт:
  `v32-upgrade.js:167-179` (`wrapState`, ключи `BRAND_REQUESTS, INVESTOR_REQUESTS, SALES_ASSETS,
  SALES_BUYERS, CASE_PARTNERS, PARTNER_REFERRALS, V32_NOTES`) и
  `v326-commission-engines.js:134-144` (`COMMISSION_ENGINE_CFG, LEASE_COMMISSION_DEALS, SUPPLIERS,
  SUPPLIER_COMMISSION_DEALS, SUPPLIER_COMMISSION_LEDGER`).
- Тонкие обёртки модулей: `persistV32()` - `v32-upgrade.js:180`; `persist326()` -
  `v326-commission-engines.js:145`; `persistSafe()` - `v35-stable.js:28`.
- Точечное сохранение юнита на сервер (без перезаписи всего стейта):
  `unitPatch`/`flushUnit` → `api/unit_patch.php` - `v4327-patch.js:41-63`;
  индикатор занятости очереди - `window.CASE_UNIT_PATCH_BUSY` (`v4327-patch.js:38`).
  Обработка `403` - откат поля к прежнему значению и перерисовка реестра (`v4327-patch.js:70-80`);
  `401` - правки ждут повторного входа (`:81`).
- Личные настройки таблиц: `saveTblPrefs()` (`core.js:883`) - фильтры/сортировка/вкладка реестра;
  `saveUiPrefs()` (`core.js:875`) - язык, тема, объект, вид, свёрнутость групп Бюджет/Факт.
- Черновики: документа - `saveDocDraft`/`restoreDocDraft` (`v32-upgrade.js:511-512`,
  ключ `caseos-v32-docdraft-<тип>`); карточки бренда - `v35-stable.js:364-366`.

**11.2 Журнал / аудит.**
- `audit(action,detail)` - `core.js:961`, пишет в `AUDIT` (максимум 600 записей).
- `audit326` - `v326-commission-engines.js:146-149`, дублирует в `window.AUDIT`.
- История сущности: `u.hist[]` (юнит), `b.hist[]` (бренд, `v35-stable.js:446`), `u.comments[]`.
- Отказной лист `REFUSALS` как отдельный журнал «не предлагать повторно» (`core.js:2758-2795`).
- Потерянные комиссии `COMMLOST` (`core.js:447`, `491`) с причиной и суммой.
- `CHANGES` - журнал «Изменения (в ходе сдачи)» (`core.js:418`, форма `addChange` - `core.js:1920`).

**11.3 Права.**
- `R()` - `core.js:892`; матрица ролей - `core.js:295-309`.
- В LCR: `caseCanEditRegistry()` - `v4450-ux-system.js:39`
  (`R().edit` и роль не из `READ_ONLY_REGISTRY=['AGX','BSH','BRJ']`, `v4450-ux-system.js:6`);
  инварианты ролей - `applyRoleInvariants`, `v4450-ux-system.js:16-24`;
  «белые списки» видов `SAFE_EXTERNAL` и `SAFE_BRJ` - `v4450-ux-system.js:5-6`.
- В модуле v32: `canManage()` = `admin||finance||approve` (`v32-upgrade.js:19`),
  `canEdit()` = `edit||admin||finance` (`:20`), `visibleRows()` (`:322`),
  `scrCanEdit()` = `edit||admin` (`:354`).
- В модуле v326: `canAll()` = `admin||finance||approve` (`:107`), `visibleLeaseDeals()` (`:189`);
  флаг ASH - только при `rights().approve` (`:251`).
- Маскировка брендов для внешних агентов: `brandCloak()` → «скрыто» (`core.js:459`);
  вкладка «Отказы» скрыта в LCR (`core.js:1521`) и в SCR (`v32-upgrade.js:440`).
- Ограничение меню и подмена экранов для AGX - `v4327-patch.js:198-205` (`enforceExternalRole`),
  `:235-247`.
- Ограничение по проектам: `visibleObjects()` при `R().projectScoped` (`core.js:318`).

**11.4 Табличное ядро `v432-data-grid.js`.**
- Версия ядра `GRID_VERSION='4.32.7'` - `/home/user/case-site/case-site/os/v432-data-grid.js:7`.
- Подключение через атрибуты таблиц: `data-tblkey="reg_units" data-grid-engine="lcr"`
  (LCR, `core.js:1587`), `data-case-grid-key="brands" data-grid-engine="brands"`
  (Бренды, `v35-stable.js:288`), `buildTable('scr_registry', …)` и `buildTable('scr_refus', …)`
  (SCR, `v32-upgrade.js:403`, `:426`), `buildTable('reg_chg'|'refus', …)` (LCR, `core.js:1533`, `:1544`).
- Базовая реализация `buildTable(key,cols,rows,opts)` - `core.js:1287`; состояние таблиц - `S.tbl[key]`.
- Хранение личных настроек ядра: `localStorage['caseos_grid_prefs_v4322::<user>']`
  (`v432-data-grid.js:13`) + серверная синхронизация `api/user_prefs.php`
  (`v432-data-grid.js:19-33`).
- Даёт: липкую шапку, изменение ширины столбцов, закрепление, плотность, Excel-подобные фильтры;
  сброс ширины - кнопка «↔ Сбросить ширину» (`CASE_GRID.resetWidths('reg_units')`, `core.js:1583`).
- Чипы активных фильтров над таблицей и их сброс - `v4327-patch.js:255-276`
  (`renderFilterChips`, `clearBuiltFilter`, `clearAllBuiltFilters`).

**11.5 Дизайн-система `v4450-ux-system.js`.**
- Версия `VERSION='4.59.0'` - `/home/user/case-site/case-site/os/v4450-ux-system.js:5`.
- Отвечает за доступность, «ролевые инварианты» и стабилизацию унаследованных экранов без
  переписывания бизнес-логики (комментарий в шапке файла, строки 1-2).
- Экспортирует `window.caseCanEditRegistry` (`:39`), которым пользуются LCR (`core.js:1546`, `1631`,
  `1734`, `3733`) и SCR.
- Собственные CSS-слои разделов при этом остаются локальными: `.v32-*` (`v32-upgrade.js:150-165`),
  `.v326-*` (`v326-commission-engines.js:298-303`), `.asaas35-*` (`v35-stable.js:462`),
  `.case-ext-*` (`v4327-patch.js`).
- Адаптивная панель действий `.case-adaptive-actions` с меню «⋯ Ещё» используется в LCR
  (`core.js:1585`) и SCR (`v32-upgrade.js:381-387`).

**11.6 Прочее.**
- Тосты: `toast()` - `core.js:136` (ядро) и собственный `.v32-toast` - `v32-upgrade.js:143`.
- Модалки: `.v32-modal` (`v32-upgrade.js:144-148`), `.v326-modal` (`v326-commission-engines.js:247`),
  drawer `#drawer` (`core.js:3638-3640`), `openModal`/`#rmodal` (LCR).
- Подмена нативного `alert` на модалку - `v32-upgrade.js:181-185`.
- Перерисовка без потери прокрутки - `refreshViewKeepScroll()` (`core.js:1635`);
  живое обновление после сохранения - `window.CASE_LIVE_SYNC.entitySaved(...)`
  (`core.js:3771`, `v35-stable.js:446`).
- Локализация: словари `T` (`v32-upgrade.js:26-79`), `SCRL` (`v32-upgrade.js:346-350`),
  `I18N` (`v326-commission-engines.js:25-98`), точечный перевод DOM `applyTranslation`
  (`v32-upgrade.js:186-201`).
