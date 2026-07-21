<?php
// Скопируйте этот файл в config.php и впишите данные БД из cPanel.
// config.php в репозиторий не попадает (см. .gitignore) и закрыт .htaccess.
return [
  'driver' => 'mysql',                 // на хостинге 'mysql'; для локального теста 'sqlite'
  'host'   => 'localhost',
  'name'   => 'ИМЯ_БАЗЫ',              // напр. caseadv_os
  'user'   => 'ПОЛЬЗОВАТЕЛЬ_БАЗЫ',     // напр. caseadv_os
  'pass'   => 'ПАРОЛЬ_БАЗЫ',
  'charset'=> 'utf8mb4',
  'sqlite_path' => __DIR__ . '/caseos.sqlite', // используется только при driver=sqlite
  'backup_token' => 'ПРИДУМАЙТЕ_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ', // для ежедневного авто-бэкапа по cron (см. DEPLOY.md)
  'mail_from' => 'no-reply@ВАШ-ДОМЕН', // отправитель писем с кодом входа; для лучшей доставки создайте этот ящик в cPanel

  // Вход по коду из письма. По умолчанию ВКЛЮЧЁН (строку писать не нужно).
  // Для локальной работы (XAMPP без почты) раскомментируйте строку ниже — вход будет по паролю.
  // При переезде на хостинг удалите её (и настройте блок smtp) — вернётся вход по коду.
  // 'code_login' => false,

  // Отправка кодов входа через SMTP (надёжнее, чем PHP mail(); на многих хостингах mail() отключён).
  // 1. cPanel → Email Accounts → создайте ящик, например no-reply@ваш-домен, задайте пароль.
  // 2. Впишите данные ниже (host обычно mail.ваш-домен, порт 465, secure 'ssl'; либо 587 + 'tls').
  'smtp' => [
    'host'   => 'mail.ВАШ-ДОМЕН',
    'port'   => 465,
    'secure' => 'ssl',              // 'ssl' (порт 465) или 'tls' (порт 587)
    'user'   => 'no-reply@ВАШ-ДОМЕН',
    'pass'   => 'ПАРОЛЬ_ЯЩИКА',
  ],
  // GIS / Location Intelligence keys (optional, keep real keys only in production config.php)
  'openrouteservice_key' => '',
  'yandex_isochrone_key' => '',
  'dgis_key' => '',            // 2GIS Places API — сбор геобазы (api/geo_collector.php)
  'google_maps_key' => '',     // Google Places API (New) — сбор геобазы
  'yandex_search_key' => '',   // Яндекс Geosearch API (поиск организаций) — сбор геобазы
  // Примечание: Geosearch ≠ Isochrone. Для коллектора нужен именно ключ Geosearch (поиск по организациям).

  // Telegram-бот для дайджеста контрольных дат (см. api/cron_critical_dates.php).
  // Создать бота через @BotFather в Telegram, вписать токен сюда; получателей
  // настроить в api/notify_recipients.php (см. api/notify_recipients.sample.php).
  'telegram_bot_token' => '',
];
