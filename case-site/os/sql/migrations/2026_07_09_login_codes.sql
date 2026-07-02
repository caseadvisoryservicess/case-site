-- Одноразовые коды входа по email (OTP). Код хранится только в виде хеша.
CREATE TABLE IF NOT EXISTS login_codes (
  email      VARCHAR(190) PRIMARY KEY,
  code_hash  VARCHAR(255),
  expires_at DATETIME,
  attempts   INT NOT NULL DEFAULT 0,
  created_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
