<?php
// Скопируйте этот файл в notify_recipients.php, чтобы включить реальную доставку
// дайджеста контрольных дат (см. cron_critical_dates.php). notify_recipients.php
// в репозиторий не попадает (см. .gitignore), как и config.php.
//
// Каждая запись сопоставляет имя брокера (как оно записано в u.broker в реестре)
// с получателем. Для Telegram нужен бот (создать через @BotFather, вписать токен
// в config.php как 'telegram_bot_token' => '...') и chat_id получателя (можно
// узнать, написав боту и открыв https://api.telegram.org/bot<TOKEN>/getUpdates).
// Для e-mail используется тот же SMTP, что и вход по коду (config.php 'smtp').
return [
  // ['broker' => 'Нодир', 'telegram_chat_id' => '123456789', 'email' => 'nodir@example.com'],
  // ['broker' => '(без брокера)', 'email' => 'ba@example.com'], // общий дайджест по юнитам без брокера
];
