/**
 * Сброс пароля пользователя панели (если пароль забыт).
 *
 * Запуск из папки приложения:
 *   node reset-password.js <логин> <новый-пароль>
 * Пример:
 *   node reset-password.js admin МойНовыйПароль123
 *
 * Перезапуск приложения не нужен — пароль действует сразу.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.log('Использование: node reset-password.js <логин> <новый-пароль>');
  console.log('Пример:        node reset-password.js admin МойНовыйПароль123');
  process.exit(1);
}
if (String(password).length < 8) {
  console.error('Пароль должен быть не короче 8 символов.');
  process.exit(1);
}
if (!fs.existsSync(USERS_FILE)) {
  console.error('Файл data/users.json не найден. Запустите скрипт из папки приложения (admin_panel).');
  process.exit(1);
}

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
const user = users.find((u) => u.username === username);
if (!user) {
  console.error(`Пользователь «${username}» не найден. Есть: ${users.map((u) => u.username).join(', ')}`);
  process.exit(1);
}

user.hash = bcrypt.hashSync(String(password), 10);
fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
console.log(`Пароль пользователя «${username}» сброшен. Можно входить с новым паролем прямо сейчас.`);
