# Пробелы паритета: воронка аренды vs воронка Advisory (CASE OS)

Карта того, **что есть в коде** на 2026-08-14. Только факты, пути и номера строк.
Корень: `/home/user/case-site/case-site/` - ниже пути даны от него (`os/...`).

Изученные файлы: `os/core.js` (4181 стр.), `os/v32-upgrade.js` (532), `os/v326-commission-engines.js` (314),
`os/v35-stable.js` (488), `os/v490-workflow.js` (284), `os/v492-portfolio-proposals.js` (80, длинные строки),
`os/v493-portfolio-suite.js` (198), `os/v3520-workspaces.js` (346).
Порядок загрузки модулей: `os/index.html:466-494`.

---

## 0. Где физически живёт каждый контур

| Контур | Модули | Данные (объявление) |
|---|---|---|
| **Аренда (Leasing)** | `os/core.js` (реестр LCR, канбан, документы КП/LOI, критические даты), `os/v32-upgrade.js` (запросы брендов, инвесторы, продажи, партнёры), `os/v326-commission-engines.js` (комиссии аренды), `os/v35-stable.js` (база брендов) | `U` (юниты) `core.js:342`, `OBJECTS` `core.js:312`, `BRANDS` `core.js:499`, `DOCREG`/`DOC` `core.js:3809-3810`, `KPSEQ` `core.js:262`, `BRAND_REQUESTS`/`SALES_ASSETS`/`SALES_BUYERS`/`CASE_PARTNERS` `v32-upgrade.js:7,113`, `LEASE_COMMISSION_DEALS` `v326-commission-engines.js:8` |
| **Advisory** | `os/v490-workflow.js` (CRM, воронка, КП, договоры, Scope, задачи, deliverables, планировки, согласования, cross-sell, шаблоны), `os/v492-portfolio-proposals.js` (конструктор КП, карта портфеля), `os/v493-portfolio-suite.js` (портфель/карта) | `CASE_CLIENTS … CASE_PROPOSAL_CATALOG` - всё объявлено в `core.js:54-67` |
| **Общее** | `os/v3520-workspaces.js` - реестр маршрутов и меню (`v3520-workspaces.js:20-60`), группы `v3520-workspaces.js:113`, порядок `v3520-workspaces.js:122` |

Заглушки будущих экранов (не реализованы, только текст): `os/v490-caseos.js:8-25` - в т.ч. `project_handover`,
`project_contracts`, `leasing_opening`. В меню помечены `future:true` (`v3520-workspaces.js:22-23,35-39`).

---

## 1. Путь «КП → контрактация» в АРЕНДЕ

### Закрыто кодом

| Шаг | Где |
|---|---|
| Входящий запрос бренда (лид) с этапами `new/matching/offer/won/lost` | `v32-upgrade.js:467-468` (`v32RequestForm`, `v32SaveRequest`), сид `v32-upgrade.js:113-119` |
| Автоподбор помещений под запрос + добавление бренда в shortlist юнита | `v32-upgrade.js:469-471` (`v32MatchRequest`, `v32RequestToUnit`) |
| Реестр помещений (LCR) со статусами `vac/neg/off/os/cs/cd/res` | `core.js:323` (`STAT`), рендер `core.js:1515` (`renderRegistry`) |
| Канбан воронки аренды (drag&drop по статусам `neg → off → os → cs → cd`) | `core.js:1925-1929` (`renderKanban`, `kanDrag`, `kanDrop`) |
| Массовое КП из выбранных строк реестра | `core.js:1735` (`regBulkKP`) |
| Форма КП с глубокими условиями (модель аренды, НДС, CAPEX, каникулы, депозит, коммуналка, терраса, состояние передачи, подписант) | `core.js:3981` (`pickT`, ветка `k==='kp'`) |
| Автонумерация КП по объекту (`CA/0001`) | `core.js:4025` (`kpNextNo`), счётчик `KPSEQ` `core.js:262`, инкремент `core.js:4115` |
| Бюджет владельца → наценка/скидка (6 режимов корректировки) | форма `core.js:3981`, расчёт `core.js:4036-4037` (`pricePrev`, `applyPricing`) |
| Генерация КП, запись оферты в юнит, смена статуса на `off`, авто-дата «Окончание брони», запись в `hist` | `core.js:4050` (`genKP`), тело `core.js:4085-4116` |
| Контроль конфликта: предупреждение, если по помещению уже есть КП другого агента | `core.js:4093` |
| Несколько параллельных оферт по одному юниту (`u.offers[]`, по одной на бренд) | `core.js:4101-4102` |
| Срок действия КП / состояние брони (`активна / истекает / просрочена`) | `core.js:964-965` (`offerState`, `reservationBadge`) |
| Защита ставки: предупреждение при ручной правке ставки при активном КП | `core.js:1629` (`rateEditGuard`), вызов `core.js:1631` (`saveCell`) |
| Версии КП: v1, v2… с историей, перевыпуск из снимка формы | `core.js:3850` (`genEmit`), `core.js:3865` (`reissueKP`) |
| Реестр документов: № / тип / кому / автор / дата / язык / статус (`draft/sent/acc/rej`) | `core.js:3884-3887` (`DSTAT`, `setDocStatus`, `docHistoryHTML`) |
| Мультиязычный документ RU/UZ/EN | `core.js:3852` (`setDocLang`), словари `core.js:4133-4134` (`DOCMAP_UZ`, `DOCMAP_EN`) |
| LOI / письмо о намерениях (3 типа: по помещению, по бренду, по объекту) | `core.js:4118` (`genLOI`) |
| Письмо-напоминание по контрольной дате | `core.js:4128` (`genREM`) |
| Выгрузка в Word (.doc), печать, отправка WhatsApp / Telegram / Email | `core.js:4136-4139`, `core.js:4130-4132` |
| Переход в «Контракт подписан» (`cd`) → авто-сделка по комиссии + авто-дата «Окончание договора» | `core.js:465` (`commAutoLeaseDeal`), `core.js:471` (`commAutoCriticalDate`), триггер `core.js:479` (`commTrack`) |
| Расчёт и распределение комиссии (4 метода базы, 3 сценария, сплит между агентами, куратор, support, компания) | `v326-commission-engines.js:154-188` (`leaseBase`, `leaseCalc`) |
| Учёт потерянной комиссии при передаче юнита/срыве сделки | `core.js:464` (`commLostOf`), запись `core.js:487-489` |
| Критические даты по всем помещениям с бэндами 7/30/60/90 | `core.js:1948-1964` (`allDates`, `renderDatesPage`, `dateBand`) |
| Операционный фокус на дашборде: срочные даты, брони и КП, сделки без движения | `core.js:967` (`actionCenterHTML`) |
| Экспорт реестра CSV / XLS / LCR-Excel | `core.js:1774-1782` |

### НЕ закрыто кодом

| Шаг | Статус |
|---|---|
| **Договор аренды как отдельная сущность** (номер, стороны, дата подписания, срок, версия, приложения) | **не найдено.** Есть только код статуса юнита `cd` (`core.js:323`) и `signedDate` внутри записи комиссии (`core.js:469`). Массива `LEASE_CONTRACTS` в коде нет |
| Шаблон документа «Договор аренды» в генераторе | **не найдено.** Генератор знает ровно три шаблона: `['kp','loi','remind']` (`core.js:3981`, список `core.js:3977`) |
| Внутреннее согласование / виза по ставке перед отправкой КП | **не найдено.** `R().approve` в аренде не вызывается ни разу; право `approve` объявлено в `ROLES` (`core.js:295-296,308-309`) и в тексте прав BA написано «Ставки → виза ASH» (`core.js:298`), но кода проверки нет. `commTeamAccess` (`core.js:450`) использует `approve` только для видимости комиссий |
| Статус «КП принято клиентом» отдельно от «Предложение подписано» | частично: `DSTAT` `acc` (`core.js:3884`) и статус юнита `os` живут раздельно и не синхронизированы кодом |
| График платежей по договору / счета / акты | **не найдено** |
| Scope of Work, задачи, deliverables по сделке аренды | **не найдено** (`CASE_TASKS` в `core.js` только объявлен и сериализуется: `core.js:60,130,946`) |
| Карточка контрагента-арендатора как сущность CRM | **не найдено.** Арендатор - строка: `u.vars[]` (`core.js:343`), `u.offer.to` (`core.js:4103`), `BRAND_REQUESTS[].brand` (`v32-upgrade.js:468`) |
| Автопередача сделки в открытие/pre-opening | **не найдено** (`leasing_opening` - заглушка `v490-caseos.js:15`) |

---

## 2. Путь «КП → контрактация» в ADVISORY

### Закрыто кодом

| Шаг | Где |
|---|---|
| Карточка клиента (название, юрлицо, тип, контакт, телефон, e-mail, ответственный, статус) | `v490-workflow.js:84,95,96` (`renderClients`, `case49ClientEdit`, `case49ClientSave`) |
| Воронка на 12 этапов `new → contact → discovery → proposal → proposal_sent → negotiation → accepted → contract → signing → won / paused / lost` | `v490-workflow.js:9-14` (`PIPE_STAGES`) |
| Воронка: канбан + таблица, переключение вида | `v490-workflow.js:99,111,112,113` |
| Drag&drop по этапам + автоподстановка «следующего шага» при `proposal` и `contract` | `v490-workflow.js:114-115` (`case49OppDrag`, `case49OppDrop`) |
| Возможность: клиент, объект, услуга, сумма, валюта, вероятность %, ответственный, источник, следующий шаг и его дата, причина проигрыша | `v490-workflow.js:116,118` |
| Weighted pipeline по валютам | `v490-workflow.js:38` (`currencyTotals`), KPI `v490-workflow.js:104` |
| Конструктор КП: 3 пакета (`concept` / `feasibility` / `strategic`), 30+ услуг с типом, направлением, deliverable, днями и часами | `v492-portfolio-proposals.js:8-13` (`PKGS`, `SERVICES`) |
| Ручной набор Scope (галочки услуг) + индивидуальные работы с ценой | `v492-portfolio-proposals.js:51` (`serviceMatrix`), `v492:65` (`case492AddCustomService`) |
| 5 моделей цены: за м², фикс, гибрид, по этапам, ручная итоговая | `v492-portfolio-proposals.js:46-48` (`computePrice`, `effectivePrice`) |
| Рекомендованная ставка по типу проекта (retail / mixed / office / residential / hotel / industrial / other) | `v492-portfolio-proposals.js:16` (`TYPE_DEFAULTS`) |
| Обязательная причина при ручной итоговой цене | `v492-portfolio-proposals.js:67` (проверка `overrideReason`) |
| График платежей 3 траншами с проверкой суммы = 100 % | `v492-portfolio-proposals.js:66-67` |
| Сохранение КП → автогенерация строк Scope из выбранных услуг + синхронизация этапа возможности | `v492-portfolio-proposals.js:67` (`case492ProposalSave`) |
| Реестр КП: статус, число работ Scope, стоимость, срок действия | `v490-workflow.js:121-122` (`proposalRows`, `renderProposals`) |
| Ручная правка Scope (название, тип, направление, deliverable, дни, часы, цена, итерации, порядок, исполнитель) | `v490-workflow.js:132-134` |
| Новая версия КП (клон с бампом minor и копией Scope) | `v490-workflow.js:131` (`case49ProposalClone`) |
| Статусы КП `draft / internal_review / approved_internal / sent / client_changes / accepted / rejected / expired` | `v490-workflow.js:16` |
| Внутреннее согласование КП кнопкой (право `approve`) | `v490-workflow.js:230,232` (`renderApprovals`, `case49ProposalApprove`) |
| **Договор как отдельная сущность**: номер, версия, статус, сумма, валюта, дата подписания, начало, окончание, шаблон, график оплаты | `v490-workflow.js:137-140` (`renderContracts`, `case49ContractFromProposal`, `case49ContractEdit`, `case49ContractSave`) |
| 9 статусов договора `draft / legal / client_review / signing / signed / active / completed / paused / terminated` | `v490-workflow.js:17` |
| Снимок Scope в договор (`baselineSnapshot`), защита подписанной версии | `v490-workflow.js:164` |
| **Автозапуск проекта после подписания**: создание объекта в `OBJECTS`, привязка Scope, генерация задач и deliverables | `v490-workflow.js:164` (`case49ContractLaunch`) |
| Автогенерация задач из Scope по 12 отраслевым блюпринтам + автоназначение исполнителя по загрузке | `v490-workflow.js:142-163` (`blueprint`, `bestAssignee`, `generateFromScope`) |
| Scope Change: запрос изменения объёма, срока, суммы + согласование | `v490-workflow.js:176,179-181` |
| Deliverables: тип, статус (9 значений), версия, итерации и лимит, QA-одобрение | `v490-workflow.js:18,210-212,233` |
| Загрузка команды на 4 недели с подсветкой перегруза | `v490-workflow.js:207` (`renderWorkload`) |
| Версии планировок с типами `source / advisory / leasing / approved / as_built`, «основана на», сравнение двух версий, загрузка файла | `v490-workflow.js:26,217-227` |
| Библиотека шаблонов КП/договоров/допников/актов/NDA с файлами | `v490-workflow.js:236-238` |
| Cross-sell: предложение следующих услуг после Advisory | `v490-workflow.js:234-235` |
| Карта проектов Advisory / портфель | `v492-portfolio-proposals.js:29,36`; `v493-portfolio-suite.js:125,143` |
| Экспорт КП в Word-совместимый .doc + предпросмотр с печатью | `v492-portfolio-proposals.js:70` (`case492ProposalDownload`, `case492ProposalPreview`) |

### НЕ закрыто кодом

| Шаг | Статус |
|---|---|
| Мультиязычность документа КП (UZ / EN) | **не найдено.** `documentHTML` (`v492-portfolio-proposals.js:69`) - только RU, параметра языка нет |
| Реестр сформированных документов (кто / когда / на каком языке / статус отправки) | **не найдено.** Аналога `DOCREG` (`core.js:3810`) в Advisory нет; версии КП - это отдельные записи в `CASE_PROPOSALS` (`v490-workflow.js:131`), снимка самого документа не сохраняется |
| Отправка КП в WhatsApp / Telegram / Email | **не найдено** (`grep` по `wa.me|t.me/share|mailto:` даёт 0 в `v490`, `v492`, `v493`; 4 совпадения в `core.js`) |
| Автонумерация КП со сквозным счётчиком по объекту | **не найдено.** Номер - `'CP-'+длина массива` (`v490-workflow.js:123`, `v492-portfolio-proposals.js:52`); при удалении КП номер повторится |
| Срок действия КП как контролируемая бронь (просрочка / истекает) | частично: поле `validUntil` есть (`v490-workflow.js:123`), но аналога `offerState` (`core.js:964`) с бэйджем и подсветкой нет |
| Автосмена статуса КП на `expired` по дате | **не найдено** |
| Договор аренды/консалтинга как генерируемый документ | **не найдено.** Есть только поле `templateId` и файл шаблона (`v490-workflow.js:139`), генерации тела договора нет |
| Комиссия / вознаграждение по проекту Advisory | **не найдено** (`grep -i "commission|комисси"` = 0 в `v490-workflow.js` и `v492-portfolio-proposals.js`) |
| Счета, акты, факт оплаты по графику платежей | **не найдено.** `paymentSchedule` только записывается (`v492-portfolio-proposals.js:66`) |
| Конфликт-контроль: два КП одному клиенту от разных менеджеров | **не найдено** (в аренде есть - `core.js:4093`) |
| Экспорт реестра КП / договоров в CSV/Excel | **не найдено** (в аренде есть - `core.js:1774-1782`, `v32-upgrade.js:409`, `v326-commission-engines.js:205`) |
| Titul / обложка КП с картинкой | **не найдено.** Модуль `os/v4690-offer-cover.js` существует и загружается (`index.html:494`), экспортирует `window.CASE_OFFER_COVER` (`v4690-offer-cover.js:110`), но **ни один модуль его не вызывает** |
| Гибкое ценообразование с журналом отклонений | **не найдено в контуре.** `os/v4670-offer-pricing.js` экспортирует `window.CASE_OFFER_PRICING` (`v4670-offer-pricing.js:358`), потребителей нет |
| Справочники «вид проекта / тип работ / сегмент» при заведении проекта | **не найдено в контуре.** `os/v4680-project-directories.js:162` экспортирует `window.CASE_PROJECT_DIR`, потребителей нет |

---

## 3. Таблица паритета (43 строки)

| # | Возможность | Есть в аренде | Есть в Advisory |
|---|---|---|---|
| 1 | Отдельный экран воронки | Да - канбан `core.js:1925` (`renderKanban`), вкладка «Воронка» `core.js:1939` | Да - `v490-workflow.js:99` (`renderPipeline`) |
| 2 | Воронка в виде таблицы | Нет отдельного вида воронки; таблица - это реестр LCR `core.js:1515` | Да - `v490-workflow.js:112` (`pipelineTable`), переключатель `v490-workflow.js:113` |
| 3 | Drag&drop смены этапа | Да - `core.js:1928-1929` (`kanDrag`/`kanDrop`) | Да - `v490-workflow.js:114-115` (`case49OppDrag`/`case49OppDrop`) |
| 4 | Справочник этапов | Да - `STAT` 7 статусов `core.js:323`; параллельно `stageOpts()` 8 значений `v326-commission-engines.js:195`; `BRAND_REQUESTS.stage` 5 значений `v32-upgrade.js:467`; `SALES_ASSETS.stage` 7 значений `v32-upgrade.js:479` | Да - `PIPE_STAGES` 12 этапов `v490-workflow.js:9-14` |
| 5 | Вероятность закрытия по этапу | Да, зашита в код - `COMM_PROB` `core.js:449`; вторая таблица `cfg.lease.stageProb` `v326-commission-engines.js:122` | Да, но вводится руками на каждой возможности - поле `probability` `v490-workflow.js:116` |
| 6 | Weighted pipeline | Да - `commAgentWeightedU` `core.js:454`, `commBook` `core.js:463`, `leaseLedgerRows` `v326-commission-engines.js:190` | Да - `currencyTotals(rows,true)` `v490-workflow.js:38`, вывод `v490-workflow.js:104` |
| 7 | Карточка клиента / контрагента | **Нет.** Арендатор - строка в `u.vars[]` `core.js:343` и `u.offer.to` `core.js:4103` | Да - `CASE_CLIENTS`, `v490-workflow.js:84,95,96` |
| 8 | База брендов / арендаторов | Да - `BRANDS` `core.js:499`, экран `core.js:2874`, фильтры/импорт `v35-stable.js:339,348,356` | **Нет** (`grep BRANDS` = 0 в `v490-workflow.js`, `v492-portfolio-proposals.js`) |
| 9 | Входящий лид / запрос | Да - `BRAND_REQUESTS` `v32-upgrade.js:467-468`, инвесторы `v32-upgrade.js:473-474` | Частично - возможность создаётся вручную `v490-workflow.js:116`; поле `source` есть, отдельного экрана лидов нет |
| 10 | Автоподбор (matching) лид ↔ объект | Да - `v32MatchRequest` `v32-upgrade.js:469`, `v32MatchInvestor` `v32-upgrade.js:475`, `v32MatchBuyers` `v32-upgrade.js:483` | **Нет** - не найдено |
| 11 | Конструктор КП по пакетам услуг | **Нет** | Да - `PKGS`/`SERVICES` `v492-portfolio-proposals.js:8-13`, экран `v492-portfolio-proposals.js:52` |
| 12 | Форма КП с коммерческими условиями | Да, очень глубокая (модель аренды, НДС, CAPEX, каникулы, депозит, коммуналка, терраса, подписант) - `core.js:3981` | Да, короткая (пакет, услуги, цена, срок, 3 транша, примечания) - `v492-portfolio-proposals.js:52` |
| 13 | Автонумерация КП | Да - сквозная по объекту `kpNextNo` `core.js:4025`, счётчик `KPSEQ` `core.js:262`, инкремент `core.js:4115` | Частично - `'CP-'+(длина массива+1)` `v490-workflow.js:123`, `v492-portfolio-proposals.js:52` |
| 14 | Срок действия КП / бронь с подсветкой | Да - `offerState` `core.js:964`, `reservationBadge` `core.js:965`, авто-дата брони `core.js:4104` | Частично - поле `validUntil` `v490-workflow.js:123`; расчёта просрочки нет |
| 15 | Версии / редакции КП | Да - `genEmit` пишет `versions[]` `core.js:3850`, перевыпуск из снимка формы `reissueKP` `core.js:3865` | Да, иначе - клон записи с бампом версии `case49ProposalClone` `v490-workflow.js:131`; правка через конструктор перезаписывает `v492-portfolio-proposals.js:67` |
| 16 | Реестр сформированных документов | Да - `DOCREG` `core.js:3810`, таблица `docHistoryHTML` `core.js:3887`, статус `setDocStatus` `core.js:3886` | **Нет** - не найдено |
| 17 | Мультиязычный документ RU/UZ/EN | Да - `setDocLang` `core.js:3852`, `DOCMAP_UZ`/`DOCMAP_EN` `core.js:4133-4134` | **Нет** - `documentHTML` только RU `v492-portfolio-proposals.js:69` |
| 18 | Выгрузка КП в Word (.doc) | Да - `dlWord` `core.js:4139` | Да - `case492ProposalDownload` `v492-portfolio-proposals.js:70` |
| 19 | Печать / предпросмотр | Да - `printDoc` `core.js:4136`, предпросмотр в `#dprev` `core.js:3977` | Да - `case492ProposalPreview` + авто-`window.print()` в теле документа `v492-portfolio-proposals.js:69-70` |
| 20 | Отправка WhatsApp / Telegram / Email | Да - `sendDocWA` `core.js:4137`, `sendDocEmail` `core.js:4138`, `sendDocTG` `core.js:4139` | **Нет** - не найдено |
| 21 | Обложка / титул документа | Нет в контуре; `window.CASE_OFFER_COVER` `v4690-offer-cover.js:110` не вызывается ниоткуда | То же - не подключено |
| 22 | Scope of Work как строки-позиции | **Нет** | Да - `CASE_SCOPE_ITEMS`, редактор `v490-workflow.js:132-133`, автогенерация из пакета `v492-portfolio-proposals.js:67` |
| 23 | Scope Change с согласованием | **Нет** | Да - `v490-workflow.js:176,179-181` |
| 24 | Внутреннее согласование (виза) | **Нет** - `R().approve` не вызывается; декларация права `core.js:295-296,298` без кода | Да - `canApprove` `v490-workflow.js:40`, экран `v490-workflow.js:230`, действия `v490-workflow.js:181,232,233` |
| 25 | Договор как отдельная сущность | **Нет** - только код статуса `cd` `core.js:323`; `signedDate` живёт в записи комиссии `core.js:469` | Да - `CASE_CONTRACTS`, `v490-workflow.js:137-140` |
| 26 | Справочник статусов договора | **Нет** | Да - `CONTRACT_STATUSES` 9 значений `v490-workflow.js:17` |
| 27 | Библиотека шаблонов документов | **Нет** - три зашитых шаблона `['kp','loi','remind']` `core.js:3981` | Да - `CASE_DOCUMENT_TEMPLATES` с загрузкой файла `v490-workflow.js:236-238` |
| 28 | LOI / письмо о намерениях | Да - `genLOI`, 3 типа `core.js:4118` | **Нет** - не найдено |
| 29 | Служебное напоминание по дате | Да - `genREM` `core.js:4128` | **Нет** - не найдено |
| 30 | Автозапуск проекта после подписания | **Нет** | Да - `case49ContractLaunch` `v490-workflow.js:164` |
| 31 | Автогенерация задач по этапам | **Нет** (`CASE_TASKS` в `core.js` только объявлен: `core.js:60,130,946`) | Да - `blueprint`/`generateFromScope` `v490-workflow.js:142,163` |
| 32 | Deliverables с QA и итерациями | **Нет** | Да - `DELIVERABLE_STATUSES` `v490-workflow.js:18`, экран `v490-workflow.js:210-212`, QA `v490-workflow.js:233` |
| 33 | Загрузка команды (workload) | **Нет** | Да - `renderWorkload` `v490-workflow.js:207` |
| 34 | Комиссия / распределение вознаграждения | Да - `leaseCalc` (4 метода базы, 3 сценария, сплиты) `v326-commission-engines.js:154-188`; вторая модель в ядре `commFeeU`/`commAgentFeeU` `core.js:460,462` | **Нет** - не найдено |
| 35 | Авто-создание сделки при подписании | Да - `commAutoLeaseDeal` `core.js:465` (триггер `commTrack` `core.js:479`) | Нет аналога; вместо этого создаётся проект `v490-workflow.js:164` |
| 36 | Критические даты по сделке | Да - `u.dates[]` `core.js:343`, реестр `allDates`/`renderDatesPage` `core.js:1948-1949`, бэнды `core.js:1964` | Частично - `nextActionDate` возможности `v490-workflow.js:116`, `dueDate` задач и deliverables; **единого реестра дат нет** |
| 37 | Авто-дата «Окончание договора» | Да - `commAutoCriticalDate` `core.js:471` | **Нет** - не найдено |
| 38 | История изменений на сущности | Да - `u.hist[]` `core.js:343`, записи `core.js:4106`, `core.js:1631`, `core.js:1929` | Частично - глобальный `audit()` через `save()` `v490-workflow.js:44`; поля `hist` на возможности/КП/договоре нет |
| 39 | Cross-sell / следующая услуга | **Нет** обратного направления (Leasing → Advisory) | Да - `renderCrossSell`/`case49CrossSellCreate` `v490-workflow.js:234-235` |
| 40 | Карта объектов / проектов | Да - `leasing_portfolio_map` `v3520-workspaces.js:43`, `objectsAsProjects` `v493-portfolio-suite.js:69` | Да - `advisory_portfolio_map` `v3520-workspaces.js:29`, `renderPortfolio` `v492-portfolio-proposals.js:29`, `render` `v493-portfolio-suite.js:125` |
| 41 | Версии планировок | Да - общий модуль, маршрут `leasing_layouts` `v3520-workspaces.js:54`, `plan_master` `v3520-workspaces.js:46` | Да - тот же код `renderLayouts` `v490-workflow.js:217`, маршрут `project_layouts` `v3520-workspaces.js:21` |
| 42 | Конфликт-контроль двойного КП | Да - `core.js:4093` (подтверждение при чужой активной оферте) | **Нет** - не найдено |
| 43 | Экспорт реестра CSV / Excel | Да - `exportRegCSV`/`downloadXLS`/`exportLCRExcel` `core.js:1774-1782`, `scrExportCSV` `v32-upgrade.js:409`, `exportCSV` `v326-commission-engines.js:205`, `case493Export` `v493-portfolio-suite.js:191` | **Нет** для КП/договоров - не найдено |

---

## 4. Что есть в аренде и отсутствует в Advisory

1. **Реестр документов** с автором, датой, языком и статусом отправки - `core.js:3810,3887,3886`.
2. **Мультиязычность документа (UZ/EN)** - `core.js:3852,4133,4134`.
3. **Отправка документа в мессенджеры и почту** - `core.js:4137-4139`.
4. **Сквозная автонумерация КП по объекту** - `core.js:4025`, `KPSEQ` `core.js:262`.
5. **Живая бронь: срок КП с состоянием и подсветкой** - `core.js:964-965`, авто-дата брони `core.js:4104`.
6. **Конфликт-контроль по параллельным КП** - `core.js:4093`; список параллельных оферт `u.offers[]` `core.js:4101`.
7. **Перевыпуск документа из снимка формы** (`form` в `DOCREG`) - `core.js:3865`, снимок `core.js:4114`.
8. **Комиссии и распределение денег** - `v326-commission-engines.js:154-188`, `core.js:460-464`.
9. **Автоматика при подписании**: авто-сделка + авто-дата окончания - `core.js:465,471,479`.
10. **Единый реестр критических дат** с бэндами 7/30/60/90 - `core.js:1948-1949,1964`.
11. **Операционный фокус** (срочные даты / брони / зависшие сделки) - `core.js:967`.
12. **Автоподбор (matching)** лид ↔ помещение / инвестор ↔ актив / актив ↔ покупатель - `v32-upgrade.js:469,475,483`.
13. **База брендов** с фильтрами, импортом/экспортом, карточкой и печатью - `core.js:2874,2860`, `v35-stable.js:339,348,356`.
14. **LOI и письмо-напоминание** - `core.js:4118,4128`.
15. **Экспорт реестра в CSV/XLS/LCR-Excel** - `core.js:1774-1782`.
16. **История на самой сущности** (`u.hist[]`) - `core.js:343`, записи `core.js:4106,1631,1929`.
17. **Партнёрский контур** (партнёры, реферралы, портал) - `v32-upgrade.js:454,485,486`.

## 5. Что есть в Advisory и отсутствует в аренде

1. **Карточка клиента как сущность** - `v490-workflow.js:84,95,96`.
2. **Многоэтапная воронка (12 этапов) с явным «КП отправлено / принято»** - `v490-workflow.js:9-14`.
3. **Переключение канбан ↔ таблица** одной воронки - `v490-workflow.js:112-113`.
4. **Конструктор КП по пакетам и матрице услуг** - `v492-portfolio-proposals.js:8-13,51,52`.
5. **5 моделей ценообразования + обязательная причина ручной цены** - `v492-portfolio-proposals.js:46-48,67`.
6. **График платежей траншами с проверкой 100 %** - `v492-portfolio-proposals.js:66-67`.
7. **Scope of Work как структура строк** - `v490-workflow.js:132-133`, автогенерация `v492-portfolio-proposals.js:67`.
8. **Scope Change с согласованием** - `v490-workflow.js:176,179-181`.
9. **Внутреннее согласование КП и deliverables** - `v490-workflow.js:230,232,233`.
10. **Договор как сущность с 9 статусами и снимком Scope** - `v490-workflow.js:17,137-140,164`.
11. **Автозапуск проекта из подписанного договора** - `v490-workflow.js:164`.
12. **Автогенерация задач по 12 отраслевым блюпринтам + автоназначение по загрузке** - `v490-workflow.js:142,163`.
13. **Deliverables с версиями, итерациями и лимитом итераций** - `v490-workflow.js:18,210-212`.
14. **Планирование загрузки команды на 4 недели** - `v490-workflow.js:207`.
15. **Библиотека шаблонов документов с файлами** - `v490-workflow.js:236-238`.
16. **Cross-sell следующей услуги** - `v490-workflow.js:234-235`.
17. **Исторический портфель проектов и карта** - `v492-portfolio-proposals.js:6,29`, `v493-portfolio-suite.js:125`.

---

## 6. Реализовано в обеих, но по-разному

| Возможность | Аренда | Advisory | В чём именно расходится |
|---|---|---|---|
| **Справочник этапов** | `STAT` - 7 кодов `vac/neg/off/os/cs/cd/res` `core.js:323`, плюс `stageOpts()` - 8 англоязычных `lead/neg/loi/contract/signed/paid/lost/reversed` `v326-commission-engines.js:195` | `PIPE_STAGES` - 12 русских этапов `v490-workflow.js:9-14` | Три несовместимых словаря этапов в одной системе; переход между ними нигде не смаплен |
| **Вероятность закрытия** | Захардкожена в двух местах: `COMM_PROB` `core.js:449` и `cfg.lease.stageProb` `v326-commission-engines.js:122` | Поле `probability` вводится вручную на каждой возможности `v490-workflow.js:116` | В аренде менеджер не может изменить вероятность; в Advisory нет значения по умолчанию от этапа. Две таблицы вероятностей в аренде расходятся между собой |
| **Версионирование КП** | Одна запись `DOCREG`, старые версии складываются в `versions[]`, номер не меняется `core.js:3850`; перевыпуск восстанавливает форму `core.js:3865` | Новая запись в `CASE_PROPOSALS` с новым `id` и бампом minor `v490-workflow.js:131`; сохранение через конструктор перезаписывает существующую запись `v492-portfolio-proposals.js:67` | Разная модель версии: «версии внутри документа» против «документ на версию». В Advisory Scope копируется в новый КП, старый остаётся жить параллельно |
| **Нумерация** | Счётчик по объекту `KPSEQ[objId]`, формат `CA/0001`, восстанавливается из введённого номера `core.js:4025,4115` | `'CP-' + (CASE_PROPOSALS.length + 1)` `v490-workflow.js:123`, `v492-portfolio-proposals.js:52` | Нумерация Advisory ломается при удалении записи (повтор номера) и не привязана к объекту |
| **Идентификация ответственного** | Строка-имя: `u.broker` `core.js:343`, `deal.agent1/agent2/curator/support` `v326-commission-engines.js:249`, `COMMLOST.broker` `core.js:488` | Смешанно: `assigneeId`/`ownerId` - id из `people()` `v490-workflow.js:61,63`; но `opportunity.owner` и `client.owner` - свободный текст `v490-workflow.js:116,95` | Переименование сотрудника рвёт связи в аренде полностью и частично в Advisory |
| **Реестр сотрудников** | `AGENTS` - плоский список с метриками `core.js:435` | `people()` - склейка `USERS` + `AGENTS` с дедупликацией `v490-workflow.js:61` | Advisory видит объединённый список, аренда - только `AGENTS`; ролевые списки брокеров ещё раз строятся в `commBrokerList` `core.js:456` и `brokers()` `v326-commission-engines.js:111` |
| **Валюта** | Валюта берётся с объекта `o.cur`, в тексте КП жёстко «Оплата в ${o.cur}» `core.js:4116`; комиссии - `d.currency||'USD'` `v326-commission-engines.js:190` | Валюта на КП/договоре/возможности - селект USD/UZS/EUR `v490-workflow.js:123,139,116` | Аренда не позволяет валюту на сделку, Advisory - позволяет на каждую запись; сумм по объекту/клиенту система не сводит |
| **Фирменный стиль документа** | Красный `#9E0000`, шрифт Montserrat, подгружаемый c Google Fonts - `wrapDoc` `core.js:4135`; шапка `letter()` `core.js:4038` | Зелёный `#14675B`, шрифты Arial/Georgia, инлайн - `documentHTML` `v492-portfolio-proposals.js:69` | **Два разных бренда в исходящих документах одной компании**: разный цвет, шрифт, вёрстка шапки и блока подписи |
| **UI-«почерк» экранов** | Базовые классы `index.html`: `.form`, `.row2`, `.fsec`, `.card` (`core.js:3981`); плюс `.v32-*` `v32-upgrade.js:147-152`; плюс `.v326-*` `v326-commission-engines.js:300` | `.case49-*` `v490-workflow.js:264`; `.case492-*` `v492-portfolio-proposals.js:75`; `.case493-*` `v493-portfolio-suite.js:192` | **Шесть независимых наборов CSS** с собственными радиусами, отступами и высотами полей: `--case49-radius:14px` `v490-workflow.js:265`, `border-radius:11px` `v492:75`, `16px` `v32:150`, `16px` `v326:301` |
| **Диалоговые окна** | `modal()` `v32-upgrade.js:172`; отдельный `modal()` `v326-commission-engines.js:247` | `modal()` `v490-workflow.js:77` | Три разные реализации модалки с разной разметкой и разными кнопками закрытия (`v32CloseModal`, `v326CloseModal`, `case49CloseModal`) |
| **Экран воронки** | Канбан 5 колонок по статусам юнита, карточка = помещение `core.js:1925` | Канбан 12 колонок по этапам сделки, карточка = возможность `v490-workflow.js:111` | В аренде «единица воронки» - помещение, в Advisory - сделка. Один бренд, ведущий переговоры по 3 помещениям, даёт 3 карточки в аренде и 1 в Advisory |
| **Карта проектов** | `objectsAsProjects` синтезирует записи из `OBJECTS` на лету, id вида `'obj_'+o.id` `v493-portfolio-suite.js:69-86` | Реальные записи `CASE_PORTFOLIO_PROJECTS` `v492-portfolio-proposals.js:6`, миграция `v493-portfolio-suite.js:43` | Advisory-проекты персистентны и редактируемы, leasing-объекты на карте - виртуальные и теряют правки; дедупликация только по `p.objId` `v493-portfolio-suite.js:87` |
| **Сохранение состояния** | `persistV32` `v32-upgrade.js:193`, `persist326` `v326-commission-engines.js:148`, ядро `persist` `core.js:907` | `save()` `v490-workflow.js:44`, `save()` `v492-portfolio-proposals.js:19`, `persistQuiet` `v493-portfolio-suite.js:36` | Шесть обёрток над одним `persist()`; в `v490`/`v492` дополнительно дёргается `apiSaveState()`, в `v32`/`v326` - нет |
| **Права на редактирование** | `canEdit` = `edit\|admin\|finance` `v32-upgrade.js:22`; `canAll` `v326-commission-engines.js:108` | `canEdit` = `edit\|admin` `v490-workflow.js:39`; `canEdit` = `admin\|edit\|finance` `v492-portfolio-proposals.js:20` | Три разных определения «может редактировать» в одном приложении |

---

## 7. Что дублируется в обоих контурах и просится в общий модуль

| Что | Где дублируется |
|---|---|
| **Экранирование HTML** | `h()` `v32-upgrade.js:9`, `h()` `v326-commission-engines.js:21`, `esc()`+`h()` `v35-stable.js:24,26`, `E()` `v490-workflow.js:29`, `E()` `v492-portfolio-proposals.js:17`, `E()` `v493-portfolio-suite.js:32`, `h()` `v3520-workspaces.js:161`, ядро `esc` в `index.html` - **8 копий одной функции** |
| **Генератор id** | `id()` `v32-upgrade.js:13`, `id()` `v326-commission-engines.js:101`, `uid()` `v490-workflow.js:30`, `uid()` `v492-portfolio-proposals.js:18` |
| **Даты: today / addDays / формат** | `todayISO`+`addDays` `v32-upgrade.js:14-15`, `today`+`addDays` `v326-commission-engines.js:102-103`, `todayISO`+`addDays`+`fmtDate` `v490-workflow.js:32-35`, `today`+`plusDays` `v492-portfolio-proposals.js:18`, ядро `iso`/`addDaysISO`/`dateRU`/`daysUntil` `core.js:417,280,282,281` |
| **Формат денег** | `money()` `v32-upgrade.js:16`, `money()` `v326-commission-engines.js:105`, `money()` `v490-workflow.js:36`, `fmt()` `v492-portfolio-proposals.js:18`, ядро `fmt` |
| **Модальное окно** | `modal()` `v32-upgrade.js:172` + `v32CloseModal` `v32-upgrade.js:179`; `modal()` `v326-commission-engines.js:247` + `v326CloseModal` `v326-commission-engines.js:248`; `modal()` `v490-workflow.js:77` + `case49CloseModal` `v490-workflow.js:261` |
| **Поля формы** | `formInput/formText/formSelect` `v32-upgrade.js:461-463`; `inp/area/sel` `v326-commission-engines.js:198-200`; `field/selectField/textField` `v490-workflow.js:78-80` |
| **Чтение значения поля** | `gv()`+`num()` `v32-upgrade.js:464-465`; `val()`+`checked()` `v326-commission-engines.js:196-197`; `val()` `v490-workflow.js:81`; `proposalFormValue()` `v492-portfolio-proposals.js:44` |
| **Список `<option>`** | `options()` `v490-workflow.js:59`, `options()` `v492-portfolio-proposals.js:26`, `opts()` `v493-portfolio-suite.js:123`, `formSelect` `v32-upgrade.js:463`, `sel()` `v326-commission-engines.js:200` |
| **Шапка страницы** | `pageHead()` `v32-upgrade.js:321`, `pageHead()` `v326-commission-engines.js:203`, `page()` `v490-workflow.js:56`, `page()` `v492-portfolio-proposals.js:25`, `page()` `v493-portfolio-suite.js:122` |
| **Пустое состояние** | `empty()` `v490-workflow.js:57`; `.v32-empty` `v32-upgrade.js` (инлайн в `v32MatchRequest` `v32-upgrade.js:469` и др.); в `v326` - свой вариант |
| **Инъекция CSS** | `installCSS` `v32-upgrade.js:147`, `installCSS` `v326-commission-engines.js:300`, `css()` `v490-workflow.js:264`, `css()` `v492-portfolio-proposals.js:75`, `css()` `v493-portfolio-suite.js:192`, `css()` `v3520-workspaces.js:281` |
| **Обёртка `go()`** | `installGo`+`window.go` `v32-upgrade.js:294-296`, `v326-commission-engines.js:306`, `v490-workflow.js:282`, `v492-portfolio-proposals.js:78`, `v493-portfolio-suite.js:196`, `v3520-workspaces.js:225,334` - **7 обёрток над одним роутером** |
| **Обёртка меню** | `installNav`/`appendNav`/`buildNav` `v32-upgrade.js:282-287`, `v326-commission-engines.js:304-305`, реестр `v3520-workspaces.js:20-60` |
| **`stateBlob` / `applyState`** | `wrapState` `v32-upgrade.js:181-192`, `wrapState` `v326-commission-engines.js:136-147` - одинаковый код перехвата сериализации |
| **Обёртка сохранения** | `persistV32` `v32-upgrade.js:193`, `persist326` `v326-commission-engines.js:148`, `persistSafe` `v35-stable.js:28`, `save()` `v490-workflow.js:44`, `save()` `v492-portfolio-proposals.js:19`, `persistQuiet` `v493-portfolio-suite.js:36` |
| **Аудит** | `audit326` `v326-commission-engines.js:149` дублирует ядровый `audit` `core.js:961`; `save()` в `v490`/`v492` вызывает `audit` со своим текстом |
| **Проверка прав** | `canEdit/canManage` `v32-upgrade.js:21-22`, `canAll` `v326-commission-engines.js:108`, `canEdit/canApprove/isAdmin` `v490-workflow.js:39-41`, `canEdit` `v492-portfolio-proposals.js:20`, `canEdit` `v493-portfolio-suite.js:35` |
| **Toast** | `toast()` `v32-upgrade.js:165`, `toast()` `v35-stable.js:27`, ядро `toast` `core.js:136` |
| **Экспорт CSV** | `scrExportCSV` `v32-upgrade.js:409`, `exportCSV` `v326-commission-engines.js:205`, `exportRegCSV`/`downloadCSV` `core.js:1774-1775`, `safeCsv`/`saveFile`/`case493Export` `v493-portfolio-suite.js:189-191`, `asaas35ExportBrands` `v35-stable.js:356` |
| **Скачивание файла** | `dl()` `v35-stable.js:362`, `downloadCSV`/`downloadXLS` `core.js:1775-1776`, `dlWord` `core.js:4139`, `case492ProposalDownload` `v492-portfolio-proposals.js:70`, `saveFile` `v493-portfolio-suite.js:190` |
| **Генератор документа в Word/HTML** | `wrapDoc`+`letter`+`sign3` `core.js:4135,4038,4040` и `documentHTML` `v492-portfolio-proposals.js:69` - две независимые вёрстки одного класса документа |
| **Загрузка файла на сервер** | `uploadProjectFile` `v490-workflow.js:214`; в аренде - `uploadPlan` `core.js:2476` и `uploadImg` `core.js:4141` |
| **Список брокеров / людей** | `commBrokerList` `core.js:456`, `brokers()` `v326-commission-engines.js:111`, `peopleOptions` `v490-workflow.js:63`, `usersList` `v35-stable.js:363`, `peopleOptions` `v326-commission-engines.js:201` |
| **Валютный селект USD/UZS/EUR** | повторён строкой в 4 местах: `v490-workflow.js:123`, `v490-workflow.js:129`, `v490-workflow.js:139`, `v490-workflow.js:116`; ещё раз в `v492-portfolio-proposals.js:52` |
| **Классы статуса/дедлайна** | `statusClass`/`deadlineClass` `v490-workflow.js:65-66` vs `STCLS` `core.js:324` и `dateBand` `core.js:1964` |
| **Карта проектов** | `drawPortfolioMap` `v492-portfolio-proposals.js:36` и `drawMap`/`drawLeaflet`/`drawYandex` `v493-portfolio-suite.js:143,155,145` - две реализации карты для одного набора данных |

---

## 8. ⚠ КРИТИЧНО: одна и та же сущность ведётся двумя воронками раздельно

### 8.1. КЛИЕНТ / КОНТРАГЕНТ - четыре независимых хранилища

| Хранилище | Где | Тип связи |
|---|---|---|
| `CASE_CLIENTS` (Advisory) | объявление `core.js:54`, CRUD `v490-workflow.js:95-96` | Объект с `id`, ссылка `opportunity.clientId` `v490-workflow.js:118` |
| `BRANDS` (аренда) | `core.js:499`, редактор `v35-stable.js:446` | Объект с `id`, **не связан с `CASE_CLIENTS`** |
| `u.vars[]` / `u.offer.to` (аренда, фактический арендатор в сделке) | `core.js:343`, `core.js:4103,4107` | **Строка без id** |
| `BRAND_REQUESTS[].brand`, `SALES_BUYERS[].name`, `CASE_PARTNERS[].name` | `v32-upgrade.js:468,482,486` | **Строки без id** |

Доказательство изоляции: `grep -c CASE_CLIENTS` → `v32-upgrade.js:0`, `v326-commission-engines.js:0`,
`v35-stable.js:0`, `v3520-workspaces.js:0`, `v493-portfolio-suite.js:0`.
`grep -c BRANDS` → `v490-workflow.js:0`, `v492-portfolio-proposals.js:0`.

**Риск:** один владелец ТЦ, заведённый в Advisory как `CASE_CLIENTS`, и он же как арендодатель в `OBJECTS`
- это две записи без связи. Один бренд-арендатор существует одновременно как `BRANDS[i]`,
как строка в `u.vars`, как строка в `u.offer.to`, как строка в `BRAND_REQUESTS[].brand` и
как `SALES_BUYERS[].name`. Смена названия компании требует правки в пяти местах вручную;
контактов, истории переговоров и NDA у арендатора нет вовсе.

### 8.2. ПРОЕКТ / ОБЪЕКТ - три независимых хранилища

| Хранилище | Где | Комментарий в коде |
|---|---|---|
| `OBJECTS` (операционный реестр аренды) | `core.js:312` | - |
| `CASE_PORTFOLIO_PROJECTS` (портфель Advisory) | `core.js:66`, сид `v492-portfolio-proposals.js:6`, миграция `v493-portfolio-suite.js:43` | «Historical portfolio is **deliberately separate** from operational OBJECTS/LCR» - `v492-portfolio-proposals.js:2` |
| Виртуальные проекты из `OBJECTS` | `objectsAsProjects` `v493-portfolio-suite.js:69-86`, склейка `allFor` `v493-portfolio-suite.js:87-91` | id вида `'obj_'+o.id`, `fromObject:true`; **не сохраняются** |

**Риск 1 - раздвоение при контрактации.** `case49ContractLaunch` (`v490-workflow.js:164`) при отсутствии
`opportunity.objectId` **создаёт новую запись в `OBJECTS`** с `businessLines:['Advisory']`. Если тот же
торговый центр уже заведён отделом аренды, в реестре появятся два объекта с одинаковым названием и
разными `id`; юниты, планировки, критические даты и комиссии останутся у первого.

**Риск 2 - дедупликация только по одному полю.** Склейка карты (`v493-portfolio-suite.js:87-91`) считает
объект «уже показанным», только если у портфельного проекта заполнено `p.objId`. Проекты, заведённые
в Advisory до появления объекта в аренде, дают вторую точку на карте под тем же адресом.

**Риск 3 - потеря правок.** Правки виртуальных проектов (`case493ProjectSave` `v493-portfolio-suite.js:188`)
не имеют куда сохраниться для записей с `fromObject:true` - они пересобираются на каждом рендере.

### 8.3. СДЕЛКА / КП - три параллельных представления

| Представление | Где |
|---|---|
| `DOCREG` (документ КП + версии) | `core.js:3810`, запись `core.js:3850` |
| `u.offers[]` / `u.offer` (оферта на юните) | `core.js:4101-4102` |
| `CASE_PROPOSALS` (КП Advisory) | `core.js:56`, запись `v490-workflow.js:124`, `v492-portfolio-proposals.js:67` |

**Риск:** одно и то же КП в аренде живёт в двух местах - как документ в `DOCREG` и как оферта на юните.
Синхронизация односторонняя: `genKP` (`core.js:4050`) пишет в оба, но правка статуса документа
(`setDocStatus` `core.js:3886`) **не меняет статус юнита**, а правка статуса юнита в реестре
(`saveCell` `core.js:1631`) **не меняет статус документа**. Документ может стоять в `rej`, юнит - в `off`.

### 8.4. СТАДИЯ СДЕЛКИ - четыре несовместимых словаря

`STAT` 7 значений `core.js:323` · `stageOpts()` 8 значений `v326-commission-engines.js:195` ·
`PIPE_STAGES` 12 значений `v490-workflow.js:9-14` · `BRAND_REQUESTS.stage` 5 значений `v32-upgrade.js:467` ·
`SALES_ASSETS.stage` 7 значений `v32-upgrade.js:479`.

**Риск:** сделка, помеченная в аренде как `cd` («Контракт подписан»), в модуле комиссий получает
`stage:'signed'` (`core.js:469`), но при ручном редактировании сделки (`v326LeaseDealForm`
`v326-commission-engines.js:232`) доступны ещё `paid` и `reversed`, которых нет в `STAT` - обратной
записи в `u.status` нет. Сводного отчёта по воронке компании построить нельзя: этапы не маппятся.

### 8.5. ВЕРОЯТНОСТЬ ЗАКРЫТИЯ - три источника истины

`COMM_PROB` `core.js:449` (`neg:20, off:40, os:65, cs:85, res:50, cd:100`) ·
`cfg.lease.stageProb` `v326-commission-engines.js:122` (`lead:20, neg:35, loi:65, contract:85, signed:100`) ·
поле `probability` вручную на возможности `v490-workflow.js:116,118`.

**Риск:** одна и та же сделка на этапе переговоров даёт 20 % в дашборде ядра (`commAgentWeightedU`
`core.js:454`) и 35 % в реестре комиссий (`leaseProb` `v326-commission-engines.js:166`). Взвешенный
pipeline компании не сходится сам с собой.

### 8.6. ОТВЕТСТВЕННЫЙ СОТРУДНИК - имя-строка против id

Аренда: `u.broker` (строка) `core.js:343`; `u.offer.by`/`u.offer.byUser` `core.js:4103`;
`COMMLOST.broker` (строка) `core.js:488`; `deal.agent1/agent2/curator/support` (строки)
`v326-commission-engines.js:249`; фильтрация «мои сделки» сравнением строк `v326-commission-engines.js:189`.

Advisory: `assigneeId`/`ownerId` - id из `people()` `v490-workflow.js:61,63,163`; **но**
`opportunity.owner` и `client.owner` - свободный текст `v490-workflow.js:116,95`.

**Риск:** переименование сотрудника (`AGENTS[i].name` или `USERS[i].name`) обнуляет привязку сделок,
комиссий и потерянной комиссии в аренде, а в Advisory ломает колонку «Ответственный» в воронке
и в карточке клиента, оставляя задачи и deliverables целыми. Данные расходятся частично - это хуже,
чем если бы ломались целиком.

### 8.7. КОНТРОЛЬНЫЕ ДАТЫ - два несвязанных набора

Аренда: `u.dates[]` `core.js:343`, наполнение `core.js:4104` (окончание брони), `core.js:476`
(окончание договора), `v32-upgrade.js:471` (дата по запросу бренда); реестр `allDates` `core.js:1948`.

Advisory: `opportunity.nextActionDate` `v490-workflow.js:116`, `task.dueDate` `v490-workflow.js:163`,
`deliverable.dueDate` `v490-workflow.js:211`, `contract.endDate` `v490-workflow.js:139`,
`proposal.validUntil` `v490-workflow.js:123`.

**Риск:** экран «Критические даты» (`core.js:1949`) строится **только** из `u.dates` - ни одна
дата Advisory (истечение КП, окончание договора, срок deliverable) туда не попадает. Компания
не имеет единого календаря обязательств.

### 8.8. ПЛАНИРОВКИ - один модуль, два маршрута, два владельца

Общий код `renderLayouts` `v490-workflow.js:217`, хранилище `CASE_LAYOUT_VERSIONS` `core.js:62`,
типы версий `LAYOUT_TYPES` `v490-workflow.js:26` (`source/advisory/leasing/approved/as_built`).
Маршруты: `project_layouts` (`v3520-workspaces.js:21`), `leasing_layouts` (`v3520-workspaces.js:54`),
`plan_master` (`v3520-workspaces.js:46`), `plans` (`v3520-workspaces.js:44`).
Параллельно в ядре живёт свой слой планировок: `PLAN_CODES`, `planFor` `core.js:2242`,
`uploadPlan` `core.js:2476`, `planDiff` `core.js:2674`.

**Риск:** это единственная сущность, которую оба контура уже ведут общим кодом, но у неё **два
несвязанных хранилища**: файлы версий в `CASE_LAYOUT_VERSIONS` и рабочий SVG-план в ядре.
Баннер расхождения (`regPlanMismatchBanner` `core.js:1633`) сравнивает реестр только с ядровым
планом, версии Advisory в сверке не участвуют.

---

## 9. Дополнительный факт: три готовых модуля не подключены ни к одной воронке

| Модуль | Экспорт | Потребители |
|---|---|---|
| `os/v4670-offer-pricing.js` (расчёт цены КП, журнал отклонений) | `window.CASE_OFFER_PRICING` `v4670-offer-pricing.js:358` | **0** |
| `os/v4680-project-directories.js` (вид проекта / тип работ / сегмент) | `window.CASE_PROJECT_DIR` `v4680-project-directories.js:162` | **0** |
| `os/v4690-offer-cover.js` (обложка КП) | `window.CASE_OFFER_COVER` `v4690-offer-cover.js:110` | **0** |

Все три загружаются в браузер (`os/index.html:492-494`), но `grep` по именам экспортов вне самих
файлов не даёт ни одного совпадения. В шапке `v4680-project-directories.js:4` прямо написано,
что справочники требуются «в Advisory при заведении проекта» - в `v490-workflow.js`/`v492-portfolio-proposals.js`
вызовов нет.
