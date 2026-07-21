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
