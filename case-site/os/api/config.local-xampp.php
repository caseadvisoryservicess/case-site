<?php
// ГОТОВЫЙ КОНФИГ ДЛЯ ЛОКАЛЬНОГО XAMPP.
// Что сделать: переименуйте этот файл из  config.local-xampp.php  в  config.php
// (оставьте в той же папке os/api/). Больше ничего менять не нужно.
return [
  'driver' => 'mysql',
  'host'   => '127.0.0.1',   // для XAMPP надёжнее, чем localhost
  'name'   => 'caseos',
  'user'   => 'root',
  'pass'   => '',            // в XAMPP у root пароль пустой
  'charset'=> 'utf8mb4',
  'sqlite_path' => __DIR__ . '/caseos.sqlite',
];
