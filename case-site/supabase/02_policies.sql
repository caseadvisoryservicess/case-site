-- CASE OS — права доступа (RLS). Запускать вторым, после 01_schema.sql.

-- ── Хелперы прав текущего пользователя (SECURITY DEFINER — без рекурсии RLS) ──
create or replace function can(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case p
      when 'leasing'  then leasing  when 'finance' then finance
      when 'edit'     then edit     when 'approve' then approve
      when 'plans'    then plans    when 'own_only' then own_only
      when 'admin'    then admin    else false end
    from roles r join app_users u on u.role_key = r.key
    where u.id = auth.uid()
  ), false);
$$;

create or replace function my_broker() returns text
language sql stable security definer set search_path = public as $$
  select broker_name from app_users where id = auth.uid();
$$;

-- ── Включаем RLS ───────────────────────────────────────────────────────
alter table roles            enable row level security;
alter table app_users        enable row level security;
alter table objects          enable row level security;
alter table units            enable row level security;
alter table control_dates    enable row level security;
alter table unit_comments    enable row level security;
alter table brands           enable row level security;
alter table registry_changes enable row level security;
alter table benchmarks       enable row level security;
alter table refusals         enable row level security;
alter table documents        enable row level security;
alter table document_versions enable row level security;
alter table contacts         enable row level security;
alter table agent_metrics    enable row level security;
alter table activity_log     enable row level security;
alter table audit_log        enable row level security;
alter table kp_counters      enable row level security;

-- ── Роли и пользователи ───────────────────────────────────────────────
create policy roles_read   on roles      for select using (auth.uid() is not null);
create policy roles_admin  on roles      for all    using (can('admin')) with check (can('admin'));
create policy users_read   on app_users  for select using (auth.uid() is not null);
create policy users_admin  on app_users  for all    using (can('admin')) with check (can('admin'));

-- ── Объекты ───────────────────────────────────────────────────────────
create policy obj_read  on objects for select using (can('leasing'));
create policy obj_write on objects for all    using (can('edit')) with check (can('edit'));

-- ── Помещения (с own_only) ────────────────────────────────────────────
create policy units_read on units for select using (
  can('leasing') and (
    not can('own_only')
    or assigned_to = auth.uid()
    or broker = my_broker()
  )
);
create policy units_write on units for all using (can('edit')) with check (can('edit'));

-- ── Связанные с помещениями ───────────────────────────────────────────
create policy cdates_read  on control_dates for select using (can('leasing'));
create policy cdates_write on control_dates for all    using (can('edit')) with check (can('edit'));
create policy ucom_read    on unit_comments for select using (can('leasing'));
create policy ucom_write   on unit_comments for all    using (can('edit')) with check (can('edit'));

-- ── Бренды и справочники ──────────────────────────────────────────────
create policy brands_read  on brands           for select using (can('leasing'));
create policy brands_write on brands           for all    using (can('edit')) with check (can('edit'));
create policy chg_read     on registry_changes for select using (can('leasing'));
create policy chg_write    on registry_changes for all    using (can('edit')) with check (can('edit'));
create policy bench_read   on benchmarks       for select using (can('leasing'));
create policy bench_write  on benchmarks       for all    using (can('edit')) with check (can('edit'));
create policy ref_read     on refusals         for select using (can('leasing'));
create policy ref_write    on refusals         for all    using (can('edit')) with check (can('edit'));

-- ── Документы ─────────────────────────────────────────────────────────
create policy doc_read   on documents         for select using (can('leasing'));
create policy doc_write  on documents         for all    using (can('edit')) with check (can('edit'));
create policy dver_read  on document_versions for select using (can('leasing'));
create policy dver_write on document_versions for all    using (can('edit')) with check (can('edit'));
create policy cont_read  on contacts          for select using (can('leasing'));
create policy cont_write on contacts          for all    using (can('edit')) with check (can('edit'));

-- ── KPI / журналы ─────────────────────────────────────────────────────
create policy am_read   on agent_metrics for select using (can('leasing'));
create policy am_write  on agent_metrics for all    using (can('edit')) with check (can('edit'));
create policy act_read  on activity_log  for select using (can('leasing'));
create policy act_ins   on activity_log  for insert with check (auth.uid() is not null);
create policy kp_read   on kp_counters   for select using (can('leasing'));
create policy kp_write  on kp_counters   for all    using (can('edit')) with check (can('edit'));

-- Аудит: вставлять может любой вошедший; читать — только admin;
-- update/delete не разрешены (нет политик) => журнал нельзя подделать.
create policy audit_ins  on audit_log for insert with check (auth.uid() is not null);
create policy audit_read on audit_log for select using (can('admin'));

-- ── Финансовые поля через представление (колоночная защита) ───────────
create or replace view v_units as
  select id, obj_id, code, floor, area, terr, cat, sub,
    case when can('finance') then rate   else null end as rate,
    case when can('finance') then budget else null end as budget,
    status, broker, assigned_to, vars, shortlist, merged, offer, updated_at
  from units;
alter view v_units set (security_invoker = on);  -- применять RLS базовой таблицы
