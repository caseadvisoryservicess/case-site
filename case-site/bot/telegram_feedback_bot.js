#!/usr/bin/env node
/* CASE OS v4.77.0: Telegram-бот обратной связи.
 *
 * Зачем отдельный процесс: PHP на хостинге CASE OS не имеет выхода в интернет, поэтому бот не
 * может жить в api/. Этот сценарий запускается на любой машине с Node.js 18+ и интернетом
 * (ноутбук, VPS, Raspberry Pi): он опрашивает Telegram (long polling, без вебхуков и без
 * публичного адреса) и каждое сообщение пользователя отправляет в платформу:
 *   POST https://<домен>/os/api/feedback.php  {action:'bot', token, text, from_name, from_id, kind}
 * Администратор видит обращения в CASE OS на странице «Доступ» (карточка «Обращения»).
 *
 * Настройка (переменные окружения или файл bot/.env рядом):
 *   TG_BOT_TOKEN   токен бота от @BotFather
 *   CASE_API_URL   адрес feedback.php, например https://caseadvisory.uz/os/api/feedback.php
 *   CASE_BOT_TOKEN тот же секрет, что 'feedback_bot_token' в os/api/config.php
 *   TG_ALLOWED_IDS (необязательно) список Telegram id через запятую: принимать только от них
 *
 * Запуск: node bot/telegram_feedback_bot.js
 * Никаких зависимостей: только встроенный fetch Node.js. Длинных тире в тексте нет намеренно.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* .env без библиотек: KEY=VALUE построчно */
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); });
} catch (e) {}

const TG = process.env.TG_BOT_TOKEN || '';
const API = process.env.CASE_API_URL || '';
const SECRET = process.env.CASE_BOT_TOKEN || '';
const ALLOWED = (process.env.TG_ALLOWED_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
if (!TG || !API || !SECRET) { console.error('Нужны TG_BOT_TOKEN, CASE_API_URL и CASE_BOT_TOKEN (переменные окружения или bot/.env)'); process.exit(2); }

const KIND_BY_CMD = { '/idea': 'idea', '/problem': 'problem', '/question': 'question', '/предложение': 'idea', '/проблема': 'problem', '/вопрос': 'question' };
const HELP = 'Это бот обратной связи CASE Geo Analytics Platform.\n'
  + 'Напишите сообщение, и команда CASE получит его в платформе.\n'
  + 'Чтобы отметить тип, начните с команды:\n/idea предложение\n/problem проблема или ошибка\n/question вопрос\n'
  + 'Ответ придёт в ваш личный кабинет в платформе, а при необходимости сюда.';

async function tg(method, body) {
  const r = await fetch('https://api.telegram.org/bot' + TG + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok) throw new Error('Telegram ' + method + ': ' + (j && j.description || r.status));
  return j.result;
}
async function push(text, from, kind) {
  const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ action: 'bot', token: SECRET, text, from_name: from.name, from_id: from.id, kind }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) throw new Error('CASE API ' + r.status + ': ' + (j && (j.error || j.message) || 'нет ответа'));
  return j.id;
}
function fromOf(m) {
  const u = m.from || {}; const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram';
  return { id: String(u.id || ''), name: u.username ? name + ' (@' + u.username + ')' : name };
}
async function handle(m) {
  const chat = m.chat && m.chat.id; if (!chat) return;
  const from = fromOf(m);
  if (ALLOWED.length && ALLOWED.indexOf(from.id) < 0) { await tg('sendMessage', { chat_id: chat, text: 'Этот бот принимает сообщения только от пользователей платформы CASE. Напишите нам через форму обратной связи в платформе.' }); return; }
  let text = String(m.text || m.caption || '').trim();
  if (!text) { await tg('sendMessage', { chat_id: chat, text: 'Пришлите, пожалуйста, текст сообщения.' }); return; }
  if (/^\/(start|help)\b/.test(text)) { await tg('sendMessage', { chat_id: chat, text: HELP }); return; }
  let kind = 'question';
  const cmd = text.match(/^(\/\S+)/); if (cmd && KIND_BY_CMD[cmd[1].toLowerCase()]) { kind = KIND_BY_CMD[cmd[1].toLowerCase()]; text = text.slice(cmd[1].length).trim(); }
  if (!text) { await tg('sendMessage', { chat_id: chat, text: 'После команды напишите само сообщение.' }); return; }
  try {
    const id = await push(text, from, kind);
    await tg('sendMessage', { chat_id: chat, text: 'Спасибо, обращение #' + id + ' принято. Команда CASE ответит в личном кабинете платформы.' });
    console.log(new Date().toISOString(), 'принято #' + id, kind, from.name);
  } catch (e) {
    console.error(new Date().toISOString(), 'ошибка отправки в CASE OS:', e.message);
    await tg('sendMessage', { chat_id: chat, text: 'Не удалось передать сообщение в платформу. Попробуйте позже или напишите через форму обратной связи в CASE OS.' }).catch(() => null);
  }
}
async function loop() {
  let offset = 0, backoff = 1000;
  console.log('CASE feedback bot: опрос Telegram, отправка в ' + API);
  for (;;) {
    try {
      const updates = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] });
      backoff = 1000;
      for (const u of updates) { offset = u.update_id + 1; if (u.message) { try { await handle(u.message); } catch (e) { console.error('обработка', e.message); } } }
    } catch (e) {
      console.error(new Date().toISOString(), e.message, 'пауза', backoff, 'мс');
      await new Promise(r => setTimeout(r, backoff)); backoff = Math.min(backoff * 2, 60000);
    }
  }
}
if (require.main === module) loop();
module.exports = { handle, push, fromOf, KIND_BY_CMD };
