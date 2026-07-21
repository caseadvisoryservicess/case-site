-- CASE OS v4.9.9 — tiered leasing commission engine defaults.
-- Monthly-count tiers (retroactive) + admin/architect/manager 5% bonuses. Names filled by admin in settings.
INSERT INTO `commission_engine_settings` (`setting_key`,`setting_value`) VALUES
('tiered_distribution', JSON_OBJECT(
  'mode','tiered',
  'triggerStages', JSON_ARRAY('paid'),
  'retroactiveTiers', true,
  'agentTiers', JSON_ARRAY(JSON_OBJECT('min',1,'pct',20),JSON_OBJECT('min',2,'pct',25),JSON_OBJECT('min',3,'pct',30)),
  'managerTiers', JSON_ARRAY(JSON_OBJECT('min',1,'pct',25),JSON_OBJECT('min',4,'pct',30)),
  'adminName','', 'adminSupportPct',5,
  'architectName','', 'architectSupportPct',5,
  'managerName','', 'managerControlPct',5,
  'managerControlOwn', false,
  'supportIncludeOwn', true
))
ON DUPLICATE KEY UPDATE setting_key=setting_key;
