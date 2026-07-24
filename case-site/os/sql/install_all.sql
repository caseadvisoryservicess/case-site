-- ============================================================
-- CASE OS — ПОЛНАЯ УСТАНОВКА БАЗЫ ОДНИМ ФАЙЛОМ
-- Создаёт базу caseos, все таблицы и 9 базовых ролей. Более новые роли (например
-- BRJ - младший администратор данных) устанавливаются отдельно, через миграции
-- в os/sql/migrations/ (применяются со страницы Пользователи после первого входа
-- администратора, см. DEPLOY.md шаг 6) - этот файл их не включает.
-- Импорт: phpMyAdmin → вкладка Import → выбрать этот файл → Go.
-- Базу заранее выбирать НЕ нужно — файл сам её создаёт и выбирает.
-- Повторный запуск безопасен (IF NOT EXISTS / ON DUPLICATE KEY).
-- ============================================================

CREATE DATABASE IF NOT EXISTS caseos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE caseos;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE IF NOT EXISTS roles (
  `key`     VARCHAR(16) PRIMARY KEY,
  label     VARCHAR(120) NOT NULL,
  leasing   TINYINT(1) NOT NULL DEFAULT 0,
  finance   TINYINT(1) NOT NULL DEFAULT 0,
  edit      TINYINT(1) NOT NULL DEFAULT 0,
  approve   TINYINT(1) NOT NULL DEFAULT 0,
  plans     TINYINT(1) NOT NULL DEFAULT 0,
  own_only      TINYINT(1) NOT NULL DEFAULT 0,
  project_scope TINYINT(1) NOT NULL DEFAULT 0,
  admin     TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_users (
  id            CHAR(36) PRIMARY KEY,
  email         VARCHAR(190) UNIQUE,
  password_hash VARCHAR(255),
  name          VARCHAR(160) NOT NULL,
  title         VARCHAR(160),
  role_key      VARCHAR(16) NOT NULL,
  broker_name   VARCHAR(120),
  projects      TEXT,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_role FOREIGN KEY (role_key) REFERENCES roles(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS objects (
  id      VARCHAR(32) PRIMARY KEY,
  name    VARCHAR(160) NOT NULL,
  ru      VARCHAR(160),
  country VARCHAR(120) DEFAULT 'Узбекистан',
  city    VARCHAR(120),
  type    VARCHAR(120),
  gba DECIMAL(14,2), gla DECIMAL(14,2),
  plan    VARCHAR(60),
  sc DECIMAL(6,2), inc DECIMAL(6,2),
  cur VARCHAR(120), cond VARCHAR(160), levels VARCHAR(40),
  vat VARCHAR(20), vat_rate DECIMAL(6,2),
  comm   JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS units (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  obj_id      VARCHAR(32) NOT NULL,
  code        VARCHAR(120) NOT NULL,
  floor       VARCHAR(80),
  area        DECIMAL(12,2) NOT NULL DEFAULT 0,
  terr        DECIMAL(12,2) NOT NULL DEFAULT 0,
  cat VARCHAR(120), sub VARCHAR(160),
  rate        DECIMAL(12,2) NOT NULL DEFAULT 0,
  budget      DECIMAL(12,2),
  status      VARCHAR(12) NOT NULL DEFAULT 'vac',
  broker      VARCHAR(120),
  assigned_to CHAR(36),
  vars        JSON, shortlist JSON, merged JSON, offer JSON,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_unit (obj_id, code),
  KEY idx_units_obj (obj_id), KEY idx_units_status (status), KEY idx_units_broker (broker),
  CONSTRAINT fk_unit_obj FOREIGN KEY (obj_id) REFERENCES objects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS control_dates (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  unit_id BIGINT, label VARCHAR(160), date DATE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cdates_date (date),
  CONSTRAINT fk_cdate_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS unit_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  unit_id BIGINT, author CHAR(36), at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, body TEXT,
  CONSTRAINT fk_ucom_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS brands (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL, cat VARCHAR(120), sub VARCHAR(160), country VARCHAR(120),
  amin DECIMAL(12,2), amax DECIMAL(12,2), format VARCHAR(120), fr VARCHAR(160),
  reqs TEXT, coten VARCHAR(160), person VARCHAR(160), phone VARCHAR(80),
  email VARCHAR(190), site VARCHAR(190), ig VARCHAR(190),
  status VARCHAR(20) DEFAULT 'target', notes TEXT, about TEXT, pos TEXT, concept TEXT, rec TEXT,
  founded VARCHAR(40), `group` VARCHAR(160), price VARCHAR(60), tier VARCHAR(60), icsc VARCHAR(80), uz_op VARCHAR(160),
  net_pts VARCHAR(60), net_countries VARCHAR(60),
  logo TEXT, shopfront TEXT, interior TEXT,
  edited_by VARCHAR(120), edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_brands_price (price), KEY idx_brands_tier (tier), KEY idx_brands_area (amin,amax)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS registry_changes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  obj_id VARCHAR(32), date DATE, type VARCHAR(120), what TEXT, by_name VARCHAR(120),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS benchmarks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  city VARCHAR(120), district VARCHAR(120), obj VARCHAR(160), cat VARCHAR(120),
  rent DECIMAL(12,2), sc DECIMAL(6,2), note TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refusals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  obj_id VARCHAR(32), brand VARCHAR(160), reason TEXT, date DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  t VARCHAR(20), type VARCHAR(160), no VARCHAR(60), to_name VARCHAR(190),
  obj_id VARCHAR(32), lang VARCHAR(8), fname VARCHAR(190),
  status VARCHAR(12) DEFAULT 'draft', ver INT NOT NULL DEFAULT 1, raw MEDIUMTEXT,
  by_id CHAR(36), at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_versions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT, ver INT, raw MEDIUMTEXT, by_name VARCHAR(120), at DATETIME,
  CONSTRAINT fk_dver_doc FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contacts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160), title VARCHAR(160), phone VARCHAR(80), email VARCHAR(190)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_metrics (
  user_id CHAR(36) PRIMARY KEY,
  touch INT DEFAULT 0, meet INT DEFAULT 0, view INT DEFAULT 0,
  loi INT DEFAULT 0, sign INT DEFAULT 0, earned DECIMAL(14,2) DEFAULT 0, pipe DECIMAL(14,2) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(40), by_id CHAR(36), obj_id VARCHAR(32), at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  by_id CHAR(36), by_name VARCHAR(120), role_key VARCHAR(16),
  action VARCHAR(160), detail TEXT, at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kp_counters (
  obj_id VARCHAR(32) PRIMARY KEY, last_no INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- CASE OS v3.0: нормализованная CRM-архитектура для будущего перехода от app_state.
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
  KEY idx_deals_obj (obj_id), KEY idx_deals_unit (unit_id), KEY idx_deals_brand (brand_id),
  KEY idx_deals_broker (broker), KEY idx_deals_stage (stage), KEY idx_deals_next (next_action_date), KEY idx_deals_status (status)
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
  KEY idx_dact_deal (deal_id), KEY idx_dact_due (due_date), KEY idx_dact_by (by_id),
  CONSTRAINT fk_dact_deal FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS data_quality_snapshots (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  score INT NOT NULL DEFAULT 0,
  scope VARCHAR(40) DEFAULT 'portfolio',
  metrics JSON NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dq_created (created_at), KEY idx_dq_scope (scope)
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
  UNIQUE KEY uq_doc_tpl (code, lang), KEY idx_doc_tpl_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- CASE OS v3.1: приватный bonus / commission ledger.
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
  KEY idx_comm_rules_role (role_key), KEY idx_comm_rules_broker (broker), KEY idx_comm_rules_obj (obj_id), KEY idx_comm_rules_active (active)
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
  KEY idx_comm_ledger_broker (broker), KEY idx_comm_ledger_obj (obj_id), KEY idx_comm_ledger_unit (unit_id),
  KEY idx_comm_ledger_deal (deal_id), KEY idx_comm_ledger_status (status), KEY idx_comm_ledger_stage (stage), KEY idx_comm_ledger_event (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


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


-- Живое состояние интерфейса (общая база данных платформы), одна строка id=1.
CREATE TABLE IF NOT EXISTS app_state (
  id         INT PRIMARY KEY,
  data       LONGTEXT,
  updated_at DATETIME,
  updated_by VARCHAR(160),
  revision INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Одноразовые коды входа по email (OTP). Код хранится только в виде хеша.
CREATE TABLE IF NOT EXISTS login_codes (
  email      VARCHAR(190) PRIMARY KEY,
  code_hash  VARCHAR(255),
  expires_at DATETIME,
  attempts   INT NOT NULL DEFAULT 0,
  created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- РОЛИ (9 штук) ----
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin) VALUES
 ('ASH','Генеральный директор',        1,1,1,1,1,0,0,1),
 ('ADM','Администратор',               1,1,1,1,1,0,0,1),
 ('BA', 'Директор по аренде',          1,1,1,0,0,0,0,0),
 ('AG', 'Агент аренды',                1,0,1,0,0,0,0,0),
 ('AGX','Внешний агент',               0,0,0,0,0,1,1,0),
 ('HO', 'Администратор аренды (тыл)',  1,1,1,0,0,0,0,0),
 ('BSH','Архитектор',                  1,0,1,0,1,0,0,0),
 ('HM', 'Менеджер по консалтингу',     1,1,0,0,0,0,0,0),
 ('CFO','Финансовый директор',1,1,0,1,0,0,0,0)
ON DUPLICATE KEY UPDATE
 label=VALUES(label), leasing=VALUES(leasing), finance=VALUES(finance), edit=VALUES(edit),
 approve=VALUES(approve), plans=VALUES(plans), own_only=VALUES(own_only), project_scope=VALUES(project_scope), admin=VALUES(admin);

SET FOREIGN_KEY_CHECKS=1;

-- Проверка после импорта (выполнится автоматически, покажет таблицу с числом 9):
SELECT COUNT(*) AS roles_count FROM roles;

-- ------------------------------------------------------------
-- CASE OS legacy module operating modules
-- ------------------------------------------------------------
-- CASE OS legacy module — tenant demand, sales pipeline, partner portal and private sales commissions.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS `brand_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `brand_name` VARCHAR(190) NOT NULL,
  `country` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `category` VARCHAR(120) NULL,
  `area_min` DECIMAL(12,2) NULL,
  `area_max` DECIMAL(12,2) NULL,
  `budget_max` DECIMAL(12,2) NULL,
  `preferences` TEXT NULL,
  `stage` VARCHAR(40) NOT NULL DEFAULT 'new',
  `source` VARCHAR(80) NULL,
  `broker` VARCHAR(190) NULL,
  `next_action` VARCHAR(255) NULL,
  `due_date` DATE NULL,
  `potential_fee` DECIMAL(14,2) NULL DEFAULT 0,
  `visibility` VARCHAR(40) NOT NULL DEFAULT 'internal',
  `partner_id` BIGINT UNSIGNED NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_brand_requests_city` (`country`,`city`),
  KEY `idx_brand_requests_stage` (`stage`),
  KEY `idx_brand_requests_broker` (`broker`),
  KEY `idx_brand_requests_area` (`area_min`,`area_max`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_assets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `country` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `type` VARCHAR(120) NULL,
  `area` DECIMAL(14,2) NULL,
  `price` DECIMAL(16,2) NULL,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'USD',
  `seller` VARCHAR(190) NULL,
  `stage` VARCHAR(40) NOT NULL DEFAULT 'lead',
  `broker` VARCHAR(190) NULL,
  `partner` VARCHAR(190) NULL,
  `visibility` VARCHAR(40) NOT NULL DEFAULT 'internal',
  `commission_rate` DECIMAL(8,4) NULL DEFAULT 0,
  `expected_commission` DECIMAL(16,2) NULL DEFAULT 0,
  `next_action` VARCHAR(255) NULL,
  `due_date` DATE NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_assets_city` (`country`,`city`),
  KEY `idx_sales_assets_stage` (`stage`),
  KEY `idx_sales_assets_broker` (`broker`),
  KEY `idx_sales_assets_visibility` (`visibility`),
  KEY `idx_sales_assets_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_buyers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `country` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `asset_type` VARCHAR(120) NULL,
  `area_min` DECIMAL(14,2) NULL,
  `area_max` DECIMAL(14,2) NULL,
  `budget_min` DECIMAL(16,2) NULL,
  `budget_max` DECIMAL(16,2) NULL,
  `cap_rate` VARCHAR(80) NULL,
  `contact` VARCHAR(255) NULL,
  `broker` VARCHAR(190) NULL,
  `stage` VARCHAR(40) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_buyers_city` (`country`,`city`),
  KEY `idx_sales_buyers_broker` (`broker`),
  KEY `idx_sales_buyers_budget` (`budget_min`,`budget_max`),
  KEY `idx_sales_buyers_area` (`area_min`,`area_max`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `case_partners` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `type` VARCHAR(80) NULL,
  `country` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `email` VARCHAR(190) NULL,
  `phone` VARCHAR(80) NULL,
  `access` VARCHAR(80) NOT NULL DEFAULT 'readonly',
  `scope` VARCHAR(120) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'pending',
  `owner` VARCHAR(190) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_partners_status` (`status`),
  KEY `idx_case_partners_owner` (`owner`),
  KEY `idx_case_partners_city` (`country`,`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `partner_referrals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `partner_id` BIGINT UNSIGNED NULL,
  `partner_name` VARCHAR(190) NULL,
  `kind` VARCHAR(60) NOT NULL DEFAULT 'brand_request',
  `name` VARCHAR(190) NOT NULL,
  `country` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `category` VARCHAR(120) NULL,
  `area_min` DECIMAL(14,2) NULL,
  `area_max` DECIMAL(14,2) NULL,
  `budget_min` DECIMAL(16,2) NULL,
  `budget_max` DECIMAL(16,2) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'new',
  `broker` VARCHAR(190) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_partner_referrals_partner` (`partner_id`),
  KEY `idx_partner_referrals_kind` (`kind`),
  KEY `idx_partner_referrals_broker` (`broker`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sales_commission_ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sales_asset_id` BIGINT UNSIGNED NULL,
  `asset_name` VARCHAR(190) NULL,
  `broker` VARCHAR(190) NULL,
  `partner` VARCHAR(190) NULL,
  `case_commission` DECIMAL(16,2) NULL DEFAULT 0,
  `agent_bonus` DECIMAL(16,2) NULL DEFAULT 0,
  `partner_bonus` DECIMAL(16,2) NULL DEFAULT 0,
  `weighted_bonus` DECIMAL(16,2) NULL DEFAULT 0,
  `lost_bonus` DECIMAL(16,2) NULL DEFAULT 0,
  `stage` VARCHAR(40) NULL,
  `probability` DECIMAL(6,4) NULL DEFAULT 0,
  `status` VARCHAR(40) NOT NULL DEFAULT 'pipeline',
  `visibility` VARCHAR(40) NOT NULL DEFAULT 'own_private',
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_commission_broker` (`broker`),
  KEY `idx_sales_commission_asset` (`sales_asset_id`),
  KEY `idx_sales_commission_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- CASE OS legacy module — investor purchase requests.
-- CASE OS legacy module — investor purchase requests.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS `investor_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `investor_name` VARCHAR(190) NOT NULL,
  `country` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `asset_type` VARCHAR(120) NULL,
  `area_min` DECIMAL(14,2) NULL,
  `area_max` DECIMAL(14,2) NULL,
  `budget_min` DECIMAL(16,2) NULL,
  `budget_max` DECIMAL(16,2) NULL,
  `cap_rate` VARCHAR(80) NULL,
  `proof_funds` VARCHAR(80) NULL,
  `preferences` TEXT NULL,
  `stage` VARCHAR(40) NOT NULL DEFAULT 'new',
  `source` VARCHAR(80) NULL,
  `contact` VARCHAR(255) NULL,
  `broker` VARCHAR(190) NULL,
  `next_action` VARCHAR(255) NULL,
  `due_date` DATE NULL,
  `potential_fee` DECIMAL(16,2) NULL DEFAULT 0,
  `visibility` VARCHAR(40) NOT NULL DEFAULT 'internal',
  `partner_id` BIGINT UNSIGNED NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_investor_requests_city` (`country`,`city`),
  KEY `idx_investor_requests_stage` (`stage`),
  KEY `idx_investor_requests_broker` (`broker`),
  KEY `idx_investor_requests_budget` (`budget_min`,`budget_max`),
  KEY `idx_investor_requests_area` (`area_min`,`area_max`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===== CASE OS legacy module commission engines =====
-- CASE OS legacy module — two commission engines: lease department + supplier mediation.
-- Safe to run multiple times. Parameters are in tables, not hardcoded.

CREATE TABLE IF NOT EXISTS `commission_engine_settings` (
  `setting_key` VARCHAR(80) NOT NULL,
  `setting_value` JSON NULL,
  `updated_by` VARCHAR(190) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `commission_engine_settings` (`setting_key`,`setting_value`) VALUES
('lease_distribution', JSON_OBJECT(
  'baseMethod','manual',
  'annualPercent',8,
  'fixedAmount',0,
  'needsAshConfirmation',true,
  'curatorName','Нодир',
  'supportName','Хилола',
  'curatorSelfShare',25,
  'externalAgentShare',20,
  'internalAgentShare',15,
  'curatorShare',5,
  'supportShare',5,
  'scenario3CompanyShare',75,
  'salaryAllocationMode','period',
  'internalMonthlySalary',0,
  'offTheTop',true
)),
('supplier_distribution', JSON_OBJECT(
  'defaultCommissionRate',5,
  'defaultClientDiscount',5,
  'requireDisclosureBeforePaid',true
))
ON DUPLICATE KEY UPDATE setting_key=setting_key;

CREATE TABLE IF NOT EXISTS `lease_commission_deals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `obj_id` VARCHAR(32) NULL,
  `object_name` VARCHAR(190) NULL,
  `unit_id` BIGINT UNSIGNED NULL,
  `unit_code` VARCHAR(120) NULL,
  `tenant_name` VARCHAR(190) NOT NULL,
  `area` DECIMAL(14,2) NULL DEFAULT 0,
  `rate` DECIMAL(14,2) NULL DEFAULT 0,
  `monthly_rent` DECIMAL(16,2) NULL DEFAULT 0,
  `annual_rent` DECIMAL(16,2) NULL DEFAULT 0,
  `term_months` INT NULL DEFAULT 12,
  `signed_date` DATE NULL,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'USD',
  `fx_rate` DECIMAL(14,4) NULL DEFAULT 0,
  `base_method` VARCHAR(40) NOT NULL DEFAULT 'manual',
  `annual_percent` DECIMAL(8,4) NULL DEFAULT 8,
  `fixed_amount` DECIMAL(16,2) NULL DEFAULT 0,
  `commission_base` DECIMAL(16,2) NOT NULL DEFAULT 0,
  `ash_confirmed` TINYINT(1) NOT NULL DEFAULT 0,
  `closing_type` VARCHAR(40) NOT NULL DEFAULT 'external',
  `agent_primary` VARCHAR(190) NULL,
  `agent_secondary` VARCHAR(190) NULL,
  `split_primary` DECIMAL(8,4) NULL DEFAULT 100,
  `split_secondary` DECIMAL(8,4) NULL DEFAULT 0,
  `curator_name` VARCHAR(190) NULL,
  `support_name` VARCHAR(190) NULL,
  `agent_amount` DECIMAL(16,2) NULL DEFAULT 0,
  `curator_amount` DECIMAL(16,2) NULL DEFAULT 0,
  `support_amount` DECIMAL(16,2) NULL DEFAULT 0,
  `company_amount` DECIMAL(16,2) NULL DEFAULT 0,
  `salary_allocation` DECIMAL(16,2) NULL DEFAULT 0,
  `company_net` DECIMAL(16,2) NULL DEFAULT 0,
  `stage` VARCHAR(40) NOT NULL DEFAULT 'lead',
  `probability` DECIMAL(8,4) NULL DEFAULT 0,
  `payment_status` VARCHAR(40) NOT NULL DEFAULT 'pending',
  `reversal_of` BIGINT UNSIGNED NULL,
  `notes` TEXT NULL,
  `audit_json` JSON NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lease_comm_deals_tenant` (`tenant_name`),
  KEY `idx_lease_comm_deals_agent` (`agent_primary`),
  KEY `idx_lease_comm_deals_curator` (`curator_name`),
  KEY `idx_lease_comm_deals_status` (`payment_status`),
  KEY `idx_lease_comm_deals_stage` (`stage`),
  KEY `idx_lease_comm_deals_signed` (`signed_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lease_commission_ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `lease_deal_id` BIGINT UNSIGNED NULL,
  `participant_name` VARCHAR(190) NOT NULL,
  `participant_role` VARCHAR(60) NOT NULL,
  `role_key` VARCHAR(40) NULL,
  `amount` DECIMAL(16,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'USD',
  `fx_rate` DECIMAL(14,4) NULL DEFAULT 0,
  `amount_usd` DECIMAL(16,2) NULL DEFAULT 0,
  `amount_uzs` DECIMAL(18,2) NULL DEFAULT 0,
  `share_percent` DECIMAL(8,4) NULL DEFAULT 0,
  `stage` VARCHAR(40) NULL,
  `probability` DECIMAL(8,4) NULL DEFAULT 0,
  `status` VARCHAR(40) NOT NULL DEFAULT 'pending',
  `visibility_owner` VARCHAR(190) NULL,
  `period_month` VARCHAR(7) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lease_ledger_deal` (`lease_deal_id`),
  KEY `idx_lease_ledger_participant` (`participant_name`),
  KEY `idx_lease_ledger_owner` (`visibility_owner`),
  KEY `idx_lease_ledger_status` (`status`),
  KEY `idx_lease_ledger_period` (`period_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name_ru` VARCHAR(190) NOT NULL,
  `name_uz` VARCHAR(190) NULL,
  `name_en` VARCHAR(190) NULL,
  `commission_rate` DECIMAL(8,4) NOT NULL DEFAULT 5,
  `client_discount_rate` DECIMAL(8,4) NOT NULL DEFAULT 5,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supplier_cat_ru` (`name_ru`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `supplier_categories` (`name_ru`,`name_uz`,`name_en`,`commission_rate`,`client_discount_rate`) VALUES
('Реклама и вывеска','Tashqi reklama va peshlavha','Outdoor advertising / signage',10,5),
('Fit-out','Fit-out','Fit-out',5,3),
('MEP / инженерия','MEP / muhandislik','MEP / engineering',5,3),
('Мебель и оборудование','Mebel va jihozlar','Furniture and equipment',4,3),
('Безопасность','Xavfsizlik','Security',5,3),
('Клининг','Klining','Cleaning',5,3),
('IT / кассовое оборудование','IT / kassa jihozlari','IT / POS equipment',4,2),
('Дизайн / проектирование','Dizayn / loyiha','Design / architecture',5,2),
('Строительные материалы','Qurilish materiallari','Construction materials',3,2),
('Логистика','Logistika','Logistics',3,2)
ON DUPLICATE KEY UPDATE commission_rate=VALUES(commission_rate), client_discount_rate=VALUES(client_discount_rate);

CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `category_id` BIGINT UNSIGNED NULL,
  `category_name` VARCHAR(190) NULL,
  `contact_name` VARCHAR(190) NULL,
  `phone` VARCHAR(80) NULL,
  `email` VARCHAR(190) NULL,
  `terms` TEXT NULL,
  `commission_rate` DECIMAL(8,4) NULL DEFAULT 0,
  `client_discount_rate` DECIMAL(8,4) NULL DEFAULT 0,
  `transparency_policy` TEXT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'active',
  `owner` VARCHAR(190) NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_suppliers_category` (`category_id`),
  KEY `idx_suppliers_status` (`status`),
  KEY `idx_suppliers_owner` (`owner`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_commission_deals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_id` BIGINT UNSIGNED NULL,
  `supplier_name` VARCHAR(190) NULL,
  `category_id` BIGINT UNSIGNED NULL,
  `category_name` VARCHAR(190) NULL,
  `client_name` VARCHAR(190) NOT NULL,
  `client_type` VARCHAR(60) NULL,
  `project_name` VARCHAR(190) NULL,
  `order_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'USD',
  `fx_rate` DECIMAL(14,4) NULL DEFAULT 0,
  `commission_rate` DECIMAL(8,4) NOT NULL DEFAULT 0,
  `case_commission` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `client_discount_rate` DECIMAL(8,4) NOT NULL DEFAULT 0,
  `client_saving` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `client_disclosure` TINYINT(1) NOT NULL DEFAULT 0,
  `supplier_disclosure` TINYINT(1) NOT NULL DEFAULT 0,
  `disclosure_date` DATE NULL,
  `disclosure_by` VARCHAR(190) NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'expected',
  `payment_status` VARCHAR(40) NOT NULL DEFAULT 'expected',
  `owner` VARCHAR(190) NULL,
  `notes` TEXT NULL,
  `audit_json` JSON NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_deals_supplier` (`supplier_id`),
  KEY `idx_supplier_deals_client` (`client_name`),
  KEY `idx_supplier_deals_owner` (`owner`),
  KEY `idx_supplier_deals_status` (`status`),
  KEY `idx_supplier_deals_payment` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_commission_ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `supplier_deal_id` BIGINT UNSIGNED NULL,
  `supplier_name` VARCHAR(190) NULL,
  `client_name` VARCHAR(190) NULL,
  `case_commission` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `client_saving` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(12) NOT NULL DEFAULT 'USD',
  `status` VARCHAR(40) NOT NULL DEFAULT 'expected',
  `visibility_owner` VARCHAR(190) NULL,
  `period_month` VARCHAR(7) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(190) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_supplier_ledger_deal` (`supplier_deal_id`),
  KEY `idx_supplier_ledger_owner` (`visibility_owner`),
  KEY `idx_supplier_ledger_status` (`status`),
  KEY `idx_supplier_ledger_period` (`period_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS market_data_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_name VARCHAR(160) NOT NULL,
  source_type VARCHAR(80) NULL,
  source_url VARCHAR(500) NULL,
  update_frequency VARCHAR(40) DEFAULT 'monthly',
  active TINYINT(1) DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS market_data_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  country_iso3 CHAR(3) NOT NULL,
  country VARCHAR(120) NULL,
  region VARCHAR(160) NULL,
  city VARCHAR(160) NULL,
  indicator_key VARCHAR(120) NOT NULL,
  indicator_label VARCHAR(220) NULL,
  value DECIMAL(22,4) NULL,
  unit VARCHAR(60) NULL,
  year INT NULL,
  source_name VARCHAR(160) NULL,
  source_url VARCHAR(500) NULL,
  updated_by VARCHAR(160) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_market_point (country_iso3, region, city, indicator_key, year),
  KEY idx_market_geo (country_iso3, region, city),
  KEY idx_market_indicator (indicator_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gis_analysis_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  analysis_type VARCHAR(60) NOT NULL,
  object_id VARCHAR(80) NULL,
  lat DECIMAL(12,8) NOT NULL,
  lon DECIMAL(12,8) NOT NULL,
  parameters_json JSON NULL,
  result_json JSON NULL,
  status VARCHAR(40) DEFAULT 'ok',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  KEY idx_gis_obj (object_id),
  KEY idx_gis_provider (provider, analysis_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO market_data_sources (source_name, source_type, source_url, update_frequency, active, notes) VALUES
('World Bank WDI','international','https://api.worldbank.org/v2/', 'monthly', 1, 'Country macro indicators'),
('IMF Data / WEO','international','https://data.imf.org/', 'monthly', 1, 'Macro forecast and core indicators'),
('UN Population Division','international','https://population.un.org/dataportal/', 'monthly', 1, 'Population and age-sex structure'),
('National Statistics Uzbekistan','national','https://stat.uz/', 'monthly', 1, 'Regional/city official statistics where available'),
('Open Data Uzbekistan','national','https://data.gov.uz/', 'monthly', 1, 'Government open data')
ON DUPLICATE KEY UPDATE active=VALUES(active);

-- CASE OS v4.0.0 — Financial Feasibility Studio
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
  KEY idx_feas_obj (obj_id), KEY idx_feas_status (status), KEY idx_feas_updated (updated_at)
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
  PRIMARY KEY (id), UNIQUE KEY uq_feas_version (model_id, revision),
  KEY idx_feas_version_model (model_id), KEY idx_feas_version_saved (saved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
