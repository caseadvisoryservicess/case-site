-- CASE OS v4.76.0: модель доступа.
--   1. Корзина геоданных: строки, удалённые из наборов геоаналитики, с автором и временем;
--      администратор восстанавливает их со страницы «Доступ».
--   2. Роли CL (клиент: только просмотр студии) и DEMO (демо-доступ, ничего не сохраняет).
--   3. У пользователя тип доступа (employee, client, demo), срок подписки и личные настройки
--      (выгрузка, правки, заметка, данные заявки на регистрацию).
-- Порядок важен: сначала таблица и роли, потом колонки. Если колонки уже дочинил сам код
-- (он делает это при первом обращении), ошибка «duplicate column» помечает миграцию применённой,
-- таблица и роли к этому моменту уже созданы. Миграция идемпотентна.

CREATE TABLE IF NOT EXISTS geo_trash (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dataset VARCHAR(80) NOT NULL,
  row_key VARCHAR(255) NOT NULL,
  row_json LONGTEXT NOT NULL,
  deleted_by_id CHAR(36) NULL,
  deleted_by VARCHAR(190) NULL,
  deleted_at DATETIME NOT NULL,
  restored_at DATETIME NULL,
  restored_by VARCHAR(190) NULL,
  KEY idx_geo_trash_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin)
VALUES ('CL','Клиент (просмотр геоаналитики)',0,0,0,0,0,0,0,0),
       ('DEMO','Демо-доступ',0,0,0,0,0,0,0,0)
ON DUPLICATE KEY UPDATE label=VALUES(label);

ALTER TABLE app_users ADD COLUMN user_type VARCHAR(16) NOT NULL DEFAULT 'employee';
ALTER TABLE app_users ADD COLUMN expires_at DATETIME NULL;
ALTER TABLE app_users ADD COLUMN settings TEXT NULL;

-- Проверка после применения:
-- SELECT id, email, role_key, user_type, expires_at, active FROM app_users ORDER BY name;
