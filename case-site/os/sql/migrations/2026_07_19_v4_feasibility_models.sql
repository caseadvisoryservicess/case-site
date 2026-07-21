CREATE TABLE IF NOT EXISTS feasibility_models (
  id VARCHAR(36) NOT NULL,
  obj_id VARCHAR(80) NOT NULL,
  scenario_name VARCHAR(190) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  model_json LONGTEXT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  created_by_id VARCHAR(64) NULL,
  created_by_name VARCHAR(190) NULL,
  updated_by_id VARCHAR(64) NULL,
  updated_by_name VARCHAR(190) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_feas_obj (obj_id),
  KEY idx_feas_status (status),
  KEY idx_feas_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feasibility_model_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  model_id VARCHAR(36) NOT NULL,
  revision INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  model_json LONGTEXT NOT NULL,
  saved_by_id VARCHAR(64) NULL,
  saved_by_name VARCHAR(190) NULL,
  saved_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_feas_version (model_id, revision),
  KEY idx_feas_version_model (model_id),
  KEY idx_feas_version_saved (saved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
