# CASE OS — План бэкенда (этап 4: архитектура)

Документ для согласования **до написания кода**. Цель — перевести прототип
(сейчас данные в `localStorage`, по браузерам) на общий бэкенд с реальными
логинами, единой БД, серверными правами и аудитом. UI остаётся прежним —
меняется только слой данных.

Рекомендуемый стек: **Supabase** (PostgreSQL + Auth + Row-Level Security +
Storage + Realtime + Edge Functions). Минимум серверного кода, права на уровне
строк ложатся ровно на вашу модель ролей.

---

## 1. Роли и права (как сейчас в приложении)

| Ключ | Роль | leasing | finance | edit | approve | plans | own_only | admin |
|------|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| ASH | Founder / CEO | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| ADM | Администратор | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ |
| BA  | Leasing Director | ✓ | ✓ | ✓ | – | – | – | – |
| AG  | Агент аренды | ✓ | – | ✓ | – | – | (опц.) | – |
| HO  | Lease Admin (тыл) | ✓ | – | ✓ | – | – | – | – |
| BSH | Архитектор | ✓ | – | ✓ | – | ✓ | – | – |
| HM  | Advisory Manager | ✓ | ✓ | – | – | – | – | – |

Значение прав:
- **leasing** — доступ к реестру/сделкам;
- **finance** — видит финансовые поля (ставка, бюджет, аренда/мес, комиссии, NOI);
- **edit** — правки данных;
- **approve** — виза по ставкам;
- **plans** — загрузка планировок;
- **own_only** — агент видит только свои сделки (по `broker`/назначению);
- **admin** — управление пользователями и правами.

Права редактируемы (матрица «Права ролей») и должны храниться в БД.

---

## 2. Схема БД (PostgreSQL)

Отображение текущих структур приложения на таблицы.

```sql
-- Справочник ролей (редактируется админом в UI)
create table roles (
  key        text primary key,           -- ASH, ADM, BA, AG, HO, BSH, HM
  label      text not null,
  leasing    boolean default false,
  finance    boolean default false,
  edit       boolean default false,
  approve    boolean default false,
  plans      boolean default false,
  own_only   boolean default false,
  admin      boolean default false
);

-- Пользователи (связаны с auth.users Supabase)
create table app_users (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  title      text,
  role_key   text not null references roles(key),
  broker_name text,                       -- для own_only сопоставления со сделками
  active     boolean default true,
  created_at timestamptz default now()
);

-- Объекты
create table objects (
  id         text primary key,            -- ca, zm, gb, mh, ...
  name       text not null,
  ru         text,
  country    text default 'Узбекистан',
  city       text,
  type       text,
  gba        numeric,
  gla        numeric,
  plan       text,                        -- 'Свой объект' / 'Подписка ТЦ'
  sc         numeric, inc numeric,
  cur        text, cond text, levels text,
  vat        text, vat_rate numeric,
  comm       jsonb,                        -- {type,total,note}
  created_at timestamptz default now()
);

-- Помещения (LCR)
create table units (
  id          uuid primary key default gen_random_uuid(),
  obj_id      text not null references objects(id) on delete cascade,
  code        text not null,
  floor       text,
  area        numeric default 0,
  terr        numeric default 0,
  cat         text, sub text,
  rate        numeric default 0,           -- ставка/предложение $/м² (finance)
  budget      numeric,                     -- бюджетная ставка, план (finance)
  status      text default 'vac',          -- vac/neg/off/os/cs/cd/res
  broker      text,
  assigned_to uuid references app_users(id),-- для own_only
  vars        jsonb default '[]',          -- бренды-кандидаты
  shortlist   jsonb default '[]',
  merged      jsonb,                        -- коды объединённых
  offer       jsonb,                        -- {to,by,date,no,validUntil,...}
  updated_at  timestamptz default now(),
  unique (obj_id, code)
);

-- Контрольные даты (отдельно — для дашборда «Критич. даты»)
create table control_dates (
  id        uuid primary key default gen_random_uuid(),
  unit_id   uuid references units(id) on delete cascade,
  label     text, date date,
  created_at timestamptz default now()
);

-- Комментарии по сделке (timeline)
create table unit_comments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete cascade,
  author uuid references app_users(id), at timestamptz default now(), body text
);

-- Бренды
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null, cat text, sub text, country text,
  amin numeric, amax numeric, format text, fr text, reqs text, coten text,
  person text, phone text, email text, site text, ig text,
  status text default 'target',            -- active/target/refused
  notes text, about text, pos text, concept text, rec text,
  founded text, "group" text, price text, icsc text, uz_op text,
  net_pts text, net_countries text,
  logo text, shopfront text, interior text, -- storage paths
  edited_by text, edited_at timestamptz default now()
);

-- Изменения по объекту (вторая сторона LCR)
create table registry_changes (
  id uuid primary key default gen_random_uuid(),
  obj_id text references objects(id), date date, type text, what text,
  by_name text, created_at timestamptz default now()
);

-- Бенчмаркинг
create table benchmarks (
  id uuid primary key default gen_random_uuid(),
  city text, district text, obj text, cat text, rent numeric, sc numeric, note text
);

-- Отказы
create table refusals (
  id uuid primary key default gen_random_uuid(),
  obj_id text references objects(id), brand text, reason text, date date
);

-- Документы (КП/LOI/напоминания) + версии
create table documents (
  id uuid primary key default gen_random_uuid(),
  t text, type text, no text, to_name text, obj_id text references objects(id),
  lang text, fname text, status text default 'draft', -- draft/sent/acc/rej
  ver int default 1, raw text,
  by_id uuid references app_users(id), at timestamptz default now()
);
create table document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  ver int, raw text, by_name text, at timestamptz
);

-- Контактные лица для документов
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text, title text, phone text, email text
);

-- KPI-метрики агентов (неделя)
create table agent_metrics (
  user_id uuid primary key references app_users(id) on delete cascade,
  touch int default 0, meet int default 0, view int default 0,
  loi int default 0, sign int default 0,
  earned numeric default 0, pipe numeric default 0
);

-- Журнал активности (касания/показы)
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  kind text, by_id uuid references app_users(id), obj_id text, at timestamptz default now()
);

-- Аудит (кто что менял) — серверный, обойти нельзя
create table audit_log (
  id bigserial primary key,
  by_id uuid references app_users(id), role_key text,
  action text, detail text, at timestamptz default now()
);

-- Счётчики номеров КП по объектам
create table kp_counters (
  obj_id text primary key references objects(id), last_no int default 0
);
```

Файлы (планировки SVG/PNG, логотипы и витрины брендов, печать/логотип
компании) — в **Supabase Storage**, buckets: `plans`, `brands`, `company`.
В таблицах хранится только путь.

---

## 3. Права доступа (RLS)

Хелпер: текущие права из роли пользователя.

```sql
create or replace function my_rights() returns roles language sql stable as $$
  select r.* from roles r
  join app_users u on u.role_key = r.key
  where u.id = auth.uid();
$$;
```

Примеры политик:

```sql
alter table units enable row level security;

-- Чтение: leasing-роли; own_only — только свои назначенные/брокерские
create policy units_select on units for select using (
  (select leasing from my_rights())
  and (
    not (select own_only from my_rights())
    or assigned_to = auth.uid()
    or broker = (select broker_name from app_users where id = auth.uid())
  )
);

-- Запись: только edit-роли
create policy units_write on units for all using (
  (select edit from my_rights())
) with check ((select edit from my_rights()));
```

- **Финансовые поля** (`rate`, `budget`, комиссии, NOI): RLS работает по строкам,
  не по колонкам. Поэтому для не-finance ролей делаем **представление `v_units`**,
  где финансовые колонки отдаются как `null`, и приложение читает из него
  (плюс текущая маскировка в UI остаётся как второй слой).
- **roles / app_users**: запись только при `admin`.
- **audit_log**: insert — всем аутентифицированным; update/delete — запрещены
  (только чтение для admin). Так аудит нельзя подделать.
- **own_only**: на `units`, `documents`, `activity_log` фильтр по пользователю.

---

## 4. Аутентификация

- Supabase Auth (email + пароль; при желании — магические ссылки/OTP).
- При создании пользователя админом → запись в `app_users` с `role_key`.
- Экран входа приложения заменяет текущий выбор роли на реальный логин;
  после входа права берутся из `roles` по `role_key` пользователя.

---

## 5. Миграция данных

1. В приложение добавляется кнопка **«Экспорт всех данных (JSON)»** — выгружает
   текущее состояние (объекты, помещения, бренды и т.д.) из `localStorage`.
2. Сид-скрипт загружает JSON в Supabase (объекты → помещения → бренды → …).
3. Реальные данные (LCR, бренды) можно дозалить через готовый CSV-импорт.

---

## 6. Этапы внедрения

- **P0. Архитектура** — этот документ (согласование). ← мы здесь
- **P1. Инфраструктура** — Supabase: схема, RLS, Storage, сид демо-данных.
- **P2. Слой данных** — модуль `data.js`: чтение/запись через Supabase-клиент
  вместо `localStorage`; переключатель `local | remote` (чтобы не ломать демо).
- **P3. Аутентификация** — экран входа на Supabase Auth, права из БД.
- **P4. Realtime + уведомления** — живые обновления у всех; Edge Function +
  `pg_cron` для авто-напоминаний по контрольным датам (Telegram/email).
- **P5. Деплой и боевая проверка** — фронт на Netlify, бэкенд Supabase;
  2–3 реальных пользователя, реальные данные, тест «на живой модели».

---

## 7. Что понадобится от вас (для P1)

- Проект Supabase (создать) — или доступ, чтобы я подготовил схему.
- Регион БД (ближайший к Ташкенту, напр. EU-Central).
- Подтверждение хостинга фронта (Netlify — текущий).
- Позже, для P4: Telegram-бот (token + chat) и/или SMTP для писем.
- Реальные данные: LCR, база брендов, список пользователей с ролями.

---

## 8. Безопасность

- Доступ к данным — только через RLS (нельзя обойти из консоли браузера).
- `service_role`-ключ — только на сервере/в Edge Functions, никогда во фронте.
- Финансовые данные — через `v_units` (+ UI-маскировка).
- Аудит — append-only, правка/удаление запрещены политикой.
- Резервные копии БД — штатные бэкапы Supabase.
