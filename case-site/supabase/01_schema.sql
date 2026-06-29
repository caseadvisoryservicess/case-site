-- CASE OS — схема БД (P1). Запускать в Supabase SQL Editor первым.
-- Идемпотентно в пределах разумного: повторный запуск не выполняйте на боевой БД.

create extension if not exists pgcrypto;

-- ── Роли и пользователи ───────────────────────────────────────────────
create table if not exists roles (
  key        text primary key,
  label      text not null,
  leasing    boolean not null default false,
  finance    boolean not null default false,
  edit       boolean not null default false,
  approve    boolean not null default false,
  plans      boolean not null default false,
  own_only   boolean not null default false,
  admin      boolean not null default false
);

create table if not exists app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  title       text,
  role_key    text not null references roles(key),
  broker_name text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Объекты и помещения ───────────────────────────────────────────────
create table if not exists objects (
  id         text primary key,
  name       text not null,
  ru         text,
  country    text default 'Узбекистан',
  city       text,
  type       text,
  gba        numeric, gla numeric,
  plan       text,
  sc numeric, inc numeric,
  cur text, cond text, levels text,
  vat text, vat_rate numeric,
  comm       jsonb,
  created_at timestamptz not null default now()
);

create table if not exists units (
  id          uuid primary key default gen_random_uuid(),
  obj_id      text not null references objects(id) on delete cascade,
  code        text not null,
  floor       text,
  area        numeric not null default 0,
  terr        numeric not null default 0,
  cat text, sub text,
  rate        numeric not null default 0,
  budget      numeric,
  status      text not null default 'vac',
  broker      text,
  assigned_to uuid references app_users(id),
  vars        jsonb not null default '[]',
  shortlist   jsonb not null default '[]',
  merged      jsonb,
  offer       jsonb,
  updated_at  timestamptz not null default now(),
  unique (obj_id, code)
);
create index if not exists idx_units_obj    on units(obj_id);
create index if not exists idx_units_status on units(status);
create index if not exists idx_units_broker on units(broker);

create table if not exists control_dates (
  id        uuid primary key default gen_random_uuid(),
  unit_id   uuid references units(id) on delete cascade,
  label     text, date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_cdates_date on control_dates(date);

create table if not exists unit_comments (
  id      uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete cascade,
  author  uuid references app_users(id),
  at      timestamptz not null default now(),
  body    text
);

-- ── Бренды ────────────────────────────────────────────────────────────
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  name text not null, cat text, sub text, country text,
  amin numeric, amax numeric, format text, fr text, reqs text, coten text,
  person text, phone text, email text, site text, ig text,
  status text default 'target',
  notes text, about text, pos text, concept text, rec text,
  founded text, "group" text, price text, icsc text, uz_op text,
  net_pts text, net_countries text,
  logo text, shopfront text, interior text,
  edited_by text, edited_at timestamptz not null default now()
);

-- ── Прочие справочники ────────────────────────────────────────────────
create table if not exists registry_changes (
  id uuid primary key default gen_random_uuid(),
  obj_id text references objects(id) on delete cascade,
  date date, type text, what text, by_name text,
  created_at timestamptz not null default now()
);

create table if not exists benchmarks (
  id uuid primary key default gen_random_uuid(),
  city text, district text, obj text, cat text, rent numeric, sc numeric, note text
);

create table if not exists refusals (
  id uuid primary key default gen_random_uuid(),
  obj_id text references objects(id) on delete cascade,
  brand text, reason text, date date
);

-- ── Документы ─────────────────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  t text, type text, no text, to_name text,
  obj_id text references objects(id) on delete set null,
  lang text, fname text, status text default 'draft',
  ver int not null default 1, raw text,
  by_id uuid references app_users(id),
  at timestamptz not null default now()
);

create table if not exists document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  ver int, raw text, by_name text, at timestamptz
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text, title text, phone text, email text
);

-- ── KPI / журналы ─────────────────────────────────────────────────────
create table if not exists agent_metrics (
  user_id uuid primary key references app_users(id) on delete cascade,
  touch int default 0, meet int default 0, view int default 0,
  loi int default 0, sign int default 0,
  earned numeric default 0, pipe numeric default 0
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  kind text, by_id uuid references app_users(id),
  obj_id text, at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  by_id uuid references app_users(id),
  role_key text, action text, detail text,
  at timestamptz not null default now()
);

create table if not exists kp_counters (
  obj_id text primary key references objects(id) on delete cascade,
  last_no int not null default 0
);
