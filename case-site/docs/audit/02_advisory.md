# Воронка ADVISORY (консалтинг) в CASE OS - карта того, что есть в коде

Источники (все пути абсолютные):
- `/home/user/case-site/case-site/os/v490-workflow.js` - ядро воронки: клиенты, возможности, КП, договоры, Scope, задачи, deliverables, cross-sell, шаблоны.
- `/home/user/case-site/case-site/os/v492-portfolio-proposals.js` - конструктор КП + первая версия карты портфеля.
- `/home/user/case-site/case-site/os/v493-portfolio-suite.js` - итоговая карта проектов портфеля (перехватывает маршрут поверх v492).
- `/home/user/case-site/case-site/os/v490-caseos.js` - страницы-заглушки «ЗАПЛАНИРОВАНО» для не реализованных разделов.
- `/home/user/case-site/case-site/os/core.js` - объявление и сохранение массивов данных, список валидных маршрутов.
- `/home/user/case-site/case-site/os/v3520-workspaces.js` - подписи и иконки пунктов меню (не входил в список, но подписи разделов только там).

Порядок загрузки модулей: `index.html:473,478,479,480,482` - `v3520-workspaces` → `v490-caseos` → `v490-workflow` → `v492` → `v493`. Каждый следующий модуль оборачивает `window.go`, поэтому за карту портфеля отвечает v493 (`v493-portfolio-suite.js:196`), за конструктор КП - v492 (`v492-portfolio-proposals.js:78`), за остальные advisory-разделы - v490-workflow (`v490-workflow.js:258`).

---

## 0. Общая модель хранения

Все сущности воронки - глобальные массивы в памяти браузера, объявлены в `core.js:54-64`:

| Переменная | Строка объявления | Что хранит |
|---|---|---|
| `CASE_CLIENTS` | `core.js:54` | клиенты CRM |
| `CASE_OPPORTUNITIES` | `core.js:55` | возможности (карточки воронки) |
| `CASE_PROPOSALS` | `core.js:56` | коммерческие предложения |
| `CASE_CONTRACTS` | `core.js:57` | договоры Advisory |
| `CASE_SCOPE_ITEMS` | `core.js:58` | строки Scope of Work |
| `CASE_SCOPE_CHANGES` | `core.js:59` | Change Requests по Scope |
| `CASE_TASKS` | `core.js:60` | задачи |
| `CASE_DELIVERABLES` | `core.js:61` | отчёты / результаты |
| `CASE_LAYOUT_VERSIONS` | `core.js:62` | версии планировок |
| `CASE_DECISIONS` | `core.js:63` | решения |
| `CASE_DOCUMENT_TEMPLATES` | `core.js:64` | шаблоны документов |
| `CASE_PORTFOLIO_PROJECTS`, `CASE_PROPOSAL_CATALOG` | загрузка `core.js:941-942`, сохранение `core.js:130` | портфель проектов и каталог пакетов КП |

Сериализация: `stateBlob()` в `core.js:130` кладёт все перечисленные массивы в один JSON-блоб. Запись - `persist()` `core.js:907-918` (localStorage под `STORAGE_KEY`) и `apiSaveState()` `core.js:155` (отложенная отправка на сервер через 800 мс). Загрузка с сервера - `core.js:938-951`.

Единая точка сохранения воронки - `save()` в `v490-workflow.js:45`: вызывает `audit()`, `persist()`, `apiSaveState()`, `toast('Сохранено')`. В v492 - своя `save()` (`v492-portfolio-proposals.js:22`), в v493 - `persistQuiet()`.

Отдельной БД / таблиц для advisory-воронки в этих файлах **не найдено**: всё через общий блоб состояния. SQL-схема лежит в `/home/user/case-site/case-site/os/sql`, но в перечисленных файлах она не используется.

---

## 1. Полные списки стадий и статусов

Все константы объявлены в шапке `v490-workflow.js:9-19`.

### 1.1. `PIPE_STAGES` - стадии воронки (`v490-workflow.js:9-14`)

| # | Код | Подпись |
|---|---|---|
| 1 | `new` | Новый запрос |
| 2 | `contact` | Первичный контакт |
| 3 | `discovery` | Переговоры и сбор данных |
| 4 | `proposal` | Подготовка КП |
| 5 | `proposal_sent` | КП отправлено |
| 6 | `negotiation` | Согласование условий |
| 7 | `accepted` | КП принято |
| 8 | `contract` | Подготовка договора |
| 9 | `signing` | На подписании |
| 10 | `won` | Договор подписан |
| 11 | `paused` | Приостановлено |
| 12 | `lost` | Проиграно |

### 1.2. `TASK_STATUSES` - статусы задач (`v490-workflow.js:15`)

| Код | Подпись |
|---|---|
| `backlog` | Запланировано |
| `ready` | Готово к началу |
| `doing` | В работе |
| `review` | На проверке |
| `changes` | Требует исправлений |
| `client` | Ожидает клиента |
| `blocked` | Заблокировано |
| `done` | Завершено |
| `cancelled` | Отменено |

### 1.3. `PROPOSAL_STATUSES` - статусы КП (`v490-workflow.js:16`)

| Код | Подпись |
|---|---|
| `draft` | Черновик |
| `internal_review` | Внутреннее согласование |
| `approved_internal` | Согласовано CASE |
| `sent` | Отправлено клиенту |
| `client_changes` | Изменения клиента |
| `accepted` | Принято клиентом |
| `rejected` | Отклонено |
| `expired` | Срок истёк |

### 1.4. `CONTRACT_STATUSES` - статусы договоров (`v490-workflow.js:17`)

| Код | Подпись |
|---|---|
| `draft` | Подготовка |
| `legal` | Юридическая проверка |
| `client_review` | Согласование клиента |
| `signing` | На подписании |
| `signed` | Подписан |
| `active` | Активен |
| `completed` | Завершён |
| `paused` | Приостановлен |
| `terminated` | Расторгнут |

### 1.5. `DELIVERABLE_STATUSES` - статусы результатов (`v490-workflow.js:18`)

| Код | Подпись |
|---|---|
| `planned` | Запланирован |
| `working` | В работе |
| `qa` | Внутренний QA |
| `changes` | Требует исправлений |
| `ready` | Готов к отправке |
| `sent` | Передан клиенту |
| `comments` | Комментарии клиента |
| `final` | Финальный |
| `accepted` | Принят клиентом |

### 1.6. Сопутствующие справочники

`DEPARTMENTS` (`v490-workflow.js:19`): `Advisory`, `Leasing & Sales`, `Finance`, `Property & Facility Management`, `Data & Analytics`, `Management`.

`SERVICE_TYPES` (`v490-workflow.js:20-25`): `market_research` / Market Research; `geoanalytics` / Geoanalytics; `concept` / Commercial Concept; `area_programme` / Area Programme; `tenant_mix` / Tenant Mix; `layout` / Layout / Zoning; `feasibility` / Financial Feasibility; `business_plan` / Business Plan; `mep` / MEP / Technical Brief; `design_review` / Design Review; `leasing` / Leasing; `preopening` / Pre-opening; `generic` / Другая услуга.

`LAYOUT_TYPES` (`v490-workflow.js:26`): `source` Исходная, `advisory` Advisory, `leasing` Leasing, `approved` Утверждённая рабочая, `as_built` As-built.

Раскраска бейджей - `statusClass()` `v490-workflow.js:51`: зелёный (`ok`) для `done, accepted, signed, active, final, won, approved, approved_internal`; красный (`bad`) для `lost, rejected, terminated, cancelled, changes`; жёлтый (`warn`) для `blocked, expired`.

Копии стадий и статусов задач дублируются в настройки при старте - `bootstrap()` `v490-workflow.js:69-72` пишет `CASE_WORKFLOW_SETTINGS.pipelineStages` и `.taskStatuses` и ставит `schemaVersion=490`. **Но рендер везде читает жёсткие константы `PIPE_STAGES` / `TASK_STATUSES`, а не эти настройки** - редактирование стадий через настройки ни на что не влияет.

---

## 2. Разделы по порядку

### 2.1. `crm_clients` - Клиенты

Меню: `v3520-workspaces.js` - пункт `crm_clients` (группа `advisory` не указана; см. группу `projects`/`crm`). Рендер: `renderClients()` `v490-workflow.js:84-93`.

**Сущность:** `CASE_CLIENTS` (`core.js:54`). Поиск клиента - `client(id)` `v490-workflow.js:39`.

**Экран:** заголовок «Клиенты», подзаголовок «Единая клиентская база CASE без дублей между Advisory, Leasing и Management» (`v490-workflow.js:92`). Один вид - таблица. Переключателя видов нет.

Колонки таблицы (`v490-workflow.js:90`): Клиент · Тип · Контакт · Связь · Relationship owner · Возможностей · Статус.

**Поля формы** (`case49ClientEdit` `v490-workflow.js:95`):

| Подпись | id | Тип | Значения |
|---|---|---|---|
| Название клиента | `c49_client_name` | text | обязательное (`v490-workflow.js:96`) |
| Юридическое наименование | `c49_client_legal` | text | |
| Тип | `c49_client_type` | select | Собственник / девелопер · Инвестор · Арендатор / бренд · Партнёр · Другое |
| Контактное лицо | `c49_client_contact` | text | |
| Телефон | `c49_client_phone` | tel | |
| Email | `c49_client_email` | email | |
| Ответственный менеджер | `c49_client_owner` | text | по умолчанию текущий пользователь |
| Статус | `c49_client_status` | select | Активный · Потенциальный · Архив |
| Примечание | `c49_client_notes` | textarea 4 строки | |

**Действия:** поиск с задержкой 160 мс (`case49ClientSearch` `v490-workflow.js:94`), «+ Добавить клиента», клик по имени → карточка, «Отмена», «Сохранить» (`case49ClientSave` `v490-workflow.js:96`). Удаления клиента **не найдено**. Архивация только через поле «Статус = Архив».

---

### 2.2. `advisory_pipeline` - Воронка

Меню: `v3520-workspaces.js:26` - «Воронка Advisory», иконка `⇢`. Рендер: `renderPipeline()` `v490-workflow.js:99-108`.

**Сущность:** `CASE_OPPORTUNITIES` (`core.js:55`), доступ - `opportunity(id)` `v490-workflow.js:41`. Префикс id - `opp_` (`v490-workflow.js:118`).

**Экран.** Заголовок «Воронка Advisory», подзаголовок «От первого контакта с владельцем до подписанного договора и запуска проекта» (`v490-workflow.js:108`).

KPI-строка (`v490-workflow.js:104`): всего возможностей · pipeline по валютам · weighted pipeline · подписанных договоров. Взвешивание - `currencyTotals(rows, true)` умножает `value * probability / 100` (`v490-workflow.js:36`); из суммы исключены только карточки со стадией `lost` (`v490-workflow.js:100`).

**Переключение видов** (`v490-workflow.js:105`, обработчик `case49PipelineMode` `v490-workflow.js:113`): два режима - **Kanban** (по умолчанию, `UI.pipelineMode='kanban'` `v490-workflow.js:27`) и **Таблица**. Режим хранится только в памяти модуля, при перезагрузке сбрасывается на Kanban.

- Kanban (`pipelineKanban` `v490-workflow.js:111`): 12 колонок по числу стадий, в шапке колонки - количество и сумма по валютам, кнопка «＋» создаёт возможность сразу в этой стадии. Карточка (`oppCard` `v490-workflow.js:110`): название проекта, бейдж вероятности в %, имя клиента, сумма, ответственный, следующий шаг с датой (или «Следующий шаг не указан»). Карточки перетаскиваются: `case49OppDrag` `v490-workflow.js:114` / `case49OppDrop` `v490-workflow.js:115`.
- Таблица (`pipelineTable` `v490-workflow.js:112`): Возможность · Этап · Услуга · Стоимость · Вероятность · Ответственный · Следующий шаг.

**Поля формы возможности** (`case49OpportunityEdit` `v490-workflow.js:116`):

| Подпись | id | Тип | Примечание |
|---|---|---|---|
| Клиент | `c49_opp_client` | select из `CASE_CLIENTS` | обязательное |
| Название проекта / объекта | `c49_opp_project` | text | обязательное |
| Связанный объект CASE | `c49_opp_object` | select из `OBJECTS` (не архивных) | «Пока не выбран» |
| Потенциальная услуга | `c49_opp_service` | text | свободный текст, не связан с `SERVICE_TYPES` |
| Этап воронки | `c49_opp_stage` | select `PIPE_STAGES` | |
| Ожидаемая стоимость | `c49_opp_value` | number, min 0, step 0.01 | |
| Валюта | `c49_opp_currency` | select | USD · UZS · EUR |
| Вероятность, % | `c49_opp_probability` | number 0..100 | по умолчанию 10 |
| Ответственный | `c49_opp_owner` | text | по умолчанию имя текущего пользователя |
| Источник лида | `c49_opp_source` | text | |
| Следующий шаг | `c49_opp_next` | text | |
| Дата следующего шага | `c49_opp_next_date` | date | по умолчанию сегодня + 2 дня |
| Потребность клиента / заметки | `c49_opp_notes` | textarea 5 строк | |
| Причина проигрыша | `c49_opp_lost` | text | **отображается только если `stage === 'lost'`** |

**Действия и кнопки:** «+ Новая возможность»; «＋» в шапке колонки Kanban; drag-and-drop между колонками; в модалке - «Отмена», «Создать КП» (только для сохранённой возможности, вызывает `case49ProposalCreate`), «Сохранить» (`case49OpportunitySave` `v490-workflow.js:118`).

**Автоматика при перетаскивании** (`case49OppDrop` `v490-workflow.js:115`): при переносе в `proposal`, если «Следующий шаг» пуст, подставляется «Подготовить коммерческое предложение» + срок сегодня+3; при переносе в `contract` - «Подготовить договор» + срок сегодня+2. Иных автоматических действий по стадиям нет.

Удаления возможности **не найдено**.

---

### 2.3. `advisory_proposal_builder` - Конструктор КП

Меню: `v3520-workspaces.js:27` - «Конструктор КП», иконка `✎`. Рендер: `renderProposalBuilder()` `v492-portfolio-proposals.js:52-60`.

**Сущности.** Пишет в `CASE_PROPOSALS` и `CASE_SCOPE_ITEMS`. Каталог пакетов - `CASE_PROPOSAL_CATALOG` (инициализация `ensureData()` `v492-portfolio-proposals.js:26`, версия `4.9.3`). Локальное UI-состояние - `v492-portfolio-proposals.js:7`.

**Три пакета** (`PKGS` `v492-portfolio-proposals.js:8-12`):

| id | Название | Подзаголовок | Блоков | Ориентир, раб. дней |
|---|---|---|---|---|
| `concept` | Concept Advisory | Концепция и ключевое рыночное понимание без отдельного полного отчёта | 9 | 30 |
| `feasibility` | Commercial Feasibility | Концепция, облегчённый рынок и финансовая feasibility-модель | 13 | 55 |
| `strategic` | Strategic Development Advisory | Полное исследование, технические задания, глубокая финансовая модель и большой отчёт | 23 | 85 |

Состав: `concept` = project_review, market_scan, competitor_scan, location_review, positioning, concept, area_programme, zoning, layout_review. `feasibility` = project_review, market_lite, competitor_analysis, location_review, positioning, concept, area_programme, zoning, tenant_mix, commercial_assumptions, feasibility_model, scenario_analysis, summary_report. `strategic` = project_review, macro, market_full, field_research, competitor_full, geo_catchment, demand_supply, location_review, positioning, concept, area_programme, zoning, tenant_mix, layout_review, commercial_budget, feasibility_full, scenario_sensitivity, architecture_brief, mep_brief, phasing, risk_register, big_report, presentation_support.

**Каталог из 31 услуги** (`SERVICES` `v492-portfolio-proposals.js:13-15`), формат `[название, serviceType, отдел, deliverable, дней, часов]`:

| Ключ | Название | Отдел | Deliverable | Дн. | Ч. |
|---|---|---|---|---|---|
| `project_review` | Изучение проекта и исходных данных | Advisory | Меморандум исходных предпосылок | 8 | 16 |
| `market_scan` | Основное исследование рынка для внутреннего понимания | Advisory | Выводы используются в концепции; отдельный отчёт не выпускается | 10 | 24 |
| `competitor_scan` | Экспресс-анализ ключевых конкурентов | Advisory | Краткая сравнительная таблица | 7 | 18 |
| `location_review` | Анализ локации и доступности | Advisory | Выводы по локации | 6 | 16 |
| `positioning` | Позиционирование и целевые аудитории | Advisory | Стратегия позиционирования | 6 | 18 |
| `concept` | Коммерческая концепция | Advisory | Концептуальная презентация | 12 | 36 |
| `area_programme` | Программа площадей | Advisory | Area Programme / Excel | 8 | 26 |
| `zoning` | Функциональное зонирование | Advisory | Цветокодированные планы | 10 | 32 |
| `layout_review` | Рекомендации по планировкам и потокам | Advisory | Комментарии к планировкам | 9 | 28 |
| `market_lite` | Облегчённый обзор рынка | Advisory | Краткий рыночный раздел с выводами | 12 | 34 |
| `competitor_analysis` | Анализ конкурентов | Advisory | Competitor analysis | 10 | 28 |
| `tenant_mix` | Category / Tenant Mix | **Leasing & Sales** | Матрица категорий и целевых операторов | 10 | 30 |
| `commercial_assumptions` | Коммерческие предпосылки и ставки | Advisory | Таблица ставок и предпосылок | 7 | 22 |
| `feasibility_model` | Финансовая feasibility-модель | Advisory | Excel-модель и основные KPI | 15 | 48 |
| `scenario_analysis` | Сценарный анализ | Advisory | Сравнение сценариев | 6 | 20 |
| `summary_report` | Итоговая презентация | Advisory | Краткий итоговый отчёт | 10 | 32 |
| `macro` | Макроэкономический анализ | Advisory | Макроэкономический раздел | 10 | 28 |
| `market_full` | Глубокое исследование рынка | Advisory | Полный Market Research Report | 20 | 70 |
| `field_research` | Полевое исследование | Advisory | Fieldwork database и фотофиксация | 12 | 48 |
| `competitor_full` | Полный конкурентный аудит | Advisory | Подробные профили конкурентов | 14 | 50 |
| `geo_catchment` | Геоаналитика и catchment | **Data & Analytics** | Карты, drive-time и trade area | 12 | 40 |
| `demand_supply` | Анализ спроса и предложения | Advisory | Demand & Supply Analysis | 12 | 40 |
| `commercial_budget` | Коммерческий бюджет / rent-roll | Advisory | Rental or sales budget | 10 | 36 |
| `feasibility_full` | Полное финансовое ТЭО | Advisory | Cash flow, NOI, IRR, NPV, payback | 22 | 90 |
| `scenario_sensitivity` | Сценарный и sensitivity-анализ | Advisory | Sensitivity matrix | 9 | 32 |
| `architecture_brief` | Техническое задание для архитекторов | Advisory | Architectural Design Brief | 16 | 52 |
| `mep_brief` | Технические требования к инженерным системам | Advisory | MEP Requirements Brief | 14 | 46 |
| `phasing` | Рекомендации по фазированию | Advisory | Phasing strategy | 7 | 22 |
| `risk_register` | Реестр коммерческих и инвестиционных рисков | Advisory | Risk register | 7 | 24 |
| `big_report` | Большой итоговый отчёт | Advisory | Full Advisory Report | 18 | 72 |
| `presentation_support` | Презентация и сопровождение согласования | Advisory | Client / investor presentation | 8 | 28 |

**Типы проекта и ставки** (`TYPE_DEFAULTS` `v492-portfolio-proposals.js:16`):

| Ключ | Подпись | Модель по умолчанию | Ставки $/м² (concept / feasibility / strategic) |
|---|---|---|---|
| `retail` | Торговый центр / ритейл | `per_sqm` | 2 / 2.5 / 4.5 |
| `mixed` | Многофункциональный комплекс | `hybrid` | 2 / 2.5 / 4.5 |
| `office` | Бизнес-центр / офисы | `fixed` | ставок нет |
| `residential` | Жилой комплекс | `fixed` | ставок нет |
| `hotel` | Гостиница / курорт | `fixed` | ставок нет |
| `industrial` | Логистика / индустриальный объект | `fixed` | ставок нет |
| `other` | Другой объект | `fixed` | ставок нет |

**Экран.** Двухколоночный layout `case492-builder-grid`: слева 4 пронумерованные секции, справа боковая панель предпросмотра. Переключателя видов нет.

**Блок 1 «Клиент и проект»** (`v492-portfolio-proposals.js:54`):

| Подпись | id | Тип |
|---|---|---|
| Возможность | `c492_opp` | select из `CASE_OPPORTUNITIES` + «Без связи с воронкой»; при выборе автозаполняет клиента и проект (`case492OppChange` `v492-portfolio-proposals.js:63`) |
| Номер КП | `c492_no` | text, автогенерация `CP-###` по числу КП |
| Клиент | `c492_client` | text |
| Проект | `c492_project` | text (обязательное) |
| Тип проекта | `c492_type` | select из `TYPE_DEFAULTS`; смена типа меняет модель цены и ставку (`case492TypeChange` `v492-portfolio-proposals.js:62`) |
| Локация | `c492_location` | text |
| Краткое понимание проекта | `c492_understanding` | textarea, на всю ширину |

**Блок 2 «Пакет и Scope»** (`v492-portfolio-proposals.js:55`): три карточки пакетов (`packageCards` `v492-portfolio-proposals.js:50`), переключатель «Ручной набор» (`case492CustomMode` `v492-portfolio-proposals.js:61`), матрица из 31 чекбокса (`serviceMatrix` `v492-portfolio-proposals.js:51`), строка добавления индивидуальной работы: `c492_custom_title` (text, placeholder «Добавить индивидуальную работу») + `c492_custom_price` (number, min 0, placeholder «Цена») + кнопка «Добавить» (`case492AddCustomService` `v492-portfolio-proposals.js:65`), список добавленных с кнопкой «×» (`case492RemoveCustomService`).

**Блок 3 «Цена и сроки»** (`v492-portfolio-proposals.js:56`):

| Подпись | id | Тип | Видимость |
|---|---|---|---|
| Модель цены | `c492_price_mode` | select: Цена за м² (`per_sqm`) · Фиксированная общая цена (`fixed`) · За м² + фиксированная часть (`hybrid`) · Цена по этапам (`stages`) · Ручная итоговая цена (`manual_total`) | всегда |
| Валюта | `c492_currency` | select USD · UZS · EUR | всегда |
| Расчётная площадь, м² | `c492_area` | number min 0 step 1 | `per_sqm`, `hybrid` |
| Ставка за м² | `c492_rate` | number min 0 step 0.01 | `per_sqm`, `hybrid` |
| Фиксированная часть | `c492_fixed` | number min 0 step 0.01 | `fixed`, `hybrid` |
| Сумма этапов | `c492_stage_total` | number min 0 step 0.01 | `stages` |
| Ручная итоговая цена | `c492_manual_total` | number min 0 step 0.01 | `manual_total` |
| Срок, рабочих дней | `c492_days` | number min 1, по умолчанию `defaultDays` пакета | всегда |
| Причина ручной цены / скидки | `c492_override_reason` | textarea, на всю ширину | `manual_total` |

Логика показа/скрытия - `case492PriceVisibility` `v492-portfolio-proposals.js:49`. Формула - `computePrice()` `v492-portfolio-proposals.js:45`: `per_sqm` = площадь × ставка; `fixed` = фикс; `hybrid` = площадь × ставка + фикс; `stages` = сумма этапов; `manual_total` = ручная сумма. Индивидуальные работы прибавляются сверху (`effectivePrice()` `v492-portfolio-proposals.js:47`), кроме режимов `manual_total` и `stages`.

**Блок 4 «Коммерческие условия»** (`v492-portfolio-proposals.js:57`):

| Подпись | id | Тип | По умолчанию |
|---|---|---|---|
| Версия | `c492_version` | text | 1.0 |
| Действует до | `c492_until` | date | сегодня + 30 дней |
| Аванс, % | `c492_pay1` | number 0..100 | 40 |
| После чернового отчёта, % | `c492_pay2` | number 0..100 | 30 |
| После финального отчёта, % | `c492_pay3` | number 0..100 | 30 |
| Статус | `c492_status` | select: Черновик (`draft`) · Внутреннее согласование (`internal_review`) · Отправлено клиенту (`sent`) · Пересматривается (`revising`) · Принято клиентом (`accepted`) · Отклонено (`declined`) | draft |
| Допущения, исключения и примечания | `c492_notes` | textarea | |

**Расхождение статусов:** список конструктора не совпадает с `PROPOSAL_STATUSES` из `v490-workflow.js:16` - здесь есть `revising` и `declined`, но нет `approved_internal`, `client_changes`, `rejected`, `expired`. В реестре КП `label(PROPOSAL_STATUSES, p.status)` (`v490-workflow.js:121`) для `revising`/`declined` вернёт сам код без русской подписи.

**Боковая панель предпросмотра** (`v492-portfolio-proposals.js:58`): название и подзаголовок пакета, Проект, Модель цены, Итого, кнопки «Открыть документ» и «Скачать Word-совместимый файл», справка «Два режима».

**Кнопки в шапке** (`v492-portfolio-proposals.js:60`): «Быстрое ручное КП» (`case492QuickProposal` `v492-portfolio-proposals.js:74` - возвращает старую модалку v490), «Очистить» (`case492ProposalReset` `v492-portfolio-proposals.js:68`), «Создать КП» / «Сохранить изменения» (`case492ProposalSave` `v492-portfolio-proposals.js:67`).

**Проверки при сохранении** (`v492-portfolio-proposals.js:67`): пустой проект - блокировка; ни одной услуги - блокировка; сумма графика платежей ≠ 100 % - `confirm()` с возможностью продолжить; режим `manual_total` без причины - блокировка.

**Что делает сохранение** (`v492-portfolio-proposals.js:67`):
1. Создаёт или обновляет запись в `CASE_PROPOSALS` (`id` вида `cp-…`).
2. Помечает `archived=true` все прошлые Scope-строки этого КП с `source==='proposal_builder_v492'`.
3. Создаёт новые `CASE_SCOPE_ITEMS` для каждой выбранной услуги: title, serviceType, department, deliverable, durationDays, plannedHours берутся из `SERVICES`; **`price: 0`**, `iterations: 2`, `description: 'Создано из пакета …'`.
4. Для индивидуальных работ: `serviceType: 'generic'`, `department: 'Advisory'`, `deliverable: 'По согласованию'`, `durationDays: 5`, `plannedHours: 8`, `price` = введённая цена.
5. Двигает стадию связанной возможности: `accepted` → `accepted`, `sent` → `proposal_sent`, иначе → `proposal`.
6. Уходит на `advisory_proposals`.

**Генерация документа** (`documentHTML` `v492-portfolio-proposals.js:70`): собирает HTML-страницу А4 с шапкой CASE, обращением к клиенту, разделами «Понимание проекта», «Scope of Work» (таблица #, Работа, Результат, Срок), «Стоимость и сроки», «Порядок оплаты», «Условия», блоком подписей. «Открыть документ» открывает в новом окне и вызывает `window.print()` (`case492ProposalPreview` `v492-portfolio-proposals.js:73`). «Скачать» отдаёт Blob с MIME `application/msword` и расширением `.doc` (`case492ProposalDownload` `v492-portfolio-proposals.js:73`) - это HTML под видом Word, не настоящий DOCX, и **шаблоны из `CASE_DOCUMENT_TEMPLATES` в этой генерации не участвуют**.

---

### 2.4. `advisory_proposals` - Реестр КП

Меню: `v3520-workspaces.js:28` - «Реестр КП», иконка `▧`. Рендер: `renderProposals()` `v490-workflow.js:122`.

**Сущности:** `CASE_PROPOSALS` + связанные `CASE_SCOPE_ITEMS`. Доступ - `proposal(id)` `v490-workflow.js:39`.

**Экран:** заголовок «Коммерческие предложения», подзаголовок «Версии, Scope of Work, цена, сроки, итерации и внутреннее согласование». Пояснение в тулбаре: «КП хранится версиями. Принятая клиентом версия становится основанием договора и Scope». Один вид - таблица, переключателя нет.

Колонки (`v490-workflow.js:122`): КП (номер + «Версия X») · Проект / клиент · Статус · Scope (число не архивных строк) · Стоимость · Действует до · блок кнопок.

**Кнопки в каждой строке** (`proposalRows` `v490-workflow.js:121`): «Конструктор» (`case492EditProposal`), «Открыть» (`case49ProposalOpen`), «Новая версия» (`case49ProposalClone`), «Договор» (`case49ContractFromProposal`).

**Кнопка «+ Создать КП»** вызывает `case49ProposalCreate`, но v492 при установке подменяет эту функцию (`v492-portfolio-proposals.js:78`), поэтому фактически открывается **Конструктор КП**, а не старая модалка.

**Старая модалка создания КП** (`case49ProposalCreate` `v490-workflow.js:123`, доступна только через «Быстрое ручное КП»):

| Подпись | id | Тип |
|---|---|---|
| Возможность | `c49_prop_opp` | select `CASE_OPPORTUNITIES` + «Без связи с воронкой» |
| Номер КП | `c49_prop_no` | text, автогенерация `CP-###` |
| Версия | `c49_prop_version` | text, «1.0» |
| Шаблон документа | `c49_prop_template` | select из `CASE_DOCUMENT_TEMPLATES` с `type==='proposal'` |
| Общая стоимость | `c49_prop_fee` | number min 0 step 0.01 |
| Валюта | `c49_prop_currency` | select USD · UZS · EUR |
| Действует до | `c49_prop_until` | date, сегодня + 14 дней |
| Статус | `c49_prop_status` | select `PROPOSAL_STATUSES`, по умолчанию `draft` |
| Условия оплаты | `c49_prop_payment` | textarea 3 строки, placeholder «Например: 50% аванс / 50% после передачи финального отчёта» |
| Исключения и примечания | `c49_prop_notes` | textarea 4 строки |

При сохранении (`case49ProposalSave` `v490-workflow.js:124`) связанная возможность переводится в стадию `proposal` и получает `proposalId`.

**Карточка КП** (`case49ProposalOpen` `v490-workflow.js:125`): полоса «Проект / Клиент / Статус / Стоимость», секция «Scope of Work» со списком работ (порядковый номер, название, тип услуги + отдел, deliverable, дни / часы / цена, кнопка «•••» для правки), секция «Коммерческие условия» с текстом условий оплаты. Кнопки: «Закрыть», «Изменить КП», «Создать договор».

**Форма правки метаданных КП** (`case49ProposalEditMeta` `v490-workflow.js:127`): Номер, Версия, Стоимость (number), Валюта, Действует до (date), Статус, Условия оплаты (textarea 3), Примечания (textarea 4). При сохранении (`case49ProposalUpdate` `v490-workflow.js:128`) статус `sent` двигает возможность в `proposal_sent`, статус `accepted` - в `accepted`.

**Новая версия КП** (`case49ProposalClone` `v490-workflow.js:129`): минорный номер +1 (`1.0` → `1.1`), статус сбрасывается в `draft`, ставится `parentProposalId`, копируются все не архивные Scope-строки с обнулением `projectId` и `contractId`.

**Форма строки Scope** (`case49ScopeItemEdit` `v490-workflow.js:130`):

| Подпись | id | Тип | По умолчанию |
|---|---|---|---|
| Название работы | `c49_scope_title` | text | обязательное |
| Тип услуги / шаблон задач | `c49_scope_type` | select `SERVICE_TYPES` | `generic` |
| Ответственное направление | `c49_scope_dept` | select `DEPARTMENTS` | Advisory |
| Результат / deliverable | `c49_scope_deliv` | text | |
| Срок, рабочих дней | `c49_scope_days` | number min 1 | 5 |
| Плановые часы | `c49_scope_hours` | number min 0 step 0.5 | 16 |
| Цена работы | `c49_scope_price` | number min 0 step 0.01 | |
| Количество итераций | `c49_scope_iterations` | number min 0 | 2 |
| Порядок | `c49_scope_order` | number min 1 | следующий по счёту |
| Предпочтительный исполнитель | `c49_scope_assignee` | select людей + «Не назначено» | |
| Описание и границы работы | `c49_scope_desc` | textarea 4 строки | |

Кнопки: «Отмена», «Исключить» (только для существующей строки, `case49ScopeArchive` `v490-workflow.js:132` - `confirm`, затем `archived=true`, `status='excluded'`), «Сохранить».

---

### 2.5. `advisory_contracts` - Договоры

Меню: `v3520-workspaces.js:30` - «Договоры Advisory», иконка `▣`. Рендер: `renderContracts()` `v490-workflow.js:137`. Тот же рендер обслуживает маршрут `project_contracts` (`v490-workflow.js:245`).

**Сущность:** `CASE_CONTRACTS` (`core.js:57`), доступ - `contract(id)` `v490-workflow.js:40`, префикс id `ctr_`.

**Экран:** заголовок «Договоры Advisory», подзаголовок «Версии, согласование, подписание и автоматический запуск проекта». Пояснение: «Договор создаётся из принятого КП и сохраняет снимок Scope». Один вид - таблица.

Колонки: Договор (номер + «Версия X») · Проект / клиент · Статус · Стоимость · Подписан · Связанный проект («Проект не запущен», если нет) · кнопки.

**В тулбаре кнопки создания договора нет** - договор порождается только из КП. При пустом реестре в заглушке есть кнопка «Перейти к КП».

**Кнопки в строке:** «Открыть» и - только если статус `signed` либо `active` и `projectId` ещё пуст - «Запустить проект» (`case49ContractLaunch`).

**Создание из КП** (`case49ContractFromProposal` `v490-workflow.js:138`): если для этого КП уже есть договор со статусом ≠ `terminated`, открывается он. Иначе создаётся запись: номер `CTR-###`, версия `1.0`, статус `draft`, стоимость и валюта и условия оплаты копируются из КП; связанная возможность переводится в стадию `contract` и получает `contractId`.

**Поля формы договора** (`case49ContractEdit` `v490-workflow.js:139`):

| Подпись | id | Тип |
|---|---|---|
| Номер договора | `c49_ctr_no` | text |
| Версия | `c49_ctr_version` | text |
| Статус | `c49_ctr_status` | select `CONTRACT_STATUSES` |
| Стоимость | `c49_ctr_value` | number |
| Валюта | `c49_ctr_currency` | select USD · UZS · EUR |
| Дата подписания | `c49_ctr_signed` | date |
| Начало работ | `c49_ctr_start` | date, по умолчанию сегодня |
| Окончание по договору | `c49_ctr_end` | date |
| Шаблон договора | `c49_ctr_template` | select из `CASE_DOCUMENT_TEMPLATES` с `type==='contract'` |
| График оплаты | `c49_ctr_payment` | textarea 4 строки, подставляется из КП |
| Примечания / условия | `c49_ctr_notes` | textarea 4 строки |

Под формой - блок-выноска «Scope договора» с числом работ, которые будут перенесены в проект.

**Кнопки:** «Отмена» и одна из двух - «Сохранить и запустить проект» (если статус `signed`/`active` и проект ещё не создан) либо просто «Сохранить» (`case49ContractSave` `v490-workflow.js:140`). При сохранении со статусом `signed` или `active` связанная возможность переводится в стадию `won`.

Удаления договора **не найдено**. Расторжение - только через статус `terminated`.

---

### 2.6. `advisory_scope` - Объём работ

Меню: `v3520-workspaces.js:31` - «Объём работ (Scope)», иконка `☷`. Рендер: `renderScope()` `v490-workflow.js:176`.

**Сущности:** `CASE_SCOPE_ITEMS` и `CASE_SCOPE_CHANGES` (`core.js:58-59`).

**Экран.** Раздел проектный: без выбранного проекта (`S.obj`) показывается заглушка с селектором проекта (`projectPicker` `v490-workflow.js:50`). Переключателя видов нет.

KPI (`v490-workflow.js:176`): текущий Scope (число строк) · исходных работ (`baseline`) · плановых часов (сумма) · распределённая стоимость (сумма `price`, всегда подписывается как **USD**, безусловно, независимо от валюты договора).

Таблица Scope: # · Работа (+ тип услуги) · Направление · Deliverable · Срок · Часы · Задач (число связанных `CASE_TASKS`) · Источник (бейдж «Исходный» или «Изменение»).

Секция «Изменения Scope»: карточки с бейджем типа (Добавление / Исключение / Изменение) и статуса (Согласовано / Отклонено / На согласовании), название, причина, строка влияния «Срок: ±N дн. · Часы: ±N · Стоимость: N USD» и кнопка «Согласовать» - только если статус `pending` и у пользователя есть право `approve` (`canApprove()` `v490-workflow.js:33`).

**Поля формы Change Request** (`case49ScopeChangeEdit` `v490-workflow.js:179`):

| Подпись | id | Тип | Значения |
|---|---|---|---|
| Тип изменения | `c49_ch_type` | select | Добавить работу (`add`) · Изменить работу (`modify`) · Исключить работу (`remove`) |
| Связанная работа | `c49_ch_scope` | select текущих строк Scope + «Новая работа» | |
| Название / новая формулировка | `c49_ch_title` | text | |
| Тип услуги | `c49_ch_service` | select `SERVICE_TYPES` | `generic` |
| Направление | `c49_ch_dept` | select `DEPARTMENTS` | Advisory |
| Deliverable | `c49_ch_deliv` | text | |
| Изменение срока, дней | `c49_ch_days` | number | 0 |
| Изменение часов | `c49_ch_hours` | number | 0 |
| Изменение стоимости | `c49_ch_price` | number | 0 |
| Коммерческий режим | `c49_ch_commercial` | select | Входит в текущую стоимость (`included`) · Дополнительная платная работа (`paid`) · Внутренняя работа CASE (`internal`) · Требуется решение клиента (`pending`) |
| Причина и описание изменения | `c49_ch_reason` | textarea 5 строк | |

Кнопки: «Отмена», «Отправить на согласование» (`case49ScopeChangeSave` `v490-workflow.js:180` - статус `pending`, сохраняется снимок `oldValue`).

**Согласование** (`case49ScopeChangeApprove` `v490-workflow.js:181`): доступно только при `canApprove()`, спрашивает подтверждение. Далее:
- `add` - создаётся новая строка Scope (`baseline: false`, `scopeVersion: 'change'`) и **сразу генерируются задачи и deliverable** через `generateFromScope`;
- `remove` - строка помечается `excluded` + `archived`, все её незавершённые задачи получают статус `cancelled` и `cancelReason='Scope исключён'`;
- `modify` - поля перезаписываются, дни/часы/цена суммируются с дельтами, `baseline` сбрасывается в `false`.

Статус изменения становится `approved`, пишутся `approvedAt` и `approvedBy`. **Кнопки «Отклонить» не найдено** - статус `rejected` в рендере обрабатывается (`v490-workflow.js:177`), но выставить его из интерфейса нечем.

---

### 2.7. `advisory_delivery` - Выполнение

Меню: `v3520-workspaces.js:32` - «Выполнение проектов», иконка `✓`.

**Отдельного рендера у раздела нет.** Маршрут `advisory_delivery` в `v490-workflow.js:246` отображает ту же `renderProjectWorkspace()`, что и `project_workspace`. Функция - `v490-workflow.js:169`.

**Экран.** Без выбранного проекта - заглушка «Выберите проект» с селектором. С выбранным проектом:

- Заголовок «Рабочий стол проекта», подзаголовок «Контекст проекта для Advisory, Leasing, Finance и будущего Management».
- Шапка проекта: селектор проекта, название, список направлений, бейдж «N% выполнено» (доля задач со статусом `done`).
- KPI: работ Scope · открытых задач · просрочено (красным) · deliverables.
- Навигационная сетка из 6 плиток (`v490-workflow.js:169`): «Scope of Work» → `advisory_scope`; «Задачи» → `work_tasks`; «Планировки» → `project_layouts`; «Deliverables» → `advisory_reports`; «Договоры» → `project_contracts`; «Документы» → `docs`.
- Блок «Ближайшая работа»: до 8 открытых задач по сроку, кнопка «Все задачи», при отсутствии - кнопка «Добавить задачу».

Собственных полей формы у раздела нет. Фактическое выполнение ведётся в задачах - `renderTasks()` `v490-workflow.js:189`, маршруты `work_tasks` и `work_kanban`.

**Задачи (для полноты воронки).** Виды: Таблица / Kanban (`case49TaskMode` `v490-workflow.js:190`). Фильтры в тулбаре (`taskToolbar` `v490-workflow.js:185`): поиск, проект, статус (`TASK_STATUSES`), отдел (`DEPARTMENTS`), кнопка «+ Задача». Массовые операции при выделении чекбоксами: «Переназначить» (`case49BulkAssign` `v490-workflow.js:202`), «Изменить статус» (`case49BulkStatus` `v490-workflow.js:204`), «Снять выбор».

Поля карточки задачи (`case49TaskEdit` `v490-workflow.js:200`): Название задачи (`c49_task_title`, text), Проект (`c49_task_project`, select), Связанная работа Scope (`c49_task_scope`, select + «Внутренняя задача»), Направление (`c49_task_dept`, select `DEPARTMENTS`), Исполнитель (`c49_task_assignee`, select), Зависит от задачи (`c49_task_dep`, select), Статус (`c49_task_status`, select `TASK_STATUSES`), Приоритет (`c49_task_priority`, select: Низкий `low` · Обычный `normal` · Высокий `high` · Критический `critical`), Дата начала (`c49_task_start`, date), Дедлайн (`c49_task_due`, date), Плановые часы (`c49_task_plan`, number min 0 step 0.5), Фактические часы (`c49_task_actual`, number min 0 step 0.5), Ожидаемый результат / описание (`c49_task_desc`, textarea 4), Причина блокировки / комментарий (`c49_task_block`, textarea 3), блок «История назначений» только для чтения.

Переназначение требует указания причины (`case49TaskReassign` `v490-workflow.js:195`): Перегрузка · Отпуск или отсутствие · Изменение команды · Требуется другая компетенция · Задержка исполнения · Решение руководителя · Другое, плюс комментарий. Всё пишется в `assignmentHistory` (`assignmentChange` `v490-workflow.js:194`).

---

### 2.8. `advisory_reports` - Отчёты

Меню: `v3520-workspaces.js:33` - «Отчёты проектов», иконка `▤`. Рендер: `renderDeliverables()` `v490-workflow.js:211`.

**Сущность:** `CASE_DELIVERABLES` (`core.js:61`), префикс id `del_`.

**Экран:** заголовок «Черновые и финальные отчёты», подзаголовок «Формальные результаты проекта, версии, QA, отправка и комментарии клиента». В тулбаре - селектор проекта (фильтр, необязательный: без выбора показываются все) и кнопка «+ Deliverable». Один вид - таблица.

Колонки: Deliverable (+ «Версия X») · Проект · Статус · Ответственный · Срок · Передан · Итерации (`iteration / iterationLimit`).

**Поля формы** (`case49DeliverableEdit` `v490-workflow.js:212`):

| Подпись | id | Тип | По умолчанию |
|---|---|---|---|
| Название | `c49_del_title` | text | обязательное |
| Проект | `c49_del_project` | select `OBJECTS` | текущий проект |
| Тип | `c49_del_type` | select: Черновой отчёт (`draft_report`) · Финальный отчёт (`final_report`) · Финансовая модель (`model`) · Планировка (`layout`) · Техническое задание (`brief`) · Другой результат (`deliverable`) | |
| Статус | `c49_del_status` | select `DELIVERABLE_STATUSES` | `planned` |
| Ответственный | `c49_del_owner` | select людей | |
| Версия | `c49_del_version` | text | 1.0 |
| Срок | `c49_del_due` | date | сегодня + 10 дней |
| Дата передачи | `c49_del_sent` | date | |
| Текущая итерация | `c49_del_iter` | number min 0 | 0 |
| Лимит итераций | `c49_del_limit` | number min 0 | 2 |
| Комментарий клиента / QA | `c49_del_notes` | textarea 5 строк | |

**Действия:** «+ Deliverable», клик по названию → правка, «Отмена», «Сохранить» (`case49DeliverableSave` `v490-workflow.js:213`). Отдельная кнопка «Одобрить» есть в разделе согласований (`case49DeliverableApprove` `v490-workflow.js:232`): переводит статус `qa` → `ready`, пишет `qaAt` и `qaBy`.

**Прикрепления файла у deliverable нет** - поля для загрузки в форме `v490-workflow.js:212` не найдено (загрузчик `uploadProjectFile` `v490-workflow.js:216` используется только для планировок и шаблонов).

**Лимит итераций не контролируется:** `iterationLimit` только выводится в таблице и вводится в форме; проверок превышения в коде не найдено.

---

### 2.9. `advisory_cross_sell` - Следующие услуги

Меню: `v3520-workspaces.js:34` - «Следующие услуги», иконка `↗`. Рендер: `renderCrossSell()` `v490-workflow.js:233`.

**Сущности:** читает `OBJECTS` и `CASE_CONTRACTS`, пишет в `CASE_OPPORTUNITIES`.

**Отбор проектов:** только те объекты, по которым есть договор со статусом `active` или `completed` (`v490-workflow.js:233`).

**Экран:** заголовок «Следующие услуги», подзаголовок «Развитие клиента после Advisory: Leasing, продажи, pre-opening, Facility и Asset Management». Сетка карточек по проектам, в каждой - набор чипов-кнопок. Переключателя видов нет.

**Фиксированный список из 6 предложений** (`v490-workflow.js:233`): `Leasing & Sales`, `Продажа объекта / помещений`, `Pre-opening`, `Facility Management`, `Asset Management`, `Design Review / Development Support`. Чип становится `disabled` и получает «✓», если по этому объекту уже есть возможность с таким же значением поля `service`.

**Действие:** клик по чипу (`case49CrossSellCreate` `v490-workflow.js:234`) создаёт новую возможность: стадия `new`, вероятность 20 %, валюта USD, стоимость 0, ответственный - текущий пользователь, следующий шаг «Обсудить следующую услугу с клиентом» со сроком сегодня+3, `source: 'Cross-sell после Advisory'`, клиент подтягивается из первой найденной возможности по этому объекту. Затем переход на `advisory_pipeline`.

Формы полей у раздела нет.

---

### 2.10. `advisory_portfolio_map` - Карта проектов

Меню: `v3520-workspaces.js:29` - «Карта проектов Advisory», иконка `⌖`. Рендер побеждает v493: `render()` `v493-portfolio-suite.js:125`, установка перехвата `v493-portfolio-suite.js:196`. Реализация v492 (`renderPortfolio` `v492-portfolio-proposals.js:29`) остаётся в коде, но перекрыта, так как v493 подключается позже (`index.html:480` vs `index.html:482`).

**Сущность:** `CASE_PORTFOLIO_PROJECTS` - сид из 95+ записей в `v492-portfolio-proposals.js:6`, инициализация `ensureData()` `v492-portfolio-proposals.js:26`, миграция координат `v493-portfolio-suite.js:43`. Фильтр направления - `lineFor()` `v493-portfolio-suite.js:37`: для `advisory_portfolio_map` берётся `businessLines` содержит `'Advisory'`.

Важно (`allFor` `v493-portfolio-suite.js:87`): к портфелю добавляются объекты реестра `OBJECTS` через `objectsAsProjects`, но им жёстко присваивается `businessLines: ['Leasing & Sales']` (`v493-portfolio-suite.js:80`) - значит **на карте Advisory отображаются только записи исторического портфеля, объекты операционного реестра туда не попадают**.

**Экран** (`v493-portfolio-suite.js:125-139`). Заголовок «Карта проектов Advisory», подзаголовок «Единый портфель CASE: карта, список, фильтры и карточки проектов используют одну базу и автоматически доступны в Geoanalytics».

- Фильтр-карточка: поиск (`case493SearchInput`, ищет по названию, городу, стране, категории, инвестору, архитектору, услугам, направлениям), Все города / Все категории / Все годы / Все координаты (Требуют проверки, Подтверждены), кнопка «Сбросить», ряд чипов по странам с числом проектов.
- KPI: проектов · Σ GBA, м² · Σ GLA, м² · стран · точных точек.
- Предупреждение о точности: «N точек требуют ручного подтверждения координат» с кнопкой «Показать требующие проверки».
- Рабочая область: слева список проектов с сортировкой (По GLA / По названию / По году), справа карта.
- Панель карты: цвет по стране / по категории / по статусу; фильтр статуса (Все статусы, Под аренду, Под продажу, Выполнен); чекбоксы «Кластеры» и «Подписи»; кнопка «⌗» (показать все).
- Легенда под картой, боковая карточка проекта справа.
- Внизу сворачиваемая «Подробная таблица портфеля»: Проект · Локация · Категория · Инвестор / архитектор · GBA / GLA · Год · Услуги · Координаты.

**Переключение видов карты:** нет отдельного переключателя провайдера в UI - `drawMap()` `v493-portfolio-suite.js:141` всегда вызывает `drawLeaflet` (OpenStreetMap). Функция `drawYandex` `v493-portfolio-suite.js:143` и `resolveProvider` `v493-portfolio-suite.js:140` в коде есть, но из `drawMap` не вызываются.

**Карточка проекта** (`projectDetail` `v493-portfolio-suite.js:114`): Локация, Год, GBA, GLA, Инвестор, Архитектор, Направления, Координаты; чипы «Выполненные услуги»; Статус и «Объект (реестр)». Кнопки: «Geoanalytics», «Планировки», «Контроль аренды (LCR)», «Контроль продажи (SCR)», и при праве редактирования - «Редактировать» и «Уточнить точку».

**Форма правки проекта** (`case493ProjectEdit` `v493-portfolio-suite.js:177`): Название (`c493_name`, text, обязательное), Город (`c493_city`), Страна (`c493_country`), Категория (`c493_cat`), Год (`c493_year`, number), GBA, м² (`c493_gba`, number), GLA, м² (`c493_gla`, number), Статус (`c493_state`, select: Под аренду / Под продажу / Выполнен), Объект (реестр) (`c493_obj`, select `OBJECTS` + «- не связан -»). Кнопки: «Удалить проект», «Отмена», «Сохранить». Сохранение (`case493ProjectSave` `v493-portfolio-suite.js:188`) пишет предыдущие значения в `editHistory`.

**Форма координат** (`case493CoordinateEdit` `v493-portfolio-suite.js:173`): Широта, Долгота, Источник / комментарий, чекбокс «Точная локация проверена».

**Удаление** (`case493ProjectDelete` `v493-portfolio-suite.js:178-187`): только для админа, двойное подтверждение - `confirm` + ввод точного названия проекта в `prompt`. Ключ пишется в `CASE_WORKFLOW_SETTINGS.deletedPortfolioKeys`, чтобы запись не вернулась при повторном сидировании (`v492-portfolio-proposals.js:26`).

**Экспорт** (`case493Export` `v493-portfolio-suite.js:191`): кнопки «CSV» и «GeoJSON» в шапке. CSV содержит колонки sourceId, name, country, city, category, investor, architect, gba, gla, openingYear, scope, businessLines, lat, lng, coordinateAccuracy, verification, coordinateSource.

**Связи с воронкой у карты нет:** создать возможность или КП с карты нельзя, кнопок «Создать возможность» / «Создать КП» в `projectDetail` не найдено.

---

## 3. Путь от первого контакта до подписанного договора - по шагам

1. **Клиент.** `crm_clients` → «+ Добавить клиента» → `case49ClientSave` `v490-workflow.js:96` создаёт запись в `CASE_CLIENTS` со статусом «Активный».
2. **Возможность.** `advisory_pipeline` → «+ Новая возможность» (или «＋» в колонке нужной стадии) → `case49OpportunitySave` `v490-workflow.js:118`. Обязательны клиент и название проекта. Стартовая стадия - `new` (или та, из колонки которой нажали «＋»), вероятность 10 %, валюта USD, срок следующего шага - сегодня+2.
3. **Движение по стадиям** - только вручную: перетаскиванием карточки в Kanban (`case49OppDrop` `v490-workflow.js:115`) либо сменой поля «Этап воронки» в форме. Стадии `contact`, `discovery`, `negotiation`, `signing`, `paused` никак не автоматизированы - они меняются только руками.
4. **КП.** Из карточки возможности кнопка «Создать КП» (`v490-workflow.js:117`) либо из реестра КП «+ Создать КП». Фактически открывается **Конструктор КП** (подмена `case49ProposalCreate` в `v492-portfolio-proposals.js:78`).
5. **Сборка КП** в конструкторе: выбор возможности → выбор типа проекта (задаёт модель цены и ставку) → выбор пакета из трёх или включение «Ручной набор» → отметка услуг из 31 позиции + добавление индивидуальных работ → модель цены и расчёт → срок в рабочих днях → версия, срок действия, график платежей 40/30/30 %, статус, примечания.
6. **Сохранение КП** (`case492ProposalSave` `v492-portfolio-proposals.js:67`): запись в `CASE_PROPOSALS`, автогенерация строк `CASE_SCOPE_ITEMS` из выбранных услуг, перевод возможности в стадию `proposal` / `proposal_sent` / `accepted` - в зависимости от выставленного статуса КП.
7. **Документ КП.** «Открыть документ» → печатная HTML-страница; «Скачать Word-совместимый файл» → файл `.doc` (внутри HTML). `documentHTML` `v492-portfolio-proposals.js:70`.
8. **Внутреннее согласование** (опционально): статус КП `internal_review` выводит его в раздел «Мои согласования» (`renderApprovals` `v490-workflow.js:230`); кнопка «Согласовать» (`case49ProposalApprove` `v490-workflow.js:231`) переводит в `approved_internal` и пишет `approvedAt` / `approvedBy`. Доступно только при праве `approve`.
9. **Отправка клиенту и итерации** - только сменой статуса КП вручную (`sent`, `client_changes`, `accepted`, `rejected`, `expired`). Новая редакция оформляется кнопкой «Новая версия» (`case49ProposalClone` `v490-workflow.js:129`): версия +0.1, статус `draft`, Scope копируется.
10. **Договор.** Кнопка «Договор» в реестре КП или «Создать договор» в карточке КП → `case49ContractFromProposal` `v490-workflow.js:138`. Стоимость, валюта, условия оплаты переносятся из КП; возможность переходит в стадию `contract`.
11. **Согласование договора** - только сменой статуса вручную: `draft` → `legal` → `client_review` → `signing` → `signed`. Никаких проверок последовательности нет.
12. **Подписание.** В форме договора выставляются статус `signed` и «Дата подписания». При сохранении (`case49ContractSave` `v490-workflow.js:140`) возможность автоматически переходит в стадию `won`.

---

## 4. Что происходит после подписания

Ключевая функция - `case49ContractLaunch` `v490-workflow.js:168`, вызывается кнопкой «Запустить проект» в реестре договоров или «Сохранить и запустить проект» в форме договора. Условие: статус `signed` или `active` и `contract.projectId` ещё пуст.

Последовательность:

1. **Проект.** Если у возможности заполнен `objectId` и такой объект существует - используется он. Иначе создаётся новая запись в `OBJECTS` (`v490-workflow.js:168`): id вида `proj_…`, name/ru = название проекта из договора, `country: 'Узбекистан'`, `type: 'Advisory Project'`, `gba: 0`, `gla: 0`, `status: 'active'`, `businessLines: ['Advisory']`, `plan: 'Свой объект'`, `cur: 'USD'`, `vat: 'incl'`, `vatRate: 12`, `comm: {type:'flat', total:0, note:''}`.
2. **Договор** получает `projectId`, статус принудительно ставится в `active`.
3. **Снимок Scope.** Для каждой не архивной строки Scope этого КП проставляются `contractId` и `projectId` и делается глубокая копия в `baselineSnapshot` (title, description, durationDays, plannedHours, price, deliverable, department). Этот снимок далее не перезаписывается.
4. **Генерация задач** - `generateFromScope` `v490-workflow.js:167`. Для каждой строки Scope по её `serviceType` берётся шаблон из `blueprint()` `v490-workflow.js:149-162` - список типовых шагов. Полные шаблоны:
   - `market_research`: Запрос и проверка исходных данных → Desk research → Полевое исследование / сбор рыночных данных → Обработка и анализ данных → Подготовка выводов → Внутренний QA
   - `geoanalytics`: Подготовка геоданных и слоёв → Проверка координат и источников → Catchment / drive-time анализ → Интерпретация результатов → Внутренний QA
   - `concept`: Позиционирование и целевая аудитория → Функциональная программа → Категории и tenant mix → Зонирование и рекомендации → Внутренний QA
   - `area_programme`: Сбор исходных площадей → Декомпозиция GBA / GLA → Распределение по этажам и функциям → Сверка с планировкой → Внутренний QA
   - `tenant_mix`: Категорийный микс → Long list арендаторов → Short list и приоритеты → Сверка со ставками и площадями → Внутренний QA
   - `layout`: Анализ исходной планировки → Подготовка рабочей редакции → Проверка площадей и потоков → Согласование Advisory / Leasing / MEP → Выпуск версии
   - `feasibility`: Сбор предпосылок → Доходная модель → OPEX / CAPEX предпосылки → Сценарии и чувствительность → Проверка модели → Внутренний QA
   - `business_plan`: Структура бизнес-плана → Рыночная и коммерческая часть → Операционная модель → Финансовая часть → Риски и сценарии → Внутренний QA
   - `mep`: Сбор технических исходных данных → Определение нагрузок и требований → Подготовка MEP brief → Междисциплинарная проверка → Внутренний QA
   - `leasing`: Подготовка LCR → Формирование target list → Контакты и предложения → Переговоры → LOI / договор → Opening coordination
   - `preopening`: Pre-opening plan → Tenant coordination → Fit-out tracking → Операционная готовность → Проверка перед открытием
   - `generic` (и всё, чего нет в списке): Подготовка исходных данных → Выполнение основной работы → Самопроверка → Внутренний QA → Подготовка результата
   
   Для каждой задачи: первая в цепочке получает статус `ready`, остальные `backlog`; последняя получает приоритет `high`, остальные `normal`; сроки распределяются равномерно внутри `durationDays` строки Scope; плановые часы = `plannedHours` строки, делённые поровну на число шагов; выстраивается цепочка `dependsOn` (каждая задача зависит от предыдущей).
5. **Автоназначение исполнителей** - `bestAssignee` `v490-workflow.js:141-148`. Если у строки Scope указан «Предпочтительный исполнитель», берётся он. Иначе по отделу подбираются кандидаты по ключевым словам в должности/роли: Advisory - advisory, analyst, architect, консалт, аналит, архит, HM, BSH; Leasing & Sales - leasing, broker, agent, аренд, брокер, BA, AG, HO; Finance - finance, cfo, финанс, CFO; Property & Facility Management - facility, asset, property, engineer, эксплуата, инжен; Data & Analytics - data, gis, research, аналит, исслед; Management - ceo, director, руковод, ASH, ADM. Из кандидатов выбирается тот, у кого наименьшая сумма плановых часов по незавершённым задачам.
6. **Deliverables.** Если у строки Scope заполнено поле «Результат / deliverable», создаётся запись в `CASE_DELIVERABLES`: статус `planned`, версия `1.0`, срок - конец блока задач, тип `final_report`, если в тексте deliverable встречается «финал» или «final», иначе `deliverable`.
7. **Возможность** переводится в стадию `won`, получает `projectId` и вероятность 100 %.
8. **Переключение контекста:** `S.obj` ставится в новый проект, вызывается `rebuildObjSel()`, происходит переход на `project_workspace`. В журнал пишется «Проект запущен · задач: N».

Дальше работа идёт в разделах «Выполнение проектов» / «Задачи» / «Отчёты», изменения объёма - через Scope Change Request, продажа следующих услуг - через «Следующие услуги».

---

## 5. Чего в воронке НЕТ по сравнению с обычным ожиданием от CRM

Ниже - только то, что искалось в перечисленных файлах и не найдено.

**Деньги и коммерция**

1. **Комиссий по Advisory нет вообще.** В `v496-commissions.js`, `v326-commission-engines.js` и `v4670-offer-pricing.js` слово `advisory` не встречается ни разу (0 совпадений). Комиссионный контур привязан к брокерским сделкам аренды/продажи. Ни у `CASE_OPPORTUNITIES`, ни у `CASE_PROPOSALS`, ни у `CASE_CONTRACTS` нет полей комиссии, ставки вознаграждения, разбивки между исполнителями.
2. **Расчёт стоимости есть только в конструкторе КП** (`computePrice` `v492-portfolio-proposals.js:45`) - 5 моделей: за м², фиксированная, гибрид, по этапам, ручная. Но:
   - **себестоимости и маржи нет.** Часы в `SERVICES` есть, ставки часа сотрудника - не найдено; расчёта «плановая себестоимость проекта» нет.
   - **прайс-листа по услугам нет.** Каждая из 31 услуги не имеет цены - при генерации Scope в `case492ProposalSave` `v492-portfolio-proposals.js:67` всем пакетным работам жёстко проставляется `price: 0`. Поэтому KPI «распределённая стоимость» в разделе Scope (`v490-workflow.js:176`) для КП из конструктора всегда покажет только сумму индивидуальных работ.
   - **скидок как поля нет** - есть только textarea «Причина ручной цены / скидки», обязательная лишь в режиме `manual_total`.
   - **валютных курсов и приведения к одной валюте нет.** `currencyTotals` `v490-workflow.js:36` складывает суммы отдельно по каждой валюте и выводит строкой «X USD · Y UZS». При этом KPI Scope (`v490-workflow.js:176`) безусловно подписывает сумму как USD, независимо от реальной валюты.
   - **НДС в цене КП не рассчитывается.** Поля `vat`/`vatRate` появляются только у автосоздаваемого объекта (`v490-workflow.js:168`), в КП и договоре их нет.
3. **Счетов, платежей и дебиторки по договору нет.** График оплаты хранится текстом: в КП конструктора - тремя числами `paymentSchedule` (`v492-portfolio-proposals.js:66`), в договоре - свободной textarea «График оплаты». Записей о выставленных счетах, фактах оплаты, остатке долга нет. Раздел `finance_invoices` («Счета и платежи») - заглушка «ЗАПЛАНИРОВАНО» в `v490-caseos.js:29`, отрисовывается `plannedPage` `v490-caseos.js:61`, данных не создаёт.
4. **Актов выполненных работ нет.** Тип `act` («Акт») присутствует только как категория шаблона документа (`v490-workflow.js:236`), сущности акта, привязки к этапу и подписания - не найдено.
5. **P&L проекта из воронки не собирается.** `finance_project_pnl` есть в списке маршрутов (`core.js:1144`), но связи с `CASE_CONTRACTS` / `CASE_TASKS` в перечисленных файлах не найдено.

**Документы**

6. **Генерация документа есть только для КП и только в одном жёстко зашитом формате.** `documentHTML` `v492-portfolio-proposals.js:70` - HTML, вшитый в код. Загруженные пользователем шаблоны в генерации не участвуют.
7. **Шаблоны документов - просто файловое хранилище.** `renderTemplates` `v490-workflow.js:235`, форма `case49TemplateEdit` `v490-workflow.js:236`: Название, Тип (Коммерческое предложение / Договор / Дополнительное соглашение / Акт / NDA / Другое), Язык (RU / UZ / EN), Услуга, Версия, Описание, файл DOCX/PDF/XLSX. Прямо в тексте раздела написано: «Поля документа будут структурированы после анализа каждого файла». **Подстановки переменных, merge-полей, генерации из шаблона - не найдено.** Поля `templateId` у КП (`c49_prop_template`) и договора (`c49_ctr_template`) сохраняются, но нигде не читаются для формирования файла.
8. **Генерации документа договора нет вообще.** Ни печати, ни выгрузки - в `renderContracts` и `case49ContractEdit` кнопок формирования файла не найдено.
9. **Файл к договору не прикрепляется.** `uploadProjectFile` `v490-workflow.js:216` вызывается только для версий планировок и шаблонов документов; в форме договора поля загрузки скана нет.
10. **Электронной подписи, отправки на подпись, отслеживания статуса подписания у контрагента нет.** «Подписание» - это только выбор статуса в select и дата в поле.
11. **Приложений и допсоглашений к договору как сущности нет.** Тип `addendum` есть только в списке типов шаблонов. Версионируется договор одним текстовым полем «Версия», история версий не хранится.

**Процесс и контроль**

12. **Напоминаний и уведомлений нет.** Поле «Дата следующего шага» (`nextActionDate`) используется только для подкраски в интерфейсе (`deadlineClass` `v490-workflow.js:52`: просрочено / ≤3 дней). Ни писем, ни push, ни очереди задач по этой дате не найдено.
13. **Интеграции с почтой и телефонией нет.** Email клиента - просто текстовое поле; отправки КП клиенту из системы, логирования звонков, переписки по сделке не найдено.
14. **Истории активности и комментариев по возможности нет.** У задач есть `assignmentHistory` (`v490-workflow.js:194`), у портфельного проекта - `editHistory` (`v493-portfolio-suite.js:188`). У возможности, КП и договора - только `createdAt` / `updatedAt` / `createdBy`. Ленты событий, заметок с датами, прикреплённых файлов по сделке нет. Общий `audit()` пишет строку в журнал, но она не отображается в карточке сделки.
15. **Причина проигрыша фиксируется, но не анализируется.** Поле `lostReason` (`v490-workflow.js:116,118`) появляется в форме только при `stage === 'lost'`, нигде не выводится в отчётах и не имеет справочника причин.
16. **Отчётности и аналитики по воронке нет.** Есть 4 KPI-плитки на экране воронки, но нет: конверсии между стадиями, среднего цикла сделки, времени в стадии, воронки по менеджерам, план/факт, прогноза по месяцам, отчёта win/loss.
17. **Отклонить Scope Change нельзя.** Статус `rejected` отрисовывается (`v490-workflow.js:177`), но кнопки, которая его выставляет, нет - только «Согласовать» (`case49ScopeChangeApprove` `v490-workflow.js:181`).
18. **Договоры в разделе согласований не обрабатываются.** Подзаголовок «Мои согласования» обещает «Scope Changes, КП, договоры и deliverables» (`v490-workflow.js:230`), но `renderApprovals` собирает только три источника: `CASE_SCOPE_CHANGES` со статусом `pending`, `CASE_PROPOSALS` со статусом `internal_review` и `CASE_DELIVERABLES` со статусом `qa`. Договоров в списке нет.
19. **Лимит итераций не контролируется.** `iterations` у строки Scope и `iteration` / `iterationLimit` у deliverable вводятся и показываются, но проверки превышения, автоматического Change Request при переборе итераций - не найдено.
20. **Удаления записей почти нигде нет.** Нельзя удалить клиента, возможность, КП, договор, задачу или deliverable - только пометить статусом (`Архив`, `lost`, `terminated`, `cancelled`, `excluded`). Единственное настоящее удаление - проект портфеля в `case493ProjectDelete` `v493-portfolio-suite.js:178` (только админ, с вводом названия).
21. **Проверок дублей нет.** Клиент создаётся без проверки совпадения имени/ИНН/email; возможность - без проверки, что по этому клиенту и объекту уже есть открытая сделка.
22. **Обязательных полей минимум.** Валидируются только: название клиента, клиент + название проекта у возможности, название работы Scope, название задачи, название deliverable, проект + хотя бы одна услуга в конструкторе КП. Сумма, срок, ответственный, дата - нигде не обязательны.
23. **Стадии воронки не настраиваются на практике.** `bootstrap()` `v490-workflow.js:69-71` копирует стадии и статусы задач в `CASE_WORKFLOW_SETTINGS`, но весь рендер читает жёсткие константы. Экрана редактирования стадий в этих файлах не найдено (маршрут `admin_workflows` в списке `core.js:1144` есть, реализации в перечисленных файлах нет).
24. **Стадии `contact`, `discovery`, `negotiation`, `signing`, `paused` полностью декоративны** - ни одна автоматика их не выставляет и не читает; автоматические переходы затрагивают только `proposal`, `proposal_sent`, `accepted`, `contract`, `won`.
25. **Карта проектов не соединена с воронкой.** С карточки портфельного проекта нельзя создать возможность или КП; наоборот, выигранный договор не добавляет проект в `CASE_PORTFOLIO_PROJECTS`.
26. **Прав на уровне записи нет.** `canEdit` / `canApprove` / `isAdmin` (`v490-workflow.js:32-34`) - глобальные флаги роли. Ограничения «вижу только свои сделки» в разделе воронки нет (только фильтр «мои задачи» в `work_kanban`, `v490-workflow.js:247`).
27. **Разделы-заглушки внутри блока Advisory:** «Исследование рынка» (`advisory_research`), «Концепция» (`advisory_concept`), «Программа площадей» (`advisory_area`), «Бизнес-план» (`advisory_business_plan`) - тексты в `v490-caseos.js:11-14`, рендерятся как страница «ЗАПЛАНИРОВАНО» без данных (`v490-caseos.js:61-65`). То есть содержательные Advisory-продукты в OS пока не ведутся, ведутся только их задачи и файлы результатов.
28. **Отдельного экрана «Выполнение» нет** - маршрут `advisory_delivery` дублирует `project_workspace` (`v490-workflow.js:246`).
29. **Расхождение статусов КП между конструктором и реестром** (см. п. 2.3): статусы `revising` и `declined` из `v492-portfolio-proposals.js:57` отсутствуют в `PROPOSAL_STATUSES` `v490-workflow.js:16`, из-за чего в реестре КП они отображаются как коды на латинице.

---

## Сводная таблица маршрутов

| Маршрут | Подпись в меню | Файл и строка рендера | Виды |
|---|---|---|---|
| `crm_clients` | Клиенты | `v490-workflow.js:84` | таблица |
| `advisory_pipeline` | Воронка Advisory | `v490-workflow.js:99` | Kanban / Таблица |
| `advisory_proposal_builder` | Конструктор КП | `v492-portfolio-proposals.js:52` | форма из 4 блоков |
| `advisory_proposals` | Реестр КП | `v490-workflow.js:122` | таблица |
| `advisory_portfolio_map` | Карта проектов Advisory | `v493-portfolio-suite.js:125` | карта + список + таблица |
| `advisory_contracts` | Договоры Advisory | `v490-workflow.js:137` | таблица |
| `advisory_scope` | Объём работ (Scope) | `v490-workflow.js:176` | таблица + лента изменений |
| `advisory_delivery` | Выполнение проектов | `v490-workflow.js:169` (= `project_workspace`) | плитки + список |
| `advisory_reports` | Отчёты проектов | `v490-workflow.js:211` | таблица |
| `advisory_cross_sell` | Следующие услуги | `v490-workflow.js:233` | сетка карточек |
| `work_approvals` | Мои согласования | `v490-workflow.js:230` | список карточек |
| `document_templates` | Шаблоны КП и договоров | `v490-workflow.js:235` | таблица |
