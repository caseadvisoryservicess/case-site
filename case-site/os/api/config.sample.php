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
];
