# CASE OS — размещение на caseadvisory.uz/os

Платформа — статический фронт (`os/index.html` + `os/sw.js`), данные — в
Supabase по HTTPS. На ваш хостинг кладутся только статические файлы; серверный
код не нужен.

## Что разместить
Папку `os/` целиком в каталог, который отдаётся по адресу
`https://caseadvisory.uz/os/` — то есть файлы окажутся как:
- `…/os/index.html`
- `…/os/sw.js`
- `…/os/zarafshan-l1.pdf`, `…/os/zarafshan-l2.svg` (если используете)

Ссылка `caseadvisory.uz/os` должна открывать `index.html` (индекс каталога).

## Обязательные требования
- **HTTPS** на домене (Let's Encrypt). Нужно для Service Worker, PWA и
  безопасных вызовов Supabase. По http работать корректно не будет.
- **Слэш в конце**: давайте людям ссылку `https://caseadvisory.uz/os/`
  (со слэшем) — тогда относительные пути (`sw.js`, manifest) и scope PWA
  считаются от `/os/`. Это уже учтено в коде (всё относительное).

## Варианты хостинга

### A. Обычный хостинг (cPanel / shared)
1. File Manager → `public_html` → создать папку `os`.
2. Загрузить туда `index.html`, `sw.js` и файлы планировок.
3. Проверить, что включён HTTPS (AutoSSL/Let's Encrypt).
Готово — `https://caseadvisory.uz/os/` работает.

### B. VPS / nginx
```nginx
location /os/ {
    alias /var/www/caseadvisory/os/;
    try_files $uri $uri/ /os/index.html;
    add_header Cache-Control "no-cache";   # чтобы обновления подхватывались
}
```
`sw.js` лучше отдавать без долгого кэша:
```nginx
location = /os/sw.js { alias /var/www/caseadvisory/os/sw.js; add_header Cache-Control "no-cache"; }
```

## Бэкенд (PHP + MySQL на этом же хостинге)
Бэкенд лежит рядом, в `os/api/` + `os/sql/`, и работает с вашей MySQL.
Установка — см. `os/api/README.md` (создать БД, импортировать схему,
заполнить `config.php`, создать первого админа через `setup.php`).
Внешние сервисы не нужны; всё под `caseadvisory.uz/os`.

## Обновления
При каждом обновлении платформы:
1. Заменить `index.html` (и при изменениях — `sw.js`).
2. В `sw.js` поднять версию кэша (`CACHE = 'case-os-vN'`), чтобы у всех
   подтянулась новая версия, а не старая из кэша.

## Поддомен (альтернатива, по желанию)
Вместо подпапки можно сделать `os.caseadvisory.uz` (A/CNAME-запись →
тот же хостинг, отдельный SSL). Функционально равнозначно; подпапка `/os`
проще, если сайт уже на этом хостинге.
