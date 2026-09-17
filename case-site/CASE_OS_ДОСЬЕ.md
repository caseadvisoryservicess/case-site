# CASE OS - сводное досье проекта

Дата снятия: 16 сентября 2026.
Репозиторий: `caseadvisoryservicess/case-site` (GitHub). Рабочие ветки `claude/case-os-data-migration-p4df5y`
и `claude/new-session-2kq1ff` (одинаковое содержимое). Последний выпуск: v4.73.1 «студия геоаналитики без проектов CASE» (после v4.73.0 «свой
гео-агент без внешних ИИ, полигоны и зона, студия в цветах CASE»).

Зачем этот документ: в одном файле собрано всё, что нужно, чтобы любой разработчик или ИИ-ассистент
понял платформу, данные, исследования и правила и продолжил работу без доступа к прошлым переписки.
Разделы 1-12 составлены по файлам репозитория на v4.73.1. Раздел 13 - выжимка четырёх
последних выпусков (v4.70.3 ... v4.73.1), включая решения владельца и найденные ловушки.
Раздел 14 - как пользоваться документом и с чего начать.

Правила этого документа: только факты из файлов репозитория; если чего-то в репозитории нет,
так и написано «не найдено в репозитории». Секреты (пароли, ключи, содержимое `os/api/config.php`)
не приводятся; структура конфига взята из `os/api/config.sample.php`.

---

## 1. Что такое CASE OS и для кого

### 1.1. Компания

CASE Real Estate Advisory - консалтинговая компания по коммерческой недвижимости, Ташкент.
По корневому `index.html` (маркетинговый сайт): слоган «Buildings that work as products», четыре
направления - Shopping Centers & Mixed-Use (tenant mix, зонирование, планировки), Hotels & Resorts
(room mix, операционные потоки, требования операторов и брендов), Business Centers (эффективность
этажа, делимость, вертикальный транспорт, парковка, инженерия), Leasing & Brokerage (портфель
арендаторов). Позиционирование: «Мы не архитекторы. Мы коммерческий интеллект, который заставляет
архитектуру работать». Публичные контакты на сайте: `a.rakhimov@caseadvisory.uz`, `+998 97 770 73 75`,
`caseadvisory.com`, Telegram `t.me/case_advisory`, LinkedIn, Instagram, YouTube.

### 1.2. Продукт

CASE OS - внутренняя операционная система агентства: аренда (LCR - Lease Control Registry),
продажи (SCR), консалтинг (Advisory: воронка, КП, договоры, scope, выполнение), геоаналитика,
база брендов, комиссии, KPI, обучение сотрудников, администрирование доступа. Живёт по адресу
`https://caseadvisory.uz/os/`. Одна страница (SPA) на чистом JavaScript без фреймворков и сборки,
сервер - PHP + MySQL на обычном виртуальном хостинге.

Два режима работы:
- **backend** - есть `os/api/config.php` и база MySQL; вход по email и коду из письма (или паролю);
  все данные общие для сотрудников и хранятся в базе;
- **demo** - открыть `os/index.html?demo=1` (или без сервера): выбор роли из списка, данные в
  `localStorage` браузера. В демо работают все экраны, кроме серверных студий с гейтом прав.

### 1.3. Роли

Роли живут в трёх местах одновременно и должны совпадать: таблица `roles` в базе
(`os/sql/seed_roles.sql` + миграции), объект `ROLES` в `os/core.js`, шаблоны рабочих областей
`DEFAULTS` в `os/v3520-workspaces.js` (и их серверная копия `asaas_workspace_default_views()` в
`os/api/lib.php`). Флаги прав: `leasing`, `finance`, `edit`, `approve`, `plans`, `own_only`,
`project_scope`, `admin` (в клиенте ещё `geoEdit`, `external`, `ownOnly`, `projectScoped`).

| Ключ | Роль (по seed/миграциям) | leasing | finance | edit | approve | plans | own_only | project_scope | admin |
|---|---|---|---|---|---|---|---|---|---|
| ASH | Генеральный директор | да | да | да | да | да | | | да |
| ADM | Администратор | да | да | да | да | да | | | да |
| CFO | Финансовый директор | да | да | по миграции 2026_07_12 полный | да | | | | по миграции полный |
| DIR | Директор (без администрирования), v4.64.0 | да | да | да | да | да | | | нет |
| BA | Директор по аренде | да | да | да | | | | | |
| HO | Администратор аренды (тыл) | да | да (миграция 2026_07_23) | да | | | | | |
| AG | Агент аренды | да | | да | | | | | |
| AGX | Внешний агент | | | | | | да | да | |
| BSH | Архитектор | да | | да | | да | | | |
| HM | Менеджер по консалтингу | да | да | | | | | | |
| BRJ | Младший администратор данных (бренды) | да | | да | | | | | |

Итого 11 ролей. Роли - только шаблоны: администратор настраивает, какие разделы видит роль
(`ROLE_WORKSPACES`) и конкретный человек (`USER_WORKSPACES`), плюс глобальные флаги модулей
(`MODULE_FLAGS`: active / beta / hidden). Три роли закрыты fail-closed на сервере независимо от
матрицы: AGX (только `dash`, `work_tasks`, `work_kanban`, `brands`, `v32_investors`), BSH и BRJ
(LCR только чтение: `unit_patch.php` и `units_batch.php` отдают 403).

### 1.4. Экраны

Каталог модулей - массив `MODULES` в `os/v3520-workspaces.js`: 89 модулей в 10 группах
(`mywork` Работа и проекты, `projects` Клиенты и проекты, `advisory` Консалтинг, `leasing` Аренда и
продажи, `property` Управление объектами, `finance` Финансы CASE, `data` Данные и аналитика,
`products` Цифровые продукты, `team` Команда, `admin` Администрирование). По замеру
`docs/PLATFORM_FACTS_FOR_DECK.md` (v4.63.0): 49 рабочих, 40 помечены `future:true` и скрыты из меню
как дорожная карта; в v4.71.0 флаг `future` снят с `data_quality`. Роутинга по URL нет: экран
переключается функцией `go(view)`.

Ключевые рабочие экраны: Главный экран (`dash`), Клиенты, Все проекты, Центр действий,
Критические даты, задачи/Kanban/загрузка/согласования; Advisory: воронка, Конструктор КП, Реестр КП,
Карта проектов Advisory, Договоры, Scope, Выполнение, Отчёты, Следующие услуги, Финансовая модель
(iframe `feasibility-studio.html`), MEP / техзадание, Расчёт лифтов; Аренда: Карта объектов, Версии
планировок (`plan_master`), Контроль аренды LCR (`registry`), Контроль продажи SCR, База брендов,
Инвесторы и запросы, Партнёры, Комиссии аренды; Поставщики; Данные: Гео: наши проекты (`map`),
Гео: рынок и POI (`geoanalytics`, iframe студии), Бенчмаркинг, Качество и источники данных;
Команда: KPI, Оргструктура, Обучение (мини-тест на 1000 вопросов), Рейтинг; Администрирование:
Доступ, Модули (флаги), Система (журнал, бэкапы, корзина), Шаблоны КП и договоров.
Скриншоты всех 89 экранов лежат в `sweep/` (результат `docs/qa/tools/all_views_sweep.js`).

### 1.5. Что CASE продаёт через платформу

- Гео-студия - экран, «который показывают клиенту и по которому продают подписку»
  (CHANGELOG v4.59.0): отчёт по точке, конкуренты, население, скоринг, модель Хаффа, солнце/ветер,
  выгрузка PDF · Excel · PPTX одной кнопкой.
- Происхождение чисел (v4.71.0): у ставок, площадей, населения видно источник, кто проверил и когда.
  По разбору конкурентов (Aino, Placer, Geointellect, портал ДШК) это единственное, чего нет
  ни у кого - защищаемая позиция CASE.
- Коммерческие предложения: транслитератор узбекского (v4.66.0), расчёт стоимости (v4.67.0),
  справочники вида/типа проекта (v4.68.0), титульная картинка (v4.69.0). План полного Offer Builder -
  `docs/audit/00_PLAN.md`.
- Отчёт собственнику объекта (`v4450-owner-report.js`).
- Гео-агент (v4.73.0): клиент ставит точку и спрашивает словами - радиус, население, здания, дороги,
  полигон, зона. Свой, бесплатный, без внешних сервисов ИИ; каждое число с происхождением.

Чего в продукте нет (по `docs/PLATFORM_FACTS_FOR_DECK.md`): мультиарендности (нет `org_id`/`tenant_id`),
публичной витрины листингов, отдельной роли владельца объекта, пешеходных изохрон, отдельной
сущности договора аренды с графиком начислений, биллинга и подписок (модуль `future`).

---

## 2. Карта репозитория

### 2.1. Корень

| Путь | Назначение |
|---|---|
| `index.html` | Маркетинговый сайт CASE Real Estate Advisory (английский, секции hero, Our Work, Services, How, Approach, Why CASE, Contact). На хостинге `.uz` не показывается: корень домена уводится на `.com`. |
| `os/` | Платформа CASE OS целиком (фронтенд, API, SQL, данные). Единственное, что заливается на хостинг при обновлении. |
| `docs/` | Тесты, результаты QA, исследования рынка, аудиты, автономная гео-версия, архив релизов, ops-инструкции. |
| `hosting/` | `.htaccess` корня домена `.uz`, скрипты проверки переадресации, разбор устройства домена. |
| `admin/` | Два файла `config.yml.txt` и `index.html.txt` - побайтово одинаковы между собой и с `netlify.toml.txt` в корне (копия HTML). Назначение в репозитории не описано; на хостинге папка `admin` - «панель лендингов» (по `hosting/caseadvisory.uz/.htaccess`). |
| `sweep/` | 89 PNG-скриншотов всех экранов (выход `all_views_sweep.js`). |
| `netlify.toml.txt` | Не конфиг Netlify, а копия HTML (см. выше). Исторический артефакт. |
| `districts_map.png` | Картинка карты районов, 212 КБ. |
| `HANDOFF_CASE_OS.md` | Подробный handoff предыдущих сессий (463 строки): архитектура, деплой, правила, история v4.31-v4.51, грабли тестов. Верх файла датирован v4.49.2, тело доходит до v4.51.0. |
| `РУКОВОДСТВО.md` | Простое руководство владельцу: установка на cPanel, бэкап, обновления, золотые правила. |
| `ХОСТИНГ_ПОШАГОВО.md` | Установка на DirectAdmin (актуальный хостинг): 10 шагов, таблица «если что-то пошло не так». |
| `ЛОКАЛЬНО.md`, `НАЧАТЬ_ЗАНОВО.md` | Локальный XAMPP: установка и чистая переустановка через `install_all.sql`. |
| `UPDATING.md` | Принцип «код и данные разделены», сценарии обновления без миграций и с миграциями. |
| `BACKEND_PLAN.md` | Исходный план бэкенда (Supabase/PostgreSQL/RLS). В шапке оговорено, что решение изменено на PHP + MySQL на своём хостинге; концепция ролей и таблиц сохранена. |
| `DEPLOY.md` | Устаревшая точка входа (ссылается на v4.32.7). Актуальная инструкция - `os/DEPLOY.md`. |
| `CASE_OS_v4.51.0_DEPLOY_RU.md` | Инструкция установки v4.51.0 (архивная). |
| `CHANGELOG_CASE_OS_v4.51.0.md` ... `CHANGELOG_CASE_OS_v4.73.1.md` | Журналы изменений по релизам (v4.68.0 описан внутри файла v4.69.0; v4.53.1 и v4.57.1 внутри v4.53 и v4.57.0). |
| `CLAUDE.md`, `.claude/` | Настройки и навыки ИИ-ассистента для сессий разработки (skills: frontend-design, theme-factory, webapp-testing). В боевой архив не попадают. |
| `.github/workflows/deploy-os.yml` | GitHub Action FTP-деплоя папки `os/` (ручной запуск или push в `main` по `os/**`). Требует секреты FTP_*; по HANDOFF автодеплой владельцем не используется. |
| `.gitignore` | Исключает `graphify-out/`, выхлоп тестов (`docs/qa/tools/*.png`, `indep/`, `labtest/` и т. п.), `modernization_scan.json`, `samsung_report.html`. |

### 2.2. Папка `os/`

| Путь | Назначение |
|---|---|
| `os/index.html` | 60 КБ: разметка, стили, `APP_VERSION`, `CASE_EXPECTED_MODULES`, `CASE_EXPECTED_STUDIO_MODULES`, теги подключения модулей. |
| `os/core.js` | 1 МБ ядро платформы (все основные экраны), вынесено из index.html в v4.49.0. |
| `os/v*.js` | Отложенные модули (см. раздел 3.2). |
| `os/sw.js` | Service worker (PWA, офлайн-кэш). |
| `os/.htaccess` | Сжатие, кэширование, заголовки безопасности (HSTS, CSP и др.), запрет отдачи `.sql`, `.sqlite`, `.log`, `.env`. |
| `os/geoanalytics-studio.html` | Студия геоаналитики (818 КБ, 2618 строк; Leaflet 1.9.4 встроен). Открывается в iframe с `?embedded=1`. |
| `os/feasibility-studio.html` | Финансовая модель проекта (Investment Appraisal), iframe. |
| `os/mep-studio.html`, `os/lift-studio.html` | Инженерные калькуляторы (MEP-нормы, лифты), iframe. |
| `os/quiz-data.js` | Банк 1000 вопросов мини-теста (ru/uz/en), 1.3 МБ. |
| `os/jszip.min.js`, `os/leaflet.case.js`, `os/leaflet.case.css`, `os/leaflet.markercluster.js` | Сторонние библиотеки, положены локально (CSP и нестабильный интернет). |
| `os/zarafshan-l1.pdf`, `os/zarafshan-l2.svg` | Планировки объекта Заравшан (ручная планировка в ядре). |
| `os/DEPLOY.md` | Краткая инструкция установки текущего релиза (v4.73.1). |
| `os/SHA256SUMS_v4.73.1.txt` | Манифест контрольных сумм релиза (166 строк). Ровно один файл манифеста в `os/` - это проверяет `release_invariants.js`. |
| `os/api/` | PHP-бэкенд (раздел 4). |
| `os/sql/` | `schema_mysql.sql` (чистая установка на хостинге), `install_all.sql` (локальный XAMPP: база + таблицы + роли, 45 таблиц), `seed_roles.sql` (9 ролей), `migrations/` (23 файла + шаблон), `backups/` (пустая, закрыта `.htaccess`). |
| `os/data/` | Данные для фронтенда и мастер-геобаза (раздел 6). |
| `os/assets/` | Пока только README: ожидаются `offer-cover-1.jpg` и `offer-cover-2.jpg` для титула КП (файлов нет). |

### 2.3. Папка `docs/`

| Путь | Что там |
|---|---|
| `docs/qa/tools/` | 84 файлов: инструменты проверки (Playwright, VM-тесты, PHP-тесты, shell, Python) - список в разделе 7.4. |
| `docs/qa/*.json`, `docs/qa/v4.45.*` | Результаты прогонов по релизам v4.32-v4.45. |
| `docs/qa/DIAGNOSTIKA_RU.md` | Как запускать `server_check.php` / `deep_check.php` на хостинге и `browser_check.js` в консоли. |
| `docs/qa/fixtures/uz_corpus.json` | 850 узбекских словоформ для теста транслитератора. |
| `docs/archive/` | 48 папок по версиям (v4.32.0 ... v4.62.0): старые DEPLOY, CHANGELOG, SHA256SUMS. |
| `docs/audit/` | Аудиты v4.45.0/v4.45.1 и план Offer Builder (`00_PLAN.md` + разборы `01_a4_blocks.md` ... `07_uzbek_corpus.md`). |
| `docs/market/` | `ANALOGS_GEOANALYTICS_2026.md` (86 игроков, 9 сегментов), `REVIEW_ANALOGS_DRAFT1.md`, `TZ_INVESTOR_DECK.md` (ТЗ на инвесторскую презентацию, v1.1). |
| `docs/PLATFORM_FACTS_FOR_DECK.md` | Проверенная по коду фактура платформы на v4.63.0 (63 КБ) - лучший источник цифр. |
| `docs/standalone/` | `CASE_Geo_Analytics.html` (около 4 МБ): студия целиком одним файлом, собирается сборщиком `docs/qa/tools/build_geo_standalone.js` из текущих исходников; `standalone-shim.js` (браузер вместо сервера); прежняя ручная версия `CASE_OS_Geo_Analytics.html` (1.1 МБ) оставлена для сравнения; README. |
| `docs/deliverables/samsung-bc/` | Отчёт и карты по зоне охвата Samsung BC (PNG, HTML собирается скриптом). |
| `docs/ops/АВТОБЭКАП_И_CRON_ПОШАГОВО.md` | Настройка ежедневного бэкапа по cron на DirectAdmin. |

---

## 3. Архитектура

### 3.1. Общая схема

- **Фронтенд**: `os/index.html` + `os/core.js` (подключается синхронно, без `defer`, чтобы не изменился
  порядок исполнения) + модули `os/v*.js` с `defer`. Глобальное состояние - переменные ядра
  (`S`, `U`, `OBJECTS`, `BRANDS`, `GEO_DATA`, ...), объявленные через `const`/`let`, поэтому они
  **не** становятся свойствами `window`; модули обращаются к ним голыми именами под `typeof`.
- **Студии** (гео, финмодель, MEP, лифты) - отдельные HTML в iframe внутри `#main`. Гео-студия
  стартует с классом `body.geo-auth-pending` (всё скрыто) и открывается только после ответов
  `api/auth.php` и `api/workspace_access.php?view=geoanalytics` (fail-closed гейт с v4.32.1; в демо
  студия показывает отказ - это осознанно, вопрос владельца).
- **Бэкенд**: `os/api/*.php`, ядро `lib.php`. Данные интерфейса - один JSON-документ в таблице
  `app_state` (строка `id=1`). Отдельные атомарные пути: `unit_patch.php`, `units_batch.php`
  (помещения), `geo_state.php` (геоданные), `provenance.php` (происхождение чисел),
  `user_prefs.php` (настройки таблиц), `project_files.php` (файлы).
- **PWA**: `os/sw.js`, стратегия network-first, имя кэша `case-os-v<версия без точек>`.
- **Языки**: RU/UZ/EN через `localize()` (перевод хранится по-узлово `data-ru-tN`).

### 3.2. Модули и версии (v4.73.1, `os/index.html`)

`APP_VERSION='4.73.1'`.

`CASE_EXPECTED_MODULES` (12 записей): `core` 4.71.0, `v432-data-grid` 4.49.1, `v4327-patch` 4.50.1,
`v4451-live-sync` 4.58.0, `v3520-workspaces` 4.71.0, `v4450-ux-system` 4.60.0, `v4450-owner-report` 4.47.0,
`v4660-uz-translit` 4.66.0, `v4670-offer-pricing` 4.67.0, `v4680-project-directories` 4.68.0,
`v4690-offer-cover` 4.69.0, `v4710-provenance` 4.71.0.

`window.CASE_EXPECTED_STUDIO_MODULES` (объявлена через `window`, потому что студия читает её через
`window.parent`): `v420-geo-studio` 4.73.1, `v4530-geo-export` 4.73.1, `v4600-sun-wind` 4.61.0,
`v4630-huff` 4.63.0, `v4730-geo-agent` 4.73.1 (заменил `v4720-geo-assistant` из v4.72.0).

Порядок подключения и назначение (по заголовочным комментариям файлов):

| Файл (`?v=` в v4.73.1) | Назначение |
|---|---|
| `quiz-data.js?v=4.50.2` | Банк вопросов мини-теста. |
| `core.js?v=4.71.0` | Ядро: экраны, состояние, сохранение, роли `ROLES`, реестр LCR, планировки, документы, дашборд. |
| `v32-upgrade.js?v=4.46.0` | UX/локализация/валидация + запросы арендаторов, инвесторы, продажи (SCR), партнёрский портал. |
| `v326-commission-engines.js?v=4.34.0` | Два движка комиссий: аренда и посредничество с поставщиками. |
| `v35-stable.js?v=4.70.2` | База брендов (таксономия 16 категорий / 288 подкатегорий, редактор, импорт). |
| `v3515-ux.js?v=4.32.7` | UX-слой брендов (прилипшая шапка таблицы брендов и др.). |
| `jszip.min.js` | ZIP для импорта/экспорта. |
| `v3518-brands-import.js?v=4.32.7` | Импорт брендов из файла с защитными лимитами. |
| `v3520-workspaces.js?v=4.71.0` | Каталог модулей, группы меню, рабочие области ролей/пользователей, миграции схемы (4420/4421/4450), `ADMIN_ONLY_VIEWS`. |
| `v400-feasibility.js?v=4.70.2` | Встраивание финансовой модели (iframe) под правами. |
| `v420-geoanalytics.js?v=4.73.1` | Мост между ядром и гео-студией: iframe, контекст (без проектов CASE с v4.73.1), сохранение GEO_DATA через `geo_state.php`, черновик при отказе, защита от обвала базы. |
| `v440-engineering.js?v=4.70.2` | MEP и лифты в iframe. |
| `v450-guides.js?v=4.32.7` | Кнопка «?» с иллюстрированной инструкцией раздела. |
| `v490-caseos.js?v=4.39.0` | Архитектура компании, портфель, планируемые линии бизнеса. |
| `v490-workflow.js?v=4.70.2` | CRM, Advisory delivery, Scope, задачи, загрузка, версии планировок. |
| `v492-portfolio-proposals.js?v=4.65.0` | Карты портфеля CASE (массив `SEED`, 96 проектов) и конструктор КП Advisory. |
| `data/case_portfolio.seed.js?v=4.65.0` | Дозаливка проектов портфеля в работающие установки. |
| `v493-portfolio-suite.js?v=4.43.1` | Интеграция портфеля в Advisory/Leasing/Geo; `migrate()` не трогает ручные координаты. |
| `v496-commissions.js?v=4.32.7` | Панель ступенчатых комиссий на экране KPI (`commission_tiered.php`). |
| `v410-feature-flags.js?v=4.32.7` | Жизненный цикл модулей: active / beta / hidden. |
| `v417-master-plan.js?v=4.42.0` | Мастер-модуль «Планировки и LCR»: версии, неизменяемые снапшоты (P0-1), генерация LCR, handover. |
| `v432-data-grid.js?v=4.49.1` | Единый табличный движок CASE Data Grid: вид, ширины, пины, фильтры, sticky-шапка, per-user настройки. |
| `v4327-patch.js?v=4.50.1` | Очередь `unit_patch`/`units_batch`, adaptiveActions, выбор брокера, защита внешнего агента. |
| `v4450-ux-system.js?v=4.60.0` | Единый UX/доступность/ролевая безопасность (гард `go()`, «Только просмотр», адаптив). |
| `v4450-owner-report.js?v=4.47.0` | Отчёт собственнику (профили owner/internal, вкладки). |
| `v4451-live-sync.js?v=4.58.0` | Живая синхронизация без перерисовок: capture/restore прокруток и фокуса, точечные обновления. |
| `v4660-uz-translit.js?v=4.66.0` | Узбекская латиница <-> кириллица (обратимо, для КП). |
| `v4670-offer-pricing.js?v=4.67.0` | Расчёт стоимости КП: ставка, сложность, скидка, отклонения. |
| `v4680-project-directories.js?v=4.68.0` | Справочники проекта: вид, тип работ, сегмент. |
| `v4690-offer-cover.js?v=4.69.0` | Титульная картинка КП (детерминированный выбор по номеру). |
| `v4710-provenance.js?v=4.71.0` | Происхождение чисел: ключ `PROV`, плашки ✓/≈/ƒ/?, устаревание 90/180 дней. |

Модули студии подключаются внутри `geoanalytics-studio.html`: `leaflet.markercluster.js`,
`v420-geo-studio.js` (слои POI, отчёт по точке, редактирование геобазы, кластеры),
`v4530-geo-export.js` (PDF/XLSX/PPTX, ZIP собирается вручную), `v4600-sun-wind.js` (солнце, роза
ветров, кибла), `v4630-huff.js` (модель Хаффа), `v4730-geo-agent.js` (свой гео-агент: команды словами, зона, полигоны).

Контроль полноты заливки: каждый версионируемый модуль в конце файла пишет
`CASE_MODULE_VERSIONS['имя']=VERSION` (единственная переменная версии в файле), `index.html` через
2.5 с после загрузки сверяет с `CASE_EXPECTED_MODULES` и при расхождении показывает тост
«Перезалейте /os целиком» и `console.warn`. Студия делает то же со своей картой. Успех виден в
консоли: `CASE OS: все модули версии X` и `CASE OS: модули гео-студии актуальны`.

### 3.3. Состояние `app_state` и его сохранение

- Клиент собирает `stateBlob()` из десятков верхнеуровневых ключей и шлёт `POST api/state.php
  {data, revision}`. Список общих ключей - `all_shared_state_keys()` в `state.php`: `TAXO`, `OBJECTS`,
  `U` (помещения), `BRANDS`, `USERS`, `CHANGES`, `BENCH`, `REFUSALS`, `PLANUP`, `PLANSVG`, `PLAN_*`,
  `DOCREG`, `DOC_CONTACTS`, `AGENTS`, `ROLES`, `KPSEQ`, `ACTLOG`, `AUDIT`, `MAPCFG`, `PROJECT_PPT`,
  `QUIZLOG`, `QUIZSTATS`, `KB`, `KBPROG`, `HRPROF`, `CHAT`, `KPI_TARGETS`, `ROLE_WORKSPACES`,
  `USER_WORKSPACES`, `MODULE_FLAGS`, `GEO_DATA`, `TRASH`, `COMMCFG`, `COMMLOST`, ключи v32/v326
  (запросы, инвесторы, продажи, партнёры, комиссии, поставщики), ключи `CASE_*` (клиенты,
  возможности, КП, договоры, scope, задачи, deliverables, версии планировок, решения, шаблоны,
  настройки workflow, портфель, каталог КП), `OWNER_REPORTS`, `PROV`.
- Сервер сохраняет **по-ключево**: `role_allowed_state_keys()` вычисляет разрешённые ключи из
  доступных роли разделов (карта `workspace_view_keys()`: раздел -> ключи), закрытые ключи
  восстанавливает из старой копии и возвращает в `rejected_keys`; клиент показывает
  «⚠ НЕ сохранено: …». `baseline_state_keys()` = `CHAT`, `TRASH`, `V32_NOTES`, `TAXO` (читают все;
  `TAXO`, `USERS`, `ROLES` пишет только админ).
- GET вырезает недоступные роли ключи (`role_visible_state_keys`) и отдаёт `restricted_keys`, чтобы
  клиент не слал пустоту обратно (v4.50.5). Финансовые поля помещений вырезаются у ролей без
  `finance` и восстанавливаются из серверной копии при сохранении (v4.70.1); то же для финансовых
  записей `PROV` (v4.71.0).
- `revision`: при расхождении 409, клиент делает авто-слияние и повторяет (v4.35.0, P1-6). Клиент
  шлёт только изменённые ключи (дельта), сервер сливает `array_replace`.
- Помещения не ходят через общее сохранение: `v4327-patch.js` перехватывает правки и шлёт
  `unit_patch.php` / `units_batch.php` (очередь, ретраи, 401 - держать очередь, 403 - откат значения
  и тревожный тост).
- Геоданные: `geo_state.php` (транзакционно, ревизия, 50 снимков истории, восстановление админом);
  общий `state.php` не даёт устаревшему клиенту затереть `GEO_DATA`.
- Локальный кэш: `localStorage` (в backend-режиме без тяжёлых данных - P1-4); сессия 12 ч + keepalive
  каждые 5 мин; при истечении показывается счётчик несохранённых правок.

### 3.4. Service worker и кэш-бастеры

- `os/sw.js`: `CACHE='case-os-v4731'` для v4.73.1 (число = версия без точек; проверяется
  инвариантом), массив `ASSETS` из 54 файлов (все модули, студии, данные, Leaflet). Установка кладёт
  файлы по одному и пишет `console.warn` со списком того, что не легло. `fetch`: сеть с
  `cache:'no-store'`, при ошибке - кэш, потом кэш без строки запроса (`ignoreSearch`, потому что
  скрипты подключены с `?v=`), для навигации - `index.html`, для прочего - 504. Запросы к `/api/`
  не перехватываются.
- `?v=` у каждого скрипта поднимается **только при реальном изменении файла**; `core.js?v=` и запись
  `core` в `CASE_EXPECTED_MODULES` - только при правке ядра (иначе браузер снова качает 1 МБ каждый
  релиз). `APP_VERSION` намеренно живёт в `index.html`, а не в ядре.
- `os/.htaccess`: `index.html` без кэша, JS 1 час, SVG/PDF 1 день, deflate.

### 3.5. Как добавляется новый модуль (чек-лист)

1. Файл `os/vNNNN-name.js` в стиле остальных: IIFE, `'use strict'`, защита от двойной загрузки,
   одна переменная `VERSION`, в конце регистрация `window.CASE_MODULE_VERSIONS['vNNNN-name']=VERSION`
   (для модулей студии - через `window.parent`). Заголовочный комментарий: зачем, запрос владельца,
   принятые решения.
2. `os/index.html`: тег `<script src="vNNNN-name.js?v=X.Y.Z" defer>` в нужном месте порядка, запись
   в `CASE_EXPECTED_MODULES` (для студии - в `geoanalytics-studio.html` тег и запись в
   `window.CASE_EXPECTED_STUDIO_MODULES`), поднять `APP_VERSION`.
3. `os/sw.js`: добавить файл в `ASSETS`, поднять `CACHE` и комментарий версии в первой строке.
4. `os/DEPLOY.md`: переписать под новую версию (заголовок с версией, признак успешной установки
   «в шапке vX.Y.Z», список изменённых/новых файлов, есть ли миграции).
5. `CHANGELOG_CASE_OS_vX.Y.Z.md` в корне: что и почему, как проверено, чего намеренно нет.
6. Пересобрать `os/SHA256SUMS_vX.Y.Z.txt`, старый манифест перенести в `docs/archive/vСТАРАЯ/`.
7. Тест в `docs/qa/tools/` с контролем осмысленности (проверка обязана падать на старом коде).
8. Прогнать `node docs/qa/tools/release_invariants.js os` и регрессионные наборы.
9. Собрать `CASE_OS_vX.Y.Z_os_only.zip` (только `os/`, без секретов), закоммитить в рабочую ветку.

### 3.6. Табличный стек

Три слоя, границы важны: `v432-data-grid.js` - единственный владелец презентации таблиц (sticky
thead целиком, `col{visibility:collapse}` для скрытия столбцов, угловой блок `div.case-pin-corner`,
полоса групп `div.case-grp-band`, публичные `window.case432EnhanceNow`, `window.CASE_SYNC_STICKY`),
`v4327-patch.js` - очередь синхронизации помещений (`window.caseFlushUnitsNow`,
`window.caseUnsyncedCount`), `v4451-live-sync.js` - сохранение позиции/фокуса при перерисовках.
Таблица попадает в движок только если у неё есть `<thead>` и обёртка `.tbl-scroll` (v4.70.0/v4.70.2).
Карта конфликтов CSS: `docs/qa/tools/css_conflicts.js` (193 подтверждённых конфликта с `!important`,
новых с v4.70.2 ноль).

---

## 4. Серверная часть

### 4.1. Стек и конфигурация

PHP (хостинг: PHP 8.0 с 16.09.2026; код совместим с 7.2-8.4, см. раздел 8) + MySQL/MariaDB (`utf8mb4`), PDO. Драйвер
`sqlite` поддерживается для локальных тестов. `os/api/config.php` создаётся вручную из
`config.sample.php` и в git не попадает (`os/api/.gitignore`: `config.php`, `notify_recipients.php`,
`*.sqlite`). Структура `config.sample.php` (без значений):

- `driver`, `host`, `name`, `user`, `pass`, `charset`, `sqlite_path`;
- `backup_token` - для ежедневного бэкапа по cron;
- `mail_from`, блок `smtp` (`host`, `port`, `secure`, `user`, `pass`) - письма с кодом входа;
- `code_login` (по умолчанию включён; `false` только для локального XAMPP), `allow_password_login`;
- гео-ключи: `openrouteservice_key`, `yandex_isochrone_key`, `dgis_key`, `google_maps_key`,
  `yandex_search_key`;
- `telegram_bot_token` - дайджест контрольных дат;
- `llm_endpoint`, `llm_model`, `llm_key` (v4.73.0, необязательно) - своя OpenAI-совместимая модель
  (Ollama, vLLM, LM Studio) для перевода свободных фраз гео-агента в команды. Ключа внешней модели
  (`anthropic_api_key` из v4.72.0) больше нет; если он остался в `config.php`, он не читается.

Готовые образцы: `config.local-xampp.php` (переименовать в `config.php` для XAMPP),
`config.production.example.php`, `notify_recipients.sample.php`.

### 4.2. `lib.php` - ядро бэкенда

Функции (по `grep function`): `cfg()`, `db()` (PDO), `json_out()`, `fail()` (ошибка в поле `error`),
`body()` (JSON-тело с лимитом `json_body_limit_bytes()` = 40 МБ и проверкой CSRF), `uuid()`,
`same_host()`, `require_same_origin_for_write()`, `csrf_token()` / `require_valid_csrf()` (токен в
заголовке `X-CSRF-Token` или поле `_csrf`, сравнение `hash_equals`), `current_user()`,
`require_login()`, `can($flag)`, `owner_identity()`, `asaas_workspace_default_views()`,
`asaas_known_module_ids()`, `asaas_protected_module_ids()` (`dash`, `users` всегда активны),
`asaas_workspace_hard_allowed()` (fail-closed AGX/BSH/BRJ), `asaas_future_module_ids()`,
`asaas_module_status()`, `asaas_feature_can_view()`, `asaas_workspace_effective_views()`,
`asaas_workspace_can_view()`, `asaas_geo_can_edit()`, `asaas_load_app_state_data()`,
`asaas_workspace_visible_config()`, `audit()` (пишет `audit_log`), `table_workspace_views()`,
`require_table_allowed()`, `tables()` (белый список таблиц и столбцов), `list_table()`,
`upsert_row()`, `delete_row()` (с ACL: маскировка финансов, `own_only`, проектная область,
`redact_unless_admin` для `app_users`), `table_row_limit()` = 20000, `unit_finance_fields()`,
`unit_can_see_finance()`, `redact_units_for()`, `restore_unit_finance()`,
`unit_can_change_structure()`, `prov_*` (поля, допустимые значения `verified|asking|modelled`,
источники, методы, разбор ключа с якорем `\z`, очистка записи: автор и дата ставятся сервером,
финансовые ключи скрыты для ролей без `finance`).

Сессия: `session.gc_maxlifetime` 43200 (12 ч), cookie `httponly`, `SameSite=Lax`, `Secure` по схеме
(собственный TLS, `X-Forwarded-Proto`, `X-Forwarded-SSL`, порт 443 - v4.70.3). `memory_limit`
поднимается до 512M в рантайме (геоданные тяжёлые). `.htaccess`/`.user.ini` в `api/`:
`post_max_size`/`upload_max_filesize` 48M, запрет прямого доступа к `config*.php`, `lib.php`,
`.sqlite`, `.sql`, `.sql.gz`, `.log`, `.env`, `Options -Indexes`.

### 4.3. Эндпоинты (`os/api/*.php`, v4.73.0)

| Файл | Что делает |
|---|---|
| `auth.php` | Вход/выход/текущий пользователь. Действия: `login` (пароль), `request_code` / `verify_code` (одноразовый код на email, хранится хешем в `login_codes`, действует 10 мин, не чаще раза в минуту, SMTP), `logout`, `verify_ceo` (подтверждение паролем CEO для опасных операций админа). GET отдаёт `{auth, csrf, pass_login, code_login}`; клиент включает BACKEND только если `typeof j.auth==='boolean'` (v4.50.3). |
| `setup.php` | Разовое создание первого администратора (роль ASH). Отказывается работать, когда пользователи уже есть; после установки файл **удалить**. |
| `users.php` | Только admin: создание пользователя, смена пароля; проверка связей перед удалением (P0-3). |
| `state.php` | GET/POST общего состояния (раздел 3.3). |
| `data.php` | Универсальный CRUD по белому списку таблиц с правами; внешним агентам (AGX) перечисление закрыто. |
| `unit_patch.php` | Атомарная правка одного помещения LCR; AGX/BSH/BRJ - 403; финансовые поля без `finance` отклоняются (`blocked_fields`). |
| `units_batch.php` | Атомарные структурные операции (создать/объединить/разделить/удалить помещения); требуют `finance` или `plans`. |
| `provenance.php` | Запись ровно одного ключа карты `PROV` (происхождение числа). |
| `geo_state.php` | GET/POST `GEO_DATA` транзакционно; `?history=1`; `action=restore` (admin). |
| `geo_master.php` | Защищённая выдача файлов мастер-геобазы `data/geo_master/` по праву на `geoanalytics`. |
| `gis_proxy.php` | Прокси гео-сервисов, ключи на сервере. Режимы: `isochrone` (провайдеры `openrouteservice`, `yandex`, `2gis`; `google` - честный отказ), `poi` (Overpass, 23 категории, транспорт отдельной веткой с маршрутами), `buildings`/`roads` (здания и дороги OSM, кэш 30 дней в `gis_analysis_cache`), `geocode` (адрес -> точки через Nominatim, кэш 30 дней), `ping` (проверка связи с сервера: curl, Overpass, Nominatim, своя модель, локальная Ollama; советы словами; роли с правом правки, 6 раз за 10 минут). Запросы наружу через `osm_http_get` (curl, иначе `file_get_contents`). |
| `osm_lib.php` | Чистые функции: запросы Overpass и разбор ответов, адрес и разбор ответа геокодера, диагностика связи `osm_diagnosis` (факты -> советы). Проверяются тестом без сети. |
| `llm.php`, `llm_lib.php` | (v4.73.0) Необязательный перевод свободной фразы в команды гео-агента через свою OpenAI-совместимую модель (`llm_endpoint`); только GET для авторизованных, 20 фраз за 10 минут; без настройки отвечает `needs_llm`. Ответ модели строго фильтруется (`llm_parse_calls`: только команды из меню, только списки чисел и строк, не больше 8). Модель не считает числа и не пишет ответ пользователю. Файлы `assistant.php`/`assistant_lib.php` из v4.72.0 удалены. |
| `feasibility_models.php` | Сценарии финансовой модели с ревизиями (list / get / save / restore / delete); доступ по матрице разделов. |
| `project_files.php` | Хранилище файлов планировок и шаблонов: до 25 МиБ, CSRF и same-origin, белый список расширений, отказ исполняемым, SHA-256 каждого файла, папка `data/case_files/` закрыта `.htaccess`. |
| `user_prefs.php` | Персональные настройки таблиц per-user (таблица `user_prefs` создаётся сама). |
| `workspace_access.php` | Проверка права на раздел/действие для студий в iframe. |
| `market_data.php` | Рыночные/макро-точки (`market_data_sources`, `market_data_points`; сид World Bank WDI). |
| `commissions.php`, `commission_tiered.php`, `lease_commissions.php`, `supplier_commissions.php` | Комиссии: приватный ledger, ступенчатые комиссии, движки аренды и поставщиков; агент видит только своё, admin/finance/approve - всё. |
| `brand_requests.php`, `investor_requests.php` | Входящие запросы брендов и инвесторов; AGX может только подать новый лид. |
| `sales.php`, `partners.php` | Активы/покупатели/инвесторы под продажу; партнёры и рефералы. |
| `backup.php` | Дамп всех таблиц в `.sql.gz`, папка `caseos_backups` выше `public_html` (с v4.50.3; старая `os/sql/backups` тоже просматривается), хранение 30 дней, запуск кнопкой (admin) или cron по `backup_token`; восстановление только admin, POST с CSRF, с защитным снапшотом. |
| `migrate.php` | Применяет только новые файлы `os/sql/migrations/*.sql` (admin, POST с CSRF). |
| `health.php`, `diag.php` | Проверка базы и файлов (admin). |
| `cron_critical_dates.php` | CLI-only: дневной дайджест критических дат (90/60/30/7 дней, просрочки) в Telegram и/или email; получатели в `notify_recipients.php`. |
| `geo_collector.php` | CLI-only мульти-source сборщик геобазы (OSM Overpass / Google Places New / Яндекс Geosearch / 2GIS Places), конфиг `data/geo_collect_config.json`, дедупликация, отчёты. «Инструмент НЕ выдумывает данные». |
| `geo_seed_convert.php`, `geo_master_install.php`, `geo_education_export.php` | CLI-only: перевод имеющихся данных в master-формат; безопасная установка мастер-базы; экспорт слоя образования в `data/tashkent_education.json`. |

Из 37 PHP-файлов v4.63.0 27 начинаются с `require_login()`, остальные - образцы конфигов и CLI-скрипты
с проверкой `PHP_SAPI !== 'cli'` -> 403 (`docs/PLATFORM_FACTS_FOR_DECK.md`).

### 4.4. Авторизация, роли, workspace

- Вход: email + код из письма (OTP) по умолчанию; пароль - если `allow_password_login` не выключен;
  на XAMPP `code_login=false`. Пароли - `password_hash` (bcrypt). После входа `session_regenerate_id`.
- Права действия - флаги роли из таблицы `roles` (`can('finance')` и т. д.).
- Права на разделы - матрица: дефолт роли (`asaas_workspace_default_views`) -> `ROLE_WORKSPACES[role]`
  -> перекрытие `USER_WORKSPACES[user]` (mode custom) -> фильтр `hard_allowed` -> фильтр
  `MODULE_FLAGS` (hidden/beta) -> `future`-модули скрыты. `dash` и `users` нельзя скрыть (P0-2).
- Проектная область: колонка `projects` (JSON) в `app_users` для `project_scope`-ролей; строки чужих
  проектов восстанавливаются из серверной копии.
- Аудит: `audit_log` пишется сервером (`audit()`), правка/удаление не предусмотрены; отказы по
  ключам (`state_key_denied`) тоже в аудите.

### 4.5. Схема базы

`os/sql/install_all.sql` создаёт 45 таблиц (`schema_mysql.sql` + миграции дают тот же набор).
Группы:

- ядро: `roles`, `app_users`, `login_codes`, `audit_log`, `activity_log`, `app_state` (+`revision`),
  `user_prefs` (создаётся эндпоинтом), `geo_state_history`, `gis_analysis_cache`;
- нормализованные сущности из первоначального плана: `objects`, `units`, `control_dates`,
  `unit_comments`, `brands`, `registry_changes`, `benchmarks`, `refusals`, `documents`,
  `document_versions`, `contacts`, `agent_metrics`, `kp_counters`, `deals`, `deal_actions`,
  `data_quality_snapshots`, `doc_templates`, `deal_stage_probabilities`;
- комиссии: `commission_rules`, `commission_ledger`, `commission_engine_settings`,
  `lease_commission_deals`, `lease_commission_ledger`, `supplier_categories`, `suppliers`,
  `supplier_commission_deals`, `supplier_commission_ledger`, `sales_commission_ledger`;
- операционные модули v32: `brand_requests`, `investor_requests`, `sales_assets`, `sales_buyers`,
  `case_partners`, `partner_referrals`;
- рынок и финмодель: `market_data_sources`, `market_data_points`, `feasibility_models`,
  `feasibility_model_versions`.

Что реально используется: интерфейс работает с JSON-документом `app_state`; по данным
CHANGELOG v4.71.0 таблицы `objects` и `units` «в схеме есть, но ни один SQL-запрос ни в одном из
37 файлов API их не читает и не пишет». Нормализованные таблицы комиссий, запросов, продаж,
партнёров, финмодели, рыночных данных, файлов и кэша обслуживаются своими эндпоинтами.
`data.php` умеет CRUD по любой таблице из белого списка `tables()`.

Миграции `os/sql/migrations/` (аддитивные, идемпотентные; применяются `migrate.php`):
`2026_07_01_app_state`, `07_02_role_cfo`, `07_03_role_labels_ru`, `07_04_sync_user_titles_ru`,
`07_05_role_project_scope_column`, `07_06_users_projects_column`, `07_07_role_agx`,
`07_09_login_codes`, `07_11_role_brj`, `07_12_cfo_full_access`, `07_13_app_state_revision`,
`07_14_v3_operating_tables` (deals/actions/QA), `07_15_v31_commission_privacy`,
`07_16_v32_investor_requests`, `07_16_v32_operating_modules`, `07_17_v326_commission_engines`,
`07_18_asaas_v34_market_gis`, `07_19_v4_feasibility_models`, `07_20_v494_geo_state_history`,
`07_20_v496_tiered_commissions`, `07_23_ho_finance`, `07_23_v4321_agx_lockdown`,
`2026_08_13_role_dir` (последняя; обязательна для роли DIR). Плюс `EXAMPLE_template.sql.txt`.
Правило: в обычных обновлениях никаких `DROP`, `TRUNCATE`, повторного `schema_mysql.sql`.

### 4.6. Лимиты и ограничения частоты

JSON-тело 40 МБ (`json_body_limit_bytes`), PHP 48M, файл 25 МиБ, строк на выборку 20000, код входа
не чаще раза в минуту, `ping` гео-прокси 6 раз за 10 минут, `llm.php` 20 фраз за 10 минут на
сессию, бэкапы 30 дней, история гео 50 снимков, сессия 12 ч, idle-logout
120 мин на клиенте.

---

## 5. Геоаналитика

### 5.1. Студия

`os/geoanalytics-studio.html` - отдельная страница в iframe (`?embedded=1&v=…`), Leaflet 1.9.4 и
markercluster встроены. Семь вкладок: Карта (`mapT`), Аналитика (`anaT`), Сравнение стран
(`cmpT`), Профиль проекта (`siteT`), Генплан / нормы (`planT`), Управление данными (`dataT`),
Объекты на карте (`objT`); с v4.73.1 вкладки про проект (`siteT`, `planT`, `objT`) скрыты, видны
Карта, Аналитика, Сравнение стран, Управление данными. Левая панель карты: **Точка анализа**
(с v4.73.1 вместо списка проектов CASE: «📍 Точка на карте», «▣ Аналитика по точке», «⤓ Выгрузить
PDF · Excel · PPTX», «⚙ Настройки», «☀ Солнце, ветер и кибла», «◱ Доля рынка (модель Хаффа)»),
**Гео-агент** (v4.73.0, свой движок), **Анализ локации** (клик = отчёт по точке,
радиусы `500,1000,1500,2000,3000`, рисование зоны, изохрона авто 5/10/15/20 мин), **Модель зон
пригодности**, **Зона охвата** (кольца 1 · 3 · 5 км), **Слои и стиль**, **Легенда**, **Итог по
catchment**. С v4.59.0 палитра CASE (тёплая бумага, оксблад, Montserrat), закреплённый командный блок;
с v4.73.0 панель - стопка белых карточек на бумаге, агент - карточка с тёмной шапкой.

### 5.2. Слои

Группы в «Слои и стиль»: Бизнес-центры (проекты портфеля CASE убраны в v4.73.1), HoReCa, Медицина и
аптеки, Ритейл, Досуг спорт и культура, Образование, Жильё, Услуги финансы и авто, Инфраструктура,
Границы и плотность (районы города, Ташкентская область 22 территории, плотность населения, тепловая
карта). У каждого слоя: включатель + название, контролы под ⚙ (цвет, размер подписи, кластеры,
прозрачность). 23 категории POI из OSM грузятся кнопкой у слоя через `gis_proxy.php?mode=poi`:
`hotels`, `shopping`, `street_retail`, `supermarkets`, `markets`, `restaurants`, `cafes`, `fast_food`,
`parks`, `playgrounds`, `entertainment`, `sports`, `education`, `residential`, `warehouses`, `parking`,
`transport_hubs`, `culture`, `tourism`, `finance`, `government`, `fuel_auto`, `mahallas`. Каждый OSM-тег
принадлежит ровно одному слою (v4.60.0, проверяет `poi_categories.php`). Подложки - 9 штук с
переключателем: OpenStreetMap (по умолчанию с v4.73.0), CARTO светлая/тёмная (с v4.73.0 требуют ключ и
помечены «нужен ключ»), Google карта/спутник/гибрид, 2GIS, Яндекс (класс `YandexTiles`, эллипсоидальная
сетка EPSG:3395), Esri спутник; автозамена подложки, если тайлы не пришли за 6 секунд (порядок:
OpenStreetMap, Google, 2GIS, Яндекс).

### 5.3. Источники данных

| Источник | Что даёт | Где в коде/данных |
|---|---|---|
| Kontur H3 | Сетка населения, 6865 гексагонов ~0.87 км², 2023, моделируемые данные | `const KPOP` в студии, `data/bundle_tashkent_realdata.json` (`pop`), `geo_master/population_grid*.csv` (статус «методологический слой; проверить источник/единицу измерения») |
| Toshstat 01.01.2026 | Официальное население и площадь 12 районов города (и области) | `DIST` в студии; используется для калибровки |
| Границы районов | 12 районов Ташкента (13 полигонов, 12177 точек, WGS84) - локально; область (22 территории) - только из GitHub (jsdelivr/raw) | `data/tashkent_districts.geojson`; `REGGEO` локального файла нет |
| База БЦ CASE | 148 бизнес-центров (+3 своих: Botanica BC, Taxtapul BC, Samsung BC = 151); провайдеры 2GIS, Google Maps, GoldenPages, CASE (owner), Yandex; класс и ставка заполнены у 16 | `const BC` в студии, `geo_master/bc.json`, `bundle` (`bc`) |
| Медицина | 1530 учреждений: OpenStreetMap (Overpass, 07.2026) + clinics.uz | `medicine.json`, `bundle` (`med`) |
| Аптеки | 1027 точек (только координаты, без названий) | `pharmacies.json`, `bundle` (`pharm`) |
| Махалли | 545 записей, координата - офис махаллинского комитета (GoldenPages), не граница | `data/mahallas_tashkent.json`, `geo_master/mahallas.json` |
| Метро, рынок | Линии и станции; медианы аренды/продажи по OLX и uybor с датой сбора | `metroRaw`, `MARKET` в студии, `bundle` (`market`, `prices`) |
| OSM Overpass | POI 23 категорий, транспортные узлы с маршрутами, здания (этажность, тип, площадь пятна) и дороги (v4.72.0); лицензия ODbL, атрибуция обязательна | `gis_proxy.php`, `osm_lib.php` |
| OSRM | Изохрона на авто (`router.project-osrm.org/table/v1/driving`), транспортный коридор | `isochrone()` в студии |
| Изохроны платные | OpenRouteService, Яндекс Isochrone, 2GIS - по ключам в `config.php`; все автомобильные | `gis_proxy.php?mode=isochrone` |
| Open-Meteo (ERA5) | Архив ветра для розы ветров, без ключа, запрос из браузера | `v4600-sun-wind.js` |
| Nominatim | Геокодирование адреса для гео-агента (v4.73.0), страна ограничена `uz`, кэш 30 дней | `gis_proxy.php?mode=geocode` |
| WorldPop | Только как «внешняя оценка» в сравнительной таблице отчёта; растр в репозитории не найден | вкладка Аналитика |
| Сравнение стран | Таблица ставок/вакансий по столицам региона зашита константой `INTL` в студии (2021-2025, открытые обзоры) | `compare()` |

Условия 2GIS и Яндекса запрещают хранение их данных - в слои зданий/дорог они не попадают
(CHANGELOG v4.72.0). Google/Яндекс/2GIS для сбора требуют платных ключей; OSM бесплатен.

### 5.4. Методики

- **Калибровка населения** (`calibrate()`): по каждому району коэффициент = официальное население
  Toshstat / сумма Kontur в границах района; ячейки умножаются на коэффициент; артефакты Kontur
  (часть населения агломерации «свалена» в несколько гексагонов на юге) вычищаются по медиане
  района. Это чинит суммы по районам, но не распределение внутри района. В отчёте раздел
  «G. Население: калибровка источника» с таблицей коэффициентов; сильное отклонение от 1 - район
  ненадёжен. До v4.72.0 отчёт по точке считал по сырой сетке (проверка `if(!POP)`), исправлено на `CAL`.
- **Население в радиусе и в зоне**: гео-агент считает по доле площади ячейки внутри круга, а не по
  попаданию центроида; площадь ячейки оценивается по расстоянию между соседями. Число всегда идёт
  с уверенностью «ƒ расчёт» и примечанием «брать как порядок величины».
- **Скоринг форматов** (шкала 0-100): `0.55 × спрос + 0.45 × (1 - конкуренты/эталон)`; форматы БЦ,
  клиника, F&B (эталон 25 на км), учебный центр (эталон 5). Эталоны настраиваются в настройках
  выгрузки по каждому проекту. Скоринг на экране и в выгрузке считаются по разным эталонам - открытый
  вопрос (v4.58.0).
- **Модель зон пригодности**: сетка (по умолчанию 250 м, 13216 ячеек по Ташкенту), вид бизнеса
  (ТРЦ региональный, ТЦ районный, ритейл, супермаркет, ресторан, кафе, фастфуд, парк/досуг, отель,
  бизнес-центр, стрит-ритейл прокси, направление медицины), радиус спроса, эталоны, вес спроса,
  число лучших зон; конкуренты - профильные слои. Пространственный индекс по клеткам 0.01°
  (v4.62.0): 45 мс против 1053 мс перебором, результат совпадает до объекта.
- **Модель Хаффа** (`v4630-huff.js`): `P = (A^a / D^b) / Σ` по всем объектам зоны; A - GLA (иначе GBA),
  D - расстояние; выдаёт долю рынка, охват, у кого забираем, каннибализацию своих объектов. Прямо
  подписано «не прогноз выручки». Без заполненной площади расчёт не выполняется.
- **Изохроны**: только автомобильные (OSRM table API по 12-16 точкам вокруг). Пешеходных не найдено.
- **Солнце, ветер, кибла** (`v4600-sun-wind.js`): NOAA-алгоритм, сверен с Meeus (расхождение до 0.4°),
  азимут через `atan2`; кибла по большому кругу (Ташкент 240.30°, 3531 км); роза ветров 16 румбов,
  окно ±7 дней за 5 лет.
- **Отчёт по точке** (`probeAt`, панель `#probe`): население по радиусам, БЦ, медицина, аптеки,
  F&B, образование, транспорт, конкуренты двумя таблицами (БЦ: класс, год, GBA, GLA, этажи, типовой
  этаж, паркинг, ставка, свободно, планировка, отделка; торговля: открытие, участок, GBA, GLA, точки,
  F&B, парковка, ставка), свод по зоне (медиана ставки, суммарные GLA и свободная площадь), скоринг.
- **Выгрузка** (`v4530-geo-export.js`): XLSX (до 10 листов) и PPTX (до 9 слайдов) собираются в
  браузере как ZIP+XML без библиотек, PDF - через печать; снимок карты только с подложек с CORS
  (OSM, CARTO); имена файлов латиницей; числа берутся из `LASTPROBE` (тот же отчёт, что на экране);
  настройки выгрузки хранятся по проекту. Проверка настоящими openpyxl/python-pptx
  (`check_office_files.py`).
- **Легенда** показывает все включённые слои с количеством на экране, размер меняется мышью.
- **Гео-агент v4.73.0** (`v4730-geo-agent.js`): 17 инструментов в браузере (точка кликом, координатами,
  адресом; радиусы; изохрона; полигон кликами; объединение фигур; площадь зоны; население, здания,
  дороги и конкуренты в радиусе или «в зоне»; выделение; цвет слоя; очистка; проверка связи; помощь);
  детерминированный разбор фраз на ru/uz/en; своя модель - только как необязательный перевод фразы
  в команды; каждая цифра с плашкой происхождения. Подробно - раздел 13.4.

### 5.5. Ограничения и оговорки

- Kontur H3 помечен «проверить источник/единицу измерения»; две модели населения (наша и WorldPop)
  расходятся до 1.6 раза на 1.5 км - «ни одна не является истиной».
- В мастер-геобазе 0 записей верифицированы вручную из 3292; уровня A нет ни одной.
- Координаты 95 проектов портфеля - уровня города; на масштабе квартала не показывать.
- Класс и ставка есть у 16 БЦ из 148; аптеки без названий; махалли - точка офиса.
- Границы области грузятся из интернета (нет локального файла); в песочнице разработки
  внешний интернет закрыт, живой сайт из неё не открыть.
- «Сравнение стран» - константа в коде, стареет молча (v4.59.0 предлагает вынести в данные или
  убрать из клиентской версии).
- Расчёт зоны конкуренции при большом числе точек - в главном потоке (индекс есть, но карта на
  плотных районах может подтормаживать).
- Тайлы подложек только из сети; Leaflet с CDN не грузится - потому библиотека положена локально.
- В демо-режиме студия показывает отказ (гейт прав), вопрос владельца не решён.
- Автономная версия `docs/standalone/CASE_OS_Geo_Analytics.html` отстаёт от версии в ОС (обмен идёт
  из ОС в автономную, не наоборот); правки БЦ в ней хранятся по индексу массива `BC`
  (`caseos_bc_edits`), сдвиг массива молча перевешивает правки на чужие БЦ.

---

## 6. Исследования и данные

### 6.1. `os/data/`

| Файл | Размер | Содержимое |
|---|---|---|
| `bundle_tashkent_realdata.json` | 404 КБ | Рантайм-бандл студии: `pop` 6865, `med` 1530, `pharm` 1027, `districts` 22, `market` 9, `prices` 32, `medsum` 7, `bc` 148 |
| `tashkent_districts.geojson` | 268 КБ | 12 районов города с латинскими именами в написании ключей `SYN` |
| `mahallas_tashkent.json` | 594 КБ | 545 махаллей (GoldenPages, `Требует проверки`) |
| `case_brands_base.xlsx` | 615 КБ | База брендов для импорта |
| `case_portfolio_projects_v4.9.3.json` / `.csv`, `case_portfolio.geojson`, `case_portfolio.seed.js` | 91 / 43 / 109 / 3 КБ | Портфель проектов CASE (96 записей вместе с Uchtepa Park, v4.65.0); запись обязана быть в пяти файлах (пятый - массив `SEED` в `v492-portfolio-proposals.js`) |
| `mep_norms.json` | 9 КБ | Нормы инженерных нагрузок по видам деятельности (v1.0, 2026-07-18, ориентиры стадии концепции) |
| `geo_collect_config.json` | 17 КБ | Конфиг коллектора: Ташкент, bbox 41.15-41.42 / 69.1-69.48, сетка 1.5 км, 24 категории, дедупликация (60 м по имени; уверенность координаты 20/50/100 м) |
| `geo_collect_out/` | | `seed_master.csv` (659 КБ), `seed_master.geojson`, `seed_summary.json` (3206 записей: БЦ 104, махалли 545, медицина 1530, аптеки 1027; single-source => confidence C), `dry_run.json` (440 ячеек сетки; оценка запросов: OSM 24, Google/Яндекс/2GIS по 31680) |
| `geo_master/` | 23 МБ | Мастер-геобаза v4.8.1 (ниже). Закрыта `.htaccess`, отдаётся через `geo_master.php` |
| `case_files/` | | Хранилище загруженных файлов (`index.json` пуст), закрыто `.htaccess` |

### 6.2. Мастер-геобаза `os/data/geo_master/`

`summary.json`: объектов 3292 (координаты валидны у всех, нулевых 0), сопоставлено 3205 из 3232 seed,
не сопоставлено 27, **manual_verified 0**, **needs_review 3156**, возможных дубликатов 118,
БЦ 148, медицина 1530, аптеки 1027, махалли 545, F&B 42 (32 ресторана + 10 кафе Мирабада из
клиентского исследования), очередь исследования 463, проблем QA 1279. Файлы: `master.csv`
(2.5 МБ, 76 колонок: `verification_status`, `data_confidence`, `verified_by`, `last_manual_update`,
`last_field_check`, координаты от каждого провайдера для сверки и т. д.), `master.geojson` (7 МБ),
`CASE_Tashkent_Geo_Master_Integrated.sqlite` (6.3 МБ), `CASE_Tashkent_Geo_Admin.xlsx`, `bc.json`,
`medicine.json`, `pharmacies.json`, `mahallas.json`, `cafes.json`, `restaurants.json`,
`population_grid.csv` и `population_grid_extended.csv`, `research_queue.csv` (463 позиции: F&B 42,
развлечения 41, стрит-ритейл 38, гостиницы 36, образование 36 - у образования 0 координат),
`qa_issues.csv` (1279: без названия и адреса 1027, неполная карточка БЦ 148, одинаковые координаты
36, дубликаты по имени 29, координаты 0,0 26, кухня не классифицирована 12), `sources.csv` (919
источников с датой и пометкой о лицензии), `taxonomy.csv` (49 позиций TAX-001 ... с запросами
ru/uz/en), `seed_unmatched.csv` (27), `runtime.json`, `fnb_import_qa.json`, `SHA256SUMS.txt`,
`imports/` (исходные CSV ресторанов и кафе Мирабада).

Статусы данных (по `PLATFORM_FACTS`): `data_confidence` C 1557, D 1027, B 708, A 0; источников
на запись: один 3276, два 13, три 3; происхождение координат: OSM 1896, clinics.uz 652, GoldenPages
571, 2GIS 103, Google 19, Яндекс 15. Алкоголь у F&B - `unknown` у всех 42 до подтверждения меню,
звонком или выездом (политика «не выводить из названия»).

### 6.3. Происхождение чисел (PROV, v4.71.0)

Запись на каждое поле сущности: `conf` (`verified` ✓ сплошная рамка с заливкой, `asking` ≈ без
заливки, `modelled` ƒ штриховая; нет записи - `?` пунктир), источник, кто, дата наблюдения, кто
зафиксировал, способ (`call|visit|document|registry|deal`), основание, примечание. Сводное число
получает **самую слабую** уверенность из входящих и показывает состав. Старше 90 дней - жёлтая
полоса, 180 - красная, скрыть нельзя. «Подтверждено» ставится только кнопкой с указанием способа,
дату и автора ставит сервер. Финансовые записи скрыты от ролей без `finance` и не стираются при их
сохранении. Видно в карточке помещения, на дашборде и в разделе «Качество и источники данных».
SOATO не внедрён (справочник ДШК файлом не передан).

### 6.4. Документы исследований

- `docs/market/ANALOGS_GEOANALYTICS_2026.md` - 86 игроков, 9 сегментов (август 2026); оговорки:
  часть сайтов была недоступна из среды, цены почти не публикуются (единственная публичная -
  Unacast $40 000/год на Datarade), Казахстан/Кыргызстан/Таджикистан/Туркменистан не исследованы.
- `docs/market/REVIEW_ANALOGS_DRAFT1.md` - разбор черновика деки (73 игрока + Geointellect).
- `docs/market/TZ_INVESTOR_DECK.md` - ТЗ на инвесторскую презентацию v1.1 (13.08.2026).
- `docs/PLATFORM_FACTS_FOR_DECK.md` - проверенная фактура на v4.63.0: 89 модулей, 45 таблиц, 22
  миграции, 43 202 строки кода, 116 версий с v4.17.0, история репозитория с 11 марта 2026,
  раздел «Чего в документе нет».
- `docs/audit/00_PLAN.md` - план Offer Builder (51 отклонение от ТЗ; данные оффера в отдельных
  SQL-таблицах, а не в `app_state`).
- `docs/audit/v4.45.0`, `v4.45.1` - внешние аудиты билда пользователя.
- `docs/deliverables/samsung-bc` - карты зоны охвата, спроса и предложения по Samsung BC
  (скрипты `samsung_*.py` в `docs/qa/tools`).

### 6.5. Что признано ненадёжным или незавершённым

- Сетка населения Kontur (методологический слой); внутрирайонное распределение в «красных» районах.
- Координаты портфеля - центроиды городов (кроме Uchtepa Park и помеченных ручными).
- Мини-тест: после снятия приписок верный ответ самый длинный в 66% вопросов; `quiz_tells.js`
  честно проваливается - нужно переписывать дистракторы (контент, не код).
- Слой образования в мастер-базе не собран (36 позиций в очереди без координат); слой работает от
  OSM «здесь и сейчас».
- Таблица «Сравнение стран» - константа.
- Границы области - из интернета.
- Две стандартные картинки титула КП не залиты (`os/assets/`).

---

## 7. Безопасность и релизная дисциплина

### 7.1. Что сделано

- Заголовки в `os/.htaccess`: `Strict-Transport-Security max-age=31536000` безусловно (v4.70.3; без
  `includeSubDomains`/`preload`), `X-Content-Type-Options nosniff`, `X-Frame-Options SAMEORIGIN`,
  `Referrer-Policy same-origin`, `Permissions-Policy` (geolocation, microphone, camera выключены),
  CSP: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net
  https://api-maps.yandex.ru; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src
  'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https://fonts.gstatic.com;
  frame-src 'self' blob: data:; object-src 'self' data: blob:; worker-src 'self' blob:; base-uri 'self';
  form-action 'self'; frame-ancestors 'self'`. Проверяется настоящим Apache (`v4703_os_headers.sh`).
- Cookie сессии: `httponly`, `SameSite=Lax`, `Secure` по четырём признакам схемы (за прокси тоже);
  на `http://localhost` флаг снят намеренно (двусторонний тест `v4703_cookie_scheme.php`).
- Экранирование `esc()` везде, включая планировки (`planSVG` и планировка Заравшана - хранимый XSS
  закрыт в v4.70.3, тест `v4703_plan_xss.js`).
- Финансовые поля помещений: единый список `unit_finance_fields()` на сервере, вырезание в GET,
  восстановление в POST, отказ в `unit_patch`, структурные операции только с `finance`/`plans`,
  CSV-выгрузка без финансовых столбцов (v4.70.1, 57 проверок по 10 ролям).
- Бэкапы вне веб-корня, запрет отдачи `.sql`/`.sql.gz`/`.sqlite`/`.log`/`.env`, `Require all denied`
  в `sql/`, `sql/backups/`, `data/geo_master/`, `data/case_files/`; `config.php` и `lib.php` закрыты.
- CLI-only скрипты (коллектор, конвертер, cron, установщик мастер-базы) - 403 из веба.
- `setup.php` самоблокируется после первого администратора, но должен быть удалён.
- CSRF на всех POST, same-origin для записи, лимит тела 40 МБ, белый список таблиц/столбцов.
- Аудит append-only; коды входа хешированы; пароли bcrypt; сессия 12 ч.
- Fail-closed для AGX/BSH/BRJ и на клиенте (`caseStrictCanOpen`), и на сервере.
- `admin_modules`/`admin_system` нельзя скрыть, `app_users` нельзя удалить через `data.php`.
- Определение BACKEND только по `typeof j.auth==='boolean'` (статик-сервер не включает серверный вход).

### 7.2. Что осознанно не закрыто

`'unsafe-inline'` и `'unsafe-eval'` в CSP (платформа на inline-скриптах и `onclick`; `jszip` использует
`Function`); гранулярные права
на действия с помещением (15 прав из аудита) - отдельная работа; настройки гео-студии под ключом
`guest` в iframe; ложное предупреждение `server_check.php` о неполной заливке для шести модулей;
состав архива для хостинга; плавающая кнопка чата на мобильном (перечень из CHANGELOG v4.70.1-4.70.3).

### 7.3. Правила выпуска

1. Патчи безопасности выпускаются отдельно от функциональных (v4.70.1, v4.70.3).
2. Поднять `APP_VERSION`, `CACHE` и комментарий в `sw.js`, `?v=` только изменённых файлов,
   `CASE_EXPECTED_MODULES`/`CASE_EXPECTED_STUDIO_MODULES` для изменённых версионируемых модулей.
3. Пересобрать манифест `SHA256SUMS_vX.txt` (ровно один в `os/`), старый - в `docs/archive/`.
4. `os/DEPLOY.md` с текущей версией и верным признаком успешной установки; `CHANGELOG` в корне.
5. `node docs/qa/tools/release_invariants.js os` - зелёный (проверяет: версия в шапке, имя кэша,
   комментарий sw.js, DEPLOY.md, единственный манифест, карта студии через `window`, версия и
   cache-buster каждого модуля, попадание каждого модуля в сверку, наличие всех ASSETS на диске,
   каждый подключённый скрипт в офлайн-кэше, нет длинного тире в статическом тексте, документации
   и инструментах вне символьного класса, нормализаторы тире на месте).
6. Регресс: ролевой доступ (54), обход 89 разделов, конфликты CSS, права на финансы, схема cookie,
   планировки без исполнения данных, происхождение чисел, гео-наборы, единый вид 89/89.
7. Собрать `CASE_OS_vX.Y.Z_os_only.zip` только из `os/`, исключив `config.php`, `api/config.php`,
   `notify_recipients.php`, `*.sqlite`, `*.sqlite3`, `*_brands_test.xlsx`, `sql/backups/*.sql.gz`
   (но не `.htaccess` внутри). FULL-архив дополнительно без `.claude/*`, `CLAUDE.md`, `graphify-out/*`
   (`.gitignore` zip не читает).
8. Коммит в рабочую ветку; в `main` - только по явному разрешению; PR - только по явной просьбе;
   идентификаторы моделей ИИ в коммитах, PR и коде не писать.
9. После заливки: `Ctrl+Shift+R`, версия в шапке, сообщения в консоли, `sha256sum -c SHA256SUMS_vX.txt`
   из папки `/os`.

### 7.4. Инструменты проверки `docs/qa/tools/` (84 файлов)

Инфраструктура и общие прогоны:

| Инструмент | Назначение |
|---|---|
| `verify_full_qa.js` | Полный браузерный QA (Playwright + статик-сервер, `?demo=1`, 404 на `/api/*`), ~35 проверок. |
| `p01_vm_test.js` | VM-тест ядра снапшотов планировок (P0-1) без браузера. |
| `mock_backend.js` | Мок PHP-бэкенда для E2E (`auth`, `state`, `unit_patch`, `units_batch`, `/__ctl`, `/__inspect`, `failMode`). |
| `role_access_qa.js` | Вход под каждой ролью, меню, запретные экраны (54 проверки). |
| `roles_security_audit.js` | Статический аудит ролей и безопасности. |
| `all_views_sweep.js` | Обход всех экранов: JS-ошибки, пустоты, многословие; пишет `sweep/`. |
| `release_invariants.js` | Инварианты релиза (см. 7.3). |
| `css_conflicts.js` | Аудитор конфликтов CSS между модулями по живым `document.styleSheets`. |
| `v4571_browser_pass.js` | Прогон на 5 разрешениях (1920/1366/1024/768/390) × 8 разделов: доступность, боковая прокрутка, мелкий шрифт. |
| `v4702_modernization_scan.js`, `v4702_four_sections_check.js` | Инвентаризация «старых» разделов по признакам дизайн-системы; проверка четырёх разделов. |
| `v4700_funnels_one_style.js` | Единый почерк воронок аренды и Advisory. |
| `shots.js` | Скриншоты экранов для UX-ревизии. |
| `server_check.php`, `deep_check.php`, `browser_check.js` | Диагностика боевого сервера и браузера (только чтение, без секретов). |
| `check_office_files.py` | Вскрытие выгруженных `.xlsx`/`.pptx` настоящими openpyxl и python-pptx (45+ проверок). |
| `quiz_tells.js` | Подсказки в банке вопросов (приписки, длина, позиция). Сейчас честно проваливает проверку длины. |
| `width_persist2.js`, `lcr_persist.js` | Стойкость ширин столбцов; правка ЛСР доезжает до сервера. |

Проверки по релизам (браузерные, если не сказано иное): `v4420_scenarios`, `v4420_studio_bc`,
`v4421_check`, `v4422_studio_uniform`, `v4430_prefs_sync`, `v4431_probe_pdf`, `v4432_probe_flow`,
`v4433_live_edit`, `v4440_reliability`, `v4441_ui_flows`, `v4460_merge_smoke`, `v4461_poll_sync`,
`v4462_visual`, `v4463_pins`, `v4491_geo_guard`, `v4491_groups`, `v4492_vars_guard`,
`v4500_denied_noise`, `v4501_reject_revert`, `v4503_backend_guard`, `v4504_brand_taxonomy`,
`v4505_restricted_keys`, `v4506_districts_local`, `v4507_comment_draft`, `v4510_taxonomy_admin`,
`v4520_studio_poi_legend`, `v4530_geo_export`, `v4590_drawer_scroll`, `v4610_sun_wind_qibla`,
`v4611_transport_stops`, `v4620_poi_index`, `v4630_huff`, `v4640_role_dir`, `v4650_uchtepa_park`,
`v4650_uchtepa_browser`, `v4660_translit`, `v4670_pricing`, `v4680_directories`, `v4690_cover`,
`v4690_offer_simulation`, `v4701_unit_finance_acl.php`, `v4703_cookie_scheme.php`,
`v4703_os_headers.sh` (нужен локальный Apache с `mod_autoindex`), `v4703_plan_xss`,
`v4710_provenance`, `v4710_provenance_api.php`, `v4730_geo_proxy.php` (48 проверок), `v4730_geo_agent` (72).
Серверные без сети: `transport_parse.php`, `poi_categories.php`.
Гео-автономная версия: `geo_standalone_education/fnb/labels/legend/maps/offline/samsung/settings.js`,
`bc_labels_repro.js`. Samsung BC: `samsung_catchment.py`, `samsung_maps.py`, `samsung_report_build.py`,
`samsung_slide.py`, `samsung_catchment.json`.

### 7.5. Запуск тестов

- Node + `playwright-core` (`npm i playwright-core` в scratchpad), Chromium по пути
  `CHROME_BIN` (в среде разработки `/opt/pw-browsers/chromium-1194/chrome-linux/chrome --no-sandbox`).
- `node docs/qa/tools/verify_full_qa.js /path/to/os`; большинство наборов - `node <набор>.js os`.
- `node docs/qa/tools/release_invariants.js os`.
- PHP-тесты: `php docs/qa/tools/v4701_unit_finance_acl.php` и подобные (без базы, вырезают функции
  из `lib.php`); синтаксис - `php -l os/api/*.php`.
- Python: `python3 docs/qa/tools/check_office_files.py` (openpyxl, python-pptx).
- Локальную студию тестировать с моками `/api/auth.php` (`{auth:true,user:{}}`) и
  `/api/workspace_access.php` (`{allowed:true}`).
- Ограничения среды ИИ-сессий (из HANDOFF): прокси блокирует внешние хосты (живой сайт не открыть,
  Overpass/CDN недоступны), PHP есть, но без MySQL-драйвера - серверную логику проверять `php -l` и
  VM/PHP-тестами; реальную базу тестирует владелец на staging.
- Результаты прогонов: `docs/qa/*.json`, в CHANGELOG каждого релиза.

---

## 8. Хостинг и развёртывание

### 8.1. Требования и факты

- Хостинг DirectAdmin (`caseadvisory.uz:2222`, 95.46.96.13), домен `.uz`; домен `.com` - другой
  сервер (185.215.4.52), класть туда файлы бесполезно. Платформа: `domains/caseadvisory.uz/public_html/os/`.
- **PHP на хостинге - 8.0** (переключён владельцем 16.09.2026; в панели «PHP выбор версии» доступны
  7.4, 8.0, 8.2). История: 7.2 по диагностике в терминале 27.07.2026 (HANDOFF), «7.4 подходит» в
  `ХОСТИНГ_ПОШАГОВО.md`. Рабочее правило не меняется: **весь PHP-код совместим с 7.2-8.4** (никаких
  стрелочных функций `fn`, типизированных свойств, `match`, `?->`, union-типов, `str_contains`,
  именованных аргументов, composer-зависимостей), чтобы смена версии в панели ничего не ломала;
  проверяется автоматически в `v4730_geo_proxy.php`. Cron идёт по терминальной версии PHP.
- **Диск хостинга почти полон** (1.89 из 1.95 ГБ на снимке панели 16.09.2026): перед заливкой
  освободить место, иначе часть файлов не запишется (`sha256sum -c` это покажет).
- Автодеплоя из GitHub нет (по решению владельца); `.github/workflows/deploy-os.yml` существует, но
  требует FTP-секреты. Обновление - вручную через Менеджер файлов.
- Сервер должен выпускать соединения к `overpass-api.de` (слои OSM, здания, дороги) и
  `nominatim.openstreetmap.org` (адреса). Судя по снимкам владельца (v4.72.0), исходящая сеть с сервера
  закрыта: кнопка «⇄ Связь» в студии проверяет это и выводит дословный текст для поддержки хостинга
  («разрешите исходящие HTTPS-соединения из PHP к overpass-api.de и nominatim.openstreetmap.org»).
  Внешних API моделей платформе не нужно.

### 8.2. Первая установка (по `ХОСТИНГ_ПОШАГОВО.md`)

1. Папка `os` в `domains/caseadvisory.uz/public_html` (Extract архива, архив удалить).
2. `.htaccess` корня домена заменить содержимым `hosting/caseadvisory.uz/.htaccess`: пропуск
   `.well-known/` (продление Let's Encrypt), служебные файлы, 301 внутри `.uz`, список разделов,
   остающихся на `.uz` (`os`, `admin`, `lp`, `taxtapul`, `galaba`, `kibray-dc`, `mercure-restaurant`,
   `botanica`), подъём до https с учётом `X-Forwarded-Proto`, остальное - на `.com` (302 временно,
   потом 301). Перед заменой сверить со старым файлом на сервере. Разбор дефекта старого правила -
   `hosting/ПЕРЕАДРЕСАЦИЯ_UZ_НА_COM.md`, проверка - `hosting/test_redirect_rules.sh`.
3. База: имя `os` -> `wwwcasea_os`, пользователь, пароль.
4. phpMyAdmin: импорт `schema_mysql.sql`, затем `seed_roles.sql` (`install_all.sql` - только для XAMPP);
   затем миграции через `migrate.php` (или вариант Б - перенести дамп с XAMPP).
5. Почтовый ящик `no-reply@caseadvisory.uz` для кодов входа.
6. `config.sample.php` -> `config.php`: база, `backup_token`, `mail_from`, `smtp` (mail.caseadvisory.uz,
   465, ssl). Строки `code_login => false` быть не должно.
7. `https://caseadvisory.uz/os/api/setup.php` - создать администратора настоящим email; **удалить
   `setup.php`**.
8. Войти: email -> «Получить код» -> код из письма.
9. Добавить сотрудников в «Пользователи» с рабочими email.
10. Cron ежедневного бэкапа: `curl -s "https://caseadvisory.uz/os/api/backup.php?token=ВАШ_ТОКЕН"`
    в 03:00 (`docs/ops/АВТОБЭКАП_И_CRON_ПОШАГОВО.md`).

Таблица «если что-то пошло не так»: «Неизвестное действие» - не вся папка `os/api` залита; письмо
не уходит - блок `smtp` или временно `allow_password_login => true`; ошибка базы - сверить
`name/user/pass`; обновление не видно - `Ctrl+F5`.

### 8.3. Обновление

- Бэкап базы (phpMyAdmin Export или кнопка в платформе).
- Заменить всё содержимое `/os` содержимым архива (`config.php` в архив не входит и не трогается).
  С v4.70.3 архив называется `CASE_OS_vX.Y.Z_HOSTING_READY_ДАТА.zip` и содержит папку `os`, журналы
  последних выпусков, `hosting/htaccess_caseadvisory.uz.txt` и `ЧИТАТЬ_ПЕРВЫМ.txt`; старое имя
  `CASE_OS_vX_os_only.zip` относится к архивам до v4.70. После v4.49.0 обязателен новый файл `core.js` - без него пустая страница.
- Если есть миграция - положить в `os/sql/migrations/` и открыть `migrate.php` администратором.
- `Ctrl+Shift+R`; в шапке версия; в консоли «все модули версии X»; при рассинхроне тост «Перезалейте
  /os целиком»; `sha256sum -c SHA256SUMS_vX.txt`.
- После v4.70.3 все входят заново один раз (изменились параметры cookie).

### 8.4. Что нельзя класть в архив

`config.php`, `api/config.php`, `notify_recipients.php`, `*.sqlite`, `*.sqlite3`, `*_brands_test.xlsx`,
`sql/backups/*.sql.gz`, `.claude/*`, `CLAUDE.md`, `graphify-out/*`, выхлоп тестов. Архив `os_only`
собирается только из папки `os`, поэтому лендинг, `admin` и документы в него не попадают.

### 8.5. Локальный запуск (XAMPP)

`НАЧАТЬ_ЗАНОВО.md`: скопировать `os` в `C:\xampp\htdocs\`, импортировать `os/sql/install_all.sql`
(создаёт базу `caseos`, 45 таблиц, 7 ролей seed), переименовать `config.local-xampp.php` в
`config.php` (`code_login => false`, вход по паролю), создать администратора через `setup.php`, удалить
`setup.php`, проверить `http://localhost/os/api/auth.php` -> `{"auth":false}`, открыть
`http://localhost/os/`. Порт 80 занят - сменить на 8080. `ЛОКАЛЬНО.md` - тот же путь через
`schema_mysql.sql` + `seed_roles.sql`.

### 8.6. Диагностика

`docs/qa/DIAGNOSTIKA_RU.md`: `server_check.php` и `deep_check.php` заливаются в `os/` и запускаются
из терминала DirectAdmin (`php server_check.php`; из браузера - 403), `browser_check.js` - в консоль
F12. Плюс `api/health.php` и `api/diag.php` для администратора. Диагностика 27.07.2026 показала:
состояние 5.1 МБ (из них `PLANSVG` 3.1 МБ), 62 помещения без коммерческих данных, 18 в корзине.

---

## 9. История версий (сжатая хроника)

До v4.51.0 (по HANDOFF): v4.31.x - унификация таблиц, компактный ЛСР; v4.32.x - билд пользователя
(CASE Data Grid, `unit_patch`/`units_batch`, AGX lockdown); v4.33.0 - неизменяемые снапшоты
планировок (P0-1); v4.35.0 - закрыт весь внешний аудит (P1-1 ... P1-6, P2: CSP+HSTS, CLI-only
скрипты); v4.36.0 - слито в `main`, автобэкап; v4.37-4.41 - порядок в меню, единый скин, обход 89
экранов, аккордеон; v4.42-4.43 - гео-контролы, миграции workspace 4420/4421, per-user настройки
таблиц, авто-отчёт по точке + PDF; v4.44.0 - сессия 12 ч, очередь несохранённого; v4.45-4.46 -
слияние с билдом пользователя (owner-report, ux-system, fail-closed роли, live-sync); v4.47-4.48 -
пересборка табличного ядра, нативный sticky, угловой блок, аудитор CSS; v4.49.0 - ядро вынесено в
`core.js`; v4.49.1-4.49.2 - защита геоданных от обвала, история гео, справочники втрое больше;
v4.50.0-4.50.7 - ложные отказы сохранения, откат отклонённой правки, quiz-приписки, аудит пакета
(бэкапы вне веб-корня, CSP для jsDelivr), таксономия брендов, `restricted_keys`, локальные границы
районов, черновик комментария. Параллельно - автономная геоаналитика (`docs/standalone`): Samsung BC,
подложки, образование из OSM, независимость от сети.

### v4.51.0
Справочник категорий/подкатегорий/типов брендов ведёт администратор (ключ `TAXO`, «Система ->
Справочник категорий брендов»); встроенные значения не удаляются; +12 кухонь (31 тип общепита).
Разделение: подкатегория = формат, тип = кухня. Тест `v4510_taxonomy_admin.js` 16/16, набор 133/133.

### v4.52.0
Легенда карты снова принимает мышь (терялся класс `leaflet-control`), прокрутка тела, размер ручкой.
Все включённые слои POI в легенде с количеством на экране. Отчёт по точке: блоки «F&B» и
«Образование», скоринг F&B (эталон 25/км) и учебного центра (5/км), модель зон считает профильные
слои. Автономный HTML: слой F&B из OSM с чайханой по названию.

### v4.53.0 / v4.53.1
Выгрузка аналитики по проекту одной кнопкой: PDF (печать), XLSX и PPTX, собранные в браузере без
библиотек; снимок карты только с CORS-подложек; имена файлов латиницей. v4.53.1: Excel 10 листов
(население, плотность, разрез по районам, БЦ со средними по классам, медицина, метро, рынок), PPTX
9 слайдов; мост `window.CASE_GEO_DATA` только на чтение. Проверка `check_office_files.py`.

### v4.54.0
Три своих объекта перенесены в ОС (148 -> 151 БЦ); образование расширено учебными центрами и
курсами (`amenity=training`, `office=educational_institution`), выборка `nwr`; типы OSM
по-человечески; чайхана и столовая выделены. Настройки выгрузки по каждому проекту (разделы,
радиусы, эталоны, форматы).

### v4.55.0
Лист «Конкуренты» и слайд «Конкурентная среда» как в презентациях CASE; поля ТРЦ (год открытия,
участок, точки, F&B); слайд «Заявленные ставки» фигурами; `docProps` в офисных файлах.

### v4.56.0
Таблица «Конкуренты рядом» прямо в отчёте по точке, клик открывает карточку; панель 720 px.

### v4.57.0 / v4.57.1
Отраслевые поля карточки БЦ; конкуренты разнесены на офисы и торговлю; свод по зоне (медиана
ставки, суммарные GLA и свободная площадь); диапазон ставки важнее числа. v4.57.1: состав полей БЦ
сокращён по решению владельца до того, что команда реально заполняет.

### v4.58.0
Релиз про доезжающее обновление: `v4530-geo-export.js` добавлен в ASSETS, заведена
`CASE_EXPECTED_STUDIO_MODULES`, единственная переменная версии в модуле, `release_invariants.js`,
`ignoreSearch` в service worker, прокрутка/фокус при 17 операциях ЛСР через live-sync, доступность
(строки таблиц снова строки, словарь значков, фокус видим), нормализатор тире (три правила,
выгрузки и печать), цифры выгрузки не зависят от сдвига карты, один объект - один голос в медиане.

### v4.59.0
Дизайн и эргономика: `NaN%` и `undefined` на экранах убраны, один активный статус на уровень
вкладок, кнопка «наверх» не на бейдже теста, неизвестный статус не гасит планировки. Гео-студия
переведена на палитру CASE, закреплённый командный блок, иконка слоёв CSS. Единая высота контролов
в `v4450-ux-system.js`. Таблица «привязка вкладок студии к проекту» - вопросы для решения.

### v4.60.0
Слой транспорта показывал ноль (остановки без имени отбрасывались): отдельный запрос с
маршрутами (`type=route`), типы узлов, номера маршрутов с человеческой сортировкой, имя по улице.
Один OSM-тег - один слой (`poi_categories.php`); таймаут прокси больше таймаута запроса.

### v4.61.0 / v4.61.1
Солнце (полярная диаграмма, NOAA/Meeus до 0.4°), роза ветров (Open-Meteo ERA5), кибла по большому
кругу с выключаемой линией на карте; 30 проверок. v4.61.1: ошибка прокси читается из поля `error`
(не `message`), ответ разбирается как текст, маршруты в карточке остановки значками.

### v4.62.0
Пространственный индекс для 23 слоёв POI (клетки 0.01°): 45 мс против 1053 мс, сверка с перебором
на 56 сочетаниях без расхождений.

### v4.63.0
Модель Хаффа: доля рынка, охват, у кого забираем, каннибализация своих; 26 проверок-тождеств;
прямо подписано «не прогноз выручки». Идея - из разбора Geointellect.

### v4.64.0
Роль `DIR` «Директор (без администрирования)» в трёх местах (ROLES, DEFAULTS, миграция
`2026_08_13_role_dir.sql` - обязательна); перевод сотрудника на неё; `ADMIN_ONLY_VIEWS`.

### v4.65.0
Проект Uchtepa Park в портфеле (`portfolio-096`, координата проверена по районам, `exact_manual`),
запись в пяти файлах; дозаливочный seed снова не пуст; пустые поля оставлены пустыми.

### v4.66.0
Транслитератор узбекского латиница <-> кириллица (обратимость на 850 словоформах), четыре найденные
ошибки, три решения против буквы ТЗ (без `ts -> ц`). Вычищено 1476 длинных тире в 126 документах и
256 в 50 инструментах; два новых инварианта релиза.

### v4.67.0
Расчёт стоимости КП: прайс извне, ручная ставка, коэффициент сложности (надбавки складываются),
скидка, назначаемый итог, `deviations` с `needsReason`; 81 проверка, перебор 1460 сочетаний.

### v4.68.0 / v4.69.0
Справочники проекта: вид (18 видов из 26 написаний портфеля), тип работ, сегмент выводится.
Титульная картинка КП: фото проекта -> стандартная картинка по номеру -> блок цифр; файлы картинок
не залиты. Сквозная симуляция КП в живой системе (21 проверка).

### v4.70.0
16 таблиц аренды получили `<thead>` и `.tbl-scroll` и попали в табличное ядро; экраны Advisory
получили заголовок `.ph` (плашка «Только просмотр» заработала). Из 72 расхождений между воронками
закрыты мешающие работе.

### v4.70.1
Патч безопасности: финансовые поля помещений закрыты на сервере (`unit_finance_fields()`, GET/POST
`state.php`, `unit_patch`, `units_batch`, CSV), без потери данных при сохранении ролью без finance;
57 проверок по 10 ролям.

### v4.70.2
«Разделы старой версии»: обход 89 разделов, три разметки плиток чисел сведены к одной, `.ph` у
четырёх разделов, База брендов в табличном ядре, один кегль заголовка; 89/89 в общем виде.

### v4.70.3
Патч безопасности: `Secure` у cookie по схеме за прокси, HSTS безусловно, `esc()` в планировках
(хранимый XSS), CSP пропускает `api-maps.yandex.ru`. Все входят заново один раз.

### v4.71.0
Происхождение чисел (ключ `PROV`, `provenance.php`, `v4710-provenance.js`): три уверенности,
правило «самая слабая», устаревание 90/180 дней, подтверждение действием, финансовые записи по
праву finance, раздел «Качество и источники данных» стал настоящим. Найдено: `objects`/`units` не
используются SQL; якорь `$` -> `\z`. SOATO ждёт справочник.

### v4.72.0
Гео-ассистент в студии: 10 инструментов в браузере, локальный разбор команд на трёх языках, свободная
речь через внешнюю языковую модель по ключу (`assistant.php`, сервер без состояния, 40 ходов/10 мин),
здания и дороги OSM через `gis_proxy.php` (`osm_lib.php`, кэш 30 дней), население по доле площади
ячейки, калибровка зонда исправлена (`CAL` вместо `POP`), дорога без вершин в круге учитывается.
157 проверок в трёх наборах. Намеренно нет: пешие изохроны, WorldPop, сохранение слоёв ассистента.

### v4.73.1
Студия геоаналитики без проектов CASE: нет списка проектов над картой, секции «Проект», точек
портфеля и трёх вкладок про проект. Одна точка анализа, которую задаёт гео-агент (клик,
координаты, адрес); по ней отчёт, выгрузка, солнце и Хафф. Гео-профили проектов в базе не
трогаются. Тест `v4731_point_not_projects.js` (22). Подробно - раздел 13.5.

### v4.73.0
Свой гео-агент вместо внешней модели (условие владельца: без Anthropic и платных ИИ): детерминированный
движок в браузере на трёх языках, 17 инструментов, точка кликом/координатами/адресом, полигоны
кликами, объединение фигур, счёт «в зоне», геокодер Nominatim, проверка связи с советами словами,
своя OpenAI-совместимая модель по желанию (только перевод фразы в команды). Подложка по умолчанию
OpenStreetMap (CARTO требует ключ). Боковая панель студии и агент в цветах CASE. Хостинг на PHP 8.0.
120 проверок в двух наборах. Подробно - раздел 13.4.

---

## 10. Известные проблемы, ограничения и планы

### 10.1. Открытые вопросы владельца (из HANDOFF и changelog)

- Должен ли BRJ править реестр: сервер закрывает (`unit_patch.php`), UI показывает кнопки правки.
- `BENCH` закрыт для роли жалобщика (`state.php`, область `bench`) - решить, кто правит бенчмарки.
- Гео-студия в демо-режиме показывает отказ: варианты - подписанная метка родительской сессии во
  фрейм или явная демо-ветка только для чтения.
- Скоринг на экране и в выгрузке по разным эталонам: показывать в файле экранный или выносить
  настраиваемый отдельным блоком.
- «Сравнение стран» и «Аналитика» в студии: перенести в данные с источником и датой или убрать из
  клиентской версии; клиенту по подписке показывать три вкладки вместо семи.
- Типов нет у категорий «Специализированный ритейл», «Офис / коворкинг», «Склад», «Прочее».
- В базе один сотрудник числится и как AG, и как HO - возможно, роль меняли.

### 10.2. Технический долг

- `'unsafe-inline'`/`'unsafe-eval'` в CSP.
- 193 конфликта CSS с `!important` между модулями (карта в `css_conflicts.js`), разбирать постепенно.
- Из 72 расхождений между воронками аренды и Advisory остались косметические: статусы аренды сырым
  английским, нет фильтров у комиссий, `.kpi .lab/.val` дизайн-системы не используется модулями,
  пустые состояния/модалки/радиусы разнятся.
- `v493-portfolio-suite.js` обращается к `window.CASE_PORTFOLIO_PROJECTS`, которого нет (переменная
  объявлена `let` в ядре) - сегодня безвредно.
- Разовая очистка портфеля на чистой установке (`core.js`, флаг `portfolioClearedV411`) - по замыслу.
- Мини-тест: верный ответ самый длинный в 66% вопросов - переписать дистракторы.
- `REGGEO` (область) из интернета; автономная версия хранит правки по индексу массива.
- Настройки гео-студии под ключом `guest`; ложное предупреждение `server_check.php`.
- Состояние 5 МБ с `PLANSVG` 3 МБ - тяжёлое сохранение целиком; переход к доменным ревизиям (P1-6)
  сделан частично (дельта + per-key), полноценного patch/merge по доменам нет.
- Метрики покрытия тестами нет (только проверки поведения).

### 10.3. Планы и дорожная карта

- 40 модулей `future` в каталоге: управление объектами (facility, оборудование, заявки, договоры
  арендаторов, asset management, бюджет объекта, NOI, CAPEX), финансы CASE (11 модулей), рыночные и
  макро-данные, импорт/экспорт, цифровые продукты (CASE Intelligence/Market/Living/Manage,
  подписки), процессы/справочники/интеграции администратора, исследование рынка, концепция,
  программа площадей, бизнес-план, контроль открытий, handover, договоры проектов.
- Offer Builder (`docs/audit/00_PLAN.md`): отдельные SQL-таблицы, нумерация без пропусков, A4-блоки
  и слайды по утверждённым шаблонам `.dc.html`; фундамент уже в v4.66-4.69.
- Из CHANGELOG v4.71.0/4.72.0: SOATO по справочнику ДШК файлом, происхождение у объектов (`gba`,
  `gla`, `vacancy`) в карточке, проекция `PROV` в SQL для отчётов, WorldPop как вторая модель
  населения (растр передать файлом), пешие и транспортные изохроны, сохранение зон гео-агента в
  `GEO_DATA`, многоконтурные здания.
- Из `PLATFORM_FACTS`: мультиарендность (работа по всей схеме), витрина листингов, роль владельца,
  сущность договора аренды с начислениями - в дорожную карту, не в «уже работает».
- Из BACKEND_PLAN: этап P4 (realtime, уведомления по контрольным датам) реализован частично -
  фоновой опрос `state.php` и `cron_critical_dates.php` (Telegram/email); P5 - staging-приёмка на
  реальном Apache/PHP/MySQL по чек-листу A-J (`docs/audit/v4.45.0/*STAGING_CHECKLIST*`).
- Инфраструктура ручной верификации геобазы готова (76 полей, очередь 463, 1279 проблем) - нужны
  аналитики, выполнено 0.
- PHP уже 8.0 (16.09.2026). Настроить cron бэкапа (если не сделано); освободить место на диске хостинга.

---

## 11. Правила работы над проектом для разработчика или ИИ

### 11.1. Общие

- Язык интерфейса, документации, комментариев и changelog - русский; термины отрасли (GLA, GBA,
  POI, OSM, LCR, catchment) остаются как есть.
- **Никаких длинных и средних тире** в видимом тексте, документации и инструментах - только дефис.
  Исключение: символьные классы в регулярных выражениях нормализаторов и тестов (без них проверка
  тире не работает). Массово менять тире в исходниках регулярками нельзя.
- Не выдумывать данные: пустое поле лучше нуля, «нет данных» и «0» - разные утверждения; координаты
  не подставлять центроидами; ноль в исследовании означает «не проверено».
- Каждый релиз - changelog «что, почему, как проверено, чего намеренно нет»; в коде - комментарии
  «зачем», а не «что».
- Тесты обязаны быть осмысленными: проверка должна падать на старом коде; для защит проверять оба
  направления (например, `Secure` за прокси есть, на localhost нет). Тесты запускаются до заявления
  о готовности, а не после: в v4.73.0 первый же запуск нашёл функции, вызванные, но не определённые.
- Никаких внешних платных сервисов ИИ внутри платформы (решение владельца, v4.73.0): агент свой;
  своя модель (Ollama и подобные) допустима только как необязательный перевод фраз в команды.

### 11.2. Код

- Фронтенд: чистый JS без сборки и фреймворков, модули - IIFE с защитой от повторной загрузки,
  одна переменная `VERSION`, регистрация версии в конце. Глобалы ядра не в `window` - читать голыми
  именами под `typeof`; `const`/`let` верхнего уровня в `window` не попадают (это ловило несколько
  багов: `CATTYPES`, `CASE_EXPECTED_MODULES`, `CASE_PORTFOLIO_PROJECTS`).
- Экранировать всё через `esc()`, включая SVG планировок; в атрибуты `onclick` подставлять только
  внутренние идентификаторы.
- Leaflet: не вызывать `bindTooltip` дважды до `addTo`; в студии `map` - лексическая переменная,
  `window.map` - это `<div id=map>`; смещения подписей хранить в `margin`, а не `transform`.
- Таблицы: только `<table>` с `<thead>` в обёртке `.tbl-scroll`; презентацию таблиц менять в
  `v432-data-grid.js`, не в модулях; не ставить inline `position` на `th`.
- Правки текстов регулярками - без жадных `[^<]{n,m}` (строки живут и в словарях ENMAP/UZMAP, и в коде).
- Массив `BC` и число секций в автономной геоаналитике не переставлять (правки хранятся по индексу);
  новые проекты - строго в конец.
- Новый ключ состояния: добавить в `all_shared_state_keys()`, при необходимости в
  `baseline_state_keys()`, в вычитание системных ключей `role_allowed_state_keys()` (если пишет
  только админ), в `workspace_view_keys()` для нужных разделов, в `stateBlob()`/`applyState` на клиенте.
- Новая роль: `ROLES` в `core.js`, `DEFAULTS` в `v3520-workspaces.js`, миграция SQL (сначала роль,
  потом назначение пользователя), проверка в трёх местах отдельно.
- Новый проект портфеля: пять файлов (см. 6.1), координата с пометкой ручной/verified.
- В регулярных выражениях JS `\b` не видит кириллицу: границы русских слов писать явными
  просмотрами `(?![а-яa-z])` (ловило «500 м», «готово», «отмена», «их»).
- PHP: синтаксис не новее 7.2 (совместимость 7.2-8.4), без composer; сырые HTTP-вызовы вместо SDK; чистые функции выносить в
  отдельные `*_lib.php`, чтобы тестировать без сессии и базы; ошибки через `fail()` (поле `error`);
  CLI-скрипты с проверкой `PHP_SAPI`; секреты только в `config.php`.
- Server-side защита обязательна: маскировка на экране защитой не является (урок v4.70.1).
- Атомарные пути для конкурентных правок (unit_patch, provenance) вместо сохранения всего state.

### 11.3. Git и выпуск

- Разработка в рабочей ветке `claude/*` (сейчас `claude/case-os-data-migration-p4df5y`; ранее
  `claude/new-session-2kq1ff`). В `main` - только fast-forward по явному разрешению владельца.
  PR не создавать без явной просьбы. Область репозиториев - только `caseadvisoryservicess/case-site`.
- Идентификаторы моделей ИИ в коммиты, PR и код не писать.
- Релизный чек-лист - раздел 7.3; патчи безопасности отдельными релизами.
- ZIP всегда без секретов и dev-обвязки; `os_only` только из `os/`.
- Присланный владельцем файл всегда сверять с версией в репозитории (терялись проекты).

### 11.4. Что не трогать

- `os/api/config.php` на сервере (не перезаписывать, не присылать в архивах).
- `os/data/case_files/`, `sql/backups/`, `caseos_backups` - данные, бэкапить вместе с базой.
- `schema_mysql.sql` на рабочей базе повторно не запускать; `DROP`/`TRUNCATE` в миграциях запрещены.
- Встроенные значения таксономии брендов (на них ссылаются бренды).
- `core.js` без необходимости (каждая правка - перекачка 1 МБ у всех).
- Порядок обёрток `renderRegistry` (v35 -> core -> orig) - чинить логику, а не порядок.
- Записи сохранённых названий объектов с тире в данных (правка разъедется с импортом).

---

## 12. Словарь терминов и сокращений

| Термин | Значение |
|---|---|
| CASE OS | Операционная система агентства CASE Real Estate Advisory (эта платформа). |
| Advisory | Консалтинговое направление CASE (исследования, концепции, КП, договоры, delivery). |
| LCR / ЛСР | Lease Control Registry - реестр контроля аренды (помещения, ставки, статусы, брокеры). |
| SCR | Sales Control Registry - контроль продаж. |
| КП | Коммерческое предложение (proposal, offer); модуль Offer Builder. |
| GLA / GBA / NLA | Арендопригодная / общая / чистая арендуемая площадь. |
| POI | Точки интереса (магазины, кафе, школы и т. п.) из OSM. |
| OSM / Overpass / Nominatim / OSRM | OpenStreetMap; его API запросов; геокодер; маршрутизатор. ODbL - лицензия OSM, требует атрибуции. |
| Kontur H3 | Сетка населения на гексагонах H3 (~0.87 км²), моделируемые данные 2023. |
| Toshstat | Статистика Ташкента: официальное население районов на 01.01.2026. |
| Калибровка | Приведение сумм Kontur к официальному населению по районам (коэффициент `CAL`). |
| Хафф | Гравитационная модель выбора объекта: доля = (A^a / D^b) / сумма. |
| Изохрона | Область, достижимая за N минут (в системе - только на автомобиле). |
| Catchment / зона охвата | Кольца 1 · 3 · 5 км или нарисованная зона вокруг проекта. |
| Скоринг | Оценка локации 0-100 по формуле 0.55 × спрос + 0.45 × (1 - конкуренты/эталон). |
| Эталон | Норма насыщения конкурентами на километр (БЦ, клиника 8, F&B 25, учебный центр 5). |
| PROV / происхождение | Запись «откуда число»: ✓ подтверждено, ≈ запрошено, ƒ расчёт, ? нет источника. |
| verified / needs_review | Статусы верификации записи геобазы; confidence A/B/C/D - уровень доверия. |
| app_state | Таблица с одним JSON-документом всего состояния платформы; `revision` - счётчик версий. |
| rejected_keys / restricted_keys | Ключи, отклонённые при сохранении по правам / закрытые для роли на чтение. |
| workspace | Набор разделов, доступных роли или пользователю (ROLE_WORKSPACES, USER_WORKSPACES). |
| MODULE_FLAGS | Глобальный статус модуля: active / beta / hidden; `future` - модуль-заглушка. |
| fail-closed | Принцип «запрещено, пока явно не разрешено» (роли AGX/BSH/BRJ). |
| AGX / BRJ / DIR | Внешний агент / младший администратор данных (бренды) / директор без администрирования. |
| CSRF / CSP / HSTS | Защита от подделки запросов; политика источников контента; принудительный HTTPS. |
| OTP / code_login | Одноразовый код входа по email. |
| SW / PWA / ASSETS / cache-buster | Service worker; офлайн-приложение; список предзагрузки; `?v=` у скрипта против кэша. |
| CASE_EXPECTED_MODULES | Карта ожидаемых версий модулей для сверки полноты заливки. |
| SHA256SUMS | Манифест контрольных сумм файлов релиза. |
| os_only zip | Архив релиза только из папки `os/` без секретов. |
| DirectAdmin / cPanel / phpMyAdmin / XAMPP | Панель хостинга (текущая) / панель из старых инструкций / веб-интерфейс MySQL / локальный сервер. |
| Playwright / VM-тест | Браузерные тесты на Chromium / тесты ядра в песочнице Node без браузера. |
| Data Grid / sticky / пины | Табличный движок v432; прилипшая шапка; закреплённые столбцы. |
| live-sync | Перерисовка без потери прокрутки и фокуса при фоновых обновлениях. |
| unit_patch / units_batch | Атомарная правка одного помещения / структурные операции над помещениями. |
| geo_state / GEO_DATA | Отдельный путь сохранения геоданных и сам ключ геоданных. |
| Мастер-геобаза | `os/data/geo_master`: 3292 объекта Ташкента с 76 полями и очередью верификации. |
| Коллектор | `geo_collector.php` - CLI-сборщик из OSM/Google/Яндекс/2GIS по сетке города. |
| Автономная геоаналитика | `docs/standalone/CASE_OS_Geo_Analytics.html` - один файл, работает с диска. |
| P0-1 ... P2 | Пункты внешнего аудита v4.31.18 (все закрыты к v4.35.0). |
| Handover | Передача проекта Advisory -> Leasing с фиксацией снапшота планировки. |
| TAXO / CATTYPES / SUBS | Пользовательская таксономия брендов / типы по категориям / подкатегории (два разных справочника: реестр и бренды). |
| MEP | Инженерные системы (механика, электрика, сантехника); модуль техзадания. |
| Кибла | Направление на Каабу; в студии - луч по большому кругу. |
| Гео-агент | Собственный помощник студии (v4.73.0): команды словами на ru/uz/en, инструменты считают числа, внешних ИИ нет. |
| Зона (агента) | Набор фигур: круги, изохрона, полигоны; «объедини» делает одну зону; «в зоне» - счёт по ней. |
| Ollama | Локальный сервер языковых моделей с OpenAI-совместимым API; для гео-агента - необязательный переводчик фраз в команды. |
| Overpass / Nominatim | API запросов к OpenStreetMap (POI, здания, дороги) / геокодер OpenStreetMap (адрес -> координаты). |

---

## 13. Текущее состояние: v4.70.3, v4.71.0, v4.72.0, v4.73.0 (сентябрь 2026)

Последние четыре выпуска сделаны подряд в одной рабочей сессии; их подробные журналы лежат
в корне репозитория (`CHANGELOG_CASE_OS_v4.70.3.md` ... `CHANGELOG_CASE_OS_v4.73.0.md`).
Здесь - выжимка, достаточная, чтобы продолжать.

### 13.1. v4.70.3 - патч безопасности

- Экранирование пользовательских строк в SVG планировок (`planSVG`, Зарафшан) в `core.js`:
  название помещения или бренда больше не может исполниться как разметка.
- Cookie сессии: флаг `Secure` определяется по `X-Forwarded-Proto`, `HTTPS` и порту 443
  (`$caseHttps` в `api/lib.php`), чтобы работать и за обратным прокси хостинга.
- `.htaccess` в `/os`: HSTS без условий, `api-maps.yandex.ru` добавлен в `script-src` CSP.
- Все сотрудники после установки входят заново один раз (изменилась cookie).
- Тесты: `v4703_plan_xss.js` (17), `v4703_cookie_scheme.php` (25), `v4703_os_headers.sh` (29,
  стенд Apache с mod_autoindex и канареечной папкой вне `/os`).

### 13.2. v4.71.0 - происхождение чисел (provenance)

- Модуль `v4710-provenance.js` (`window.CASE_PROV`) и эндпоинт `api/provenance.php`: у каждого
  ключевого числа (ставки, площади, бюджеты) есть запись «источник, метод, дата, уверенность».
- Три уровня уверенности с единой азбукой: ✓ подтверждено (verified), ≈ наблюдение (asking),
  ƒ расчёт (modelled). Плашки различаются значком, рамкой и словом, а не только цветом:
  материалы печатаются.
- Свежесть: старше 180 дней - красная плашка, старше 90 - жёлтая. Сводка по разделу
  показывает самую слабую и самую старую запись.
- Финансовые ключи происхождения скрываются от ролей без права на финансы (`redact_prov_for`,
  `restore_prov_finance` в `api/lib.php`, `state.php`).
- Раздел «Качество данных» (`data_quality`) выведен из «будущих» модулей.
- Тесты: `v4710_provenance.js` (52), `v4710_provenance_api.php` (60).

### 13.3. v4.72.0 - ассистент на внешней модели (снят)

Первый вариант гео-ассистента вызывал внешнюю модель через `api/assistant.php` с ключом в
`config.php`. Владелец отказался от него по двум причинам: платные внешние сервисы ИИ не
нужны, а ключ и сеть на хостинге не заработали (на снимке: «Ключ модели не настроен»,
«Overpass API недоступен с сервера»). В v4.73.0 файлы `api/assistant.php`,
`api/assistant_lib.php`, `v4720-geo-assistant.js` удалены; если они остались на хостинге
после копирования поверх, их нужно удалить вручную. Строка `anthropic_api_key` в
`config.php` больше не читается.

Что из v4.72.0 осталось и полезно: библиотека OSM (`api/osm_lib.php`), режимы
`gis_proxy.php?mode=buildings|roads`, счёт населения по доле площади ячейки внутри круга,
исправление зонда студии (калибровка населения по `CAL`, а не по `POP`), учёт расстояния до
отрезка дороги, центроид без повторной вершины.

### 13.4. v4.73.0 - свой гео-агент, зона, дизайн студии

**Принцип.** Агент живёт внутри платформы, бесплатен и не зависит от внешних ИИ. «Ум» -
детерминированный движок в браузере (`os/v4730-geo-agent.js`, `window.CASE_GEO_AGENT`):
разбор фраз на русском, узбекском и английском, состояние диалога (точка, зона, последний
упомянутый слой, последний радиус), уточнения, пересказ по шаблонам. Числа считают
инструменты по данным с происхождением; агент их только пересказывает.

**Семнадцать инструментов** (`TOOLS`): `set_site` (клик по кнопке «📍 Точка», координаты,
адрес через геокодер), `draw_radius`, `draw_isochrone` (OSRM, только автомобиль),
`draw_polygon` / `finish_polygon` / `cancel_polygon` (кликами по карте, «готово» или двойной
клик; либо по координатам), `merge_zones`, `zone_area`, `count_population` (в радиусе или
`{zone:true}`), `load_buildings`, `load_roads` (OSM через Overpass, фильтр по центроиду или по
ближайшему отрезку), `select_features` (этажность, тип, класс дорог), `style_layer`,
`count_competitors` (база БЦ CASE), `clear_layers`, `ping`, `help`.

**Зона.** Набор фигур: круги, изохрона, полигоны. Без «объедини» слово «в зоне» означает
последнюю фигуру; «объедини» делает одну зону (`ST.merged = true`): точка в зоне, если попала
хотя бы в одну фигуру. Площадь объединения - сеточная выборка 160 x 160 по рамке (точность
около 1%). Население в полигоне - подвыборка 4 x 4 точек в диске каждой ячейки.

**Точка без проектов CASE.** Агентом пользуются клиенты, список проектов им не нужен. На
время выбора точки и рисования полигона флажок «клик по карте = отчёт по точке» (`#lProbe`)
снимается и потом возвращается; пока студия сама рисует зону (`ZMODE`), агент клики не
трогает.

**Сервер.** `gis_proxy.php?mode=geocode` (Nominatim, ODbL, страна `uz`, кэш 30 дней в
`gis_analysis_cache`), `gis_proxy.php?mode=ping` (curl / allow_url_fopen, Overpass,
Nominatim, своя модель, локальная Ollama на 127.0.0.1:11434; советы словами из чистой функции
`osm_diagnosis`; роли с правом правки, 6 раз за 10 минут), `llm.php` (только GET, 20 фраз за
10 минут). Запросы наружу через `osm_http_get`: curl, иначе `file_get_contents`.

**Своя модель по желанию.** Если у владельца есть OpenAI-совместимый сервер (Ollama, vLLM,
LM Studio), в `config.php` задаются `llm_endpoint`, `llm_model`, `llm_key`. Фразы, которые
движок не разобрал, модель переводит в список команд из закрытого меню (`llm_menu`); ответ
проверяется на сервере (`llm_parse_calls`: только известные имена, только списки чисел и
строк, не больше 8 команд) и на клиенте (никогда `help` и `ping` по воле модели). Модель не
считает числа и не пишет ответ пользователю. Бесплатные модели «OpenCode Zen» из панели
хостинга - сторонний сервис, не подключаются.

**Почему не языковая модель на хостинге.** Общий хостинг: PHP, без GPU, диск 1.89 из 1.95 ГБ.
Панель показывает «Ollama (local)» лишь как вариант провайдера для их редактора кода, а не
как работающий сервис. Проверка связи покажет, если Ollama всё же появится на сервере.

**Подложка карты.** CARTO перестал отдавать тайлы без ключа и рисует «API KEY REQUIRED»
как успешную картинку, поэтому автозамена по ошибкам его не ловила. По умолчанию
OpenStreetMap; порядок автозамены: OpenStreetMap, Google, 2GIS, Яндекс; CARTO в списке с
пометкой «нужен ключ».

**Дизайн студии в цветах CASE.** Боковая панель - белые карточки на бумаге `#faf8f5` с
хайрлайном `#e3dcd1`, заголовки с красным маркером, поля и фокус в оксбладе `#9E0000`
(тёмный `#6e0000`), чернила `#1b1b1b`, Montserrat. Агент - карточка с тёмной шапкой и
меткой «свой движок», диалог на бумаге, факты - белые карточки с красным корешком и
крупным числом, ввод - пилюля с круглой красной кнопкой. Разметка и идентификаторы студии
не тронуты: изменён только CSS (блок `caseGeoSkin` в `geoanalytics-studio.html` и `CSS` в
модуле агента). Карточки обрезаются `overflow:clip`, а не `hidden`, чтобы не ломать липкие
заголовки секций.

**Хостинг.** 16.09.2026 владелец переключил PHP на 8.0 (в панели доступны 7.4, 8.0, 8.2).
Код API совместим с 7.2-8.4, конструкции новее 7.2 не используются намеренно (это
проверяет тест). Исходящая сеть с сервера, судя по снимкам, закрыта: текст для поддержки
хостинга агент выводит дословно («разрешите исходящие HTTPS-соединения из PHP к
overpass-api.de и nominatim.openstreetmap.org»).

**Ловушки, найденные в этой работе (повторяются).**
- `\b` в регулярных выражениях JS не видит кириллицу: «готово», «отмена», «помощь», «их»,
  «500 м» не совпадали. Всегда писать явные просмотры `(?![а-яa-z])`.
- В `frame.evaluate` нельзя возвращать объект карты Leaflet (не сериализуется): возвращать
  булевы значения и числа.
- Студия в тесте без заглушек `api/auth.php` и `api/workspace_access.php` заменяет `body`
  на «доступ закрыт»; в тестах используется `docs/qa/tools/mock_backend.js`.
- Инструменты записи файлов у некоторых ИИ-редакторов превращают escape-последовательность
  «обратная косая черта + u2014» в сам символ длинного тире: проверять файл после записи (`python3 -c "...count(chr(0x2014))"`).
- Функция, вызванная из `gis_proxy.php`, но не определённая в `osm_lib.php`, ловится только
  запуском теста: сначала тесты, потом заявление о готовности.
- Тест `v4611_transport_stops.js` иногда падает на гонке между кликом и асинхронным снятием
  галочки; при повторе проходит. Это гонка в тесте, не регресс.

**Тесты выпуска.** `docs/qa/tools/v4730_geo_proxy.php` (48 проверок, без сети и базы),
`docs/qa/tools/v4730_geo_agent.js` (72 проверки в настоящем браузере на подменённом прокси).
Регресс: инварианты релиза, ролевой доступ 54, единый вид 89 из 89, обход 89 разделов
(44 помеченных до и после), отчёт по точке и PDF, индекс POI, остановки, Хафф, обложка и
симуляция КП, происхождение чисел, планировки, cookie, финансовые поля.

**Архив для хостинга:** `CASE_OS_v4.73.0_HOSTING_READY_20260916.zip` (папка `os` без
`api/config.php`, четыре последних журнала, `hosting/htaccess_caseadvisory.uz.txt`,
`ЧИТАТЬ_ПЕРВЫМ.txt`). Проверка целостности: `sha256sum -c SHA256SUMS_v4.73.0.txt` из `/os`.

### 13.5. v4.73.1 - студия без проектов CASE

Владелец обвёл список проектов над студией: «take out CASE Projects». Студией пользуются
клиенты, наши проекты им не нужны. Сделано: над студией вместо списка подсказка про гео-агент;
секция «Проект» стала «Точкой анализа» (кнопка «📍 Точка на карте», «▣ Аналитика по точке»,
выгрузка, солнце, Хафф считают по ней); точек портфеля нет ни на карте, ни в легенде, ни в
слоях; вкладки «Профиль проекта», «Генплан / нормы», «Объекты на карте» скрыты; экран
«Гео: наши проекты» для сотрудников не тронут.

Как устроено: скрытый список `#proj` остался (его читают пять модулей), в нём всегда одна
запись - текущая точка; `syncProjects` в `v420-geo-studio.js` игнорирует присланные проекты;
родитель (`v420-geoanalytics.js`) шлёт `projects: []`. Хук `window.caseGeoSetPoint(lat,lng,name)`
ставит точку (район по границам районов через `distFast`), `window.caseGeoPoint()` её читает,
`window.caseGeoCollectState()` отдаёт пакет сохранения для проверок. Гео-агент вызывает хук из
`set_site` и не дублирует метку. Точка виртуальная (`virtual:true`, `pending` до первого
задания): в `GEO_DATA.projects` не попадает, сохранённые гео-профили уцелевают. «Аналитика по
точке» без точки просит её поставить, а не считает центр города.

Ловушка: встроенный «Новый универсальный проект» из разметки студии нельзя считать выбором
пользователя (это центр города), иначе отчёт «успешно» считается там, где точку не ставили.

### 13.6. CASE Geo Analytics одним файлом (отдельный продукт)

Владелец: «give me geo analytics as a separate product with all functions as an html file».
Сделан сборщик `docs/qa/tools/build_geo_standalone.js`: берёт `os/geoanalytics-studio.html`,
встраивает все модули, границы районов и мастер-геобазу, ставит первым сценарием
`docs/standalone/standalone-shim.js` и меняет шапку на «CASE Geo Analytics». Шим перехватывает
`fetch` и заменяет сервер CASE OS браузером: вход не нужен, мастер-база из файла, POI, здания
и дороги через Overpass напрямую (тот же разбор, что в `gis_proxy.php` и `osm_lib.php`), адрес
через Nominatim, «Связь» из браузера, своей модели нет. Правки живут в localStorage. Результат:
`docs/standalone/CASE_Geo_Analytics.html` (около 4 МБ), открывается с диска и с любого
статического хостинга. Тест `v4732_standalone_build.js` (30): сборка, открытие с диска без
единого запроса к серверу, полностью без сети. Пересобирать при каждом выпуске студии.

Ловушки: экранировать в встроенных скриптах можно только `</script`, а не любое `</` (в модулях
есть регулярные выражения вида `/</g`); приватные переменные модуля (`GEO_POI`) снаружи не видны,
слои читаются через `window.CASE_GEO_POI.rows(k)`; слой с записями из мастер-базы по галочке
не грузится из OSM заново, для проверки брать пустую категорию.

### 13.8. Geo Platform MVP: бизнес-центры одним файлом по брифу владельца

Владелец прислал бриф `geoanalytics_html_mvp_master_prompt.md` (структурированная база БЦ с
происхождением каждого поля, честная аналитика, детерминированный Geo AI, локальный редактор,
EN/RU, без бэкенда) и попросил реализовать его поверх автономной геоаналитики. Сделан второй
продукт `docs/standalone/CASE_Geo_Platform_MVP.html` (около 720 КБ): шаблон
`docs/standalone/src/geo_mvp.template.html`, данные `docs/standalone/data/geo_mvp_data.json`
(148 реальных БЦ из мастер-геобазы с блоками источника и 6 записей DEMO для сценариев по
площади, потому что GLA, заполняемости и свободной площади у реальных записей нет),
сборщик `docs/qa/tools/build_geo_mvp.js`, тест `docs/qa/tools/v4733_geo_mvp.js` (55 проверок:
десять сценариев и восемь тестов ИИ из брифа, редактор, localStorage, RU, телефон).
Подробности, противоречия брифа, ограничения, схема, формулы и архитектура ИИ:
`docs/standalone/GEO_MVP_README.md`. Код CASE OS в `os/` не менялся, версия платформы прежняя.

Ловушки: `\b` в JS не видит кириллицу (проверять концы слов через `(?![a-zа-я])`); панель,
спрятанная `translateX(-102%)` внутри центрального блока, вылезает над левой колонкой,
нужен ещё `visibility:hidden`; при открытой панели ИИ карточку объекта сдвигать левее
(`.center.ai-open`), иначе она под панелью; ссылки на элементы списка устаревают после
перерисовки, поэтому отметки сравнения обновляются на месте.

### 13.9. v4.74.0 - платформа только для геоаналитики

Владелец: «нашу OS заменим полностью только геоаналитическим OS, все остальные функции других
отделов отключим», плюс замечания: вернуть кнопку выбора карт, левую панель сделать как фильтр с
галочками (районы, тепловая карта, объекты по категориям и подкатегориям), больше эргономики.
Сделано (см. `CHANGELOG_CASE_OS_v4.74.0.md`): режим платформы `os/api/mode.php` (`geo`, `config.php`
важнее), сервер режет 15 эндпоинтов, таблицы и ключи состояния других отделов даже админу,
клиент `os/v4740-geo-only.js` строит меню из двух групп и уводит чужие экраны в геоаналитику;
экран «Geo Platform: бизнес-центры» (`os/geo-platform.html`, тот же файл, что автономный MVP);
`os/geo-direct.js` повторяет запросы Overpass и Nominatim из браузера, когда PHP хостинга не
выходит в сеть (общий код с автономным файлом); `os/v4740-geo-tree.js` превращает «Слои и стиль»
студии в дерево с общими галочками, счётчиками, поиском, узлом подложки и кнопкой подложки у
карты; MVP получил дерево слоёв, подложки, тепловые карты, городские объекты по категориям и
исправление подсветки фишек. Данные других отделов в базе не тронуты: `full` в `mode.php`
возвращает всё. Проверки: `v4740_geo_only_api.php`, `v4740_geo_only.js`, `v4740_geo_tree.js`,
`v4733_geo_mvp.js` (64), `v4732_standalone_build.js`; мок-бэкенд отдаёт `mode: full` по умолчанию,
иначе старые проверки других разделов ушли бы в гео-режим.

### 13.7. Что дальше (предложение)

1. Открыть исходящую сеть с сервера (письмо в поддержку хостинга по тексту из «Связи»),
   затем проверить адреса, здания и дороги на боевом сайте.
2. Освободить место на диске хостинга: 1.89 из 1.95 ГБ - риск при любой заливке.
3. Сохранение зон агента в GEO_DATA и выгрузка «паспорта зоны» (PDF) - после обкатки.
4. Изохроны пешком и на транспорте - нужен маршрутизатор, который умеет не только автомобиль.
5. Вторая модель населения (WorldPop) для диапазона «от и до» в ответах агента.
6. Перевод остальных экранов CASE OS на тот же язык карточек, если дизайн студии понравится.
8. Автономный файл CASE Geo Analytics пересобирать при каждом выпуске студии (одна команда,
   см. `docs/standalone/README.md`); решить, нужен ли ему свой хостинг и домен.
7. Если сотрудникам понадобится править гео-профили проектов (файлы, статусы), вернуть вкладку
   «Объекты на карте» только для ролей с правом правки, не показывая её клиентам.

---

## 14. Как пользоваться этим документом

1. Новому разработчику или ИИ: прочитать разделы 1, 3, 4, 11 и 13, затем открыть `os/DEPLOY.md` и
   последний `CHANGELOG_CASE_OS_v4.73.0.md`. Правила раздела 11 обязательны.
2. Перед любой правкой: `node docs/qa/tools/release_invariants.js os` и нужный набор из раздела 7.4;
   после правки - те же наборы плюс новый тест на своё изменение.
3. Владельцу: раздел 8 (хостинг), раздел 10 (что открыто) и 13.7 (что дальше). Архив для хостинга
   всегда без `api/config.php`; при заливке смотреть `ЧИТАТЬ_ПЕРВЫМ.txt`.
4. Документ обновляется вместе с релизом: новая версия - новая запись в разделе 9 и правка
   разделов 3.2, 4.3, 8 при изменении модулей, эндпоинтов и хостинга. Длинных тире в документе нет
   и быть не должно (это проверяет `release_invariants.js` для `*.md` в корне).
