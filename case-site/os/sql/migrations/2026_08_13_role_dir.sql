-- Роль DIR - «Директор (без администрирования)»: все рабочие права, кроме управления
-- доступами. Отличие от ADM ровно в одном флаге: admin=0. Этого достаточно, потому что
-- разделы «Доступ», «Модули» и «Система» в клиенте закрыты и в меню, и на отрисовке.
--
-- Порядок важен: сначала роль, потом пользователь. У app_users есть внешний ключ
-- fk_user_role на roles(`key`), поэтому назначить несуществующую роль нельзя.
-- Миграция идемпотентна: повторный запуск безопасен.

INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin)
VALUES ('DIR','Директор (без администрирования)',1,1,1,1,1,0,0,0)
ON DUPLICATE KEY UPDATE
  label=VALUES(label), leasing=VALUES(leasing), finance=VALUES(finance), edit=VALUES(edit),
  approve=VALUES(approve), plans=VALUES(plans), own_only=VALUES(own_only),
  project_scope=VALUES(project_scope), admin=VALUES(admin);

-- Humoyun Mirkamolov -> DIR. Ключ поиска - имя, потому что почтовый адрес в репозитории
-- не хранится. Если в базе имя записано иначе, строка не обновится молча: проверьте
-- результат запросом в конце файла.
UPDATE app_users SET role_key='DIR'
WHERE name='Humoyun Mirkamolov' AND role_key<>'DIR';

-- Проверка после применения (должна вернуть одну строку с role_key='DIR'):
-- SELECT id, name, email, role_key, active FROM app_users WHERE name LIKE '%Mirkamolov%';
--
-- Если строк ноль - пользователь заведён под другим написанием имени. Найдите его:
-- SELECT id, name, email, role_key FROM app_users ORDER BY name;
-- и выполните точечно: UPDATE app_users SET role_key='DIR' WHERE id='<его id>';
