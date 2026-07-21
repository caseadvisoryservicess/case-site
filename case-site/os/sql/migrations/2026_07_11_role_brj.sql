-- Роль «Младший админ брендов»: работает только с базой брендов (клиент скрывает
-- остальные разделы; финансы закрыты правом finance=0). Идемпотентно.
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin)
VALUES ('BRJ','Младший администратор данных',1,0,1,0,0,0,0,0)
ON DUPLICATE KEY UPDATE label=VALUES(label);
