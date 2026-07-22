/**
 * Автоматический бэкап данных панели (для cPanel Cron Job).
 * Собирает zip data/ (проекты, лиды, пользователи), сохраняет в backups/
 * с ротацией (хранятся последние 7 копий) и, если задан BACKUP_EMAIL,
 * отправляет архив на почту через SMTP_* переменные окружения.
 *
 * Запуск (пример строки cron на хостинге):
 *   source /home/USER/nodevenv/admin_panel/22/bin/activate && cd /home/USER/admin_panel && node backup.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { buildBackupZip } = require('./lib/backup');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const BACKUPS = path.join(ROOT, 'backups');
const KEEP = 7;

async function sendByEmail(zipPath) {
  const to = process.env.BACKUP_EMAIL;
  if (!to) return;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.log('BACKUP_EMAIL задан, но SMTP_HOST/SMTP_USER/SMTP_PASS — нет, письмо не отправлено.');
    return;
  }
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || user,
    to,
    subject: `Бэкап панели CASE — ${new Date().toISOString().slice(0, 10)}`,
    text: 'Автоматический бэкап данных панели во вложении.',
    attachments: [{ filename: path.basename(zipPath), path: zipPath }]
  });
  console.log(`Бэкап отправлен на ${to}`);
}

async function main() {
  fs.mkdirSync(BACKUPS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = path.join(BACKUPS, `backup-${stamp}.zip`);
  const buf = await buildBackupZip(DATA);
  fs.writeFileSync(zipPath, buf);
  console.log(`Бэкап создан: ${zipPath} (${(buf.length / 1024).toFixed(0)} КБ)`);

  const files = fs.readdirSync(BACKUPS)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.zip'))
    .sort();
  while (files.length > KEEP) fs.unlinkSync(path.join(BACKUPS, files.shift()));

  await sendByEmail(zipPath);
}

main().catch((e) => {
  console.error('Бэкап не удался:', e.message);
  process.exit(1);
});
