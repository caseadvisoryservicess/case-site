-- Добавляет роль AGX (Внешний агент): доступ только к назначенным
-- проектам и только к своим сделкам. Идемпотентно.
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin) VALUES
 ('AGX','Внешний агент',0,0,0,0,0,1,1,0)
ON DUPLICATE KEY UPDATE label=VALUES(label), own_only=VALUES(own_only), project_scope=VALUES(project_scope);
