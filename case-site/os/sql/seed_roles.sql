-- CASE OS — сид ролей (MySQL). Импорт после schema_mysql.sql.
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin) VALUES
 ('ASH','Генеральный директор',        1,1,1,1,1,0,0,1),
 ('ADM','Администратор',               1,1,1,1,1,0,0,1),
 ('BA', 'Директор по аренде',          1,1,1,0,0,0,0,0),
 ('AG', 'Агент аренды',                1,0,1,0,0,0,0,0),
 ('AGX','Внешний агент',               1,0,1,0,0,1,1,0),
 ('HO', 'Администратор аренды (тыл)',  1,0,1,0,0,0,0,0),
 ('BSH','Архитектор',                  1,0,1,0,1,0,0,0),
 ('HM', 'Менеджер по консалтингу',     1,1,0,0,0,0,0,0),
 ('CFO','Финансовый директор',1,1,0,1,0,0,0,0)
ON DUPLICATE KEY UPDATE
 label=VALUES(label), leasing=VALUES(leasing), finance=VALUES(finance), edit=VALUES(edit),
 approve=VALUES(approve), plans=VALUES(plans), own_only=VALUES(own_only), project_scope=VALUES(project_scope), admin=VALUES(admin);
