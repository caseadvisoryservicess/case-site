# CASE OS - конвенции добавления нового модуля

Материал собран только по файлам репозитория `/home/user/case-site/case-site`.
Состояние рабочего дерева на момент разбора: `APP_VERSION='4.66.0'`, последний добавленный
модуль - `v4660-uz-translit.js` (он же лучший свежий образец «как добавляют файл модуля»).

---

## 1. Объявление нового раздела

### 1.1. Каталог модулей - `/home/user/case-site/case-site/os/v3520-workspaces.js`

Массив `MODULES` - строки 9-108. Формат записи (строка 10):

```js
{v:'dash',g:'mywork',icon:'▦',ru:'Главный экран',uz:'Bosh ekran',en:'Home',nav:true},
```

Поля:

| поле | что делает | где читается |
|---|---|---|
| `v` | идентификатор view (он же значение `S.view`) | `ALL` (строка 123), `canOpen` (193), `buildNav` (203-218) |
| `g` | ключ группы из `GROUPS` | `buildNav` (207), `moduleButtons` (233-241) |
| `icon` | один символ/эмодзи, выводится как есть, без экранирования (строка 213: `'<span class="ic">'+m.icon+'</span>'`) | меню, админ-карточка |
| `ru` / `uz` / `en` | подпись раздела на трёх языках | `tx(o)` - строка 162: `return o[lang()]||o.ru||''` |
| `nav` | `true` → пункт попадает в боковое меню; `false` → внутренний экран, открывается только из кода | `buildNav` (208), `NAV_ORDER` (129), `window.CASE_NAV_TITLE` (158) |
| `future` | `true` → «дорожная карта», из меню исключается (строка 208), в админ-карточке рисуется пунктиром с меткой `план` (236, 239) | `buildNav`, `moduleButtons` |

Порядок в массиве значим: `NAV_ORDER` (строка 129) = порядок пунктов `nav:true`,
и `firstAllowed()` (строка 194) выбирает первый доступный раздел именно по этому порядку.

Ближайший по смыслу существующий раздел - «Конструктор КП», строка 27:

```js
{v:'advisory_proposal_builder',g:'advisory',icon:'✎',ru:'Конструктор КП',uz:'TK konstruktori',en:'Proposal builder',nav:true},
```

и «Реестр КП», строка 28:

```js
{v:'advisory_proposals',g:'advisory',icon:'▧',ru:'Реестр КП',uz:'TK reyestri',en:'Commercial proposals',nav:true},
```

### 1.2. Группы - `GROUPS` (строки 110-121) и `GROUP_ORDER` (строка 122)

```js
var GROUPS={
  mywork:{ru:'Работа и проекты',uz:'Ish va loyihalar',en:'Work & projects'},
  ...
  advisory:{ru:'Консалтинг (Advisory)',uz:'Konsalting (Advisory)',en:'Advisory'},
  ...
};
var GROUP_ORDER=['mywork','projects','advisory','leasing','property','finance','data','products','team','admin'];
```

Группа `data` (строка 116) - единственная в этом файле с апострофом U+2019:
`uz:'Ma’lumot va tahlil'`.
Группа `leasing` (строка 114): `uz:'Ijara va sotuv (Leasing & Sales)'`.

`GROUP_ORDER` задаёт порядок групп и в меню (строка 207), и в админ-карточке (233).
Новая группа = правка обоих объектов; новый модуль в существующей группе группы не трогает.

### 1.3. Производные списки в том же файле, которые надо держать в голове

- `ALL` (123) - `MODULES.map(m=>m.v)`; `uniq()` (169) выбрасывает всё, чего нет в `ALL`,
  поэтому view, не попавший в каталог, невозможно назначить роли.
- `ADMIN_ONLY_VIEWS` (128) - `['users','admin_modules','admin_system']`.
- `CURRENT_CORE` (131) - список «уже реализованных» разделов; в коде ниже он **не используется**
  (объявлен и не читается - проверено grep-ом по файлу).
- `DEFAULTS` (132-146) - рекомендуемые наборы разделов по ролям:
  `ASH/CFO/ADM` = `ALL.slice()` (134), `DIR` = `ALL` минус `ADMIN_ONLY_VIEWS` (138),
  остальные (`BA`, `AG`, `AGX`, `HO`, `BSH`, `HM`, `BRJ`) - явные массивы (139-145).
  Новый модуль автоматически попадает только к `ASH/CFO/ADM/DIR`; в `BA/HM/BSH` его надо дописать руками.
- `hardAllowed` (170) - жёсткая граница только для `AGX` и `BRJ`.
- `migrateWorkspaceSchema()` (298-329) - одноразовая доливка `DEFAULTS` в сохранённые
  шаблоны ролей; версия схемы `st.__caseSchema=4450` (строки 301, 327). Если новый раздел
  должен появиться у ролей, которым шаблон уже сохранён в базе, номер схемы придётся поднять.

### 1.4. Белый список `validViews` - `/home/user/case-site/case-site/os/core.js:1144`

Объявлен внутри функции (строка 1144), рядом:

```
1145: window.CASE_VALID_VIEWS=validViews;
1146: if(validViews.indexOf(S.view)<0)S.view='dash';
1147: if(S.view==='users'&&!R().admin)S.view='dash';
```

Синхронизация двусторонняя: каталог модулей **досыпает** свои view в ядро -
`v3520-workspaces.js:152`:

```js
try{if(Array.isArray(window.CASE_VALID_VIEWS))MODULES.forEach(function(m){if(m&&m.v&&window.CASE_VALID_VIEWS.indexOf(m.v)<0)window.CASE_VALID_VIEWS.push(m.v);});}catch(e){}
```

Но `validViews` - `const` внутри функции; `CASE_VALID_VIEWS` ссылается на тот же массив,
и push работает. При этом проверка на строке 1146 выполняется ДО загрузки `v3520` (defer),
поэтому view, которого нет в литерале строки 1144, после перезагрузки страницы сбросится
на `dash`. Вывод: **новый view надо дописывать и в литерал `core.js:1144`**, как это сделано
для `advisory_proposal_builder` (он присутствует в строке 1144).

Серверный близнец того же списка - `asaas_workspace_default_views()` в
`/home/user/case-site/case-site/os/api/lib.php:162-184` (массив `$all`, строки 164-173).

---

## 2. Подключение модуля

### 2.1. Тег script и cache-buster - `/home/user/case-site/case-site/os/index.html`

Блок подключения: строки 458-491. Все модули идут с `defer`, кроме `core.js`.

```
458: <script src="quiz-data.js?v=4.50.2" defer></script>
459: <script>const APP_VERSION='4.66.0';    /* версия платформы - повышается с каждым обновлением */
462: const CASE_EXPECTED_MODULES={'core':'4.64.0','v432-data-grid':'4.49.1','v4327-patch':'4.50.1','v4451-live-sync':'4.58.0','v3520-workspaces':'4.64.0','v4450-ux-system':'4.59.0','v4450-owner-report':'4.47.0','v4660-uz-translit':'4.66.0'};
465: window.CASE_EXPECTED_STUDIO_MODULES={'v420-geo-studio':'4.62.0','v4530-geo-export':'4.58.0','v4600-sun-wind':'4.61.0','v4630-huff':'4.63.0'};
466: <script src="core.js?v=4.64.0"></script>
...
491: <script src="v4660-uz-translit.js?v=4.66.0" defer></script>
```

Правила, видимые из файла:

- Значение `?v=` - это **версия самого модуля**, а не `APP_VERSION`. Пример: строка 482
  `v493-portfolio-suite.js?v=4.43.1` при `APP_VERSION='4.66.0'`.
- Новый модуль добавляется последним в списке (`v4660-uz-translit.js` - строка 491,
  сразу перед закрывающим inline-скриптом на 492).
- Порядок важен: `v3520-workspaces.js` (473) грузится после `core.js`, а модули,
  оборачивающие `window.go`, идут после него.
- Внешние ресурсы: единственный CDN - `pptxgenjs` (строка 9). CSP в
  `/home/user/case-site/case-site/os/.htaccess:32` разрешает скрипты только с `'self'`
  и `https://cdn.jsdelivr.net`, стили - с `fonts.googleapis.com`. Новый модуль не должен
  тянуть ничего постороннего.

### 2.2. Карта `CASE_EXPECTED_MODULES` и регистрация версии

Проверка - `core.js:145-153`:

```js
function caseCheckModuleVersions(){try{
 const got=window.CASE_MODULE_VERSIONS||{};
 const stale=Object.keys(CASE_EXPECTED_MODULES).filter(m=>got[m]!==CASE_EXPECTED_MODULES[m]);
 if(!stale.length){console.info('CASE OS: все модули версии '+APP_VERSION);return;}
 const list=stale.map(m=>m+'.js ('+(got[m]||'старый файл')+')').join(', ');
 console.warn('CASE OS: устаревшие модули:',list);
 toast('⚠ Обновление применено не полностью: '+list+' - на сервере старые файлы. Перезалейте папку /os целиком из архива и сделайте Ctrl+Shift+R.',15000);
}catch(e){}}
if(typeof window!=='undefined')window.addEventListener('load',()=>setTimeout(caseCheckModuleVersions,2500));
```

Регистрация - **последняя строка файла модуля**, вне IIFE или внутри неё:

- `core.js:4181` - `window.CASE_MODULE_VERSIONS=window.CASE_MODULE_VERSIONS||{};window.CASE_MODULE_VERSIONS['core']='4.64.0';`
- `v3520-workspaces.js:346` - то же, ключ `'v3520-workspaces'`, значение `'4.64.0'` (строка ВНЕ IIFE, после `})();` на 344)
- `v4630-huff.js:283-284` - внутри IIFE, значением берётся переменная `VERSION`
- `v4660-uz-translit.js:260-261` - внутри IIFE, `VERSION` (строка 47: `var VERSION = '4.66.0';`)
- `v4450-ux-system.js:282`, `v4451-live-sync.js:138` - тоже через `VERSION`
- `v4530-geo-export.js:1276-1277`, `v4600-sun-wind.js:414-415`, `v420-geo-studio.js:1154`

Ключ в карте = имя файла без `.js`.

Важное расхождение (факт, не рекомендация): **регистрируются не все модули.**
`window.CASE_MODULE_VERSIONS` встречается только в файлах: `core.js`, `v3520-workspaces.js`,
`v420-geo-studio.js`, `v432-data-grid.js`, `v4327-patch.js`, `v4450-owner-report.js`,
`v4450-ux-system.js`, `v4451-live-sync.js`, `v4530-geo-export.js`, `v4600-sun-wind.js`,
`v4630-huff.js`, `v4660-uz-translit.js`. В `v492-portfolio-proposals.js` и
`v493-portfolio-suite.js` регистрации нет - и в `CASE_EXPECTED_MODULES` их тоже нет.
То есть контракт такой: **либо модуль есть в обеих структурах, либо ни в одной.**

Модули гео-студии живут в iframe и проверяются отдельно:
`geoanalytics-studio.html:2525-2528` подключает `v420-geo-studio.js`, `v4530-geo-export.js`,
`v4600-sun-wind.js`, `v4630-huff.js`; сверка читает карту через `window.parent`
(`geoanalytics-studio.html:2568`).

### 2.3. Service worker - `/home/user/case-site/case-site/os/sw.js`

```
1: // CASE OS v4.66.0 service worker
2: const CACHE = 'case-os-v4660';
3: const ASSETS = ['./', './index.html', './core.js', ... , './v4451-live-sync.js', './v4660-uz-translit.js'];
```

Правила из файла:

- Имя кэша меняется каждый релиз (строка 2), старые кэши удаляются на `activate` (строка 16).
- В `ASSETS` пути **без** `?v=` - поэтому в `fetch`-обработчике есть fallback
  `caches.match(req, {ignoreSearch: true})` (строки 35-41).
- Предзагрузка по одному файлу (`cache.add` в цикле, строки 8-12), а не `addAll`,
  с логом незалёгших файлов.
- В `ASSETS` перечислены и файлы iframe-студий (`geoanalytics-studio.html`,
  `feasibility-studio.html`, `mep-studio.html`, `lift-studio.html`) и данные из `data/`.

### 2.4. Релизная обвязка

`/home/user/case-site/case-site/os/DEPLOY.md`:

- строка 1 - заголовок с номером версии;
- строка 3 - ссылка на `CHANGELOG_CASE_OS_v<версия>.md` в корне пакета;
- строка 9 - перечень изменённых/добавленных файлов («Изменены `index.html`, `sw.js`. Добавлен `v4660-uz-translit.js`.»);
- строка 10 - «Миграций базы нет» либо перечень;
- строки 15-17 - критерий приёмки: в консоли `CASE OS: все модули версии 4.66.0`;
- строка 19 - контроль целостности `sha256sum -c SHA256SUMS_v4.66.0.txt`.

Файл контрольных сумм: `/home/user/case-site/case-site/os/SHA256SUMS_v4.66.0.txt`
(строка 149 содержит хеш `./v4660-uz-translit.js`). Имя файла версионируется.

---

## 3. Типичный клиентский модуль

### 3.1. Скелет (общий для `v4630-huff.js` и `v493-portfolio-suite.js`)

**Шапка-комментарий по-русски**, объясняющая «зачем», а не «что»:
`v4630-huff.js:1-26` - 26 строк объяснения модели Хаффа, включая раздел
«Честная граница метода» (строки 23-25).
`v493-portfolio-suite.js:1-3` - три строки, по-английски.

**IIFE + `'use strict'` + защита от повторной загрузки:**

- `v3520-workspaces.js:4-7`:
  ```js
  (function(){
    'use strict';
    if(window.CASE_WORKSPACES_480) return;
    window.CASE_WORKSPACES_480=true;
  ```
- `v493-portfolio-suite.js:4-7`:
  ```js
  (function(){
  'use strict';
  if(window.CASE_V493_PORTFOLIO)return;window.CASE_V493_PORTFOLIO=true;
  var VERSION='4.32.6';
  ```
- `v492-portfolio-proposals.js:3-5` - `if(window.CASE_V492_INSTALLED)return;window.CASE_V492_INSTALLED=true;`
- `v4660-uz-translit.js:45,47` - `if (window.CASE_UZ_TRANSLIT) return;` + `var VERSION = '4.66.0';`
  (флагом служит сам публичный объект модуля)
- `v4630-huff.js:27-29` - IIFE + `'use strict'` + `var VERSION = '4.63.0';`, отдельного
  флага нет: защита неявная, повторная загрузка просто перезапишет `window.CASE_HUFF`.

**Локальные утилиты вместо глобальных** (каждый модуль объявляет свои):
- `esc` - `v4630-huff.js:33-37`; `E(v)` - `v493-portfolio-suite.js:32`
- `num` - `v4630-huff.js:32`; `N(v)` - `v493:33`; `F(v)` (формат числа `ru-RU`) - `v493:34`
- `lang()` / `tx()` - `v3520-workspaces.js:160,162`; `T(ru,uz,en)` - `v450-guides.js:8`
- `canEdit()` через ядро - `v493:35`: `var r=typeof R==='function'?R():{};return !!(r.edit||r.finance||r.admin);`

Обращения к глобалям ядра (`S`, `R()`, `persist`, `audit`, `toast`, `localize`, `go`)
почти всегда обёрнуты в `try{...}catch(e){}` - см. `v3520:163-168`, `v493:36`.

### 3.2. Перехват `window.go`

Ядро диспетчеризует ровно фиксированный словарь рендеров - `core.js:1197`:

```js
({dash:renderDash,registry:renderRegistry,kpi:renderKPI,dates:renderDatesPage,plans:renderPlans,docs:renderDocs,brands:renderBrands,bench:renderBench,map:renderMap,org:renderOrg,users:renderUsers,admin_modules:renderAdminModules,admin_system:renderAdminSystem,study:renderStudy,rating:renderRating,chat:renderChat}[v]||renderDash)();
```

Неизвестный view падает в `renderDash`. Поэтому модуль **обязан** обернуть `go`.

Канонический перехват - `v493-portfolio-suite.js:196`:

```js
function install(){migrate();css();var oldGo=window.go;if(typeof oldGo==='function'&&!oldGo._case493){window.go=function(v){if(v==='advisory_portfolio_map'||v==='leasing_portfolio_map'){try{if(typeof window.caseWorkspaceCanOpen==='function'&&!window.caseWorkspaceCanOpen(v))return oldGo.call(this,(window.asaasWorkspaceFirst&&window.asaasWorkspaceFirst())||'dash');}catch(e){}display(v);return;}return oldGo.apply(this,arguments);};window.go._case493=true;}try{if(S&&['advisory_portfolio_map','leasing_portfolio_map'].indexOf(S.view)>=0)display(S.view);}catch(e){}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
```

Составляющие паттерна:

1. маркер на функции (`window.go._case493=true`) - защита от двойного оборачивания;
2. свои view перехватываются, все остальные проксируются в `oldGo`;
3. **проверка прав до отрисовки**: `window.caseWorkspaceCanOpen(v)`, при отказе - переход
   на `window.asaasWorkspaceFirst()` или `'dash'`;
4. монтирование через `DOMContentLoaded ... {once:true}` с ветвью для уже загруженного DOM;
5. повторный вызов `display(S.view)` при установке, если пользователь уже стоит на этом view.

Аналоги: `v492-portfolio-proposals.js` (последние строки файла, `window.go._case492`),
`v3520-workspaces.js:334` (`window.go._casews480` - глобальный сторож рабочих областей)
и `v3520-workspaces.js:225-227` (второй, отдельный обёрточный слой `window.go._nav437`
для синхронизации аккордеона меню).

### 3.3. Функция display / render / redraw

`v493-portfolio-suite.js:159-161`:

```js
function redraw(){var main=document.getElementById('main');if(!main)return;main.innerHTML=render(UI.route);activateNav();try{if(typeof localize==='function')localize();}catch(e){}}
function activateNav(){document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('active',a.dataset.v===UI.route);});var side=document.getElementById('side'),scrim=document.getElementById('scrim');if(side)side.classList.remove('open');if(scrim)scrim.classList.remove('open');}
function display(v){try{S.view=v;}catch(e){}UI.route=v;activateNav();redraw();try{if(typeof saveUiPrefs==='function')saveUiPrefs();}catch(e){}window.scrollTo(0,0);}
```

Разделение обязанностей:
- `render(route)` - чистая функция «строка HTML», без побочных эффектов;
- `redraw()` - вставка в `#main` + `localize()`;
- `display(v)` - установка `S.view`, подсветка меню, `saveUiPrefs()`, скролл вверх.

Локальное состояние экрана держится в модульном объекте `UI`
(`v493:9`: `var UI={route:'',q:'',countries:[],city:'',...}`) и меняется через
`window.case493Set` (строка 164) с точечной перерисовкой.

В `v4630-huff.js` модуль рисует не страницу, а панель: `render(host)` - строки 189-261,
хост - `document.getElementById('probe')` (строка 264), открытие/закрытие через
`window.caseHuffOpen` / `caseHuffClose` (263-272).

### 3.4. Инъекция CSS

Один `<style>` с фиксированным `id`, идемпотентно:

- `v3520-workspaces.js:281-282`:
  ```js
  function css(){if(document.getElementById('case480wscss'))return;var s=document.createElement('style');s.id='case480wscss';s.textContent= '...';document.head.appendChild(s);}
  ```
- `v493-portfolio-suite.js:192-195` - `id='case493PortfolioCss'`, содержимое в template-literal.

Соглашения по CSS:
- все классы префиксуются именем модуля: `.case493-page`, `.case493-filter-card`,
  `.case492-builder-grid`, `.ws-module`, `.ff-row`;
- цвета берутся из CSS-переменных ядра (`--red`, `--red-d`, `--border`, `--panel`,
  `--soft`, `--muted`, `--ink`), объявленных в `index.html:18`;
- тёмная тема - селектором `body.dark ...` (`v3520:282`, конец строки);
- медиазапросы в конце (`@media(max-width:1180px)`, `820px`, `700px`, `650px`);
- `!important` в разборе не встретился ни в одном из просмотренных модулей.

### 3.5. Экспорт в `window`

Публичный API модуля - только через `window.*`, потому что обработчики пишутся
инлайн-атрибутами `onclick="..."` в генерируемом HTML.

- `v3520-workspaces.js:284-296`: `window.asaasWorkspaceCanOpen`, `asaasWorkspaceViews`,
  `asaasWorkspaceFirst`, `caseWorkspaceCanOpen`, `caseWorkspaceViews`,
  `wsSelectRole`, `wsToggleRight`, `wsSelectUser`, `wsToggleRoleView`, `wsResetRole`,
  `wsSetUserMode`, `wsToggleUserView`, `wsResetUser`; плюс `window.CASE_OS_MODULES` (149),
  `window.CASE_OS_GROUPS` (153), `window.CASE_OS_GROUP_ORDER` (154), `window.CASE_NAV_TITLE` (158).
- `v4630-huff.js:277-282` - один объект-фасад:
  ```js
  window.CASE_HUFF = { version: VERSION, dist: dist, shares: shares, catchment: catchment,
    objectsFrom: objectsFrom, attractOf: attractOf, lostSvg: lostSvg, MIN_KM: MIN_KM, open: window.caseHuffOpen };
  ```
- `v4660-uz-translit.js:252-259` - `window.CASE_UZ_TRANSLIT = {version, toCyrl, toLatn, normalizeApostrophes, roundTrips, KEEP}`.
- `v493-portfolio-suite.js:163-191` - 20+ функций с префиксом `case493*`.

Именование: `case<номер><Действие>` для обработчиков, `CASE_<ИМЯ>` в верхнем регистре
для фасада-объекта.

### 3.6. Работа с данными и сохранение

Модуль пишет в глобальный массив/объект состояния (объявлен в `core.js`) и зовёт `persist()`:
`v493:36` - `function persistQuiet(){try{if(typeof persist==='function')persist();}catch(e){}}`,
плюс `audit(...)` перед перерисовкой - `v493:174`, `v493:188`.
`persist()` (`core.js:907-927`) пишет в `localStorage` и в конце вызывает `apiSaveState()`
(строка 926), который дебаунсит POST в `state.php` на 800 мс (`core.js:155`).

Сетевые вызовы - только через хелперы ядра: `apiGET` (`core.js:68`) и `apiPOST`
(`core.js:108-124`), которые сами тянут CSRF-токен и повторяют запрос при 403.

---

## 4. Серверный эндпоинт

### 4.1. Минимальный образец - `/home/user/case-site/case-site/os/api/sales.php` (26 строк целиком)

```php
 1  <?php
 2  // CASE OS v3.5.7 - property sales / buyers / sales commission endpoint.
 3  require __DIR__.'/lib.php';
 4  require_login();
 5  function sales_table_from_type(string $type): string {
 6    if ($type === 'assets') return 'sales_assets';
 ...
10    fail('Неизвестный тип sales endpoint', 400);
11  }
12  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
13  if ($method === 'GET') {
14    $type = (string)($_GET['type'] ?? 'assets');
15    $table = sales_table_from_type($type);
16    json_out(['ok'=>true,'type'=>$type,'rows'=>list_table($table, $_GET)]);
17  }
18  if ($method === 'POST') {
19    $b = body();
...
22    if (array_key_exists('delete', $b)) { delete_row($table, $b['delete']); json_out(['ok'=>true]); }
23    if (array_key_exists('row', $b)) { json_out(['ok'=>true,'type'=>$type,'row'=>upsert_row($table, $b['row'])]); }
24    fail('Нужно поле row или delete', 400);
25  }
26  fail('Метод не поддерживается', 405);
```

Скелет любого эндпоинта:
1. `require __DIR__.'/lib.php';`
2. `require_login();` (или `$u = require_login();`, если нужен объект пользователя)
3. ветвление по `$_SERVER['REQUEST_METHOD'] ?? 'GET'`
4. выход через `json_out(...)` или `fail(...)` - обе функции делают `exit`
5. последняя строка файла - `fail('Метод не поддерживается', 405);`

Все таблицы проходят через реестр `tables()` (`lib.php:321-354`), `list_table()`
(`lib.php:375`), `upsert_row()` (496), `delete_row()` (557) - прямых SQL-запросов
в `sales.php` нет вообще.

### 4.2. Развёрнутый образец - `/home/user/case-site/case-site/os/api/project_files.php` (144 строки)

```php
  4  declare(strict_types=1);
  5  require __DIR__.'/lib.php';
  6  $u = require_login();
  7  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  9  const CASE_FILE_LIMIT = 26214400; // 25 MiB
```

Проверка прав - три независимых слоя:

- **раздел включён в рабочую область** - `case_file_has_view()` (строки 37-42):
  ```php
  function case_file_has_view(array $u, array $views): bool {
    if (!empty($u['admin'])) return true;
    $state = asaas_load_app_state_data();
    foreach ($views as $view) if (asaas_workspace_can_view($u, $view, $state)) return true;
    return false;
  }
  ```
  Список нужных view - строки 69-71 (GET) и 95-97 (POST).
- **право на действие** - строка 99: `if (!can('edit') && !can('plans') && !can('admin')) fail('Нет права загрузки файлов', 403);`
- **проектная область** - `case_file_project_allowed()` (32-36), проверяет `$u['project_scope']` и `$u['projects']`.

CSRF на записи - строка 90: `require_valid_csrf($_POST);` (для multipart; для JSON это делает
`body()` автоматически - `lib.php:74`).

Защита от исполняемых файлов (строки 107-123):

```php
107  $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
108  $allowed = case_file_allowed_extensions();
109  if (!isset($allowed[$ext])) fail('Этот формат файла не разрешён', 415);
110  $tmp = (string)($f['tmp_name'] ?? '');
111  if ($tmp === '' || !is_uploaded_file($tmp)) fail('Некорректный временный файл', 400);
112  $detected = 'application/octet-stream';
113  if (class_exists('finfo')) { $fi = new finfo(FILEINFO_MIME_TYPE); $detected = (string)($fi->file($tmp) ?: $detected); }
117  // Block executable/script payloads regardless of extension...
118  $blocked = ['application/x-httpd-php','text/x-php','text/html','application/javascript','text/javascript','application/x-sh'];
119  if (in_array(strtolower($detected), $blocked, true)) fail('Содержимое файла не соответствует разрешённому формату', 415);
120  if ($ext === 'svg') {
121    $svg = file_get_contents($tmp, false, null, 0, min($size, 1048576));
122    if ($svg === false || preg_match('/<(script|foreignObject)\b|\bon\w+\s*=|javascript\s*:/i', $svg)) fail('SVG содержит небезопасные элементы', 415);
123  }
```

Остальные приёмы этого файла:
- белый список расширений с MIME - `case_file_allowed_extensions()` (49-57);
- хранение вне веб-корня: `dirname(__DIR__).'/data/case_files'`, `mkdir(..., 0770, true)` (11-15);
- имя на диске - `uuid().'.'.$ext` (124-125), исходное имя только в индексе;
- атомарная запись индекса через `tmp` + `rename` + `LOCK_EX` (24-31);
- сравнение идентификаторов через `hash_equals` (строка 59) и regexp-валидация id (65);
- отдача файла: явные `Content-Type`, `Content-Length`, `Content-Disposition` с
  `filename*=UTF-8''`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` (80-85);
- `audit('project_file_upload', ...)` (140) и `json_out(['ok'=>true,'file'=>$row], 201)` (141).

### 4.3. Базовые функции из `lib.php`

| функция | строка | суть |
|---|---|---|
| `cfg()` | 34 | конфиг из `config.php`, иначе `config.sample.php` |
| `db()` | 38-52 | статический PDO; MySQL или SQLite; `ERRMODE_EXCEPTION`, `FETCH_ASSOC` |
| `json_out($data,$code=200)` | 55-64 | заголовки `no-store`, `nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `JSON_UNESCAPED_UNICODE`, `exit` |
| `fail($msg,$code=400)` | 65 | `json_out(['error'=>$msg], $code)` |
| `body()` | 66-77 | лимит 40 МБ, разбор JSON, `require_valid_csrf($j)`, снятие `_csrf` |
| `uuid()` | 78-81 | UUID v4 из `random_bytes(16)` |
| `require_same_origin_for_write()` | 89-96 | проверка Origin/Referer на записи |
| `csrf_token()` / `require_valid_csrf()` | 98-112 | токен в сессии, `hash_equals` |
| `current_user()` | 116-138 | JOIN `app_users` + `roles`, fallback на старую схему без `project_scope` |
| `require_login()` | 139-143 | 401 «Не авторизован» |
| `can($p)` | 144-147 | флаг права из строки роли |
| `owner_identity($u)` | 152-156 | `broker_name`, иначе `name` |
| `audit($action,$detail)` | 277-281 | INSERT в `audit_log` |

Сессия настраивается на строках 17-31: `session_name('caseos')`, `gc_maxlifetime` 43200,
cookie `httponly`, `samesite=Lax`, `secure` по HTTPS.

---

## 5. Проверка прав

### 5.1. Сервер - `/home/user/case-site/case-site/os/api/lib.php`

- `asaas_workspace_default_views()` - 162-184. Зеркало `DEFAULTS` из `v3520-workspaces.js`
  (комментарий на строке 75 `state.php` это прямо фиксирует). `$all` - строки 164-173.
- `asaas_known_module_ids()` - 185-188 (= набор `ASH`).
- `asaas_protected_module_ids()` - 189: `['dash','users']`.
- `asaas_workspace_hard_allowed($u,$view)` - 190-197: жёсткие границы для `AGX` (194) и `BRJ` (195).
- `asaas_future_module_ids()` - 198-206: список «будущих» (зеркало `future:true`).
- `asaas_module_status($state,$view)` - 207-216: читает `$state['MODULE_FLAGS']`,
  допустимые значения `active|beta|hidden|disabled|deprecated`, по умолчанию
  `hidden` для future-модулей и `active` для остальных.
- `asaas_feature_can_view()` - 217-222: `beta` виден только админам.
- `asaas_workspace_effective_views($u,$state)` - 224-246: база = `ROLE_WORKSPACES[role]`
  или дефолт роли, перекрытие `USER_WORKSPACES[key].views` при `mode==='custom'`
  (ключ ищется по id → email → role_key, строки 232-238), фильтр `hard_allowed` +
  `feature_can_view`, `dash` доливается всегда (244).
- **`asaas_workspace_can_view($u,$view,$state)` - 247-249**: `in_array($view, effective_views)`.
- `asaas_geo_can_edit($u)` - 250-253: `edit || finance || admin`.
- `asaas_load_app_state_data()` - 254-261: `SELECT data FROM app_state WHERE id=1`.
- `asaas_workspace_visible_config()` - 262-276: что из конфигурации рабочих областей видит не-админ.
- `table_workspace_views($table)` - 286-307: карта «таблица → разделы».
- `require_table_allowed($table)` - 309-318: 403 «Раздел для таблицы не включён в вашу рабочую область: …».

### 5.2. Клиент - объект `ROLES` в `/home/user/case-site/case-site/os/core.js:295-311`

11 ролей. Формат (строка 296):

```js
ASH:{label:'Генеральный директор',leasing:true,finance:true,edit:true,approve:true,admin:true,plans:true,geoEdit:true,reportsTo:null,rights:['Полный доступ','Финансы / NOI','Виза по ставкам','Все дашборды','Геоданные: правка']},
```

Ключи: `ASH` 296, `ADM` 297, `BA` 298, `AG` 299, `AGX` 300, `HO` 301, `BSH` 302, `HM` 303,
`DIR` 308 (с комментарием 304-307), `CFO` 309, `BRJ` 310.

Флаги, встречающиеся в объекте: `leasing`, `finance`, `edit`, `approve`, `admin`, `plans`,
`geoEdit`, `ownOnly`, `external`, `projectScoped`, `brandsOnly`, `reportsTo`, `rights`, `label`.

Подписи флагов для UI - `core.js:3547`:

```js
const RIGHTLBL=[['leasing','Аренда'],['finance','Финансы'],['edit','Правки'],['approve','Виза'],['plans','Планы'],['ownOnly','Только свои'],['external','Внешний'],['projectScoped','Только проекты'],['admin','Админ']];
```

Гидратация из БД - `core.js:1058` (`hydrateRolesFromDB`, `apiGET('data.php?table=roles')`);
маппинг колонок: `own_only→ownOnly`, `project_scope→projectScoped`.
`AGX` после гидратации принудительно возвращается к жёсткому набору (там же).

Карточка настройки прав в UI - `v3520-workspaces.js:243-255` (`rightsBlock`),
переключатель - `window.wsToggleRight` (290) → ядровой `toggleRight`.

### 5.3. Таблица `roles` - `/home/user/case-site/case-site/os/sql/install_all.sql:18-29`

```sql
CREATE TABLE IF NOT EXISTS roles (
  `key`     VARCHAR(16) PRIMARY KEY,
  label     VARCHAR(120) NOT NULL,
  leasing   TINYINT(1) NOT NULL DEFAULT 0,
  finance   TINYINT(1) NOT NULL DEFAULT 0,
  edit      TINYINT(1) NOT NULL DEFAULT 0,
  approve   TINYINT(1) NOT NULL DEFAULT 0,
  plans     TINYINT(1) NOT NULL DEFAULT 0,
  own_only      TINYINT(1) NOT NULL DEFAULT 0,
  project_scope TINYINT(1) NOT NULL DEFAULT 0,
  admin     TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Внешний ключ из `app_users` - строка 42: `CONSTRAINT fk_user_role FOREIGN KEY (role_key) REFERENCES roles(\`key\`)`.

Сид девяти базовых ролей - строки 319-332 (и дубль в `sql/seed_roles.sql:2-14`).
Роли `BRJ` и `DIR` в `install_all.sql` отсутствуют - они ставятся миграциями
(комментарий в шапке файла, строки 3-6). Новых колонок прав в таблице нет:
`geoEdit`, `external`, `brandsOnly` существуют только на клиенте.

---

## 6. Миграции

Каталог: `/home/user/case-site/case-site/os/sql/migrations/` - 23 файла `.sql` + `EXAMPLE_template.sql.txt`.

### 6.1. Правила из шаблона - `EXAMPLE_template.sql.txt` (7 строк)

```sql
-- Шаблон миграции. Переименуйте в формат с датой, напр.:
--   2026_07_15_add_unit_assigned.sql
-- Пишите ИДЕМПОТЕНТНО (чтобы повторный запуск не ломался) и БЕЗ удаления данных:
ALTER TABLE units ADD COLUMN IF NOT EXISTS example_field VARCHAR(120) NULL;
-- Добавление таблицы:
-- CREATE TABLE IF NOT EXISTS new_table (...);
-- Запрещено в обычных обновлениях: DROP TABLE / DROP COLUMN / TRUNCATE.
```

Имя файла: `YYYY_MM_DD_<краткое_описание>.sql`. Порядок применения - `sort($files)` по имени
(`api/migrate.php:13`), поэтому дата в начале имени и есть механизм упорядочивания.

### 6.2. Образец «новые таблицы» - `2026_07_19_v4_feasibility_models.sql` (33 строки)

```sql
 1  CREATE TABLE IF NOT EXISTS feasibility_models (
 2    id VARCHAR(36) NOT NULL,
 3    obj_id VARCHAR(80) NOT NULL,
 4    scenario_name VARCHAR(190) NOT NULL,
 5    status VARCHAR(30) NOT NULL DEFAULT 'draft',
 6    model_json LONGTEXT NOT NULL,
 7    revision INT NOT NULL DEFAULT 1,
 8    created_by_id VARCHAR(64) NULL,
 9    created_by_name VARCHAR(190) NULL,
10    updated_by_id VARCHAR(64) NULL,
11    updated_by_name VARCHAR(190) NULL,
12    created_at DATETIME NOT NULL,
13    updated_at DATETIME NOT NULL,
14    PRIMARY KEY (id),
15    KEY idx_feas_obj (obj_id),
16    KEY idx_feas_status (status),
17    KEY idx_feas_updated (updated_at)
18  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
20  CREATE TABLE IF NOT EXISTS feasibility_model_versions (
21    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
22    model_id VARCHAR(36) NOT NULL,
23    revision INT NOT NULL,
...
30    UNIQUE KEY uq_feas_version (model_id, revision),
31    KEY idx_feas_version_model (model_id),
32    KEY idx_feas_version_saved (saved_at)
33  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Наблюдения:
- id сущности - `VARCHAR(36)` (UUID из `lib.php:uuid()`), история версий - `BIGINT AUTO_INCREMENT`;
- поля авторства парами `*_by_id` / `*_by_name`;
- `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
- индексы именуются `idx_<префикс>_<поле>`, уникальные - `uq_<префикс>_<смысл>`;
- **внешних ключей между этими двумя таблицами нет** - связь `model_id → feasibility_models.id`
  держится только уникальным индексом и кодом.

### 6.3. Образец «роль + пользователь» - `2026_08_13_role_dir.sql` (27 строк)

```sql
 1  -- Роль DIR - «Директор (без администрирования)»: все рабочие права, кроме управления
 2  -- доступами. Отличие от ADM ровно в одном флаге: admin=0. Этого достаточно, потому что
 3  -- разделы «Доступ», «Модули» и «Система» в клиенте закрыты и в меню, и на отрисовке.
 4  --
 5  -- Порядок важен: сначала роль, потом пользователь. У app_users есть внешний ключ
 6  -- fk_user_role на roles(`key`), поэтому назначить несуществующую роль нельзя.
 7  -- Миграция идемпотентна: повторный запуск безопасен.
 9  INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin)
10  VALUES ('DIR','Директор (без администрирования)',1,1,1,1,1,0,0,0)
11  ON DUPLICATE KEY UPDATE
12    label=VALUES(label), leasing=VALUES(leasing), finance=VALUES(finance), edit=VALUES(edit),
13    approve=VALUES(approve), plans=VALUES(plans), own_only=VALUES(own_only),
14    project_scope=VALUES(project_scope), admin=VALUES(admin);
19  UPDATE app_users SET role_key='DIR'
20  WHERE name='Humoyun Mirkamolov' AND role_key<>'DIR';
22  -- Проверка после применения (должна вернуть одну строку с role_key='DIR'):
23  -- SELECT id, name, email, role_key, active FROM app_users WHERE name LIKE '%Mirkamolov%';
```

Что здесь конвенция:
- шапка-комментарий по-русски: **зачем**, **порядок**, **идемпотентность**;
- идемпотентность через `ON DUPLICATE KEY UPDATE` (для вставок) и `IF NOT EXISTS` (для DDL);
- порядок операций объясняется через существующий внешний ключ (`fk_user_role`);
- в конце - закомментированный проверочный `SELECT` и инструкция «что делать, если 0 строк»
  (строки 25-27).
- `UPDATE` пишется с условием `AND role_key<>'DIR'`, чтобы повторный прогон не трогал строки.

### 6.4. Механизм применения - `/home/user/case-site/case-site/os/api/migrate.php`

```
 5  require_login();
 6  if (!can('admin')) fail('Только администратор', 403);
 7  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') require_valid_csrf();
 9  $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(190) PRIMARY KEY, applied_at DATETIME)');
12  $files = glob(__DIR__.'/../sql/migrations/*.sql') ?: [];
13  sort($files);
25    $pdo->exec($sql); // в MySQL DDL автокоммитится; миграции пишем идемпотентно
32    if (preg_match('/duplicate column|column already exists|already exists|duplicate key name|duplicate entry|unique constraint failed/i', $m)) { ... $already[] = $base; continue; }
38    $failed[] = $base.': '.$m; // ошибка одной миграции не должна блокировать следующие
42  json_out(['ok'=>!count($failed), 'applied'=>$done, 'already'=>$already, 'failed'=>$failed]);
```

Учёт применённого - таблица `schema_migrations` по имени файла. Транзакций нет
(комментарий строки 25). Ошибки «уже существует» гасятся и помечаются применёнными.

---

## 7. Многоязычность

**Отдельного слоя i18n нет.** Язык зашит в словари и в тернарники по месту.
Всего пять независимых механизмов:

### 7.1. `LANG` и `t()` - `core.js:19-20`

```js
let LANG='ru';
const t=k=>(I18N[LANG][k]||I18N.ru[k]||k);
```

`I18N` - `core.js:8-18`, всего три ветки (`ru` 9-11, `uz` 12-14, `en` 15-17) и ~55 ключей.
Это словарь только для шапки/логина/дашборда, для разделов он не используется.

Переключение: `setLang(l)` - строка 21, `toggleLang()` - 25-29,
`LANG_CYCLE=['ru','uz','en']` - 24. Язык сохраняется в `localStorage` через
`saveUiPrefs()` (875) и читается в `loadUiPrefs()` (876) - то есть **per-browser**,
не в общем состоянии компании.

Узбекский в `I18N` (строка 14) записан с апострофом **U+02BB**: `'Qoʻshish'`,
`'Oʻrtacha koʻrsatkichlar'`, `'Yoʻqotish (boʻsh)'`, `'portfel boʻyicha'`, `'Boʻsh'`.

### 7.2. `UZMAP` / `ENMAP` - пословный перевод готового DOM

- `ENMAP` объявляется на `core.js:616`, дополняется `Object.assign(ENMAP,{...})` на строках
  619, 661, 804, 836, 4176.
- `UZMAP` объявляется на `core.js:655`, дополняется на 658, 659, 660, 663, 705, 719, 720,
  723, 736, 772, 836, 4176.
- `curMap()` - 838, `uzKeys()` - 839 (ключи сортируются по убыванию длины),
  `uzText(s)` - 840 (сначала точное совпадение по `s.trim()`, потом подстановка ключей
  длиной ≥ 4, в конце `'м²' → 'm²'`).
- `localize()` - 847-868: обходит `#main`, `#drawer`, `#perm` и `.topbar` через
  `TreeWalker`, запоминает русский оригинал в атрибутах `data-ru`, `data-ru-t<N>`,
  `data-ru-placeholder`, `data-ru-title`, `data-ru-aria-label` и переводит от оригинала.
  Комментарий 841-846 объясняет, почему хранится именно оригинал.

Следствие для нового модуля: **любой русский текст, вставленный в `#main`, будет переведён
автоматически, если пара есть в `UZMAP`/`ENMAP`.** Модуль обязан позвать `localize()`
после отрисовки (`v493-portfolio-suite.js:159`).

### 7.3. Поля `ru`/`uz`/`en` в каталоге модулей

`v3520-workspaces.js:162` - `function tx(o){return o[lang()]||o.ru||'';}`,
`lang()` - 160. Используется в `buildNav` (212, 213), `moduleButtons` (235, 239),
`CASE_NAV_TITLE` (158).

### 7.4. Локальные словари внутри модулей

Три равноправных приёма, все встречаются в коде:

- объект-словарь на три языка: `v3520-workspaces.js:266`
  (`var L={ru:{...},uz:{...},en:{...}}[lang()]||null;`), `v410-feature-flags.js:70-72`;
- функция `T(ru,uz,en)`: `v450-guides.js:8`;
- инлайн-тернарник: `core.js:3336`, `3349`, `3353`; `v3520-workspaces.js:334`
  (`lang()==='en'?'This module is not enabled for your workspace.':lang()==='uz'?'Bu bo‘lim sizning ish sohangiz uchun yoqilmagan.':'Этот раздел не включён в вашу рабочую область.'`).

### 7.5. Транслитерация - `v4660-uz-translit.js` (v4.66.0)

Это **не перевод**, а латиница ⇄ кириллица (шапка файла, строки 1-13):
`window.CASE_UZ_TRANSLIT = {version, toCyrl, toLatn, normalizeApostrophes, roundTrips, KEEP}`
(строки 252-259). Мастер-текст - латиница; `content_uz_cyrl` вычисляется и кэшируется
(строки 12-13). `KEEP` (55-65) - латинские токены, которые не транслитерируются
(`'CASE Real Estate Advisory'`, `'GLA'`, `'NOI'`, `'Expert Review'`, `'catchment'`,
`'rent-roll'`, `'tenant-mix'`, `'pre-opening'`, `'due diligence'` и др.).

### 7.6. Апострофы - фактическое расхождение в репозитории

Подсчёт по файлам `/os/*.js` (символы U+2018 `‘`, U+2019 `’`, U+02BB `ʻ`, U+02BC `ʼ`):

| файл | U+2018 | U+2019 | U+02BB | U+02BC |
|---|---|---|---|---|
| `core.js` | 0 | 2 | 324 | 22 |
| `v32-upgrade.js` | 0 | 1 | 40 | 4 |
| `v326-commission-engines.js` | 23 | 0 | 0 | 0 |
| `v3520-workspaces.js` | 11 | 6 | 0 | 0 |
| `v400-feasibility.js` | 15 | 0 | 0 | 0 |
| `v410-feature-flags.js` | 8 | 1 | 0 | 0 |
| `v420-geoanalytics.js` | 6 | 0 | 2 | 6 |
| `v440-engineering.js` | 1 | 0 | 2 | 0 |
| `v450-guides.js` | 0 | 0 | 27 | 0 |
| `v4660-uz-translit.js` | 25 | 7 | 2 | 2 |

Дословные примеры (скопированы посимвольно):

- `v3520-workspaces.js:22` - `uz:'Bo‘limlararo topshirish'` (U+2018)
- `v3520-workspaces.js:49` - `uz:'Investorlar va so‘rovlar'` (U+2018)
- `v3520-workspaces.js:75` - `uz:'G‘aznachilik va pul oqimi'` (U+2018)
- `v3520-workspaces.js:87` - `data:{... uz:'Ma’lumot va tahlil' ...}` (U+2019)
- `v3520-workspaces.js:98` - `uz:'Ta’lim'` (U+2019)
- `v3520-workspaces.js:266` - `custom:'Shaxsiy to‘plam'`, `sections:'Ko‘rinadigan bo‘limlar'` (U+2018)
- `core.js:14` - `add:'Qoʻshish'`, `avg:'Oʻrtacha koʻrsatkichlar'`, `lossvac:'Yoʻqotish (boʻsh)'` (U+02BB)
- `v450-guides.js:111` - `T('Инструкция','Yoʻriqnoma','Guide')` (U+02BB)

Норматив, который декларирует самый новый модуль - `v4660-uz-translit.js:232-242`:

```
232  /* Нормализация апострофов: в латинице всегда типографские o‘/g‘ (U+2018), а тутуқ
233     белгиси - U+2019. Прямые кавычки ' и ` в исходнике встречаются постоянно (их ставит
234     любая клавиатура), и без нормализации они молча превратились бы в мусор. */
235  function normalizeApostrophes(s) {
236    return String(s == null ? '' : s)
238      .replace(/([oOgG])['`ʻ‘´ʼ]/g, function (all, l) { return l + '‘'; })
242      .replace(/(^|[^oOgG])['`ʼ´ʻ‘]/g, function (all, pre) { return pre + '’'; });
243  }
```

То есть **действующая норма проекта: `o‘`/`g‘` - U+2018, тутуқ белгиси - U+2019**
(так написан каталог модулей `v3520-workspaces.js`), а `core.js` и `v450-guides.js`
исторически используют U+02BB. Новый модуль обязан следовать `v3520`/`v4660` (U+2018/U+2019),
иначе транслитератор его строки не примет.

---

## 8. Хранение состояния

### 8.1. Клиент - `stateBlob()` / `applyState()`

`stateBlob()` - `core.js:130`, одна строка, shorthand-объект из 55 глобальных переменных:

```js
function stateBlob(){return {TAXO,OBJECTS,U,BRANDS,USERS,CHANGES,BENCH,REFUSALS,PLANUP,PLANSVG,PLAN_LABELPOS,PLAN_CODES,PLAN_SNAPSHOT_SVGS,PLAN_STRUCT,PLAN_IGNORED_CODES,DOCREG,DOC_CONTACTS,AGENTS,ROLES,KPSEQ,ACTLOG,AUDIT,MAPCFG,PROJECT_PPT,QUIZLOG,QUIZSTATS,KB,KBPROG,HRPROF,CHAT,KPI_TARGETS,ROLE_WORKSPACES,USER_WORKSPACES,MODULE_FLAGS,GEO_DATA,TRASH,COMMCFG,COMMLOST,OWNER_REPORTS,CASE_CLIENTS,CASE_OPPORTUNITIES,CASE_PROPOSALS,CASE_CONTRACTS,CASE_SCOPE_ITEMS,CASE_SCOPE_CHANGES,CASE_TASKS,CASE_DELIVERABLES,CASE_LAYOUT_VERSIONS,CASE_DECISIONS,CASE_DOCUMENT_TEMPLATES,CASE_WORKFLOW_SETTINGS,CASE_PORTFOLIO_PROJECTS,CASE_PROPOSAL_CATALOG};}
```

`applyState(d)` - `core.js:929-…`. Приёмы, которые надо повторить для новой сущности:

- массивы обновляются **на месте**, чтобы не рвать ссылки:
  `U.splice(0,U.length,...d.U)`, то же для `BRANDS`, `USERS`, `CHANGES`, `BENCH`, `DOCREG`,
  `AGENTS`, `OBJECTS`, `KB`;
- словари - `Object.assign(PLANUP,d.PLANUP)` и т. п.;
- защита от превращения `{}` в `[]` при пересохранении через PHP - комментарий
  `core.js:935` и хелпер `_asMap(...)` (используется на строке 937 для `QUIZSTATS`,
  `KBPROG`, `HRPROF`, `KPI_TARGETS`, `ROLE_WORKSPACES`, `USER_WORKSPACES`, `MODULE_FLAGS`,
  `COMMCFG`);
- `MAPCFG.apikey` не затирается пустым значением (строка 934).

`persist()` - `core.js:907-927`: пишет в `localStorage` (`STORAGE_KEY`), при ошибке
показывает toast (924) и в конце вызывает `apiSaveState()` (926).
`loadPersist()` - 928. `apiSaveState()` - 155, дебаунс 800 мс.
Фоновая синхронизация - `pollServerState()` (141), интервал 20 000 мс (142).
`flushState()` (236) отправляет состояние через `navigator.sendBeacon` при уходе со страницы.

Личные настройки экрана хранятся ОТДЕЛЬНО, только в браузере: `UI_KEY=STORAGE_KEY+'-ui'`
(`core.js:874`), `saveUiPrefs()` / `loadUiPrefs()` (875-876). Туда идут `LANG`, `THEME`,
`S.obj`, `S.view`, `navPin` и пр.

### 8.2. Таблица `app_state`

`/home/user/case-site/case-site/os/sql/install_all.sql:301-308`:

```sql
-- Живое состояние интерфейса (общая база данных платформы), одна строка id=1.
CREATE TABLE IF NOT EXISTS app_state (
  id         INT PRIMARY KEY,
  data       LONGTEXT,
  updated_at DATETIME,
  updated_by VARCHAR(160),
  revision INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Первая версия таблицы - миграция `sql/migrations/2026_07_01_app_state.sql:3-8`
(без `revision`), колонка `revision` добавлена `2026_07_13_app_state_revision.sql`.
Плюс страховка в рантайме: `api/state.php:9-18` (`ensure_app_state_schema()` пытается
`ALTER TABLE app_state ADD COLUMN revision`).

### 8.3. Сервер - `/home/user/case-site/case-site/os/api/state.php` (522 строки)

Контракт (строки 2-4): `GET` - отдать состояние; `POST` - сохранить,
тело `{"data": {...}, "revision": 123?}`.

Ключевые структуры:

- `all_shared_state_keys()` - 47-59: полный список верхнеуровневых ключей блоба.
- `redact_shared_state($data,$u)` - 27-42: не-финансовому и не-админу оставляет только
  свои строки в `BRAND_REQUESTS`, `SALES_ASSETS`, `SALES_BUYERS`, `INVESTOR_REQUESTS`,
  `PARTNER_REFERRALS`, `LEASE_COMMISSION_DEALS`, `SUPPLIER_COMMISSION_DEALS`, `CASE_PARTNERS`.
- **`workspace_view_keys()` - 95-139: карта «раздел → ключи состояния, которые он редактирует».**
  Это то место, куда обязан попасть новый модуль. Примеры:
  ```php
  104  'advisory_portfolio_map'=>['CASE_PORTFOLIO_PROJECTS','MAPCFG'],
  103  'advisory_proposal_builder'=>['CASE_PROPOSALS','CASE_SCOPE_ITEMS','CASE_PROPOSAL_CATALOG','CASE_DOCUMENT_TEMPLATES'],
  105  'advisory_proposals'=>['CASE_PROPOSALS','CASE_SCOPE_ITEMS','CASE_DOCUMENT_TEMPLATES','CASE_PROPOSAL_CATALOG'],
  117  'document_templates'=>['CASE_DOCUMENT_TEMPLATES'],
  ```
  Комментарий 92-94: карта «намеренно щедрая внутри раздела, но строгая между разделами».
- `baseline_state_keys()` - 145: `['CHAT','TRASH','V32_NOTES','TAXO']`.
- `role_allowed_state_keys($u,$oldData)` - 245-260: что роль может ПИСАТЬ.
  Системные ключи вычитаются на 252 (`USERS`, `ROLES`, `ACTLOG`, `AUDIT`,
  `ROLE_WORKSPACES`, `USER_WORKSPACES`, `TAXO`), `GEO_DATA` - на 255.
- `role_visible_state_keys($u,$state)` - 265-273: что роль может ЧИТАТЬ.
- Неразрешённый ключ **не даёт 403 на весь запрос**, а восстанавливается из старого
  состояния; реальная попытка изменить пишется в аудит и возвращается в `rejected_keys`
  (комментарий 68-73; ответ - строка 519). Клиент это показывает в
  `core.js:162-175` (`_warnRejectedKeys`) с человеческими именами из
  `STATE_KEY_LABELS` (`core.js:156`).

Итого, чтобы новый ключ состояния работал, его надо добавить в **четыре** места:
`core.js:130` (`stateBlob`), `core.js:929+` (`applyState`), `state.php:47-59`
(`all_shared_state_keys`), `state.php:95-139` (`workspace_view_keys`),
и по-хорошему в `core.js:156` (`STATE_KEY_LABELS`).

---

## 9. Экспорт файлов - `/home/user/case-site/case-site/os/v4530-geo-export.js` (1278 строк)

### 9.1. Почему без библиотек - шапка файла, строки 1-13

```
 7  * Почему всё собирается здесь, а не библиотекой: интернет в Ташкенте у сервисов
 8  * работает через раз, а CSP системы не пускает сторонние скрипты. .xlsx и .pptx -
 9  * это ZIP с XML внутри, и собрать их вручную надёжнее, чем зависеть от CDN.
```

### 9.2. ZIP без сжатия - строки 18-68

- Таблица CRC32 строится один раз в IIFE - `CRC` (21-25), `crc32(buf)` (26-30).
- `utf8(str)` = `new TextEncoder().encode(str)` (31).
- `zipDate(d)` - упаковка даты/времени в формат DOS (32-36).
- `zipBuild(files)` - 37-68: локальные заголовки (сигнатура `0x04034b50`, метод 0),
  центральный каталог (`0x02014b50`), End of Central Directory (`0x06054b50`),
  флаг `0x0800` (UTF-8 имена) на строках 43 и 50.
- Комментарий 18-20: «Сжатие нам не нужно… deflate в браузере без библиотеки потребовал бы
  CompressionStream, который есть не везде».
- `saveBlob(bytes,name,mime)` - 69-74: `Blob` → `URL.createObjectURL` → скрытый `<a download>`
  → `click()` → `revokeObjectURL` через 1500 мс.

### 9.3. XLSX - строки 583-829

- `sheetXml(rows,widths)` - 584-600: числа пишутся как `<c r="A1"><v>…</v></c>`,
  строки - как `t="inlineStr"` c `<is><t xml:space="preserve">…</t></is>`.
  **Shared strings не используются.**
- `colName(i)` - 601: перевод индекса в буквенное имя колонки.
- `buildSheets(p,D)` - 603-795: 14 листов (Сводка, Население, Население по районам,
  Районы города, Радиусы, Бизнес-центры, Конкуренты · БЦ, Конкуренты · торговля,
  Медицина, Городские объекты, Образование по типам, F&B по типам, Метро, Рынок города),
  каждый добавляется через `add(флаг_настройки, {name, rows, w})` - строки 780-793.
- `window.caseGeoExportXlsx` - 797-829. Состав пакета: `[Content_Types].xml`,
  `_rels/.rels`, `docProps/core.xml`, `docProps/app.xml`, `xl/workbook.xml`,
  `xl/_rels/workbook.xml.rels`, `xl/worksheets/sheetN.xml`.
  Финал - строка 828:
  ```js
  saveBlob(zipBuild(files), fname(p, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ```

### 9.4. PPTX - строки 831-1165

- Единицы: `var EMU = 12700;` (832) - 1 pt; `SLIDE_W = 12192000, SLIDE_H = 6858000` (833) - 16:9.
- Примитивы: `tx()` текстовая рамка (834-845), `tbl()` таблица (846-866),
  `pic()` картинка (867-872), `rect()` (882-887), `band()` фирменная красная полоса (888-893),
  `slideXml(shapes)` (873-881).
- Тема `THEME` (894+): акценты `9E0000`, `14675B`, `A8792C`, `1F6FB2`, `7B3FA0`.
- Пакет (1108-1165): `[Content_Types].xml`, `ppt/presentation.xml`,
  `ppt/slideMasters/slideMaster1.xml`, `ppt/slideLayouts/slideLayout1.xml`,
  `ppt/theme/theme1.xml`, `ppt/slides/slideN.xml`, `docProps/*`.
  Финал - 1165: `saveBlob(zipBuild(files), fname(p,'pptx'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');`
- Снимок карты для слайда - `window.caseGeoMapPngAsync` (1176-1210): тайлы догружаются
  отдельным `fetch(..., {mode:'cors'})`, чтобы не «пачкать» холст; если ни один тайл не
  пришёл - снимок не делается вовсе (1198, комментарий 1168-1175: «Пустую карту в
  презентацию класть нельзя: она выглядит как готовая, но врёт»).
  Синхронный вариант - `window.caseGeoMapPng` (1212-1230).

Отдельно: в `index.html:9` подключён `pptxgenjs@3.12.0` с jsDelivr - им пользуется другой код,
`v4530-geo-export.js` его не использует.

### 9.5. PDF - окно печати

В `v4530-geo-export.js` PDF **не собирается**; строка 1239:

```js
if (c.formats.pdf) setTimeout(function () { if (typeof exportProbePdf === 'function') exportProbePdf(); }, 900);
```

Сама функция - `/home/user/case-site/case-site/os/geoanalytics-studio.html:2264-2287`:

```
2264  function exportProbePdf(){ /* v4.43.1: полный отчёт по точке - в PDF через печатную версию */
2267   const w=window.open('','_blank');
2268   if(!w){alert('Браузер заблокировал окно печати - разрешите всплывающие окна для этого сайта.');return;}
2269   w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>CASE OS - геоаналитика точки</title><style> ... @media print{.noprint{display:none}} </style></head><body> ... `);
2283   w.document.close();
2285   try{if(typeof window.caseDashFixDoc==='function')caseDashFixDoc(w.document);}catch(e){}
2286   setTimeout(()=>{try{w.focus();w.print();}catch(e){}},450);
```

То есть: **новое окно + собственный печатный CSS + `window.print()`**, никакого PDF-движка.
Печатный стиль - `Montserrat`, ширина 720 px, размеры в `pt`, фирменная линия `#9E0000`.

### 9.6. Нормализация тире в выгрузках - 79-100

`dsh(v)` (79-85) правит длинное/среднее тире в текстовых ячейках XLSX/PPTX,
`dshDoc(doc)` (87-…) - в документе окна печати. Причина в комментарии 75-78:
экранный нормализатор (`v4450-ux-system.js`) до содержимого файлов не дотягивается.

### 9.7. Простой CSV/GeoJSON - `v493-portfolio-suite.js:191`

`window.case493Export=function(kind){...}` - GeoJSON через `JSON.stringify(gj,null,2)`,
CSV с BOM `'﻿'+out.join('\n')`, оба через общий `saveFile(name, content, type)`
(строка 190: сначала пробует глобальный `download()` ядра, иначе `Blob` + `<a download>`).
Экранирование ячеек CSV - `safeCsv(v)`, строка 189, с защитой от формул:
`if(/^[=+\-@]/.test(s))s="'"+s;`.

---

## 10. Стиль кода

### 10.1. Отступы

Табов нет ни в одном разобранном файле. Гистограмма ведущих пробелов:

| файл | преобладающий отступ |
|---|---|
| `core.js` | **1 пробел** на уровень (2021 строк с 1, 574 с 2, 265 с 3) |
| `v493-portfolio-suite.js` | 0/1 пробел (плоский стиль, тело IIFE без отступа) |
| `v3520-workspaces.js` | **2 пробела** (уровни 2/4/6) |
| `v4630-huff.js` | **2 пробела** |
| `v4530-geo-export.js` | **2 пробела** |
| `api/lib.php`, `api/state.php`, `api/project_files.php` | **2 пробела** |

Вывод: `core.js` и старые модули - 1 пробел; **все новые модули (v44xx, v45xx, v46xx) и весь
PHP - 2 пробела**. Для нового модуля правильный выбор - 2 пробела.

### 10.2. Кавычки и синтаксис

- JS: одинарные кавычки везде. Двойные - только внутри генерируемого HTML/XML
  (`'<div class="card">'`) и в JSON-литералах данных (`v493:8` `COORDS`).
- Template literals (backtick) - в `core.js` (`renderOrg`, `renderPerm`) и в CSS-блоках
  модулей (`v493:192`, `v492` - конец файла). В `v4630-huff.js` и `v4530-geo-export.js`
  строки склеиваются через `+` даже в многострочном HTML.
- ES5 в модулях: `var`, `function(){}`, `.forEach`, `.map`; стрелочные функции и `const/let`
  - только в `core.js`. `v4630-huff.js` использует `Number.isFinite` (строка 32) и
  `async/await` встречается в `v4530-geo-export.js:1176`.
- PHP: `declare(strict_types=1);` (`lib.php:3`, `project_files.php:4`; в `sales.php` его нет),
  типизированные сигнатуры `function foo(string $x): array`, оператор `??`,
  одинарные кавычки, конкатенация точкой, однострочные `if (...) fail(...);` без скобок.
- SQL: ключевые слова в верхнем регистре, имена таблиц/колонок в нижнем,
  зарезервированное `key` - в бэктиках.

### 10.3. Комментарии

**Русский - язык объяснений.** Английский встречается только в коротких шапках
(`v493-portfolio-suite.js:1-3`, `lib.php:283-285`, `state.php:20-26`).

Устойчивые жанры комментариев:

1. **Шапка файла** - 1-26 строк «зачем этот модуль», с формулами и границами метода:
   `v4630-huff.js:1-26`, `v4530-geo-export.js:1-13`, `v4660-uz-translit.js:1-43`.
2. **Версионная пометка перед правкой** - `/* v4.58.0: … */`, `/* v4.42.1: … */`,
   `/* P1-5: … */`, `/* P2-04 … */`. Примеры: `core.js:143`, `core.js:157-159`,
   `v3520-workspaces.js:150-151`, `v3520:208`, `sw.js:35-39`.
3. **Разбор бага, который правка закрывает** - почти всегда с описанием симптома:
   `v3520-workspaces.js:310-314`, `sw.js:5-7`, `core.js:327-330`, `v4660:17-21`.
4. **Секционные разделители** - `/* ================= Excel (.xlsx) ================= */`
   (`v4530-geo-export.js:583`, 831, 1168, 1232), `// ── Ответы ─────────` (`lib.php:54`),
   `/* ===== i18n ===== */` (`core.js:7`), `/* ===== STATE ===== */` (`core.js:870`).
5. **Честные оговорки** - `v4630-huff.js:23-25` («Честная граница метода»),
   `v4530-geo-export.js:1175` («Пустую карту в презентацию класть нельзя: она выглядит
   как готовая, но врёт»).

### 10.4. Именование

| сущность | конвенция | примеры |
|---|---|---|
| файл модуля | `v<версия без точек>-<тема>.js` | `v3520-workspaces.js`, `v4630-huff.js`, `v4660-uz-translit.js` |
| флаг «уже загружен» | `window.CASE_<ИМЯ>` / `window.CASE_V<номер>_<ИМЯ>` | `CASE_WORKSPACES_480`, `CASE_V493_PORTFOLIO`, `CASE_V492_INSTALLED`, `CASE_UZ_TRANSLIT` |
| маркер на обёрнутом `go` | `_case<номер>` | `go._case493`, `go._case492`, `go._casews480`, `go._nav437` |
| публичный фасад | `window.CASE_<ИМЯ>` (UPPER_SNAKE) | `CASE_HUFF`, `CASE_UZ_TRANSLIT`, `CASE_OS_MODULES`, `CASE_MODULE_VERSIONS` |
| обработчики из HTML | `case<номер><Глагол>` (lowerCamel) | `case493Search`, `case493ProjectSave`, `caseHuffOpen`, `caseFeatureSet`, `caseGeoExportXlsx` |
| id `<style>` | `case<номер><Тема>Css` | `case493PortfolioCss`, `case480wscss` |
| CSS-классы | `case<номер>-<блок>-<элемент>` или короткий префикс | `.case493-list-item`, `.case492-builder-grid`, `.ws-module`, `.ff-row`, `.gd-step` |
| view (`v`) | snake_case, префикс домена | `advisory_proposal_builder`, `leasing_portfolio_map`, `finance_project_pnl` |
| ключ состояния | UPPER_SNAKE с префиксом `CASE_` для новых | `CASE_PROPOSALS`, `CASE_PROPOSAL_CATALOG`, `CASE_DOCUMENT_TEMPLATES` |
| PHP-функции рабочих областей | `asaas_*` | `asaas_workspace_can_view`, `asaas_module_status` |
| PHP-функции модуля-эндпоинта | `<модуль>_<действие>` | `case_files_dir`, `case_file_has_view`, `sales_table_from_type` |
| SQL-индексы | `idx_<префикс>_<поле>`, `uq_<префикс>_<смысл>` | `idx_feas_obj`, `uq_feas_version` |
| миграции | `YYYY_MM_DD_<тема>.sql` | `2026_08_13_role_dir.sql` |

### 10.5. Прочие устойчивые привычки

- Любое обращение к чужой глобали обёрнуто в `try/catch` с пустым `catch(e){}`.
- Экранирование обязательно и делается локальной функцией (`esc`, `E`, `escp`, `escH`, `h`, `xe`).
- Числа для показа - `toLocaleString('ru')` (`v4630-huff.js:143`) или
  `Intl.NumberFormat('ru-RU')` (`v493:34`).
- Фирменный цвет `#9E0000` (и `--red`, `--red-d` `#7a0000`) захардкожен в SVG и в XML выгрузок.
- Сообщения пользователю - через `toast(...)` ядра; `alert(...)` только там, где действие
  прерывается (`v4630`? нет; `v4530-geo-export.js:1241`, `v493:174`).

---

## Чек-лист для модуля «Offer Builder»

Собран из перечисленного выше; каждая строка - реальное место в коде.

1. `os/v3520-workspaces.js` - запись в `MODULES` (в блоке группы `advisory`, строки 26-39),
   с `v`, `g:'advisory'`, `icon`, `ru`/`uz`/`en`, `nav:true`; при необходимости - дописать
   view в `DEFAULTS.BA` (139), `DEFAULTS.HM` (144), `DEFAULTS.BSH` (143).
2. `os/core.js:1144` - добавить id в литерал `validViews`.
3. `os/api/lib.php:164-173` - добавить id в `$all` внутри `asaas_workspace_default_views()`;
   при необходимости - в наборы конкретных ролей (176-182).
4. `os/api/state.php:95-139` - строка в `workspace_view_keys()` для новых ключей состояния;
   ключи - в `all_shared_state_keys()` (47-59).
5. `os/core.js:130` (`stateBlob`), `os/core.js:929+` (`applyState`), `os/core.js:156`
   (`STATE_KEY_LABELS`) - если появляется новая коллекция данных.
6. Новый файл `os/v<NNNN>-offer-builder.js`: IIFE + `'use strict'` + флаг `window.CASE_…`
   + `var VERSION='<x.y.z>'` + `css()` с уникальным `id` + `render/redraw/display`
   + перехват `window.go` с маркером и проверкой `caseWorkspaceCanOpen`
   + `DOMContentLoaded {once:true}` + экспорт `window.CASE_…`
   + `window.CASE_MODULE_VERSIONS['v<NNNN>-offer-builder']=VERSION;`.
7. `os/index.html` - поднять `APP_VERSION` (459), добавить пару в `CASE_EXPECTED_MODULES` (462),
   добавить `<script src="…?v=<версия модуля>" defer>` в конец списка (после 491).
8. `os/sw.js` - поднять комментарий версии (1), имя `CACHE` (2), добавить путь в `ASSETS` (3).
9. При новых таблицах - `os/sql/migrations/YYYY_MM_DD_<тема>.sql` (идемпотентно,
   `CREATE TABLE IF NOT EXISTS`, `ON DUPLICATE KEY UPDATE`, комментарий-шапка,
   проверочный `SELECT` в конце) и, при желании, зеркало в `os/sql/install_all.sql`.
10. При новом эндпоинте - `os/api/<имя>.php` по образцу `sales.php`/`project_files.php`:
    `require lib.php` → `require_login()` → `case_..._has_view()` через
    `asaas_workspace_can_view` → `can('edit'|'admin')` → `json_out`/`fail` → `audit`.
11. `os/v450-guides.js` - гид раздела в `GUIDE(v)` (объект `G`, строки 29+); без него
    кнопка «?» покажет заглушку (строка 112).
12. `os/DEPLOY.md` (версия, список изменённых файлов, критерий приёмки),
    `CHANGELOG_CASE_OS_v<версия>.md`, `os/SHA256SUMS_v<версия>.txt`.
