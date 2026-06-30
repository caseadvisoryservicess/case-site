-- Добавляет таблицу живого состояния платформы (для P2 — общая БД интерфейса).
-- Аддитивно и идемпотентно: повторный запуск безопасен.
CREATE TABLE IF NOT EXISTS app_state (
  id         INT PRIMARY KEY,
  data       LONGTEXT,
  updated_at DATETIME,
  updated_by VARCHAR(160)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
