<?php
// CASE OS — пример production config. Не храните реальные пароли в публичных архивах.
return [
  'driver' => 'mysql',
  'host'   => 'localhost',
  'name'   => 'YOUR_DATABASE_NAME',
  'user'   => 'YOUR_DATABASE_USER',
  'pass'   => 'YOUR_DATABASE_PASSWORD',
  'charset'=> 'utf8mb4',
  'sqlite_path' => __DIR__ . '/caseos.sqlite',
  'backup_token' => 'CHANGE_TO_LONG_RANDOM_SECRET',
  'mail_from' => 'no-reply@your-domain.com',
  'smtp' => [
    'host'   => 'mail.your-domain.com',
    'port'   => 465,
    'secure' => 'ssl',
    'user'   => 'no-reply@your-domain.com',
    'pass'   => 'MAILBOX_PASSWORD',
  ],
  // GIS / Location Intelligence keys (optional, keep real keys only in production config.php)
  'openrouteservice_key' => '',
  'yandex_isochrone_key' => '',
  'yandex_search_key' => '',
  'dgis_key' => '',
  'google_maps_key' => '',
];
