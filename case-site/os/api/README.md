# CASE OS — бэкенд на вашем хостинге (PHP + MySQL)

Без внешних сервисов: данные в вашей MySQL, API на PHP, всё под доменом
`caseadvisory.uz/os`. Подходит для cPanel (webspace.uz / webname.uz).

## Состав
- `os/sql/schema_mysql.sql` — таблицы (импорт в phpMyAdmin)
- `os/sql/seed_roles.sql` — 7 ролей
- `os/api/*.php` — API: вход, данные, пользователи, разовая настройка
- `config.php` — данные подключения к БД (создаёте вы; в git не попадает)

## Установка (по шагам в cPanel)

1. **Файлы.** Загрузить папку `os/` в `public_html` (как в DEPLOY.md), чтобы
   было `public_html/os/api/...` и `public_html/os/sql/...`.

2. **База данных.** cPanel → **MySQL Databases**:
   - создать БД (напр. `caseadv_os`);
   - создать пользователя БД + пароль;
   - добавить пользователя к БД со всеми привилегиями.

3. **Импорт схемы.** cPanel → **phpMyAdmin** → выбрать БД → **Import**:
   сначала `os/sql/schema_mysql.sql`, затем `os/sql/seed_roles.sql`.

4. **Конфиг.** В `os/api/` скопировать `config.sample.php` → `config.php`
   и вписать `name`/`user`/`pass` из шага 2 (`driver` оставить `mysql`).

5. **Первый администратор.** Открыть в браузере
   `https://caseadvisory.uz/os/api/setup.php` → ввести email/пароль/имя →
   создаётся CEO (роль ASH). **Затем удалить `setup.php` с сервера.**

6. **HTTPS** обязателен (Let's Encrypt в cPanel).

После этого вход в платформу — по email/паролю; права берутся из БД.

## API (для справки)
- `POST api/auth.php {action:login,email,password}` · `GET api/auth.php` (me) · `{action:logout}`
- `GET  api/data.php?table=units&obj=ca` — список (с учётом прав, маскировкой
  финансов и фильтром «только свои»)
- `POST api/data.php {table, row}` — создать/изменить · `{table, delete:id}` — удалить
- `POST api/users.php {action:create|setpass,...}` — управление пользователями (admin)

Все изменения пишутся в `audit_log` автоматически.

## Безопасность
- Пароли — `password_hash` (bcrypt). Сессии — httponly-cookie.
- Доступ к таблицам — по правам роли (leasing/finance/edit/own_only/admin).
- Финансовые поля (ставка, бюджет) не отдаются ролям без `finance`.
- `audit_log` — только запись и чтение (admin); правка/удаление не предусмотрены.
- `config.php`, `lib.php`, `*.sqlite` закрыты через `.htaccess`.
- Белый список таблиц/столбцов в `lib.php` — защита от инъекций.


## Financial Feasibility (v4.5.0)
- `GET api/feasibility_models.php` — список сценариев финансовой модели.
- `GET api/feasibility_models.php?id=...` — модель и история ревизий.
- `POST api/feasibility_models.php {action:save,...}` — создать или сохранить новую ревизию.
- `POST api/feasibility_models.php {action:restore,id,revision}` — восстановить ревизию как новую версию.
- `POST api/feasibility_models.php {action:delete,id}` — удалить модель и её историю.

Endpoint повторно проверяет на сервере матрицу разделов CASE OS. Раздел доступен любому пользователю, которому администратор включил `Финансовую модель проекта`; сохранение дополнительно требует права `Правки`, `Финансы` или `Администрирование`.

## CASE OS v4.9.3 workflow and project files

The shared `state.php` payload now includes the CASE workflow entities used by CRM, Advisory delivery, tasks, Scope Changes, deliverables and layout versioning. Access remains constrained by the effective workspace matrix. Users without the legacy global `edit` flag may save workflow records only when the relevant workflow workspace is explicitly available to their role/user. Project-scoped users receive and save only the workflow rows assigned to their projects; rows from other projects are restored from the server copy during save.

`project_files.php` is the authenticated file gateway for layout versions and document templates:

- maximum file size: 25 MiB;
- CSRF and same-origin checks on upload;
- workspace and project-scope checks on upload and download;
- allow-listed extensions and executable payload rejection;
- SHA-256 recorded for every uploaded file;
- physical files are stored in `data/case_files/`, which is denied from direct web access by `.htaccess`.

Do not expose `data/case_files/` directly through the web server. Keep its `.htaccess` in place and back up the directory together with the database.

## CASE OS v4.9.9 — Geoanalytics persistence

Geoanalytics no longer writes through the general `state.php` round-trip. Use `geo_state.php`:

- `GET geo_state.php` — current server GEO_DATA and geo revision;
- `POST geo_state.php` — transactional GEO_DATA save;
- `GET geo_state.php?history=1` — recent protected snapshots for editors;
- `POST geo_state.php` with `action=restore` and `history_id` — admin restore.

The general `state.php` preserves server GEO_DATA when a stale full-state client tries to change it.

## CASE OS v4.10.0 — global module lifecycle

`MODULE_FLAGS` хранит глобальный статус каждого раздела: `active`, `beta` или `hidden`.
Настройка изменяется только администратором. Сервер фильтрует effective workspace views,
не принимает неизвестные ID/статусы и всегда оставляет активными `dash` и `users`, чтобы
администратор не мог заблокировать доступ к настройкам. Отдельная SQL-миграция не требуется.
