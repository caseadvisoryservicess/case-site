-- CASE OS — сид ролей (P1). Запускать третьим.
-- Права соответствуют матрице приложения; их можно менять в UI («Права ролей»).

insert into roles (key,label,leasing,finance,edit,approve,plans,own_only,admin) values
  ('ASH','Founder / CEO',      true, true, true, true, true, false,true),
  ('ADM','Администратор',      true, true, true, true, true, false,true),
  ('BA', 'Leasing Director',   true, true, true, false,false,false,false),
  ('AG', 'Агент аренды',       true, false,true, false,false,false,false),
  ('HO', 'Lease Admin (тыл)',  true, false,true, false,false,false,false),
  ('BSH','Архитектор',         true, false,true, false,true, false,false),
  ('HM', 'Advisory Manager',   true, true, false,false,false,false,false)
on conflict (key) do update set
  label=excluded.label, leasing=excluded.leasing, finance=excluded.finance,
  edit=excluded.edit, approve=excluded.approve, plans=excluded.plans,
  own_only=excluded.own_only, admin=excluded.admin;
