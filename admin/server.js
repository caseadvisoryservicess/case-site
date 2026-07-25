/**
 * Панель управления лендингами SFB / CASE.
 *
 * Запуск:  node server.js          (порт из PORT, по умолчанию 3000)
 * Данные:  data/users.json         — пользователи (bcrypt-хэши паролей)
 *          data/projects/<slug>/   — project.json + uploads/
 *          sites/<slug>/           — собранные лендинги (публично на /p/<slug>/)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { ZipArchive } = require('archiver'); // archiver ^8: экспортирует классы, а не фабричную функцию
const nodemailer = require('nodemailer');
// обработка изображений вынесена в lib/images.js (jimp + WASM-WebP)
const { renderLanding } = require('./lib/template');
const { renderLanding2 } = require('./lib/template2');
const { newProject } = require('./lib/blank');
const { buildBackupZip } = require('./lib/backup');
const { makeVariants } = require('./lib/images');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PROJECTS = path.join(DATA, 'projects');
const SITES = path.join(ROOT, 'sites');
const PORT = process.env.PORT || 3000;

fs.mkdirSync(PROJECTS, { recursive: true });
fs.mkdirSync(SITES, { recursive: true });

// при пустой data/ (например, чистый том в Docker) — заполнить из seed-data/
const SEED = path.join(ROOT, 'seed-data');
if (fs.existsSync(SEED) && fs.readdirSync(PROJECTS).length === 0) {
  const seedProjects = path.join(SEED, 'projects');
  if (fs.existsSync(seedProjects)) {
    fs.cpSync(seedProjects, PROJECTS, { recursive: true });
    console.log('Данные проектов заполнены из seed-data/');
  }
}

// ─── секрет для подписи сессионных cookie (создаётся один раз) ───
const SECRET_FILE = path.join(DATA, '.secret');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

// ─── пользователи ───
const USERS_FILE = path.join(DATA, 'users.json');
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // первый запуск: пароль админа из переменной окружения ADMIN_PASSWORD, иначе "admin"
    const pass = process.env.ADMIN_PASSWORD || 'admin';
    const seed = [{ username: 'admin', hash: bcrypt.hashSync(pass, 10), role: 'admin', projects: [] }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2));
    console.log(process.env.ADMIN_PASSWORD
      ? 'Создан пользователь admin с паролем из ADMIN_PASSWORD.'
      : 'Создан пользователь admin с паролем "admin" - смените пароль после первого входа!');
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

// ─── сессии: HMAC-подписанный токен в cookie ───
const SESSION_TTL = 1000 * 60 * 60 * 12; // 12 часов
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.u || !p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}
function getCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const SLUG_RE = /^[a-z0-9-]{2,40}$/;
function projectDir(slug) { return path.join(PROJECTS, slug); }
function projectFile(slug) { return path.join(projectDir(slug), 'project.json'); }
function uploadsDir(slug) { return path.join(projectDir(slug), 'uploads'); }

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // за nginx/Render/cPanel: корректные req.secure и IP
app.use(express.json({ limit: '3mb' }));

// панель может открываться не с корня сайта, а из подпапки (например /admin) —
// путь задаётся переменной окружения BASE_PATH; все маршруты ниже вешаются на router,
// который потом монтируется на этот префикс
const BASE_PATH = String(process.env.BASE_PATH || '').replace(/\/+$/, '');
const router = express.Router();

router.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── auth middleware ───
function auth(req, res, next) {
  const p = verify(getCookie(req, 'sfb_session'));
  if (!p) return res.status(401).json({ error: 'Не авторизован' });
  const user = loadUsers().find((u) => u.username === p.u);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  req.user = user;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только для администратора' });
  next();
}
function canAccess(user, slug) {
  return user.role === 'admin' || (user.projects || []).includes(slug);
}
// CSRF: мутирующие запросы обязаны нести кастомный заголовок
// (кроме публичных эндпоинтов лендинга: приём заявок /api/lead/* и событий
// аналитики /api/e/* — они без авторизации, CSRF не применим, а sendBeacon
// не умеет ставить кастомные заголовки)
router.use('/api', (req, res, next) => {
  if (req.path.startsWith('/lead/') || req.path.startsWith('/e/')) return next();
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.headers['x-api'] !== '1') {
    return res.status(403).json({ error: 'Missing X-Api header' });
  }
  next();
});

// ─── login rate limit ───
const attempts = new Map(); // key -> {n, until}
function limited(key) {
  const a = attempts.get(key);
  return a && a.until > Date.now();
}
function recordFail(key) {
  const a = attempts.get(key) || { n: 0, until: 0 };
  a.n += 1;
  if (a.n >= 5) { a.until = Date.now() + 15 * 60 * 1000; a.n = 0; }
  attempts.set(key, a);
}

// ─── API: сессия ───
router.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const key = String(username || '').toLowerCase();
  if (limited(key)) return res.status(429).json({ error: 'Слишком много попыток. Подождите 15 минут.' });
  const user = loadUsers().find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(String(password || ''), user.hash)) {
    recordFail(key);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  attempts.delete(key);
  const token = sign({ u: user.username, exp: Date.now() + SESSION_TTL });
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sfb_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${secure}`);
  res.json({ ok: true, user: { username: user.username, role: user.role, projects: user.projects || [] } });
});
router.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'sfb_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});
router.get('/api/me', auth, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role, projects: req.user.projects || [] } });
});

// ─── API: проекты ───
router.get('/api/projects', auth, (req, res) => {
  const list = [];
  for (const slug of fs.readdirSync(PROJECTS)) {
    if (!SLUG_RE.test(slug) || !canAccess(req.user, slug)) continue;
    const f = projectFile(slug);
    if (!fs.existsSync(f)) continue;
    let name = slug;
    try { name = JSON.parse(fs.readFileSync(f, 'utf8')).name || slug; } catch {}
    list.push({ slug, name, updatedAt: fs.statSync(f).mtime.toISOString() });
  }
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json({ projects: list });
});

router.post('/api/projects', auth, adminOnly, (req, res) => {
  const { slug, name } = req.body || {};
  if (!SLUG_RE.test(String(slug || ''))) return res.status(400).json({ error: 'Slug: латиница, цифры и дефис, 2–40 символов' });
  if (fs.existsSync(projectDir(slug))) return res.status(409).json({ error: 'Проект с таким slug уже существует' });
  fs.mkdirSync(uploadsDir(slug), { recursive: true });
  const cfg = newProject(slug, String(name || slug).slice(0, 120));
  fs.writeFileSync(projectFile(slug), JSON.stringify(cfg, null, 2));
  res.json({ ok: true, slug });
});

function loadProject(req, res) {
  const slug = req.params.slug;
  if (!SLUG_RE.test(slug)) { res.status(400).json({ error: 'Некорректный slug' }); return null; }
  if (!canAccess(req.user, slug)) { res.status(403).json({ error: 'Нет доступа к этому проекту' }); return null; }
  if (!fs.existsSync(projectFile(slug))) { res.status(404).json({ error: 'Проект не найден' }); return null; }
  return slug;
}

// поля с учётными данными (почта, Telegram-бот) — видны и редактируются только админом;
// у агентов, даже с полным доступом к редактированию проекта, их нет ни в форме, ни в ответе API
const ADMIN_ONLY_FIELDS = ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'tgBotToken', 'tgChatId'];
function redactSmtp(cfg) {
  if (cfg && cfg.contacts) for (const k of ADMIN_ONLY_FIELDS) delete cfg.contacts[k];
  return cfg;
}

router.get('/api/projects/:slug', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  const cfg = JSON.parse(fs.readFileSync(projectFile(slug), 'utf8'));
  res.json({ project: req.user.role === 'admin' ? cfg : redactSmtp(cfg) });
});

router.put('/api/projects/:slug', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  const cfg = req.body && req.body.project;
  if (!cfg || typeof cfg !== 'object') return res.status(400).json({ error: 'Пустой конфиг' });
  cfg.slug = slug; // slug менять нельзя
  const f = projectFile(slug);
  if (req.user.role !== 'admin') {
    // агент не может ни увидеть, ни изменить SMTP проекта — подставляем то, что уже сохранено
    const prev = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!cfg.contacts) cfg.contacts = {};
    for (const k of ADMIN_ONLY_FIELDS) cfg.contacts[k] = (prev.contacts && prev.contacts[k]) || '';
  }
  // резервная копия предыдущей версии
  try { fs.copyFileSync(f, f + '.bak'); } catch {}
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
  res.json({ ok: true });
});

router.delete('/api/projects/:slug', auth, adminOnly, (req, res) => {
  const slug = req.params.slug;
  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Некорректный slug' });
  if (!fs.existsSync(projectDir(slug))) return res.status(404).json({ error: 'Проект не найден' });
  fs.rmSync(projectDir(slug), { recursive: true, force: true });
  fs.rmSync(path.join(SITES, slug), { recursive: true, force: true });
  // убрать slug из прав пользователей
  const users = loadUsers();
  users.forEach((u) => { u.projects = (u.projects || []).filter((s) => s !== slug); });
  saveUsers(users);
  res.json({ ok: true });
});

// ─── API: загрузка изображений ───
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir(req.params.slug)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomBytes(6).toString('hex') + (ext === '.jpeg' ? '.jpg' : ext));
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('Только JPG, PNG, WebP или SVG'));
    cb(null, true);
  }
});
// загруженное фото ужимается (до 1920px, JPEG 80) и получает адаптивные
// варианты + WebP (lib/images.js). Ошибка пайплайна не роняет загрузку —
// страница в этом случае просто отдаёт оригинал без <picture>.
router.post('/api/projects/:slug/upload', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    await makeVariants(path.join(uploadsDir(slug), req.file.filename));
    res.json({ filename: req.file.filename });
  });
});
router.get('/api/projects/:slug/images', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  const dir = uploadsDir(slug);
  const images = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
    : [];
  res.json({ images });
});
// раздача загруженных картинок (нужна авторизация и доступ к проекту)
router.get('/uploads/:slug/:file', (req, res) => {
  const p = verify(getCookie(req, 'sfb_session'));
  const user = p && loadUsers().find((u) => u.username === p.u);
  if (!user) return res.status(401).end();
  const { slug, file } = req.params;
  if (!SLUG_RE.test(slug) || !canAccess(user, slug)) return res.status(403).end();
  const safe = path.basename(file);
  const full = path.join(uploadsDir(slug), safe);
  if (!full.startsWith(uploadsDir(slug)) || !fs.existsSync(full)) return res.status(404).end();
  res.sendFile(full);
});

// ─── Фин-модель (Feasibility Studio): страница только для администратора ───
router.get('/feasibility', (req, res) => {
  const p = verify(getCookie(req, 'sfb_session'));
  const user = p && loadUsers().find((u) => u.username === p.u);
  if (!user || user.role !== 'admin') return res.redirect(BASE_PATH + '/');
  res.sendFile(path.join(ROOT, 'private', 'feasibility.html'));
});

// ─── API: сборка лендинга ───
function generate(slug) {
  const cfg = JSON.parse(fs.readFileSync(projectFile(slug), 'utf8'));
  const out = path.join(SITES, slug);
  const assets = path.join(out, 'assets');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(assets, { recursive: true });

  if (cfg.schemaVersion >= 2) {
    // v2: три языковые версии + sitemap; robots.txt не пишем — на подпапке
    // сайта он игнорируется, правила живут в корневом robots.txt домена
    const { pages, images, sitemap } = renderLanding2(cfg, { uploadsDir: uploadsDir(slug) });
    for (const [rel, html] of Object.entries(pages)) {
      const f = path.join(out, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, html);
    }
    if (sitemap) fs.writeFileSync(path.join(out, 'sitemap.xml'), sitemap);
    for (const img of images) {
      const src = path.join(uploadsDir(slug), path.basename(img));
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(assets, path.basename(img)));
    }
    return out;
  }

  const { html, images, robots, sitemap } = renderLanding(cfg);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, 'robots.txt'), robots);
  if (sitemap) fs.writeFileSync(path.join(out, 'sitemap.xml'), sitemap);
  for (const img of images) {
    const src = path.join(uploadsDir(slug), path.basename(img));
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(assets, path.basename(img)));
  }
  return out;
}
router.post('/api/projects/:slug/generate', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  try {
    generate(slug);
    res.json({ ok: true, url: `/p/${slug}/` });
  } catch (e) {
    console.error('generate failed:', e);
    res.status(500).json({ error: 'Сборка не удалась: ' + e.message });
  }
});
router.get('/api/projects/:slug/export', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  try { generate(slug); } catch (e) { return res.status(500).json({ error: 'Сборка не удалась: ' + e.message }); }
  // архив собирается целиком в память перед отправкой (не потоком): на некоторых
  // хостингах прокси перед Node-приложением ломает потоковые/chunked-ответы
  const zip = new ZipArchive({ zlib: { level: 9 } });
  const chunks = [];
  zip.on('data', (c) => chunks.push(c));
  zip.on('error', (e) => {
    console.error('export failed:', e.message);
    if (!res.headersSent) res.status(500).json({ error: 'Сборка zip не удалась: ' + e.message });
  });
  zip.on('end', () => {
    const buf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  });
  zip.directory(path.join(SITES, slug), slug);
  zip.finalize();
});

// ─── ЛИДЫ: приём с лендингов, CRM, пересылка на почту ───
function leadsFile(slug) { return path.join(projectDir(slug), 'leads.json'); }
function loadLeads(slug) {
  try { return JSON.parse(fs.readFileSync(leadsFile(slug), 'utf8')); } catch { return []; }
}
function saveLeads(slug, leads) { fs.writeFileSync(leadsFile(slug), JSON.stringify(leads, null, 2)); }

const LEAD_STATUSES = ['Новый', 'В работе', 'Встреча/показ', 'Переговоры', 'Договор', 'Отказ'];

// ─── исходящая почта: свой SMTP-ящик хостинга (если настроен), иначе FormSubmit ───
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
// rejectUnauthorized: false — на shared-хостинге сертификат почтового сервера обычно
// выпущен на общее имя сервера (например web3.webspace.uz), а не на mail.<ваш-домен>;
// соединение при этом всё равно зашифровано, отключается только строгая сверка имени
const mailer = (SMTP_HOST && SMTP_USER && SMTP_PASS)
  ? nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false }
    })
  : null;
if (mailer) console.log(`Почта: исходящие через SMTP ${SMTP_HOST} от имени ${SMTP_FROM}`);
else console.log('Почта: SMTP не настроен (SMTP_HOST/SMTP_USER/SMTP_PASS) - заявки на почту идут через FormSubmit, автоответ клиенту отправляться не будет.');

// автоответ клиенту — короткое «спасибо» сразу на трёх языках, без определения языка сайта
function autoReplyHtml(cfg, lead) {
  const name = escHtml((cfg.brand && cfg.brand.name && cfg.brand.name.ru) || cfg.name || cfg.slug || '');
  const phone = escHtml((cfg.contacts && cfg.contacts.phone) || '');
  const tg = String((cfg.contacts && cfg.contacts.telegram) || '').replace(/^@/, '');
  const contactLineRu = [phone && `по телефону ${phone}`, tg && `в Telegram @${escHtml(tg)}`].filter(Boolean).join(' или ');
  const contactLineUz = [phone && `${phone} raqamiga`, tg && `Telegram’da @${escHtml(tg)}`].filter(Boolean).join(' yoki ');
  const contactLineEn = [phone && `at ${phone}`, tg && `on Telegram at @${escHtml(tg)}`].filter(Boolean).join(' or ');
  return `
<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#212326;max-width:560px">
  <p><b>Здравствуйте${lead.name ? ', ' + escHtml(lead.name) : ''}!</b><br>
  Спасибо за заявку по проекту «${name}». Мы получили ваше обращение и скоро с вами свяжемся.${contactLineRu ? ` Если хотите быстрее - можно ${contactLineRu}.` : ''}</p>
  <hr style="border:none;border-top:1px solid #e2dfd8;margin:16px 0">
  <p><b>Assalomu alaykum${lead.name ? ', ' + escHtml(lead.name) : ''}!</b><br>
  «${name}» loyihasi bo'yicha arizangiz uchun rahmat. Murojaatingizni oldik, tez orada siz bilan bog'lanamiz.${contactLineUz ? ` Tezroq kerak bo'lsa - ${contactLineUz} murojaat qiling.` : ''}</p>
  <hr style="border:none;border-top:1px solid #e2dfd8;margin:16px 0">
  <p><b>Hello${lead.name ? ', ' + escHtml(lead.name) : ''}!</b><br>
  Thank you for your request regarding "${name}". We've received it and will contact you shortly.${contactLineEn ? ` For a faster reply, reach us ${contactLineEn}.` : ''}</p>
</div>`;
}

function leadNotificationHtml(cfg, lead) {
  const row = (label, val) => `<tr><td style="padding:4px 12px 4px 0;color:#66696e;white-space:nowrap">${escHtml(label)}</td><td style="padding:4px 0"><b>${escHtml(val || '-')}</b></td></tr>`;
  return `
<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">
  ${row('Имя', lead.name)}
  ${row('Телефон', lead.phone)}
  ${row('Email', lead.email)}
  ${row('Интересует', lead.interest)}
  ${row('Помещение', lead.lot)}
  ${row('Комментарий', lead.message)}
  ${row('Язык сайта', (lead.lang || 'ru').toUpperCase())}
</table>`;
}

// пересылка лида: своей почтой (SMTP) + автоответ клиенту, либо запасной канал FormSubmit
// SMTP для отправки: сначала свой ящик проекта (contacts.smtp*), иначе общий ящик
// приложения (переменные окружения SMTP_*), иначе — нет SMTP, используем FormSubmit
//
// транспорт для проекта создаётся заново на каждую отправку (не кэшируется):
// объём писем тут небольшой, а кэш по прошлому опыту легко протухает молча,
// если в панели поменяли только пароль — сервер продолжал бы стучаться со старым
function resolveMailer(cfg) {
  const c = cfg.contacts || {};
  if (c.smtpHost && c.smtpUser && c.smtpPass) {
    const port = Number(c.smtpPort) || 587;
    return {
      from: c.smtpUser,
      transport: nodemailer.createTransport({
        host: c.smtpHost, port, secure: port === 465,
        auth: { user: c.smtpUser, pass: c.smtpPass },
        tls: { rejectUnauthorized: false }
      })
    };
  }
  return mailer ? { transport: mailer, from: SMTP_FROM } : null;
}

async function forwardLead(cfg, lead) {
  const jobs = [];
  // адресатов может быть несколько — через запятую (например taxtapul@caseadvisory.uz, boss@…)
  const emails = String((cfg.contacts && cfg.contacts.email) || '')
    .split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes('@'));
  const projectName = cfg.name || (cfg.brand && cfg.brand.name && cfg.brand.name.ru) || cfg.slug;
  const active = resolveMailer(cfg);

  if (active) {
    if (emails.length) {
      lead.emailSent = false;
      jobs.push(active.transport.sendMail({
        from: `"${projectName}" <${active.from}>`,
        to: emails,
        subject: 'Заявка с сайта: ' + projectName + ' - ' + lead.name,
        html: leadNotificationHtml(cfg, lead)
      }).then(() => { lead.emailSent = true; }).catch((e) => { console.error('SMTP notify failed:', e.message); }));
    }
    if (lead.email) {
      jobs.push(active.transport.sendMail({
        from: `"${projectName}" <${active.from}>`,
        to: lead.email,
        subject: 'Спасибо за заявку / Arizangiz uchun rahmat / Thank you for your request',
        html: autoReplyHtml(cfg, lead)
      }).then(() => { lead.autoReplySent = true; }).catch((e) => { lead.autoReplySent = false; console.error('SMTP autoreply failed:', e.message); }));
    }
  } else if (emails.length) {
    lead.emailSent = false;
    for (const to of emails) {
      jobs.push(fetch('https://formsubmit.co/ajax/' + to, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          'Имя': lead.name, 'Телефон': lead.phone, 'Email': lead.email || '-',
          'Интересует': lead.interest || '-', 'Помещение': lead.lot || '-',
          'Комментарий': lead.message || '-', 'Язык сайта': (lead.lang || 'ru').toUpperCase(),
          '_subject': 'Заявка: ' + projectName + ' - ' + lead.name,
          '_template': 'table', '_captcha': 'false'
        })
      }).then((r) => { if (r.ok) lead.emailSent = true; }).catch(() => {}));
    }
  }
  if (cfg.contacts && cfg.contacts.sheetsEndpoint) {
    const fd = new URLSearchParams(); // Apps Script принимает form-encoded в e.parameter
    for (const k of ['name', 'phone', 'email', 'interest', 'lot', 'message', 'lang']) fd.append(k, lead[k] || '');
    jobs.push(fetch(cfg.contacts.sheetsEndpoint, { method: 'POST', body: fd, redirect: 'follow' }).catch(() => {}));
  }
  if (cfg.contacts && cfg.contacts.tgBotToken && cfg.contacts.tgChatId) {
    const text = [
      `🆕 Новая заявка: ${projectName}`,
      `Имя: ${lead.name}`,
      `Телефон: ${lead.phone}`,
      lead.email ? `Email: ${lead.email}` : null,
      `Интересует: ${lead.interest || '-'}`,
      `Помещение: ${lead.lot || '-'}`,
      lead.message ? `Комментарий: ${lead.message}` : null
    ].filter(Boolean).join('\n');
    jobs.push(fetch(`https://api.telegram.org/bot${cfg.contacts.tgBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.contacts.tgChatId, text })
    }).then((r) => { lead.tgSent = r.ok; }).catch((e) => { lead.tgSent = false; console.error('Telegram notify failed:', e.message); }));
  }
  await Promise.allSettled(jobs);
}

// публичный приём заявок с лендинга (без авторизации, с CORS — лендинг может жить на другом домене)
const leadHits = new Map(); // ip -> {n, since}
router.options('/api/lead/:slug', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
});
// ─── приём событий аналитики лендинга (фундамент дашборда, Блок C) ───
// Публичный эндпоинт: лендинг шлёт батчи через sendBeacon. Хранение —
// append-only NDJSON по дням: переживает частые рестарты Passenger.
// IP не сохраняется — только суточный HMAC-хэш для подсчёта уникальных.
const BOT_UA_RE = /bot|crawl|spider|slurp|preview|fetch|monitor|curl|wget|headless/i;
router.post('/api/e/:slug', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const slug = req.params.slug;
  if (!SLUG_RE.test(slug) || !fs.existsSync(projectFile(slug))) return res.status(404).end();
  res.status(204).end(); // отвечаем сразу, запись — после
  try {
    const ua = String(req.headers['user-agent'] || '');
    if (!ua || BOT_UA_RE.test(ua)) return; // бот-фильтр на входе
    const b = req.body || {};
    const events = Array.isArray(b.events) ? b.events.slice(0, 50) : [];
    if (!events.length) return;
    const day = new Date().toISOString().slice(0, 10);
    const vid = crypto.createHmac('sha256', SECRET + day)
      .update(String(req.ip || '') + '|' + ua).digest('hex').slice(0, 16);
    const dir = path.join(DATA, 'analytics', slug);
    fs.mkdirSync(dir, { recursive: true });
    const lines = events.map((e) => JSON.stringify({
      t: String(e.t || '').slice(0, 40),
      ts: Number(e.ts) || Date.now(),
      sid: String(b.sid || '').slice(0, 40),
      vid,
      lang: String(b.lang || '').slice(0, 5),
      intent: e.intent === 'buy' ? 'buy' : 'lease',
      d: (() => { // компактные полезные поля события, без свободного текста
        const out = {};
        for (const k of ['url', 'ref', 'dev', 'sw', 'depth', 'unit', 'cta', 'q', 'svc', 'where', 'to']) {
          if (e[k] !== undefined) out[k] = String(e[k]).slice(0, 300);
        }
        if (e.utm && typeof e.utm === 'object') {
          out.utm = {};
          for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
            if (e.utm[k]) out.utm[k] = String(e.utm[k]).slice(0, 200);
          }
        }
        return out;
      })()
    })).join('\n') + '\n';
    fs.appendFileSync(path.join(dir, `events-${day}.ndjson`), lines);
  } catch (e) {
    console.error('Событие аналитики не записано:', e.message);
  }
});

router.post('/api/lead/:slug', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const slug = req.params.slug;
  if (!SLUG_RE.test(slug) || !fs.existsSync(projectFile(slug))) return res.status(404).json({ error: 'not found' });
  const ip = req.ip || 'x';
  const hit = leadHits.get(ip) || { n: 0, since: Date.now() };
  if (Date.now() - hit.since > 60 * 1000) { hit.n = 0; hit.since = Date.now(); }
  hit.n += 1; leadHits.set(ip, hit);
  if (hit.n > 10) return res.status(429).json({ error: 'слишком часто' });
  const b = req.body || {};
  if (b._honey || b.company) return res.json({ ok: true }); // honeypot (v1: _honey, v2: company) — делаем вид, что приняли
  const name = String(b.name || '').trim().slice(0, 200);
  const phone = String(b.phone || '').trim().slice(0, 50);
  if (!name || !phone) return res.status(400).json({ error: 'имя и телефон обязательны' });
  const lead = {
    id: crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
    name, phone,
    email: String(b.email || '').trim().slice(0, 200),
    interest: String(b.interest || '').trim().slice(0, 100),
    lot: String(b.lot || '').trim().slice(0, 200),
    message: String(b.message || '').trim().slice(0, 2000),
    lang: String(b.lang || 'ru').slice(0, 5),
    source: 'Сайт',
    status: 'Новый',
    note: '',
    emailSent: null
  };
  // лендинг v2: намерение (аренда/покупка), выбранный юнит и UTM первого касания
  if (b.intent) lead.intent = String(b.intent).slice(0, 20);
  if (b.unit) lead.unit = String(b.unit).slice(0, 20);
  if (b.utm && typeof b.utm === 'object') {
    lead.utm = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      if (b.utm[k]) lead.utm[k] = String(b.utm[k]).slice(0, 200);
    }
  }
  const leads = loadLeads(slug);
  leads.unshift(lead);
  saveLeads(slug, leads);
  res.json({ ok: true });
  // пересылка — после ответа клиенту, результат допишем в файл
  const cfg = JSON.parse(fs.readFileSync(projectFile(slug), 'utf8'));
  forwardLead(cfg, lead).then(() => {
    const cur = loadLeads(slug);
    const i = cur.findIndex((l) => l.id === lead.id);
    if (i !== -1) { cur[i].emailSent = lead.emailSent; cur[i].autoReplySent = lead.autoReplySent; cur[i].tgSent = lead.tgSent; saveLeads(slug, cur); }
  });
});

// CRM: чтение и ведение лидов (по правам доступа)
router.get('/api/leads', auth, (req, res) => {
  const out = [];
  for (const slug of fs.readdirSync(PROJECTS)) {
    if (!SLUG_RE.test(slug) || !canAccess(req.user, slug)) continue;
    for (const l of loadLeads(slug)) out.push({ ...l, project: slug });
  }
  out.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  res.json({ leads: out, statuses: LEAD_STATUSES });
});
function csvCell(v) {
  const s = String(v == null ? '' : v).replace(/\r?\n/g, ' ');
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
router.get('/api/leads/export', auth, (req, res) => {
  const names = {};
  const rows = [];
  for (const slug of fs.readdirSync(PROJECTS)) {
    if (!SLUG_RE.test(slug) || !canAccess(req.user, slug)) continue;
    try { names[slug] = JSON.parse(fs.readFileSync(projectFile(slug), 'utf8')).name || slug; } catch { names[slug] = slug; }
    for (const l of loadLeads(slug)) rows.push({ ...l, project: slug });
  }
  rows.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  const projectFilter = req.query.project;
  const statusFilter = req.query.status;
  const filtered = rows.filter((l) =>
    (!projectFilter || l.project === projectFilter) && (!statusFilter || l.status === statusFilter));
  const header = ['Дата', 'Проект', 'Имя', 'Телефон', 'Email', 'Интересует', 'Помещение', 'Комментарий', 'Источник', 'Статус', 'Заметка'];
  const lines = [header.map(csvCell).join(',')];
  for (const l of filtered) {
    lines.push([
      l.ts, names[l.project] || l.project, l.name, l.phone, l.email, l.interest, l.lot, l.message, l.source, l.status, l.note
    ].map(csvCell).join(','));
  }
  const csv = '﻿' + lines.join('\r\n'); // BOM — чтобы Excel сразу увидел кириллицу
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});
router.post('/api/leads', auth, (req, res) => {
  const b = req.body || {};
  const slug = String(b.project || '');
  if (!SLUG_RE.test(slug) || !canAccess(req.user, slug)) return res.status(403).json({ error: 'Нет доступа к проекту' });
  if (!fs.existsSync(projectFile(slug))) return res.status(404).json({ error: 'Проект не найден' });
  const name = String(b.name || '').trim().slice(0, 200);
  const phone = String(b.phone || '').trim().slice(0, 50);
  if (!name || !phone) return res.status(400).json({ error: 'Имя и телефон обязательны' });
  const lead = {
    id: crypto.randomBytes(6).toString('hex'),
    ts: new Date().toISOString(),
    name, phone,
    email: String(b.email || '').trim().slice(0, 200),
    interest: String(b.interest || '').trim().slice(0, 100),
    lot: String(b.lot || '').trim().slice(0, 200),
    message: String(b.message || '').trim().slice(0, 2000),
    lang: 'ru',
    source: ['Звонок', 'Telegram', 'Рекомендация', 'Другое'].includes(b.source) ? b.source : 'Другое',
    status: 'Новый', note: '', emailSent: null
  };
  const leads = loadLeads(slug);
  leads.unshift(lead);
  saveLeads(slug, leads);
  res.json({ ok: true, id: lead.id });
});
router.put('/api/leads/:slug/:id', auth, (req, res) => {
  const { slug, id } = req.params;
  if (!SLUG_RE.test(slug) || !canAccess(req.user, slug)) return res.status(403).json({ error: 'Нет доступа' });
  const leads = loadLeads(slug);
  const lead = leads.find((l) => l.id === id);
  if (!lead) return res.status(404).json({ error: 'Лид не найден' });
  const b = req.body || {};
  if (b.status != null && LEAD_STATUSES.includes(b.status)) lead.status = b.status;
  if (b.note != null) lead.note = String(b.note).slice(0, 2000);
  saveLeads(slug, leads);
  res.json({ ok: true });
});
router.delete('/api/leads/:slug/:id', auth, adminOnly, (req, res) => {
  const { slug, id } = req.params;
  if (!SLUG_RE.test(slug)) return res.status(400).json({ error: 'Некорректный slug' });
  const leads = loadLeads(slug);
  const i = leads.findIndex((l) => l.id === id);
  if (i === -1) return res.status(404).json({ error: 'Лид не найден' });
  leads.splice(i, 1);
  saveLeads(slug, leads);
  res.json({ ok: true });
});

// ─── API: пользователи (только админ) ───
const USERNAME_RE = /^[a-zA-Z0-9._-]{2,40}$/;
router.get('/api/users', auth, adminOnly, (req, res) => {
  res.json({ users: loadUsers().map((u) => ({ username: u.username, role: u.role, projects: u.projects || [] })) });
});
router.post('/api/users', auth, adminOnly, (req, res) => {
  const { username, password, role, projects } = req.body || {};
  if (!USERNAME_RE.test(String(username || ''))) return res.status(400).json({ error: 'Логин: латиница/цифры/._-, 2–40 символов' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
  const users = loadUsers();
  if (users.some((u) => u.username === username)) return res.status(409).json({ error: 'Такой логин уже есть' });
  users.push({
    username,
    hash: bcrypt.hashSync(String(password), 10),
    role: role === 'admin' ? 'admin' : 'agent',
    projects: Array.isArray(projects) ? projects.filter((s) => SLUG_RE.test(s)) : []
  });
  saveUsers(users);
  res.json({ ok: true });
});
router.put('/api/users/:username', auth, adminOnly, (req, res) => {
  const users = loadUsers();
  const u = users.find((x) => x.username === req.params.username);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  const { password, role, projects } = req.body || {};
  if (password != null) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    u.hash = bcrypt.hashSync(String(password), 10);
  }
  if (role != null) {
    if (u.username === req.user.username && role !== 'admin') return res.status(400).json({ error: 'Нельзя снять права с самого себя' });
    u.role = role === 'admin' ? 'admin' : 'agent';
  }
  if (projects != null) u.projects = Array.isArray(projects) ? projects.filter((s) => SLUG_RE.test(s)) : [];
  saveUsers(users);
  res.json({ ok: true });
});
router.delete('/api/users/:username', auth, adminOnly, (req, res) => {
  if (req.params.username === req.user.username) return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  const users = loadUsers();
  const idx = users.findIndex((x) => x.username === req.params.username);
  if (idx === -1) return res.status(404).json({ error: 'Пользователь не найден' });
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ ok: true });
});

// ─── аналитика лендинга: агрегация NDJSON-событий для дашборда ───
function refDomain(ref) {
  if (!ref) return 'Прямые заходы';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (/caseadvisory/.test(h)) return 'Прямые заходы';
    if (/t\.me|telegram/.test(h)) return 'Telegram';
    if (/instagram/.test(h)) return 'Instagram';
    if (/facebook|fb\.com/.test(h)) return 'Facebook';
    if (/google\./.test(h)) return 'Google';
    if (/yandex\./.test(h)) return 'Яндекс';
    return h;
  } catch { return 'Прямые заходы'; }
}
router.get('/api/analytics/:slug', auth, (req, res) => {
  const slug = req.params.slug;
  // slug 'all' — сводно по всем доступным пользователю лендингам
  let slugs;
  if (slug === 'all') {
    slugs = fs.readdirSync(PROJECTS).filter((s) => SLUG_RE.test(s) && canAccess(req.user, s));
  } else {
    if (!SLUG_RE.test(slug) || !canAccess(req.user, slug)) return res.status(403).json({ error: 'Нет доступа' });
    slugs = [slug];
  }
  const days = Math.max(0, parseInt(req.query.days, 10) || 30); // 0 = за всё время
  const since = days ? Date.now() - days * 24 * 3600 * 1000 : 0;

  const inc = (m, k, n) => { if (k) m[k] = (m[k] || 0) + (n || 1); };
  const out = {
    visits: 0, uniques: 0, byDay: {}, sources: {}, utm: {}, devices: {}, langs: {}, intents: {},
    clicks: {}, ctas: {}, units: {}, routes: {}, pdf: 0, mapOpens: 0, faqOpens: 0,
    funnel: { all: {}, lease: {}, buy: {} }
  };
  const vids = new Set();
  const sess = new Map(); // sid -> {steps:Set, intents:Set}

  for (const oneSlug of slugs) {
    const dir = path.join(DATA, 'analytics', oneSlug);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      const m = f.match(/^events-(\d{4}-\d{2}-\d{2})\.ndjson$/);
      if (!m) continue;
      if (since && new Date(m[1] + 'T23:59:59Z').getTime() < since) continue;
      let lines;
      try { lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n'); } catch { continue; }
      for (const line of lines) {
        if (!line) continue;
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (since && e.ts && e.ts < since) continue;
        const d = e.d || {};
        const day = m[1];
        let s = sess.get(e.sid);
        if (!s) { s = { steps: new Set(), intents: new Set() }; sess.set(e.sid, s); }
        if (e.intent) s.intents.add(e.intent);

        switch (e.t) {
          case 'page_view':
            out.visits++; vids.add(e.vid);
            if (!out.byDay[day]) out.byDay[day] = { views: 0, vids: new Set() };
            out.byDay[day].views++; out.byDay[day].vids.add(e.vid);
            inc(out.devices, d.dev === 'mobile' ? 'Телефон' : 'Компьютер');
            inc(out.langs, (e.lang || 'ru').toUpperCase());
            if (d.utm && d.utm.utm_source) inc(out.utm, d.utm.utm_source + (d.utm.utm_campaign ? ' / ' + d.utm.utm_campaign : ''));
            else inc(out.sources, refDomain(d.ref));
            s.steps.add('visit');
            break;
          case 'scroll_depth': if (Number(d.depth) >= 50) s.steps.add('scroll50'); break;
          case 'unit_click': inc(out.units, d.unit + '|clicks'); s.steps.add('units'); break;
          case 'plan_view': inc(out.units, d.unit + '|plans'); break;
          case 'plan_download': inc(out.units, d.unit + '|downloads'); inc(out.clicks, 'Скачивание планировки'); break;
          case 'unit_request': inc(out.units, d.unit + '|requests'); s.steps.add('cta'); break;
          case 'cta_click': inc(out.ctas, d.cta); s.steps.add('cta'); break;
          case 'phone_click': inc(out.clicks, 'Телефон'); s.steps.add('cta'); break;
          case 'telegram_click': inc(out.clicks, 'Telegram'); s.steps.add('cta'); break;
          case 'pdf_download': out.pdf++; inc(out.clicks, 'Презентация (PDF)'); break;
          case 'map_open': out.mapOpens++; break;
          case 'route_click': inc(out.routes, d.svc === 'google' ? 'Google Maps' : 'Яндекс Карты'); break;
          case 'faq_open': out.faqOpens++; break;
          case 'intent_switch': inc(out.intents, e.intent === 'buy' ? 'Покупка' : 'Аренда'); break;
          case 'form_start': s.steps.add('form_start'); break;
          case 'form_submit': s.steps.add('form_submit'); break;
          case 'form_success': s.steps.add('form_success'); break;
        }
      }
    }
  }
  out.uniques = vids.size;
  for (const day of Object.keys(out.byDay)) {
    out.byDay[day] = { views: out.byDay[day].views, uniques: out.byDay[day].vids.size };
  }
  // воронка: шаги по сессиям (все / только аренда / только покупка)
  const STEPS = ['visit', 'scroll50', 'units', 'cta', 'form_start', 'form_submit', 'form_success'];
  for (const key of ['all', 'lease', 'buy']) {
    const f = {};
    for (const st of STEPS) f[st] = 0;
    for (const s of sess.values()) {
      if (key !== 'all' && !s.intents.has(key)) continue;
      for (const st of STEPS) if (s.steps.has(st)) f[st]++;
    }
    out.funnel[key] = f;
  }
  // лиды за период — из CRM (по тем же лендингам)
  let leads = 0;
  for (const oneSlug of slugs) {
    for (const l of loadLeads(oneSlug)) {
      const t = new Date(l.ts).getTime();
      if (!since || t >= since) leads++;
    }
  }
  out.leads = leads;
  res.json(out);
});

// ─── бэкап данных (только админ, скачивание по запросу) ───
router.get('/api/backup', auth, adminOnly, async (req, res) => {
  try {
    const buf = await buildBackupZip(DATA);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.zip"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (e) {
    console.error('Не удалось собрать бэкап:', e.message);
    res.status(500).json({ error: 'Не удалось собрать бэкап' });
  }
});

// ─── статика: собранные лендинги (публично) и SPA панели ───
router.use('/p', express.static(SITES, { fallthrough: false, index: 'index.html' }));
router.use(express.static(path.join(ROOT, 'public')));

// после рестарта/деплоя пересобрать лендинги, которых нет на диске
function regenerateMissing() {
  for (const slug of fs.readdirSync(PROJECTS)) {
    if (!SLUG_RE.test(slug) || !fs.existsSync(projectFile(slug))) continue;
    if (!fs.existsSync(path.join(SITES, slug, 'index.html'))) {
      try { generate(slug); console.log(`Пересобран лендинг: /p/${slug}/`); }
      catch (e) { console.error(`Не удалось пересобрать ${slug}:`, e.message); }
    }
  }
}

// панель на подпапке (BASE_PATH=/admin): адрес без завершающего слэша
// (например /admin) редиректим на /admin/, иначе относительные ссылки на
// style.css/app.js в браузере разрешатся неправильно
if (BASE_PATH) {
  app.get(BASE_PATH, (req, res, next) => {
    // без явной проверки этот маршрут в Express совпадает и с "/admin/" —
    // из-за нестрогого сравнения путей по умолчанию, отсекаем вручную,
    // иначе получится редирект самого на себя
    if (req.path === BASE_PATH) return res.redirect(301, BASE_PATH + '/');
    next();
  });
}
app.use(BASE_PATH || '/', router);

app.listen(PORT, () => {
  loadUsers(); // создаст админа при первом запуске
  regenerateMissing();
  console.log(`Панель запущена: http://localhost:${PORT}${BASE_PATH || ''}`);
  console.log(`Собранные лендинги: http://localhost:${PORT}${BASE_PATH}/p/<slug>/`);
});
