-- CASE OS v2.44: revision для защиты app_state от перезаписи при одновременной работе.
-- Безопасно для повторного запуска в MySQL/MariaDB.
SET @caseos_db := DATABASE();
SET @caseos_sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE app_state ADD COLUMN revision INT NOT NULL DEFAULT 0',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @caseos_db
    AND TABLE_NAME = 'app_state'
    AND COLUMN_NAME = 'revision'
);
PREPARE caseos_stmt FROM @caseos_sql;
EXECUTE caseos_stmt;
DEALLOCATE PREPARE caseos_stmt;
