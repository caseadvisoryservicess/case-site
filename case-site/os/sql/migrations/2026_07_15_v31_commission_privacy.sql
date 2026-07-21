-- CASE OS v3.1: приватный bonus / commission ledger и правила распределения.
-- Агенты видят только свои начисления через backend ACL; ASH/ADM/CFO/manager/finance видят командный ledger.

CREATE TABLE IF NOT EXISTS commission_rules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  role_key VARCHAR(16) NULL,
  broker VARCHAR(120) NULL,
  obj_id VARCHAR(32) NULL,
  source_type VARCHAR(32) NOT NULL DEFAULT 'closing',
  default_share DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  close_share DECIMAL(5,2) NULL,
  floor_share DECIMAL(5,2) NULL,
  building_share DECIMAL(5,2) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  notes TEXT,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_comm_rules_role (role_key),
  KEY idx_comm_rules_broker (broker),
  KEY idx_comm_rules_obj (obj_id),
  KEY idx_comm_rules_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commission_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  deal_id BIGINT NULL,
  obj_id VARCHAR(32),
  unit_id BIGINT NULL,
  unit_code VARCHAR(120),
  brand_name VARCHAR(190),
  broker VARCHAR(120) NOT NULL,
  role_key VARCHAR(16) NULL,
  case_commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  bonus_earned DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus_pipeline DECIMAL(14,2) NOT NULL DEFAULT 0,
  weighted_bonus DECIMAL(14,2) NOT NULL DEFAULT 0,
  lost_bonus DECIMAL(14,2) NOT NULL DEFAULT 0,
  stage VARCHAR(24) DEFAULT 'lead',
  probability DECIMAL(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  event_type VARCHAR(32) NOT NULL DEFAULT 'forecast',
  visibility VARCHAR(24) NOT NULL DEFAULT 'private',
  notes TEXT,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_comm_ledger_broker (broker),
  KEY idx_comm_ledger_obj (obj_id),
  KEY idx_comm_ledger_unit (unit_id),
  KEY idx_comm_ledger_deal (deal_id),
  KEY idx_comm_ledger_status (status),
  KEY idx_comm_ledger_stage (stage),
  KEY idx_comm_ledger_event (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- Stage probabilities for weighted commission / pipeline forecast.
CREATE TABLE IF NOT EXISTS deal_stage_probabilities (
  stage VARCHAR(24) PRIMARY KEY,
  probability DECIMAL(5,2) NOT NULL,
  label_ru VARCHAR(80),
  label_en VARCHAR(80),
  label_uz VARCHAR(80)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO deal_stage_probabilities (stage, probability, label_ru, label_en, label_uz) VALUES
('neg',20,'Переговоры','Negotiation','Muzokara'),
('off',40,'КП отправлено','Offer sent','Taklif yuborildi'),
('res',35,'Резерв','Reserved','Rezerv'),
('os',65,'Предложение подписано','Offer signed','Taklif imzolandi'),
('cs',85,'Договор на подписании','Contract signing','Shartnoma imzolanmoqda'),
('cd',100,'Контракт подписан','Contract signed','Shartnoma imzolandi')
ON DUPLICATE KEY UPDATE probability=VALUES(probability), label_ru=VALUES(label_ru), label_en=VALUES(label_en), label_uz=VALUES(label_uz);

-- Brand table columns + indexes for separate price level / brand level / min-max area filtering.
SET @caseos_db := DATABASE();
SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD COLUMN price VARCHAR(60) NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND COLUMN_NAME='price');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;
SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD COLUMN tier VARCHAR(60) NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND COLUMN_NAME='tier');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;
SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD COLUMN amin DECIMAL(12,2) NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND COLUMN_NAME='amin');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;
SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD COLUMN amax DECIMAL(12,2) NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND COLUMN_NAME='amax');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;

SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD INDEX idx_brands_price (price)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND INDEX_NAME='idx_brands_price');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;
SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD INDEX idx_brands_tier (tier)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND INDEX_NAME='idx_brands_tier');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;
SET @caseos_sql := (SELECT IF(COUNT(*) = 0, 'ALTER TABLE brands ADD INDEX idx_brands_area (amin, amax)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@caseos_db AND TABLE_NAME='brands' AND INDEX_NAME='idx_brands_area');
PREPARE caseos_stmt FROM @caseos_sql; EXECUTE caseos_stmt; DEALLOCATE PREPARE caseos_stmt;
