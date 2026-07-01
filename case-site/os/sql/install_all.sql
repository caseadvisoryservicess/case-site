-- ============================================================
-- CASE OS — ПОЛНАЯ УСТАНОВКА БАЗЫ ОДНИМ ФАЙЛОМ
-- Создаёт базу caseos, все таблицы и 7 ролей.
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
  own_only  TINYINT(1) NOT NULL DEFAULT 0,
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
  founded VARCHAR(40), `group` VARCHAR(160), price VARCHAR(60), icsc VARCHAR(80), uz_op VARCHAR(160),
  net_pts VARCHAR(60), net_countries VARCHAR(60),
  logo TEXT, shopfront TEXT, interior TEXT,
  edited_by VARCHAR(120), edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- Живое состояние интерфейса (общая база данных платформы), одна строка id=1.
CREATE TABLE IF NOT EXISTS app_state (
  id         INT PRIMARY KEY,
  data       LONGTEXT,
  updated_at DATETIME,
  updated_by VARCHAR(160)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---- РОЛИ (8 штук) ----
INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,admin) VALUES
 ('ASH','Генеральный директор',        1,1,1,1,1,0,1),
 ('ADM','Администратор',               1,1,1,1,1,0,1),
 ('BA', 'Директор по аренде',          1,1,1,0,0,0,0),
 ('AG', 'Агент аренды',                1,0,1,0,0,0,0),
 ('HO', 'Администратор аренды (тыл)',  1,0,1,0,0,0,0),
 ('BSH','Архитектор',                  1,0,1,0,1,0,0),
 ('HM', 'Менеджер по консалтингу',     1,1,0,0,0,0,0),
 ('CFO','Финансовый директор',1,1,0,1,0,0,0)
ON DUPLICATE KEY UPDATE
 label=VALUES(label), leasing=VALUES(leasing), finance=VALUES(finance), edit=VALUES(edit),
 approve=VALUES(approve), plans=VALUES(plans), own_only=VALUES(own_only), admin=VALUES(admin);

SET FOREIGN_KEY_CHECKS=1;

-- Проверка после импорта (выполнится автоматически, покажет таблицу с числом 7):
SELECT COUNT(*) AS roles_count FROM roles;
