-- CASE OS v3.0: заготовки нормализованной CRM-архитектуры.
-- Эти таблицы не ломают текущий app_state, но готовят переход к полноценным Deal / Action / QA сущностям.

CREATE TABLE IF NOT EXISTS deals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  obj_id VARCHAR(32),
  unit_id BIGINT NULL,
  unit_code VARCHAR(120),
  brand_id BIGINT NULL,
  brand_name VARCHAR(190),
  broker VARCHAR(120),
  stage VARCHAR(24) NOT NULL DEFAULT 'lead',
  probability DECIMAL(5,2) NOT NULL DEFAULT 0,
  proposed_rate DECIMAL(12,2) NULL,
  expected_monthly_rent DECIMAL(14,2) NULL,
  expected_commission DECIMAL(14,2) NULL,
  next_action VARCHAR(190),
  next_action_date DATE NULL,
  priority VARCHAR(16) DEFAULT 'normal',
  delay_reason VARCHAR(190),
  refusal_reason VARCHAR(190),
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_deals_obj (obj_id),
  KEY idx_deals_unit (unit_id),
  KEY idx_deals_brand (brand_id),
  KEY idx_deals_broker (broker),
  KEY idx_deals_stage (stage),
  KEY idx_deals_next (next_action_date),
  KEY idx_deals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS deal_actions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  deal_id BIGINT NULL,
  obj_id VARCHAR(32),
  unit_code VARCHAR(120),
  brand_name VARCHAR(190),
  action_type VARCHAR(40),
  action_text TEXT,
  due_date DATE NULL,
  done_at DATETIME NULL,
  by_id CHAR(36) NULL,
  by_name VARCHAR(120),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dact_deal (deal_id),
  KEY idx_dact_due (due_date),
  KEY idx_dact_by (by_id),
  CONSTRAINT fk_dact_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  score INT NOT NULL DEFAULT 0,
  scope VARCHAR(40) DEFAULT 'portfolio',
  metrics JSON NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dq_created (created_at),
  KEY idx_dq_scope (scope)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doc_templates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(60) NOT NULL,
  title VARCHAR(190) NOT NULL,
  lang VARCHAR(8) NOT NULL DEFAULT 'ru',
  body MEDIUMTEXT,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doc_tpl (code, lang),
  KEY idx_doc_tpl_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
