CREATE TABLE IF NOT EXISTS geo_state_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  app_revision BIGINT NOT NULL DEFAULT 0,
  geo_revision BIGINT NOT NULL DEFAULT 0,
  geo_json LONGTEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  reason VARCHAR(500) NULL,
  updated_by VARCHAR(190) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_geo_hist_created (created_at),
  KEY idx_geo_hist_revision (geo_revision)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
