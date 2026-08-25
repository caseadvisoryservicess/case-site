# Визуальный язык: воронка аренды vs воронка Advisory

Карта фактов по коду. Все пути абсолютные, номера строк - на момент чтения.

Файлы:
- Дизайн-система: `/home/user/case-site/case-site/os/v4450-ux-system.js` (284 стр.)
- База (палитра и примитивы, на которые ссылается дизайн-система): `/home/user/case-site/case-site/os/index.html`
- Табличное ядро: `/home/user/case-site/case-site/os/v432-data-grid.js`
- Аренда: `/home/user/case-site/case-site/os/v32-upgrade.js` (532), `/home/user/case-site/case-site/os/v35-stable.js` (488), `/home/user/case-site/case-site/os/v326-commission-engines.js` (314)
- Advisory: `/home/user/case-site/case-site/os/v490-workflow.js` (284), `/home/user/case-site/case-site/os/v492-portfolio-proposals.js` (80), `/home/user/case-site/case-site/os/v493-portfolio-suite.js` (198)

---

## 0. Что задаёт дизайн-система v4450-ux-system.js

Весь CSS системы - в одной функции `injectCSS()`, `v4450-ux-system.js:67-154` (тег `<style id="case4450-css">`).

Переменные и токены:
- `v4450-ux-system.js:68` - `:root{--case-focus:#0b67c2;--case-touch:36px;--case-radius:10px;--case-shadow:0 1px 2px rgba(20,20,20,.05);--case-content-gap:12px}`
- `v4450-ux-system.js:92` - `:root{--case-h:34px;--case-r:9px;--case-gap:8px}`
- Базовая палитра берётся из `index.html:18`: `--red:#9E0000;--red-d:#7a0000;--panel:#fff;--card:#fff;--soft:#faf9f7;--border:#e6e3df;--muted:#6b6b6b;--green:#2e7d32;--amber:#a16000`.

Единая высота кликабельного:
- `v4450-ux-system.js:76` - `.btn,.thbtn,.langbtn,.tabs button,.geo-tabbar button{min-height:34px}` (глобально)
- `v4450-ux-system.js:95-97` - `#main .btn,#main .thbtn,#main .tabs button,#main select,#main input[type="text"],#main input[type="search"],#main input[type="date"],#main input[type="number"]{min-height:var(--case-h)}`; `.btn.sm/.thbtn.sm{min-height:30px}`
- `v4450-ux-system.js:151` - на ≤820px `.btn,.btn.sm,.thbtn,.langbtn,.tabs button,.geo-tabbar button{min-height:44px!important}`

Карточки, заголовки, KPI, табы, пустое состояние:
- `v4450-ux-system.js:77` - `.card,.kpi,.miniobj,.opbox{box-shadow:var(--case-shadow);border-radius:var(--case-radius)}` (10px)
- `v4450-ux-system.js:78` - `.ph{gap:10px;align-items:center}.ph h1{line-height:1.18}.ph>div{margin-left:auto}`
- `v4450-ux-system.js:103-108` - два уровня `.tabs`: второй ряд без «таблетки», активный = красное подчёркивание `inset 0 -2px 0 var(--red-d,#9E0000)`
- `v4450-ux-system.js:111-116` - KPI: `#main .kpi .lab{10px/800/uppercase}`, `#main .kpi .val{26px/800/tabular-nums}`, `.val small{12px}`, `.sub2{10.5px}`
- `v4450-ux-system.js:119-120` - `#main .card>h3{font-size:13.5px;font-weight:800;margin:0 0 10px}`
- `v4450-ux-system.js:123` - пустое состояние: `#main .mut:only-child{display:block;padding:14px 0;text-align:center;color:var(--muted)}`
- `v4450-ux-system.js:130-132` - строка-ссылка: `#main table tbody tr[onclick]{cursor:pointer}` + hover `var(--soft)` + focus-visible
- `v4450-ux-system.js:142` - `.case-ui-readonly` (плашка «Только просмотр»)
- `v4450-ux-system.js:144-146` - типографика таблиц, в т.ч. **явное упоминание всех трёх семейств**: `#main .v32-table thead th,#main .v326-table thead th,#main .case49-table thead th{font-size:10.5px!important}` и `#main .v32-table td,#main .v326-table td,#main .case49-table td{font-size:12px!important}`
- `v4450-ux-system.js:135-141, 149-153` - мобильные брейкпоинты (620/520/820/1200)

Формы: **отдельного описания формы/модалки в дизайн-системе не найдено.** Есть только высоты полей (строка 95-96) и правило видимого фокуса `v4450-ux-system.js:74`. Разметки полей, подписей, обязательности система не задаёт.

Важное ограничение: почти вся содержательная часть системы отскоплена селектором `#main ...` (строки 95-146). Модалки всех модулей монтируются в `document.body` (`v490-workflow.js:77`, `v32-upgrade.js:173-174`, `v326-commission-engines.js:247`), поэтому **внутри модальных окон правила дизайн-системы не применяются вообще**, кроме глобальных строк 74, 76, 77.

Кроме CSS система опирается на разметку `.ph`:
- `v4450-ux-system.js:226` - `markReadonlyRegistry()` ищет `.ph` и вешает в неё плашку
- `v4450-ux-system.js:234-241` - `dashboardMode()` ищет `.ph` и вставляет переключатель «Сводка / Подробно»
- `v4450-ux-system.js:46` - экран «Доступ ограничен» тоже рисуется как `<div class="ph"><h1>…` + `.card`

---

## 1. Заголовок раздела

### Аренда

`v32-upgrade.js:321`:
```js
function pageHead(title,sub,btns){ return '<div class="ph"><h1>'+h(title)+'</h1></div><p class="sub">'+h(sub||'')+'</p>'+(btns?'<div class="v32-tools" style="margin:8px 0 10px"><div></div><div>'+btns+'</div></div>':''); }
```
`v326-commission-engines.js:203`:
```js
function pageHead(title,sub,buttons){return '<div class="ph"><h1>'+h(title)+'</h1></div><p class="sub">'+h(sub)+'</p><div class="v326-tools"><div>'+chips('<span>'+h(t('privacy'))+'</span>')+'</div><div>'+buttons+'</div></div>';}
```
- Разметка: `.ph` + `h1` из базы, подзаголовок - отдельный `<p class="sub">` **вне** `.ph`.
- Размеры: `index.html:134` `.ph h1{font-size:20px;font-weight:700}`; `index.html:135` `.sub{font-size:11px}`.
- Кнопки действий: в **отдельной третьей строке** (`.v32-tools` / `.v326-tools`, флекс `justify-content:space-between`, `v32-upgrade.js:154`, `v326-commission-engines.js:301`), а не внутри `.ph`. Правило системы `.ph>div{margin-left:auto}` (`v4450-ux-system.js:78`) здесь не работает - в `.ph` нет второго `div`.

Третий модуль аренды свой заголовок делает иначе - `v35-stable.js:341`:
```js
'<section class="asaas35-head" data-asaas35-brand-shell="1"><div><div class="eye">БАЗА БРЕНДОВ</div><h1>Бренды</h1><p>Excel-таблица с фильтрами…</p></div><div class="asaas35-stats"><span>КД</span><b id="asaas35-count">…</b></div></section>'
```
- `.ph` не используется; заголовок - карточка с рамкой и тенью (`v35-stable.js:458`: `.asaas35-head{background:var(--panel);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:14px;margin:12px 0}`), `h1` без переопределения размера → браузерный `2em` ≈ 26px при `body{font-size:13px}` (`v4450-ux-system.js:69`). Есть «eyebrow» `.eye` (10px, `--red-d`, uppercase) и счётчик справа.

### Advisory

`v490-workflow.js:56`:
```js
function page(title,sub,body,actions){return '<div class="case49-page"><div class="case49-head"><div><div class="case49-eyebrow">CASE OS · v4.32.6</div><h1>'+E(title)+'</h1>'+(sub?'<p>'+E(sub)+'</p>':'')+'</div><div class="case49-head-actions">'+(actions||'')+'</div></div>'+body+…}
```
`v492-portfolio-proposals.js:25`:
```js
function page(title,sub,body,actions){return '<div class="case492-page"><header class="case492-head"><div><h1>'+E(title)+'</h1><p>'+E(sub||'')+'</p></div><div>'+String(actions||'')+'</div></header>'+body+'</div>';}
```
`v493-portfolio-suite.js:122`:
```js
function page(title,sub,body,actions){return '<div class="case493-page"><header class="case493-head"><div><h1>'+E(title)+'</h1><p>'+E(sub)+'</p></div><div class="case493-head-actions">'+(actions||'')+'</div></header>'+body+…}
```
Размеры (собственные, `.ph` нигде не используется):
- `v490-workflow.js:266` - `.case49-head h1{font-size:27px;letter-spacing:-.025em}`, `.case49-head p{max-width:850px;font-size:12.5px;line-height:1.5}`, `.case49-eyebrow{font-size:9px;letter-spacing:.13em;font-weight:900;color:var(--red-d);uppercase}`
- `v492-portfolio-proposals.js:76` - `.case492-head h1{font-size:28px;letter-spacing:-.03em}`, `p{font-size:12px;max-width:900px}`
- `v493-portfolio-suite.js:193` - `.case493-head h1{font-size:28px;letter-spacing:-.035em}`, `p{font-size:12px;max-width:920px}`

Подзаголовок: есть у всех трёх, **внутри** блока заголовка (в аренде - отдельным `<p class="sub">` после `.ph`).

Кнопки действий: справа в самом заголовке (`.case49-head-actions`, `v490-workflow.js:266`: `display:flex;gap:7px;align-items:center`; `.case493-head-actions{display:flex;gap:7px}`).

Расхождение внутри самого Advisory: «eyebrow» есть только в v490 (`v490-workflow.js:56`, текст жёстко зашит `CASE OS · v4.32.6`). В v492/v493 CSS-правило под eyebrow объявлено (`v492-portfolio-proposals.js:76` `.case492-head>div:first-child>span{…}`; `v493-portfolio-suite.js:193` `.case493-head>div:first-child>span{…}`), но разметка `span` не выводится (строки 25 и 122) - правило мёртвое.

---

## 2. Панель фильтров

### Аренда

- `v32-upgrade.js:336` и `v32-upgrade.js:343` - панель = `<div class="v32-tools">` с **одним** текстовым `<input>` (полнотекстовый поиск по `JSON.stringify(row)`, `v32-upgrade.js:331`) и справа набором информационных «пилюль» `.v32-pill` (не фильтры, а суммы). Селектов-фильтров нет.
  - `v32-upgrade.js:154`: `.v32-tools{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}`; `.v32-tools input{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:8px 9px;font-size:12.5px}` - высота не задана, значит применяется `#main input[type="text"]` из `v4450-ux-system.js:96` **только если атрибут type присутствует**; в разметке `v32-upgrade.js:336` атрибута `type` нет → правило системы не срабатывает.
- `v326-commission-engines.js:203` - панели фильтров нет вообще: в `.v326-tools` слева одна «пилюля» с текстом приватности, справа кнопки.
- `v35-stable.js` - самая сложная панель в аренде, три яруса:
  - `v35-stable.js:342` - `.asaas35-toolbar`: кнопки действий + переключатель вида (`.asaas35-views`: Таблица/Список/Карточки) + пагинатор
  - `v35-stable.js:343` - `.asaas35-search`: grid `minmax(260px,1fr) 220px` - общий поиск + поле «Подходит под м²»
  - `v35-stable.js:344` - `.asaas35-chips`: 8 быстрых чипов (`Все / Мои / Есть запрос / Без контакта / Без площади / Без категории / Требует проверки / Дубли`)
  - плюс **строка фильтров внутри `<thead>`** - `v35-stable.js:290`, 14 полей `filterInput(...)` с `datalist`, и Excel-подобное меню на колонку `v35-stable.js:258` (`.case-grid-menu` с операторами «Содержит / Начинается с / Между / Пусто…»).
  - Стили: `v35-stable.js:458` - все три яруса нарисованы как карточки (`border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:14px;margin:12px 0`); активный чип `.asaas35-chip.on{background:#181818;color:#fff}`, активный вид `.asaas35-view.active{background:#181818!important;color:#fff!important}`.

### Advisory

- `v490-workflow.js:90` (клиенты) - `<div class="case49-toolbar"><div class="case49-search"><span>⌕</span><input …></div><button class="btn">+ Добавить клиента</button></div>`
- `v490-workflow.js:185` (задачи) - самая полная: сегмент `Таблица/Kanban` + `.case49-search` + 3 `<select>` (проект / статус / отдел) + `.case49-spacer` + primary-кнопка. Плюс липкая строка массового выбора `v490-workflow.js:185` → `.case49-selection`.
- `v492-portfolio-proposals.js:30` - `.case492-toolbar`: `<label class="case492-search">⌕ <input …></label>` + 5 `<select>` + `<button class="btn ghost">Сбросить</button>`
- `v493-portfolio-suite.js:127` - `.case493-filter-card`: поиск + 4 `<select>` + «Сбросить» + отдельный ряд цветных чипов стран `.case493-country-row` / `.case493-country-chip` (`v493-portfolio-suite.js:123`)

Стили одного и того же по смыслу элемента - разные в каждом из трёх файлов Advisory:

| элемент | v490 | v492 | v493 |
|---|---|---|---|
| контейнер | `.case49-toolbar{display:flex;gap:8px;flex-wrap:wrap}` - без рамки (`v490-workflow.js:266`) | `.case492-toolbar{display:flex;gap:7px;flex-wrap:wrap}` - без рамки (`:76`) | `.case493-filter-card{display:grid;…;border:1px solid var(--border);border-radius:15px;background:var(--panel);padding:10px}` - **карточка** (`:193`) |
| select | `min-height:38px;border-radius:10px;background:var(--panel);font-size:11px` | `min-height:40px;border-radius:11px;background:var(--panel);font-size:11px` | `min-height:40px;border-radius:10px;background:var(--soft);font-size:10.5px` |
| поле поиска | `.case49-search{min-width:230px;min-height:40px;border-radius:11px;background:var(--panel)}` + `:focus-within{box-shadow:0 0 0 3px rgba(158,0,0,.28)}` | `.case492-search{min-width:280px;border-radius:11px;background:var(--panel)}`, без focus-within | `.case493-search{border-radius:10px;background:var(--soft)}`, без focus-within |

Все три объявленные высоты (38/40/40px) перебиваются дизайн-системой: `#main select{min-height:34px}` (`v4450-ux-system.js:96`) имеет более высокую специфичность (id) - фактическая высота селектов в Advisory 34px, а не 38-40.

Одинаково ли выглядит: **нет** - ни между воронками, ни внутри Advisory.

---

## 3. Карточки KPI и сводные цифры

Дизайн-система описывает KPI через `.kpi .lab` / `.kpi .val` (`v4450-ux-system.js:111-114`) и базовую сетку `index.html:136-137` (`.kpis{grid-template-columns:repeat(4,1fr);gap:13px}`, `.kpi{border-radius:8px;padding:14px 15px}`).

**Ни один из шести модулей эти классы не использует.** У каждого свои:

| модуль | разметка | стиль |
|---|---|---|
| v32 | `v32-upgrade.js:261, 324, 433` - `<div class="v32-kpis"><div class="v32-kpi"><small>подпись</small><b>число</b></div>` | `v32-upgrade.js:153` - `.v32-kpis{grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:9px}`; `.v32-kpi{border-radius:12px;padding:10px;background:var(--soft)}`; `small{font-size:11px}`; `b{font-size:20px}`; модификаторы `.warn b{color:#b56b00}`, `.bad b{color:var(--red-d)}`; кликабельный вариант `.v32-kpi.v32-click` |
| v326 | `v326-commission-engines.js:212-217, 284` - `<div class="v326-kpis"><div class="v326-kpi"><small>…</small><b>…</b></div>` | `v326-commission-engines.js:301` - `.v326-kpis{grid-template-columns:repeat(5,minmax(120px,1fr));gap:9px}`; `.v326-kpi{border-radius:13px;padding:10px;background:var(--soft)}`; `b{font-size:20px}`; `.warn b{color:#a86800}` (у v32 - `#b56b00`) |
| v35 | сводных плиток нет; вместо них счётчик в шапке `v35-stable.js:341` (`.asaas35-stats span,b{border-radius:999px;padding:6px 10px;background:var(--soft)}`) | `v35-stable.js:458` |
| v490 | `v490-workflow.js:104, 167, 177, 189` - `<div class="case49-kpis"><div><b>число</b><span>подпись</span></div>` (**порядок обратный**: число сверху, подпись снизу; без классов у детей) | `v490-workflow.js:268` - `.case49-kpis{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}`; `>div{border-radius:14px;background:var(--panel);padding:15px}`; `b{font-size:23px}`; `span{font-size:10px}`; акцент `.case49-red{color:var(--red)!important}` |
| v492 | `v492-portfolio-proposals.js:31` - `<div class="case492-kpis"><div><b>…</b><span>…</span></div>` | `v492-portfolio-proposals.js:76` - `grid-template-columns:repeat(4,1fr);gap:9px`; `>div{border-radius:14px;background:var(--panel);padding:14px}`; `b{font-size:23px}`; `span{font-size:9.5px}` |
| v493 | `v493-portfolio-suite.js:128` - `<section class="case493-kpis"><div><b>…</b><span>…</span></div>` | `v493-portfolio-suite.js:193` - `grid-template-columns:repeat(5,1fr);gap:8px`; `>div{border-radius:14px;background:var(--panel);padding:12px 14px}`; `b{font-size:22px}`; `span{font-size:9px}` |

Итог по числам: подпись сверху 11px + число 20px на `--soft` (аренда) против числа 22-23px сверху + подписи 9-10px на `--panel` (Advisory). Ни то, ни другое не равно `26px` из `v4450-ux-system.js:112`.

Дополнительные сводные блоки, аналога которым во второй воронке нет:
- Advisory: `v490-workflow.js:125` - `.case49-detail-strip` (4 плитки внутри модалки КП), `v490-workflow.js:167` - `.case49-project-title` + `.case49-hub-grid` (6 плиток-переходов), `v490-workflow.js:207` - `.case49-load-card` / `.case49-week-grid` (ресурсный план)
- Аренда: `v32-upgrade.js:260-261` - `.v32-hub` с плитками `.v32-mini`, `v326-commission-engines.js:285` - `chips()` с параметрами комиссий

---

## 4. Таблицы

Табличное ядро `v432-data-grid.js` подключается **автоматически ко всем `<table>` внутри `#main`** (`v432-data-grid.js:215`: `var root=document.getElementById('main')||document;var tables=root.querySelectorAll('table')`), но с жёстким условием в `v432-data-grid.js:214`:

```js
function enhanceTable(tb,idx){if(!tb||!tb.tHead||!tb.tBodies||!tb.tBodies.length||tb.dataset.cgResizing==='1')return; …}
```

Требуется наличие `<thead>`. Отсюда главный раскол:

| таблица | `<thead>` | ключ | попадает в v432 |
|---|---|---|---|
| `v32-upgrade.js:324, 337, 344, 434, 435, 457, 470, 475, 483` - `<table class="v32-table"><tr><th>…` | **нет** | - | **нет** |
| `v326-commission-engines.js:222, 229, 258, 268, 286, 287, 296` - `<table class="v326-table"><tr><th>…` | **нет** | - | **нет** |
| `v35-stable.js:288` - `<table class="asaas35-table" data-case-grid-key="brands" data-grid-engine="brands"><thead>…` | есть | явный `brands` | **да** |
| `v490-workflow.js:91, 112, 122, 137, 177, 187, 210, 236` - `<div class="card case49-card"><div class="tbl-scroll"><table class="case49-table"><thead>…` | есть | автогенерируемый `view__idx__hash(заголовки)` (`v432-data-grid.js:45-53`) | **да** |
| `v492-portfolio-proposals.js:34` - `<section class="card case492-card"><div class="tbl-scroll"><table class="case492-table"><thead>…` | есть | автогенерируемый | **да** |
| `v493-portfolio-suite.js:137` - `<details class="case493-table-card"><summary>…<div class="tbl-scroll"><table><thead>…` | есть | автогенерируемый | **да** |

Практические последствия для попавших в ядро таблиц (`v432-data-grid.js:214`): добавляется класс `case-grid`, тулбар `.case-grid-toolbar` над таблицей (`v432-data-grid.js:63-65`), ручки изменения ширины `.case-grid-resizer` (`v432-data-grid.js:185`), закрепление колонок, плотность, нативно липкая шапка. Плюс переопределение оформления шапки с `!important`:
```
v432-data-grid.js:71  table.case-grid thead th{position:sticky;top:var(--cg-sticky-top,0px);z-index:8;background:var(--cg-head)!important;color:#625d56;…}
v432-data-grid.js:68  table.case-grid{border-collapse:separate!important;table-layout:fixed!important;…}
v432-data-grid.js:69  table.case-grid th,table.case-grid td{border-right:1px solid var(--cg-line)!important;border-bottom:1px solid var(--cg-line)!important}
```

Собственная разметка таблиц:
- `v32-upgrade.js:154` - `.v32-table{border-collapse:separate;font-size:12px}`; `th,td{border-bottom:1px solid var(--border);padding:9px 8px;vertical-align:top}`; `th{position:sticky;top:0;background:var(--card);font-size:10.5px;uppercase}` - вертикальных линий нет, ячейки без класса вложенной подписи (`.mut` - `font-size:11px`).
- `v326-commission-engines.js:301` - `.v326-table` практически копия `.v32-table` (те же `padding:9px 8px`, `font-size:12px`, `th{font-size:10.5px;uppercase;sticky}`), плюс модификатор `.v326-table.compact{padding:6px}`.
- `v490-workflow.js:269` - `.case49-table{border-collapse:collapse}`; `th{sticky;background:var(--panel);font-size:9.5px;uppercase;letter-spacing:.06em;padding:10px}`; `td{padding:10px;border-top:1px solid var(--border);font-size:11.5px;vertical-align:middle}`; вложенная подпись `.case49-table small{display:block;font-size:9.5px}`; ячейка-ссылка `.case49-link{border:0;background:transparent;color:var(--ink)}:hover{color:var(--red-d)}`.
- `v492-portfolio-proposals.js:76` - `.case492-table th{font-size:9px}`, `td{font-size:10.5px;vertical-align:top}`, `small{font-size:8.5px}`.
- `v493-portfolio-suite.js:137` - таблица без собственного класса, внутри `<details>` (по умолчанию **свёрнута**).

Правило дизайн-системы `v4450-ux-system.js:145` (`#main .v32-table thead th,#main .v326-table thead th,#main .case49-table thead th{font-size:10.5px!important}`) для `.v32-table`/`.v326-table` **не срабатывает**: селектор требует `thead`, которого в этих таблицах нет. Работает только вторая половина, `v4450-ux-system.js:146` (`td{font-size:12px!important}`), - она поднимает шрифт ячеек Advisory с 11.5px до 12px, а `.case492-table td` (10.5px) не трогает, т.к. класс `case492-table` в списке не перечислен.

Обёртка: Advisory всегда `<div class="tbl-scroll">` (v490 × 8 мест, v492:34, v493:137); аренда `tbl-scroll` не использует ни разу - вместо неё `v35-stable.js:458` `.asaas35-table-wrap{overflow-x:auto}` либо вообще ничего (v32/v326). Правила `v4450-ux-system.js:143` и `v4450-ux-system.js:197` (`role="region"`, `aria-label`, `scrollbar-gutter`) действуют только на Advisory и на бренды.

---

## 5. Канбан

- **Advisory:** есть, два канбана в одном модуле.
  - Воронка возможностей: `v490-workflow.js:111` (`pipelineKanban()`), колонки = `PIPE_STAGES`, **12 колонок** (`v490-workflow.js:10-14`: new, contact, discovery, proposal, proposal_sent, negotiation, accepted, contract, signing, won, paused, lost). В `<header>` колонки - название, счётчик + сумма по валютам, кнопка `＋`.
  - Задачи: `v490-workflow.js:188` (`taskKanban()`), колонки = `TASK_STATUSES` минус `cancelled`, **8 колонок** (`v490-workflow.js:15`).
  - Общий CSS обоих: `v490-workflow.js:271` - `.case49-kanban{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity}`; `.case49-kanban-col{flex:0 0 270px;min-height:330px;border-radius:15px;background:var(--soft);padding:8px}`; `.case49-kanban-card{border-radius:12px;background:var(--panel);padding:11px;box-shadow:0 1px 2px rgba(0,0,0,.03)}`, hover `translateY(-1px)` + `border-color:rgba(158,0,0,.3)`.
  - Карточки **разные по составу**: `oppCard()` (`v490-workflow.js:110`) = заголовок + бейдж вероятности, клиент, сумма/ответственный, полоса «следующий шаг» `.case49-next`; карточка задачи (`v490-workflow.js:188`) = заголовок + бейдж приоритета, проект, исполнитель/дата, прогресс-бар `.case49-progress`. У колонок воронки в шапке есть кнопка `＋` (28×28, `v490-workflow.js:271`), у колонок задач - нет.
  - Drag&drop: `ondragstart/ondrop` в обоих (`v490-workflow.js:110-111, 188`).
- **Аренда:** канбана **не найдено**. В `v32-upgrade.js`, `v35-stable.js`, `v326-commission-engines.js` нет ни разметки, ни CSS канбана. Единственное упоминание - текст подсказки в `v326-commission-engines.js:222` («Создано автоматически из канбана»), ссылающийся на внешний источник данных.
- Переключателя представлений в аренде тоже почти нет: только `v35-stable.js:342` `.asaas35-views` (Таблица / Список / Карточки) и самодельные табы `v32-upgrade.js:318-319`.

---

## 6. Кнопки

Оба контура используют базовый `.btn` из `index.html:179-180`:
`.btn{background:var(--red);color:#fff;border:none;padding:9px 15px;border-radius:9px;font-weight:600;font-size:13px}`, `.btn.ghost{background:#fff;color:#333;border:1px solid var(--border)}`, `.btn.sm{padding:6px 11px;font-size:12px}`.

Различия:

| | Аренда | Advisory |
|---|---|---|
| место главной кнопки | в третьей строке-панели, **первой слева** в правой группе: `v32-upgrade.js:335` `'<button class="btn">+ Добавить инвесторский лид</button> <button class="btn ghost">…'`; `v326-commission-engines.js:224, 288` - то же | в заголовке (`.case49-head-actions`) или в правом конце тулбара через распорку `.case49-spacer{flex:1}`: `v490-workflow.js:106, 122, 137, 177, 185, 210, 236` |
| разделитель кнопок | пробел в строке (`' '`), `v32-upgrade.js:335`, `v326-commission-engines.js:224` | `gap` во флексе: `.case49-head-actions{gap:7px}`, `.case49-toolbar{gap:8px}` (`v490-workflow.js:266`) |
| кнопки в строке таблицы | 1-3 шт. `btn ghost sm`, без обёртки: `v32-upgrade.js:337, 344, 434` | 2-4 шт. `btn ghost sm` в обёртке `.case49-row-actions{display:flex;gap:5px;flex-wrap:wrap}` (`v490-workflow.js:121, 137, 269`) |
| порядок в модалке | `Отмена (btn ghost)` → `Сохранить (btn)`, справа: `v32-upgrade.js:467, 473, 479`; `v326-commission-engines.js:290, 292` (`.v326-actions{justify-content:flex-end}`) | тот же порядок: `v490-workflow.js:95, 117, 123, 132, 139` (`.case49-modal-foot{justify-content:flex-end}`) |
| «третья» кнопка в модалке | нет | есть, между Отмена и Сохранить: `v490-workflow.js:117` (`Создать КП`), `v490-workflow.js:128` (`Изменить КП` + `Создать договор`), `v490-workflow.js:132` (`Исключить`, класс `btn ghost danger`) |
| нестандартные кнопки | самодельные табы с инлайновым стилем `v32-upgrade.js:318` (`padding:7px 14px;border-radius:9px;background:var(--red-d,#a3132a)`), чипы `.asaas35-chip` (`v35-stable.js:458`, `padding:7px 12px;border-radius:999px`) | сегмент `.case49-segment button{min-height:34px;border-radius:8px;padding:6px 13px;font-size:11px}` (`v490-workflow.js:267`), иконочная `.case49-icon-btn{min-width:34px;height:34px;border-radius:10px}` (`v490-workflow.js:272`), кнопка в шапке колонки канбана 28×28 (`v490-workflow.js:271`), чипы стран `.case493-country-chip` (`v493-portfolio-suite.js:193`), карточки-пакеты `.case492-package` (`v492-portfolio-proposals.js:76`) |

Отдельно: `v32-upgrade.js:318` задаёт красный `var(--red-d,#a3132a)` - фолбэк `#a3132a` не совпадает ни с `--red:#9E0000`, ни с `--red-d:#7a0000` (`index.html:18`), ни с фолбэком `#9E0000`, который использует дизайн-система (`v4450-ux-system.js:107-108`).

Мобильная цель 44px (`v4450-ux-system.js:151`) перечисляет только `.btn,.btn.sm,.thbtn,.langbtn,.tabs button,.geo-tabbar button`. Не попадают: `.case49-segment button`, `.case49-icon-btn`, кнопка колонки канбана, `.asaas35-chip`, `.asaas35-view`, самодельные табы `v32-upgrade.js:318`, `.case493-country-chip`, `.case492-package`.

---

## 7. Бейджи статусов

### Advisory - есть единая фабрика

```js
v490-workflow.js:58  function badge(text,cls){return '<span class="case49-badge '+(cls||'')+'">'+E(text)+'</span>';}
v490-workflow.js:65  function statusClass(status){if(['done','accepted','signed','active','final','won','approved','approved_internal'].indexOf(status)>=0)return 'ok';if(['lost','rejected','terminated','cancelled','changes'].indexOf(status)>=0)return 'bad';if(['blocked','expired'].indexOf(status)>=0)return 'warn';return '';}
v490-workflow.js:66  function deadlineClass(v,status){…return d<0?'late':d<=3?'soon':'';}
```
Цвета - жёстко зашитые hex в `v490-workflow.js:269`:
```
.case49-badge{border:1px solid var(--border);border-radius:999px;padding:3px 7px;background:var(--soft);color:var(--muted);font-size:9px;font-weight:900;min-height:22px}
.case49-badge.ok{background:#e8f6eb;color:#23683a;border-color:#b9dec2}
.case49-badge.warn{background:#fff5d8;color:#8b6500;border-color:#ead494}
.case49-badge.bad{background:#fde9e9;color:#9e0000;border-color:#efbcbc}
```
Плюс дедлайновые `.late{color:#a40000!important}` / `.soon{color:#8b6500!important}` и рамки карточек `.case49-kanban-card.late{border-color:#d78a8a}` (`v490-workflow.js:271`), точка статуса `.case49-dot.ok{#329550}/.warn{#d29b13}/.bad{#bb2929}` (`v490-workflow.js:274`) - **третий набор** зелёного/жёлтого/красного в том же файле.

Свои варианты в v492/v493:
- `v492-portfolio-proposals.js:76` - `.case492-status.ok{background:#e6f5ea;color:#25683c}`, `.warn{background:#fff2c9;color:#7b5900}` (снова другие hex)
- `v493-portfolio-suite.js:193` - `.case493-coordinate` с `ok/warn`

Ни один из наборов не совпадает с базовым `index.html:251`: `.sev.red{background:#fdeaea;color:var(--red-d)}`, `.sev.amber{background:#fff3e0;color:var(--amber)}`, `.sev.green{background:#e7f4e8;color:var(--green)}`.

### Аренда - цветных бейджей статуса нет

- `v32-upgrade.js:330` - `function stageLabel(s){var m={new:'New',matching:'Matching',offer:'Offer',won:'Won',lost:'Lost',lead:'Lead',nda:'NDA',dd:'DD',spa:'SPA',closed:'Closed',active:'Active'}; return m[s]||s||'-'; }` - возвращает **простой английский текст без обёртки и без класса**; в таблицах выводится как `<td>`+текст (`v32-upgrade.js:337, 344, 434`).
- `.v32-pill` (`v32-upgrade.js:154`) окрашивает только текст: `.v32-pill.good{color:var(--green)}`, `.v32-pill.bad{color:var(--red-d)}`; фон всегда `var(--soft)`.
- `v326-commission-engines.js:301` - `.v326-ok{color:var(--green);font-weight:900}`, `.v326-bad{color:var(--red-d);font-weight:900}` - цветной глиф `✓` / `!` без плашки (`v326-commission-engines.js:222, 287`); статус оплаты выводится сырой строкой `d.paymentStatus||d.stage||'pending'`.
- `v35-stable.js:266` - статус бренда: `<td class="status"><span title="Активный">Акт</span></td>`, сокращение из `v35-stable.js:175-177`, **без цвета**; в карточном виде - нейтральная плашка `.asaas35-card .badge{background:var(--soft);border:1px solid var(--border)}` (`v35-stable.js:458`).

---

## 8. Формы и модальные окна

### Аренда

- Модалка v32: `v32-upgrade.js:173-176`
  ```js
  m.innerHTML='<div class="v32-modal-box"><button class="v32-modal-close" type="button">×</button><div class="v32-eyebrow">CASE OS v4.9.3</div><h3 style="margin:4px 0 8px;color:var(--ink)">'+h(title)+'</h3><div>'+body+'</div>'+(actions?'<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">'+actions+'</div>':'')+'</div>';
  ```
  Стиль `v32-upgrade.js:155`: `.v32-modal{background:rgba(0,0,0,.48)}` (без размытия), `.v32-modal-box{max-width:720px;border-radius:18px;padding:18px;max-height:88vh}`; крестик - абсолютом в углу.
- Модалка v326: `v326-commission-engines.js:247`, стиль `v326-commission-engines.js:301`: `.v326-modal-box{max-width:980px;border-radius:18px;padding:18px}`, футер `.v326-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}` - **без разделительной линии**.
- Поля: `v32-upgrade.js:461-463`
  ```js
  function formInput(label,idv,value,type){ return '<label>'+h(label)+'</label><input id="'+idv+'" type="'+(type||'text')+'" value="'+h(value||'')+'">'; }
  ```
  Подпись - **отдельный `<label>` перед полем**, не обёртка. Стиль `v32-upgrade.js:154`: `.v32-form label{display:block;font-size:11px;font-weight:700;color:var(--muted);margin:8px 0 4px}`; `.v32-form input,select,textarea{border-radius:10px;padding:8px 9px;font-size:12.5px;background:var(--card)}` - **высота не задана** (фактическая ≈34px по паддингу); `textarea{min-height:70px}`.
- Раскладка: жёсткие ряды `.v32-row2{1fr 1fr}` / `.v32-row3{1fr 1fr 1fr}` (`v32-upgrade.js:154`), у v326 ещё `.v326-row4{repeat(4,1fr)}` (`v326-commission-engines.js:301`). Пример: `v32-upgrade.js:467` - форма заявки бренда собрана из `row2 + row3 + row3 + row3 + одиночные поля`.
- Обязательные поля: маркировки (`*`) нет; в HTML атрибут `required` встречается 9 раз в v32 и 6 раз в v326. Ошибки показываются **у поля**: `v32-upgrade.js:488-489` - `showFieldError()` вешает класс `.case-invalid` и вставляет блок `.case-field-error` после поля; стиль `v32-upgrade.js:157`: `.case-invalid{border-color:#d33!important;box-shadow:0 0 0 3px rgba(211,51,51,.14)!important}`. У v326 - `v326-commission-engines.js:260`: `fieldWarn()` ставит `.v326-invalid` (`border-color:#b40000!important`), фокусирует поле и дополнительно вызывает `alert()`.

### Advisory

- Модалка: `v490-workflow.js:77`
  ```js
  wrap.innerHTML='<div class="case49-modal '+(wide?'wide':'')+'" role="dialog" aria-modal="true"><div class="case49-modal-head"><div><div class="case49-eyebrow">CASE OS</div><h2>'+E(title)+'</h2></div><button class="case49-icon-btn" onclick="case49CloseModal()" aria-label="Закрыть">×</button></div><div class="case49-modal-body">'+body+'</div><div class="case49-modal-foot">'+(footer||…)+'</div></div>';
  ```
  Стиль `v490-workflow.js:272`: `.case49-modal-wrap{background:rgba(25,22,18,.38);backdrop-filter:blur(8px)}`, `.case49-modal{width:min(720px,96vw);border-radius:20px;max-height:92vh;animation:case49In .18s}`, `.wide{width:min(1040px,97vw)}`; шапка и футер - отдельные полосы с разделителями (`padding:16px 18px;border-bottom/1px`), тело `padding:18px;overflow:auto`. Есть `role="dialog"`/`aria-modal`, автофокус первого поля, закрытие по клику на подложку и по Escape (`v490-workflow.js:282`), блокировка прокрутки `.case49-modal-open{overflow:hidden}`.
- Поля: `v490-workflow.js:78-80`
  ```js
  function field(labelText,id,value,type,extra){return '<label class="case49-field"><span>'+E(labelText)+'</span><input id="'+id+'" type="'+(type||'text')+'" value="'+E(value||'')+'" '+(extra||'')+'></label>';}
  function textField(labelText,id,value,rows){return '<label class="case49-field full">…<textarea …></label>';}
  ```
  Подпись - **`<span>` внутри `<label>`-обёртки**. Стиль `v490-workflow.js:272`: `.case49-field>span{font-size:9.5px;color:var(--muted);font-weight:800}`; `.case49-field input,select,textarea{min-height:42px;border-radius:11px;background:var(--soft);padding:9px 11px;font-size:12px}`; `textarea{min-height:82px}`; свой фокус `outline:2px solid rgba(158,0,0,.15);border-color:var(--red)`.
- Раскладка: одна сетка на все формы - `.case49-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}` + модификатор `.full{grid-column:1/-1}` (`v490-workflow.js:272`). Жёстких «рядов по 3/4» нет.
- Обязательные поля: атрибут `required` - **0 вхождений**; визуальной маркировки нет. Проверка - 17 вызовов `alert()` (`v490-workflow.js:96, 118, 133, 179, 180, …`), например `v490-workflow.js:96`: `if(!name){alert('Укажите название клиента.');return;}`. Подсветки поля нет.
- Форма-конструктор КП живёт по третьим правилам: `v492-portfolio-proposals.js:55-58` - `.case492-section` (`border-radius:17px;padding:16px`), нумерованные шаги `.case492-section-head>div>span{25×25;background:var(--red);color:#fff}`, `.case492-form-grid label{display:grid;gap:5px;font-size:9.5px}`, поля `min-height:42px;border-radius:11px;background:var(--soft)` (`v492-portfolio-proposals.js:76`). Своя модалка `.case492-modal-wrap` (`v492-portfolio-proposals.js:38`, стиль `:76`) - `width:min(520px,96vw);border-radius:20px`, подписи `.case492-modal-body label{display:grid;gap:5px;font-size:10px}`, поля **без** `min-height`.
- Ещё одна модалка - `v493-portfolio-suite.js` (`.case493-modal-body`, упоминается в медиазапросе `v493-portfolio-suite.js:194`).

Итого: два разных способа привязки подписи к полю (соседний `<label>` vs `<label>`-обёртка со `<span>`), три размера подписи (11 / 9.5 / 10px), высота поля не задана (аренда) vs 42px (Advisory), обязательность нигде не показана, ошибки - у поля (аренда) vs `alert()` (Advisory).

---

## 9. Пустые состояния

| модуль | вызов | что показывается |
|---|---|---|
| v32 | `v32-upgrade.js:324, 337, 344, 361, 364, 379, 434, 435, 457, 470, 475, 483` - `'<div class="v32-empty">'+h(tr('noRows'))+'</div>'` | одна строка текста; `v32-upgrade.js:159`: `.v32-empty{padding:24px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:14px;background:var(--soft)}`. Без иконки, без заголовка, без кнопки (исключение - `v32-upgrade.js:361`, где внутрь `.v32-empty` добавлена кнопка «Настройки объекта») |
| v326 | `v326-commission-engines.js:222, 229, 286, 287` - `'<div class="v326-empty">'+h(t('noRows'))+'</div>'` | то же; `v326-commission-engines.js:301`: `.v326-empty{border:1px dashed var(--border);border-radius:13px;padding:22px;text-align:center;background:var(--soft)}` |
| v35 | `v35-stable.js:280` - `'<tr><td colspan="15" class="empty">Нет записей по фильтрам</td></tr>'`; `v35-stable.js:286-287` - `'<div class="empty">Нет записей по фильтрам</div>'` | строка внутри таблицы; `v35-stable.js:458`: `.asaas35-table .empty{text-align:center;color:var(--muted);padding:24px}` - рамки нет |
| v490 | `v490-workflow.js:57` - `function empty(icon,title,text,button){return '<div class="case49-empty"><div class="case49-empty-icon">'+icon+'</div><h3>'+E(title)+'</h3><p>'+E(text)+'</p>'+(button||'')+'</div>';}` | иконка-глиф + заголовок + абзац-объяснение + кнопка действия. `v490-workflow.js:270`: `.case49-empty{min-height:260px;border:1px dashed var(--border);border-radius:18px;background:linear-gradient(135deg,var(--panel),var(--soft));padding:35px}`, `.case49-empty-icon{font-size:35px;color:var(--red-d)}`, `p{max-width:580px;font-size:12px;line-height:1.55}` |
| | использование v490 | `:91` (`◉` Клиентов пока нет + «Добавить первого клиента»), `:111` (`⇢`), `:122` (`▧`), `:126` (`☷`), `:137` (`▣`), `:167`/`:171` (`◆`, `✓`), `:176-178` (`☷`, `◎`), `:189` (`✓`), `:207` (`◫`), `:210` (`▤`), `:236` (`▧`) |
| v492 | пустого состояния **не найдено** - при 0 строк выводится пустой `<tbody>` (`v492-portfolio-proposals.js:34`); для карты есть заглушка `.case492-map-empty` (`:33, :36, :76`) |
| v493 | `v493-portfolio-suite.js:129` - `'<div class="case493-no-results">По выбранным фильтрам проектов нет.</div>'`; `v493-portfolio-suite.js:193`: `.case493-no-results{padding:28px 18px;color:var(--muted);font-size:10px}` - только текст, без рамки и кнопки |

Правило дизайн-системы `v4450-ux-system.js:123` (`#main .mut:only-child`) не задействовано ни одним из шести модулей - все делают свои блоки.

---

## 10. Собственный CSS каждого модуля и конфликты

| файл | тег стиля | префикс | объявлено вне префикса |
|---|---|---|---|
| `v4450-ux-system.js:67` | `#case4450-css` | `.case-*` | `:root` (стр. 68, 92), `body`, `.btn/.thbtn/.tabs button` (76), `.card,.kpi,.miniobj,.opbox` (77), `.ph` (78), `.tbl-scroll` (143), `#main table…` (130-132, 144-146), `#toTop,.quizpop-badge,#chatFab` (126) |
| `v32-upgrade.js:162` | `#case-v32-style` | `.v32-*` | **`.case-invalid`, `.case-field-error`** (стр. 157) |
| `v35-stable.js:458` | `#asaas35-css` | `.asaas35-*` | **`.foot-note`, `.draft-note`, `.form-actions`, `.form-actions .danger`, `.form-section`, `.gis-grid`** |
| `v326-commission-engines.js:302` | `#case-v326-style` | `.v326-*` | нет (всё под префиксом) |
| `v490-workflow.js:264` | `#case49css` | `.case49-*` | **`.late`, `.soon`, `.danger`** (стр. 271, 277) + `:root{--case49-radius:14px;--case49-shadow:…}` (стр. 265) |
| `v492-portfolio-proposals.js:75` | `#case492css` | `.case492-*` | нет |
| `v493-portfolio-suite.js:192` | `#case493PortfolioCss` | `.case493-*` | нет |
| `v432-data-grid.js:61` | `#caseGridCss4325` | `.case-grid-*` / `table.case-grid` | `:root` (стр. 62), `.tbl-scroll,.geo-table-wrap,.geo-obj-tblwrap` (стр. 66) |

Прямые конфликты, найденные в коде:

1. **`.danger`** объявлен дважды:
   - `v35-stable.js:458` - `.form-actions .danger{margin-left:auto;border-color:#c87;color:#c66}`
   - `v490-workflow.js:277` - `.danger{color:#a40000!important;border-color:#e6b0b0!important}`
   Модуль Advisory перебивает кнопку удаления в форме бренда через `!important`, хотя используется только в `v490-workflow.js:132` (`btn ghost danger`).
2. **`.late` / `.soon`** - общие имена без префикса (`v490-workflow.js:271`), с `!important`, применяются к любому элементу с таким классом на странице.
3. **Радиус карточки**: `v4450-ux-system.js:77` даёт `.card{border-radius:10px}`, а `v490-workflow.js:269` возвращает `.case49-card{border-radius:14px!important}` и `v492-portfolio-proposals.js:76` - `.case492-card{border-radius:15px!important}`. Обе Advisory-карточки объявлены как `class="card case49-card"` / `class="card case492-card"` (`v490-workflow.js:91` и др., `v492-portfolio-proposals.js:34`), то есть намеренно перебивают систему.
4. **Высота селектов**: `v4450-ux-system.js:96` `#main select{min-height:34px}` перебивает по специфичности `.case49-toolbar select{min-height:38px}` (`v490-workflow.js:266`), `.case492-toolbar select{min-height:40px}` (`:76`), `.case493-filter-card select{min-height:40px}` (`:193`). Advisory рисует контролы «в расчёте на 38-40px», а получает 34px.
5. **Шапка таблицы**: `v490-workflow.js:269` `.case49-table th{background:var(--panel);color:var(--muted)}` перебивается `v432-data-grid.js:71` `table.case-grid thead th{background:var(--cg-head)!important;color:#625d56}` - но только для тех таблиц, которые попали в ядро (см. п. 4).
6. **Дублирующиеся цвета семафора** в одном проекте: `index.html:251` (`.sev.*`), `v490-workflow.js:269` (`.case49-badge.*`), `v490-workflow.js:274` (`.case49-dot.*`), `v492-portfolio-proposals.js:76` (`.case492-status.*`), `v32-upgrade.js:153` (`.v32-kpi.warn b{#b56b00}`), `v326-commission-engines.js:301` (`.v326-kpi.warn b{#a86800}`) - шесть разных наборов зелёного/жёлтого/красного.
7. **Мёртвый CSS**: `.case492-head>div:first-child>span` (`v492-portfolio-proposals.js:76`) и `.case493-head>div:first-child>span` (`v493-portfolio-suite.js:193`) - соответствующий `<span>` в разметке (`:25`, `:122`) не выводится.

---

## Главный вывод: конкретные расхождения

1. **Заголовок раздела построен на разных примитивах.** Аренда: `.ph` + `<h1>` 20px + отдельный `<p class="sub">` 11px (`v32-upgrade.js:321`, `v326-commission-engines.js:203`). Advisory: `.case49-head` / `.case492-head` / `.case493-head` c `<h1>` 27-28px и подзаголовком внутри (`v490-workflow.js:56, 266`; `v492-portfolio-proposals.js:25, 76`; `v493-portfolio-suite.js:122, 193`). Заголовок Advisory на 7-8px крупнее и с отрицательным трекингом.
2. **Кнопки действий стоят в разных местах.** Аренда - в отдельной третьей строке (`.v32-tools` / `.v326-tools`), Advisory - в правой части самого заголовка (`.case49-head-actions`) или в конце тулбара через `.case49-spacer`.
3. **Из-за отсутствия `.ph` в Advisory не работают механики дизайн-системы**: плашка «Только просмотр» (`v4450-ux-system.js:226`), переключатель «Сводка / Подробно» (`v4450-ux-system.js:234-241`), выравнивание группы действий (`v4450-ux-system.js:78`) и мобильное правило `#main .ph .btn{flex:1 1 auto}` (`v4450-ux-system.js:140`).
4. **Таблицы аренды выпадают из общего табличного ядра.** `v32-upgrade.js` и `v326-commission-engines.js` строят `<table><tr><th>` без `<thead>` (`v32-upgrade.js:337, 344, 434`; `v326-commission-engines.js:222, 286, 287`), а `v432-data-grid.js:214` требует `tb.tHead`. Следствие: у аренды нет тулбара таблицы, изменения ширины колонок, закрепления, вертикальных линий и липкой шапки ядра - а у Advisory (`v490/v492/v493`) и у Базы брендов (`v35-stable.js:288`) всё это есть. Это самое заметное различие «на глаз».
5. **По той же причине не работает половина правила унификации типографики.** `v4450-ux-system.js:145` явно перечисляет `.v32-table thead th` и `.v326-table thead th`, но селектор не находит `thead` - правило мёртвое для аренды.
6. **KPI-плитки перевёрнуты друг относительно друга.** Аренда: подпись 11px сверху, число 20px снизу, фон `--soft`, радиус 12-13px (`v32-upgrade.js:153`, `v326-commission-engines.js:301`). Advisory: число 22-23px сверху, подпись 9-10px снизу, фон `--panel`, радиус 14px (`v490-workflow.js:268`, `v492-portfolio-proposals.js:76`, `v493-portfolio-suite.js:193`). Ни один вариант не использует `.kpi .lab` / `.kpi .val` из `v4450-ux-system.js:111-113` (число 26px).
7. **Статус: цветная плашка против сырого текста.** Advisory - фабрика `badge()` + `statusClass()` с тремя фоновыми цветами (`v490-workflow.js:58, 65, 269`). Аренда - английский текст без обёртки (`v32-upgrade.js:330`), сокращение без цвета (`v35-stable.js:266`) или цветной глиф без плашки (`v326-commission-engines.js:301`).
8. **Канбан есть только в Advisory** (`v490-workflow.js:111` - 12 колонок, `v490-workflow.js:188` - 8 колонок, стиль `v490-workflow.js:271`). В аренде канбана нет ни в одном из трёх файлов.
9. **Панель фильтров несопоставима.** Аренда: v326 - фильтров нет; v32 - один текстовый поиск; v35 - четыре яруса фильтров плюс Excel-меню на колонку (`v35-stable.js:258, 290, 342-344`). Advisory: поиск + 3-5 селектов, но в трёх разных оболочках (без рамки в v490/v492, карточка с рамкой в v493).
10. **Формы описаны двумя разными способами.** Подпись соседним `<label>` 11px и ряды `row2/row3/row4` (`v32-upgrade.js:461-463, 154`; `v326-commission-engines.js:301`) против `<label class="case49-field"><span>` 9.5px и единой сетки `repeat(2,1fr)` с `.full` (`v490-workflow.js:78-80, 272`). Высота поля: не задана (аренда, ≈34px) против 42px (Advisory).
11. **Обязательность полей нигде не показана визуально**, но обрабатывается по-разному: аренда подсвечивает поле и вставляет сообщение рядом (`v32-upgrade.js:488-489`, `v326-commission-engines.js:260`), Advisory использует 17 `alert()` (`v490-workflow.js:96, 118, 133, 179…`) и ни одного `required`.
12. **Модалки разного веса.** `.v32-modal` / `.v326-modal` - подложка `rgba(0,0,0,.48)` без размытия, коробка `padding:18px`, крестик абсолютом, футер - инлайновый флекс (`v32-upgrade.js:155, 174`; `v326-commission-engines.js:301`). `.case49-modal` - подложка с `backdrop-filter:blur(8px)`, размеченные шапка/тело/футер с разделителями, `border-radius:20px`, анимация входа, `role="dialog"`, Escape и автофокус (`v490-workflow.js:77, 272, 282`).
13. **Пустые состояния разного класса.** Аренда - одна строка в пунктирной рамке (`v32-upgrade.js:159`, `v326-commission-engines.js:301`) или строка в таблице (`v35-stable.js:280`). Advisory (v490) - иконка + заголовок + абзац + кнопка на 260px высоты (`v490-workflow.js:57, 270`). При этом v492 пустого состояния не имеет вовсе, а v493 показывает голый текст 10px (`v493-portfolio-suite.js:129`).
14. **Красный цвет расходится:** база `--red:#9E0000` / `--red-d:#7a0000` (`index.html:18`), дизайн-система подставляет фолбэк `#9E0000` (`v4450-ux-system.js:107-108`), бейдж Advisory зашивает `#9e0000` (`v490-workflow.js:269`), а самодельные табы аренды - `#a3132a` (`v32-upgrade.js:318`).

### Какой вариант ближе к v4450-ux-system

**Ближе - воронка аренды (v32/v326)**, и ровно по трём пунктам, которые дизайн-система задаёт явно:

- она использует именно те примитивы, вокруг которых написана система: `.ph` + `<h1>` + `<p class="sub">` (`v32-upgrade.js:321`, `v326-commission-engines.js:203`) - то же, что система рисует сама в `v4450-ux-system.js:46`, и то, что она ищет в `v4450-ux-system.js:226` и `:234`;
- её классы таблиц (`.v32-table`, `.v326-table`) поимённо перечислены в системе (`v4450-ux-system.js:145-146`) наравне с `.case49-table` - то есть система считает их «своими»;
- она не пытается перебивать системные значения через `!important` (у v326 весь CSS под префиксом, вне-префиксных объявлений нет вообще).

**Advisory ближе к системе по всему остальному** и одновременно дальше по букве:

- соответствует духу `v4450-ux-system.js:70-91` (единая высота, одно активное состояние, тише подпись - громче число) заметно лучше: единая фабрика бейджей, единая фабрика пустых состояний, единая форма-сетка, `tbl-scroll` на всех таблицах, `role="dialog"` и Escape;
- но при этом ставит собственный слой поверх системы: `.case49-card{border-radius:14px!important}` (`v490-workflow.js:269`) против `--case-radius:10px`, `.case492-card{15px!important}`, свои токены `:root{--case49-radius}` (`v490-workflow.js:265`), заголовок 27-28px вместо 20px, KPI 22-23px вместо 26px, и полный отказ от `.ph`, `.kpi`, `.tabs`.

Практический смысл: **аренда «совместима» с системой, Advisory «параллельна» ей.** Ни один из шести модулей не использует `.kpi .lab/.val`, `.tabs` и `#main .mut:only-child` - то есть три из шести подсистем `v4450-ux-system.js` (KPI, двухуровневые табы, пустое состояние) не применяются ни в одной из двух воронок.
