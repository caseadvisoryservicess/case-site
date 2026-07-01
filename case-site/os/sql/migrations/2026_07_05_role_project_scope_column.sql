-- Добавляет столбец project_scope в таблицу ролей (для внешних агентов,
-- ограниченных назначенными объектами). Выполняется один раз (см. схему
-- миграций в migrate.php), поэтому без IF NOT EXISTS.
ALTER TABLE roles ADD COLUMN project_scope TINYINT(1) NOT NULL DEFAULT 0;
