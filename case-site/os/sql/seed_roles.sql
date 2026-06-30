-- CASE OS — сид ролей (MySQL). Импорт после schema_mysql.sql.
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,admin) VALUES
 ('ASH','Founder / CEO',     1,1,1,1,1,0,1),
 ('ADM','Администратор',     1,1,1,1,1,0,1),
 ('BA', 'Leasing Director',  1,1,1,0,0,0,0),
 ('AG', 'Агент аренды',      1,0,1,0,0,0,0),
 ('HO', 'Lease Admin (тыл)', 1,0,1,0,0,0,0),
 ('BSH','Архитектор',        1,0,1,0,1,0,0),
 ('HM', 'Advisory Manager',  1,1,0,0,0,0,0),
 ('CFO','CFO (финансовый директор)',1,1,0,1,0,0,0)
ON DUPLICATE KEY UPDATE
 label=VALUES(label), leasing=VALUES(leasing), finance=VALUES(finance), edit=VALUES(edit),
 approve=VALUES(approve), plans=VALUES(plans), own_only=VALUES(own_only), admin=VALUES(admin);
