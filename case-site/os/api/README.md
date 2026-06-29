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
