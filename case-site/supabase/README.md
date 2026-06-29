# CASE OS — установка бэкенда (Supabase), P1

Проект уже создан: `https://tpoxtyedmtalatatypjq.supabase.co` (регион Sydney).
Ниже — что нажать. Все SQL-файлы проверены на реальном PostgreSQL.

## 1. Применить схему и права

Supabase Dashboard → **SQL Editor** → **New query**. Выполнить по очереди
(каждый файл — отдельный запуск, в этом порядке):

1. `01_schema.sql` — таблицы (18 шт.)
2. `02_policies.sql` — права RLS (34 политики) + представление `v_units`
3. `03_seed_roles.sql` — 7 ролей с правами

После этого в **Table Editor** появятся таблицы; в **Authentication → Policies**
— политики.

## 2. Хранилище файлов

Dashboard → **Storage** → создать 3 bucket (Private):
- `plans` — планировки (SVG/PNG)
- `brands` — логотипы/витрины/интерьеры брендов
- `company` — логотип и печать компании

(Политики доступа к Storage добавим на P2 вместе со слоем данных.)

## 3. Первый пользователь-администратор

1. **Authentication → Users → Add user** — e-mail + пароль (это вы, CEO).
2. Скопировать его **User UID**.
3. **SQL Editor**, выполнить (подставив UID, имя):

```sql
insert into app_users (id, name, title, role_key, broker_name)
values ('ВСТАВЬТЕ-UID', 'Aziz Shermukhamedov', 'Founder / CEO', 'ASH', 'Азиз');
```

Дальше остальных пользователей можно заводить так же (или из UI на P3).

## 4. Ключи для фронтенда (P2)

Dashboard → **Project Settings → API**:
- **Project URL** — `https://tpoxtyedmtalatatypjq.supabase.co`
- **anon public key** — можно встраивать во фронт (данные защищает RLS).
- **service_role key** — НИКОГДА не во фронт; только сервер/Edge Functions.

## 5. Что дальше (P2)

В `index.html` добавляется слой данных на `@supabase/supabase-js`:
чтение/запись через БД вместо `localStorage`, с переключателем
`local | remote`, и Storage-политики для bucket-ов. Затем P3 (вход по
логину) и P4 (realtime + авто-уведомления по контрольным датам).

## Проверка прав (по желанию)

После сидов можно убедиться, что роли на месте:

```sql
select key, label, finance, edit, admin, own_only from roles order by key;
```
