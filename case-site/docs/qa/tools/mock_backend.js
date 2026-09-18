/* Мок-бэкенд CASE OS для E2E: эмулирует auth.php, state.php, unit_patch.php, units_batch.php,
   geo_state.php, user_prefs.php, workspace_access.php с управляемыми отказами.
   Управление: POST /__ctl {sessionValid:false} - «сессия истекла» (все api → 401);
               {failMode:'reject-units'} - unit_patch отвечает 403; {failMode:null} - норма.
   Экспортирует createMockServer(osDir) → {srv, base, ctl}. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv' };

function createMockServer(OS_DIR, opts) {
  opts = opts || {};
  const state = {
    sessionValid: true,
    failMode: null,
    appState: { data: opts.initialState || {}, revision: 1, updatedAt: '2026-07-24 12:00:00' },
    geo: { data: { datasets: {}, projects: [] }, geo_revision: 1 },
    unitPatches: [],          // все принятые патчи
    statePosts: [],           // все принятые POST state.php (ключи)
    user: { id: 'u-ho', name: 'Hilola Omonullayeva', role: 'HO', role_key: 'HO', role_label: 'Администратор аренды', admin: false, edit: true, leasing: true, finance: true, csrf: 't0k3n' },
    rights: { leasing: 1, finance: 1, edit: 1, approve: 0, plans: 1, admin: 0, own_only: 0, project_scope: 0 },
  };
  const json = (rsp, code, obj) => { rsp.writeHead(code, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify(obj)); };
  const readBody = req => new Promise(res => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { res({}); } }); });

  const srv = http.createServer(async (req, rsp) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/__ctl') { const b = await readBody(req); Object.assign(state, b); json(rsp, 200, { ok: true, state: { sessionValid: state.sessionValid, failMode: state.failMode } }); return; }
    if (p === '/__inspect') { json(rsp, 200, { unitPatches: state.unitPatches, statePosts: state.statePosts, appState: state.appState, geo: { geo_revision: state.geo.geo_revision, datasets: Object.keys(state.geo.data.datasets || {}) } }); return; }

    if (p.startsWith('/api/')) {
      const ep = p.slice(5);
      // истёкшая сессия: auth.php отвечает «не авторизован», остальные - 401
      if (!state.sessionValid) {
        if (ep === 'auth.php' && req.method === 'GET') { json(rsp, 200, { auth: false, csrf: 't0k3n', pass_login: true, code_login: false, mode: state.mode || 'full', registration: state.registration !== false, demo_login: state.demoLogin !== false }); return; }
        if (ep !== 'auth.php') { json(rsp, 401, { error: 'Не авторизован' }); return; } /* v4.76.0: вход, регистрация и демо работают без сеанса */
      }
      if (ep === 'auth.php') {
        /* v4.74.0: боевой auth.php отдаёт режим платформы; по умолчанию мок отвечает full, чтобы старые проверки других разделов не уходили в гео-режим */
        /* v4.76.0: флаги регистрации и демо, срок доступа */
        const flags = { pass_login: true, code_login: false, mode: state.mode || 'full', registration: state.registration !== false, demo_login: state.demoLogin !== false, offer_version: state.offerVersion || '1.0', offer_url: 'offer.html' };
        if (req.method === 'GET') { json(rsp, 200, Object.assign({ auth: true, user: state.user, rights: state.rights, csrf: state.user.csrf }, flags)); return; }
        const b = await readBody(req);
        if (b.action === 'logout') { json(rsp, 200, { ok: true }); return; }
        if (b.action === 'login') { if (state.loginError) { json(rsp, 403, { error: state.loginError }); return; } state.sessionValid = true; json(rsp, 200, { ok: true, user: state.user, rights: state.rights, csrf: state.user.csrf, mode: state.mode || 'full' }); return; }
        if (b.action === 'register') { if (!b.offer_accepted) { json(rsp, 400, { error: 'Нужно согласие с публичной офертой: отметьте галочку «принимаю условия»' }); return; } state.registrations = state.registrations || []; state.registrations.push(b); if (b.purpose === 'office' && state.freeOffice !== false) { json(rsp, 200, { ok: true, active: true, free: true, message: 'Доступ открыт: бесплатный ограниченный доступ «Ищу офис» (40 бизнес-центров, без выгрузки). Войдите с вашим email и паролем.' }); return; } json(rsp, 200, { ok: true, pending: true, message: 'Заявка принята. Администратор CASE проверит её и откроет доступ; вы получите письмо на ' + b.email + '.' }); return; }
        /* v4.77.0: личный кабинет */
        if (b.action === 'accept_offer') { state.user.settings = Object.assign({}, state.user.settings || {}, { offer_accepted: { version: state.offerVersion || '1.0', at: '2026-09-18 10:00:00' } }); if (state.user.caps) state.user.caps.offer_accepted = true; state.offerAccepts = (state.offerAccepts || 0) + 1; json(rsp, 200, { ok: true, version: state.offerVersion || '1.0' }); return; }
        if (b.action === 'update_profile') { state.profilePosts = state.profilePosts || []; state.profilePosts.push(b); if (b.name) state.user.name = b.name; state.user.settings = Object.assign({}, state.user.settings || {}, { company: b.company, phone: b.phone }, b.profile != null ? { profile: b.profile } : {}); json(rsp, 200, { ok: true, name: state.user.name, settings: state.user.settings }); return; }
        if (b.action === 'change_password') { state.passwordPosts = state.passwordPosts || []; state.passwordPosts.push(b); if (b.old_password !== 'password1') { json(rsp, 403, { error: 'Текущий пароль неверный' }); return; } json(rsp, 200, { ok: true }); return; }
        if (b.action === 'my_log') { json(rsp, 200, { rows: state.myLog || [{ id: 1, action: 'Вход в систему', detail: 'роль: ' + state.user.role, at: '2026-09-18 09:00:00' }] }); return; }
        if (b.action === 'demo') { if (state.demoLogin === false) { json(rsp, 403, { error: 'Демо-доступ отключён' }); return; } state.sessionValid = true; state.user = state.demoUser || { id: 'u-demo', name: 'Демо-доступ', role: 'DEMO', role_key: 'DEMO', role_label: 'Демо-доступ', admin: false, edit: false, csrf: 't0k3n', type: 'demo', demo: true, days_left: null, expires_at: null, settings: {}, caps: { type: 'demo', demo: true, export: false, edit: false, days_left: null, expires_at: null } }; state.rights = { leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, admin: 0, own_only: 0, project_scope: 0 }; json(rsp, 200, { ok: true, user: state.user, rights: state.rights, csrf: state.user.csrf, mode: state.mode || 'full' }); return; }
        json(rsp, 200, { auth: true, user: state.user, rights: state.rights, csrf: state.user.csrf }); return;
      }
      if (ep === 'workspace_access.php') { json(rsp, 200, { allowed: true, can_edit: true }); return; }
      if (ep === 'user_prefs.php') {
        if (req.method === 'GET') { json(rsp, 200, { data: state.prefs || {} }); return; }
        const b = await readBody(req); state.prefs = b.data || {}; json(rsp, 200, { ok: true }); return;
      }
      if (ep === 'state.php') {
        if (req.method === 'GET') { json(rsp, 200, { data: state.appState.data, revision: state.appState.revision, updated_at: state.appState.updatedAt, updated_by: state.updatedBy || 'mock',
          restricted_keys: state.restrictedKeys || [] }); return; }   /* как настоящий state.php: список закрытых для роли разделов */
        const b = await readBody(req);
        if (state.failMode === 'state-conflict') { json(rsp, 409, { error: 'Данные уже изменены другим пользователем. Обновите страницу и повторите действие.' }); return; }
        const incoming = b.data || {};
        state.statePosts.push(Object.keys(incoming));
        const rejected = [];
        if (state.failMode === 'reject-brands' && incoming.BRANDS) { rejected.push('BRANDS'); delete incoming.BRANDS; }
        /* Боевой state.php закрытые разделы не пишет, возвращает прежние и перечисляет
           в rejected_keys. Мок обязан вести себя так же, иначе тест на лишние отправки
           ничего не поймает. */
        (state.restrictedKeys || []).forEach(k => {
          if (Object.prototype.hasOwnProperty.call(incoming, k)) {
            const cur = JSON.stringify(state.appState.data[k]);
            if (cur !== JSON.stringify(incoming[k])) rejected.push(k);
            delete incoming[k];
          }
        });
        Object.assign(state.appState.data, incoming);
        state.appState.revision++;
        json(rsp, 200, Object.assign({ ok: true, revision: state.appState.revision, updated_at: '2026-07-24 12:00:01' }, rejected.length ? { rejected_keys: rejected } : {})); return;
      }
      if (ep === 'unit_patch.php' || ep === 'units_batch.php') {
        const b = await readBody(req);
        if (state.failMode === 'reject-units') { json(rsp, 403, { error: 'Нет прав на изменение реестра' }); return; }
        if (state.failMode === 'units-500') { json(rsp, 500, { error: 'Внутренняя ошибка' }); return; }
        state.unitPatches.push(b);
        /* Настоящий unit_patch.php делает UPDATE app_state - мок обязан вести себя так же,
           иначе тест «данные не доехали до сервера» даёт ложное срабатывание. */
        const NUM = ['area','terr','rate','budget','budLand','factLand','capex','total','gap'];
        const ALLOWED = new Set(['code','block','floor','area','terr','cat','sub','rate','budget','budLand','factLand','capex','total','gap','status','broker','assignedTo','assigned_to','vars','shortlist','merged','offer','comment','comments','dates','hist','leaseModel','vat','utilities','terms','opening','reservationEnd','contractSign','contractEnd','rateReview','fitout','handover','specialTerms','brand','tenant','layoutVersionId','layoutVersionNo','layoutSource','manualOverride','updatedAt','updatedBy']);
        const applyOne = (id, changes) => {
          const arr = state.appState.data && state.appState.data.U;
          if (!Array.isArray(arr)) return;
          const u = arr.find(x => x && x.id === id);
          if (!u || !changes) return;
          Object.keys(changes).forEach(k => {
            if (!ALLOWED.has(k)) return;
            u[k] = NUM.indexOf(k) >= 0 ? (changes[k] === '' || changes[k] == null ? 0 : Number(changes[k])) : changes[k];
          });
        };
        if (ep === 'unit_patch.php') applyOne(b.id, b.changes || b.patch || b.fields);
        else (Array.isArray(b.units) ? b.units : []).forEach(x => applyOne(x.id, x.changes || x));
        state.appState.updatedAt = '2026-07-27 12:00:00';
        json(rsp, 200, { ok: true, applied: true, revision: ++state.appState.revision, updated: [] }); return;
      }
      if (ep === 'geo_state.php') {
        if (req.method === 'GET') {
          if (/[?&]trash=1/.test(req.url)) { json(rsp, 200, { trash: state.trash || [] }); return; } /* v4.76.0: корзина геоданных */
          json(rsp, 200, { data: state.geo.data, geo_revision: state.geo.geo_revision, app_revision: state.appState.revision, updated_at: null }); return; }
        const b = await readBody(req);
        if (b.action === 'restore_trash') { const t = (state.trash || []).find(x => x.id === b.trash_id); if (!t) { json(rsp, 404, { error: 'Запись корзины не найдена' }); return; } t.restored_at = '2026-09-17 12:00:00'; t.restored_by = state.user.name; state.geo.geo_revision++; json(rsp, 200, { ok: true, geo_revision: state.geo.geo_revision }); return; }
        if (state.failMode === 'geo-403') { json(rsp, 403, { error: 'Нет доступа к геоаналитике' }); return; }
        if (state.failMode === 'geo-conflict') { json(rsp, 409, { error: 'Геоданные изменены другим пользователем' }); return; }
        state.geo.data = b.data || state.geo.data; state.geo.geo_revision++;
        json(rsp, 200, { ok: true, geo_revision: state.geo.geo_revision, updated_at: '2026-07-24 12:00:02', updated_by: state.user.name }); return;
      }
      if (ep === 'data.php') {
        if (req.method === 'GET') { const t = (req.url.match(/[?&]table=([^&]+)/) || [])[1]; json(rsp, 200, { rows: t === 'app_users' ? (state.users || []) : t === 'roles' ? (state.roles || []) : [] }); return; }
        json(rsp, 200, { ok: true }); return;
      }
      /* v4.77.0: обратная связь */
      if (ep === 'feedback.php') {
        state.feedback = state.feedback || [];
        if (req.method === 'GET') {
          if (/[?&]count=1/.test(req.url)) { json(rsp, 200, { new: state.feedback.filter(f => f.status === 'new').length }); return; }
          if (/[?&]mine=1/.test(req.url) || !state.user.admin) { json(rsp, 200, { rows: state.feedback.filter(f => f.user_id === state.user.id) }); return; }
          json(rsp, 200, { rows: state.feedback.slice() }); return;
        }
        const b = await readBody(req);
        if (b.action === 'status') { const f = state.feedback.find(x => x.id === b.id); if (f) { f.status = b.status; if (b.reply != null) { f.reply = b.reply; f.replied_by = state.user.name; } f.updated_at = '2026-09-18 12:00:00'; } json(rsp, 200, { ok: true }); return; }
        const id = state.feedback.length + 1;
        state.feedback.unshift({ id, user_id: state.user.id, user_name: state.user.name, user_email: state.user.email || '', channel: 'app', kind: b.kind || 'idea', text: b.text, page: b.page || '', status: 'new', reply: null, created_at: '2026-09-18 11:00:00' });
        json(rsp, 200, { ok: true, id }); return;
      }
      /* v4.76.0: настройки доступа, подтверждение заявок, журнал пользователя */
      if (ep === 'users.php') {
        const b = await readBody(req); state.userPosts = state.userPosts || []; state.userPosts.push(b);
        const row = (state.users || []).find(u => u.id === b.id);
        if (b.action === 'set_profile') { if (!row) { json(rsp, 404, { error: 'Пользователь не найден' }); return; } row.user_type = b.user_type; row.expires_at = b.expires_at ? b.expires_at + ' 23:59:59' : null; row.settings = Object.assign({}, row.settings || {}, b.settings || {}); if (b.user_type === 'client') row.role_key = 'CL'; json(rsp, 200, { ok: true }); return; }
        if (b.action === 'approve') { if (!row) { json(rsp, 404, { error: 'Пользователь не найден' }); return; } row.active = 1; row.user_type = 'client'; row.role_key = 'CL'; row.expires_at = b.expires_at ? b.expires_at + ' 23:59:59' : null; row.settings = Object.assign({}, row.settings || {}, { registration_pending: 0, can_export: !!b.can_export }); json(rsp, 200, { ok: true }); return; }
        if (b.action === 'delete_user') { state.users = (state.users || []).filter(u => u.id !== b.id); json(rsp, 200, { ok: true }); return; }
        if (b.action === 'log') { json(rsp, 200, { rows: (state.userLog && state.userLog[b.id]) || [] }); return; }
        json(rsp, 200, { ok: true }); return;
      }
      if (ep === 'geo_master.php') { json(rsp, 404, { error: 'no master' }); return; }
      json(rsp, 200, { ok: true }); return;
    }

    if (p === '/') p = '/index.html';
    const f = path.join(OS_DIR, p);
    if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('404'); return; }
    rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rsp);
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res({ srv, base: 'http://127.0.0.1:' + srv.address().port, state })));
}
module.exports = { createMockServer };
