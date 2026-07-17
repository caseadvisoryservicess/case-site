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
const archiver = require('archiver');
const { renderLanding } = require('./lib/template');
const { newProject } = require('./lib/blank');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const PROJECTS = path.join(DATA, 'projects');
const SITES = path.join(ROOT, 'sites');
const PORT = process.env.PORT || 3000;

fs.mkdirSync(PROJECTS, { recursive: true });
fs.mkdirSync(SITES, { recursive: true });

// ─── секрет для подписи сессионных cookie (создаётся один раз) ───
const SECRET_FILE = path.join(DATA, '.secret');
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

// ─── пользователи ───
const USERS_FILE = path.join(DATA, 'users.json');
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // первый запуск: admin / admin — сменить сразу после входа!
    const seed = [{ username: 'admin', hash: bcrypt.hashSync('admin', 10), role: 'admin', projects: [] }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(seed, null, 2));
    console.log('Создан пользователь admin с паролем "admin" — смените пароль после первого входа!');
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
app.use(express.json({ limit: '3mb' }));

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
app.use('/api', (req, res, next) => {
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
app.post('/api/login', (req, res) => {
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
  res.setHeader('Set-Cookie', `sfb_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`);
  res.json({ ok: true, user: { username: user.username, role: user.role, projects: user.projects || [] } });
});
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'sfb_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});
app.get('/api/me', auth, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role, projects: req.user.projects || [] } });
});

// ─── API: проекты ───
app.get('/api/projects', auth, (req, res) => {
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

app.post('/api/projects', auth, adminOnly, (req, res) => {
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

app.get('/api/projects/:slug', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  res.json({ project: JSON.parse(fs.readFileSync(projectFile(slug), 'utf8')) });
});

app.put('/api/projects/:slug', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  const cfg = req.body && req.body.project;
  if (!cfg || typeof cfg !== 'object') return res.status(400).json({ error: 'Пустой конфиг' });
  cfg.slug = slug; // slug менять нельзя
  // резервная копия предыдущей версии
  const f = projectFile(slug);
  try { fs.copyFileSync(f, f + '.bak'); } catch {}
  fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
  res.json({ ok: true });
});

app.delete('/api/projects/:slug', auth, adminOnly, (req, res) => {
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
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
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
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('Только JPG, PNG или WebP'));
    cb(null, true);
  }
});
app.post('/api/projects/:slug/upload', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
    if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
    res.json({ filename: req.file.filename });
  });
});
app.get('/api/projects/:slug/images', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  const dir = uploadsDir(slug);
  const images = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
    : [];
  res.json({ images });
});
// раздача загруженных картинок (нужна авторизация и доступ к проекту)
app.get('/uploads/:slug/:file', (req, res) => {
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

// ─── API: сборка лендинга ───
function generate(slug) {
  const cfg = JSON.parse(fs.readFileSync(projectFile(slug), 'utf8'));
  const { html, images } = renderLanding(cfg);
  const out = path.join(SITES, slug);
  const assets = path.join(out, 'assets');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), html);
  for (const img of images) {
    const src = path.join(uploadsDir(slug), path.basename(img));
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(assets, path.basename(img)));
  }
  return out;
}
app.post('/api/projects/:slug/generate', auth, (req, res) => {
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
app.get('/api/projects/:slug/export', auth, (req, res) => {
  const slug = loadProject(req, res);
  if (!slug) return;
  try { generate(slug); } catch (e) { return res.status(500).json({ error: 'Сборка не удалась: ' + e.message }); }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
  const zip = archiver('zip', { zlib: { level: 9 } });
  zip.on('error', () => res.end());
  zip.pipe(res);
  zip.directory(path.join(SITES, slug), slug);
  zip.finalize();
});

// ─── API: пользователи (только админ) ───
const USERNAME_RE = /^[a-zA-Z0-9._-]{2,40}$/;
app.get('/api/users', auth, adminOnly, (req, res) => {
  res.json({ users: loadUsers().map((u) => ({ username: u.username, role: u.role, projects: u.projects || [] })) });
});
app.post('/api/users', auth, adminOnly, (req, res) => {
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
app.put('/api/users/:username', auth, adminOnly, (req, res) => {
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
app.delete('/api/users/:username', auth, adminOnly, (req, res) => {
  if (req.params.username === req.user.username) return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  const users = loadUsers();
  const idx = users.findIndex((x) => x.username === req.params.username);
  if (idx === -1) return res.status(404).json({ error: 'Пользователь не найден' });
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ ok: true });
});

// ─── статика: собранные лендинги (публично) и SPA панели ───
app.use('/p', express.static(SITES, { fallthrough: false, index: 'index.html' }));
app.use(express.static(path.join(ROOT, 'public')));

app.listen(PORT, () => {
  loadUsers(); // создаст admin/admin при первом запуске
  console.log(`Панель запущена: http://localhost:${PORT}`);
  console.log(`Собранные лендинги: http://localhost:${PORT}/p/<slug>/`);
});
