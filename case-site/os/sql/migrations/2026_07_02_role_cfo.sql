-- Добавляет роль CFO (финансовый директор). Идемпотентно.
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,admin) VALUES
 ('CFO','CFO (финансовый директор)',1,1,0,1,0,0,0)
ON DUPLICATE KEY UPDATE label=VALUES(label);
